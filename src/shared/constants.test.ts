import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
  MAX_EXTRACTED_TEXT_LENGTH,
  MAX_PDF_SIZE_FOR_EXTRACTION,
} from './constants';

describe('CATEGORIES', () => {
  it('contains exactly 14 categories', () => {
    expect(CATEGORIES).toHaveLength(14);
  });

  it('has no duplicates', () => {
    const unique = new Set(CATEGORIES);
    expect(unique.size).toBe(CATEGORIES.length);
  });

  it('contains all expected category names', () => {
    const expected = [
      'Identity', 'Taxes', 'Banking', 'Insurance', 'Medical', 'Home',
      'Work', 'Kids', 'Family', 'Receipts', 'Legal', 'Utilities', 'Mail', 'Other',
    ];
    expect(CATEGORIES).toEqual(expected);
  });
});

describe('ACCEPTED_EXTENSIONS', () => {
  it('contains 9 extensions', () => {
    expect(ACCEPTED_EXTENSIONS).toHaveLength(9);
  });

  it('all start with a dot', () => {
    for (const ext of ACCEPTED_EXTENSIONS) {
      expect(ext).toMatch(/^\./);
    }
  });
});

describe('ACCEPTED_MIME_TYPES', () => {
  it('has a key for every accepted extension', () => {
    for (const ext of ACCEPTED_EXTENSIONS) {
      expect(ACCEPTED_MIME_TYPES).toHaveProperty(ext);
    }
  });

  it('every key exists in ACCEPTED_EXTENSIONS', () => {
    for (const key of Object.keys(ACCEPTED_MIME_TYPES)) {
      expect(ACCEPTED_EXTENSIONS).toContain(key);
    }
  });

  it('all values are non-empty strings', () => {
    for (const value of Object.values(ACCEPTED_MIME_TYPES)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe('numeric constants', () => {
  it('MAX_EXTRACTED_TEXT_LENGTH is 100,000', () => {
    expect(MAX_EXTRACTED_TEXT_LENGTH).toBe(100_000);
  });

  it('MAX_PDF_SIZE_FOR_EXTRACTION is 50MB', () => {
    expect(MAX_PDF_SIZE_FOR_EXTRACTION).toBe(50 * 1024 * 1024);
  });
});
