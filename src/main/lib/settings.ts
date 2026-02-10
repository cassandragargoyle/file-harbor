import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Workspace } from '../../shared/types';

export interface OllamaSettings {
  ollamaEnabled: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;
  suggestionConfidenceThreshold: number;
  ollamaNudgeShown: boolean;
}

export const DEFAULT_OLLAMA_SETTINGS: OllamaSettings = {
  ollamaEnabled: false,
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'phi3:mini',
  suggestionConfidenceThreshold: 0.7,
  ollamaNudgeShown: false,
};

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
  ollama?: Partial<OllamaSettings>;
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

export function getOllamaSettings(): OllamaSettings {
  const settings = loadSettings();
  return { ...DEFAULT_OLLAMA_SETTINGS, ...settings.ollama };
}

export function updateOllamaSettings(partial: Partial<OllamaSettings>): void {
  const settings = loadSettings();
  settings.ollama = { ...settings.ollama, ...partial };
  saveSettings(settings);
}
