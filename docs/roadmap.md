# 后续路线图

按计划交付顺序：

## 1. 真实 usage 数据源

替换 `demoData()` 为真实数据。候选信息源：

- **Anthropic**：`https://api.anthropic.com/v1/organizations/usage_report` 或
  从 Admin API / Console export 拉日级用量
- **OpenAI**：`https://api.openai.com/v1/usage`（Org 级）
- **本地代理 / Helicone / Langfuse 等**：聚合多家供应商的统一指标

设计要点：

- 在 `src/sources/` 下每家 provider 一个 fetcher，返回统一形状 `UsageStat[]`
- 在 `src/aggregate.ts` 合并多源数据 → `UsageData`（`render.ts` 的输入）
- 时区与"今日"窗口口径要明确（建议固定 UTC+8 / 用户本地）
- secrets 同样走 `wrangler secret put` / `.env`

## 2. 渲染模板调优

- 多模板（today / month / per-provider 切换）由 `taskKey` 区分
- 字体改用思源黑体子集以支持中文
- 配色与 dither 算法对实际 e-paper 显示效果做对比测试

## 3. 可靠性

- 推送失败重试（指数退避，限单次 scheduled 内最多 N 次）
- 限流：Dot API 10 req/s，单设备每 30 分钟一次远低于阈值，但批量切换 taskKey
  时要节流
- 监控：wrangler tail 或 Workers Logs 配合 `code !== 200` 报警

## 4. 多设备 / 多任务

- `DOT_DEVICE_ID` 改为多值（逗号分隔或 KV 存储），按 deviceId 渲染不同 taskKey
- KV/D1 存最近一次推送的元数据（时间、PNG 哈希），避免无变化时重复刷屏
