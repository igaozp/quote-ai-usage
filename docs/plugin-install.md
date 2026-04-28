# Claude Code 插件安装

仓库根目录下的 `plugin/claude-code/` 是一个标准 Claude Code 插件，能让 Claude
Code 在每次会话结束后自动调一次 `quote-ai push`，无需任何外部定时器。

## 前置条件

先把命令行工具搞通：

```bash
cd <repo-root>
bun install
bun link                           # 让 quote-ai 进入全局 PATH
quote-ai config                    # 交互式录入 DOT_API_KEY / DOT_DEVICE_ID
# assets/fonts/{Regular,Bold}.ttf   按 README 放好字体
quote-ai preview                   # 验证整条链路（不需要凭证）
```

> Plugin Stop hook 是非交互（无 TTY），如果 `quote-ai push` 第一次启动时
> 还没配置过，hook 会立即报错退出而不是卡在向导上。所以**装插件之前
> 务必先跑一次 `quote-ai config`**。

> shebang 用 `#!/usr/bin/env bun`，所以目标机器的 PATH 必须能找到 `bun`。
> 如果不想全局装 bun，跑 `bun run build:bin` 把 `dist/quote-ai` 二进制产出
> 后链入 PATH 也行（自带 runtime）。

## 安装

把 `plugin/claude-code` 软链到 `~/.claude/plugins/` 下（仓库不动，未来 git
pull 拿到新内容会自动生效）。

### macOS / Linux

```bash
mkdir -p ~/.claude/plugins
ln -s "$(pwd)/plugin/claude-code" ~/.claude/plugins/quote-ai-usage
```

### Windows（管理员 PowerShell）

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\plugins" | Out-Null
New-Item -ItemType SymbolicLink `
  -Path "$env:USERPROFILE\.claude\plugins\quote-ai-usage" `
  -Target "$PWD\plugin\claude-code"
```

> 如果不愿启管理员权限，可以直接 **复制** 这个目录到
> `%USERPROFILE%\.claude\plugins\quote-ai-usage`，效果一样，只是仓库内
> 改 plugin 后要再复制一次。

## 启用与验证

1. 重启 Claude Code（或在新会话窗口里）
2. `/plugin` 列表里应能看到 `quote-ai-usage`
3. 试试 `/push-usage`，应该立刻在设备上看到更新
4. 之后每次 Claude 完成回答（Stop 事件）都会自动推一次

## 行为细节

- **Stop hook**：每次 Claude Code 完成一轮回答（不论是文字还是工具调用）
  都会触发 `quote-ai push --skip-if-cooling`
- **`--skip-if-cooling`**：如果距上次推送 < `USAGE_COOLDOWN`（默认 60s），
  这次直接退出，不阻塞 hook。所以连续多轮回答最多每分钟推一次
- **超时 30s**：在 `hooks.json` 里设了 `timeout: 30`，万一卡住会被中断
- **失败静默**：push 内部异常只打到 stderr，不会让 Claude Code 报错
- **想换频率**：直接改 `USAGE_COOLDOWN`（如 `10s` / `5m`），无需动 hook
- **跨进程 throttle**：基于 `~/.cache/quote-ai-usage/push.lock` + `state.json`
  实现，多个 Claude Code 实例共用同一 cooldown

## 卸载

```bash
rm ~/.claude/plugins/quote-ai-usage     # macOS / Linux
# Windows: Remove-Item "$env:USERPROFILE\.claude\plugins\quote-ai-usage"
```

或在 Claude Code 里：

```
/plugin disable quote-ai-usage
```
