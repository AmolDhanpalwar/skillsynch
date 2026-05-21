import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSkillRatings } from '../lib/useSkillRatings';

// ─── Mock Supabase (vi.hoisted ensures vars exist before vi.mock factory runs) ──

const { mockOrder, mockEq, mockSelect, mockFrom } = vi.hoisted(() => ({
  mockOrder: vi.fn(),
  mockEq: vi.fn(),
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
  },
}));

const FALLBACK_LABELS = [
  '1 — Only Training / Certification',
  '2 — Basic Work Knowledge',
  '3 — Intermediate',
  '4 — Proficient',
  '5 — Expert',
];

const DB_RATINGS = [
  { sort_order: 1, label: '1 — Only Training / Certification' },
  { sort_order: 2, label: '2 — Basic Work Knowledge' },
  { sort_order: 3, label: '3 — Intermediate' },
  { sort_order: 4, label: '4 — Proficient' },
  { sort_order: 5, label: '5 — Expert' },
];

function setupMockChain(data: unknown[] | null) {
  mockOrder.mockResolvedValue({ data });
  mockEq.mockReturnValue({ order: mockOrder });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
}

describe('useSkillRatings — initial state', () => {
  beforeEach(() => {
    setupMockChain(DB_RATINGS);
  });

  it('returns loading: true initially', () => {
    const { result } = renderHook(() => useSkillRatings());
    expect(result.current.loading).toBe(true);
  });

  it('returns fallback ratings initially before DB responds', () => {
    const { result } = renderHook(() => useSkillRatings());
    expect(result.current.ratings).toHaveLength(5);
    expect(result.current.ratings[0].label).toBe(FALLBACK_LABELS[0]);
  });
});

describe('useSkillRatings — successful fetch', () => {
  beforeEach(() => {
    setupMockChain(DB_RATINGS);
  });

  it('sets loading to false after fetch completes', async () => {
    const { result } = renderHook(() => useSkillRatings());
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('returns DB ratings after successful fetch', async () => {
    const { result } = renderHook(() => useSkillRatings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ratings).toHaveLength(5);
    expect(result.current.ratings[2].sort_order).toBe(3);
    expect(result.current.ratings[2].label).toBe('3 — Intermediate');
  });

  it('queries settings_skill_ratings table', async () => {
    renderHook(() => useSkillRatings());
    await waitFor(() => {});
    expect(mockFrom).toHaveBeenCalledWith('settings_skill_ratings');
  });

  it('filters by is_active = true', async () => {
    renderHook(() => useSkillRatings());
    await waitFor(() => {});
    expect(mockEq).toHaveBeenCalledWith('is_active', true);
  });

  it('orders by sort_order', async () => {
    renderHook(() => useSkillRatings());
    await waitFor(() => {});
    expect(mockOrder).toHaveBeenCalledWith('sort_order');
  });
});

describe('useSkillRatings — empty DB response (fallback)', () => {
  it('keeps fallback ratings when DB returns empty array', async () => {
    setupMockChain([]);
    const { result } = renderHook(() => useSkillRatings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ratings).toHaveLength(5);
    expect(result.current.ratings[0].label).toBe(FALLBACK_LABELS[0]);
  });

  it('keeps fallback ratings when DB returns null', async () => {
    setupMockChain(null);
    const { result } = renderHook(() => useSkillRatings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ratings).toHaveLength(5);
  });

  it('sets loading to false even with empty response', async () => {
    setupMockChain([]);
    const { result } = renderHook(() => useSkillRatings());
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});

describe('useSkillRatings — custom DB ratings', () => {
  it('uses custom ratings from DB when provided', async () => {
    const customRatings = [
      { sort_order: 1, label: 'Novice' },
      { sort_order: 2, label: 'Competent' },
      { sort_order: 3, label: 'Expert' },
    ];
    setupMockChain(customRatings);
    const { result } = renderHook(() => useSkillRatings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ratings).toHaveLength(3);
    expect(result.current.ratings[0].label).toBe('Novice');
    expect(result.current.ratings[2].label).toBe('Expert');
  });
});
