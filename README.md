# quote-ai-usage

把"今日"个人 **Claude Code** 与 **Codex CLI** 的 token 用量聚合成 296×152
PNG，通过 [Dot 开放 API](https://dot.mindreset.tech) 推送到 quote/0 设备。
数据全部来自本地 `~/.claude` 和 `~/.codex` 的 JSONL，无需任何 LLM 平台
API Key、不模拟登录、不读浏览器 cookie。

## 它解决的问题

- 不打开 Anthropic / OpenAI 网页就能在桌面物件上看到当天烧了多少 USD / token
- 跟 Claude Code 集成成插件，每次回答完自动刷新设备
- 不破坏隐私：jsonl 内容只在内存里加和，上设备的只有数字

## 技术栈

- 运行时：[**Bun**](https://bun.com) 1.1+（直接执行 TypeScript，无需构建）
- 渲染：`satori` + `@resvg/resvg-wasm`
- 集成：Claude Code Plugin（Stop hook + slash command）

## 快速开始

```bash
bun install
bun link                                 # 把 quote-ai 暴露到全局 PATH
# 把字体放到 assets/fonts/Regular.ttf 与 Bold.ttf（参考 assets/fonts/README.md）

quote-ai config                          # 交互式录入 API Key / 设备 ID
quote-ai preview                         # 仅渲染验证（不需要凭证）
quote-ai push                            # 真推送
quote-ai watch                           # 守护模式，默认每 30 分钟一次
```

凭证存到 `~/.config/quote-ai-usage/config.json`（POSIX 权限 0600，Windows 落在
`%APPDATA%\quote-ai-usage\config.json`）。如果第一次跑 `push` / `watch` 时
还没配置，会在 TTY 中自动进入交互向导；非 TTY（如 plugin hook）则报错指引。

环境变量 `DOT_API_KEY` / `DOT_DEVICE_ID` / `DOT_API_BASE_URL` 仍可使用，
**优先级高于** 配置文件，方便临时覆盖或 CI 场景。

## 命令

| 命令 | 说明 |
|------|------|
| `quote-ai config [--show] [--reset]` | 交互配置 / 显示当前 / 删除配置文件 |
| `quote-ai preview [out.png] [--open]` | 仅渲染，不推送；不需要凭证 |
| `quote-ai push [--skip-if-cooling]` | 一次性：聚合 + 渲染 + 推送（含 throttle）|
| `quote-ai watch [--interval=30m]` | 进程内定时器 |
| `quote-ai help` | 用法说明 |

## 与 Claude Code 集成（推荐）

仓库自带 `plugin/claude-code/` —— 启用后每次 Claude 完成回答会自动推一次。

```bash
ln -s "$(pwd)/plugin/claude-code" ~/.claude/plugins/quote-ai-usage
# Windows 见 docs/plugin-install.md
```

详见 [`docs/plugin-install.md`](./docs/plugin-install.md)。

## 数据源（全部本地）

| 来源 | 路径 | 维度 |
|------|------|------|
| Claude Code | `~/.claude/projects/<slug>/<id>.jsonl` | input/output/cache token + 估算 USD |
| Codex CLI | `~/.codex/sessions/<UTC date>/rollout-…jsonl` | total token + 5h / 周配额% |

Codex Plus 套餐按 5h / 周窗口配额计费，**不按 token 计费**，所以卡片上不
给 Codex 算 USD。详见 [`docs/local-providers.md`](./docs/local-providers.md)。

## 打包（可选）

```bash
bun run build              # → dist/cli.js（minified bundle，bun 运行时）
bun run build:bin          # → dist/quote-ai{.exe}（standalone 可执行文件，无需装 bun）
```

平时直接 `bun run`/`bun link` 即可，build 主要用于在没装 bun 的机器上分发。

## 文档

- [`docs/overview.md`](./docs/overview.md) — 目标与进度
- [`docs/architecture.md`](./docs/architecture.md) — 数据流与文件分工
- [`docs/local-providers.md`](./docs/local-providers.md) — JSONL 字段、定价、隐私
- [`docs/rendering.md`](./docs/rendering.md) — 渲染选型与模板
- [`docs/dot-api.md`](./docs/dot-api.md) — Dot 开放 API 摘要
- [`docs/local-development.md`](./docs/local-development.md) — 安装、命令、定时
- [`docs/plugin-install.md`](./docs/plugin-install.md) — Claude Code 插件
- [`docs/roadmap.md`](./docs/roadmap.md) — 后续路线图

## 目录结构

```
src/
  collectors/
    types.ts          统一 metric 类型
    util.ts           tz-aware 日期工具
    pricing.ts        模型 → 单价
    claude.ts         扫 ~/.claude/projects/**.jsonl
    codex.ts          扫 ~/.codex/sessions/**.jsonl
  aggregate.ts        DailyUsage → UsageData
  render.ts           satori + resvg 渲染核心
  render.node.ts      Bun/Node 端字体 + wasm 加载
  dot-client.ts       Dot API 客户端
  config.ts           env → AppConfig
  push.ts             collect → render → push 一条龙
  cli.ts              push / watch / preview / help 入口（bun shebang）
  index.ts            库式 re-exports
plugin/claude-code/   Claude Code 插件（hook + slash command）
assets/fonts/         Regular.ttf / Bold.ttf（gitignored）
docs/                 完整设计文档
dist/                 bun build 输出（gitignored）
```

## License

见 [`LICENSE`](./LICENSE)。
