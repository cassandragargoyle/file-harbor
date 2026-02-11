import { contextBridge, ipcRenderer, webUtils } from 'electron';

const IPC = {
  LIBRARY_CHOOSE_PATH: 'library:choose-path',
  LIBRARY_INITIALIZE: 'library:initialize',
  LIBRARY_GET_INFO: 'library:get-info',
  LIBRARY_OPEN_FOLDER: 'library:open-folder',
  DOCUMENTS_INGEST_FILES: 'documents:ingest-files',
  DOCUMENTS_GET_BY_CATEGORY: 'documents:get-by-category',
  DOCUMENTS_UPDATE_CATEGORY: 'documents:update-category',
  DOCUMENTS_RENAME: 'documents:rename',
  DOCUMENTS_DELETE: 'documents:delete',
  DOCUMENTS_SEARCH: 'documents:search',
  DOCUMENTS_GET_FILE_PATH: 'documents:get-file-path',
  DOCUMENTS_EXPORT: 'documents:export',
  DOCUMENTS_EXPORT_ALL: 'documents:export-all',
  DOCUMENTS_REVEAL_IN_FINDER: 'documents:reveal-in-finder',
  DOCUMENTS_GET_COUNTS: 'documents:get-counts',
  DOCUMENTS_OPEN_FILE_PICKER: 'documents:open-file-picker',
  DOCUMENTS_OPEN_FOLDER_PICKER: 'documents:open-folder-picker',
  DOCUMENTS_GET_PROTOCOL_URL: 'documents:get-protocol-url',
  DOCUMENTS_READ_FILE: 'documents:read-file',
  DOCUMENTS_OPEN_EXTERNALLY: 'documents:open-externally',
  DOCUMENTS_GET_SUGGESTION: 'documents:get-suggestion',
  DOCUMENTS_ACCEPT_SUGGESTION: 'documents:accept-suggestion',
  DOCUMENTS_DISMISS_SUGGESTION: 'documents:dismiss-suggestion',
  DOCUMENTS_ACCEPT_RENAME_SUGGESTION: 'documents:accept-rename-suggestion',
  DOCUMENTS_SUGGEST_FILENAME: 'documents:suggest-filename',
  DOCUMENTS_GET_WITH_SUGGESTIONS: 'documents:get-with-suggestions',
  DOCUMENTS_BATCH_ACCEPT_SUGGESTIONS: 'documents:batch-accept-suggestions',
  DOCUMENTS_GET_SUGGESTION_STATS: 'documents:get-suggestion-stats',
  WATCHER_SET_FOLDER: 'watcher:set-folder',
  WATCHER_GET_FOLDER: 'watcher:get-folder',
  WATCHER_CLEAR_FOLDER: 'watcher:clear-folder',
  WATCHER_FILE_INGESTED: 'watcher:file-ingested',
  WATCHER_ERROR: 'watcher:error',
  MENU_IMPORT_FILES: 'menu:import-files',
  MENU_IMPORT_FOLDER: 'menu:import-folder',
  MENU_BACKUP: 'menu:backup',
  MENU_RESTORE: 'menu:restore',
  MENU_EXPORT_ALL: 'menu:export-all',
  WORKSPACE_BACKUP: 'workspace:backup',
  WORKSPACE_RESTORE: 'workspace:restore',
  WORKSPACE_LIST: 'workspace:list',
  WORKSPACE_ADD: 'workspace:add',
  WORKSPACE_RENAME: 'workspace:rename',
  WORKSPACE_REMOVE: 'workspace:remove',
  WORKSPACE_SWITCH: 'workspace:switch',
  WORKSPACE_GET_ACTIVE: 'workspace:get-active',
  WORKSPACE_SWITCHED: 'workspace:switched',
  OLLAMA_CHECK_STATUS: 'ollama:check-status',
  OLLAMA_GET_SETTINGS: 'ollama:get-settings',
  OLLAMA_UPDATE_SETTINGS: 'ollama:update-settings',
  DOCUMENTS_SUGGESTION_UPDATED: 'documents:suggestion-updated',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE_LAST_VIEW: 'settings:save-last-view',
} as const;

const electronAPI = {
  // Library
  chooseLibraryPath: () => ipcRenderer.invoke(IPC.LIBRARY_CHOOSE_PATH),
  initializeLibrary: (path: string) => ipcRenderer.invoke(IPC.LIBRARY_INITIALIZE, path),
  getLibraryInfo: () => ipcRenderer.invoke(IPC.LIBRARY_GET_INFO),
  openLibraryFolder: () => ipcRenderer.invoke(IPC.LIBRARY_OPEN_FOLDER),

  // Documents
  ingestFiles: (paths: string[], source?: string) =>
    ipcRenderer.invoke(IPC.DOCUMENTS_INGEST_FILES, paths, source),
  getDocumentsByCategory: (category: string | null) =>
    ipcRenderer.invoke(IPC.DOCUMENTS_GET_BY_CATEGORY, category),
  updateDocumentCategory: (id: string, category: string) =>
    ipcRenderer.invoke(IPC.DOCUMENTS_UPDATE_CATEGORY, id, category),
  renameDocument: (id: string, newFilename: string) =>
    ipcRenderer.invoke(IPC.DOCUMENTS_RENAME, id, newFilename),
  deleteDocument: (id: string) => ipcRenderer.invoke(IPC.DOCUMENTS_DELETE, id),
  searchDocuments: (query: string) => ipcRenderer.invoke(IPC.DOCUMENTS_SEARCH, query),
  getDocumentFilePath: (id: string) => ipcRenderer.invoke(IPC.DOCUMENTS_GET_FILE_PATH, id),
  exportDocument: (id: string) => ipcRenderer.invoke(IPC.DOCUMENTS_EXPORT, id),
  exportAllDocuments: () => ipcRenderer.invoke(IPC.DOCUMENTS_EXPORT_ALL),
  revealInFinder: (id: string) => ipcRenderer.invoke(IPC.DOCUMENTS_REVEAL_IN_FINDER, id),
  getDocumentCounts: () => ipcRenderer.invoke(IPC.DOCUMENTS_GET_COUNTS),
  openFilePicker: () => ipcRenderer.invoke(IPC.DOCUMENTS_OPEN_FILE_PICKER),
  openFolderPicker: () => ipcRenderer.invoke(IPC.DOCUMENTS_OPEN_FOLDER_PICKER),
  getDocumentProtocolUrl: (id: string) => ipcRenderer.invoke(IPC.DOCUMENTS_GET_PROTOCOL_URL, id),
  readDocumentFile: (id: string) => ipcRenderer.invoke(IPC.DOCUMENTS_READ_FILE, id),
  openDocumentExternally: (id: string) => ipcRenderer.invoke(IPC.DOCUMENTS_OPEN_EXTERNALLY, id),

  // Suggestions
  getDocumentSuggestion: (id: string) => ipcRenderer.invoke(IPC.DOCUMENTS_GET_SUGGESTION, id),
  acceptSuggestion: (id: string) => ipcRenderer.invoke(IPC.DOCUMENTS_ACCEPT_SUGGESTION, id),
  dismissSuggestion: (id: string) => ipcRenderer.invoke(IPC.DOCUMENTS_DISMISS_SUGGESTION, id),
  acceptRenameSuggestion: (id: string) =>
    ipcRenderer.invoke(IPC.DOCUMENTS_ACCEPT_RENAME_SUGGESTION, id),
  suggestFilename: (id: string) =>
    ipcRenderer.invoke(IPC.DOCUMENTS_SUGGEST_FILENAME, id),
  getDocumentsWithSuggestions: () =>
    ipcRenderer.invoke(IPC.DOCUMENTS_GET_WITH_SUGGESTIONS),
  batchAcceptSuggestions: (ids: string[]) =>
    ipcRenderer.invoke(IPC.DOCUMENTS_BATCH_ACCEPT_SUGGESTIONS, ids),
  getSuggestionStats: () =>
    ipcRenderer.invoke(IPC.DOCUMENTS_GET_SUGGESTION_STATS),

  // Watcher
  setWatchedFolder: () => ipcRenderer.invoke(IPC.WATCHER_SET_FOLDER),
  getWatchedFolder: () => ipcRenderer.invoke(IPC.WATCHER_GET_FOLDER),
  clearWatchedFolder: () => ipcRenderer.invoke(IPC.WATCHER_CLEAR_FOLDER),

  // Watcher events (return cleanup function)
  onFileIngested: (callback: (doc: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, doc: unknown) => callback(doc);
    ipcRenderer.on(IPC.WATCHER_FILE_INGESTED, handler);
    return () => ipcRenderer.removeListener(IPC.WATCHER_FILE_INGESTED, handler);
  },
  onWatcherError: (callback: (message: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, message: string) => callback(message);
    ipcRenderer.on(IPC.WATCHER_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC.WATCHER_ERROR, handler);
  },

  // Utility
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  // Menu events
  onMenuImportFiles: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.MENU_IMPORT_FILES, handler);
    return () => ipcRenderer.removeListener(IPC.MENU_IMPORT_FILES, handler);
  },
  onMenuImportFolder: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.MENU_IMPORT_FOLDER, handler);
    return () => ipcRenderer.removeListener(IPC.MENU_IMPORT_FOLDER, handler);
  },

  // Backup
  backupWorkspace: () => ipcRenderer.invoke(IPC.WORKSPACE_BACKUP),
  restoreWorkspace: () => ipcRenderer.invoke(IPC.WORKSPACE_RESTORE),
  onMenuBackup: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.MENU_BACKUP, handler);
    return () => ipcRenderer.removeListener(IPC.MENU_BACKUP, handler);
  },
  onMenuRestore: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.MENU_RESTORE, handler);
    return () => ipcRenderer.removeListener(IPC.MENU_RESTORE, handler);
  },
  onMenuExportAll: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.MENU_EXPORT_ALL, handler);
    return () => ipcRenderer.removeListener(IPC.MENU_EXPORT_ALL, handler);
  },

  // Workspaces
  listWorkspaces: () => ipcRenderer.invoke(IPC.WORKSPACE_LIST),
  addWorkspace: (name: string, libraryPath: string) =>
    ipcRenderer.invoke(IPC.WORKSPACE_ADD, name, libraryPath),
  renameWorkspace: (id: string, name: string) =>
    ipcRenderer.invoke(IPC.WORKSPACE_RENAME, id, name),
  removeWorkspace: (id: string) => ipcRenderer.invoke(IPC.WORKSPACE_REMOVE, id),
  switchWorkspace: (id: string) => ipcRenderer.invoke(IPC.WORKSPACE_SWITCH, id),
  getActiveWorkspaceId: () => ipcRenderer.invoke(IPC.WORKSPACE_GET_ACTIVE),
  onWorkspaceSwitched: (callback: (workspaceId: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, id: string) => callback(id);
    ipcRenderer.on(IPC.WORKSPACE_SWITCHED, handler);
    return () => ipcRenderer.removeListener(IPC.WORKSPACE_SWITCHED, handler);
  },

  // Ollama
  checkOllamaStatus: (baseUrl?: string) => ipcRenderer.invoke(IPC.OLLAMA_CHECK_STATUS, baseUrl),
  getOllamaSettings: () => ipcRenderer.invoke(IPC.OLLAMA_GET_SETTINGS),
  updateOllamaSettings: (partial: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.OLLAMA_UPDATE_SETTINGS, partial),

  // Suggestion events (return cleanup function)
  onSuggestionUpdated: (callback: (documentId: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, documentId: string) => callback(documentId);
    ipcRenderer.on(IPC.DOCUMENTS_SUGGESTION_UPDATED, handler);
    return () => ipcRenderer.removeListener(IPC.DOCUMENTS_SUGGESTION_UPDATED, handler);
  },

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
  saveLastView: (view: string) => ipcRenderer.invoke(IPC.SETTINGS_SAVE_LAST_VIEW, view),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
