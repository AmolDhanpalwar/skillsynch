# Persistence Layer Switching Guide

SkillSync is designed so the persistence backend can be swapped between **Supabase** and **MySQL** by changing a single environment variable — no application-level code changes required.

---

## Quick Switch Reference

| Goal | `.env` change | Extra step |
|------|--------------|------------|
| Use Supabase (default) | `VITE_DB_PROVIDER=supabase` | None |
| Use MySQL | `VITE_DB_PROVIDER=mysql` | Start the MySQL REST API server |

Restart the Vite dev server after any `.env` change.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  React Application (Vite / TypeScript)          │
│                                                  │
│  All pages, contexts, and lib utilities         │
│  import { supabase } from '../lib/db'           │
│                         ↑                        │
│         ┌───────────────┴──────────────┐         │
│         │   src/lib/db/index.ts        │         │
│         │   DB Provider Factory        │         │
│         │   (reads VITE_DB_PROVIDER)   │         │
│         └───────┬──────────────┬───────┘         │
│                 │              │                  │
│    ┌────────────▼──┐   ┌───────▼────────────┐   │
│    │ SupabaseAdapter│   │  MySQLAdapter       │   │
│    │ (pass-through) │   │  (HTTP REST client) │   │
│    └────────────────┘   └────────────────────┘   │
└─────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
  Supabase Cloud            MySQL REST API Server
  (PostgREST + Auth)        (Express + mysql2)
```

The **DB Provider Factory** (`src/lib/db/index.ts`) reads `VITE_DB_PROVIDER` at build time and exports either the Supabase client or the MySQL adapter under the same `supabase` alias. All 24+ application files that query the database are completely unaware of which backend is active.

---

## Environment Variables

Add these to your `.env` file (or CI/CD secrets for deployments):

```bash
# ── Persistence Layer ──────────────────────────────
VITE_DB_PROVIDER=supabase   # "supabase" | "mysql"

# ── Supabase (required when VITE_DB_PROVIDER=supabase) ──
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...

# ── MySQL (required when VITE_DB_PROVIDER=mysql) ──────
VITE_MYSQL_API_URL=http://localhost:3001  # no trailing slash
```

---

## Option A — Supabase (Default)

No extra setup needed. Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set.

The Supabase client handles:
- **Auth** — JWT session management, OAuth (Google SSO), `onAuthStateChange`
- **Queries** — PostgREST-based fluent query builder with full type safety
- **Realtime** — WebSocket channels for live notification/cycle updates
- **Edge Functions** — serverless functions at `/functions/v1/`

### Supabase Features Used

| Feature | Tables / Functions |
|---------|-------------------|
| Auth | `auth.users`, `public.users` |
| Skill Forms | `skill_forms`, `skill_items`, `skill_form_versions` |
| Cycles | `review_cycles` |
| Notifications | `notifications` (realtime INSERT/UPDATE) |
| Settings | `settings_*` tables (15 tables) |
| SSO Config | `sso_config` |
| Edge Functions | `activate-cycle`, `suspend-cycle`, `approve-form`, `return-form`, `admin-create-user`, `admin-reset-password` |

---

## Option B — MySQL

### Step 1: Configure the environment

```bash
# .env
VITE_DB_PROVIDER=mysql
VITE_MYSQL_API_URL=http://localhost:3001
```

### Step 2: Apply the schema

```bash
mysql -u root -p skillsync < supabase/mysql_schema.sql
mysql -u root -p skillsync < supabase/mysql_data_dump.sql
```

### Step 3: Start the MySQL REST API server

Create a `server/` directory in the project root (not committed — add to `.gitignore`), then implement the API contract below using **Node.js + Express + mysql2**.

#### Minimal package.json

```json
{
  "name": "skillsync-mysql-api",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.0",
    "mysql2": "^3.6.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0"
  }
}
```

#### Required API Endpoints

All endpoints must set `Access-Control-Allow-Origin: *` and handle `OPTIONS` preflight.

---

##### `POST /api/db` — Universal table query

Used for all CRUD operations. The MySQL adapter sends a descriptor; the server translates it to SQL.

**Request body:**
```json
{
  "table": "users",
  "operation": "select",
  "select": "id, full_name, email, role",
  "filters": [
    { "type": "eq", "col": "id", "val": "uuid-here" }
  ],
  "order": { "col": "full_name", "asc": true },
  "limit": 50,
  "data": null,
  "upsertOptions": null,
  "resultMode": "maybeSingle"
}
```

**`operation` values:** `select` | `insert` | `update` | `delete` | `upsert`

**`filters[].type` values:** `eq` | `neq` | `in` | `is` | `gte` | `lte` | `ilike` | `not`

**`resultMode` values:** `array` (default) | `single` | `maybeSingle`

**Response (success):**
```json
{ "data": [ {...}, {...} ], "error": null }
```

**Response (error):**
```json
{ "data": null, "error": "Descriptive error message" }
```

**Reference implementation for `select`:**
```javascript
app.post('/api/db', requireAuth, async (req, res) => {
  const { table, operation, select, filters, order, limit, data, upsertOptions, resultMode } = req.body;

  const allowedTables = [
    'users', 'skill_forms', 'skill_items', 'skill_form_versions',
    'review_cycles', 'notifications', 'settings_grades', 'settings_designations',
    'settings_languages', 'settings_frameworks', 'settings_tools', 'settings_databases',
    'settings_certifications', 'settings_skill_ratings', 'settings_environments', 'sso_config'
  ];
  if (!allowedTables.includes(table)) {
    return res.status(400).json({ data: null, error: `Table not allowed: ${table}` });
  }

  try {
    if (operation === 'select') {
      let sql = `SELECT ${escapeColumns(select)} FROM \`${table}\``;
      const params = [];
      sql += buildWhere(filters, params);
      if (order) sql += ` ORDER BY \`${order.col}\` ${order.asc ? 'ASC' : 'DESC'}`;
      if (limit) sql += ` LIMIT ${parseInt(limit)}`;

      const [rows] = await db.query(sql, params);
      let result = rows;
      if (resultMode === 'single') result = rows[0] ?? null;
      if (resultMode === 'maybeSingle') result = rows[0] ?? null;
      return res.json({ data: result, error: null });
    }

    if (operation === 'insert') { /* ... */ }
    if (operation === 'update') { /* ... */ }
    if (operation === 'delete') { /* ... */ }
    if (operation === 'upsert') { /* INSERT INTO ... ON DUPLICATE KEY UPDATE ... */ }

  } catch (err) {
    return res.status(500).json({ data: null, error: err.message });
  }
});
```

> **Security note:** Always use a hardcoded allowlist for table names. Never interpolate user-supplied table names directly into SQL.

---

##### `POST /api/auth/signin`

```json
// Request
{ "email": "user@example.com", "password": "secret" }

// Response (success)
{
  "session": {
    "access_token": "<jwt>",
    "refresh_token": "<jwt>",
    "expires_at": 1234567890,
    "user": { "id": "uuid", "email": "user@example.com" }
  }
}

// Response (error)
{ "error": "Invalid email or password" }
```

**Reference implementation:**
```javascript
app.post('/api/auth/signin', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await db.query('SELECT * FROM auth_users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user || !await bcrypt.compare(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const [profile] = await db.query('SELECT * FROM users WHERE id = ?', [user.id]);
  const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({
    session: {
      access_token: token,
      refresh_token: token, // simplified — use separate refresh tokens in production
      expires_at: Math.floor(Date.now() / 1000) + 604800,
      user: { id: user.id, email: user.email, ...profile[0] }
    }
  });
});
```

---

##### `POST /api/auth/signout`

No request body needed. Returns `{}` on success.

---

##### `GET /api/auth/session`

Returns the current session for the provided `Authorization: Bearer <token>` header.

```json
// Response (authenticated)
{ "session": { "access_token": "<jwt>", "user": { "id": "...", "email": "..." } } }

// Response (unauthenticated)
{ "session": null }
```

---

##### `POST /api/auth/oauth/:provider` (optional — Google SSO)

Redirect the user to the OAuth provider. Only needed if Google SSO is enabled.

```javascript
app.get('/api/auth/oauth/google', (req, res) => {
  const redirectTo = req.query.redirect_to;
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?...`;
  res.redirect(googleAuthUrl);
});
```

---

##### `GET /api/realtime/subscribe` (optional — live updates)

Server-Sent Events endpoint for realtime table change notifications. Only needed if live notification badges / cycle refresh are required.

```javascript
app.get('/api/realtime/subscribe', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Poll the DB or use MySQL binlog for changes, then:
  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Cleanup on disconnect
  req.on('close', () => { /* stop polling */ });
});
```

---

### Step 4: Auth middleware for the server

```javascript
function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

### Step 5: Applying RLS-equivalent logic

Since MySQL has no Row Level Security, enforce access control in the server middleware:

```javascript
// Example: employees can only read their own skill_forms
function applyRowLevelFilters(req, table, filters) {
  const role = req.user.role; // decoded from JWT
  if (table === 'skill_forms' && role === 'employee') {
    filters.push({ type: 'eq', col: 'employee_id', val: req.user.sub });
  }
  // Add other role-based restrictions per table
  return filters;
}
```

### Step 6: Edge Functions equivalent

The Supabase Edge Functions (`activate-cycle`, `suspend-cycle`, `approve-form`, `return-form`, `admin-create-user`, `admin-reset-password`) call the Edge Function URL. For MySQL, these same operations must be Express routes on your server:

```javascript
// Activate cycle
app.post('/functions/v1/activate-cycle', requireAuth, requireRole('tmg', 'admin'), async (req, res) => { /* ... */ });

// Suspend cycle
app.post('/functions/v1/suspend-cycle', requireAuth, requireRole('tmg', 'admin'), async (req, res) => { /* ... */ });

// Approve form
app.post('/functions/v1/approve-form', requireAuth, requireRole('manager', 'tmg', 'admin'), async (req, res) => { /* ... */ });

// Return form
app.post('/functions/v1/return-form', requireAuth, requireRole('manager', 'tmg', 'admin'), async (req, res) => { /* ... */ });

// Admin create user
app.post('/functions/v1/admin-create-user', requireAuth, requireRole('admin'), async (req, res) => { /* ... */ });

// Admin reset password
app.post('/functions/v1/admin-reset-password', requireAuth, requireRole('admin'), async (req, res) => { /* ... */ });
```

The `VITE_SUPABASE_URL` in `edgeFunctions.ts` can be replaced by `VITE_MYSQL_API_URL` by updating `edgeFunctions.ts` to use the active base URL:

```typescript
// src/lib/edgeFunctions.ts — already updated to use db for auth
// The base URL for edge-function-equivalent routes:
const BASE_URL = import.meta.env.VITE_DB_PROVIDER === 'mysql'
  ? import.meta.env.VITE_MYSQL_API_URL
  : import.meta.env.VITE_SUPABASE_URL;
```

---

## File Structure of the Abstraction Layer

```
src/lib/db/
├── index.ts            — Factory: reads VITE_DB_PROVIDER, exports `db`
├── types.ts            — DbClient, DbAuthProvider, DbQueryBuilder interfaces
├── supabase-adapter.ts — Re-exports the Supabase client as DbClient
└── mysql-adapter.ts    — MySQLProvider: HTTP-based query builder + auth
```

### Key design decisions

1. **Same variable name** — all files keep `import { supabase } from '../lib/db'`. The identifier `supabase` can be named anything; it just refers to the active provider.

2. **Type safety** — when `VITE_DB_PROVIDER=supabase` the Supabase client's full TypeScript types flow through. When `mysql` is active, queries return `unknown` (cast in adapters).

3. **No application code changes required** — switching providers requires only an environment variable change and a server restart.

4. **Realtime graceful degradation** — The MySQL realtime adapter uses SSE (Server-Sent Events). If the server doesn't implement the SSE endpoint, channels will fail silently and the app will still work (notifications/cycles won't auto-refresh but will still load on page visit).

---

## Testing Both Providers

### Supabase tests

Run normally — no extra setup:
```bash
npm run test
```

### MySQL tests

Start the MySQL REST API server, then set the env and run:
```bash
VITE_DB_PROVIDER=mysql VITE_MYSQL_API_URL=http://localhost:3001 npm run test
```

See `docs/TEST_PLAN.md` for the full provider test matrix.

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `VITE_MYSQL_API_URL must be set` | Missing env var | Add `VITE_MYSQL_API_URL=http://localhost:3001` to `.env` |
| `Failed to fetch` on queries | MySQL server not running | Start the API server: `node server/index.js` |
| Auth token rejected | JWT secret mismatch | Ensure `JWT_SECRET` matches between server restarts |
| Realtime not working | SSE endpoint not implemented | Add `/api/realtime/subscribe` to the server |
| `Table not allowed: xyz` | Table allowlist check | Add the table to the allowlist in the server |
| SSO button disabled | `sso_config.enabled=false` in DB | Enable via Admin → SSO Settings |

---

## Switching in CI/CD

Add `VITE_DB_PROVIDER` to your GitHub Actions secrets and pass it at build time:

```yaml
# .github/workflows/cd.yml
- name: Build
  env:
    VITE_DB_PROVIDER: ${{ secrets.VITE_DB_PROVIDER }}
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
    VITE_MYSQL_API_URL: ${{ secrets.VITE_MYSQL_API_URL }}
  run: npm run build
```

---

## Summary Checklist

### Switching from Supabase → MySQL

- [ ] Set `VITE_DB_PROVIDER=mysql` in `.env`
- [ ] Set `VITE_MYSQL_API_URL=http://your-api-server` in `.env`
- [ ] Apply schema: `mysql -u root -p skillsync < supabase/mysql_schema.sql`
- [ ] Seed data: `mysql -u root -p skillsync < supabase/mysql_data_dump.sql`
- [ ] Implement and start MySQL REST API server
- [ ] Add role-based row-level filters in the server middleware
- [ ] Implement Edge Function equivalent routes (`/functions/v1/*`)
- [ ] (Optional) Implement SSE realtime endpoint
- [ ] Restart Vite dev server

### Switching from MySQL → Supabase

- [ ] Set `VITE_DB_PROVIDER=supabase` in `.env`
- [ ] Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- [ ] Restart Vite dev server
