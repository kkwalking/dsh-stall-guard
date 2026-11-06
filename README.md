# dsh-stall-guard

DeepSeek Harness 的「断流守卫」插件：监测指定模型的轮次收尾，发现「文本说完了、但没有工具调用却结束了」的截断时，用另一个模型复查，并提示或自动续跑。

## 安装

插件是一个本地 DSH profile 插件。把插件目录链接到目标 profile 的依赖：

```json
{
  "dependencies": {
    "@local/dsh-stall-guard": "link:/path/to/dsh-stall-guard"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@local/dsh-stall-guard"
      ]
    }
  }
}
```

然后在该 profile 目录执行依赖安装：

```bash
dsh plugin --profile <profile-name> install
```

最后完全重启 DeepSeek Harness。插件客户端 bundle 在 Web boot 阶段加载，修改 `client.js` 后仅刷新页面不保证生效。

## 功能

- 监测配置中指定的模型，在每个轮次收尾时检查是否被截断。
- 用独立的判定模型做三态判断：`continue`（被截断）/ `finished`（正常结束）/ `uncertain`（不确定）。
- `suggest` 模式只记录并在面板展示；`auto-continue` 模式在判定为截断且本轮续跑次数未用完时自动发送一条续跑消息。
- 支持「纯继续」和「带引导语」两种续跑文案，可自定义文案。
- 配置页提供当前模型列表下拉选择、正则匹配和实时匹配结果。
- 单步收尾也会复查：流式输出最常死在第一步，不会被 `minTurnSteps` 过滤。

## 面板

启动 DSH 后，侧边栏会出现「断流守卫」入口。面板包含：

- **统计**：已复查、自动续跑、待你继续、正常结束、判定失败。
- **监测设置**：开关、监测模型、判定模型、自动续跑上限、最少步数、续跑文案等。
- **最近判定**：每轮的判定、依据、收尾摘录和手动「继续」按钮。

### 监测模型

`监测模型` 支持两种模式：

| 模式 | 配置字段 | 说明 |
|---|---|---|
| 精确选择 | `watchMode: exact` + `watchRoutes` | 从当前模型目录多选，值为 `provider/model` |
| 正则匹配 | `watchMode: regex` + `watchRegex` | 对 `provider/model` 做不区分大小写的正则匹配 |

精确选择示例：

```json
{
  "watchMode": "exact",
  "watchRoutes": [
    "magpie-responses/deepseek-v4.1-flash-1017"
  ]
}
```

正则匹配示例：

```json
{
  "watchMode": "regex",
  "watchRegex": "^magpie-responses/.*"
}
```

精确选择为空，或正则没有匹配到任何模型时，插件不会监测任何路由。

## 配置字段

`cordis.patch.yml` 的 `stall-guard` 行支持以下配置：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `enabled` | `true` | 是否启用监测 |
| `watchMode` | `exact` | `exact` / `regex` |
| `watchRoutes` | `[]` | 精确监测的 `provider/model` 列表 |
| `watchRegex` | `""` | 监测模型正则（匹配 `provider/model`） |
| `judge.provider` | `magpie` | 判定模型 provider |
| `judge.model` | `workbuddy/deepseek-v4.1-flash` | 判定模型 id |
| `judge.reasoningEffort` | `low` | 判定模型推理强度 |
| `mode` | `suggest` | `suggest` 或 `auto-continue` |
| `autoRounds` | `2` | 同一轮最多自动续跑次数 |
| `minTurnSteps` | `1` | 多步轮次的最小步数；单步收尾始终复查 |
| `maxHistoryMessages` | `12` | 提供给判定模型的近期消息上限 |
| `allowPrematureStop` | `false` | 开启后尊重判定为未完成的收尾，只记录不续跑 |
| `confirmRewrite` | `false` | 续跑时追加「不要复述计划，直接动手」 |
| `resumeStyle` | `guided` | `plain` 或 `guided` |
| `resumeText` | `""` | 自定义续跑文案；为空时使用档位默认值 |
| `judgeTimeoutMs` | `60000` | 判定调用超时 |

判定模型不能是当前监测范围命中的模型；否则保存会被拒绝。

## 版本

当前版本：`0.1.0`
