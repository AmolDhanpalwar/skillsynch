// ─── MySQL REST Adapter ───────────────────────────────────────────────────────
// Implements DbClient by routing all calls to a MySQL-backed REST API server.
// Configure the server URL via VITE_MYSQL_API_URL in your environment.
//
// Expected REST API contract (implement with Express + mysql2 or similar):
//   POST /api/db         — query/mutate any table (body: DbQueryDescriptor)
//   POST /api/auth/signin
//   POST /api/auth/signout
//   GET  /api/auth/session
//   POST /api/auth/oauth/:provider
//   POST /api/realtime/subscribe   (optional WebSocket/SSE bridge)
//
// See docs/PERSISTENCY_SWITCH.md for the full server implementation guide.

import type {
  DbClient,
  DbAuthProvider,
  DbQueryBuilder,
  DbRealtimeChannel,
  DbRealtimeFilter,
  DbResult,
  DbSession,
} from './types';

const SESSION_KEY = 'mysql_db_session';

// ─── Auth ─────────────────────────────────────────────────────────────────────

class MySQLAuthProvider implements DbAuthProvider {
  private session: DbSession | null = null;
  private listeners = new Set<(event: string, session: DbSession | null) => void>();

  constructor(private baseUrl: string) {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try { this.session = JSON.parse(stored); } catch { /* ignore */ }
    }
  }

  async getSession() {
    if (!this.session) {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        try { this.session = JSON.parse(stored); } catch { /* ignore */ }
      }
    }
    return { data: { session: this.session }, error: null };
  }

  onAuthStateChange(callback: (event: string, session: DbSession | null) => void) {
    this.listeners.add(callback);
    // Fire immediately with current state (mirrors Supabase INITIAL_SESSION)
    setTimeout(() => callback('INITIAL_SESSION', this.session), 0);
    return {
      data: {
        subscription: {
          unsubscribe: () => { this.listeners.delete(callback); },
        },
      },
    };
  }

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        return { data: null, error: new Error(json.error ?? 'Sign-in failed') };
      }
      this.session = json.session as DbSession;
      localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
      this.notify('SIGNED_IN', this.session);
      return { data: { session: this.session }, error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  }

  async signInWithOAuth({ provider, options }: { provider: string; options?: { redirectTo?: string } }) {
    const redirect = options?.redirectTo ?? window.location.origin;
    window.location.href = `${this.baseUrl}/api/auth/oauth/${provider}?redirect_to=${encodeURIComponent(redirect)}`;
    return { data: null, error: null };
  }

  async signOut() {
    try {
      await fetch(`${this.baseUrl}/api/auth/signout`, {
        method: 'POST',
        headers: this.authHeaders(),
      });
    } catch { /* fire-and-forget */ }
    this.session = null;
    localStorage.removeItem(SESSION_KEY);
    this.notify('SIGNED_OUT', null);
    return { error: null };
  }

  getToken(): string | null {
    return this.session?.access_token ?? null;
  }

  authHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private notify(event: string, session: DbSession | null) {
    this.listeners.forEach((cb) => cb(event, session));
  }
}

// ─── Query Builder ────────────────────────────────────────────────────────────

type Filter = { type: string; col: string; val: unknown; operator?: string };
type Order = { col: string; asc: boolean };
type Operation = 'select' | 'insert' | 'update' | 'delete' | 'upsert';
type ResultMode = 'array' | 'single' | 'maybeSingle';

class MySQLQueryBuilder<T = unknown> implements DbQueryBuilder<T> {
  private _op: Operation = 'select';
  private _selectCols = '*';
  private _selectOpts: { count?: 'exact'; head?: boolean } = {};
  private _filters: Filter[] = [];
  private _order: Order | null = null;
  private _limit: number | null = null;
  private _data: unknown = null;
  private _upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } | null = null;
  private _resultMode: ResultMode = 'array';

  constructor(
    private baseUrl: string,
    private getToken: () => string | null,
    private table: string
  ) {}

  // ── Selection / operation setup ──────────────────────────────────────────

  select(columns = '*', options?: { count?: 'exact'; head?: boolean }): this {
    this._selectCols = columns;
    this._selectOpts = options ?? {};
    return this;
  }

  insert(data: unknown | unknown[]): this {
    this._op = 'insert';
    this._data = Array.isArray(data) ? data : [data];
    return this;
  }

  update(data: Record<string, unknown>): this {
    this._op = 'update';
    this._data = data;
    return this;
  }

  delete(): this {
    this._op = 'delete';
    return this;
  }

  upsert(data: unknown | unknown[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }): this {
    this._op = 'upsert';
    this._data = Array.isArray(data) ? data : [data];
    this._upsertOpts = opts ?? null;
    return this;
  }

  // ── Filters ──────────────────────────────────────────────────────────────

  eq(col: string, val: unknown): this { this._filters.push({ type: 'eq', col, val }); return this; }
  neq(col: string, val: unknown): this { this._filters.push({ type: 'neq', col, val }); return this; }
  in(col: string, val: unknown[]): this { this._filters.push({ type: 'in', col, val }); return this; }
  is(col: string, val: unknown): this { this._filters.push({ type: 'is', col, val }); return this; }
  gte(col: string, val: unknown): this { this._filters.push({ type: 'gte', col, val }); return this; }
  lte(col: string, val: unknown): this { this._filters.push({ type: 'lte', col, val }); return this; }
  ilike(col: string, val: string): this { this._filters.push({ type: 'ilike', col, val }); return this; }
  not(col: string, operator: string, val: unknown): this {
    this._filters.push({ type: 'not', col, val, operator });
    return this;
  }

  // ── Ordering / pagination ─────────────────────────────────────────────────

  order(col: string, opts?: { ascending?: boolean }): this {
    this._order = { col, asc: opts?.ascending ?? true };
    return this;
  }

  limit(count: number): this { this._limit = count; return this; }

  // ── Result modes ──────────────────────────────────────────────────────────

  single(): this { this._resultMode = 'single'; return this; }
  maybeSingle(): this { this._resultMode = 'maybeSingle'; return this; }

  // ── Execution ─────────────────────────────────────────────────────────────

  then<TResult1 = DbResult<T>, TResult2 = never>(
    resolve?: ((value: DbResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this._execute().then(resolve as never, reject as never);
  }

  private async _execute(): Promise<DbResult<T>> {
    const token = this.getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const payload = {
      table: this.table,
      operation: this._op,
      select: this._selectCols,
      selectOptions: this._selectOpts,
      filters: this._filters,
      order: this._order,
      limit: this._limit,
      data: this._data,
      upsertOptions: this._upsertOpts,
      resultMode: this._resultMode,
    };

    try {
      const res = await fetch(`${this.baseUrl}/api/db`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        return { data: null, error: new Error(json.error ?? `HTTP ${res.status}`) };
      }
      return { data: (json.data ?? null) as T, error: json.error ? new Error(json.error) : null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  }
}

// ─── Realtime (via WebSocket or SSE bridge) ───────────────────────────────────
// For MySQL, realtime is implemented via Server-Sent Events or WebSocket polling
// on the MySQL REST API server. The channel API mirrors Supabase channels.

class MySQLRealtimeChannel implements DbRealtimeChannel {
  private handlers: Array<{
    type: string;
    filter: DbRealtimeFilter;
    callback: (payload: unknown) => void;
  }> = [];
  private eventSource: EventSource | null = null;

  constructor(private baseUrl: string, private name: string, private getToken: () => string | null) {}

  on(type: string, filter: DbRealtimeFilter, callback: (payload: unknown) => void): this {
    this.handlers.push({ type, filter, callback });
    return this;
  }

  subscribe(): this {
    const token = this.getToken();
    const params = new URLSearchParams({
      channel: this.name,
      subscriptions: JSON.stringify(this.handlers.map((h) => ({ filter: h.filter }))),
      ...(token ? { token } : {}),
    });
    const url = `${this.baseUrl}/api/realtime/subscribe?${params}`;
    this.eventSource = new EventSource(url);
    this.eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        this.handlers.forEach(({ filter, callback }) => {
          if (filter.table === payload.table || filter.table === '*') {
            callback(payload);
          }
        });
      } catch { /* ignore malformed events */ }
    };
    return this;
  }

  cleanup() {
    this.eventSource?.close();
    this.eventSource = null;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class MySQLProvider implements DbClient {
  readonly auth: MySQLAuthProvider;
  private channels = new Set<MySQLRealtimeChannel>();

  constructor(private baseUrl: string) {
    this.auth = new MySQLAuthProvider(baseUrl);
  }

  from(table: string): DbQueryBuilder {
    return new MySQLQueryBuilder(
      this.baseUrl,
      () => this.auth.getToken(),
      table
    );
  }

  channel(name: string): DbRealtimeChannel {
    const ch = new MySQLRealtimeChannel(this.baseUrl, name, () => this.auth.getToken());
    this.channels.add(ch);
    return ch;
  }

  async removeChannel(channel: DbRealtimeChannel): Promise<void> {
    if (channel instanceof MySQLRealtimeChannel) {
      channel.cleanup();
      this.channels.delete(channel);
    }
  }
}
