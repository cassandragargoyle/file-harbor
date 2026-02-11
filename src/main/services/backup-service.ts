import fsp from 'node:fs/promises';
import path from 'node:path';

import type { BackupMeta } from '../../shared/types';
import { fileLog } from '../lib/logger';

/**
 * Create a backup of the workspace library at the given destination.
 * Copies db.sqlite and objects/ (excluding .tmp/), then writes backup-meta.json.
 */
export async function createBackup(
  libraryPath: string,
  destinationPath: string,
  appVersion: string,
  documentCount: number,
  totalSizeBytes: number
): Promise<BackupMeta> {
  await fsp.mkdir(destinationPath, { recursive: true });

  // Copy db.sqlite
  const dbSrc = path.join(libraryPath, 'db.sqlite');
  const dbDest = path.join(destinationPath, 'db.sqlite');
  await fsp.copyFile(dbSrc, dbDest);

  // Copy objects/ excluding .tmp/
  const objectsSrc = path.join(libraryPath, 'objects');
  const objectsDest = path.join(destinationPath, 'objects');

  try {
    await fsp.stat(objectsSrc);
    await fsp.cp(objectsSrc, objectsDest, {
      recursive: true,
      filter: (src) => !src.includes(path.join('objects', '.tmp')),
    });
  } catch {
    // objects/ may not exist yet if library is empty
    await fsp.mkdir(objectsDest, { recursive: true });
  }

  // Write backup-meta.json
  const meta: BackupMeta = {
    version: 1,
    createdAt: new Date().toISOString(),
    appVersion,
    documentCount,
    totalSizeBytes,
  };
  await fsp.writeFile(
    path.join(destinationPath, 'backup-meta.json'),
    JSON.stringify(meta, null, 2)
  );

  fileLog.info(`Backup created at ${destinationPath} (${documentCount} documents)`);
  return meta;
}

/**
 * Validate that a path contains a valid backup.
 * Returns the parsed BackupMeta, or throws if invalid.
 */
export async function validateBackup(backupPath: string): Promise<BackupMeta> {
  const metaPath = path.join(backupPath, 'backup-meta.json');
  const dbPath = path.join(backupPath, 'db.sqlite');

  // Check required files exist
  await fsp.stat(metaPath); // throws if missing
  await fsp.stat(dbPath);   // throws if missing

  const raw = await fsp.readFile(metaPath, 'utf-8');
  const meta: BackupMeta = JSON.parse(raw);

  if (!meta.version || !meta.createdAt) {
    throw new Error('Invalid backup-meta.json');
  }

  return meta;
}

/**
 * Restore a backup into the given library path.
 * Replaces db.sqlite and objects/ with backup contents.
 */
export async function restoreBackup(
  backupPath: string,
  libraryPath: string
): Promise<BackupMeta> {
  const meta = await validateBackup(backupPath);

  // Remove existing db.sqlite
  const dbDest = path.join(libraryPath, 'db.sqlite');
  try { await fsp.unlink(dbDest); } catch { /* may not exist */ }

  // Remove existing WAL/SHM files
  try { await fsp.unlink(dbDest + '-wal'); } catch { /* ok */ }
  try { await fsp.unlink(dbDest + '-shm'); } catch { /* ok */ }

  // Remove existing objects/
  const objectsDest = path.join(libraryPath, 'objects');
  try { await fsp.rm(objectsDest, { recursive: true }); } catch { /* may not exist */ }

  // Copy backup db.sqlite
  await fsp.copyFile(path.join(backupPath, 'db.sqlite'), dbDest);

  // Copy backup objects/
  const objectsSrc = path.join(backupPath, 'objects');
  try {
    await fsp.stat(objectsSrc);
    await fsp.cp(objectsSrc, objectsDest, { recursive: true });
  } catch {
    await fsp.mkdir(objectsDest, { recursive: true });
  }

  fileLog.info(`Backup restored from ${backupPath} (${meta.documentCount} documents)`);
  return meta;
}
