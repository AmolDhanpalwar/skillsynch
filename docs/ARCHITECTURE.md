# Architecture

## Overview

SkillSync is a single-page application (SPA) built with React. The persistence layer is **pluggable** — it defaults to Supabase but can be switched to MySQL by setting one environment variable. All data access goes through a **DB Provider abstraction layer** (`src/lib/db/`) that routes calls to the active backend. A set of Edge Functions (Supabase) or equivalent REST routes (MySQL) handle privileged operations requiring service-role credentials.

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser (SPA)                          │
│                                                             │
│  React 18 + TypeScript + Vite 5                             │
│  React Router v7  •  React Hook Form + Zod  •  Tailwind     │
│                                                             │
│  All DB access via:  import { supabase } from '../lib/db'   │
│                              ↑                              │
│          ┌───────────────────┴──────────────────┐           │
│          │     src/lib/db/ — Provider Factory    │           │
│          │     VITE_DB_PROVIDER env variable     │           │
│          └──────────┬──────────────────┬─────────┘           │
│                     │                  │                     │
│         ┌───────────▼───┐    ┌─────────▼──────────────┐    │
│         │SupabaseAdapter│    │   MySQLAdapter           │    │
│         │(pass-through) │    │   (HTTP query builder)   │    │
│         └───────────────┘    └────────────────────────┘    │
└──────────────┬───────────────────────────┬──────────────────┘
               │ HTTPS / WebSocket          │ HTTPS / REST
               ▼                            ▼
   ┌──────────────────────┐    ┌─────────────────────────────┐
   │      Supabase         │    │   MySQL REST API Server      │
   │                      │    │   (Express + mysql2)         │
   │  Auth  •  PostgREST  │    │                             │
   │  Realtime  •  EdgeFn │    │  POST /api/db               │
   └──────────────────────┘    │  POST /api/auth/*           │
                                │  GET  /api/realtime/*       │
                                │  POST /functions/v1/*       │
                                └─────────────────────────────┘
                │
    ┌───────────┴───────────┐
    │   AWS ECS Fargate     │
    │   (Docker container)  │
    │   nginx serving dist/ │
    └───────────────────────┘
```

See **docs/PERSISTENCY_SWITCH.md** for the complete guide to switching backends.

---

## DB Provider Abstraction Layer

```
src/lib/db/
├── index.ts            — Factory: reads VITE_DB_PROVIDER, exports `db`
├── types.ts            — DbClient, DbAuthProvider, DbQueryBuilder interfaces
├── supabase-adapter.ts — Thin wrapper re-exporting the Supabase client
└── mysql-adapter.ts    — MySQLProvider: HTTP query builder + JWT auth
```

**Switching** requires only a `.env` change:

| `VITE_DB_PROVIDER` | Active adapter | Extra requirements |
|---|---|---|
| `supabase` (default) | SupabaseAdapter | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| `mysql` | MySQLAdapter | `VITE_MYSQL_API_URL` pointing to a running REST API |



---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Build tool | Vite | 5.x |
| UI framework | React | 18.x |
| Language | TypeScript | 5.x |
| Routing | React Router | 7.x |
| Forms | React Hook Form | 7.x |
| Validation | Zod | 4.x |
| Styling | Tailwind CSS | 3.x |
| Icons | Lucide React | 0.344 |
| Charts | Recharts | 3.x |
| PDF export | jsPDF | 4.x |
| Excel export | xlsx | 0.18 |
| Backend | Supabase (Postgres + Auth + Realtime + Edge Functions) — default | 2.x SDK |
| DB Abstraction | `src/lib/db/` provider factory (Supabase or MySQL) | — |
| MySQL option | Express + mysql2 REST API (see docs/PERSISTENCY_SWITCH.md) | — |
| Tests | Vitest + @testing-library/react | 4.x / 16.x |
| Container | Docker multi-stage (node:20-alpine + nginx:1.27-alpine) | — |
| CI/CD | GitHub Actions | — |
| Cloud runtime | AWS ECS Fargate + ECR | — |

---

## Frontend

### Entry Point

`src/main.tsx` mounts the React app inside `<React.StrictMode>` with all context providers stacked in this order:

```
BrowserRouter
  └── ToastProvider
        └── AuthProvider
              └── CycleProvider
                    └── NotificationProvider
                          └── App (route definitions)
```

`CycleProvider` sits inside `AuthProvider` because it requires an authenticated user to subscribe to the `review_cycles` Realtime channel.

### Routing (`src/App.tsx`)

All protected routes are wrapped in `<PrivateRoute allowedRoles={[...]} />`, which checks the authenticated user's role before rendering the page. Unauthorized users are redirected to `/login`; authenticated users accessing `/login` are redirected to their role-specific home.

```
/login                          → LoginPage                    (public)
/                               → redirect → /login

/dashboard                      → DashboardPage                [employee, manager, tmg, management, admin]
/form                           → SkillFormPage                [employee]
/form/review/:formId            → ManagerReviewPage            [manager, tmg, admin]
/inbox                          → InboxPage                    [manager, tmg, admin]
/inbox/review/:formId           → ManagerReviewPage            [manager, tmg, admin]
/tmg-dashboard                  → TmgDashboardPage             [tmg, management, admin]
/skills-matrix                  → SkillsMatrixPage             [tmg, management, admin]
/cycles                         → CyclesPage                   [tmg, admin]
/status                         → StatusPage                   [tmg, management, admin]
/reports                        → ReportsPage                  [management, admin]
/settings                       → SettingsPage                 [tmg, admin]
/emp-settings                   → EmpSettingsPage              [tmg, admin]
/admin                          → AdminPage                    [admin]
/help/powerbi                   → PowerBiHelpPage              [all authenticated]
```

### Component Hierarchy

```
AppShell
├── Header
│   ├── Logo
│   ├── NotificationBell → NotificationDrawer
│   └── UserMenu (name, role, sign out)
├── Sidebar
│   └── NavLinks (filtered by role)
└── <page content>
    └── CycleSelectorDropdown   (on Dashboard, TmgDashboard, SkillsMatrix, StatusPage)
```

### Context Providers

| Context | File | Purpose | Key exports |
|---|---|---|---|
| `AuthContext` | `src/context/AuthContext.tsx` | Supabase session + user profile | `user`, `session`, `loading`, `signIn()`, `signInWithGoogle()`, `signOut()`, `refreshProfile()` |
| `CycleContext` | `src/context/CycleContext.tsx` | Active review cycle + all cycles | `activeCycle`, `cycles`, `loading` |
| `FormContext` | `src/context/FormContext.tsx` | Step navigation within SkillFormPage | `currentStep`, `setCurrentStep`, `formId`, `formStatus` |
| `NotificationContext` | `src/context/NotificationContext.tsx` | Real-time notification feed | `notifications`, `unreadCount`, `markRead()`, `markAllRead()` |
| `ToastContext` | `src/context/ToastContext.tsx` | Global transient messages | `toast()`, `success()`, `error()`, `info()`, `warning()` |

### CycleContext

`CycleContext` is the single source of truth for the active review cycle across the application.

```typescript
// Provided values
activeCycle: ReviewCycle | null   // the single cycle with status = 'active'
cycles: ReviewCycle[]             // all cycles ordered by created_at desc
loading: boolean

// Internal behaviour
// Subscribes to Supabase Realtime channel on review_cycles table
// Re-fetches on INSERT / UPDATE / DELETE events
// Uses useCycle() hook to consume in components
```

All cycle-aware pages call `useCycle()` and filter data by `activeCycle.id`. When `activeCycle` changes (e.g. after a cycle is activated or closed), all subscribed pages automatically re-fetch their data.

---

## Authentication

### Email / Password (always available)

The default authentication method. Users sign in with their email and password via Supabase Auth.

```
signInWithPassword(email, password)
  └── onAuthStateChange fires
        └── fetchProfile() → SELECT * FROM users WHERE id = auth.uid()
              └── sets user: UserProfile in context
                    └── PrivateRoute evaluates user.role → redirect or render
```

### Google SSO (admin-configurable)

Google OAuth 2.0 can be enabled by an admin via the Admin page. When enabled, a "Continue with Google" button appears on the login page.

```
Admin configures in AdminPage:
  └── sso_config (provider = 'google', enabled = true, client_id = '...')

LoginPage:
  └── On mount: SELECT enabled FROM sso_config WHERE provider = 'google'
        └── If enabled → show Google button
              └── onClick → supabase.auth.signInWithOAuth({ provider: 'google' })
                    └── Browser redirect → Google OAuth consent screen
                          └── Callback to VITE_SUPABASE_URL/auth/v1/callback
                                └── Supabase exchanges code → creates session
                                      └── onAuthStateChange fires
                                            └── fetchProfile() → load user
```

**Prerequisites to enable Google SSO:**
1. Create OAuth 2.0 credentials in Google Cloud Console → APIs & Services → Credentials
2. Set Authorised redirect URI to: `https://<project>.supabase.co/auth/v1/callback`
3. Enable Google provider in Supabase Dashboard → Authentication → Providers → Google (paste Client ID + Secret)
4. In the Admin page → SSO Configuration panel: paste Client ID, toggle Enable, save

**New user handling:** When a Google-authenticated user logs in for the first time, Supabase creates the `auth.users` entry. The application's `AuthContext.fetchProfile()` will find no row in `public.users` (null result). The admin must manually create the user profile (or a trigger can be added to auto-create it). Until a profile row exists, the user will see a blank state and cannot access role-protected routes.

---

## Review Cycle Lifecycle

```
                    ┌──────────────────────────────────────────┐
                    │            CyclesPage (tmg/admin)         │
                    └─────────────────┬────────────────────────┘
                                      │
                    ┌─────────────────▼─────────────────┐
                    │           DRAFT cycle              │
                    │   (created, not yet active)        │
                    └─────────────────┬─────────────────┘
                                      │ Activate
                                      │ → RPC: activate_cycle_reset_forms()
                                      │   resets ALL skill_forms to draft
                                      │   sets cycle_id on each form
                    ┌─────────────────▼─────────────────┐
                    │           ACTIVE cycle             │
                    │   Employees fill & submit forms    │
                    │   Managers review & approve        │
                    │   On approval → snapshot created   │
                    └─────────────────┬─────────────────┘
                     ┌────────────────┴────────────────┐
                     │ Close                           │ Suspend
                    ┌▼─────────────────┐  ┌───────────▼──────────────┐
                    │   CLOSED cycle   │  │   SUSPENDED cycle         │
                    │ Immutable.       │  │ Can be un-suspended or    │
                    │ Data in snapshots│  │ permanently closed.        │
                    └──────────────────┘  └──────────────────────────┘
```

### Key Invariants

- Only one cycle can be `active` at a time (enforced in application logic; DB trigger enforces in MySQL)
- `activate_cycle_reset_forms(p_cycle_id)` is called as an RPC — it runs as a SECURITY DEFINER function and bypasses RLS to reset all `skill_forms` to `draft` and assign `cycle_id`
- When a form is approved, the `trg_skill_form_approval_snapshot` trigger fires and inserts a JSONB snapshot into `skill_form_versions`; this snapshot is the permanent historical record for that employee + cycle pair
- Closed cycles are read from `skill_form_versions` snapshots — the live `skill_forms` table only holds the current cycle's data
- Suspended cycles retain approved forms in `skill_form_versions`; non-approved forms are purged

---

## Cycle-Aware Query Pattern

Every page that displays form data applies this pattern:

```typescript
// 1. Get active cycle from context
const { activeCycle, cycles } = useCycle();

// 2. Filter live data to active cycle only
const query = supabase
  .from('skill_forms')
  .select('*')
  .eq('cycle_id', activeCycle.id);   // <-- always scope to active cycle

// 3. Re-fetch when cycle changes
useEffect(() => {
  if (!activeCycle) return;
  loadData();
}, [activeCycle]);

// 4. For history, load from skill_form_versions
const { data: snapshots } = await supabase
  .from('skill_form_versions')
  .select('snapshot_data')
  .eq('cycle_id', selectedCycleId);
```

Pages implementing this pattern: `DashboardPage`, `InboxPage`, `TmgDashboardPage`, `SkillFormPage`, `SkillsMatrixPage`, `StatusPage`.

---

## CycleSelectorDropdown

`src/components/ui/CycleSelectorDropdown.tsx` is a shared UI component that appears in the top-right corner of cycle-aware pages.

```
Props:
  cycles: ReviewCycle[]          — all cycles (from CycleContext)
  activeCycle: ReviewCycle | null
  selectedId: string | 'current' — 'current' = active cycle; uuid = closed cycle
  onChange: (id: string | 'current') => void

Exports:
  buildCycleOptions(cycles, activeCycle): CycleOption[]
    — returns [ current option, ...closed cycles sorted newest-first ]
```

When `selectedId` is a closed cycle UUID, the page switches to read-only mode and loads its data from `skill_form_versions` snapshots. A history banner is shown to make the read-only context clear to the user.

---

## Data Flow: Skill Form

```
SkillFormPage
├── useCycle()                   loads activeCycle
├── init()
│   ├── query skill_forms WHERE employee_id = uid AND cycle_id = activeCycle.id
│   └── fallback: most recent form if no active cycle match
├── Step1Profile         reads: settings_grades, settings_designations, users
├── Step2Skills          reads: settings_languages, settings_frameworks,
│                                settings_tools, settings_databases, settings_skill_ratings
├── Step3Additional      reads: settings_environments, settings_skill_ratings
├── Step3Certifications  reads: settings_certifications
└── Step4Plans           reads/writes: step4 state
    └── handleNext / handleSaveDraft → persistForm()
                                        → upsert skill_forms (with cycle_id)
                                        → upsert skill_items
                                        → update users (grade, designation, manager_id)
                                        → insert notifications (on submit)
```

### Cycle-Aware `isApproved`

```typescript
const formBelongsToActiveCycle = !activeCycle || !formCycleId || formCycleId === activeCycle.id;
const isApproved = formStatus === 'approved' && formBelongsToActiveCycle;
const isLocked   = isApproved || (formStatus === 'pending_review' && formBelongsToActiveCycle);
```

This ensures a form marked `approved` in a closed cycle does not lock the new cycle's draft form.

---

## Data Flow: Manager Review

```
ManagerReviewPage
├── fetch skill_forms (by formId)
├── fetch skill_items (by formId)
├── Step2SkillsManager       manager can edit ratings & comments
├── Step3AdditionalManager   manager can edit ratings & comments
├── Step3CertificationsManager
├── Step4PlansManager        manager fills expectation plan
└── handleApprove
    → update skill_forms.status = 'approved', approved_at = now()
    → update skill_items (manager_rating, manager_comment)
    → insert notifications (notify employee)
    → trg_skill_form_approval_snapshot TRIGGER fires automatically
         → inserts snapshot into skill_form_versions
```

---

## Admin Panel Features

The Admin page (`src/pages/AdminPage.tsx`) provides the following capabilities to users with the `admin` role:

### User Management
- Create new users (calls `admin-create-user` Edge Function)
- Change any user's role via inline dropdown (all 5 roles)
- Reset any user's password (calls `admin-reset-password` Edge Function)
- Activate / deactivate user accounts
- Search and filter users by name, email, or role

### SSO Configuration
- Enable or disable Google SSO for the entire organization
- Set the Google OAuth Client ID
- Configuration persisted in the `sso_config` database table
- The login page reads this config on every load (anon-readable RLS policy) and conditionally shows the Google button

### Role Assignment by Email
- Lookup any user by their exact email address
- Preview their current role and profile
- Assign any role (employee, manager, tmg, management, admin) in a single click
- Designed for quickly promoting users to `tmg` or `management` without scrolling the full user list

### Demo Data
- Reset all user data to the seeded demo state

---

## Backend

### Supabase Client (`src/lib/supabaseClient.ts`)

A single client instance created at module load time using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. All queries from the browser use the anon key — RLS policies determine what each authenticated user can see and modify.

### SECURITY DEFINER Functions

Two PostgreSQL functions run as the `postgres` superuser role, bypassing RLS for privileged system operations:

| Function | Called from | Purpose |
|---|---|---|
| `activate_cycle_reset_forms(p_cycle_id uuid)` | `CyclesPage` via `supabase.rpc()` | Sets all `skill_forms.status = 'draft'`, assigns `cycle_id`, clears timestamps. Granted EXECUTE to `authenticated`. |
| `create_approval_snapshot()` (trigger function) | Postgres trigger | Fires AFTER UPDATE on `skill_forms` when `status` changes to `'approved'`. Builds JSONB snapshot of the entire form including all skill_items and inserts into `skill_form_versions`. |

```sql
-- Called from frontend:
const { error } = await supabase.rpc('activate_cycle_reset_forms', {
  p_cycle_id: cycle.id,
});
```

### Approval Snapshot Trigger

```
skill_forms AFTER UPDATE (status = 'approved')
  └── trg_skill_form_approval_snapshot
        └── create_approval_snapshot()
              ├── builds JSONB: { form fields, skill_items[] }
              └── INSERT INTO skill_form_versions
                    (employee_id, cycle_id, snapshot_data, approved_at)
                  ON CONFLICT (employee_id, cycle_id) DO UPDATE
```

### Edge Functions

Edge Functions run in Deno using the service role key (available automatically as `SUPABASE_SERVICE_ROLE_KEY`).

| Function | Trigger | Purpose |
|---|---|---|
| `seed-users` | POST (dev utility) | Populate initial demo users and auth accounts |
| `admin-create-user` | POST from AdminPage | Create an auth account + public.users profile row atomically |
| `admin-reset-password` | POST from AdminPage | Reset a user's auth password |
| `add-sample-employees` | POST (dev utility) | Insert additional sample employee data |

All Edge Functions implement CORS headers and wrap their body in `try/catch` to return structured JSON errors.

---

## State Management Summary

| Level | Tool | Where |
|---|---|---|
| Server state | Supabase JS client (direct queries) | Inside page components and hooks |
| Active cycle | `CycleContext` | App-wide; injected into every data-loading page |
| Form state | React Hook Form | `SkillFormPage` and `ManagerReviewPage` |
| Cross-component UI state | React Context | Auth, Cycle, Form step, Notifications, Toasts |
| Local ephemeral | `useState` / `useRef` | Inside individual components |

Auto-save uses `localStorage` as a draft buffer while the user is on Step 1 (before first DB persist). Once a form record exists in Supabase, the DB is the source of truth and the localStorage draft is discarded.

---

## Docker Build

The production image uses a **multi-stage Docker build**:

```dockerfile
# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN npm run build            # VITE_* vars baked into JS bundle here

# Stage 2: runtime
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**Important:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be passed as Docker `--build-arg` values — they are inlined into the JS bundle at build time and cannot be injected at runtime.

`nginx.conf` includes `try_files $uri /index.html;` to support client-side routing.

---

## CI/CD Pipeline

### GitHub Actions Workflows

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| CI | `.github/workflows/ci.yml` | Push / PR to `main` | Lint, typecheck, test |
| CD | `.github/workflows/cd.yml` | Push to `main` (after CI passes) | Build Docker image, push to ECR, deploy to ECS |

### CD Flow

```
1. Checkout code
2. Configure AWS credentials via OIDC (no long-lived keys)
   └── IAM Role assumed via GitHub Actions trust policy
3. Login to Amazon ECR
4. Build Docker image
   └── --build-arg VITE_SUPABASE_URL=<secret>
   └── --build-arg VITE_SUPABASE_ANON_KEY=<secret>
5. Tag and push image to ECR
6. Render new ECS task definition with updated image URI
7. Deploy to ECS service (rolling update)
8. Wait for service stability
```

### AWS Resources

| Resource | Purpose |
|---|---|
| ECR repository | Docker image registry |
| ECS Cluster | Container orchestration |
| ECS Service | Maintains desired count of tasks |
| ECS Task Definition | Container spec (image, CPU, memory, env) |
| IAM Role (OIDC) | GitHub Actions identity — no stored AWS keys |

IAM policies are in `infra/iam-github-actions-permissions-policy.json` and `infra/iam-github-actions-trust-policy.json`.

---

## File Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Pages | PascalCase + `Page` suffix | `DashboardPage.tsx` |
| Form steps | `Step{N}{Name}[Manager].tsx` | `Step2SkillsManager.tsx` |
| Contexts | PascalCase + `Context` suffix | `AuthContext.tsx` |
| Hooks | camelCase + `use` prefix | `useSkillRatings.ts` |
| Services | camelCase + `Service` suffix | `exportService.ts` |
| Shared UI | PascalCase | `CycleSelectorDropdown.tsx` |
| Types | camelCase or PascalCase, grouped by domain | `form.ts`, `index.ts` |
