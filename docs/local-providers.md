# 本地数据源（Claude Code & Codex CLI）

## Claude Code

### 路径

`~/.claude/projects/<sanitized-cwd>/<sessionId>.jsonl`

每个目录对应一个工作目录（路径斜杠被替换为 `-`），目录里若干 jsonl 文件即
一次次会话的事件流。

### 关心的行

只解析 `message.usage` 存在的行（assistant 回包行）：

```jsonc
{
  "timestamp": "2026-04-28T03:22:18.471Z",
  "message": {
    "model": "claude-sonnet-4-7",
    "usage": {
      "input_tokens": 6,
      "cache_creation_input_tokens": 9350,
      "cache_read_input_tokens": 18901,
      "output_tokens": 207,
      "server_tool_use": { "web_search_requests": 0, "web_fetch_requests": 0 }
    }
  }
}
```

四个 token 计数分别累加；用 `pricing.ts` 中的模型单价估算 USD：

```
USD = (input * P_in + output * P_out + cache_read * P_cr + cache_creation * P_cw) / 1e6
```

### "今天"窗口

每行的 `timestamp` 是 UTC ISO；通过 `dateInTz(ts, USAGE_TIMEZONE)` 转成本地
日期字符串，与今日字符串相等才计入。

文件级别有一个 mtime 预筛（早于 36 小时前的 jsonl 直接跳过），加速冷启动。

## Codex CLI（OpenAI 官方 `@openai/codex`）

### 路径

`~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-<UTC-ts>-<sessionId>.jsonl`

注意 `YYYY/MM/DD` 是按 **UTC** 切的，不是本地时区。所以收集时会同时扫
"前一天 / 今天 / 后一天"三个 UTC 目录，再按行 timestamp 在本地时区过滤。

### 关心的行

`type=event_msg` 且 `payload.type=token_count`：

```jsonc
{
  "timestamp": "2026-04-22T06:40:55.123Z",
  "type": "event_msg",
  "payload": {
    "type": "token_count",
    "info": {
      "total_token_usage": {
        "input_tokens": 12646,
        "cached_input_tokens": 6528,
        "output_tokens": 241,
        "reasoning_output_tokens": 75,
        "total_tokens": 12887
      },
      "last_token_usage": { ... },
      "model_context_window": 258400
    },
    "rate_limits": {
      "primary":   { "used_percent": 1.0, "window_minutes": 300, "resets_at": 1777012441 },
      "secondary": { "used_percent": 7.0, "window_minutes": 10080, "resets_at": 1777442193 }
    }
  }
}
```

收集器只累加每条 `info.last_token_usage`（增量），`total_token_usage` 是会
话累计、相邻两条会重复，不能直接相加。

### 套餐配额

`rate_limits.primary` 是 5 小时窗口（300 分钟），`secondary` 是周窗口（10080
分钟）。`used_percent` 0-100，`resets_at` 是 epoch 秒。我们取**所有今日行
中时间戳最新的一条**作为当前快照；这是 Plus 套餐用户最关心的指标。

### 不计 USD

Codex CLI Plus 用户按订阅 + 配额计费，token 不直接折算成钱。所以卡片上
Codex 那一格只显示 token 数与配额使用率%。

## 模型单价表（pricing.ts）

| 模型族 | input | output | cache_read | cache_creation | 单位 |
|-------|-------|--------|-----------|----------------|------|
| Sonnet 4.6 / 4.7 | $3 | $15 | $0.30 | $3.75 | per 1M tokens |
| Opus 4.6 / 4.7 | $15 | $75 | $1.50 | $18.75 | per 1M tokens |
| Haiku 4.5 | $1 | $5 | $0.10 | $1.25 | per 1M tokens |

数据源：Anthropic 官方定价页快照。模型升级后请更新 `src/collectors/pricing.ts`。

未识别的模型名会按"是否包含 opus/haiku/其它"做粗匹配，最后回落到 Sonnet。

## 隐私边界

- 所有 jsonl 内容只在内存里加和，不落盘、不外传
- 上设备的只有数字（USD、token 数、百分比、当前时间）
- 不读任何浏览器 cookie / Keychain / API Key
- Plugin 通过 Claude Code 自带的 hook 沙箱触发，不动用任何额外权限
