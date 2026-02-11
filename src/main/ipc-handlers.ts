import { app, ipcMain, dialog, shell, BrowserWindow } from 'electron';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

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
  exportAllFiles,
  getAbsolutePath,
  resolveFilePaths,
} from './services/file-service';
import {
  initializeLibrary,
  validateLibrary,
  getDefaultLibraryPath,
} from './lib/library-manager';
import { createBackup, validateBackup, restoreBackup } from './services/backup-service';
import { loadSettings, saveSettings, updateWorkspace, getOllamaSettings, updateOllamaSettings } from './lib/settings';
import type { OllamaSettings } from './lib/settings';
import { ACCEPTED_EXTENSIONS, MAX_EXTRACTED_TEXT_LENGTH } from '../shared/constants';
import type { Category, DocumentSource, IngestResult, Workspace } from '../shared/types';
import { suggestCategory } from './services/keyword-matcher';
import { suggestFilename } from './services/filename-suggester';
import { checkOllamaStatus } from './services/ollama-service';
import { suggestWithLlm } from './services/llm-suggester';
import { ipcLog, ollamaLog } from './lib/logger';

interface AppState {
  db: DatabaseService | null;
  libraryPath: string | null;
  pdfExtractor: PdfExtractor | null;
  watcher: WatcherService | null;
  activeWorkspaceId: string | null;
}

interface LibraryCallbacks {
  initializeServices: (workspace: Workspace) => void;
  teardownServices: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<boolean>;
}

export function runSuggestions(state: AppState, documentId: string): void {
  if (!state.db) return;
  const doc = state.db.getDocument(documentId);
  if (!doc || doc.category !== null) return; // only suggest for inbox docs

  const categorySuggestion = suggestCategory(doc.extracted_text, doc.original_filename);
  const filenameSuggestion = suggestFilename(
    doc.extracted_text,
    doc.original_filename,
    categorySuggestion?.category ?? null
  );

  if (categorySuggestion || filenameSuggestion) {
    state.db.updateSuggestion(
      documentId,
      categorySuggestion?.category ?? null,
      categorySuggestion?.confidence ?? null,
      categorySuggestion ? 'keywords' : null,
      filenameSuggestion
    );
  }

  // Phase 2: Confidence-based LLM routing
  const ollamaSettings = getOllamaSettings();
  const keywordConfidence = categorySuggestion?.confidence ?? 0;
  if (ollamaSettings.ollamaEnabled && keywordConfidence < ollamaSettings.suggestionConfidenceThreshold) {
    // Queue async LLM suggestion — don't block the import flow
    runLlmSuggestion(state, documentId).catch((err) => {
      ollamaLog.warn(`LLM suggestion failed for ${documentId}:`, err);
    });
  }
}

async function runLlmSuggestion(state: AppState, documentId: string): Promise<void> {
  if (!state.db) return;
  const doc = state.db.getDocument(documentId);
  if (!doc || doc.category !== null) return;

  const result = await suggestWithLlm(doc.extracted_text, doc.original_filename);
  if (!result) return;

  // Re-check: document may have been filed while LLM was thinking
  const current = state.db.getDocument(documentId);
  if (!current || current.category !== null) return;

  state.db.updateSuggestion(
    documentId,
    result.category,
    result.confidence,
    result.source,
    result.filename
  );

  // Notify all renderer windows that this document's suggestion was updated
  BrowserWindow.getAllWindows().forEach((w) => {
    w.webContents.send(IPC_CHANNELS.DOCUMENTS_SUGGESTION_UPDATED, documentId);
  });
}

export function registerIpcHandlers(
  state: AppState,
  callbacks: LibraryCallbacks
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
      const id = randomUUID();
      const workspace: Workspace = { id, name: 'Default', libraryPath };
      const settings = loadSettings();
      settings.workspaces.push(workspace);
      settings.activeWorkspaceId = id;
      saveSettings(settings);
      callbacks.initializeServices(workspace);
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
        return {
          results: filePaths.map((p) => ({
            path: p,
            status: 'error' as const,
            error: 'No library configured',
          })),
          skippedCount: 0,
        };
      }

      // Resolve any directories into individual file paths
      const { filePaths: resolvedPaths, skippedCount } = await resolveFilePaths(filePaths);

      const results: IngestResult[] = [];

      for (const filePath of resolvedPaths) {
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

          // Step 4: Extract text for plain-text files
          let extractedText: string | null = null;
          if (tempResult.mimeType === 'text/plain' || tempResult.mimeType === 'text/markdown') {
            const absPath = getAbsolutePath(state.libraryPath, storedPath);
            const raw = await fsp.readFile(absPath, 'utf-8');
            extractedText = raw.slice(0, MAX_EXTRACTED_TEXT_LENGTH);
          }

          // Step 5: Create DB record
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
            extracted_text: extractedText,
            suggested_category: null,
            suggestion_confidence: null,
            suggestion_source: null,
            suggested_filename: null,
            suggestion_outcome: null,
          });

          results.push({ path: filePath, status: 'success', documentId: doc.id });

          // Step 6: Queue PDF text extraction (non-blocking)
          if (tempResult.mimeType === 'application/pdf' && state.pdfExtractor) {
            const absPath = getAbsolutePath(state.libraryPath, storedPath);
            state.pdfExtractor.queueExtraction(absPath, doc.id);
          }

          // Step 7: Run suggestions (text already available for .txt/.md, filename-only for PDFs)
          runSuggestions(state, doc.id);
        } catch (err) {
          ipcLog.error(`Failed to ingest ${filePath}:`, err);
          results.push({
            path: filePath,
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return { results, skippedCount };
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

  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_RENAME,
    (_event, id: string, newFilename: string) => {
      try {
        if (!state.db) return;
        state.db.renameDocument(id, newFilename);
      } catch (err) {
        ipcLog.error('DOCUMENTS_RENAME failed:', err);
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

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_OPEN_FOLDER_PICKER, async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Import Folder',
        properties: ['openDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths;
    } catch (err) {
      ipcLog.error('DOCUMENTS_OPEN_FOLDER_PICKER failed:', err);
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_GET_PROTOCOL_URL, (_event, id: string) => {
    try {
      if (!state.db) return null;
      const doc = state.db.getDocument(id);
      if (!doc) return null;
      return `file-harbor:///${doc.stored_path}`;
    } catch (err) {
      ipcLog.error('DOCUMENTS_GET_PROTOCOL_URL failed:', err);
      return null;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_READ_FILE, async (_event, id: string) => {
    try {
      if (!state.db || !state.libraryPath) return null;
      const doc = state.db.getDocument(id);
      if (!doc) return null;
      const filePath = path.join(state.libraryPath, doc.stored_path);
      const buffer = await fsp.readFile(filePath);
      return buffer;
    } catch (err) {
      ipcLog.error('DOCUMENTS_READ_FILE failed:', err);
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

  // ── Suggestions ──────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_GET_SUGGESTION, (_event, id: string) => {
    try {
      if (!state.db) return null;
      const doc = state.db.getDocument(id);
      if (!doc) return null;
      return {
        suggested_category: doc.suggested_category,
        suggestion_confidence: doc.suggestion_confidence,
        suggestion_source: doc.suggestion_source,
        suggested_filename: doc.suggested_filename,
      };
    } catch (err) {
      ipcLog.error('DOCUMENTS_GET_SUGGESTION failed:', err);
      return null;
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_ACCEPT_SUGGESTION,
    (_event, id: string) => {
      try {
        if (!state.db) return;
        const doc = state.db.getDocument(id);
        if (!doc?.suggested_category) return;
        state.db.updateDocumentCategory(id, doc.suggested_category);
        state.db.clearSuggestion(id);
        state.db.setSuggestionOutcome(id, 'accepted');
      } catch (err) {
        ipcLog.error('DOCUMENTS_ACCEPT_SUGGESTION failed:', err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_DISMISS_SUGGESTION,
    (_event, id: string) => {
      try {
        if (!state.db) return;
        state.db.clearSuggestion(id);
        state.db.setSuggestionOutcome(id, 'dismissed');
      } catch (err) {
        ipcLog.error('DOCUMENTS_DISMISS_SUGGESTION failed:', err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_ACCEPT_RENAME_SUGGESTION,
    (_event, id: string) => {
      try {
        if (!state.db) return;
        const doc = state.db.getDocument(id);
        if (!doc?.suggested_filename) return;
        state.db.renameDocument(id, doc.suggested_filename);
        state.db.updateSuggestion(
          id,
          doc.suggested_category,
          doc.suggestion_confidence,
          doc.suggestion_source as 'keywords' | 'ollama' | null,
          null // clear the filename suggestion
        );
      } catch (err) {
        ipcLog.error('DOCUMENTS_ACCEPT_RENAME_SUGGESTION failed:', err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_SUGGEST_FILENAME,
    async (_event, id: string) => {
      try {
        if (!state.db) return null;
        const doc = state.db.getDocument(id);
        if (!doc) return null;

        // Try LLM first if enabled
        const ollamaSettings = getOllamaSettings();
        if (ollamaSettings.ollamaEnabled) {
          const llmResult = await suggestWithLlm(doc.extracted_text, doc.original_filename);
          if (llmResult?.filename) return llmResult.filename;
        }

        // Fall back to keyword-based filename suggestion
        const categorySuggestion = suggestCategory(doc.extracted_text, doc.original_filename);
        const result = suggestFilename(
          doc.extracted_text,
          doc.original_filename,
          categorySuggestion?.category ?? doc.suggested_category ?? doc.category
        );
        return result;
      } catch (err) {
        ipcLog.error('DOCUMENTS_SUGGEST_FILENAME failed:', err);
        return null;
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_GET_WITH_SUGGESTIONS, () => {
    try {
      if (!state.db) return [];
      return state.db.getDocumentsWithSuggestions();
    } catch (err) {
      ipcLog.error('DOCUMENTS_GET_WITH_SUGGESTIONS failed:', err);
      return [];
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.DOCUMENTS_BATCH_ACCEPT_SUGGESTIONS,
    (_event, ids: string[]) => {
      try {
        if (!state.db) return { accepted: 0 };
        let accepted = 0;
        for (const id of ids) {
          const doc = state.db.getDocument(id);
          if (!doc?.suggested_category) continue;
          state.db.updateDocumentCategory(id, doc.suggested_category);
          state.db.clearSuggestion(id);
          state.db.setSuggestionOutcome(id, 'accepted');
          accepted++;
        }
        return { accepted };
      } catch (err) {
        ipcLog.error('DOCUMENTS_BATCH_ACCEPT_SUGGESTIONS failed:', err);
        return { accepted: 0 };
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_GET_SUGGESTION_STATS, () => {
    try {
      if (!state.db) return null;
      return state.db.getSuggestionStats();
    } catch (err) {
      ipcLog.error('DOCUMENTS_GET_SUGGESTION_STATS failed:', err);
      return null;
    }
  });

  // ── Workspaces ──────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LIST, () => {
    try {
      return loadSettings().workspaces;
    } catch (err) {
      ipcLog.error('WORKSPACE_LIST failed:', err);
      return [];
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_ACTIVE, () => {
    return state.activeWorkspaceId;
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_ADD, async (_event, name: string, libraryPath: string) => {
    try {
      initializeLibrary(libraryPath);
      const id = randomUUID();
      const workspace: Workspace = { id, name, libraryPath };
      const settings = loadSettings();
      settings.workspaces.push(workspace);
      settings.activeWorkspaceId = id;
      saveSettings(settings);
      await callbacks.teardownServices();
      callbacks.initializeServices(workspace);
      return { success: true, workspace };
    } catch (err) {
      ipcLog.error('WORKSPACE_ADD failed:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_RENAME, (_event, workspaceId: string, newName: string) => {
    try {
      updateWorkspace(workspaceId, { name: newName });
      return true;
    } catch (err) {
      ipcLog.error('WORKSPACE_RENAME failed:', err);
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_REMOVE, async (_event, workspaceId: string) => {
    try {
      const settings = loadSettings();
      if (settings.workspaces.length <= 1) {
        return { success: false, error: 'Cannot remove the last workspace' };
      }
      settings.workspaces = settings.workspaces.filter((w) => w.id !== workspaceId);
      if (settings.activeWorkspaceId === workspaceId) {
        settings.activeWorkspaceId = settings.workspaces[0].id;
        saveSettings(settings);
        await callbacks.switchWorkspace(settings.activeWorkspaceId);
      } else {
        saveSettings(settings);
      }
      return { success: true };
    } catch (err) {
      ipcLog.error('WORKSPACE_REMOVE failed:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SWITCH, async (_event, workspaceId: string) => {
    try {
      const success = await callbacks.switchWorkspace(workspaceId);
      return { success };
    } catch (err) {
      ipcLog.error('WORKSPACE_SWITCH failed:', err);
      return { success: false };
    }
  });

  // ── Backup & Restore ────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_BACKUP, async () => {
    try {
      if (!state.db || !state.libraryPath) {
        return { success: false, error: 'No workspace open' };
      }

      // Get workspace name for folder naming
      const settings = loadSettings();
      const workspace = settings.workspaces.find((w) => w.id === state.activeWorkspaceId);
      const name = workspace?.name ?? 'workspace';
      const date = new Date().toISOString().slice(0, 10);
      const folderName = `file-harbor-backup-${name}-${date}`;

      const result = await dialog.showOpenDialog({
        title: 'Choose Backup Destination',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false };
      }

      const destinationPath = path.join(result.filePaths[0], folderName);

      // Flush WAL before copying
      state.db.walCheckpoint();

      const stats = state.db.getLibraryStats(state.libraryPath);
      const meta = await createBackup(
        state.libraryPath,
        destinationPath,
        app.getVersion(),
        stats.documentCount,
        stats.totalSizeBytes
      );

      return { success: true, path: destinationPath, meta };
    } catch (err) {
      ipcLog.error('WORKSPACE_BACKUP failed:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_RESTORE, async () => {
    try {
      if (!state.db || !state.libraryPath) {
        return { success: false, error: 'No workspace open' };
      }

      const result = await dialog.showOpenDialog({
        title: 'Select Backup Folder',
        properties: ['openDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false };
      }

      const backupPath = result.filePaths[0];

      let meta;
      try {
        meta = await validateBackup(backupPath);
      } catch {
        return { success: false, error: 'Not a valid File Harbor backup folder' };
      }

      // Confirmation dialog
      const confirm = await dialog.showMessageBox({
        type: 'warning',
        title: 'Restore from Backup',
        message: 'Restore from backup?',
        detail: `This will replace all documents in the current workspace with the backup from ${new Date(meta.createdAt).toLocaleDateString()} (${meta.documentCount} documents). This cannot be undone.`,
        buttons: ['Cancel', 'Restore'],
        defaultId: 0,
        cancelId: 0,
      });

      if (confirm.response === 0) {
        return { success: false };
      }

      const libraryPath = state.libraryPath;

      // Teardown services (releases SQLite lock)
      await callbacks.teardownServices();

      await restoreBackup(backupPath, libraryPath);

      // Re-initialize services
      const settings = loadSettings();
      const workspace = settings.workspaces.find((w) => w.libraryPath === libraryPath);
      if (workspace) {
        callbacks.initializeServices(workspace);
      }

      // Notify renderer to reload
      BrowserWindow.getAllWindows().forEach((w) => {
        w.webContents.send(IPC_CHANNELS.WORKSPACE_SWITCHED, state.activeWorkspaceId);
      });

      return { success: true, meta };
    } catch (err) {
      ipcLog.error('WORKSPACE_RESTORE failed:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ── Export All ──────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_EXPORT_ALL, async () => {
    try {
      if (!state.db || !state.libraryPath) {
        return { success: false, error: 'No workspace open' };
      }

      const documents = state.db.getAllDocuments();
      if (documents.length === 0) {
        return { success: false, error: 'No documents to export' };
      }

      const result = await dialog.showOpenDialog({
        title: 'Choose Export Destination',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false };
      }

      const date = new Date().toISOString().slice(0, 10);
      const destinationRoot = path.join(result.filePaths[0], `Export_${date}`);

      const settings = loadSettings();
      const workspace = settings.workspaces.find((w) => w.id === state.activeWorkspaceId);
      const workspaceName = workspace?.name ?? 'workspace';

      return await exportAllFiles(
        state.libraryPath,
        documents,
        destinationRoot,
        workspaceName,
        app.getVersion()
      );
    } catch (err) {
      ipcLog.error('DOCUMENTS_EXPORT_ALL failed:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
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
      if (state.activeWorkspaceId) {
        updateWorkspace(state.activeWorkspaceId, { watchedFolderPath: folderPath });
      }
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
      if (state.activeWorkspaceId) {
        updateWorkspace(state.activeWorkspaceId, { watchedFolderPath: undefined });
      }
    } catch (err) {
      ipcLog.error('WATCHER_CLEAR_FOLDER failed:', err);
    }
  });

  // ── Ollama ──────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.OLLAMA_CHECK_STATUS, async (_event, baseUrl?: string) => {
    try {
      return await checkOllamaStatus(baseUrl);
    } catch (err) {
      ipcLog.error('OLLAMA_CHECK_STATUS failed:', err);
      return { reachable: false, models: [] };
    }
  });

  ipcMain.handle(IPC_CHANNELS.OLLAMA_GET_SETTINGS, () => {
    try {
      return getOllamaSettings();
    } catch (err) {
      ipcLog.error('OLLAMA_GET_SETTINGS failed:', err);
      return null;
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.OLLAMA_UPDATE_SETTINGS,
    (_event, partial: Partial<OllamaSettings>) => {
      try {
        updateOllamaSettings(partial);
        return getOllamaSettings();
      } catch (err) {
        ipcLog.error('OLLAMA_UPDATE_SETTINGS failed:', err);
        return null;
      }
    }
  );

  // ── Settings ──────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    try {
      return loadSettings();
    } catch (err) {
      ipcLog.error('SETTINGS_GET failed:', err);
      return { version: 2, workspaces: [], activeWorkspaceId: '' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE_LAST_VIEW, (_event, view: string) => {
    try {
      const settings = loadSettings();
      settings.lastView = view;
      saveSettings(settings);
    } catch (err) {
      ipcLog.error('SETTINGS_SAVE_LAST_VIEW failed:', err);
    }
  });
}
