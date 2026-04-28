# quote-ai-usage

把"今日"个人 **Claude Code** 与 **Codex CLI** 的 token 用量聚合成 296×152
PNG，通过 [Dot 开放 API](https://dot.mindreset.tech) 推送到 quote/0 设备。
数据全部来自本地 `~/.claude` 和 `~/.codex` 的 JSONL，无需任何 LLM 平台
API Key、不模拟登录、不读浏览器 cookie。

## 它解决的问题

- 不打开 Anthropic / OpenAI 网页就能在桌面物件上看到当天烧了多少 USD / token
- 跟 Claude Code 集成成插件，每次回答完自动刷新设备
- 不破坏隐私：jsonl 内容只在内存里加和，上设备的只有数字

## 快速开始

```bash
npm install
cp .env.example .env                     # 填 DOT_API_KEY / DOT_DEVICE_ID
# 把字体放到 assets/fonts/Regular.ttf 与 Bold.ttf（参考 assets/fonts/README.md）

npm run preview                          # 渲染 demo → preview.png（不推送）
npm run push                             # 渲染今日真实数据 → 真推送
npm run watch                            # 守护模式，默认每 30 分钟一次

npm link && quote-ai help                # 把 quote-ai 暴露到全局 PATH
```

## 命令

| 命令 | 说明 |
|------|------|
| `quote-ai push` | 一次性：聚合今日数据 + 渲染 + 推送 |
| `quote-ai push --dry-run` | 仅渲染，不推送（配 `DEBUG_PNG=preview.png`）|
| `quote-ai watch [--interval=30m]` | 进程内定时器，每 N 分钟一次 |
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
  render.node.ts      Node 字体 / wasm 加载
  dot-client.ts       Dot API 客户端
  config.ts           env → AppConfig
  push.ts             collect → render → push 一条龙
  cli.ts              push / watch / help 入口
  index.ts            库式 re-exports
bin/quote-ai.mjs      npm bin 包装（用 tsx 跑 ts）
plugin/claude-code/   Claude Code 插件（hook + slash command）
assets/fonts/         Regular.ttf / Bold.ttf（gitignored）
docs/                 完整设计文档
```

## License

见 [`LICENSE`](./LICENSE)。
