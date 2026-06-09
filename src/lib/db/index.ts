// ─── Database Provider Factory ────────────────────────────────────────────────
// Selects the active DB client based on VITE_DB_PROVIDER.
//
// Usage in application files:
//
//   import { db } from '../lib/db';
//   db.from('users').select('*')...
//
// Environment variables:
//   VITE_DB_PROVIDER=supabase   (default) — uses @supabase/supabase-js
//   VITE_DB_PROVIDER=mysql               — uses MySQL REST adapter
//   VITE_MYSQL_API_URL                   — required when provider=mysql
//
// See docs/PERSISTENCY_SWITCH.md for the full setup guide.

import type { DbClient, DbProvider } from './types';
import { supabaseAdapter } from './supabase-adapter';
import { MySQLProvider } from './mysql-adapter';

export const activeDbProvider = (import.meta.env.VITE_DB_PROVIDER ?? 'supabase') as DbProvider;

function initDb(): DbClient {
  if (activeDbProvider === 'mysql') {
    const apiUrl = import.meta.env.VITE_MYSQL_API_URL as string | undefined;
    if (!apiUrl) {
      throw new Error(
        '[DB] VITE_MYSQL_API_URL must be set when VITE_DB_PROVIDER=mysql.\n' +
        'Add it to your .env file and restart the dev server.\n' +
        'See docs/PERSISTENCY_SWITCH.md for the full setup guide.'
      );
    }
    return new MySQLProvider(apiUrl);
  }
  return supabaseAdapter;
}

export const db: DbClient = initDb();

// Re-export types
export type { DbClient, DbProvider, DbResult, DbSession, DbUser } from './types';
