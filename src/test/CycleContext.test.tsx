import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CycleProvider, useCycle } from '../context/CycleContext';
import type { ReviewCycle } from '../types';

// ─── Mock Supabase ────────────────────────────────────────────────────────────

const { mockFrom, mockChannel } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockChannel: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  supabase: {
    from: mockFrom,
    channel: mockChannel,
    removeChannel: vi.fn(),
  },
}));

const mockActiveCycle: ReviewCycle = {
  id: 'cycle-1',
  name: 'Mid Year 2026',
  cycle_type: 'mid_year',
  status: 'active',
  employee_deadline: '2026-06-30T00:00:00Z',
  manager_deadline: '2026-07-15T00:00:00Z',
  triggered_at: '2026-05-01T00:00:00Z',
  closed_at: null,
  created_by: 'u1',
  notes: '',
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
};

const mockDraftCycle: ReviewCycle = {
  ...mockActiveCycle,
  id: 'cycle-2',
  name: 'Full Year 2026',
  cycle_type: 'full_year',
  status: 'draft',
};

function setupMocks(cycles: ReviewCycle[] = []) {
  const order = vi.fn().mockResolvedValue({ data: cycles });
  const select = vi.fn().mockReturnValue({ order });
  mockFrom.mockReturnValue({ select });

  const subscribe = vi.fn().mockReturnThis();
  const on = vi.fn().mockReturnThis();
  mockChannel.mockReturnValue({ on, subscribe });
}

// ─── Consumer ────────────────────────────────────────────────────────────────

function Consumer() {
  const { activeCycle, allCycles, loading } = useCycle();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="activeCycle">{activeCycle?.name ?? 'null'}</span>
      <span data-testid="cycleCount">{allCycles.length}</span>
      <span data-testid="activeCycleType">{activeCycle?.cycle_type ?? 'null'}</span>
    </div>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CycleContext — no cycles', () => {
  beforeEach(() => setupMocks([]));

  it('sets loading to false after fetch', async () => {
    render(<CycleProvider><Consumer /></CycleProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  });

  it('activeCycle is null when no cycles exist', async () => {
    render(<CycleProvider><Consumer /></CycleProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('activeCycle').textContent).toBe('null');
    });
  });

  it('allCycles is empty array', async () => {
    render(<CycleProvider><Consumer /></CycleProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('cycleCount').textContent).toBe('0');
    });
  });
});

describe('CycleContext — with active cycle', () => {
  beforeEach(() => setupMocks([mockActiveCycle, mockDraftCycle]));

  it('identifies the active cycle correctly', async () => {
    render(<CycleProvider><Consumer /></CycleProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('activeCycle').textContent).toBe('Mid Year 2026');
    });
  });

  it('exposes allCycles with correct count', async () => {
    render(<CycleProvider><Consumer /></CycleProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('cycleCount').textContent).toBe('2');
    });
  });

  it('active cycle has correct type', async () => {
    render(<CycleProvider><Consumer /></CycleProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('activeCycleType').textContent).toBe('mid_year');
    });
  });
});

describe('CycleContext — only draft cycles (no active)', () => {
  beforeEach(() => setupMocks([mockDraftCycle]));

  it('activeCycle is null when no cycle has status "active"', async () => {
    render(<CycleProvider><Consumer /></CycleProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('activeCycle').textContent).toBe('null');
    });
  });
});

describe('CycleContext — error guard', () => {
  it('throws when useCycle is used outside CycleProvider', () => {
    function Bad() {
      useCycle();
      return null;
    }
    const consoleError = console.error;
    console.error = () => {};
    expect(() => render(<Bad />)).toThrow('useCycle must be used within CycleProvider');
    console.error = consoleError;
  });
});

describe('CYCLE_TYPE_LABELS', () => {
  it('mid_year maps to "Mid Year"', async () => {
    const { CYCLE_TYPE_LABELS } = await import('../types');
    expect(CYCLE_TYPE_LABELS.mid_year).toBe('Mid Year');
  });

  it('full_year maps to "Full Year"', async () => {
    const { CYCLE_TYPE_LABELS } = await import('../types');
    expect(CYCLE_TYPE_LABELS.full_year).toBe('Full Year');
  });

  it('custom maps to "Custom"', async () => {
    const { CYCLE_TYPE_LABELS } = await import('../types');
    expect(CYCLE_TYPE_LABELS.custom).toBe('Custom');
  });
});

describe('CYCLE_STATUS_CONFIG', () => {
  it('active status has correct label', async () => {
    const { CYCLE_STATUS_CONFIG } = await import('../types');
    expect(CYCLE_STATUS_CONFIG.active.label).toBe('Active');
  });

  it('draft status has correct label', async () => {
    const { CYCLE_STATUS_CONFIG } = await import('../types');
    expect(CYCLE_STATUS_CONFIG.draft.label).toBe('Draft');
  });

  it('closed status has correct label', async () => {
    const { CYCLE_STATUS_CONFIG } = await import('../types');
    expect(CYCLE_STATUS_CONFIG.closed.label).toBe('Closed');
  });
});
