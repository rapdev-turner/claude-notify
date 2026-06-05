#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"

echo "Building multi-notify..."
cd "$PKG_DIR"
mkdir -p bin
swiftc src/multi-notify.swift -o bin/multi-notify
echo "Built bin/multi-notify"

# Wire Stop hook into ~/.claude/settings.json
HOOK_CMD="node $PKG_DIR/src/desktop-notify.js"
SETTINGS="$HOME/.claude/settings.json"

node -e "
const fs = require('fs');
const path = require('path');
const settingsPath = '$SETTINGS';
const hookCmd = process.argv[1];
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch {}
if (!cfg.hooks) cfg.hooks = {};
if (!cfg.hooks.Stop) cfg.hooks.Stop = [];
const already = cfg.hooks.Stop.some(h => h.command === hookCmd);
if (!already) {
  cfg.hooks.Stop.push({ command: hookCmd });
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(cfg, null, 2));
  console.log('Hook registered in', settingsPath);
} else {
  console.log('Hook already registered');
}
" "$HOOK_CMD"
