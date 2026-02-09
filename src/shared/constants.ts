import type { Category } from './types';

export const CATEGORIES: Category[] = [
  'Identity',
  'Taxes',
  'Banking',
  'Insurance',
  'Medical',
  'Home',
  'Work',
  'Kids',
  'Family',
  'Receipts',
  'Legal',
  'Utilities',
  'Mail',
  'Other',
];

export const ACCEPTED_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.txt',
  '.md',
  '.docx',
];

export const ACCEPTED_MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export const MAX_EXTRACTED_TEXT_LENGTH = 100_000;
export const MAX_PDF_SIZE_FOR_EXTRACTION = 50 * 1024 * 1024; // 50MB
