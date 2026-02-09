import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { v4 as uuidv4 } from 'uuid';

import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES } from '../../shared/constants';
import { fileLog } from '../lib/logger';

const IGNORED_PATTERNS = [
  /^\./,            // dotfiles
  /\.DS_Store$/,
  /^~\$/,           // Office temp files
  /\.tmp$/,
  /\.crdownload$/,
  /\.part$/,
];

export interface ResolveResult {
  filePaths: string[];
  skippedCount: number;
}

/**
 * Resolve a mix of file and directory paths into a flat list of importable file paths.
 * Directories are walked recursively. Unsupported file types are silently skipped.
 */
export async function resolveFilePaths(paths: string[]): Promise<ResolveResult> {
  const filePaths: string[] = [];
  let skippedCount = 0;

  for (const p of paths) {
    try {
      const stat = await fsp.stat(p);
      if (stat.isDirectory()) {
        const entries: string[] = await fsp.readdir(p, { recursive: true } as any);
        for (const entry of entries) {
          const entryStr = String(entry);
          const filename = path.basename(entryStr);
          if (IGNORED_PATTERNS.some((pat) => pat.test(filename))) {
            skippedCount++;
            continue;
          }
          const ext = path.extname(entryStr).toLowerCase();
          if (!ACCEPTED_EXTENSIONS.includes(ext)) {
            skippedCount++;
            continue;
          }
          const fullPath = path.join(p, entryStr);
          // Ensure it's actually a file (not a subdirectory that happens to have an extension)
          try {
            const entryStat = await fsp.stat(fullPath);
            if (entryStat.isFile()) {
              filePaths.push(fullPath);
            }
          } catch {
            skippedCount++;
          }
        }
      } else if (stat.isFile()) {
        filePaths.push(p);
      }
    } catch {
      // Path doesn't exist or can't be accessed — skip
      skippedCount++;
    }
  }

  return { filePaths, skippedCount };
}

export interface IngestFileResult {
  uuid: string;
  storedPath: string;
  contentHash: string;
  sizeBytes: number;
  mimeType: string;
  extension: string;
}

/**
 * Get MIME type from file extension. Extension-first detection
 * is reliable for our accepted formats (.pdf, .png, .jpg, .txt, .docx).
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return ACCEPTED_MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Validate that a resolved path stays within the library root.
 * Resolves symlinks before checking.
 */
export async function validatePathWithinLibrary(
  filePath: string,
  libraryRoot: string
): Promise<boolean> {
  try {
    const realPath = await fsp.realpath(filePath);
    const realRoot = await fsp.realpath(libraryRoot);
    return realPath.startsWith(realRoot + path.sep) || realPath === realRoot;
  } catch {
    return false;
  }
}

/**
 * Ingest a file using temp + hash + rename strategy:
 * 1. Stream source to temp file while computing SHA-256 (single read pass)
 * 2. Return hash and metadata so caller can check for duplicates
 * 3. Caller decides whether to finalize (rename) or discard (delete temp)
 */
export async function ingestFileToTemp(
  sourcePath: string,
  libraryPath: string
): Promise<IngestFileResult> {
  const ext = path.extname(sourcePath).toLowerCase() || '.bin';
  const uuid = uuidv4();
  const tempDir = path.join(libraryPath, 'objects', '.tmp');
  const tempPath = path.join(tempDir, `${uuid}${ext}`);

  await fsp.mkdir(tempDir, { recursive: true });

  const hash = crypto.createHash('sha256');
  let sizeBytes = 0;

  const readStream = fs.createReadStream(sourcePath);
  const writeStream = fs.createWriteStream(tempPath);

  // Pipe through hash and to disk simultaneously
  readStream.on('data', (chunk: Buffer) => {
    hash.update(chunk);
    sizeBytes += chunk.length;
  });

  await pipeline(readStream, writeStream);

  const contentHash = hash.digest('hex');
  const mimeType = getMimeType(sourcePath);
  const storedPath = `objects/.tmp/${uuid}${ext}`;

  return { uuid, storedPath, contentHash, sizeBytes, mimeType, extension: ext };
}

/**
 * Finalize an ingested file by moving it from temp to permanent storage.
 */
export async function finalizeIngest(
  libraryPath: string,
  uuid: string,
  extension: string
): Promise<string> {
  const tempPath = path.join(libraryPath, 'objects', '.tmp', `${uuid}${extension}`);
  const finalPath = path.join(libraryPath, 'objects', `${uuid}${extension}`);
  await fsp.rename(tempPath, finalPath);
  return `objects/${uuid}${extension}`;
}

/**
 * Discard a temp file (used when duplicate detected).
 */
export async function discardTemp(
  libraryPath: string,
  uuid: string,
  extension: string
): Promise<void> {
  const tempPath = path.join(libraryPath, 'objects', '.tmp', `${uuid}${extension}`);
  try {
    await fsp.unlink(tempPath);
  } catch {
    // Already cleaned up
  }
}

/**
 * Delete a stored file from the library.
 */
export async function deleteStoredFile(
  libraryPath: string,
  storedPath: string
): Promise<void> {
  const fullPath = path.join(libraryPath, storedPath);
  try {
    await fsp.unlink(fullPath);
    fileLog.info(`Deleted stored file: ${storedPath}`);
  } catch (err) {
    fileLog.error(`Failed to delete stored file: ${storedPath}`, err);
  }
}

/**
 * Export (copy) a stored file to a destination.
 */
export async function exportFile(
  libraryPath: string,
  storedPath: string,
  destinationPath: string
): Promise<void> {
  const sourcePath = path.join(libraryPath, storedPath);
  await fsp.copyFile(sourcePath, destinationPath);
}

/**
 * Get the absolute path for a stored file.
 */
export function getAbsolutePath(libraryPath: string, storedPath: string): string {
  return path.join(libraryPath, storedPath);
}
