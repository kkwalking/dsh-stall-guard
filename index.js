/**
 * Stall Guard — a turn-ending watchdog for selected models.
 *
 * A model sometimes answers a step with text only and `finish_reason: stop`, so
 * the loop treats the turn as `completed` while the task is mid-flight: the
 * message often ends on a colon ("…now let me patch it:") and the user has to
 * type 继续. This plugin watches turn endings of the configured routes and, for
 * exactly that shape, asks a second model whether the turn really finished
 * (three-way verdict: continue / finished / uncertain).
 *
 * Two properties keep it safe:
 * - The verdict is a separate, cheap LLM call on a route outside the watched
 *   set, so a truncated stream can never masquerade as "finished".
 * - Resuming uses `agent.followup()`, not `agent.steer()`: steering only buys
 *   one more step over the same context, which is where the model already
 *   chose to stop. Only a follow-up resumption actually continues the task.
 *
 * @module @local/dsh-stall-guard
 */

/** Ways the panel can choose watched models: exact list or regex. */
const WATCH_MODES = ['exact', 'regex'];

/**
 * Fold the starting row config into the defaults this plugin owns, so the
 * plugin never depends on how its own `Config` schema object was materialized.
 * @param config - the row configuration handed to `apply`.
 * @param fallback - defined defaults.
 * @returns the effective configuration.
 */
function mergeConfig(config, fallback) {
  const source = config && typeof config === 'object' ? config : {};
  return {
    enabled: source.enabled ?? fallback.enabled,
    watchMode: WATCH_MODES.includes(source.watchMode) ? source.watchMode : fallback.watchMode,
    watchRoutes: Array.isArray(source.watchRoutes) ? source.watchRoutes.filter((value) => typeof value === 'string') : fallback.watchRoutes,
    watchRegex: typeof source.watchRegex === 'string' ? source.watchRegex : fallback.watchRegex,
    judge: { ...fallback.judge, ...(source.judge && typeof source.judge === 'object' ? source.judge : {}) },
    mode: source.mode ?? fallback.mode,
    autoRounds: source.autoRounds ?? fallback.autoRounds,
    minTurnSteps: source.minTurnSteps ?? fallback.minTurnSteps,
    maxHistoryMessages: source.maxHistoryMessages ?? fallback.maxHistoryMessages,
    allowPrematureStop: source.allowPrematureStop ?? fallback.allowPrematureStop,
    confirmRewrite: source.confirmRewrite ?? fallback.confirmRewrite,
    resumeStyle: source.resumeStyle === 'plain' ? 'plain' : 'guided',
    resumeText: typeof source.resumeText === 'string' ? source.resumeText : '',
    judgeTimeoutMs: source.judgeTimeoutMs ?? fallback.judgeTimeoutMs,
  };
}

/**
 * Build one identified user message from plain JSON content.
 * @param text - the message text.
 * @param source - its recorded source.
 * @returns an immutable user message.
 */
function userMessage(text, source) {
  return Object.freeze({
    id: globalThis.crypto.randomUUID(),
    role: 'user',
    content: Object.freeze([{ type: 'text', text }]),
    source: { ...source },
  });
}

/** Judging route used until one is configured. */
const DEFAULT_JUDGE = { provider: 'magpie', model: 'workbuddy/deepseek-v4.1-flash', reasoningEffort: 'low' };

/** The defaults every field falls back to. */
const CONFIG_DEFAULTS = {
  enabled: true,
  watchMode: 'exact',
  watchRoutes: [],
  watchRegex: '',
  judge: { ...DEFAULT_JUDGE },
  mode: 'suggest',
  autoRounds: 2,
  minTurnSteps: 1,
  maxHistoryMessages: 12,
  allowPrematureStop: false,
  confirmRewrite: false,
  resumeStyle: 'guided',
  resumeText: '',
  judgeTimeoutMs: 60000,
};


/** Verdicts the judging model may return; anything else reads as `uncertain`. */
const VERDICTS = ['continue', 'finished', 'uncertain'];

/** Longest closing excerpt kept in a record so the panel stays readable. */
const EXCERPT_MAX = 400;

/** Bare resume wording: exactly what a person types by hand. */
const RESUME_DEFAULT_PLAIN = '继续';

/** Guided resume wording: names the failure and demands action. */
const RESUME_DEFAULT_TEXT = '继续。上一轮没有调用工具就停下了，请直接从你说的下一步动手，直到任务真正做完再汇报。';

/** Extra demand the "continue without restating" switch appends. */
const RESUME_REWRITE_LINE = '不要再复述计划或重复上一轮的收尾说明，直接调用工具执行。';

/** Trailer that tells the model (and later readers) who sent this message. */
const RESUME_MARKER = '（断流守卫自动续跑）';

/** Longest custom resume wording accepted, so one setting cannot flood a turn. */
const RESUME_TEXT_MAX = 2000;

/** Longest watched-model regex accepted from the panel. */
const WATCH_REGEX_MAX = 1000;


/**
 * Collect the model-facing text of one message.
 * @param message - any message carrying text blocks.
 * @returns the concatenated text, trimmed.
 */
function textOf(message) {
  const content = (message && message.content) || [];
  let out = '';
  for (const block of content) {
    if (block && block.type === 'text' && typeof block.text === 'string') out += block.text;
  }
  return out.trim();
}

/**
 * Read the provider/model of the session's current request envelope.
 * @param session - the agent's session.
 * @returns the route the last request used.
 */
function routeOf(session) {
  const header = session.requestHeader && session.requestHeader();
  const context = session.requestContext && session.requestContext();
  return {
    provider: (header && header.config && header.config.provider) || (context && context.provider) || '',
    model: (header && header.config && header.config.model) || (context && context.model) || '',
  };
}

/**
 * Whether a route belongs to the configured watched set.
 * @param route - provider and model id.
 * @param config - plugin configuration.
 * @returns true when the route is watched.
 */
function isWatched(route, config) {
  const provider = route.provider || '';
  const model = route.model || '';
  const combined = `${provider}/${model}`;
  const mode = config.watchMode || 'exact';
  if (mode === 'exact') {
    const routes = config.watchRoutes || [];
    return routes.some((needle) => needle === combined || needle === model);
  }
  if (mode === 'regex') {
    const pattern = watchRegex(config);
    return pattern !== undefined && pattern !== null && pattern.test(combined);
  }
  return false;
}

/**
 * Compile the optional watched-model regex.
 * @param config - plugin configuration.
 * @returns a case-insensitive regex, null for an invalid expression, or
 *   undefined when no expression is configured.
 */
function watchRegex(config) {
  const raw = typeof config.watchRegex === 'string' ? config.watchRegex.trim() : '';
  if (!raw) return undefined;
  try {
    return new RegExp(raw, 'i');
  } catch {
    return null;
  }
}

/**
 * Whether a judging route is acceptably outside the watched set.
 * @param route - candidate judge route.
 * @param config - plugin configuration.
 * @returns true when the judge is not itself a watched route.
 */
function isAcceptableJudge(route, config) {
  if (!route.provider || !route.model) return false;
  // The selected watch scope is authoritative: never judge with a route the
  // watchdog itself treats as watched.
  return !isWatched(route, config);
}

/**
 * Walk the session's own log backwards to summarize the turn that is ending.
 * @param session - the agent's session.
 * @param turn - the turn number that is ending.
 * @param minSteps - smallest step count worth judging.
 * @param maxMessages - how many recent messages to keep for the judge.
 * @returns the turn summary, or undefined when the turn is not judgeable.
 */
function summarizeTurn(session, turn, minSteps, maxMessages) {
  const events = session.ownEvents();
  let steps = 0;
  let assistantMessages = 0;
  let lastAssistant = null;
  let sawUserRequest = false;
  const recent = [];
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    const data = event && event.data;
    if (!data) continue;
    if (event.type === 'turn/start') {
      if (data.turn === turn) break;
      continue;
    }
    if (event.type === 'step/start') {
      if (data.turn === turn) steps += 1;
      continue;
    }
    if (event.type === 'assistant/message') {
      if (data.turn !== turn) continue;
      assistantMessages += 1;
      if (lastAssistant === null) lastAssistant = data.message;
      if (recent.length < maxMessages) {
        const text = textOf(data.message);
        if (text) recent.push({ role: 'assistant', text });
      }
      continue;
    }
    if (event.type === 'tool/result') {
      if (data.turn !== turn) continue;
      if (recent.length < maxMessages) {
        const text = textOf(data.message);
        if (text) recent.push({ role: 'tool', text });
      }
      continue;
    }
    if (event.type === 'tool/call') {
      if (data.turn !== turn) continue;
      if (recent.length < maxMessages) {
        recent.push({ role: 'tool-call', text: `${data.name} ${String(data.arguments || '').slice(0, 160)}` });
      }
      continue;
    }
    if (event.type === 'user/message') {
      const source = data.source || {};
      if (source.kind !== 'user' && source.kind !== 'goal' && source.kind !== 'stall-guard') continue;
      sawUserRequest = true;
      if (recent.length < maxMessages) {
        const text = textOf(data);
        if (text) recent.push({ role: 'user', text: text.slice(0, 600) });
      }
    }
  }
  if (lastAssistant === null || !sawUserRequest) return undefined;
  // A one-step turn is exactly where a streamed answer most often dies: the
  // model emits one text-only step (`finish_reason: stop`) before any tool
  // call. Never let the multi-step threshold hide that case.
  if (steps > 1 && steps < minSteps) return undefined;
  const lastText = textOf(lastAssistant);
  if (!lastText) return undefined;
  return { steps, assistantMessages, lastText, history: recent.reverse() };
}

/**
 * Read the user's most recent instruction, as context for the judge.
 * @param session - the agent's session.
 * @returns the latest genuine user text, best effort.
 */
function lastUserObjective(session) {
  const events = session.ownEvents();
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event || event.type !== 'user/message') continue;
    const source = (event.data && event.data.source) || {};
    if (source.kind !== 'user') continue;
    const text = textOf(event.data);
    if (text) return text;
  }
  return '';
}

/**
 * Build the judge prompt: the turn's recent exchange plus its closing message.
 * @param summary - the turn summary.
 * @param objective - the user's most recent instruction.
 * @returns the judgment request.
 */
function judgePrompt(summary, objective) {
  const transcript = summary.history
    .map((entry) => `[${entry.role}] ${String(entry.text || '').slice(0, 900)}`)
    .join('\n\n');
  return [
    '你是"断流守卫"。一个编码 Agent 刚刚结束了一轮工作。',
    '你要判断：**这一轮是真的做完了，还是被截断了**（模型话说到一半，本该继续调用工具，却因为上游断流只输出了一段文字就停了）。',
    '',
    '用户这一轮的目标（可能只是上下文）：',
    objective ? String(objective).slice(0, 1200) : '（未知）',
    '',
    '这一轮最近的交流（从旧到新）：',
    transcript || '（无）',
    '',
    '本轮最后一段输出（这是唯一需要判定的对象）：',
    '-----',
    summary.lastText.slice(-2500),
    '-----',
    '',
    '判定标准：',
    '- continue：这段话是在说明接下来还要做什么（典型如以"：" "让我…" "接下来…" "现在…" "我将…" 收尾），或明确表示还有步骤没做，但这一轮没有发出任何工具调用就结束了。',
    '- finished：这段话是完整的收尾、汇报或结论，任务确实告一段落；或者它是在向用户提问、请求确认、等待用户决定（这是正常结束，不是截断）。',
    '- uncertain：信息不足，拿不准。',
    '',
    '严格只输出一行 JSON，键名必须是 verdict 和 reason，不要多余字段、不要 Markdown、不要解释：',
    '{"verdict":"continue|finished|uncertain","reason":"不超过 40 字的中文依据"}',
  ].join('\n');
}

/**
 * Parse one judge reply into a verdict.
 * @param text - raw model output.
 * @returns verdict and reason.
 */
function parseVerdict(text) {
  const raw = String(text || '').trim();
  if (!raw) return { verdict: 'uncertain', reason: '判定模型返回空内容' };
  const normalize = (value) => {
    const candidate = String(value ?? '').trim().toLowerCase();
    if (candidate === 'continue' || candidate === 'continues' || candidate === 'truncated') return 'continue';
    if (candidate === 'finished' || candidate === 'finish' || candidate === 'stop' || candidate === 'done' || candidate === 'complete') return 'finished';
    return null;
  };
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      // Models answer this shape with `verdict`, `status`, `result`, or `answer`;
      // accept any single field whose value names one of the three verdicts.
      const values = parsed && typeof parsed === 'object' ? Object.values(parsed) : [];
      let verdict = normalize(parsed?.verdict);
      if (verdict === null) {
        for (const value of values) {
          const candidate = normalize(value);
          if (candidate !== null) {
            verdict = candidate;
            break;
          }
        }
      }
      const reasonValue = parsed?.reason ?? parsed?.explanation ?? parsed?.why ?? '';
      if (verdict !== null) return { verdict, reason: typeof reasonValue === 'string' ? reasonValue.slice(0, 400) : '' };
    } catch {
      /* fall through to the loose scan */
    }
  }
  const lowered = raw.toLowerCase();
  for (const verdict of VERDICTS) {
    if (lowered.includes(verdict)) return { verdict, reason: raw.slice(0, 400) };
  }
  if (/\btruncat|could continue|incomplete|mid-?sentence/.test(lowered)) return { verdict: 'continue', reason: raw.slice(0, 400) };
  return { verdict: 'uncertain', reason: raw.slice(0, 400) };
}

/**
 * Text of the follow-up message that resumes a truncated turn.
 *
 * Two styles exist because the two failures differ: `plain` mirrors what the
 * user types by hand (one bare 继续, smallest possible intervention and the
 * least chance of fighting the user's own instructions), while `guided` states
 * the fact that the turn stopped without a tool call and demands action, which
 * is what actually breaks the "restate the plan, then stop again" loop.
 *
 * @param options - resolved settings carrying `resumeStyle` and `resumeText`.
 * @param rewrite - whether to demand action instead of restatement.
 * @returns the message body.
 */
function resumeText(options, rewrite) {
  const configured = typeof options?.resumeText === 'string' ? options.resumeText.trim() : '';
  const guidedDefault = RESUME_DEFAULT_TEXT;
  const plainDefault = RESUME_DEFAULT_PLAIN;
  const style = options?.resumeStyle === 'plain' ? 'plain' : 'guided';
  const lines = [configured !== '' ? configured : style === 'plain' ? plainDefault : guidedDefault];
  // The plain style stays a single bare word unless the user asked for the
  // extra demand; the guided style already carries its demand in the body.
  if (rewrite && style === 'plain') lines.push(RESUME_REWRITE_LINE);
  else if (rewrite && configured !== '' && !configured.includes(RESUME_REWRITE_LINE)) lines.push(RESUME_REWRITE_LINE);
  lines.push(RESUME_MARKER);
  return lines.join('\n');
}

/**
 * One identified user message that resumes work.
 * @param verdict - the verdict that triggered it.
 * @param reason - the judge's reason, recorded durably.
 * @param rewrite - whether to demand action instead of restatement.
 * @param options - resolved settings carrying the resume wording.
 * @returns an immutable user message.
 */
function resumeMessage(verdict, reason, rewrite, options) {
  return userMessage(resumeText(options, rewrite), { kind: 'stall-guard', turn: 0, verdict, reason: String(reason || '').slice(0, 200) });
}

/**
 * In-memory verdict history; the panel reads it, nothing else depends on it.
 * Bounded so a long-lived session cannot grow without limit.
 */
const MAX_RECORDS = 400;

/**
 * Plugin body.
 * @param ctx - plugin context.
 * @param config - validated row configuration.
 */
export function apply(ctx, config) {
  const rounds = new Map();
  const running = new Set();
  const records = [];

  /** Preferences the panel saved at runtime; they win over the starting row config. */
  let saved = {};
  const normalized = () => mergeConfig({ ...mergeConfig(config, CONFIG_DEFAULTS), ...saved }, CONFIG_DEFAULTS);
  let settings = normalized();

  /**
   * Persist the panel's preferences on this plugin's own Loader row.
   *
   * Editing the row through the profile's configuration editor is what makes
   * the panel survive a restart: `apply` receives the same merged config on the
   * next boot. A composition without an editor keeps the change in memory and
   * reports that it was not persisted.
   */
  const persistSettings = async (patch) => {
    const editor = ctx.get('configEditor');
    if (editor === undefined || typeof editor.edit !== 'function') {
      const error = new Error('这个 profile 没有可用的配置编辑器');
      error.code = 'NO_CONFIG_EDITOR';
      throw error;
    }
    const entry = ctx.fiber?.entry;
    if (entry === undefined) {
      const error = new Error('当前插件没有可写回的配置行');
      error.code = 'NO_PLUGIN_ROW';
      throw error;
    }
    await editor.edit(entry, (current, inherited) => ({ ...inherited, ...current, ...patch }));
  };

  /** Ask the judging route one three-way question about this turn ending. */
  const judgeTurn = async (agent, summary, active) => {
    const route = { provider: active.judge.provider, model: active.judge.model };
    if (!isAcceptableJudge(route, active)) {
      const error = new Error('判定模型不能是正在监测的模型');
      error.code = 'JUDGE_NOT_ALLOWED';
      throw error;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('judge timeout')), active.judgeTimeoutMs);
    try {
      const models = await ctx.llm.listModels(route.provider).catch(() => []);
      if (Array.isArray(models) && models.length > 0 && !models.some((model) => model.id === route.model)) {
        const error = new Error(`判定模型 ${route.provider}/${route.model} 不在该供应商的模型列表里`);
        error.code = 'JUDGE_UNKNOWN_MODEL';
        throw error;
      }
      const prepared = await ctx.llm.prepareCall(route, controller.signal);
      // A prepared call rejects any config field that differs from what it
      // resolved, so the judge request repeats the exact resolved controls.
      const resolved = prepared.config;
      let text = '';
      for await (const chunk of prepared.stream({
        provider: resolved.provider,
        model: resolved.model,
        ...(resolved.reasoningEffort === undefined ? {} : { reasoningEffort: resolved.reasoningEffort }),
        ...(resolved.temperature === undefined ? {} : { temperature: resolved.temperature }),
        ...(resolved.maxTokens === undefined ? {} : { maxTokens: resolved.maxTokens }),
        ...(resolved.stop === undefined ? {} : { stop: resolved.stop }),
        messages: [{ role: 'user', content: [{ type: 'text', text: judgePrompt(summary, lastUserObjective(agent.session)) }] }],
        sessionId: agent.session.id,
        signal: controller.signal,
      })) {
        if (!chunk) continue;
        if (chunk.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text;
        if (chunk.type === 'finish' && chunk.reason?.kind === 'error') {
          throw new Error(chunk.reason.failure?.message ?? '判定模型返回错误');
        }
      }
      return parseVerdict(text);
    } finally {
      clearTimeout(timer);
    }
  };

  /**
   * The per-session verdict of the turn currently closing. The judge runs while
   * the turn boundary is still open (the only moment a verdict can matter), but
   * the resumption itself is submitted after `turn/end`, where a follow-up turn
   * is a legal inbox operation instead of a race with turn quiescence.
   */
  const pending = new Map();

  /** The decision for one turn ending, taken before the boundary commits. */
  const inspect = async (agent, turn) => {
    if (!settings.enabled) return;
    if (!agent?.session) return;
    if (running.has(agent.session.id)) return;
    const route = routeOf(agent.session);
    if (!isWatched(route, settings)) return;
    const summary = summarizeTurn(agent.session, turn, settings.minTurnSteps, settings.maxHistoryMessages);
    if (summary === undefined) return;

    running.add(agent.session.id);
    pending.set(agent.session.id, { sessionId: agent.session.id, turn, config: null });
    const previous = rounds.get(agent.session.id);
    const used = previous?.turn === turn ? previous.count : 0;
    const base = {
      sessionId: agent.session.id,
      turn,
      at: Date.now(),
      provider: route.provider,
      model: route.model,
      judgeProvider: settings.judge.provider,
      judgeModel: settings.judge.model,
      excerpt: summary.lastText.slice(-EXCERPT_MAX),
      rounds: used,
    };
    try {
      let verdict;
      let reason;
      try {
        const judged = await judgeTurn(agent, summary, settings);
        verdict = judged.verdict;
        reason = judged.reason;
      } catch (error) {
        verdict = 'error';
        reason = String(error?.message ?? error).slice(0, 400);
      }
      const plan = {
        auto: verdict === 'continue' && !settings.allowPrematureStop && settings.mode === 'auto-continue' && used < settings.autoRounds,
        settings,
        reason,
      };
      const own = pending.get(agent.session.id);
      if (own !== undefined && own.turn === turn) own.config = plan;
      const action = verdict === 'continue' && !settings.allowPrematureStop ? (plan.auto ? 'auto' : 'suggest') : 'none';
      records.push({ ...base, verdict, reason, action });
      if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS);
    } finally {
      running.delete(agent.session.id);
    }
  };

  ctx.effect(() => {
    const offStopping = ctx.on('agent/turn-stopping', async ({ agent, turn }) => {
      try {
        await inspect(agent, turn);
      } catch (error) {
        ctx.logger?.warn?.(`stall-guard: turn inspection failed: ${String(error)}`);
      }
    });
    // `turn/end` and `turn/start` are session-log events, not agent-scoped
    // notifications: subscribe to the session event stream and read the
    // payload from `event.data`, otherwise the auto-resume decision would
    // never run after the turn boundary.
    const offSession = ctx.on('session/event', (session, event) => {
      if (!event || typeof event.type !== 'string') return;
      if (event.type === 'turn/start') {
        const turn = event.data?.turn;
        const own = pending.get(session.id);
        if (own !== undefined && own.turn !== turn) pending.delete(session.id);
        const current = rounds.get(session.id);
        if (current !== undefined && current.turn !== turn) rounds.delete(session.id);
        return;
      }
      if (event.type !== 'turn/end') return;
      const turn = event.data?.turn;
      const reason = event.data?.reason;
      const settled = pending.get(session.id);
      pending.delete(session.id);
      if (settled === undefined || settled.turn !== turn || settled.sessionId !== session.id) return;
      const plan = settled.config;
      if (plan === null || !plan.auto) return;
      if (reason?.kind !== 'completed') return;
      const previous = rounds.get(settled.sessionId);
      const used = previous?.turn === turn ? previous.count : 0;
      if (used >= plan.settings.autoRounds) return;
      // `session/event` fires synchronously inside Session.append. Queue the
      // follow-up outside that publication window; appending from the listener
      // itself would be a reentrant session append.
      queueMicrotask(() => {
        const live = ctx.agents.get(settled.sessionId);
        if (live === undefined) return;
        rounds.set(settled.sessionId, { turn, count: used + 1 });
        live.followup(resumeMessage('continue', plan.reason, plan.settings.confirmRewrite, plan.settings));
      });
    });
    return () => {
      offStopping();
      offSession();
    };
  }, 'stall-guard: turn observers');

  /**
   * Serve the panel's JSON endpoint. A plugin-owned route keeps the browser half
   * free of module-level imports: the document-relative path rides the session
   * cookie the list page already carries.
   */
  ctx.inject(['webServer'], (runtimeCtx) => {
    const server = runtimeCtx.webServer;
    const routes = new Set();
    const reply = (res, status, value) => {
      res.statusCode = status;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.setHeader('cache-control', 'no-store');
      res.end(JSON.stringify(value));
    };
    const readBody = (req) =>
      new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => {
          raw += chunk;
          if (raw.length > 65536) {
            reject(new Error('请求体过大'));
            req.destroy();
          }
        });
        req.on('end', () => {
          if (!raw) return resolve(null);
          try {
            resolve(JSON.parse(raw));
          } catch {
            reject(new Error('请求体不是 JSON'));
          }
        });
        req.on('error', reject);
      });
    const dispatch = async (action, req, res) => {
      const service = ctx.get('stallGuard');
      try {
        if (action === 'status') {
          const url = new URL(req.url ?? '/', 'http://local');
          const sessionId = url.searchParams.get('sessionId') ?? undefined;
          reply(res, 200, service.status(sessionId ?? undefined));
          return;
        }
        if (action === 'routes') {
          reply(res, 200, await service.routes());
          return;
        }
        if (action === 'saveConfig') {
          reply(res, 200, await service.save(await readBody(req)));
          return;
        }
        if (action === 'resume') {
          const body = (await readBody(req)) ?? {};
          reply(res, 200, service.resume(String(body.sessionId ?? ''), Boolean(body.rewrite)));
          return;
        }
        reply(res, 404, { error: `未知操作 ${action}` });
      } catch (error) {
        reply(res, 400, { error: String(error?.message ?? error) });
      }
    };
    runtimeCtx.effect(() => {
      for (const action of ['status', 'routes', 'saveConfig', 'resume']) {
        routes.add(
          server.register({
            kind: 'prefix',
            path: `/api/stall-guard/${action}`,
            handler: (req, res) => dispatch(action, req, res),
          }),
        );
      }
      return () => {
        for (const dispose of routes) {
          try {
            dispose?.();
          } catch {
            /* already removed with the server */
          }
        }
      };
    }, 'stall-guard: http routes');
  });

  ctx.logger?.info?.('stall-guard: active');
  ctx.provide('stallGuard', {
    /** Live configuration, for the panel. */
    config: () => {
      settings = normalized();
      return { ...settings, judge: { ...settings.judge } };
    },
    /** Snapshot the panel renders: configuration, counters, and recent rows. */
    status: (sessionId) => {
      const all = records;
      const rows = (sessionId ? all.filter((row) => row.sessionId === sessionId) : all).slice(-60).reverse();
      const counts = { checked: 0, continued: 0, suggest: 0, finished: 0, skipped: 0, errors: 0 };
      for (const row of all) {
        if (row.verdict === 'continue') {
          counts.checked += 1;
          if (row.action === 'auto') counts.continued += 1;
          else counts.suggest += 1;
        } else if (row.verdict === 'finished') {
          counts.checked += 1;
          counts.finished += 1;
        } else if (row.verdict === 'error') counts.errors += 1;
        else counts.skipped += 1;
      }
      const active = normalized();
      return { config: { ...active, judge: { ...active.judge } }, counts, total: all.length, rows };
    },
    /** Candidate judging routes outside the watched set. */
    routes: async () => {
      const active = normalized();
      const out = [];
      const models = [];
      for (const provider of ctx.llm.listProviders()) {
        let providerModels = [];
        try {
          providerModels = await ctx.llm.listModels(provider.id);
        } catch {
          continue;
        }
        for (const model of providerModels) {
          const entry = {
            provider: provider.id,
            model: model.id,
            label: `${provider.name || provider.id} · ${model.name || model.id}`,
          };
          models.push(entry);
          if (isAcceptableJudge({ provider: provider.id, model: model.id }, active)) out.push(entry);
        }
      }
      return { routes: out, models };
    },
    /** Save every panel-visible preference, including the judging route. */
    save: async (input) => {
      const next = {};
      for (const key of ['enabled', 'mode', 'watchMode', 'watchRoutes', 'watchRegex', 'autoRounds', 'minTurnSteps', 'allowPrematureStop', 'confirmRewrite', 'resumeStyle', 'resumeText']) {
        if (input?.[key] !== undefined) next[key] = input[key];
      }
      if (next.watchMode !== undefined && !WATCH_MODES.includes(next.watchMode)) next.watchMode = 'exact';
      if (next.watchRoutes !== undefined) {
        next.watchRoutes = Array.isArray(next.watchRoutes)
          ? next.watchRoutes.filter((value) => typeof value === 'string' && value.length > 0).slice(0, 200)
          : [];
      }
      if (next.watchRegex !== undefined) next.watchRegex = String(next.watchRegex ?? '').slice(0, WATCH_REGEX_MAX);
      if (next.resumeText !== undefined) next.resumeText = String(next.resumeText ?? '').slice(0, RESUME_TEXT_MAX);
      if (input?.judge !== undefined) {
        const candidate = {
          provider: String(input.judge.provider ?? ''),
          model: String(input.judge.model ?? ''),
          ...(typeof input.judge.reasoningEffort === 'string' && input.judge.reasoningEffort !== ''
            ? { reasoningEffort: input.judge.reasoningEffort }
            : {}),
        };
        if (!isAcceptableJudge(candidate, normalized())) {
          const error = new Error('判定模型不能是正在监测的模型');
          error.code = 'JUDGE_NOT_ALLOWED';
          throw error;
        }
        next.judge = candidate;
      }
      saved = { ...saved, ...next };
      settings = normalized();
      // Persisting needs the profile's configuration editor; a composition
      // without one keeps the change in memory and says so instead of failing
      // the whole save after it already took effect.
      let persisted = true;
      let message;
      try {
        await persistSettings(next);
      } catch (error) {
        persisted = false;
        message = String(error?.message ?? error);
      }
      return { ok: true, persisted, ...(message === undefined ? {} : { message }) };
    },
    /** Manual resume of one recorded turn, when its session is still live. */
    resume: (sessionId, rewrite = false) => {
      const agent = ctx.agents.get(sessionId);
      if (agent === undefined) {
        const error = new Error('这个会话已经不在运行，无法续跑');
        error.code = 'NO_AGENT';
        throw error;
      }
      agent.followup(resumeMessage('continue', '手动续跑', Boolean(rewrite), normalized()));
      return { ok: true };
    },
  });
}

export const inject = ['llm', 'agents'];

export default Object.assign(apply, { inject });
