# CLAUDE.md

后续 Claude Code 在此仓库工作前请先看这页。完整设计文档在
[`docs/`](./docs/README.md)，本文只列改代码前必须知道的硬约束。

## 项目一句话

把"今日"个人 Claude Code 与 Codex CLI 的 token 用量从本地 JSONL 聚合，
渲染成 296×152 PNG 推到 quote/0 设备。**纯本地运行**，不再支持
Cloudflare Workers。

## 数据源是只读 JSONL，不调任何 LLM 平台 API

- `~/.claude/projects/<slug>/<sessionId>.jsonl`：解析 `message.usage` +
  `message.model`，按 `pricing.ts` 估算 USD
- `~/.codex/sessions/<UTC YYYY/MM/DD>/rollout-…jsonl`：解析
  `event_msg.payload.token_count` 的 `last_token_usage`（增量累加，不要
  累加 `total_token_usage`）和最新一条 `rate_limits` 作为套餐快照
- **绝对不要**新增模拟登录 / 抓网页 / 读浏览器 cookie / 调 Anthropic
  / OpenAI 任何 admin API

## 时区一律走字符串比较

所有"今日"判定都通过 `collectors/util.ts` 的 `dateInTz(ms, tz)` 把时间戳
转 `YYYY-MM-DD` 再字符串相等。**不要**自己用 epoch 算 0:00 边界（DST 与
非整点 tz 会出 bug）。`tz` 默认 `Asia/Shanghai`，由 `USAGE_TIMEZONE` 覆盖。

## Codex Plus 不算 USD

Plus 用户按 5h / 周配额计费，token 不映射到钱。`aggregate.ts` 只展示
Codex 的 token 总数与 `primary.usedPercent`，**不要**给 Codex 加 USD 估算。

## 模板 / 渲染约束（satori）

- 容器节点必须显式 `display: 'flex'`，否则 yoga 不生效
- 不支持 grid / float / 复杂 CSS / variable font
- 颜色用纯黑白：屏幕 dither 后灰度信息丢失
- 字体只接受静态 TTF，命名固定为 `assets/fonts/Regular.ttf` / `Bold.ttf`
- 改尺寸要同步改 `render.ts` 的 `CARD_WIDTH/HEIGHT` 与 Dot API 推送参数

## CLI 与入口

- `bin/quote-ai.mjs` 是 npm bin 入口（spawn tsx 跑 src/cli.ts）。
  npm link 之后 `quote-ai` 在全局 PATH
- `src/cli.ts` 命令：`push` / `watch` / `help`
- `src/push.ts` 的 `collectAndPush(opts)` 是程序化入口，被 cli、index re-export
- 失败信息一律打 stderr 并返回非 0；不要 swallow 错误（plugin hook 会忽略
  非 0 退出）

## Plugin

- `plugin/claude-code/` 是 Claude Code 插件
- `hooks/hooks.json` 配 `Stop` 触发 `quote-ai push`，30s timeout
- `commands/push-usage.md` 是手动 slash command
- 插件假定 `quote-ai` 已经 `npm link`；不要在 plugin 里 hard-code 仓库路径

## Dot API 调用约定

- 客户端封装在 `src/dot-client.ts`。`apiKey` 不带 `dot_app_` 前缀，
  `DotClient` 内部拼
- 错误统一抛 `DotApiError`（携 status / code / body）
- 限流 10 req/s；plugin Stop hook 触发频繁但每次推送间隔自然 > 1s，目前
  不需要限流；如果加 debounce 就加在 cli 层

## 不要做的事

- 不要恢复 Cloudflare Workers 路径，`worker.ts` / `wrangler.toml` 已删除
- 不要把 LLM 平台 API Key（Anthropic / OpenAI）引入仓库（不需要）
- 不要给 Codex token 算 USD
- 不要在 satori 树里用非 flex 布局或 variable font
- 不要把字体或 jsonl 样本 commit 进仓库
- 不要绕过 `DotClient` 直接 `fetch` Dot API（会丢错误处理）
- 不要在收集器里读 `total_token_usage` 累加（会重复计数）

## 待办（详见 docs/roadmap.md）

1. 增量游标（offset 缓存）
2. push 防抖
3. 多模板 / 多窗口（taskKey）
4. 失败重试 + 上报
