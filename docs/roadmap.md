# 后续路线图

## 1. 增量游标
当前每次扫描都是全量重读。低成本优化：在 `~/.cache/quote-ai-usage/cursor.json`
记录每个 jsonl 文件上次读到的 byte offset 与 mtime；下次只读追加部分，把今日
增量加到一个滚动 `today.json`。

## 2. 防抖与频次控制
Plugin Stop hook 触发频繁，连续多轮回答可能 1 秒内调多次。可在 cli 入口加
基于文件锁的 debounce（默认 30~60s 内多次触发只发一次最终值）。

## 3. 多模板
- "今日 / 本周 / 本月" 三视图
- "按模型分项" 视图（Sonnet vs Opus，token 占比条）
- 通过 `taskKey` 区分 Dot 设备上的多张卡片

## 4. 监控与上报
- push 失败自动重试（指数退避）
- 失败连续 N 次后静默写入 `~/.cache/quote-ai-usage/errors.log`
- 可选：失败时通过 Dot 推一张"故障卡"提示

## 5. 模型单价的可配置化
当前 `pricing.ts` 是静态表，新模型上线就要改代码。可以让 `~/.config/quote-ai/pricing.json`
覆盖内置表。

## 6. Codex 维度增强
- 显示套餐重置倒计时（resets_at - now → mm:ss）
- 周配额（secondary）的小条形图
