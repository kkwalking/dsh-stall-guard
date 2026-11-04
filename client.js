/**
 * Stall Guard — browser bundle.
 *
 * Plain CJS-classic bundle in the format the Harness module table expects:
 * registering a lazy factory whose materialization returns the Cordis plugin.
 *
 * Contributes one global sidebar panel (glyph into `sidebar.panellist`, page
 * under the matching `main` key) that shows which watched turns stopped without
 * a tool call, what the judging model decided, and a one-click resume for the
 * turns it flagged. All data crosses the wire through `host.call`.
 *
 * @module @local/dsh-stall-guard/client
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-stall-guard',
  factory(require) {
    var React = require('react');

    const NS = 'stall-guard';
    const PANEL_ID = 'stall-guard';
    /** Plugin-private JSON endpoint served by the Host half. */
    const API = 'api/stall-guard';
    /** Locale dictionaries embedded in the bundle; registered on apply. */
    const DICTS = {
      zh: {
        "panel": "断流守卫",
        "title": "断流守卫",
        "subtitle": "用另一个模型复查指定模型的收尾",
        "enabled": "启用监测",
        "enabledHint": "关闭后只记录，不调用判定模型。",
        "mode": "处理方式",
        "modeSuggest": "提示（推荐）",
        "modeAutoContinue": "自动续跑",
        "modeHint": "提示模式只记录并在对话里标出；自动续跑模式会在判定为“被截断”且续跑次数未用完时自动继续。",
        "judgeModel": "判定模型",
        "judgeModelHint": "判定模型不能是正在监测的模型。随设置保存，重启后仍然生效。",
        "autoRounds": "自动续跑上限",
        "autoRoundsHint": "同一轮里最多自动续跑几次，防止死循环。",
        "minTurnSteps": "最少步数",
        "minTurnStepsHint": "多步轮次至少走这么多步才参与判定；单步收尾一定会复查，因为流式输出最常死在第一步。",
        "allowPrematureStop": "允许提前收尾",
        "allowPrematureStopHint": "开启后，判定模型认为任务没做完也会尊重模型的收尾，只记录不续跑。",
        "confirmRewrite": "未复述就继续",
        "confirmRewriteHint": "开启后写一句“还有下一步就直接做，不要只复述计划”。",
        "stats": "统计",
        "statChecked": "已复查",
        "statContinued": "自动续跑",
        "statSuggest": "待你继续",
        "statFinished": "正常结束",
        "statSkipped": "未复查",
        "statErrors": "判定失败",
        "events": "最近判定",
        "empty": "还没有记录。用被监测的模型跑一个多步任务后，这里会出现每一轮的复查结果。",
        "verdictContinue": "被截断",
        "verdictFinished": "已结束",
        "verdictUncertain": "不确定",
        "verdictError": "判定失败",
        "verdictSkipped": "未复查",
        "actionContinue": "继续",
        "actionContinueHint": "补发一条“继续”消息。",
        "actionRewrite": "催它动手",
        "actionRewriteHint": "再试一次，但明确要求直接动手而不是复述计划。",
        "enabledNo": "已关闭监测",
        "noSession": "当前没有选中的会话，所以没有实时监测。",
        "currentSession": "当前会话",
        "colTurn": "轮次",
        "colVerdict": "判定",
        "colReason": "依据",
        "colAction": "操作",
        "reasonLabel": "理由",
        "loading": "加载中…",
        "refresh": "刷新",
        "save": "保存",
        "saved": "已保存",
        "saveFailed": "保存失败",
        "reset": "恢复默认",
        "resumeStyle": "续跑文案",
        "resumeStyleHint": "“纯继续”只发一个「继续」，最贴近你手动打断后的做法；“带引导语”会说明上一轮没调工具就停了，并要求直接动手。",
        "resumeStylePlain": "纯继续（只发「继续」）",
        "resumeStyleGuided": "带引导语（说明停在哪 + 要求动手）",
        "resumeText": "自定义文案",
        "resumeTextHint": "留空用所选档位的默认文案；填写后两档都用这段自定义文案。末尾会自动附加「（断流守卫自动续跑）」标记。",
        "resumePlaceholderPlain": "继续",
        "resumePlaceholderGuided": "继续。上一轮没有调用工具就停下了，请直接从你说的下一步动手，直到任务真正做完再汇报。",
        "settings": "监测设置",
        "on": "开",
        "off": "关",
        "watchMode": "监测模型",
        "watchModeHint": "选择要监测哪些模型：精确选择或正则匹配。",
        "watchModeExact": "精确选择",
        "watchModeRegex": "正则匹配",
        "watchExact": "精确模型",
        "watchExactHint": "从当前可用模型列表中选择要监测的模型，可多选。",
        "watchExactPlaceholder": "添加一个模型…",
        "watchExactEmpty": "还没有选择模型，当前不会监测任何模型。",
        "watchRegex": "模型正则",
        "watchRegexHint": "对「provider/model」做正则匹配（不区分大小写），例如 ^magpie-responses/.*。",
        "watchRegexPlaceholder": "^magpie-responses/.*",
        "watchRegexEmpty": "输入正则后显示匹配到的模型。",
        "watchRegexInvalid": "正则无效：",
        "watchMatches": "匹配到 {n} 个模型",
        "watchNoMatches": "没有匹配的模型",
        "remove": "移除",
        "watchNoModels": "没有可用模型"
      },
      en: {
        "panel": "Stall Guard",
        "title": "Stall Guard",
        "subtitle": "Recheck watched model turn endings with another model",
        "enabled": "Enable monitoring",
        "enabledHint": "When off, turns are recorded but the judging model is never called.",
        "mode": "Handling",
        "modeSuggest": "Suggest (recommended)",
        "modeAutoContinue": "Auto-continue",
        "modeHint": "Suggest only records and marks the turn; auto-continue also resumes when the turn looks truncated and rounds remain.",
        "judgeModel": "Judging model",
        "judgeModelHint": "The judge must not be one of the watched models. It is saved with the other settings and survives a restart.",
        "autoRounds": "Auto-continue limit",
        "autoRoundsHint": "Maximum automatic resumptions inside one turn.",
        "minTurnSteps": "Minimum steps",
        "minTurnStepsHint": "Multi-step turns must reach this many steps before judging; single-step endings are always rechecked because streamed answers most often die on the first step.",
        "allowPrematureStop": "Allow early stop",
        "allowPrematureStopHint": "When on, a model that wrapped up with work left is respected: record only, never resume.",
        "confirmRewrite": "Continue without restating",
        "confirmRewriteHint": "When on, add one line telling the model to act on the next step instead of restating the plan.",
        "stats": "Counters",
        "statChecked": "Checked",
        "statContinued": "Auto-continued",
        "statSuggest": "Waiting for you",
        "statFinished": "Finished",
        "statSkipped": "Not checked",
        "statErrors": "Judge errors",
        "events": "Recent verdicts",
        "empty": "No records yet. Run a multi-step task on a watched model and each turn’s verdict appears here.",
        "verdictContinue": "Truncated",
        "verdictFinished": "Finished",
        "verdictUncertain": "Uncertain",
        "verdictError": "Judge error",
        "verdictSkipped": "Not checked",
        "actionContinue": "Continue",
        "actionContinueHint": "Queue one more \"continue\" message.",
        "actionRewrite": "Push it to act",
        "actionRewriteHint": "Try again, but require acting on the next step instead of restating the plan.",
        "enabledNo": "Monitoring is off",
        "noSession": "No session is selected, so nothing is monitored live.",
        "currentSession": "Current session",
        "colTurn": "Turn",
        "colVerdict": "Verdict",
        "colReason": "Basis",
        "colAction": "Action",
        "reasonLabel": "Reason",
        "loading": "Loading…",
        "refresh": "Refresh",
        "save": "Save",
        "saved": "Saved",
        "saveFailed": "Save failed",
        "reset": "Reset",
        "resumeStyle": "Resume wording",
        "resumeStyleHint": "\"Plain\" sends a bare \"continue\", closest to what you type by hand; \"Guided\" states that the last turn stopped without a tool call and demands action.",
        "resumeStylePlain": "Plain (just \"continue\")",
        "resumeStyleGuided": "Guided (name the stop + demand action)",
        "resumeText": "Custom wording",
        "resumeTextHint": "Empty uses the selected style's default. A custom wording replaces both styles and gets the \"(stall guard auto-resume)\" marker appended.",
        "resumePlaceholderPlain": "Continue",
        "resumePlaceholderGuided": "Continue. The last turn stopped without calling a tool — pick up the next step you named and work until the task is actually done.",
        "settings": "Settings",
        "on": "On",
        "off": "Off",
        "watchMode": "Watched models",
        "watchModeHint": "Choose which models to watch: exact selection or regex match.",
        "watchModeExact": "Exact selection",
        "watchModeRegex": "Regex match",
        "watchExact": "Exact models",
        "watchExactHint": "Pick one or more models from the current catalog.",
        "watchExactPlaceholder": "Add a model…",
        "watchExactEmpty": "No models selected; nothing will be watched.",
        "watchRegex": "Model regex",
        "watchRegexHint": "Case-insensitive regex matched against “provider/model”, e.g. ^magpie-responses/.*.",
        "watchRegexPlaceholder": "^magpie-responses/.*",
        "watchRegexEmpty": "Type a regex to preview matching models.",
        "watchRegexInvalid": "Invalid regex: ",
        "watchMatches": "Matched {n} models",
        "watchNoMatches": "No matching models",
        "remove": "Remove",
        "watchNoModels": "No models available"
      },
    };

    /**
     * Call one Host operation over the plugin's own route. The page is served
     * same-origin, so the document-relative path carries the session cookie
     * without a module-level import.
     * @param action - operation name.
     * @param body - JSON payload (or null).
     * @returns the parsed reply.
     */
    async function callHost(action, body) {
      const response = await fetch(`${API}/${action}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      let value = null;
      try {
        value = text ? JSON.parse(text) : null;
      } catch (error) {
        throw new Error(text.slice(0, 300) || `HTTP ${response.status}`);
      }
      if (!response.ok) throw new Error((value && value.error) || `HTTP ${response.status}`);
      return value;
    }

    /** Theme tokens only; literal colors stay inside the artwork. */
    const CSS = [
      '.sg-root{box-sizing:border-box;display:flex;flex-direction:column;height:100%;min-width:0;overflow:auto;padding:24px 28px 40px;gap:0}',
      '.sg-head{display:flex;align-items:flex-start;gap:10px;min-width:0}',
      '.sg-headText{min-width:0;flex:1}',
      '.sg-title{margin:0;font-size:20px;line-height:28px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.sg-sub{margin:4px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}',
      '.sg-section{margin-top:18px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:16px}',
      '.sg-sectionTitle{margin:0 0 10px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.sg-row{display:flex;align-items:center;gap:12px;padding:8px 0;min-width:0;flex-wrap:wrap}',
      '.sg-row+.sg-row{border-top:1px solid var(--dsw-alias-border-l1)}',
      '.sg-label{flex:0 0 140px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}',
      '.sg-control{display:flex;align-items:center;gap:8px;flex:1 1 220px;min-width:0;flex-wrap:wrap}',
      '.sg-hint{flex-basis:100%;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
      '.sg-select,.sg-input{box-sizing:border-box;height:30px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;min-width:0;max-width:320px}',
      '.sg-input.sg-num{width:84px;max-width:84px;flex:none}',
      '.sg-select.sg-wide,.sg-input.sg-wide{max-width:520px;width:100%}',

      '.sg-chips{display:flex;flex-wrap:wrap;gap:6px;flex-basis:100%;margin-top:2px}',
      '.sg-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-base);font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);max-width:100%;word-break:break-all}',
      '.sg-chipRemove{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:1;cursor:pointer;padding:0}',
      '.sg-chipRemove:hover{color:var(--dsw-alias-state-error-primary)}',
      '.sg-matchList{display:flex;flex-direction:column;gap:2px;flex-basis:100%;max-height:160px;overflow:auto;margin-top:2px}',
      '.sg-matchItem{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);padding:2px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}',
      '.sg-matchItem:last-child{border-bottom:none}',
      '.sg-regexBad{color:var(--dsw-alias-state-error-primary)}',
      '.sg-textarea{box-sizing:border-box;width:100%;max-width:560px;min-height:64px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:20px;resize:vertical}',
      '.sg-select:focus-visible,.sg-input:focus-visible,.sg-textarea:focus-visible,.sg-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.sg-btn{box-sizing:border-box;height:30px;padding:0 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;cursor:pointer;white-space:nowrap}',
      '.sg-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}',
      '.sg-btn:disabled{opacity:.5;cursor:default}',
      '.sg-btn.sg-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
      '.sg-switch{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--dsw-alias-label-primary);cursor:pointer}',
      '.sg-switch input{width:16px;height:16px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}',
      '.sg-stats{display:flex;flex-wrap:wrap;gap:8px}',
      '.sg-stat{min-width:92px;flex:1 1 92px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);padding:10px 12px}',
      '.sg-statValue{font-size:20px;line-height:26px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}',
      '.sg-statLabel{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
      '.sg-scroll{overflow-x:auto;margin:0 -8px}',
      '.sg-table{width:100%;border-collapse:collapse;font-size:13px}',
      '.sg-table th{text-align:left;font-weight:500;color:var(--dsw-alias-label-tertiary);font-size:12px;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);white-space:nowrap}',
      '.sg-table td{padding:8px;border-bottom:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);vertical-align:top}',
      '.sg-table tr:last-child td{border-bottom:none}',
      '.sg-dim{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.sg-excerpt{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;word-break:break-word;max-width:520px}',
      '.sg-badge{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;line-height:18px;border:1px solid currentColor;white-space:nowrap}',
      '.sg-continue{color:var(--dsw-alias-state-warn-primary)}',
      '.sg-finished{color:var(--dsw-alias-state-success-primary)}',
      '.sg-uncertain{color:var(--dsw-alias-label-secondary)}',
      '.sg-error{color:var(--dsw-alias-state-error-primary)}',
      '.sg-skipped{color:var(--dsw-alias-state-idle-primary)}',
      '.sg-empty{margin:8px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}',
      '.sg-foot{display:flex;align-items:center;gap:8px;margin-top:12px;flex-wrap:wrap}',
      '.sg-ok{font-size:12px;color:var(--dsw-alias-state-success-primary)}',
      '.sg-bad{font-size:12px;color:var(--dsw-alias-state-error-primary)}',
      '.sg-icon{display:grid;place-items:center;color:currentColor}',
    ].join('');

    /** Sidebar glyph: one step that stopped short of a tool call. */
    function StallGlyph(props) {
      // The sidebar wraps every panel glyph in its own <span>, so this returns
      // the <svg> directly: an extra wrapper becomes the flex baseline of the
      // row's glyph slot and lifts the mark above the label.
      const edge = typeof props.size === 'number' ? props.size : 18;
      return React.createElement(
        'svg',
        {
          viewBox: '0 0 20 20',
          width: edge,
          height: edge,
          fill: 'none',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block' },
        },
        React.createElement('path', { d: 'M3.5 5.5h5.5a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h3', stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round' }),
        React.createElement('path', { d: 'M3.5 14h4', stroke: 'currentColor', strokeOpacity: '0.5', strokeWidth: '1.6', strokeLinecap: 'round' }),
        React.createElement('circle', { cx: '11', cy: '5', r: '1.4', fill: 'currentColor' }),
        React.createElement('circle', { cx: '16', cy: '9.5', r: '1.4', fill: 'currentColor', fillOpacity: '0.55' }),
      );
    }

    function Row(props) {
      return React.createElement(
        'div',
        { className: 'sg-row' },
        React.createElement('div', { className: 'sg-label' }, props.label),
        React.createElement('div', { className: 'sg-control' }, props.children),
        props.hint ? React.createElement('div', { className: 'sg-hint' }, props.hint) : null,
      );
    }

    function Stat(props) {
      return React.createElement(
        'div',
        { className: 'sg-stat' },
        React.createElement('div', { className: 'sg-statValue' }, String(props.value == null ? 0 : props.value)),
        React.createElement('div', { className: 'sg-statLabel' }, props.label),
      );
    }

    function verdictOf(t, verdict) {
      if (verdict === 'continue') return { text: t('verdictContinue'), tone: 'sg-continue' };
      if (verdict === 'finished') return { text: t('verdictFinished'), tone: 'sg-finished' };
      if (verdict === 'error') return { text: t('verdictError'), tone: 'sg-error' };
      if (verdict === 'skipped') return { text: t('verdictSkipped'), tone: 'sg-skipped' };
      return { text: t('verdictUncertain'), tone: 'sg-uncertain' };
    }

    function clockTime(at) {
      if (typeof at !== 'number') return '';
      const date = new Date(at);
      if (Number.isNaN(date.getTime())) return '';
      const pad = (value) => String(value).padStart(2, '0');
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    /**
     * Pick the id of the Session the main column is showing.
     *
     * `useSessions` is a selector Hook — `useSessions(state => …)` — over a
     * `{ phase, byId }` snapshot. It MUST receive a selector every render:
     * calling it bare hands `undefined` to useSyncExternalStoreWithSelector,
     * which throws while rendering and retires this panel from its slot.
     * @param state - the sessions snapshot.
     * @returns the retained main-view session id, or undefined when none is open.
     */
    function selectActiveSessionId(state) {
      if (!state || typeof state !== 'object') return undefined;
      const byId = state.byId;
      if (!byId || typeof byId !== 'object') return undefined;
      for (const key of Object.keys(byId)) {
        const session = byId[key];
        if (!session || typeof session !== 'object') continue;
        const retained = session.retainedBy;
        if (!retained || typeof retained !== 'object') continue;
        if ((retained.mainView ?? 0) > 0) return typeof session.id === 'string' ? session.id : key;
      }
      return undefined;
    }

    /** Last-resort translator: returns the raw key so a missing seat never throws. */
    function fallbackT(key) {
      return String(key);
    }

    function StallGuardPage(props) {
      // The framework's `locale: NS` seat arrives as `props.t`; a composition
      // without it must degrade to raw keys, never throw during render — a
      // throwing slot entry fails the whole web boot.
      const t = typeof props.t === 'function' ? props.t : fallbackT;
      const useSessions = props.useSessions;
      const activeId = typeof useSessions === 'function' ? useSessions(selectActiveSessionId) : undefined;

      const [status, setStatus] = React.useState(null);
      const [routes, setRoutes] = React.useState([]);
      const [availableModels, setAvailableModels] = React.useState([]);
      const [modelsReady, setModelsReady] = React.useState(false);
      const [draft, setDraft] = React.useState(null);
      const [note, setNote] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const alive = React.useRef(true);
      // Unsaved edits must survive the 5s status poll; only an explicit reload
      // (or a successful save) is allowed to replace the draft.
      const dirty = React.useRef(false);

      React.useEffect(() => {
        alive.current = true;
        return () => {
          alive.current = false;
        };
      }, []);

      const load = React.useCallback((options) => {
        const resetDraft = options === true || (options !== null && typeof options === 'object' && options.resetDraft === true);
        return callHost(`status${activeId ? `?sessionId=${encodeURIComponent(activeId)}` : ''}`)
          .then((value) => {
            if (!alive.current) return;
            setStatus(value);
            if (resetDraft || !dirty.current) setDraft(value && value.config ? value.config : null);
          })
          .catch((error) => {
            if (alive.current) setNote({ kind: 'error', text: String((error && error.message) || error) });
          });
      }, [activeId]);

      React.useEffect(() => {
        callHost('routes')
          .then((value) => {
            if (!alive.current) return;
            setRoutes(value && Array.isArray(value.routes) ? value.routes : []);
            setAvailableModels(value && Array.isArray(value.models) ? value.models : []);
            setModelsReady(true);
          })
          .catch(() => {
            if (alive.current) {
              setRoutes([]);
              setAvailableModels([]);
              setModelsReady(true);
            }
          });
        load();
        const timer = setInterval(load, 5000);
        return () => clearInterval(timer);
      }, [load]);

      const patch = React.useCallback((next) => {
        dirty.current = true;
        setDraft((current) => Object.assign({}, current || {}, next));
      }, []);

      const save = () => {
        if (!draft) return;
        setBusy(true);
        setNote(null);
        callHost('saveConfig', {
            enabled: draft.enabled,
            mode: draft.mode,
            watchMode: draft.watchMode || 'exact',
            watchRoutes: Array.isArray(draft.watchRoutes) ? draft.watchRoutes : [],
            watchRegex: String(draft.watchRegex || ''),
            judge: draft.judge,
            autoRounds: Number(draft.autoRounds) || 0,
            minTurnSteps: Number(draft.minTurnSteps) || 1,
            allowPrematureStop: Boolean(draft.allowPrematureStop),
            confirmRewrite: Boolean(draft.confirmRewrite),
            resumeStyle: draft.resumeStyle === 'plain' ? 'plain' : 'guided',
            resumeText: String(draft.resumeText || ''),
          })
          .then((value) => {
            if (!alive.current) return;
            dirty.current = false;
            if (value && value.persisted === false) {
              setNote({ kind: 'error', text: `${t('saved')}（${value.message || t('saveFailed')}）` });
            } else {
              setNote({ kind: 'ok', text: t('saved') });
            }
            return load({ resetDraft: true });
          })
          .catch((error) => {
            if (alive.current) setNote({ kind: 'error', text: `${t('saveFailed')}: ${String((error && error.message) || error)}` });
          })
          .then(() => {
            if (alive.current) setBusy(false);
          });
      };

      const resume = (row) => {
        setBusy(true);
        callHost('resume', { sessionId: row.sessionId, rewrite: false })
          .then(() => load())
          .catch((error) => {
            if (alive.current) setNote({ kind: 'error', text: String((error && error.message) || error) });
          })
          .then(() => {
            if (alive.current) setBusy(false);
          });
      };

      const judge = (draft && draft.judge) || { provider: '', model: '' };
      const judgeValue = judge.provider ? `${judge.provider}/${judge.model}` : '';
      const options = routes
        .map((route) => ({ value: `${route.provider}/${route.model}`, label: route.label || `${route.provider}/${route.model}` }))
        .filter((option) => option.value !== judgeValue);
      if (judgeValue) options.unshift({ value: judgeValue, label: judgeValue });

      const watchMode = (draft && draft.watchMode) || 'exact';
      const watchRoutes = draft && Array.isArray(draft.watchRoutes) ? draft.watchRoutes : [];
      const watchRegex = draft && typeof draft.watchRegex === 'string' ? draft.watchRegex : '';
      const allModelOptions = availableModels.map((model) => ({
        value: `${model.provider}/${model.model}`,
        label: model.label || `${model.provider}/${model.model}`,
      }));
      const modelLabel = (value) => {
        const found = allModelOptions.find((option) => option.value === value);
        return found ? found.label : value;
      };
      const exactOptions = allModelOptions.filter((option) => !watchRoutes.includes(option.value));
      let regexMatches = [];
      let regexError = '';
      if (watchMode === 'regex' && watchRegex.trim() !== '') {
        try {
          const expression = new RegExp(watchRegex, 'i');
          regexMatches = allModelOptions.filter((option) => expression.test(option.value));
        } catch (error) {
          regexError = String((error && error.message) || error);
        }
      }
      const counts = (status && status.counts) || { checked: 0, continued: 0, suggest: 0, finished: 0, errors: 0 };
      const rows = (status && status.rows) || [];

      return React.createElement(
        'div',
        { className: 'sg-root' },
        React.createElement(
          'div',
          { className: 'sg-head' },
          React.createElement('span', { style: { color: 'var(--dsw-alias-label-secondary)', marginTop: 4 } }, React.createElement(StallGlyph, { size: 22 })),
          React.createElement(
            'div',
            { className: 'sg-headText' },
            React.createElement('h1', { className: 'sg-title' }, t('title')),
            React.createElement('p', { className: 'sg-sub' }, t('subtitle')),
          ),
        ),
        React.createElement(
          'div',
          { className: 'sg-section' },
          React.createElement('h2', { className: 'sg-sectionTitle' }, t('stats')),
          React.createElement(
            'div',
            { className: 'sg-stats' },
            React.createElement(Stat, { value: counts.checked, label: t('statChecked') }),
            React.createElement(Stat, { value: counts.continued, label: t('statContinued') }),
            React.createElement(Stat, { value: counts.suggest, label: t('statSuggest') }),
            React.createElement(Stat, { value: counts.finished, label: t('statFinished') }),
            React.createElement(Stat, { value: counts.errors, label: t('statErrors') }),
          ),
        ),
        React.createElement(
          'div',
          { className: 'sg-section' },
          React.createElement('h2', { className: 'sg-sectionTitle' }, t('settings')),
          React.createElement(
            Row,
            { label: t('enabled'), hint: t('enabledHint') },
            React.createElement(
              'label',
              { className: 'sg-switch' },
              React.createElement('input', {
                type: 'checkbox',
                checked: Boolean(draft && draft.enabled),
                onChange: (event) => patch({ enabled: event.target.checked }),
              }),
              React.createElement('span', null, draft && draft.enabled ? t('on') : t('off')),
            ),
          ),
          React.createElement(
            Row,
            { label: t('watchMode'), hint: t('watchModeHint') },
            React.createElement(
              'select',
              {
                className: 'sg-select',
                value: watchMode,
                onChange: (event) => patch({ watchMode: event.target.value }),
              },
              React.createElement('option', { value: 'exact' }, t('watchModeExact')),
              React.createElement('option', { value: 'regex' }, t('watchModeRegex')),
            ),
          ),
          watchMode === 'exact'
            ? React.createElement(
                Row,
                { label: t('watchExact'), hint: t('watchExactHint') },
                React.createElement(
                  'select',
                  {
                    className: 'sg-select',
                    value: '',
                    onChange: (event) => {
                      const value = event.target.value;
                      if (!value) return;
                      patch({ watchRoutes: [...watchRoutes, value] });
                    },
                  },
                  exactOptions.length === 0 && !modelsReady
                    ? React.createElement('option', { value: '' }, t('loading'))
                    : exactOptions.length === 0 && availableModels.length === 0
                      ? React.createElement('option', { value: '' }, t('watchNoModels'))
                      : React.createElement('option', { value: '' }, t('watchExactPlaceholder')),
                  exactOptions.map((option) => React.createElement('option', { key: option.value, value: option.value }, option.label)),
                ),
                watchRoutes.length === 0
                  ? React.createElement('div', { className: 'sg-hint' }, t('watchExactEmpty'))
                  : React.createElement(
                      'div',
                      { className: 'sg-chips' },
                      watchRoutes.map((value) =>
                        React.createElement(
                          'span',
                          { className: 'sg-chip', key: value },
                          modelLabel(value),
                          React.createElement(
                            'button',
                            {
                              type: 'button',
                              className: 'sg-chipRemove',
                              'aria-label': `${t('remove')} ${modelLabel(value)}`,
                              onClick: () => patch({ watchRoutes: watchRoutes.filter((item) => item !== value) }),
                            },
                            '×',
                          ),
                        ),
                      ),
                    ),
              )
            : null,
          watchMode === 'regex'
            ? React.createElement(
                Row,
                { label: t('watchRegex'), hint: t('watchRegexHint') },
                React.createElement('input', {
                  className: 'sg-input sg-wide',
                  type: 'text',
                  value: watchRegex,
                  placeholder: t('watchRegexPlaceholder'),
                  onChange: (event) => patch({ watchRegex: event.target.value }),
                }),
                regexError
                  ? React.createElement('div', { className: 'sg-hint sg-regexBad' }, `${t('watchRegexInvalid')}${regexError}`)
                  : watchRegex.trim() === ''
                    ? React.createElement('div', { className: 'sg-hint' }, t('watchRegexEmpty'))
                    : React.createElement(
                        React.Fragment,
                        null,
                        React.createElement(
                          'div',
                          { className: 'sg-hint' },
                          regexMatches.length === 0 ? t('watchNoMatches') : t('watchMatches').replace('{n}', String(regexMatches.length)),
                        ),
                        React.createElement(
                          'div',
                          { className: 'sg-matchList' },
                          regexMatches.map((option) => React.createElement('div', { className: 'sg-matchItem', key: option.value }, option.label)),
                        ),
                      ),
              )
            : null,
          React.createElement(
            Row,
            { label: t('mode'), hint: t('modeHint') },
            React.createElement(
              'select',
              {
                className: 'sg-select',
                value: (draft && draft.mode) || 'suggest',
                onChange: (event) => patch({ mode: event.target.value }),
              },
              React.createElement('option', { value: 'suggest' }, t('modeSuggest')),
              React.createElement('option', { value: 'auto-continue' }, t('modeAutoContinue')),
            ),
          ),
          React.createElement(
            Row,
            { label: t('judgeModel'), hint: t('judgeModelHint') },
            React.createElement(
              'select',
              {
                className: 'sg-select',
                value: judgeValue,
                onChange: (event) => {
                  const value = event.target.value;
                  const cut = value.indexOf('/');
                  patch({ judge: { provider: value.slice(0, cut), model: value.slice(cut + 1) } });
                },
              },
              options.length === 0 ? React.createElement('option', { value: '' }, t('loading')) : null,
              options.map((option) => React.createElement('option', { key: option.value, value: option.value }, option.label)),
            ),
          ),
          React.createElement(
            Row,
            { label: t('autoRounds'), hint: t('autoRoundsHint') },
            React.createElement('input', {
              className: 'sg-input sg-num',
              type: 'number',
              min: 0,
              value: String(draft && draft.autoRounds != null ? draft.autoRounds : 0),
              onChange: (event) => patch({ autoRounds: Number(event.target.value) }),
            }),
            React.createElement('span', { className: 'sg-label', style: { flex: '0 0 auto' } }, t('minTurnSteps')),
            React.createElement('input', {
              className: 'sg-input sg-num',
              type: 'number',
              min: 1,
              value: String(draft && draft.minTurnSteps != null ? draft.minTurnSteps : 1),
              onChange: (event) => patch({ minTurnSteps: Number(event.target.value) }),
            }),
          ),
          React.createElement(
            Row,
            { label: t('allowPrematureStop'), hint: t('allowPrematureStopHint') },
            React.createElement(
              'label',
              { className: 'sg-switch' },
              React.createElement('input', {
                type: 'checkbox',
                checked: Boolean(draft && draft.allowPrematureStop),
                onChange: (event) => patch({ allowPrematureStop: event.target.checked }),
              }),
              React.createElement('span', null, t('allowPrematureStop')),
            ),
          ),
          React.createElement(
            Row,
            { label: t('resumeStyle'), hint: t('resumeStyleHint') },
            React.createElement(
              'select',
              {
                className: 'sg-select',
                value: draft && draft.resumeStyle === 'plain' ? 'plain' : 'guided',
                onChange: (event) => patch({ resumeStyle: event.target.value }),
              },
              React.createElement('option', { value: 'plain' }, t('resumeStylePlain')),
              React.createElement('option', { value: 'guided' }, t('resumeStyleGuided')),
            ),
          ),
          React.createElement(
            Row,
            { label: t('resumeText'), hint: t('resumeTextHint') },
            React.createElement('textarea', {
              className: 'sg-textarea',
              rows: 3,
              spellCheck: false,
              placeholder: (draft && draft.resumeStyle === 'plain' ? t('resumePlaceholderPlain') : t('resumePlaceholderGuided')),
              value: String((draft && draft.resumeText) || ''),
              onChange: (event) => patch({ resumeText: event.target.value }),
            }),
          ),
          React.createElement(
            Row,
            { label: t('confirmRewrite'), hint: t('confirmRewriteHint') },
            React.createElement(
              'label',
              { className: 'sg-switch' },
              React.createElement('input', {
                type: 'checkbox',
                checked: Boolean(draft && draft.confirmRewrite),
                onChange: (event) => patch({ confirmRewrite: event.target.checked }),
              }),
              React.createElement('span', null, t('confirmRewrite')),
            ),
          ),
          React.createElement(
            'div',
            { className: 'sg-foot' },
            React.createElement('button', { className: 'sg-btn sg-primary', type: 'button', disabled: busy || !draft, onClick: save }, t('save')),
            React.createElement('button', { className: 'sg-btn', type: 'button', disabled: busy, onClick: () => load({ resetDraft: true }) }, t('refresh')),
            note ? React.createElement('span', { className: note.kind === 'ok' ? 'sg-ok' : 'sg-bad' }, note.text) : null,
          ),
        ),
        React.createElement(
          'div',
          { className: 'sg-section' },
          React.createElement('h2', { className: 'sg-sectionTitle' }, t('events')),
          rows.length === 0
            ? React.createElement('p', { className: 'sg-empty' }, activeId ? t('empty') : t('noSession'))
            : React.createElement(
                'div',
                { className: 'sg-scroll' },
                React.createElement(
                  'table',
                  { className: 'sg-table' },
                  React.createElement(
                    'thead',
                    null,
                    React.createElement(
                      'tr',
                      null,
                      React.createElement('th', null, t('colTurn')),
                      React.createElement('th', null, t('colVerdict')),
                      React.createElement('th', null, t('colReason')),
                      React.createElement('th', null, t('colAction')),
                    ),
                  ),
                  React.createElement(
                    'tbody',
                    null,
                    rows.map((row) => {
                      const verdict = verdictOf(t, row.verdict);
                      return React.createElement(
                        'tr',
                        { key: `${row.sessionId}#${row.at}` },
                        React.createElement(
                          'td',
                          null,
                          React.createElement('div', null, `#${row.turn}`),
                          React.createElement('div', { className: 'sg-dim' }, clockTime(row.at)),
                        ),
                        React.createElement('td', null, React.createElement('span', { className: `sg-badge ${verdict.tone}` }, verdict.text)),
                        React.createElement(
                          'td',
                          null,
                          React.createElement('div', { className: 'sg-dim' }, row.reason || ''),
                          React.createElement('div', { className: 'sg-excerpt' }, String(row.excerpt || '').slice(-150)),
                        ),
                        React.createElement(
                          'td',
                          null,
                          row.verdict === 'continue'
                            ? React.createElement(
                                'button',
                                {
                                  className: 'sg-btn',
                                  type: 'button',
                                  disabled: busy || !activeId || row.sessionId !== activeId,
                                  title: t('actionContinueHint'),
                                  onClick: () => resume(row),
                                },
                                t('actionContinue'),
                              )
                            : null,
                        ),
                      );
                    }),
                  ),
                ),
              ),
        ),
      );
    }

    /**
     * Insert this plugin's stylesheet once, under its own owner tag.
     *
     * A published `dsh.bundle` client half receives only `require` in its
     * factory — the `styles` closure symbol belongs to sandboxed dynamic
     * packages and does not exist here. Tagging the element with
     * `data-plugin` keeps the host's HMR bookkeeping able to attribute and
     * remove it.
     * @param css - stylesheet text.
     * @returns a disposer that removes the element this call inserted.
     */
    function injectStyles(css) {
      if (typeof document === 'undefined') return () => {};
      const tagId = '@local/dsh-stall-guard/client';
      const selector = `style[data-plugin-css="${tagId}"]`;
      if (document.querySelector(selector) !== null) return () => {};
      const tag = document.createElement('style');
      tag.dataset.plugin = '@local/dsh-stall-guard';
      tag.dataset.pluginCss = tagId;
      tag.textContent = css;
      document.head.appendChild(tag);
      return () => {
        tag.remove();
      };
    }

    return {
      name: 'stall-guard-ui',
      inject: ['slots', 'locale', 'sessions'],
      apply(ctx) {
        // `ctx.locale` has no `t`: it exposes `bind(ns)`, which returns the
        // translator. Bind once here — the sidebar calls a label thunk on every
        // slot and locale change, so a throwing label takes the sidebar down.
        const t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, DICTS), 'stall-guard: dictionaries');
        ctx.effect(() => injectStyles(CSS), 'stall-guard: styles');
        ctx.effect(
          () =>
            ctx.slots.inject('sidebar.panellist', () =>
              ctx.slots.register(
                {
                  name: 'sidebar.panellist',
                  id: PANEL_ID,
                  order: 40,
                  label: () => t('panel'),
                },
                StallGlyph,
              ),
            ),
          'stall-guard: sidebar entry',
        );
        ctx.effect(
          () =>
            ctx.slots.inject('main', () =>
              ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, StallGuardPage),
            ),
          'stall-guard: panel page',
        );
      },
    };
  },
});
