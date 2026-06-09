import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/db';
import type { ReviewCycle } from '../types';

interface CycleContextType {
  activeCycle: ReviewCycle | null;
  /** All non-suspended cycles — used by cycle selector dropdowns across the app */
  allCycles: ReviewCycle[];
  /** All cycles including suspended — used by CyclesPage admin view only */
  adminCycles: ReviewCycle[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const CycleContext = createContext<CycleContextType | null>(null);

export function CycleProvider({ children }: { children: React.ReactNode }) {
  const [activeCycle, setActiveCycle] = useState<ReviewCycle | null>(null);
  const [allCycles, setAllCycles] = useState<ReviewCycle[]>([]);
  const [adminCycles, setAdminCycles] = useState<ReviewCycle[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('review_cycles')
      .select('*')
      .order('created_at', { ascending: false });

    const cycles = (data ?? []) as ReviewCycle[];
    setAdminCycles(cycles);
    const nonSuspended = cycles.filter((c) => c.status !== 'suspended');
    setAllCycles(nonSuspended);
    setActiveCycle(nonSuspended.find((c) => c.status === 'active') ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel('review_cycles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'review_cycles' }, () => {
        refresh();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  return (
    <CycleContext.Provider value={{ activeCycle, allCycles, adminCycles, loading, refresh }}>
      {children}
    </CycleContext.Provider>
  );
}

export function useCycle() {
  const ctx = useContext(CycleContext);
  if (!ctx) throw new Error('useCycle must be used within CycleProvider');
  return ctx;
}
