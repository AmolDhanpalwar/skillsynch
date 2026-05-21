import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Replicate the pure helper functions from exportService.ts
// These are not exported so we test equivalent implementations.
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function daysPending(submittedAt: string | null, approvedAt: string | null): number | string {
  if (!submittedAt) return '';
  const end = approvedAt ? new Date(approvedAt) : new Date();
  const start = new Date(submittedAt);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

function safeStr(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function autoWidth(data: unknown[][]): { wch: number }[] {
  const colWidths: number[] = [];
  data.forEach((row) => {
    (row as unknown[]).forEach((cell, i) => {
      const len = String(cell ?? '').length;
      colWidths[i] = Math.min(Math.max(colWidths[i] ?? 10, len + 2), 50);
    });
  });
  return colWidths.map((w) => ({ wch: w }));
}

// ─────────────────────────────────────────────────────────────────────────────
// formatDate
// ─────────────────────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('returns empty string for null', () => {
    expect(formatDate(null)).toBe('');
  });

  it('formats ISO date string in en-GB format', () => {
    const result = formatDate('2024-03-15T10:00:00Z');
    expect(result).toMatch(/15/);      // day present
    expect(result).toMatch(/Mar/);     // month abbreviation
    expect(result).toMatch(/2024/);    // year present
  });

  it('handles a date at year boundary', () => {
    const result = formatDate('2023-12-31T23:59:59Z');
    expect(result).toMatch(/Dec|Jan/); // locale may vary on exact date
    expect(result).toMatch(/2023|2024/);
  });

  it('produces a non-empty string for any valid ISO string', () => {
    expect(formatDate('2026-01-01T00:00:00Z').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// daysPending
// ─────────────────────────────────────────────────────────────────────────────

describe('daysPending', () => {
  it('returns empty string when submittedAt is null', () => {
    expect(daysPending(null, null)).toBe('');
    expect(daysPending(null, '2024-03-20T00:00:00Z')).toBe('');
  });

  it('returns 0 when submitted and approved same day', () => {
    const ts = '2024-03-15T12:00:00Z';
    expect(daysPending(ts, ts)).toBe(0);
  });

  it('returns correct day count between submit and approval', () => {
    expect(daysPending('2024-03-01T00:00:00Z', '2024-03-06T00:00:00Z')).toBe(5);
  });

  it('returns a number (days since submission) when not yet approved', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const result = daysPending(twoWeeksAgo, null);
    expect(typeof result).toBe('number');
    expect(result as number).toBeGreaterThanOrEqual(13);
  });

  it('never returns negative', () => {
    // approvedAt before submittedAt (data anomaly)
    const result = daysPending('2024-03-10T00:00:00Z', '2024-03-01T00:00:00Z');
    expect(result as number).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// safeStr
// ─────────────────────────────────────────────────────────────────────────────

describe('safeStr', () => {
  it('returns empty string for null', () => {
    expect(safeStr(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(safeStr(undefined)).toBe('');
  });

  it('passes through a non-empty string', () => {
    expect(safeStr('hello')).toBe('hello');
  });

  it('converts a number to string', () => {
    expect(safeStr(42)).toBe('42');
  });

  it('converts 0 to "0" (not empty)', () => {
    expect(safeStr(0)).toBe('0');
  });

  it('passes through an empty string as empty string', () => {
    expect(safeStr('')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// titleCase
// ─────────────────────────────────────────────────────────────────────────────

describe('titleCase', () => {
  it('converts snake_case to Title Case', () => {
    expect(titleCase('pending_review')).toBe('Pending Review');
  });

  it('converts single word to Title Case', () => {
    expect(titleCase('draft')).toBe('Draft');
  });

  it('handles already-correct input', () => {
    expect(titleCase('Approved')).toBe('Approved');
  });

  it('handles multiple underscores', () => {
    expect(titleCase('full_name_here')).toBe('Full Name Here');
  });

  it('returns empty string for empty input', () => {
    expect(titleCase('')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// autoWidth
// ─────────────────────────────────────────────────────────────────────────────

describe('autoWidth', () => {
  it('returns one entry per column', () => {
    const data = [['A', 'BB', 'CCC']];
    expect(autoWidth(data)).toHaveLength(3);
  });

  it('minimum column width is 10', () => {
    const data = [['X']]; // length 1 + 2 = 3, below minimum 10
    expect(autoWidth(data)[0].wch).toBe(10);
  });

  it('maximum column width is 50', () => {
    const data = [['A'.repeat(60)]]; // way over 50
    expect(autoWidth(data)[0].wch).toBe(50);
  });

  it('uses string length + 2 for padding', () => {
    const data = [['Hello']]; // 5 + 2 = 7, below minimum → 10
    const width = autoWidth(data)[0].wch;
    expect(width).toBe(10);
  });

  it('uses the longest cell in a column across all rows', () => {
    const data = [
      ['Hi', 'A'],
      ['LongContent', 'B'],
    ];
    const widths = autoWidth(data);
    // 'LongContent' = 11 chars + 2 = 13
    expect(widths[0].wch).toBe(13);
  });

  it('handles null/undefined cell values without throwing', () => {
    const data = [[null, undefined, 'valid']];
    expect(() => autoWidth(data as unknown[][])).not.toThrow();
  });

  it('handles empty data array', () => {
    expect(autoWidth([])).toEqual([]);
  });
});
