// ─── Supabase Adapter ─────────────────────────────────────────────────────────
// Thin wrapper that satisfies DbClient by delegating to @supabase/supabase-js.
// When VITE_DB_PROVIDER=supabase, this is the active provider and the full
// Supabase type system is preserved.

import { supabase } from '../supabaseClient';
import type { DbClient } from './types';

// The Supabase client already implements the DbClient interface structurally.
// We export it cast to DbClient so the factory returns a uniform type.
export const supabaseAdapter: DbClient = supabase as unknown as DbClient;
