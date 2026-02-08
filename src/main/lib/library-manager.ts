import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

export function getDefaultLibraryPath(): string {
  return path.join(app.getPath('documents'), 'FileHarbor');
}

export function initializeLibrary(libraryPath: string): void {
  fs.mkdirSync(path.join(libraryPath, 'objects'), { recursive: true });
  fs.mkdirSync(path.join(libraryPath, 'objects', '.tmp'), { recursive: true });
  fs.mkdirSync(path.join(libraryPath, 'logs'), { recursive: true });
}

export function validateLibrary(libraryPath: string): boolean {
  try {
    const objectsDir = path.join(libraryPath, 'objects');
    return (
      fs.existsSync(libraryPath) &&
      fs.statSync(libraryPath).isDirectory() &&
      fs.existsSync(objectsDir) &&
      fs.statSync(objectsDir).isDirectory()
    );
  } catch {
    return false;
  }
}
