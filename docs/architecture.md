# 架构

## 数据流

```
~/.claude/projects/**.jsonl ──┐
                              ├──> collectors/{claude,codex}.ts
~/.codex/sessions/**.jsonl  ──┘            │
                                           ▼
                                 collectors/types.DailyUsage
                                           │
                                           ▼
                                  aggregate.buildUsageData()
                                           │
                                           ▼
                                    render.UsageData
                                           │
                          satori → SVG → resvg-wasm → PNG
                                           │
                                           ▼
                                  dot-client.pushImage()
                                           │
                                           ▼
                                  https://dot.mindreset.tech
```

## 文件分工

| 路径 | 角色 |
|------|------|
| `src/collectors/types.ts` | DailyUsage / ClaudeMetric / CodexMetric 类型 |
| `src/collectors/util.ts` | tz-aware 日期工具（dateInTz、utcPathParts）|
| `src/collectors/pricing.ts` | 模型 → 单价表 + estimateUsd |
| `src/collectors/claude.ts` | 扫 `~/.claude/projects/**/*.jsonl` |
| `src/collectors/codex.ts` | 扫 `~/.codex/sessions/<UTC>/*.jsonl` |
| `src/aggregate.ts` | DailyUsage → UsageData（卡片字段）|
| `src/render.ts` | satori + resvg 平台无关渲染核心 |
| `src/render.node.ts` | Node 端字体与 wasm 加载 |
| `src/dot-client.ts` | Dot 图像 API 客户端 |
| `src/config.ts` | env → AppConfig + resolveTimezone |
| `src/push.ts` | collectAndPush：collect → render → push 一条龙 |
| `src/cli.ts` | `quote-ai push` / `watch` / `preview` / `help` 入口（bun shebang）|
| `src/index.ts` | 库式 re-exports（程序化用）|
| `plugin/claude-code/` | Claude Code 插件（hook + command）|
| `assets/fonts/` | Regular.ttf / Bold.ttf（gitignored）|

## 设计原则

1. **数据收集与渲染分离**：collectors 只产出统一的 `DailyUsage`，不关心怎么
   渲染；`aggregate.ts` 决定卡片放哪些字段；`render.ts` 不知道数据从哪来。
2. **时区显式**：所有"今天"判定都走 `dateInTz()` 字符串比较，避免 epoch
   边界算错；tz 默认 `Asia/Shanghai`，用户可通过 `USAGE_TIMEZONE` 覆盖。
3. **Codex Plus 不算钱**：套餐配额型用户没有 token-USD 映射，强行换算只会
   误导，所以只展示 token 与配额%。
4. **失败可观察**：collectors 都包了 try/catch，异常打到 stderr，不阻塞另一
   端的采集与推送（一边坏不影响另一边）。
5. **单一 tsconfig**：双端兼容设计已撤回，只面向 Node。
