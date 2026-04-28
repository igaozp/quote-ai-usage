# quote-ai-usage 项目总览

## 目标

把"今日"个人 **Claude Code** 与 **Codex CLI** 的 token 用量聚合后渲染成
296×152 PNG，通过 [Dot 开放 API](https://dot.mindreset.tech) 推送到 quote/0
设备屏幕，让你不打开任何官网就能在桌面物件上看到当天烧了多少。

## 数据源

完全本地，从两家 CLI 自行落盘的 JSONL 中读取：

- `~/.claude/projects/<slug>/<sessionId>.jsonl` —— Claude Code 每次 assistant
  响应的 `message.usage`（input / output / cache_creation / cache_read tokens
  + 模型名）。按公开单价表估算 USD。
- `~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-…jsonl` —— Codex CLI 的
  `event_msg.token_count` 累积 token 与 `rate_limits` 套餐使用率。Codex Plus
  按 5h / 周窗口配额，**不按 token 计费**，所以只展示 token 数与配额%，不算
  USD。

## 当前进度

- [x] Dot 图像 API 对接
- [x] satori + resvg-wasm 渲染 296×152 PNG
- [x] Claude Code 与 Codex CLI 本地 JSONL 收集器
- [x] 单进程 CLI（`quote-ai push` 一次性 / `quote-ai watch` 守护）
- [x] Claude Code Plugin（Stop hook + `/push-usage` 命令）
- [ ] 持久化增量游标（每次只读追加部分）
- [ ] 多模板（按模型 / 按窗口）切换
- [ ] 重试与静默失败上报

## 部署形态

只有"本地"。Cloudflare Workers 路线已经不适用此需求（Workers 没法读用户机器
上的 JSONL）。Workers 相关代码已从仓库移除。
