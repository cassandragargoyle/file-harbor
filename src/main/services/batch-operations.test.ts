import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from './database';
import { deleteStoredFile, exportFile } from './file-service';
import type { DocumentRecord, Category } from '../../shared/types';

let tmpDir: string;
let db: DatabaseService;

function makeTestDoc(
  overrides: Partial<Omit<DocumentRecord, 'updated_at'>> = {}
): Omit<DocumentRecord, 'updated_at'> {
  return {
    id: randomUUID(),
    original_filename: `test-${randomUUID().slice(0, 8)}.pdf`,
    stored_path: `objects/${randomUUID()}.pdf`,
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

/** Create a file in the library so deleteStoredFile / exportFile can find it. */
function createStoredFile(storedPath: string, content = 'test content'): void {
  const fullPath = path.join(tmpDir, storedPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fh-batch-test-'));
  fs.mkdirSync(path.join(tmpDir, 'objects'), { recursive: true });
  db = new DatabaseService(tmpDir);
});

afterAll(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('batch delete', () => {
  it('deletes multiple documents from the database', () => {
    const docs = [makeTestDoc(), makeTestDoc(), makeTestDoc()];
    docs.forEach((d) => db.insertDocument(d));

    // Verify all exist
    docs.forEach((d) => expect(db.getDocument(d.id)).toBeDefined());

    // Delete them all
    docs.forEach((d) => db.deleteDocument(d.id));

    // Verify all gone
    docs.forEach((d) => expect(db.getDocument(d.id)).toBeUndefined());
  });

  it('deletes files from disk alongside database records', async () => {
    const doc = makeTestDoc();
    createStoredFile(doc.stored_path);
    db.insertDocument(doc);

    const filePath = path.join(tmpDir, doc.stored_path);
    expect(fs.existsSync(filePath)).toBe(true);

    await deleteStoredFile(tmpDir, doc.stored_path);
    db.deleteDocument(doc.id);

    expect(fs.existsSync(filePath)).toBe(false);
    expect(db.getDocument(doc.id)).toBeUndefined();
  });

  it('skips non-existent documents without throwing', () => {
    expect(() => db.deleteDocument('nonexistent-id')).not.toThrow();
  });

  it('updates counts after batch delete', () => {
    const cat: Category = 'Insurance';
    const docs = [makeTestDoc({ category: cat }), makeTestDoc({ category: cat })];
    docs.forEach((d) => db.insertDocument(d));

    const before = db.getDocumentCounts();

    docs.forEach((d) => db.deleteDocument(d.id));

    const after = db.getDocumentCounts();
    expect(after[cat]).toBe((before[cat] ?? 0) - 2);
  });
});

describe('batch update category', () => {
  it('files multiple documents to the same category', () => {
    const docs = [makeTestDoc(), makeTestDoc(), makeTestDoc()];
    docs.forEach((d) => db.insertDocument(d));

    const target: Category = 'Taxes';
    docs.forEach((d) => db.updateDocumentCategory(d.id, target));

    docs.forEach((d) => {
      const updated = db.getDocument(d.id);
      expect(updated!.category).toBe(target);
    });
  });

  it('moves multiple documents back to inbox (null category)', () => {
    const docs = [
      makeTestDoc({ category: 'Work' }),
      makeTestDoc({ category: 'Legal' }),
    ];
    docs.forEach((d) => db.insertDocument(d));

    docs.forEach((d) => db.updateDocumentCategory(d.id, null));

    docs.forEach((d) => {
      const updated = db.getDocument(d.id);
      expect(updated!.category).toBeNull();
    });
  });

  it('updates counts correctly after batch category change', () => {
    const docs = [makeTestDoc(), makeTestDoc()];
    docs.forEach((d) => db.insertDocument(d));
    const beforeCounts = db.getDocumentCounts();

    const target: Category = 'Home';
    docs.forEach((d) => db.updateDocumentCategory(d.id, target));

    const afterCounts = db.getDocumentCounts();
    expect(afterCounts.inbox).toBe(beforeCounts.inbox - 2);
    expect(afterCounts[target]).toBe((beforeCounts[target] ?? 0) + 2);
  });
});

describe('batch export', () => {
  it('exports multiple files to a destination directory', async () => {
    const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fh-export-'));

    try {
      const docs = [
        makeTestDoc({ original_filename: 'doc-a.pdf' }),
        makeTestDoc({ original_filename: 'doc-b.pdf' }),
      ];
      docs.forEach((d) => {
        createStoredFile(d.stored_path, `content of ${d.original_filename}`);
        db.insertDocument(d);
      });

      // Export each file
      for (const doc of docs) {
        await exportFile(tmpDir, doc.stored_path, path.join(exportDir, doc.original_filename));
      }

      // Verify exports exist with correct content
      for (const doc of docs) {
        const exported = path.join(exportDir, doc.original_filename);
        expect(fs.existsSync(exported)).toBe(true);
        const content = fs.readFileSync(exported, 'utf-8');
        expect(content).toBe(`content of ${doc.original_filename}`);
      }
    } finally {
      fs.rmSync(exportDir, { recursive: true, force: true });
    }
  });
});
