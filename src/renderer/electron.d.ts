import type { DocumentRecord, Category, DocumentSource, SuggestionSource, SuggestionStats, IngestResult, LibraryInfo, DocumentCounts, Workspace, BackupResult, RestoreResult, ExportAllResult } from '../shared/types';

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
  exportAllDocuments: () => Promise<ExportAllResult>;
  batchDeleteDocuments: (ids: string[]) => Promise<{ deleted: number }>;
  batchExportDocuments: (ids: string[]) => Promise<{ success: boolean; exported?: number; failed?: number; error?: string }>;
  batchUpdateCategory: (ids: string[], category: Category | null) => Promise<{ updated: number }>;
  revealInFinder: (id: string) => Promise<void>;
  getDocumentCounts: () => Promise<DocumentCounts | null>;
  openFilePicker: () => Promise<string[] | null>;
  openFolderPicker: () => Promise<string[] | null>;
  getDocumentProtocolUrl: (id: string) => Promise<string | null>;
  readDocumentFile: (id: string) => Promise<ArrayBuffer | null>;
  openDocumentExternally: (id: string) => Promise<void>;

  // Suggestions
  getDocumentSuggestion: (id: string) => Promise<{
    suggested_category: Category | null;
    suggestion_confidence: number | null;
    suggestion_source: SuggestionSource | null;
    suggested_filename: string | null;
  } | null>;
  acceptSuggestion: (id: string) => Promise<void>;
  dismissSuggestion: (id: string) => Promise<void>;
  acceptRenameSuggestion: (id: string) => Promise<void>;
  suggestFilename: (id: string) => Promise<string | null>;
  getDocumentsWithSuggestions: () => Promise<DocumentRecord[]>;
  batchAcceptSuggestions: (ids: string[]) => Promise<{ accepted: number }>;
  getSuggestionStats: () => Promise<SuggestionStats | null>;

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
  onMenuExportAll: (callback: () => void) => () => void;

  // Backup
  backupWorkspace: () => Promise<BackupResult>;
  restoreWorkspace: () => Promise<RestoreResult>;
  onMenuBackup: (callback: () => void) => () => void;
  onMenuRestore: (callback: () => void) => () => void;

  // Workspaces
  listWorkspaces: () => Promise<Workspace[]>;
  addWorkspace: (name: string, libraryPath: string) => Promise<{ success: boolean; workspace?: Workspace; error?: string }>;
  renameWorkspace: (id: string, name: string) => Promise<boolean>;
  removeWorkspace: (id: string) => Promise<{ success: boolean; error?: string }>;
  switchWorkspace: (id: string) => Promise<{ success: boolean }>;
  getActiveWorkspaceId: () => Promise<string | null>;
  onWorkspaceSwitched: (callback: (workspaceId: string) => void) => () => void;

  // Ollama
  checkOllamaStatus: (baseUrl?: string) => Promise<{
    reachable: boolean;
    models: Array<{ name: string; size: number; modified_at: string }>;
  }>;
  getOllamaSettings: () => Promise<{
    ollamaEnabled: boolean;
    ollamaBaseUrl: string;
    ollamaModel: string;
    suggestionConfidenceThreshold: number;
    ollamaNudgeShown: boolean;
  } | null>;
  updateOllamaSettings: (partial: Partial<{
    ollamaEnabled: boolean;
    ollamaBaseUrl: string;
    ollamaModel: string;
    suggestionConfidenceThreshold: number;
    ollamaNudgeShown: boolean;
  }>) => Promise<{
    ollamaEnabled: boolean;
    ollamaBaseUrl: string;
    ollamaModel: string;
    suggestionConfidenceThreshold: number;
    ollamaNudgeShown: boolean;
  } | null>;

  // Suggestion events
  onSuggestionUpdated: (callback: (documentId: string) => void) => () => void;

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
