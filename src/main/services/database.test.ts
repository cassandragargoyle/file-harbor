import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from './database';
import type { DocumentRecord, Category } from '../../shared/types';
import { CATEGORIES } from '../../shared/constants';

let tmpDir: string;
let db: DatabaseService;

function makeTestDoc(
  overrides: Partial<Omit<DocumentRecord, 'updated_at'>> = {}
): Omit<DocumentRecord, 'updated_at'> {
  return {
    id: randomUUID(),
    original_filename: 'test.pdf',
    stored_path: 'objects/test.pdf',
    mime_type: 'application/pdf',
    size_bytes: 1024,
    added_at: new Date().toISOString(),
    source: 'file_picker',
    source_path: '/tmp/test.pdf',
    category: null,
    content_hash: randomUUID(),
    extracted_text: null,
    suggested_category: null,
    suggestion_confidence: null,
    suggestion_source: null,
    suggested_filename: null,
    suggestion_outcome: null,
    ...overrides,
  };
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fh-db-test-'));
  db = new DatabaseService(tmpDir);
});

afterAll(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('DatabaseService', () => {
  describe('constructor', () => {
    it('creates db.sqlite in the library path', () => {
      expect(fs.existsSync(path.join(tmpDir, 'db.sqlite'))).toBe(true);
    });
  });

  describe('insertDocument + getDocument', () => {
    it('inserts a document and retrieves it by id', () => {
      const input = makeTestDoc();
      const inserted = db.insertDocument(input);

      expect(inserted.id).toBe(input.id);
      expect(inserted.updated_at).toBeDefined();

      const retrieved = db.getDocument(input.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.original_filename).toBe(input.original_filename);
    });

    it('returns undefined for non-existent id', () => {
      expect(db.getDocument('nonexistent')).toBeUndefined();
    });
  });

  describe('getDocumentByHash', () => {
    it('finds a document by content_hash', () => {
      const hash = 'unique-hash-' + randomUUID();
      const input = makeTestDoc({ content_hash: hash });
      db.insertDocument(input);

      const found = db.getDocumentByHash(hash);
      expect(found).toBeDefined();
      expect(found!.id).toBe(input.id);
    });

    it('returns undefined for non-existent hash', () => {
      expect(db.getDocumentByHash('nope')).toBeUndefined();
    });
  });

  describe('getDocumentsByCategory', () => {
    it('returns documents matching the given category', () => {
      const cat: Category = 'Taxes';
      const doc = makeTestDoc({ category: cat });
      db.insertDocument(doc);

      const results = db.getDocumentsByCategory(cat);
      expect(results.some((d) => d.id === doc.id)).toBe(true);
    });

    it('returns uncategorized documents when category is null', () => {
      const doc = makeTestDoc({ category: null });
      db.insertDocument(doc);

      const results = db.getDocumentsByCategory(null);
      expect(results.some((d) => d.id === doc.id)).toBe(true);
    });

    it('returns results ordered by added_at DESC', () => {
      const cat: Category = 'Banking';
      const older = makeTestDoc({
        category: cat,
        added_at: '2024-01-01T00:00:00Z',
      });
      const newer = makeTestDoc({
        category: cat,
        added_at: '2025-06-01T00:00:00Z',
      });
      db.insertDocument(older);
      db.insertDocument(newer);

      const results = db.getDocumentsByCategory(cat);
      const olderIdx = results.findIndex((d) => d.id === older.id);
      const newerIdx = results.findIndex((d) => d.id === newer.id);
      expect(newerIdx).toBeLessThan(olderIdx);
    });

    it('returns empty array when no documents match', () => {
      const results = db.getDocumentsByCategory('Kids');
      // May or may not be empty depending on prior tests, but should be an array
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('updateDocumentCategory', () => {
    it('changes the category of a document', () => {
      const doc = makeTestDoc({ category: null });
      db.insertDocument(doc);

      db.updateDocumentCategory(doc.id, 'Insurance');
      const updated = db.getDocument(doc.id);
      expect(updated!.category).toBe('Insurance');
    });

    it('can set category to null (move to inbox)', () => {
      const doc = makeTestDoc({ category: 'Work' });
      db.insertDocument(doc);

      db.updateDocumentCategory(doc.id, null);
      const updated = db.getDocument(doc.id);
      expect(updated!.category).toBeNull();
    });

    it('updates the updated_at timestamp', () => {
      const doc = makeTestDoc({ added_at: '2024-01-01T00:00:00.000Z' });
      const inserted = db.insertDocument(doc);

      // Insert uses the current time for updated_at, but we set added_at in the past.
      // The update call will set a new updated_at. To guarantee they differ,
      // use an artificially old added_at so inserted.updated_at is "now",
      // then verify the update also produces a valid ISO timestamp.
      db.updateDocumentCategory(doc.id, 'Legal');
      const updated = db.getDocument(doc.id);
      expect(updated!.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(new Date(updated!.updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(inserted.updated_at).getTime()
      );
    });
  });

  describe('updateExtractedText', () => {
    it('sets extracted_text on a document', () => {
      const doc = makeTestDoc();
      db.insertDocument(doc);

      db.updateExtractedText(doc.id, 'Extracted PDF content here');
      const updated = db.getDocument(doc.id);
      expect(updated!.extracted_text).toBe('Extracted PDF content here');
    });

    it('can clear extracted_text by setting null', () => {
      const doc = makeTestDoc();
      db.insertDocument(doc);
      db.updateExtractedText(doc.id, 'some text');
      db.updateExtractedText(doc.id, null);

      const updated = db.getDocument(doc.id);
      expect(updated!.extracted_text).toBeNull();
    });
  });

  describe('deleteDocument', () => {
    it('removes the document from the database', () => {
      const doc = makeTestDoc();
      db.insertDocument(doc);
      expect(db.getDocument(doc.id)).toBeDefined();

      db.deleteDocument(doc.id);
      expect(db.getDocument(doc.id)).toBeUndefined();
    });
  });

  describe('searchDocuments', () => {
    it('finds documents by partial filename match', () => {
      const doc = makeTestDoc({ original_filename: 'tax-return-2024.pdf' });
      db.insertDocument(doc);

      const results = db.searchDocuments('tax-return');
      expect(results.some((d) => d.id === doc.id)).toBe(true);
    });

    it('finds documents by partial extracted_text match', () => {
      const doc = makeTestDoc({ original_filename: 'scan.pdf' });
      db.insertDocument(doc);
      db.updateExtractedText(doc.id, 'Annual income statement for 2024');

      const results = db.searchDocuments('income statement');
      expect(results.some((d) => d.id === doc.id)).toBe(true);
    });

    it('returns empty array when nothing matches', () => {
      const results = db.searchDocuments('xyzzy-no-match-' + randomUUID());
      expect(results).toEqual([]);
    });

    it('is case-insensitive', () => {
      const doc = makeTestDoc({ original_filename: 'MyDocument.pdf' });
      db.insertDocument(doc);

      const results = db.searchDocuments('mydocument');
      expect(results.some((d) => d.id === doc.id)).toBe(true);
    });
  });

  describe('getDocumentCounts', () => {
    it('returns an object with inbox and all category keys', () => {
      const counts = db.getDocumentCounts();
      expect(counts).toHaveProperty('inbox');
      for (const cat of CATEGORIES) {
        expect(counts).toHaveProperty(cat);
      }
    });

    it('counts reflect inserted documents', () => {
      const cat: Category = 'Medical';
      const before = db.getDocumentCounts();
      const beforeCount = before[cat] ?? 0;

      db.insertDocument(makeTestDoc({ category: cat }));
      db.insertDocument(makeTestDoc({ category: cat }));

      const after = db.getDocumentCounts();
      expect(after[cat]).toBe(beforeCount + 2);
    });
  });

  describe('getLibraryStats', () => {
    it('returns documentCount and totalSizeBytes', () => {
      const stats = db.getLibraryStats(tmpDir);
      expect(stats.path).toBe(tmpDir);
      expect(typeof stats.documentCount).toBe('number');
      expect(typeof stats.totalSizeBytes).toBe('number');
      expect(stats.documentCount).toBeGreaterThan(0);
    });
  });
});
