// ─── Database Provider Interface ─────────────────────────────────────────────
// Defines the common contract that both SupabaseProvider and MySQLProvider
// must satisfy. Designed to mirror the @supabase/supabase-js client API surface
// so existing application code needs only an import-path change.

export type DbProvider = 'supabase' | 'mysql';

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface DbSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: DbUser;
}

export interface DbUser {
  id: string;
  email?: string;
}

export interface DbAuthState {
  event: string;
  session: DbSession | null;
}

export interface DbAuthSubscription {
  unsubscribe(): void;
}

export interface DbAuthProvider {
  getSession(): Promise<{ data: { session: DbSession | null }; error: Error | null }>;
  onAuthStateChange(
    callback: (event: string, session: DbSession | null) => void
  ): { data: { subscription: DbAuthSubscription } };
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{ data: { session: DbSession | null } | null; error: Error | null }>;
  signInWithOAuth(options: {
    provider: string;
    options?: { redirectTo?: string };
  }): Promise<{ data: unknown; error: Error | null }>;
  signOut(): Promise<{ error: Error | null }>;
}

// ─── Realtime ─────────────────────────────────────────────────────────────────

export interface DbRealtimeFilter {
  event: string;
  schema: string;
  table: string;
  filter?: string;
}

export interface DbRealtimeChannel {
  on(type: string, filter: DbRealtimeFilter, callback: (payload: unknown) => void): DbRealtimeChannel;
  subscribe(callback?: (status: string) => void): DbRealtimeChannel;
}

// ─── Query Builder ────────────────────────────────────────────────────────────

export type DbResult<T = unknown> = { data: T | null; error: Error | null };
export type DbCountResult = { count: number | null; data: null; error: Error | null };

export interface DbQueryBuilder<T = unknown> extends PromiseLike<DbResult<T>> {
  select(columns?: string, options?: { count?: 'exact'; head?: boolean }): DbQueryBuilder<T>;
  insert(data: unknown | unknown[]): DbQueryBuilder<T>;
  update(data: Record<string, unknown>): DbQueryBuilder<T>;
  delete(): DbQueryBuilder<T>;
  upsert(data: unknown | unknown[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): DbQueryBuilder<T>;

  eq(column: string, value: unknown): DbQueryBuilder<T>;
  neq(column: string, value: unknown): DbQueryBuilder<T>;
  in(column: string, values: unknown[]): DbQueryBuilder<T>;
  is(column: string, value: unknown): DbQueryBuilder<T>;
  gte(column: string, value: unknown): DbQueryBuilder<T>;
  lte(column: string, value: unknown): DbQueryBuilder<T>;
  ilike(column: string, pattern: string): DbQueryBuilder<T>;
  not(column: string, operator: string, value: unknown): DbQueryBuilder<T>;

  order(column: string, options?: { ascending?: boolean }): DbQueryBuilder<T>;
  limit(count: number): DbQueryBuilder<T>;

  single(): DbQueryBuilder<T>;
  maybeSingle(): DbQueryBuilder<T>;
}

// ─── Top-level Client Interface ───────────────────────────────────────────────

export interface DbClient {
  auth: DbAuthProvider;
  from(table: string): DbQueryBuilder;
  channel(name: string): DbRealtimeChannel;
  removeChannel(channel: DbRealtimeChannel): Promise<void>;
}
