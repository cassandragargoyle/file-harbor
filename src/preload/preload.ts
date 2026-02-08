import { contextBridge, ipcRenderer } from 'electron';

const IPC = {
  LIBRARY_CHOOSE_PATH: 'library:choose-path',
  LIBRARY_INITIALIZE: 'library:initialize',
  LIBRARY_GET_INFO: 'library:get-info',
  LIBRARY_OPEN_FOLDER: 'library:open-folder',
  DOCUMENTS_INGEST_FILES: 'documents:ingest-files',
  DOCUMENTS_GET_BY_CATEGORY: 'documents:get-by-category',
  DOCUMENTS_UPDATE_CATEGORY: 'documents:update-category',
  DOCUMENTS_DELETE: 'documents:delete',
  DOCUMENTS_SEARCH: 'documents:search',
  DOCUMENTS_GET_FILE_PATH: 'documents:get-file-path',
  DOCUMENTS_EXPORT: 'documents:export',
  DOCUMENTS_REVEAL_IN_FINDER: 'documents:reveal-in-finder',
  DOCUMENTS_GET_COUNTS: 'documents:get-counts',
  WATCHER_SET_FOLDER: 'watcher:set-folder',
  WATCHER_GET_FOLDER: 'watcher:get-folder',
  WATCHER_CLEAR_FOLDER: 'watcher:clear-folder',
  WATCHER_FILE_INGESTED: 'watcher:file-ingested',
  SETTINGS_GET: 'settings:get',
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
  deleteDocument: (id: string) => ipcRenderer.invoke(IPC.DOCUMENTS_DELETE, id),
  searchDocuments: (query: string) => ipcRenderer.invoke(IPC.DOCUMENTS_SEARCH, query),
  getDocumentFilePath: (id: string) => ipcRenderer.invoke(IPC.DOCUMENTS_GET_FILE_PATH, id),
  exportDocument: (id: string) => ipcRenderer.invoke(IPC.DOCUMENTS_EXPORT, id),
  revealInFinder: (id: string) => ipcRenderer.invoke(IPC.DOCUMENTS_REVEAL_IN_FINDER, id),
  getDocumentCounts: () => ipcRenderer.invoke(IPC.DOCUMENTS_GET_COUNTS),

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

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
