import type {
  DocumentRecord,
  Category,
  DocumentSource,
  IngestResult,
  LibraryInfo,
  DocumentCounts,
  Workspace,
} from '../../shared/types';

const api = window.electronAPI;

// Library
export const chooseLibraryPath = (): Promise<string | null> => api.chooseLibraryPath();
export const initializeLibrary = (path: string) => api.initializeLibrary(path);
export const getLibraryInfo = (): Promise<LibraryInfo | null> => api.getLibraryInfo();
export const openLibraryFolder = () => api.openLibraryFolder();

// Documents
export const ingestFiles = (paths: string[], source?: DocumentSource): Promise<IngestResult[]> =>
  api.ingestFiles(paths, source);
export const getDocumentsByCategory = (category: Category | null): Promise<DocumentRecord[]> =>
  api.getDocumentsByCategory(category);
export const updateDocumentCategory = (id: string, category: Category | null) =>
  api.updateDocumentCategory(id, category);
export const deleteDocument = (id: string) => api.deleteDocument(id);
export const searchDocuments = (query: string): Promise<DocumentRecord[]> =>
  api.searchDocuments(query);
export const getDocumentFilePath = (id: string): Promise<string | null> =>
  api.getDocumentFilePath(id);
export const exportDocument = (id: string): Promise<boolean> => api.exportDocument(id);
export const revealInFinder = (id: string) => api.revealInFinder(id);
export const getDocumentCounts = (): Promise<DocumentCounts | null> => api.getDocumentCounts();
export const openFilePicker = (): Promise<string[] | null> => api.openFilePicker();
export const getDocumentProtocolUrl = (id: string): Promise<string | null> =>
  api.getDocumentProtocolUrl(id);
export const openDocumentExternally = (id: string) => api.openDocumentExternally(id);

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

// Workspaces
export const listWorkspaces = (): Promise<Workspace[]> => api.listWorkspaces();
export const addWorkspace = (name: string, libraryPath: string) =>
  api.addWorkspace(name, libraryPath);
export const renameWorkspace = (id: string, name: string) => api.renameWorkspace(id, name);
export const removeWorkspace = (id: string) => api.removeWorkspace(id);
export const switchWorkspace = (id: string) => api.switchWorkspace(id);
export const getActiveWorkspaceId = (): Promise<string | null> => api.getActiveWorkspaceId();
export const onWorkspaceSwitched = (cb: (id: string) => void) => api.onWorkspaceSwitched(cb);

// Settings
export const getSettings = () => api.getSettings();
export const saveLastView = (view: string) => api.saveLastView(view);
