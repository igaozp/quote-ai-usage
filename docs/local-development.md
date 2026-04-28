# 本地开发

## 准备

```bash
npm install
cp .env.example .env       # 填 DOT_API_KEY / DOT_DEVICE_ID
```

字体（必备，gitignored）：

```
assets/fonts/Regular.ttf   # weight 400
assets/fonts/Bold.ttf      # weight 700
```

详见 [`assets/fonts/README.md`](../assets/fonts/README.md)，推荐 Inter 静态字重。

## 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `DOT_API_KEY` | Dot 平台 API Key（不带 `dot_app_` 前缀，客户端自动拼接）| ✅ |
| `DOT_DEVICE_ID` | 设备序列号 | ✅ |
| `DOT_API_BASE_URL` | 覆盖默认 base URL | |
| `USAGE_TIMEZONE` | IANA 时区，默认 `Asia/Shanghai` | |
| `USAGE_INTERVAL` | watch 模式间隔，默认 `30m`（支持 `30s` / `5m` / `1h`）| |
| `CLAUDE_HOME` | 覆盖 `~/.claude` | |
| `CODEX_HOME` | 覆盖 `~/.codex` | |
| `DEBUG_PNG` | 设置后将渲染结果同时写入此路径 | |

## 命令

```bash
# 一次性：聚合今日数据 + 渲染 + 推送
npm run push
quote-ai push                    # 等价（前提是已 npm link）

# 仅渲染、不推送，并把 PNG 写到 preview.png
npm run preview
DEBUG_PNG=preview.png quote-ai push --dry-run

# 守护模式（默认每 30 分钟一次）
npm run watch
quote-ai watch --interval=10m

# 类型检查
npm run typecheck
```

## 暴露 quote-ai 到全局 PATH

```bash
npm link                # 软链 ./bin/quote-ai.mjs → 全局 bin
quote-ai help           # 验证
```

`npm unlink -g quote-ai-usage` 可以取消。

## 系统级定时（可选）

仓库里的 watch 模式只在进程存活期间生效。若希望开机就跑，按操作系统选一个：

### Windows（任务计划）
```powershell
$action = New-ScheduledTaskAction -Execute "node" `
  -Argument "$env:USERPROFILE\project\quote-ai-usage\bin\quote-ai.mjs watch"
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "quote-ai-watch" -Action $action -Trigger $trigger
```

### macOS（launchd）
保存为 `~/Library/LaunchAgents/com.user.quote-ai-watch.plist`，然后
`launchctl load ...`。模板见 `docs/templates/com.user.quote-ai-watch.plist`
（如果有）。

### Linux（systemd --user）
```ini
# ~/.config/systemd/user/quote-ai-watch.service
[Service]
WorkingDirectory=%h/project/quote-ai-usage
ExecStart=/usr/bin/node bin/quote-ai.mjs watch
Restart=on-failure

[Install]
WantedBy=default.target
```

```bash
systemctl --user enable --now quote-ai-watch
```

## 故障排查

| 报错片段 | 原因 | 解决 |
|---------|------|------|
| `Missing font: .../Regular.ttf` | 字体缺失 | 见 assets/fonts/README.md |
| `Missing DOT_API_KEY / DOT_DEVICE_ID` | 没设环境变量 | 配置 `.env` 或 shell |
| `Dot API request failed (404)` | deviceId 写错或未授权 | 核对设备序列号 |
| `Dot API error (code 400)` | 图片不是 PNG / 尺寸不对 | 检查 satori 输出 |
| Claude 数据为 0 | jsonl 没在 `~/.claude/projects/` 下 | 确认你在用 Claude Code 1.x，或设 `CLAUDE_HOME` |
| Codex 数据为 0 | 今天没用 codex / 路径不对 | 检查 `~/.codex/sessions/<UTC-today-or-±1>/` |
