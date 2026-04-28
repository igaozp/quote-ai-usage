# quote-ai-usage — Claude Code plugin

This directory is the Claude Code plugin entry for the parent project. It
exposes:

- **Stop hook** — runs `quote-ai push --skip-if-cooling` after every
  Claude Code turn so the Dot device reflects fresh token usage with no
  manual action. The `--skip-if-cooling` flag means consecutive turns
  inside the throttle window (default 60s) return immediately without
  blocking the hook.
- **`/push-usage` slash command** — manually trigger one push.

## Prerequisites

Before enabling the plugin, complete the parent project setup once:

```bash
cd <repo-root>
bun install
bun link                # exposes `quote-ai` in your PATH
quote-ai config         # interactive: stores DOT_API_KEY / DOT_DEVICE_ID
# place fonts in assets/fonts/{Regular,Bold}.ttf
```

> The Stop hook runs without a TTY, so if you skip `quote-ai config` the
> first invocation will exit non-zero immediately. Run it once in a real
> terminal before enabling the plugin.

Verify the CLI works (no DOT_* secrets needed):

```bash
quote-ai preview
```

> The `quote-ai` shebang is `#!/usr/bin/env bun`, so `bun` must resolve on
> PATH. To deploy without a global bun install, run `bun run build:bin` and
> point the plugin at the resulting `dist/quote-ai` binary instead.

## Install the plugin

Symlink (or copy) this directory into `~/.claude/plugins/`:

```bash
# macOS / Linux
ln -s "$(pwd)/plugin/claude-code" "$HOME/.claude/plugins/quote-ai-usage"

# Windows (admin powershell)
New-Item -ItemType SymbolicLink `
  -Path "$env:USERPROFILE\.claude\plugins\quote-ai-usage" `
  -Target "$PWD\plugin\claude-code"
```

Restart Claude Code, then confirm:

- `/plugin` list shows `quote-ai-usage`
- `/push-usage` triggers a manual push
- After your next Claude turn finishes, the device updates automatically

## Disabling

Remove the symlink in `~/.claude/plugins/quote-ai-usage`, or use the
`/plugin disable quote-ai-usage` command.
