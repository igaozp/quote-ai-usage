# 本地开发

## 准备

需要 [Bun](https://bun.com) 1.1+（`curl -fsSL https://bun.com/install | bash`
或 `npm i -g bun`）。

```bash
bun install
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
| `DOT_API_KEY` | Dot 平台 API Key（不带 `dot_app_` 前缀，客户端自动拼接）| ✅（push）|
| `DOT_DEVICE_ID` | 设备序列号 | ✅（push）|
| `DOT_API_BASE_URL` | 覆盖默认 base URL | |
| `USAGE_TIMEZONE` | IANA 时区，默认 `Asia/Shanghai` | |
| `USAGE_INTERVAL` | watch 模式间隔，默认 `30m`（支持 `30s` / `5m` / `1h`）| |
| `USAGE_COOLDOWN` | 推送最小间隔，默认 `60s`（`0` 关闭）| |
| `CLAUDE_HOME` | 覆盖 `~/.claude` | |
| `CODEX_HOME` | 覆盖 `~/.codex` | |
| `DEBUG_PNG` | 设置后将渲染结果同时写入此路径 | |

## 命令

```bash
# 仅本地验证：渲染今日真实数据为 PNG，不调 Dot
bun run preview                  # 输出 preview.png
bun run preview:open             # 输出后自动调系统默认应用打开
quote-ai preview                 # bun link 后等价
quote-ai preview ./out.png --open

# 一次性：聚合今日数据 + 渲染 + 推送
bun run push
quote-ai push                    # 等价

# 守护模式（默认每 30 分钟一次）
bun run watch
quote-ai watch --interval=10m

# 类型检查
bun run typecheck
```

### 推送防抖（throttle）

`push` 默认走跨进程 throttle：每 `USAGE_COOLDOWN`（默认 60 秒）至多一次。
两种模式：

| 调用形式 | 行为 |
|---------|------|
| `quote-ai push` | **wait 模式**：cooldown 未到则 sleep 等到能推；并发请求拿不到 lock 立即返回 |
| `quote-ai push --skip-if-cooling` | **skip 模式**：cooldown 未到直接退出，不阻塞调用方（plugin Stop hook 用这个） |

参数与环境变量：

- `--cooldown=10s` 覆盖 `USAGE_COOLDOWN`，0 = 完全关闭
- `--dry-run` 不走 throttle（仅本地肉眼检查）
- 状态文件：`~/.cache/quote-ai-usage/{state.json,push.lock}`，可通过
  `QUOTE_AI_CACHE` 改路径；`state.json` 只记 `lastPushAt`

### 关于 preview

`preview` 子命令内部走的是 `--dry-run` 路径：照常执行 collector 与渲染、把
PNG 写到指定路径，但跳过 `loadConfig` 与 Dot API 调用。所以**不需要**配置
`DOT_API_KEY` / `DOT_DEVICE_ID` 也能跑——只用来在本地肉眼看真实数据下的渲染
效果。

## 暴露 quote-ai 到全局 PATH

```bash
bun link                # 把 ./src/cli.ts 软链到全局 bin
quote-ai help           # 验证
```

`bun unlink` 在仓库目录跑可以取消。

> shebang 是 `#!/usr/bin/env bun`，因此目标机器必须能在 PATH 找到 `bun`。
> 如果要分发到没装 bun 的机器，跑 `bun run build:bin` 产出 standalone 二
> 进制（自带 bun runtime）。

## 系统级定时（可选）

仓库里的 watch 模式只在进程存活期间生效。若希望开机就跑，按操作系统选一个：

### Windows（任务计划）
```powershell
$action = New-ScheduledTaskAction -Execute "bun" `
  -Argument "run --silent push" `
  -WorkingDirectory "$env:USERPROFILE\project\quote-ai-usage"
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "quote-ai-push" -Action $action -Trigger $trigger
```

### macOS（launchd）
保存为 `~/Library/LaunchAgents/com.user.quote-ai-watch.plist`，`ProgramArguments`
里写 `bun` + 仓库 cwd + `run watch`，然后 `launchctl load ...`。

### Linux（systemd --user）
```ini
# ~/.config/systemd/user/quote-ai-watch.service
[Service]
WorkingDirectory=%h/project/quote-ai-usage
ExecStart=/usr/bin/env bun run watch
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
| `command not found: bun` | 未装 bun | `curl -fsSL https://bun.com/install | bash` 或 `npm i -g bun` |
| `Missing font: .../Regular.ttf` | 字体缺失 | 见 assets/fonts/README.md |
| `Missing DOT_API_KEY / DOT_DEVICE_ID` | 没设环境变量 | 配置 `.env` 或 shell |
| `Dot API request failed (404)` | deviceId 写错或未授权 | 核对设备序列号 |
| `Dot API error (code 400)` | 图片不是 PNG / 尺寸不对 | 检查 satori 输出 |
| Claude 数据为 0 | jsonl 不在 `~/.claude/projects/` | 设 `CLAUDE_HOME` 或确认 Claude Code 1.x |
| Codex 数据为 0 | 今天没用 codex / 路径不对 | 检查 `~/.codex/sessions/<UTC-today-or-±1>/` |
