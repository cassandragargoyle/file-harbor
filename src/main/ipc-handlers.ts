import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import path from 'node:path';

import { IPC_CHANNELS } from './ipc-channels';
import type { DatabaseService } from './services/database';
import type { PdfExtractor } from './services/pdf-extractor';
import type { WatcherService } from './services/watcher-service';
import {
  ingestFileToTemp,
  finalizeIngest,
  discardTemp,
  deleteStoredFile,
  exportFile,
  getAbsolutePath,
} from './services/file-service';
import {
  initializeLibrary,
  validateLibrary,
  getDefaultLibraryPath,
} from './lib/library-manager';
import { loadSettings, updateSettings } from './lib/settings';
import { ACCEPTED_EXTENSIONS } from '../shared/constants';
import type { Category, DocumentSource, IngestResult } from '../shared/types';
import { ipcLog } from './lib/logger';

interface AppState {
  db: DatabaseService | null;
  libraryPath: string | null;
  pdfExtractor: PdfExtractor | null;
  watcher: WatcherService | null;
}

export function registerIpcHandlers(
  state: AppState,
  onLibraryInitialized: (libraryPath: string) => void
): void {
  // ── Library ───────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.LIBRARY_CHOOSE_PATH, async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Choose Library Location',
        defaultPath: getDefaultLibraryPath(),
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    } catch (err) {
      ipcLog.error('LIBRARY_CHOOSE_PATH failed:', err);
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.LIBRARY_INITIALIZE, async (_event, libraryPath: string) => {
    try {
      initializeLibrary(libraryPath);
      updateSettings({ libraryPath });
      onLibraryInitialized(libraryPath);
      return { success: true, path: libraryPath };
    } catch (err) {
      ipcLog.error('LIBRARY_INITIALIZE failed:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LIBRARY_GET_INFO, () => {
    try {
      if (!state.db || !state.libraryPath) return null;
      return state.db.getLibraryStats(state.libraryPath);
    } catch (err) {
      ipcLog.error('LIBRARY_GET_INFO failed:', err);
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.LIBRARY_OPEN_FOLDER, () => {
    try {
      if (state.libraryPath) {
        shell.openPath(state.libraryPath);
      }
    } catch (err) {
      ipcLog.error('LIBRARY_OPEN_FOLDER failed:', err);
    }
  });

  // ── Documents ─────────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_INGEST_FILES,
    async (_event, filePaths: string[], source: DocumentSource = 'dragdrop') => {
      if (!state.db || !state.libraryPath) {
        return filePaths.map((p) => ({
          path: p,
          status: 'error' as const,
          error: 'No library configured',
        }));
      }

      const results: IngestResult[] = [];

      for (const filePath of filePaths) {
        try {
          const ext = path.extname(filePath).toLowerCase();
          if (!ACCEPTED_EXTENSIONS.includes(ext)) {
            results.push({ path: filePath, status: 'error', error: `Unsupported file type: ${ext}` });
            continue;
          }

          // Step 1: Stream to temp + hash
          const tempResult = await ingestFileToTemp(filePath, state.libraryPath);

          // Step 2: Check for duplicate
          const existing = state.db.getDocumentByHash(tempResult.contentHash);
          if (existing) {
            await discardTemp(state.libraryPath, tempResult.uuid, tempResult.extension);
            results.push({
              path: filePath,
              status: 'duplicate',
              existingId: existing.id,
            });
            continue;
          }

          // Step 3: Finalize (rename temp to permanent)
          const storedPath = await finalizeIngest(
            state.libraryPath,
            tempResult.uuid,
            tempResult.extension
          );

          // Step 4: Create DB record
          const doc = state.db.insertDocument({
            id: tempResult.uuid,
            original_filename: path.basename(filePath),
            stored_path: storedPath,
            mime_type: tempResult.mimeType,
            size_bytes: tempResult.sizeBytes,
            added_at: new Date().toISOString(),
            source,
            source_path: filePath,
            category: null,
            content_hash: tempResult.contentHash,
            extracted_text: null,
          });

          results.push({ path: filePath, status: 'success', documentId: doc.id });

          // Step 5: Queue PDF text extraction (non-blocking)
          if (tempResult.mimeType === 'application/pdf' && state.pdfExtractor) {
            const absPath = getAbsolutePath(state.libraryPath, storedPath);
            state.pdfExtractor.queueExtraction(absPath, doc.id);
          }
        } catch (err) {
          ipcLog.error(`Failed to ingest ${filePath}:`, err);
          results.push({
            path: filePath,
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return results;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_GET_BY_CATEGORY,
    (_event, category: Category | null) => {
      try {
        if (!state.db) return [];
        return state.db.getDocumentsByCategory(category);
      } catch (err) {
        ipcLog.error('DOCUMENTS_GET_BY_CATEGORY failed:', err);
        return [];
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_UPDATE_CATEGORY,
    (_event, id: string, category: Category | null) => {
      try {
        if (!state.db) return;
        state.db.updateDocumentCategory(id, category);
      } catch (err) {
        ipcLog.error('DOCUMENTS_UPDATE_CATEGORY failed:', err);
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_DELETE, async (_event, id: string) => {
    try {
      if (!state.db || !state.libraryPath) return;
      const doc = state.db.getDocument(id);
      if (doc) {
        await deleteStoredFile(state.libraryPath, doc.stored_path);
        state.db.deleteDocument(id);
      }
    } catch (err) {
      ipcLog.error('DOCUMENTS_DELETE failed:', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_SEARCH, (_event, query: string) => {
    try {
      if (!state.db) return [];
      return state.db.searchDocuments(query);
    } catch (err) {
      ipcLog.error('DOCUMENTS_SEARCH failed:', err);
      return [];
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_GET_FILE_PATH, (_event, id: string) => {
    try {
      if (!state.db || !state.libraryPath) return null;
      const doc = state.db.getDocument(id);
      if (!doc) return null;
      return getAbsolutePath(state.libraryPath, doc.stored_path);
    } catch (err) {
      ipcLog.error('DOCUMENTS_GET_FILE_PATH failed:', err);
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_EXPORT, async (_event, id: string) => {
    try {
      if (!state.db || !state.libraryPath) return false;
      const doc = state.db.getDocument(id);
      if (!doc) return false;

      const result = await dialog.showSaveDialog({
        title: 'Export Document',
        defaultPath: doc.original_filename,
      });
      if (result.canceled || !result.filePath) return false;

      await exportFile(state.libraryPath, doc.stored_path, result.filePath);
      return true;
    } catch (err) {
      ipcLog.error('DOCUMENTS_EXPORT failed:', err);
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_REVEAL_IN_FINDER, (_event, id: string) => {
    try {
      if (!state.db || !state.libraryPath) return;
      const doc = state.db.getDocument(id);
      if (doc) {
        const absPath = getAbsolutePath(state.libraryPath, doc.stored_path);
        shell.showItemInFolder(absPath);
      }
    } catch (err) {
      ipcLog.error('DOCUMENTS_REVEAL_IN_FINDER failed:', err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_GET_COUNTS, () => {
    try {
      if (!state.db) return null;
      return state.db.getDocumentCounts();
    } catch (err) {
      ipcLog.error('DOCUMENTS_GET_COUNTS failed:', err);
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_OPEN_FILE_PICKER, async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Import Files',
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: 'Documents',
            extensions: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'md', 'docx'],
          },
        ],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths;
    } catch (err) {
      ipcLog.error('DOCUMENTS_OPEN_FILE_PICKER failed:', err);
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_GET_PROTOCOL_URL, (_event, id: string) => {
    try {
      if (!state.db) return null;
      const doc = state.db.getDocument(id);
      if (!doc) return null;
      return `file-harbor://${doc.stored_path}`;
    } catch (err) {
      ipcLog.error('DOCUMENTS_GET_PROTOCOL_URL failed:', err);
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_OPEN_EXTERNALLY, (_event, id: string) => {
    try {
      if (!state.db || !state.libraryPath) return;
      const doc = state.db.getDocument(id);
      if (doc) {
        const absPath = getAbsolutePath(state.libraryPath, doc.stored_path);
        shell.openPath(absPath);
      }
    } catch (err) {
      ipcLog.error('DOCUMENTS_OPEN_EXTERNALLY failed:', err);
    }
  });

  // ── Watcher ─────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.WATCHER_SET_FOLDER, async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Choose Watched Folder',
        properties: ['openDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) return null;

      const folderPath = result.filePaths[0];
      if (state.watcher) {
        await state.watcher.start(folderPath);
      }
      updateSettings({ watchedFolderPath: folderPath });
      return folderPath;
    } catch (err) {
      ipcLog.error('WATCHER_SET_FOLDER failed:', err);
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.WATCHER_GET_FOLDER, () => {
    try {
      return state.watcher?.getWatchedFolder() ?? null;
    } catch (err) {
      ipcLog.error('WATCHER_GET_FOLDER failed:', err);
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.WATCHER_CLEAR_FOLDER, async () => {
    try {
      if (state.watcher) {
        await state.watcher.stop();
      }
      updateSettings({ watchedFolderPath: undefined });
    } catch (err) {
      ipcLog.error('WATCHER_CLEAR_FOLDER failed:', err);
    }
  });

  // ── Settings ──────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    try {
      return loadSettings();
    } catch (err) {
      ipcLog.error('SETTINGS_GET failed:', err);
      return {};
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE_LAST_VIEW, (_event, view: string) => {
    try {
      updateSettings({ lastView: view });
    } catch (err) {
      ipcLog.error('SETTINGS_SAVE_LAST_VIEW failed:', err);
    }
  });
}
