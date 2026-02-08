import type {
  DocumentRecord,
  Category,
  DocumentSource,
  IngestResult,
  LibraryInfo,
  DocumentCounts,
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
export const updateDocumentCategory = (id: string, category: Category) =>
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

// Utility
export const getPathForFile = (file: File): string => api.getPathForFile(file);

// Settings
export const getSettings = () => api.getSettings();
