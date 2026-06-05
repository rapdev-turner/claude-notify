'use strict';

// Mock child_process before requiring the module
jest.mock('child_process', () => ({
  spawnSync: jest.fn(() => ({ status: 0 })),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock('../src/lib/ide-detect', () => ({
  detectIDESync: jest.fn(),
}));

// Helper: run the module's run() with given stdin JSON and env
function loadFreshModule() {
  jest.resetModules();
  // Re-apply mocks after resetModules
  jest.mock('child_process', () => ({ spawnSync: jest.fn(() => ({ status: 0 })) }));
  jest.mock('fs', () => ({ existsSync: jest.fn(), readFileSync: jest.fn() }));
  jest.mock('../src/lib/ide-detect', () => ({ detectIDESync: jest.fn() }));
  return require('../src/desktop-notify');
}

describe('extractSummary', () => {
  let mod;
  let originalPlatform;

  beforeEach(() => {
    originalPlatform = process.platform;
    // Must set platform before loading module so isMacOS evaluates correctly
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    mod = loadFreshModule();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('returns first non-empty line', () => {
    const fs2 = require('fs');
    fs2.existsSync.mockReturnValue(false); // no multi-notify, no terminal-notifier
    const spawnSync2 = require('child_process').spawnSync;
    const ideDetect = require('../src/lib/ide-detect');
    ideDetect.detectIDESync.mockReturnValue(null);

    mod.run(JSON.stringify({ last_assistant_message: '\n\nHello world\nSecond line' }));
    // osascript call includes the message
    const calls = spawnSync2.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1];
    expect(JSON.stringify(lastCall)).toContain('Hello world');
  });

  it('truncates at 100 chars with ellipsis', () => {
    const fs2 = require('fs');
    fs2.existsSync.mockReturnValue(false);
    const spawnSync2 = require('child_process').spawnSync;
    const ideDetect = require('../src/lib/ide-detect');
    ideDetect.detectIDESync.mockReturnValue(null);

    const longMsg = 'A'.repeat(150);
    mod.run(JSON.stringify({ last_assistant_message: longMsg }));
    const calls = spawnSync2.mock.calls;
    const lastCall = calls[calls.length - 1];
    const callStr = JSON.stringify(lastCall);
    // Should be truncated — not have 150 A's but 100 + ellipsis
    expect(callStr).toContain('...');
    expect(callStr).not.toContain('A'.repeat(101));
  });
});

describe('notifyMacOS with multi-notify', () => {
  let originalPlatform;

  beforeEach(() => {
    originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    delete process.env.AO_SESSION_ID;
    delete process.env.AO_PORT;
    delete process.env.AO_PROJECT_ID;
  });

  it('macOS + vscode IDE → multi-notify called with --activate com.microsoft.VSCode', () => {
    const mod = loadFreshModule();
    const fs2 = require('fs');
    const spawnSync2 = require('child_process').spawnSync;
    const ideDetect = require('../src/lib/ide-detect');

    fs2.existsSync.mockReturnValue(true); // multi-notify exists
    ideDetect.detectIDESync.mockReturnValue('vscode');

    mod.run(JSON.stringify({ last_assistant_message: 'Task done' }));

    const calls = spawnSync2.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const multiNotifyCall = calls.find(c => c[0] && String(c[0]).includes('multi-notify'));
    expect(multiNotifyCall).toBeDefined();
    expect(multiNotifyCall[1]).toContain('--activate');
    expect(multiNotifyCall[1]).toContain('com.microsoft.VSCode');
  });

  it('macOS + jetbrains IDE → multi-notify called with --activate com.jetbrains.pycharm + --open-path', () => {
    const mod = loadFreshModule();
    const fs2 = require('fs');
    const spawnSync2 = require('child_process').spawnSync;
    const ideDetect = require('../src/lib/ide-detect');

    fs2.existsSync.mockReturnValue(true);
    ideDetect.detectIDESync.mockReturnValue('jetbrains');

    mod.run(JSON.stringify({ last_assistant_message: 'Task done' }));

    const calls = spawnSync2.mock.calls;
    const multiNotifyCall = calls.find(c => c[0] && String(c[0]).includes('multi-notify'));
    expect(multiNotifyCall).toBeDefined();
    expect(multiNotifyCall[1]).toContain('--activate');
    expect(multiNotifyCall[1]).toContain('com.jetbrains.pycharm');
    expect(multiNotifyCall[1]).toContain('--open-path');
  });

  it('macOS + AO_SESSION set + null IDE → multi-notify called with --url', () => {
    process.env.AO_SESSION_ID = 'sess-abc123';
    process.env.AO_PORT = '3000';

    const mod = loadFreshModule();
    const fs2 = require('fs');
    const spawnSync2 = require('child_process').spawnSync;
    const ideDetect = require('../src/lib/ide-detect');

    fs2.existsSync.mockReturnValue(true);
    ideDetect.detectIDESync.mockReturnValue(null);

    mod.run(JSON.stringify({ last_assistant_message: 'Agent task done' }));

    const calls = spawnSync2.mock.calls;
    const multiNotifyCall = calls.find(c => c[0] && String(c[0]).includes('multi-notify'));
    expect(multiNotifyCall).toBeDefined();
    expect(multiNotifyCall[1]).toContain('--url');
    const urlArg = multiNotifyCall[1][multiNotifyCall[1].indexOf('--url') + 1];
    expect(urlArg).toMatch(/http:\/\/localhost:3000/);
  });

  it('macOS + no multi-notify binary → falls back to osascript', () => {
    const mod = loadFreshModule();
    const fs2 = require('fs');
    const spawnSync2 = require('child_process').spawnSync;
    const ideDetect = require('../src/lib/ide-detect');

    fs2.existsSync.mockReturnValue(false); // no multi-notify, no terminal-notifier
    ideDetect.detectIDESync.mockReturnValue(null);

    mod.run(JSON.stringify({ last_assistant_message: 'Done' }));

    const calls = spawnSync2.mock.calls;
    const osascriptCall = calls.find(c => c[0] === 'osascript');
    expect(osascriptCall).toBeDefined();
  });
});

describe('invalid/empty stdin', () => {
  it('empty stdin → exits without crash', () => {
    const mod = loadFreshModule();
    const fs2 = require('fs');
    const ideDetect = require('../src/lib/ide-detect');

    fs2.existsSync.mockReturnValue(false);
    ideDetect.detectIDESync.mockReturnValue(null);

    expect(() => mod.run('')).not.toThrow();
  });

  it('invalid JSON → exits without crash', () => {
    const mod = loadFreshModule();
    const fs2 = require('fs');
    const ideDetect = require('../src/lib/ide-detect');

    fs2.existsSync.mockReturnValue(false);
    ideDetect.detectIDESync.mockReturnValue(null);

    expect(() => mod.run('not valid json{')).not.toThrow();
  });
});
