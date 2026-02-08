import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { relativeTime, formatBytes } from './format';

describe('relativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for timestamps < 60 seconds ago', () => {
    expect(relativeTime('2025-06-15T11:59:30Z')).toBe('just now');
  });

  it('returns minutes ago for 1-59 minutes', () => {
    expect(relativeTime('2025-06-15T11:55:00Z')).toBe('5m ago');
    expect(relativeTime('2025-06-15T11:01:00Z')).toBe('59m ago');
  });

  it('returns hours ago for 1-23 hours', () => {
    expect(relativeTime('2025-06-15T10:00:00Z')).toBe('2h ago');
    expect(relativeTime('2025-06-14T13:00:00Z')).toBe('23h ago');
  });

  it('returns days ago for 1-6 days', () => {
    expect(relativeTime('2025-06-14T12:00:00Z')).toBe('1d ago');
    expect(relativeTime('2025-06-09T12:00:00Z')).toBe('6d ago');
  });

  it('returns formatted date for 7+ days in the same year', () => {
    const result = relativeTime('2025-01-10T12:00:00Z');
    expect(result).toContain('Jan');
    expect(result).toContain('10');
    // Should NOT include year since it's the same year
    expect(result).not.toContain('2025');
  });

  it('returns formatted date with year for a different year', () => {
    const result = relativeTime('2024-03-05T12:00:00Z');
    expect(result).toContain('2024');
  });

  it('shows "1m ago" at exactly 60 seconds, not "just now"', () => {
    expect(relativeTime('2025-06-15T11:59:00Z')).toBe('1m ago');
  });

  it('shows "1d ago" at exactly 24 hours, not "24h ago"', () => {
    expect(relativeTime('2025-06-14T12:00:00Z')).toBe('1d ago');
  });
});

describe('formatBytes', () => {
  it('returns "0 B" for 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes below 1 KB', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(5.5 * 1024 * 1024)).toBe('5.5 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1 GB');
  });

  it('rounds to one decimal place', () => {
    // 1.05 KB = 1075.2 bytes
    expect(formatBytes(1075)).toBe('1 KB');
    // 2.56 MB
    expect(formatBytes(2.56 * 1024 * 1024)).toBe('2.6 MB');
  });
});
