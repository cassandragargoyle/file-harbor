export type DocumentSource = 'dragdrop' | 'watched_folder' | 'file_picker';

export type Category =
  | 'Identity'
  | 'Taxes'
  | 'Banking'
  | 'Insurance'
  | 'Medical'
  | 'Home'
  | 'Work'
  | 'Kids'
  | 'Family'
  | 'Receipts'
  | 'Legal'
  | 'Utilities'
  | 'Mail'
  | 'Other';

export type SuggestionSource = 'keywords' | 'ollama';
export type SuggestionOutcome = 'accepted' | 'dismissed';

export interface DocumentRecord {
  id: string;
  original_filename: string;
  stored_path: string;
  mime_type: string;
  size_bytes: number;
  added_at: string;
  source: DocumentSource;
  source_path: string | null;
  category: Category | null;
  content_hash: string;
  extracted_text: string | null;
  suggested_category: Category | null;
  suggestion_confidence: number | null;
  suggestion_source: SuggestionSource | null;
  suggested_filename: string | null;
  suggestion_outcome: SuggestionOutcome | null;
  updated_at: string;
}

export interface IngestResult {
  path: string;
  status: 'success' | 'duplicate' | 'error';
  documentId?: string;
  existingId?: string;
  error?: string;
}

export interface Workspace {
  id: string;
  name: string;
  libraryPath: string;
  watchedFolderPath?: string;
}

export interface SuggestionStats {
  pendingSuggestions: number;
  accepted: number;
  dismissed: number;
  accuracyRate: number | null;
}

export interface LibraryInfo {
  path: string;
  documentCount: number;
  totalSizeBytes: number;
  suggestionStats: SuggestionStats;
}

export interface DocumentCounts {
  inbox: number;
  [category: string]: number;
}

export interface BackupMeta {
  version: number;
  createdAt: string;
  appVersion: string;
  documentCount: number;
  totalSizeBytes: number;
}

export interface BackupResult {
  success: boolean;
  path?: string;
  meta?: BackupMeta;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  meta?: BackupMeta;
  error?: string;
}

export interface ExportAllResult {
  success: boolean;
  exported?: number;
  failed?: number;
  path?: string;
  error?: string;
}
