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

// ── Export All ──────────────────────────────────────────────────

import type { DocumentRecord, ExportAllResult } from '../../shared/types';

const UNSAFE_FILENAME_CHARS = /[/\\:*?"<>|\x00]/g;

function sanitizeFilename(name: string): string {
  return name.replace(UNSAFE_FILENAME_CHARS, '_').slice(0, 200);
}

/**
 * Resolve the best human-readable filename for a document.
 * Priority: accepted suggested_filename → original_filename → uuid fallback.
 */
function resolveExportFilename(doc: DocumentRecord): string {
  const ext = path.extname(doc.stored_path).toLowerCase();

  // Priority 1: accepted suggested filename (has no extension — append it)
  if (doc.suggested_filename && doc.suggestion_outcome === 'accepted') {
    return sanitizeFilename(doc.suggested_filename) + ext;
  }

  // Priority 2: original filename
  if (doc.original_filename) {
    return sanitizeFilename(doc.original_filename);
  }

  // Priority 3: UUID fallback
  return `${doc.id}${ext}`;
}

/**
 * Produce a unique filename within a directory by appending (2), (3), etc.
 */
function deduplicateFilename(
  filename: string,
  usedNames: Set<string>
): string {
  const key = filename.toLowerCase();
  if (!usedNames.has(key)) {
    usedNames.add(key);
    return filename;
  }

  const ext = path.extname(filename);
  const base = filename.slice(0, filename.length - ext.length);
  let counter = 2;
  while (usedNames.has(`${base} (${counter})${ext}`.toLowerCase())) {
    counter++;
  }
  const unique = `${base} (${counter})${ext}`;
  usedNames.add(unique.toLowerCase());
  return unique;
}

interface ExportManifestEntry {
  exportedFilename: string;
  originalFilename: string;
  category: string | null;
  addedAt: string;
  sizeBytes: number;
  contentHash: string;
}

/**
 * Export all documents to a destination folder organized by category.
 * Returns a summary of what was exported.
 */
export async function exportAllFiles(
  libraryPath: string,
  documents: DocumentRecord[],
  destinationRoot: string,
  workspaceName: string,
  appVersion: string
): Promise<ExportAllResult> {
  await fsp.mkdir(destinationRoot, { recursive: true });

  let exported = 0;
  let failed = 0;
  const manifestEntries: ExportManifestEntry[] = [];

  // Track used names per subfolder to handle collisions
  const usedNamesPerFolder = new Map<string, Set<string>>();

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const subfolder = doc.category ?? 'Inbox';
    const subfolderPath = path.join(destinationRoot, subfolder);

    // Get or create the used-names set for this subfolder
    if (!usedNamesPerFolder.has(subfolder)) {
      usedNamesPerFolder.set(subfolder, new Set());
    }
    const usedNames = usedNamesPerFolder.get(subfolder)!;

    const rawFilename = resolveExportFilename(doc);
    const filename = deduplicateFilename(rawFilename, usedNames);

    const destPath = path.join(subfolderPath, filename);
    const sourcePath = path.join(libraryPath, doc.stored_path);

    try {
      await fsp.mkdir(subfolderPath, { recursive: true });
      await fsp.copyFile(sourcePath, destPath);
      exported++;
      manifestEntries.push({
        exportedFilename: `${subfolder}/${filename}`,
        originalFilename: doc.original_filename,
        category: doc.category,
        addedAt: doc.added_at,
        sizeBytes: doc.size_bytes,
        contentHash: `sha256:${doc.content_hash}`,
      });
    } catch (err) {
      fileLog.error(`Export failed for ${doc.id} (${doc.stored_path}):`, err);
      failed++;
    }

    // Yield to event loop periodically
    if (i % 50 === 49) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  // Write manifest
  const manifest = {
    exportedAt: new Date().toISOString(),
    appVersion,
    workspaceName,
    documentCount: exported,
    documents: manifestEntries,
  };

  try {
    await fsp.writeFile(
      path.join(destinationRoot, 'export-manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );
  } catch (err) {
    fileLog.error('Failed to write export manifest:', err);
  }

  return { success: true, exported, failed, path: destinationRoot };
}
