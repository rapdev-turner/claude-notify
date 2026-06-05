'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

const IDE_LOCK_DIR = path.join(os.homedir(), '.claude', 'ide');
const LOCK_STALE_MS = 60 * 1000; // 60 seconds

/**
 * Sync VS Code detection via ~/.claude/ide/ lock files.
 * Returns 'vscode' if a fresh lock file is present, null otherwise.
 * Never throws.
 */
function detectIDESync() {
  try {
    const files = fs.readdirSync(IDE_LOCK_DIR);
    const lockFiles = files.filter(f => f.endsWith('.lock'));
    if (lockFiles.length === 0) return null;

    const now = Date.now();
    for (const file of lockFiles) {
      try {
        const stat = fs.statSync(path.join(IDE_LOCK_DIR, file));
        const age = now - stat.mtimeMs;
        if (age < LOCK_STALE_MS) {
          return 'vscode';
        }
      } catch {
        // skip unreadable file
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Async IDE detection: VS Code (sync lock file) then JetBrains (HTTP ping).
 * Returns { type: 'vscode'|'jetbrains'|null, meta: {} }.
 * Never throws.
 */
function detectIDE() {
  return new Promise(resolve => {
    try {
      const vscode = detectIDESync();
      if (vscode) {
        resolve({ type: 'vscode', meta: {} });
        return;
      }
    } catch {
      // fall through to JetBrains check
    }

    // JetBrains: probe localhost:63342 with 1s timeout
    let settled = false;
    const finish = result => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const timeoutId = setTimeout(() => {
      finish({ type: null, meta: {} });
    }, 1000);

    try {
      const req = http.get({ hostname: 'localhost', port: 63342, path: '/', timeout: 1000 }, res => {
        clearTimeout(timeoutId);
        res.destroy();
        finish({ type: 'jetbrains', meta: { status: res.statusCode } });
      });

      req.on('error', () => {
        clearTimeout(timeoutId);
        finish({ type: null, meta: {} });
      });

      req.on('timeout', () => {
        req.destroy();
        clearTimeout(timeoutId);
        finish({ type: null, meta: {} });
      });
    } catch {
      clearTimeout(timeoutId);
      finish({ type: null, meta: {} });
    }
  });
}

module.exports = { detectIDESync, detectIDE };
