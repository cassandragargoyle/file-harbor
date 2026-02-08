import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

interface AppSettings {
  libraryPath?: string;
  watchedFolderPath?: string;
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

export function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // Corrupt settings file — start fresh
  }
  return {};
}

export function saveSettings(settings: AppSettings): void {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

export function updateSettings(partial: Partial<AppSettings>): void {
  const current = loadSettings();
  saveSettings({ ...current, ...partial });
}
