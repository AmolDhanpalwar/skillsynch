// ─── Database Provider Factory ────────────────────────────────────────────────
// Reads VITE_DB_PROVIDER from env and exports the active `db` client.
//
// Usage — drop-in replacement for supabaseClient imports in every file:
//
//   // Before:
//   import { supabase } from '../lib/supabaseClient';
//   // After:
//   import { db as supabase } from '../lib/db';
//
// Environment variables:
//   VITE_DB_PROVIDER=supabase   (default) — uses @supabase/supabase-js
//   VITE_DB_PROVIDER=mysql               — uses MySQL REST adapter
//   VITE_MYSQL_API_URL                   — base URL of MySQL REST API server
//                                          (required when provider=mysql)
//
// See docs/PERSISTENCY_SWITCH.md for full setup guide.

import type { DbClient, DbProvider } from './types';
import { supabaseAdapter } from './supabase-adapter';
import { MySQLProvider } from './mysql-adapter';

export const activeDbProvider = (import.meta.env.VITE_DB_PROVIDER ?? 'supabase') as DbProvider;

function initDb(): DbClient {
  if (activeDbProvider === 'mysql') {
    const apiUrl = import.meta.env.VITE_MYSQL_API_URL as string | undefined;
    if (!apiUrl) {
      // Throw at startup so the misconfiguration is obvious
      throw new Error(
        '[SkillSync DB] VITE_MYSQL_API_URL must be set when VITE_DB_PROVIDER=mysql.\n' +
        'Add it to your .env file and restart the dev server.\n' +
        'See docs/PERSISTENCY_SWITCH.md for the full setup guide.'
      );
    }
    return new MySQLProvider(apiUrl);
  }
  return supabaseAdapter;
}

/**
 * Active database client.
 * Import this instead of the raw supabase client:
 *
 *   import { db as supabase } from '../lib/db';
 *
 * The variable can keep the name `supabase` so existing destructuring and
 * call-site code remains unchanged — only the import path changes.
 */
export const db: DbClient = initDb();

// Named alias kept for clarity when importing in new files
export { db as supabase };

// Re-export types
export type { DbClient, DbProvider, DbResult, DbSession, DbUser } from './types';
