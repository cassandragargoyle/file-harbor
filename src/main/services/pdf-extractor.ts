import { Worker } from 'node:worker_threads';
import path from 'node:path';
import fs from 'node:fs';

import { MAX_PDF_SIZE_FOR_EXTRACTION } from '../../shared/constants';
import { fileLog } from '../lib/logger';
import type { DatabaseService } from './database';

interface ExtractionResult {
  documentId: string;
  text: string | null;
  error?: string;
}

export class PdfExtractor {
  private worker: Worker | null = null;
  private db: DatabaseService;
  private onTextExtracted?: (documentId: string) => void;

  constructor(db: DatabaseService, onTextExtracted?: (documentId: string) => void) {
    this.db = db;
    this.onTextExtracted = onTextExtracted;
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      const workerPath = path.join(__dirname, 'pdf-worker.js');
      this.worker = new Worker(workerPath);

      this.worker.on('message', (result: ExtractionResult) => {
        if (result.error) {
          fileLog.warn(
            `PDF extraction failed for ${result.documentId}: ${result.error}`
          );
        } else if (result.text) {
          fileLog.info(
            `Extracted ${result.text.length} chars from ${result.documentId}`
          );
        }

        try {
          this.db.updateExtractedText(result.documentId, result.text);
          this.onTextExtracted?.(result.documentId);
        } catch (err) {
          fileLog.error(`Failed to save extracted text for ${result.documentId}`, err);
        }
      });

      this.worker.on('error', (err) => {
        fileLog.error('PDF worker error:', err);
        this.worker = null;
      });

      this.worker.on('exit', (code) => {
        if (code !== 0) {
          fileLog.warn(`PDF worker exited with code ${code}`);
        }
        this.worker = null;
      });
    }
    return this.worker;
  }

  queueExtraction(filePath: string, documentId: string): void {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > MAX_PDF_SIZE_FOR_EXTRACTION) {
        fileLog.warn(
          `Skipping text extraction for ${documentId}: file exceeds 50MB (${stats.size} bytes)`
        );
        return;
      }
    } catch {
      return;
    }

    const worker = this.ensureWorker();
    worker.postMessage({ filePath, documentId });
  }

  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
