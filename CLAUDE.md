# CLAUDE.md

后续 Claude Code 在此仓库工作前请先看这页。完整设计文档在
[`docs/`](./docs/README.md)，本文只列改代码前必须知道的硬约束。

## 项目一句话

把"今日"个人 Claude Code 与 Codex CLI 的 token 用量从本地 JSONL 聚合，
渲染成 296×152 PNG 推到 quote/0 设备。**纯本地运行**，不再支持
Cloudflare Workers。

## 工具链是 bun，不是 npm

- 运行时与包管理器都是 `bun`（>=1.1）
- 直接 `bun src/cli.ts` 跑 TypeScript，没有 tsx / ts-node，也没有 dist
- 命令对应：`npm install` → `bun install`；`npm run X` → `bun run X` 或
  `bun X`；`npm link` → `bun link`；`npm uninstall` → `bun remove`
- typecheck 走 `bun run typecheck`（内部 `bunx tsc --noEmit`）
- 类型 = `@types/bun`（**不要**加 `@types/node`，会与 bun-types 冲突）
- bin 直接指向 `./src/cli.ts`，shebang `#!/usr/bin/env bun`；不要再写
  Node wrapper

## 数据源

- `~/.claude/projects/<slug>/<sessionId>.jsonl`：解析 `message.usage` +
  `message.model`，按 `pricing.ts` 估算 USD
- `~/.codex/sessions/<UTC YYYY/MM/DD>/rollout-…jsonl`：解析
  `event_msg.payload.token_count` 的 `last_token_usage`（增量累加，不要
  累加 `total_token_usage`）和最新一条 `rate_limits` 作为套餐快照
- `~/.claude/.credentials.json` + `GET https://api.anthropic.com/api/oauth/usage`
  （header `anthropic-beta: oauth-2025-04-20`）：读取 Claude Pro/Max 五小时配额
  利用率（`five_hour.utilization` + `five_hour.resets_at`）。此调用是**唯一**被
  允许的 Anthropic 平台 API 调用；token 来自本地凭证文件，无需用户另行配置。
  失败时静默返回 null，不影响其他展示，回退到 USD 用量显示。
- **绝对不要**新增模拟登录 / 抓网页 / 读浏览器 cookie / 调 Anthropic completions
  / admin / billing / OpenAI 任何 API（OAuth usage 端点除外）

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

## 配置读取

- `src/config.ts` 的 `resolveAppConfig(env)` 是**异步**的，先读环境变量，
  再回退到 `~/.config/quote-ai-usage/config.json`（Windows 在 `%APPDATA%\…`）。
  缺则抛 `ConfigMissingError`
- 配置文件读写在 `src/user-config.ts`，CLI 通过 `quote-ai config` 子命令
  录入；写入会做 `chmod 0600`（POSIX），Windows 上 chmod 调用静默失败
- 优先级：env > 配置文件。CI / 临时覆盖只设环境变量即可
- 首启策略：`push` / `watch` 启动时缺配置 → TTY 自动进入向导；非 TTY（plugin
  hook 等）报错退出，**不**阻塞调用方
- 隐藏输入实现在 `src/prompt.ts`，使用 raw-mode + 字符级 echo `*`，不依赖
  外部库；非 TTY 时 fallback 到普通 readline
- 不要把任何 secret commit 进仓库；配置文件本身在用户 HOME 目录而非项目内
- `CLAUDE_CREDENTIALS_PATH`：覆盖 OAuth 凭证文件路径，默认
  `~/.claude/.credentials.json`

## CLI 入口

- `src/cli.ts` 命令：`config` / `push` / `watch` / `preview` / `help`
- `bun link` 后 `quote-ai` 在全局 PATH，shebang 自动找 `bun`
- `src/push.ts` 的 `collectAndPush(opts)` 是程序化入口，被 cli、index re-export
- 失败信息一律打 stderr 并返回非 0；不要 swallow 错误（plugin hook 会忽略
  非 0 退出）

## Plugin

- `plugin/claude-code/` 是 Claude Code 插件
- `hooks/hooks.json` 配 `Stop` 触发 `quote-ai push`，30s timeout
- `commands/push-usage.md` 是手动 slash command
- 插件假定 `quote-ai` 已经 `bun link`；不要在 plugin 里 hard-code 仓库路径

## 打包

- `bun run build` → `dist/cli.js`（minified，bun runtime 跑）
- `bun run build:bin` → `dist/quote-ai{.exe}`（`bun build --compile` 产生
  的 standalone 可执行，包含运行时）
- 日常开发不需要 build；build 是为了在没装 bun 的机器上分发

## Dot API 调用约定

- 客户端封装在 `src/dot-client.ts`。`apiKey` 不带 `dot_app_` 前缀，
  `DotClient` 内部拼
- 错误统一抛 `DotApiError`（携 status / code / body）
- Dot 自身限流 10 req/s。我们另外用 `src/debounce.ts` 做跨进程 throttle：
  默认 `USAGE_COOLDOWN=60s` 内每个 cooldown 周期至多一次推送
- 两种模式：`quote-ai push`（wait，会 sleep 到可推）；
  `quote-ai push --skip-if-cooling`（plugin Stop hook 用，cooldown 内直接
  退出不阻塞）

## 不要做的事

- 不要恢复 Cloudflare Workers 路径，`worker.ts` / `wrangler.toml` 已删除
- 不要回退到 npm / tsx 工具链
- 不要把 LLM 平台 API Key（Anthropic / OpenAI）引入仓库（不需要）
- 不要给 Codex token 算 USD
- 不要在 satori 树里用非 flex 布局或 variable font
- 不要把字体或 jsonl 样本 commit 进仓库
- 不要绕过 `DotClient` 直接 `fetch` Dot API（会丢错误处理）
- 不要在收集器里读 `total_token_usage` 累加（会重复计数）
- 不要在 OAuth usage 端点之外再调任何 Anthropic API（completions、admin、billing 等）

## 待办（详见 docs/roadmap.md）

1. 增量游标（offset 缓存）
2. 多模板 / 多窗口（taskKey）
3. 失败重试 + 上报
