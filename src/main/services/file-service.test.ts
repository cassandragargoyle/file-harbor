import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

import {
  getAbsolutePath,
  validatePathWithinLibrary,
  ingestFileToTemp,
  finalizeIngest,
  discardTemp,
  deleteStoredFile,
  exportFile,
} from './file-service';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fh-test-'));
  // Create library structure
  fs.mkdirSync(path.join(tmpDir, 'objects', '.tmp'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Create a test file with known content and return its path. */
function createTestFile(name: string, content: string): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/** Compute SHA-256 hex digest of a string. */
function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

describe('getAbsolutePath', () => {
  it('joins library path and stored path', () => {
    const result = getAbsolutePath('/my/library', 'objects/abc.pdf');
    expect(result).toBe(path.join('/my/library', 'objects/abc.pdf'));
  });
});

describe('validatePathWithinLibrary', () => {
  it('returns true for a file inside the library root', async () => {
    const filePath = createTestFile('objects/test.txt', 'hello');
    expect(await validatePathWithinLibrary(filePath, tmpDir)).toBe(true);
  });

  it('returns true when filePath equals libraryRoot', async () => {
    expect(await validatePathWithinLibrary(tmpDir, tmpDir)).toBe(true);
  });

  it('returns false for a path outside the library root', async () => {
    const outsideFile = path.join(os.tmpdir(), 'outside.txt');
    fs.writeFileSync(outsideFile, 'outside');
    try {
      expect(await validatePathWithinLibrary(outsideFile, tmpDir)).toBe(false);
    } finally {
      fs.unlinkSync(outsideFile);
    }
  });

  it('returns false when the path does not exist', async () => {
    expect(await validatePathWithinLibrary('/nonexistent/file', tmpDir)).toBe(false);
  });
});

describe('ingestFileToTemp', () => {
  it('copies source file to objects/.tmp/', async () => {
    const source = createTestFile('input.pdf', 'pdf content');
    const result = await ingestFileToTemp(source, tmpDir);

    const tempPath = path.join(tmpDir, result.storedPath);
    expect(fs.existsSync(tempPath)).toBe(true);
  });

  it('returns correct sizeBytes', async () => {
    const content = 'hello world';
    const source = createTestFile('input.txt', content);
    const result = await ingestFileToTemp(source, tmpDir);

    expect(result.sizeBytes).toBe(Buffer.byteLength(content));
  });

  it('returns a valid SHA-256 hex hash', async () => {
    const content = 'hash me';
    const source = createTestFile('input.txt', content);
    const result = await ingestFileToTemp(source, tmpDir);

    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.contentHash).toBe(sha256(content));
  });

  it('returns the correct mimeType based on extension', async () => {
    const source = createTestFile('doc.pdf', 'fake pdf');
    const result = await ingestFileToTemp(source, tmpDir);
    expect(result.mimeType).toBe('application/pdf');
  });

  it('returns a UUID v4 in the result', async () => {
    const source = createTestFile('input.txt', 'data');
    const result = await ingestFileToTemp(source, tmpDir);

    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(result.uuid).toMatch(uuidV4Regex);
  });

  it('preserves file extension lowercased', async () => {
    const source = createTestFile('photo.PNG', 'image data');
    const result = await ingestFileToTemp(source, tmpDir);
    expect(result.extension).toBe('.png');
  });
});

describe('finalizeIngest', () => {
  it('moves file from objects/.tmp/ to objects/', async () => {
    const source = createTestFile('input.pdf', 'content');
    const { uuid, extension } = await ingestFileToTemp(source, tmpDir);

    const storedPath = await finalizeIngest(tmpDir, uuid, extension);

    expect(storedPath).toBe(`objects/${uuid}${extension}`);
    expect(fs.existsSync(path.join(tmpDir, storedPath))).toBe(true);
  });

  it('temp file no longer exists after finalization', async () => {
    const source = createTestFile('input.pdf', 'content');
    const { uuid, extension } = await ingestFileToTemp(source, tmpDir);

    const tempPath = path.join(tmpDir, 'objects', '.tmp', `${uuid}${extension}`);
    expect(fs.existsSync(tempPath)).toBe(true);

    await finalizeIngest(tmpDir, uuid, extension);
    expect(fs.existsSync(tempPath)).toBe(false);
  });
});

describe('discardTemp', () => {
  it('deletes the temp file', async () => {
    const source = createTestFile('input.txt', 'data');
    const { uuid, extension } = await ingestFileToTemp(source, tmpDir);

    const tempPath = path.join(tmpDir, 'objects', '.tmp', `${uuid}${extension}`);
    expect(fs.existsSync(tempPath)).toBe(true);

    await discardTemp(tmpDir, uuid, extension);
    expect(fs.existsSync(tempPath)).toBe(false);
  });

  it('does not throw when temp file already deleted', async () => {
    await expect(discardTemp(tmpDir, 'nonexistent', '.pdf')).resolves.toBeUndefined();
  });
});

describe('deleteStoredFile', () => {
  it('removes the file from disk', async () => {
    const source = createTestFile('input.pdf', 'content');
    const { uuid, extension } = await ingestFileToTemp(source, tmpDir);
    const storedPath = await finalizeIngest(tmpDir, uuid, extension);

    const fullPath = path.join(tmpDir, storedPath);
    expect(fs.existsSync(fullPath)).toBe(true);

    await deleteStoredFile(tmpDir, storedPath);
    expect(fs.existsSync(fullPath)).toBe(false);
  });

  it('does not throw when file does not exist', async () => {
    await expect(deleteStoredFile(tmpDir, 'objects/nope.pdf')).resolves.toBeUndefined();
  });
});

describe('exportFile', () => {
  it('copies stored file to the destination path', async () => {
    const content = 'export me';
    const source = createTestFile('input.txt', content);
    const { uuid, extension } = await ingestFileToTemp(source, tmpDir);
    const storedPath = await finalizeIngest(tmpDir, uuid, extension);

    const destPath = path.join(tmpDir, 'exported.txt');
    await exportFile(tmpDir, storedPath, destPath);

    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.readFileSync(destPath, 'utf-8')).toBe(content);
  });
});
