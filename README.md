# claude-notify

Native desktop notifications for Claude Code with IDE-aware click-to-focus.

When Claude finishes a task, you get a notification on every connected display. Clicking it focuses the right application — VS Code, JetBrains, or the ao dashboard — depending on what is running.

## What it does

- Sends a native macOS notification banner when the Claude Code `Stop` hook fires
- Shows the notification on every connected display simultaneously (via custom Swift binary)
- Detects your active IDE and wires the click action accordingly
- Falls back gracefully: terminal-notifier, then plain osascript

## Requirements

- macOS (primary). WSL/Linux supported with BurntToast for notifications (no click-to-focus)
- Node.js 18+
- Xcode command-line tools (for `swiftc`, macOS only)

## Install

```bash
git clone https://github.com/your-org/claude-notify
cd claude-notify
npm install
npm run install-hook
```

`install-hook` compiles the Swift binary and registers the Stop hook in `~/.claude/settings.json`.

## How the hook fires

Claude Code calls every command listed under `hooks.Stop` in `~/.claude/settings.json` when a session ends. `desktop-notify.js` reads the final assistant message from stdin, extracts the first non-empty line (truncated to 100 chars), and dispatches the notification.

## IDE detection

| Method | When used |
|--------|-----------|
| VS Code lock file | `~/.claude/ide/*.lock` present with mtime < 60s |
| JetBrains HTTP ping | `GET localhost:63342` responds within 1s |
| Neither | Notification shown, no app focused on click |

VS Code detection is synchronous (no latency). JetBrains detection is only used by `detectIDE()` (async), not in the notification hot path.

## Click-to-focus behavior

| Active IDE | Click action |
|------------|-------------|
| VS Code | Opens `vscode://anthropic.claude-code/open` URI |
| JetBrains (PyCharm) | Calls `localhost:63342/focus-project` plugin endpoint, falls back to app activation |
| ao session | Opens ao dashboard URL (`http://localhost:3000/projects/.../sessions/...`) |
| None detected | Notification dismisses |

## Platform support

| Platform | Notifications | Click-to-focus |
|----------|--------------|----------------|
| macOS | Native (multi-notify, terminal-notifier, osascript) | Full |
| WSL | BurntToast via PowerShell | Not supported |
| Linux | Not implemented | Not supported |

## Contributing

```bash
npm test       # run jest test suite
npm run lint   # eslint check
npm run build  # compile Swift binary
```

IDE detection logic is in `src/lib/ide-detect.js`. The Swift overlay binary is `src/multi-notify.swift`. The Stop hook entry point is `src/desktop-notify.js`.
