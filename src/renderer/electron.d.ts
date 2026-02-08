import type { DocumentRecord, Category, DocumentSource, IngestResult, LibraryInfo, DocumentCounts } from '../shared/types';

interface ElectronAPI {
  // Library
  chooseLibraryPath: () => Promise<string | null>;
  initializeLibrary: (path: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  getLibraryInfo: () => Promise<LibraryInfo | null>;
  openLibraryFolder: () => Promise<void>;

  // Documents
  ingestFiles: (paths: string[], source?: DocumentSource) => Promise<IngestResult[]>;
  getDocumentsByCategory: (category: Category | null) => Promise<DocumentRecord[]>;
  updateDocumentCategory: (id: string, category: Category) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  searchDocuments: (query: string) => Promise<DocumentRecord[]>;
  getDocumentFilePath: (id: string) => Promise<string | null>;
  exportDocument: (id: string) => Promise<boolean>;
  revealInFinder: (id: string) => Promise<void>;
  getDocumentCounts: () => Promise<DocumentCounts | null>;

  // Watcher
  setWatchedFolder: () => Promise<string | null>;
  getWatchedFolder: () => Promise<string | null>;
  clearWatchedFolder: () => Promise<void>;
  onFileIngested: (callback: (doc: DocumentRecord) => void) => () => void;

  // Settings
  getSettings: () => Promise<{
    libraryPath?: string;
    watchedFolderPath?: string;
    windowBounds?: { x: number; y: number; width: number; height: number };
  }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
