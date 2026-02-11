import type {
  DocumentRecord,
  Category,
  DocumentSource,
  IngestResult,
  LibraryInfo,
  SuggestionStats,
  DocumentCounts,
  Workspace,
  BackupResult,
  RestoreResult,
  ExportAllResult,
} from '../../shared/types';

const api = window.electronAPI;

// Library
export const chooseLibraryPath = (): Promise<string | null> => api.chooseLibraryPath();
export const initializeLibrary = (path: string) => api.initializeLibrary(path);
export const getLibraryInfo = (): Promise<LibraryInfo | null> => api.getLibraryInfo();
export const openLibraryFolder = () => api.openLibraryFolder();

// Documents
export const ingestFiles = (paths: string[], source?: DocumentSource): Promise<{ results: IngestResult[]; skippedCount: number }> =>
  api.ingestFiles(paths, source);
export const getDocumentsByCategory = (category: Category | null): Promise<DocumentRecord[]> =>
  api.getDocumentsByCategory(category);
export const updateDocumentCategory = (id: string, category: Category | null) =>
  api.updateDocumentCategory(id, category);
export const renameDocument = (id: string, newFilename: string) =>
  api.renameDocument(id, newFilename);
export const deleteDocument = (id: string) => api.deleteDocument(id);
export const searchDocuments = (query: string): Promise<DocumentRecord[]> =>
  api.searchDocuments(query);
export const getDocumentFilePath = (id: string): Promise<string | null> =>
  api.getDocumentFilePath(id);
export const exportDocument = (id: string): Promise<boolean> => api.exportDocument(id);
export const exportAllDocuments = (): Promise<ExportAllResult> => api.exportAllDocuments();
export const revealInFinder = (id: string) => api.revealInFinder(id);
export const getDocumentCounts = (): Promise<DocumentCounts | null> => api.getDocumentCounts();
export const openFilePicker = (): Promise<string[] | null> => api.openFilePicker();
export const openFolderPicker = (): Promise<string[] | null> => api.openFolderPicker();
export const getDocumentProtocolUrl = (id: string): Promise<string | null> =>
  api.getDocumentProtocolUrl(id);
export const readDocumentFile = (id: string): Promise<ArrayBuffer | null> =>
  api.readDocumentFile(id);
export const openDocumentExternally = (id: string) => api.openDocumentExternally(id);

// Suggestions
export const getDocumentSuggestion = (id: string) => api.getDocumentSuggestion(id);
export const acceptSuggestion = (id: string) => api.acceptSuggestion(id);
export const dismissSuggestion = (id: string) => api.dismissSuggestion(id);
export const acceptRenameSuggestion = (id: string) => api.acceptRenameSuggestion(id);
export const suggestFilename = (id: string): Promise<string | null> => api.suggestFilename(id);
export const getDocumentsWithSuggestions = (): Promise<DocumentRecord[]> =>
  api.getDocumentsWithSuggestions();
export const batchAcceptSuggestions = (ids: string[]): Promise<{ accepted: number }> =>
  api.batchAcceptSuggestions(ids);
export const getSuggestionStats = (): Promise<SuggestionStats | null> =>
  api.getSuggestionStats();

// Watcher
export const setWatchedFolder = () => api.setWatchedFolder();
export const getWatchedFolder = (): Promise<string | null> => api.getWatchedFolder();
export const clearWatchedFolder = () => api.clearWatchedFolder();
export const onFileIngested = (cb: (doc: DocumentRecord) => void) => api.onFileIngested(cb);
export const onWatcherError = (cb: (message: string) => void) => api.onWatcherError(cb);

// Utility
export const getPathForFile = (file: File): string => api.getPathForFile(file);

// Menu events
export const onMenuImportFiles = (cb: () => void) => api.onMenuImportFiles(cb);
export const onMenuImportFolder = (cb: () => void) => api.onMenuImportFolder(cb);
export const onMenuBackup = (cb: () => void) => api.onMenuBackup(cb);
export const onMenuRestore = (cb: () => void) => api.onMenuRestore(cb);
export const onMenuExportAll = (cb: () => void) => api.onMenuExportAll(cb);

// Backup
export const backupWorkspace = (): Promise<BackupResult> => api.backupWorkspace();
export const restoreWorkspace = (): Promise<RestoreResult> => api.restoreWorkspace();

// Workspaces
export const listWorkspaces = (): Promise<Workspace[]> => api.listWorkspaces();
export const addWorkspace = (name: string, libraryPath: string) =>
  api.addWorkspace(name, libraryPath);
export const renameWorkspace = (id: string, name: string) => api.renameWorkspace(id, name);
export const removeWorkspace = (id: string) => api.removeWorkspace(id);
export const switchWorkspace = (id: string) => api.switchWorkspace(id);
export const getActiveWorkspaceId = (): Promise<string | null> => api.getActiveWorkspaceId();
export const onWorkspaceSwitched = (cb: (id: string) => void) => api.onWorkspaceSwitched(cb);

// Ollama
export const checkOllamaStatus = (baseUrl?: string) => api.checkOllamaStatus(baseUrl);
export const getOllamaSettings = () => api.getOllamaSettings();
export const updateOllamaSettings = (partial: Parameters<typeof api.updateOllamaSettings>[0]) =>
  api.updateOllamaSettings(partial);

// Suggestion events
export const onSuggestionUpdated = (cb: (documentId: string) => void) =>
  api.onSuggestionUpdated(cb);

// Settings
export const getSettings = () => api.getSettings();
export const saveLastView = (view: string) => api.saveLastView(view);
