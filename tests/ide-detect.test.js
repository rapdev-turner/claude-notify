'use strict';

jest.mock('fs');
jest.mock('http');

describe('detectIDESync', () => {
  let detectIDESync;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('fs');
    jest.mock('http');
    ({ detectIDESync } = require('../src/lib/ide-detect'));
  });

  it('lock file present with mtime < 60s → returns vscode', () => {
    const freshFs = require('fs');
    freshFs.readdirSync = jest.fn().mockReturnValue(['vscode-12345.lock']);
    freshFs.statSync = jest.fn().mockReturnValue({ mtimeMs: Date.now() - 5000 }); // 5s old

    const result = detectIDESync();
    expect(result).toBe('vscode');
  });

  it('lock file present with mtime > 60s → returns null', () => {
    const freshFs = require('fs');
    freshFs.readdirSync = jest.fn().mockReturnValue(['vscode-12345.lock']);
    freshFs.statSync = jest.fn().mockReturnValue({ mtimeMs: Date.now() - 90000 }); // 90s old

    const result = detectIDESync();
    expect(result).toBeNull();
  });

  it('no lock file → returns null', () => {
    const freshFs = require('fs');
    freshFs.readdirSync = jest.fn().mockReturnValue([]);

    const result = detectIDESync();
    expect(result).toBeNull();
  });

  it('readdirSync throws → returns null', () => {
    const freshFs = require('fs');
    freshFs.readdirSync = jest.fn().mockImplementation(() => { throw new Error('ENOENT'); });

    const result = detectIDESync();
    expect(result).toBeNull();
  });
});

describe('detectIDE', () => {
  let detectIDE;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('fs');
    jest.mock('http');
  });

  it('no VS Code lock, JetBrains responds → returns jetbrains', async () => {
    const freshFs = require('fs');
    freshFs.readdirSync = jest.fn().mockReturnValue([]); // no lock files

    const freshHttp = require('http');
    // Simulate JetBrains responding
    freshHttp.get = jest.fn((opts, callback) => {
      const mockRes = { statusCode: 200, destroy: jest.fn() };
      // Call callback synchronously in test
      setTimeout(() => callback(mockRes), 0);
      return { on: jest.fn(), destroy: jest.fn() };
    });

    ({ detectIDE } = require('../src/lib/ide-detect'));
    const result = await detectIDE();
    expect(result.type).toBe('jetbrains');
  });

  it('no VS Code, JetBrains error → returns null', async () => {
    const freshFs = require('fs');
    freshFs.readdirSync = jest.fn().mockReturnValue([]);

    const freshHttp = require('http');
    freshHttp.get = jest.fn((_opts, _callback) => {
      const req = {
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            // Trigger error immediately
            setTimeout(() => handler(new Error('ECONNREFUSED')), 0);
          }
          return req;
        }),
        destroy: jest.fn(),
      };
      return req;
    });

    ({ detectIDE } = require('../src/lib/ide-detect'));
    const result = await detectIDE();
    expect(result.type).toBeNull();
  });

  it('VS Code lock present → returns vscode without hitting JetBrains', async () => {
    const freshFs = require('fs');
    freshFs.readdirSync = jest.fn().mockReturnValue(['vscode-99.lock']);
    freshFs.statSync = jest.fn().mockReturnValue({ mtimeMs: Date.now() - 1000 }); // 1s old

    const freshHttp = require('http');
    freshHttp.get = jest.fn();

    ({ detectIDE } = require('../src/lib/ide-detect'));
    const result = await detectIDE();
    expect(result.type).toBe('vscode');
    // Should not have called http.get
    expect(freshHttp.get).not.toHaveBeenCalled();
  });
});
