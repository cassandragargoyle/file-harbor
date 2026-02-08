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
  | 'Receipts'
  | 'Legal'
  | 'Utilities'
  | 'Other';

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

export interface LibraryInfo {
  path: string;
  documentCount: number;
  totalSizeBytes: number;
}

export interface DocumentCounts {
  inbox: number;
  [category: string]: number;
}
