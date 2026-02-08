import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { getDefaultLibraryPath, initializeLibrary, validateLibrary } from './library-manager';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fh-lib-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('getDefaultLibraryPath', () => {
  it('returns a path ending with "FileHarbor"', () => {
    const result = getDefaultLibraryPath();
    expect(result).toMatch(/FileHarbor$/);
  });
});

describe('initializeLibrary', () => {
  it('creates objects/ directory', () => {
    initializeLibrary(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'objects'))).toBe(true);
  });

  it('creates objects/.tmp/ directory', () => {
    initializeLibrary(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'objects', '.tmp'))).toBe(true);
  });

  it('creates logs/ directory', () => {
    initializeLibrary(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'logs'))).toBe(true);
  });

  it('is idempotent (calling twice does not throw)', () => {
    initializeLibrary(tmpDir);
    expect(() => initializeLibrary(tmpDir)).not.toThrow();
  });
});

describe('validateLibrary', () => {
  it('returns true for a properly initialized library', () => {
    initializeLibrary(tmpDir);
    expect(validateLibrary(tmpDir)).toBe(true);
  });

  it('returns false for a non-existent path', () => {
    expect(validateLibrary('/nonexistent/path')).toBe(false);
  });

  it('returns false for a directory without objects/', () => {
    // tmpDir exists but has no objects/ subdirectory
    expect(validateLibrary(tmpDir)).toBe(false);
  });

  it('returns false for a file (not directory)', () => {
    const filePath = path.join(tmpDir, 'not-a-dir');
    fs.writeFileSync(filePath, 'hello');
    expect(validateLibrary(filePath)).toBe(false);
  });
});
