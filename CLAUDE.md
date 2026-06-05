# claude-notify

Native desktop notification hook for Claude Code. Fires when Claude finishes a response.
Supports macOS (custom Swift overlay on every display), WSL/Windows (BurntToast), and Linux (notify-send).
Click-to-focus is IDE-aware: detects VS Code, JetBrains IDEs, and ao agent sessions.

## Architecture

```
claude-notify/
├── src/
│   ├── desktop-notify.js   # Claude Code Stop hook — entry point
│   ├── multi-notify.swift  # macOS: custom Swift overlay (all displays, click-to-focus)
│   └── lib/
│       └── ide-detect.js   # Detects active IDE from ~/.claude/ide/ lock file
├── assets/
│   ├── notify-claude.png   # Icon for regular Claude sessions
│   └── notify-agent.png    # Icon for ao agent sessions
├── scripts/
│   ├── install.sh          # Compiles Swift binary, wires hook into settings.json
│   └── focus-session.sh    # URL opener for ao session deeplinks
├── tests/
│   └── *.test.js           # Jest tests
├── .claude-plugin/
│   └── plugin.json         # Claude Code plugin manifest
└── .github/workflows/
    └── ci.yml              # Test, lint, build Swift
```

## How the hook fires

Claude Code calls the Stop hook at the end of every response. `desktop-notify.js` reads
`last_assistant_message` from stdin JSON, extracts the first line as the notification body,
and dispatches to the right notifier for the current platform.

## IDE detection

Check `~/.claude/ide/` for a lock file written by the Claude Code VS Code extension.
The lock file path is `~/.claude/ide/<port>.lock` and contains a JSON token.
If present and recently modified (< 60s), VS Code is the active IDE.
For JetBrains, check if `http://localhost:63342` is reachable (JetBrains built-in HTTP server).
Fall back to no-IDE mode (plain activation or no click target).

## Click-to-focus behavior

| IDE | Click action |
|-----|-------------|
| ao session (any IDE) | Open ao dashboard URL (`http://localhost:<AO_PORT>/projects/<id>/sessions/<session>`) |
| VS Code | Open `vscode://anthropic.claude-code/open` URI |
| JetBrains | POST to `http://localhost:63342/focus-project?path=<cwd>` |
| None detected | Plain app activate via bundle ID, or no-op |

## Engineering standards

- Every branch lives in a PR. No direct commits to main except initial scaffold.
- Tests run before every push (pre-commit hook via Husky + lint-staged).
- CI must be green before a PR is considered ready.
- Node.js for the hook logic. No runtime dependencies — only devDependencies for testing.
- Swift binary is compiled from source during install; the compiled binary is gitignored.
- Commit messages: conventional commits (feat:, fix:, chore:, docs:, test:).
- No AI attribution in commits or PRs.

## Test strategy

- Unit tests for `desktop-notify.js`: mock `spawnSync`, verify correct notifier is called per platform
- Unit tests for `ide-detect.js`: mock filesystem/network calls
- Integration smoke test: run the hook with a fake stdin payload, verify exit 0
- Swift binary: build-only check in CI (no UI tests)

## Running tests

```bash
npm test          # Jest
npm run lint      # ESLint
npm run build     # Compile multi-notify.swift → bin/multi-notify
```

## Plugin manifest fields

- `id`: `claude-notify`
- `name`: Claude Notify
- `description`: Native desktop notifications with IDE-aware click-to-focus
- `hookType`: Stop
- `platforms`: macOS, Windows (WSL), Linux
