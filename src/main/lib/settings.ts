import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Workspace } from '../../shared/types';

export interface AppSettings {
  version: 2;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  lastView?: string;
}

interface LegacySettings {
  libraryPath?: string;
  watchedFolderPath?: string;
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  lastView?: string;
}

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function migrateV1ToV2(legacy: LegacySettings): AppSettings {
  const workspaces: Workspace[] = [];

  if (legacy.libraryPath) {
    workspaces.push({
      id: randomUUID(),
      name: 'Default',
      libraryPath: legacy.libraryPath,
      watchedFolderPath: legacy.watchedFolderPath,
    });
  }

  return {
    version: 2,
    workspaces,
    activeWorkspaceId: workspaces[0]?.id ?? '',
    windowBounds: legacy.windowBounds,
    lastView: legacy.lastView,
  };
}

export function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (data.version === 2) {
        return data as AppSettings;
      }
      // Legacy v1 format — migrate
      const migrated = migrateV1ToV2(data as LegacySettings);
      saveSettings(migrated);
      return migrated;
    }
  } catch {
    // Corrupt settings file — start fresh
  }
  return { version: 2, workspaces: [], activeWorkspaceId: '' };
}

export function saveSettings(settings: AppSettings): void {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

export function updateSettings(partial: Partial<AppSettings>): void {
  const current = loadSettings();
  saveSettings({ ...current, ...partial });
}

export function getActiveWorkspace(settings: AppSettings): Workspace | undefined {
  return settings.workspaces.find((w) => w.id === settings.activeWorkspaceId);
}

export function updateWorkspace(workspaceId: string, partial: Partial<Workspace>): void {
  const settings = loadSettings();
  const idx = settings.workspaces.findIndex((w) => w.id === workspaceId);
  if (idx >= 0) {
    settings.workspaces[idx] = { ...settings.workspaces[idx], ...partial };
    saveSettings(settings);
  }
}
