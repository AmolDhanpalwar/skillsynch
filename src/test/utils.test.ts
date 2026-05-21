import { describe, it, expect } from 'vitest';
import { getRoleHomePath, getRoleLabel, getInitials } from '../types/index';
import type { UserRole } from '../types/index';

// ─────────────────────────────────────────────────────────────────────────────
// getRoleHomePath
// ─────────────────────────────────────────────────────────────────────────────

describe('getRoleHomePath', () => {
  const cases: [UserRole, string][] = [
    ['employee',   '/dashboard'],
    ['manager',    '/inbox'],
    ['tmg',        '/tmg-dashboard'],
    ['management', '/reports'],
    ['admin',      '/admin'],
  ];

  cases.forEach(([role, path]) => {
    it(`maps "${role}" → "${path}"`, () => {
      expect(getRoleHomePath(role)).toBe(path);
    });
  });

  it('returns a string starting with "/"', () => {
    const roles: UserRole[] = ['employee', 'manager', 'tmg', 'management', 'admin'];
    roles.forEach(r => expect(getRoleHomePath(r)).toMatch(/^\//));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getRoleLabel
// ─────────────────────────────────────────────────────────────────────────────

describe('getRoleLabel', () => {
  const cases: [UserRole, string][] = [
    ['employee',   'Employee'],
    ['manager',    'Manager'],
    ['tmg',        'Technical Manager'],
    ['management', 'Management'],
    ['admin',      'Administrator'],
  ];

  cases.forEach(([role, label]) => {
    it(`maps "${role}" → "${label}"`, () => {
      expect(getRoleLabel(role)).toBe(label);
    });
  });

  it('returns a non-empty string for every role', () => {
    const roles: UserRole[] = ['employee', 'manager', 'tmg', 'management', 'admin'];
    roles.forEach(r => expect(getRoleLabel(r).length).toBeGreaterThan(0));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getInitials
// ─────────────────────────────────────────────────────────────────────────────

describe('getInitials', () => {
  it('extracts first letter of each word', () => {
    expect(getInitials('Alice Bob')).toBe('AB');
  });

  it('uppercases the result', () => {
    expect(getInitials('alice bob')).toBe('AB');
  });

  it('limits output to 2 characters for three-word names', () => {
    expect(getInitials('Alice Bob Charlie')).toBe('AB');
  });

  it('handles single-word name', () => {
    expect(getInitials('Alice')).toBe('A');
  });

  it('handles empty string without throwing', () => {
    expect(getInitials('')).toBe('');
  });

  it('handles name with extra spaces gracefully', () => {
    const result = getInitials('John  Doe');
    expect(result.length).toBeLessThanOrEqual(2);
  });
});
