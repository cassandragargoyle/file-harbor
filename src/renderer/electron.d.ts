import type { DocumentRecord, Category, DocumentSource, IngestResult, LibraryInfo, DocumentCounts, Workspace } from '../shared/types';

interface ElectronAPI {
  // Library
  chooseLibraryPath: () => Promise<string | null>;
  initializeLibrary: (path: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  getLibraryInfo: () => Promise<LibraryInfo | null>;
  openLibraryFolder: () => Promise<void>;

  // Documents
  ingestFiles: (paths: string[], source?: DocumentSource) => Promise<{ results: IngestResult[]; skippedCount: number }>;
  getDocumentsByCategory: (category: Category | null) => Promise<DocumentRecord[]>;
  updateDocumentCategory: (id: string, category: Category | null) => Promise<void>;
  renameDocument: (id: string, newFilename: string) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  searchDocuments: (query: string) => Promise<DocumentRecord[]>;
  getDocumentFilePath: (id: string) => Promise<string | null>;
  exportDocument: (id: string) => Promise<boolean>;
  revealInFinder: (id: string) => Promise<void>;
  getDocumentCounts: () => Promise<DocumentCounts | null>;
  openFilePicker: () => Promise<string[] | null>;
  openFolderPicker: () => Promise<string[] | null>;
  getDocumentProtocolUrl: (id: string) => Promise<string | null>;
  readDocumentFile: (id: string) => Promise<ArrayBuffer | null>;
  openDocumentExternally: (id: string) => Promise<void>;

  // Watcher
  setWatchedFolder: () => Promise<string | null>;
  getWatchedFolder: () => Promise<string | null>;
  clearWatchedFolder: () => Promise<void>;
  onFileIngested: (callback: (doc: DocumentRecord) => void) => () => void;
  onWatcherError: (callback: (message: string) => void) => () => void;

  // Utility
  getPathForFile: (file: File) => string;

  // Menu events
  onMenuImportFiles: (callback: () => void) => () => void;
  onMenuImportFolder: (callback: () => void) => () => void;

  // Workspaces
  listWorkspaces: () => Promise<Workspace[]>;
  addWorkspace: (name: string, libraryPath: string) => Promise<{ success: boolean; workspace?: Workspace; error?: string }>;
  renameWorkspace: (id: string, name: string) => Promise<boolean>;
  removeWorkspace: (id: string) => Promise<{ success: boolean; error?: string }>;
  switchWorkspace: (id: string) => Promise<{ success: boolean }>;
  getActiveWorkspaceId: () => Promise<string | null>;
  onWorkspaceSwitched: (callback: (workspaceId: string) => void) => () => void;

  // Settings
  getSettings: () => Promise<{
    version: 2;
    workspaces: Workspace[];
    activeWorkspaceId: string;
    windowBounds?: { x: number; y: number; width: number; height: number };
    lastView?: string;
  }>;
  saveLastView: (view: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
