import { describe, it, expect } from 'vitest';
import { suggestFilename } from './filename-suggester';

describe('suggestFilename', () => {
  it('returns null when no date or entity found', () => {
    expect(suggestFilename('Lorem ipsum dolor sit amet', 'doc.pdf', null)).toBeNull();
    expect(suggestFilename(null, 'doc.pdf', null)).toBeNull();
  });

  it('extracts date in YYYY-MM-DD format', () => {
    const result = suggestFilename(
      'Statement Date: 2024-03-15 Account Summary',
      'document.pdf',
      'Banking'
    );
    expect(result).not.toBeNull();
    expect(result).toContain('2024-03-15');
  });

  it('extracts date in MM/DD/YYYY format', () => {
    const result = suggestFilename(
      'Date: 03/15/2024 Invoice Total',
      'invoice.pdf',
      'Receipts'
    );
    expect(result).not.toBeNull();
    expect(result).toContain('2024-03-15');
  });

  it('extracts date in Month DD, YYYY format', () => {
    const result = suggestFilename(
      'March 15, 2024 Dear Policyholder',
      'letter.pdf',
      'Insurance'
    );
    expect(result).not.toBeNull();
    expect(result).toContain('2024-03-15');
  });

  it('extracts known entity names', () => {
    const result = suggestFilename(
      'Chase Bank Statement for March 2024',
      'statement.pdf',
      'Banking'
    );
    expect(result).not.toBeNull();
    expect(result).toContain('Chase');
  });

  it('builds filename with date + entity + category context', () => {
    const result = suggestFilename(
      'Blue Cross Blue Shield Explanation of Benefits Date of Service: 2024-06-01',
      'scan.pdf',
      'Medical'
    );
    expect(result).not.toBeNull();
    expect(result).toContain('2024-06-01');
    expect(result).toContain('Blue Cross');
    expect(result).toContain('Medical Record');
    expect(result).toMatch(/\.pdf$/);
  });

  it('preserves the original file extension', () => {
    const result = suggestFilename(
      'IRS Tax Return 2024-01-15',
      'scan.png',
      'Taxes'
    );
    expect(result).not.toBeNull();
    expect(result).toMatch(/\.png$/);
  });

  it('returns null if suggestion would be the same as original filename', () => {
    const result = suggestFilename(
      'Statement from 2024-03-15',
      '2024-03-15 Statement.pdf',
      null
    );
    // The filename and the generated suggestion might happen to match
    // In any case, it should either be null or different from original
    if (result !== null) {
      expect(result).not.toBe('2024-03-15 Statement.pdf');
    }
  });

  it('works with date from filename when text has none', () => {
    const result = suggestFilename(
      'Account summary and balance information',
      '2024-03-15-statement.pdf',
      'Banking'
    );
    expect(result).not.toBeNull();
    expect(result).toContain('2024-03-15');
  });
});
