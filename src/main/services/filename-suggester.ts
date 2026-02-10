import path from 'node:path';
import type { Category } from '../../shared/types';

// Date patterns ordered by specificity
const DATE_PATTERNS: { regex: RegExp; parse: (m: RegExpMatchArray) => Date | null }[] = [
  // YYYY-MM-DD
  {
    regex: /\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.]([0-2]\d|3[01])\b/,
    parse: (m) => safeDate(+m[1], +m[2], +m[3]),
  },
  // MM/DD/YYYY or MM-DD-YYYY
  {
    regex: /\b(0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])[-/.](20\d{2})\b/,
    parse: (m) => safeDate(+m[3], +m[1], +m[2]),
  },
  // Month DD, YYYY
  {
    regex: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i,
    parse: (m) => safeDate(+m[3], monthIndex(m[1]) + 1, +m[2]),
  },
  // DD Month YYYY
  {
    regex: /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i,
    parse: (m) => safeDate(+m[3], monthIndex(m[2]) + 1, +m[1]),
  },
  // Mon DD, YYYY (abbreviated)
  {
    regex: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(20\d{2})\b/i,
    parse: (m) => safeDate(+m[3], monthIndexShort(m[1]) + 1, +m[2]),
  },
];

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const MONTHS_SHORT = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

function monthIndex(name: string): number {
  return MONTHS.indexOf(name.toLowerCase());
}

function monthIndexShort(name: string): number {
  return MONTHS_SHORT.indexOf(name.toLowerCase());
}

function safeDate(year: number, month: number, day: number): Date | null {
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
    return d;
  }
  return null;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Known entity names to look for in text
const KNOWN_ENTITIES = [
  // Banks
  'Chase', 'Bank of America', 'Wells Fargo', 'Citibank', 'Capital One',
  'US Bank', 'PNC', 'TD Bank', 'USAA', 'Navy Federal',
  'American Express', 'Discover', 'Ally Bank', 'Charles Schwab',
  // Insurance
  'Blue Cross', 'Blue Shield', 'Aetna', 'UnitedHealthcare', 'Cigna',
  'Humana', 'Kaiser Permanente', 'State Farm', 'Allstate', 'GEICO',
  'Progressive', 'Liberty Mutual', 'Nationwide', 'MetLife',
  // Payroll / Employment
  'ADP', 'Paychex', 'Gusto', 'Workday',
  // Government
  'IRS', 'Social Security Administration', 'SSA', 'DMV', 'USPS',
  // Utilities
  'AT&T', 'Verizon', 'T-Mobile', 'Comcast', 'Xfinity', 'Spectrum',
  'ConEdison', 'Pacific Gas', 'PG&E', 'Duke Energy',
];

const CATEGORY_CONTEXT: Partial<Record<Category, string>> = {
  Banking: 'Statement',
  Taxes: 'Tax Return',
  Insurance: 'Policy',
  Medical: 'Medical Record',
  Receipts: 'Receipt',
  Home: 'Document',
  Identity: 'ID',
  Legal: 'Legal Document',
  Utilities: 'Bill',
  Work: 'Pay Stub',
  Kids: 'School Record',
  Mail: 'Mail',
};

function extractDate(text: string): Date | null {
  for (const { regex, parse } of DATE_PATTERNS) {
    const match = text.match(regex);
    if (match) {
      const d = parse(match);
      if (d) return d;
    }
  }
  return null;
}

function extractEntity(text: string): string | null {
  // Check against known entities (case-insensitive)
  const lowerText = text.toLowerCase();
  for (const entity of KNOWN_ENTITIES) {
    if (lowerText.includes(entity.toLowerCase())) {
      return entity;
    }
  }

  return null;
}

function sanitizeFilenameComponent(s: string): string {
  return s.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
}

export function suggestFilename(
  extractedText: string | null,
  originalFilename: string,
  suggestedCategory: Category | null
): string | null {
  const text = extractedText ?? '';
  const ext = path.extname(originalFilename);

  const date = extractDate(text) ?? extractDate(originalFilename);
  const entity = extractEntity(text);

  // Need at least a date or entity to make a meaningful suggestion
  if (!date && !entity) return null;

  const parts: string[] = [];

  if (date) {
    parts.push(formatDate(date));
  }

  if (entity) {
    parts.push(sanitizeFilenameComponent(entity));
  }

  if (suggestedCategory && CATEGORY_CONTEXT[suggestedCategory]) {
    parts.push(CATEGORY_CONTEXT[suggestedCategory]!);
  }

  const basename = parts.join(' ');
  if (!basename) return null;

  const suggestion = basename + ext;

  // Don't suggest if it's the same as current filename
  if (suggestion === originalFilename) return null;

  return suggestion;
}
