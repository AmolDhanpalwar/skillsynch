// ─── Supabase Adapter ─────────────────────────────────────────────────────────
// Thin wrapper that satisfies DbClient by delegating to @supabase/supabase-js.
// When VITE_DB_PROVIDER=supabase (default), this is the active provider.

import { supabaseClient } from './supabase-client';
import type { DbClient } from './types';

// The Supabase client already implements DbClient structurally.
export const supabaseAdapter: DbClient = supabaseClient as unknown as DbClient;
