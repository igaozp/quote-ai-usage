# Claude Code 插件安装

仓库根目录下的 `plugin/claude-code/` 是一个标准 Claude Code 插件，能让 Claude
Code 在每次会话结束后自动调一次 `quote-ai push`，无需任何外部定时器。

## 前置条件

先把命令行工具搞通：

```bash
cd <repo-root>
npm install
npm link                           # 让 quote-ai 进入全局 PATH
cp .env.example .env               # 填 DOT_API_KEY / DOT_DEVICE_ID
# assets/fonts/{Regular,Bold}.ttf   按 README 放好字体
quote-ai push --dry-run            # 验证整条链路
```

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
  都会触发 `quote-ai push`。该命令本身约耗时 1-2 秒（读 jsonl + 渲染 + Dot
  网络往返），不会阻塞下一轮交互
- **超时 30s**：在 `hooks.json` 里设了 `timeout: 30`，万一卡住会被中断
- **失败静默**：push 内部异常只打到 stderr，不会让 Claude Code 报错
- **频次**：每次 Stop 触发一次。如果你嫌频繁，可以把 hook 的 matcher 改成
  特定工具或自行加 debounce

## 卸载

```bash
rm ~/.claude/plugins/quote-ai-usage     # macOS / Linux
# Windows: Remove-Item "$env:USERPROFILE\.claude\plugins\quote-ai-usage"
```

或在 Claude Code 里：

```
/plugin disable quote-ai-usage
```
