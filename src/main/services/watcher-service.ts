import chokidar from 'chokidar';
import path from 'node:path';

import { ACCEPTED_EXTENSIONS } from '../../shared/constants';
import type { DocumentRecord } from '../../shared/types';
import type { DatabaseService } from './database';
import type { PdfExtractor } from './pdf-extractor';
import {
  ingestFileToTemp,
  finalizeIngest,
  discardTemp,
  getAbsolutePath,
} from './file-service';
import { watcherLog } from '../lib/logger';

const IGNORED_PATTERNS = [
  /^\./,            // dotfiles
  /\.DS_Store$/,
  /^~\$/,           // Office temp files
  /\.tmp$/,
  /\.crdownload$/,
  /\.part$/,
];

interface AppState {
  db: DatabaseService | null;
  libraryPath: string | null;
  pdfExtractor: PdfExtractor | null;
}

export class WatcherService {
  private watcher: chokidar.FSWatcher | null = null;
  private watchedFolder: string | null = null;

  constructor(
    private state: AppState,
    private onFileIngested: (doc: DocumentRecord) => void
  ) {}

  async start(folderPath: string): Promise<void> {
    await this.stop();
    this.watchedFolder = folderPath;

    this.watcher = chokidar.watch(folderPath, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
      depth: 0,
    });

    this.watcher.on('add', (filePath) => this.handleNewFile(filePath));
    this.watcher.on('error', (err) => watcherLog.error('Watcher error:', err));

    watcherLog.info(`Watching folder: ${folderPath}`);
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.watchedFolder = null;
  }

  getWatchedFolder(): string | null {
    return this.watchedFolder;
  }

  private async handleNewFile(filePath: string): Promise<void> {
    const filename = path.basename(filePath);

    if (IGNORED_PATTERNS.some((p) => p.test(filename))) return;

    const ext = path.extname(filePath).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) return;

    const { db, libraryPath, pdfExtractor } = this.state;
    if (!db || !libraryPath) return;

    try {
      const tempResult = await ingestFileToTemp(filePath, libraryPath);

      const existing = db.getDocumentByHash(tempResult.contentHash);
      if (existing) {
        await discardTemp(libraryPath, tempResult.uuid, tempResult.extension);
        watcherLog.info(`Skipped duplicate: ${filename}`);
        return;
      }

      const storedPath = await finalizeIngest(libraryPath, tempResult.uuid, tempResult.extension);

      const doc = db.insertDocument({
        id: tempResult.uuid,
        original_filename: filename,
        stored_path: storedPath,
        mime_type: tempResult.mimeType,
        size_bytes: tempResult.sizeBytes,
        added_at: new Date().toISOString(),
        source: 'watched_folder',
        source_path: filePath,
        category: null,
        content_hash: tempResult.contentHash,
        extracted_text: null,
      });

      if (tempResult.mimeType === 'application/pdf' && pdfExtractor) {
        const absPath = getAbsolutePath(libraryPath, storedPath);
        pdfExtractor.queueExtraction(absPath, doc.id);
      }

      this.onFileIngested(doc);
      watcherLog.info(`Ingested watched file: ${filename}`);
    } catch (err) {
      watcherLog.error(`Failed to ingest watched file ${filename}:`, err);
    }
  }
}
