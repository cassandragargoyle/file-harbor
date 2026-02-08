import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// We need a per-test temp directory for settings. Since settingsPath is computed
// at module load time from app.getPath('userData'), we re-mock electron before
// each test and use dynamic import with vi.resetModules() to get a fresh module.

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fh-settings-test-'));
  vi.resetModules();
  vi.doMock('electron', () => ({
    app: {
      getPath: vi.fn((name: string) => {
        if (name === 'userData') return tmpDir;
        return `/tmp/file-harbor-test/${name}`;
      }),
      getAppPath: vi.fn(() => process.cwd()),
      isPackaged: false,
    },
  }));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function loadModule() {
  return await import('./settings');
}

function writeSettingsFile(data: unknown) {
  fs.writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify(data), 'utf-8');
}

function readSettingsFile() {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, 'settings.json'), 'utf-8'));
}

describe('getActiveWorkspace', () => {
  it('returns the workspace matching activeWorkspaceId', async () => {
    const { getActiveWorkspace } = await loadModule();
    const settings = {
      version: 2 as const,
      workspaces: [
        { id: 'ws-1', name: 'One', libraryPath: '/a' },
        { id: 'ws-2', name: 'Two', libraryPath: '/b' },
      ],
      activeWorkspaceId: 'ws-2',
    };
    const result = getActiveWorkspace(settings);
    expect(result).toBeDefined();
    expect(result!.id).toBe('ws-2');
    expect(result!.name).toBe('Two');
  });

  it('returns undefined when no workspace matches', async () => {
    const { getActiveWorkspace } = await loadModule();
    const settings = {
      version: 2 as const,
      workspaces: [{ id: 'ws-1', name: 'One', libraryPath: '/a' }],
      activeWorkspaceId: 'nonexistent',
    };
    expect(getActiveWorkspace(settings)).toBeUndefined();
  });

  it('returns undefined for empty workspaces array', async () => {
    const { getActiveWorkspace } = await loadModule();
    const settings = {
      version: 2 as const,
      workspaces: [],
      activeWorkspaceId: '',
    };
    expect(getActiveWorkspace(settings)).toBeUndefined();
  });
});

describe('loadSettings', () => {
  it('returns default settings when no file exists', async () => {
    const { loadSettings } = await loadModule();
    const result = loadSettings();
    expect(result.version).toBe(2);
    expect(result.workspaces).toEqual([]);
    expect(result.activeWorkspaceId).toBe('');
  });

  it('loads v2 settings from file', async () => {
    const v2Settings = {
      version: 2,
      workspaces: [{ id: 'ws-1', name: 'Test', libraryPath: '/test' }],
      activeWorkspaceId: 'ws-1',
      lastView: 'Taxes',
    };
    writeSettingsFile(v2Settings);

    const { loadSettings } = await loadModule();
    const result = loadSettings();
    expect(result.version).toBe(2);
    expect(result.workspaces).toHaveLength(1);
    expect(result.activeWorkspaceId).toBe('ws-1');
    expect(result.lastView).toBe('Taxes');
  });

  it('migrates v1 settings to v2 format', async () => {
    const v1Settings = {
      libraryPath: '/old/library',
      watchedFolderPath: '/watched',
      windowBounds: { x: 10, y: 20, width: 800, height: 600 },
      lastView: 'Banking',
    };
    writeSettingsFile(v1Settings);

    const { loadSettings } = await loadModule();
    const result = loadSettings();
    expect(result.version).toBe(2);
    expect(result.workspaces).toHaveLength(1);
    expect(result.workspaces[0].name).toBe('Default');
    expect(result.workspaces[0].libraryPath).toBe('/old/library');
    expect(result.workspaces[0].watchedFolderPath).toBe('/watched');
    expect(result.windowBounds).toEqual({ x: 10, y: 20, width: 800, height: 600 });
    expect(result.lastView).toBe('Banking');
  });

  it('returns default settings for corrupt JSON', async () => {
    fs.writeFileSync(path.join(tmpDir, 'settings.json'), '{not valid json!!!', 'utf-8');

    const { loadSettings } = await loadModule();
    const result = loadSettings();
    expect(result.version).toBe(2);
    expect(result.workspaces).toEqual([]);
  });
});

describe('saveSettings', () => {
  it('writes settings to disk as JSON', async () => {
    const { saveSettings } = await loadModule();
    const settings = {
      version: 2 as const,
      workspaces: [{ id: 'ws-1', name: 'My Workspace', libraryPath: '/lib' }],
      activeWorkspaceId: 'ws-1',
    };
    saveSettings(settings);

    const onDisk = readSettingsFile();
    expect(onDisk.version).toBe(2);
    expect(onDisk.workspaces[0].name).toBe('My Workspace');
  });

  it('saved settings can be loaded back', async () => {
    const { saveSettings, loadSettings } = await loadModule();
    const settings = {
      version: 2 as const,
      workspaces: [{ id: 'ws-1', name: 'Roundtrip', libraryPath: '/rt' }],
      activeWorkspaceId: 'ws-1',
      lastView: 'Medical',
    };
    saveSettings(settings);

    const loaded = loadSettings();
    expect(loaded.activeWorkspaceId).toBe('ws-1');
    expect(loaded.lastView).toBe('Medical');
  });
});

describe('updateSettings', () => {
  it('merges partial updates into existing settings', async () => {
    const { saveSettings, updateSettings, loadSettings } = await loadModule();
    saveSettings({
      version: 2,
      workspaces: [],
      activeWorkspaceId: '',
      lastView: 'Inbox',
    });

    updateSettings({ lastView: 'Taxes' });

    const loaded = loadSettings();
    expect(loaded.lastView).toBe('Taxes');
    expect(loaded.version).toBe(2);
  });
});

describe('updateWorkspace', () => {
  it('updates a specific workspace by id', async () => {
    const { saveSettings, updateWorkspace, loadSettings } = await loadModule();
    saveSettings({
      version: 2,
      workspaces: [
        { id: 'ws-1', name: 'Original', libraryPath: '/orig' },
        { id: 'ws-2', name: 'Other', libraryPath: '/other' },
      ],
      activeWorkspaceId: 'ws-1',
    });

    updateWorkspace('ws-1', { name: 'Renamed' });

    const loaded = loadSettings();
    expect(loaded.workspaces[0].name).toBe('Renamed');
    expect(loaded.workspaces[0].libraryPath).toBe('/orig');
    expect(loaded.workspaces[1].name).toBe('Other');
  });

  it('does nothing when workspace id is not found', async () => {
    const { saveSettings, updateWorkspace, loadSettings } = await loadModule();
    const original = {
      version: 2 as const,
      workspaces: [{ id: 'ws-1', name: 'Only', libraryPath: '/only' }],
      activeWorkspaceId: 'ws-1',
    };
    saveSettings(original);

    updateWorkspace('nonexistent', { name: 'Nope' });

    const loaded = loadSettings();
    expect(loaded.workspaces[0].name).toBe('Only');
  });
});

describe('v1 to v2 migration', () => {
  it('handles missing libraryPath (empty workspaces)', async () => {
    writeSettingsFile({ lastView: 'Home' });

    const { loadSettings } = await loadModule();
    const result = loadSettings();
    expect(result.version).toBe(2);
    expect(result.workspaces).toHaveLength(0);
    expect(result.activeWorkspaceId).toBe('');
  });

  it('persists migrated settings to disk', async () => {
    writeSettingsFile({
      libraryPath: '/migrated',
      watchedFolderPath: '/watch',
    });

    const { loadSettings } = await loadModule();
    loadSettings(); // triggers migration + save

    const onDisk = readSettingsFile();
    expect(onDisk.version).toBe(2);
    expect(onDisk.workspaces).toHaveLength(1);
  });
});
