# Development Guide

---

## Local Setup

### 1. Prerequisites

- Node.js 20+ (check: `node -v`)
- npm 9+ (check: `npm -v`)
- A Supabase project with the schema applied (see [DATABASE.md](DATABASE.md))

### 2. Clone and install

```bash
git clone <repo-url>
cd skillsync
npm install
```

### 3. Configure environment

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Both values are in your Supabase dashboard under **Settings > API**.

### 4. Start the dev server

```bash
npm run dev
```

Open `http://localhost:5173`. The app auto-reloads on file changes.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Run TypeScript type check (no emit) |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests in watch mode (Vitest) |
| `npx vitest run` | Run tests once (CI mode) |

---

## Demo Users

The database is pre-seeded with demo accounts.

| Role | Email | Password |
|---|---|---|
| Employee | `employee1@haptiq.com` | `emp@123` |
| Employee | `employee2@haptiq.com` | `emp@123` |
| Employee | `employee3@haptiq.com` | `emp@123` |
| Employee | `employee4@haptiq.com` | `emp@123` |
| Employee | `employee5@haptiq.com` | `emp@123` |
| Manager / TMG | `tmg@haptiq.com` | `tmg@123` |
| Admin | `admin@haptiq.com` | `admin@123` |

---

## Project Conventions

### TypeScript

- Strict mode is on (`"strict": true` in `tsconfig.app.json`)
- Always prefer explicit types over `any`
- Use `type` imports for type-only imports: `import type { Foo } from './types'`

### Component structure

- One component per file
- Pages live in `src/pages/`; reusable UI in `src/components/`
- Shared UI widgets in `src/components/ui/`
- Step components for the skill form live in `src/pages/form/`
- Manager-specific variants of step components are named `Step{N}{Name}Manager.tsx`

### State

- Do not introduce a global state library (Redux, Zustand, etc.) — use React Context for shared state and `useState`/`useReducer` locally
- Server data is fetched directly via the Supabase client inside components or hooks; there is no caching layer
- Form state uses React Hook Form — never store form field values in a Context
- Active review cycle is provided by `CycleContext` — consume via `useCycle()` hook

### Styling

- All styling uses Tailwind CSS utility classes
- Custom design tokens (colors, fonts) are defined in `tailwind.config.js` — use those instead of arbitrary values
- Primary brand color: `primary-*` (navy)
- Accent color: `accent-*` (cyan)
- Background: `bglight`
- Fonts: `font-heading` (Montserrat), `font-body` (Inter)
- Do not use purple, indigo, or violet — use `primary`, `accent`, `emerald`, `sky`, or `gray`

### Comments

- Only comment the *why*, not the *what*
- Do not write docstrings or multi-line comment blocks on standard functions

---

## Review Cycles — Developer Notes

The review cycle system is central to all data queries. Key rules when writing new features:

1. **Always filter `skill_forms` by `activeCycle.id`** when displaying current-cycle data:
   ```typescript
   const { activeCycle } = useCycle();
   const { data } = await supabase
     .from('skill_forms')
     .select('*')
     .eq('cycle_id', activeCycle.id);
   ```

2. **Re-fetch when the cycle changes** — include `activeCycle` in your `useEffect` dependency array:
   ```typescript
   useEffect(() => {
     if (!activeCycle) return;
     loadData();
   }, [activeCycle]);
   ```

3. **Historical data comes from `skill_form_versions`**, not from `skill_forms`:
   ```typescript
   const { data: snapshots } = await supabase
     .from('skill_form_versions')
     .select('snapshot_data')
     .eq('cycle_id', selectedClosedCycleId);
   ```

4. **Never reset forms from the frontend directly** — use the RPC:
   ```typescript
   await supabase.rpc('activate_cycle_reset_forms', { p_cycle_id: cycle.id });
   ```
   A direct `.update()` on `skill_forms` matching all rows will fail silently because RLS prevents employees from updating other employees' forms.

5. **Snapshots are created automatically** by the `trg_skill_form_approval_snapshot` trigger — no manual snapshot creation is needed in application code.

---

## Adding a New Page

1. Create `src/pages/MyPage.tsx`
2. Add the route in `src/App.tsx` wrapped in `<PrivateRoute allowedRoles={[...]}>`:
   ```tsx
   <Route
     path="/my-page"
     element={
       <PrivateRoute allowedRoles={['tmg', 'admin']}>
         <MyPage />
       </PrivateRoute>
     }
   />
   ```
3. Add a sidebar link in `src/components/layout/Sidebar.tsx` inside the appropriate role group
4. If the page displays cycle-scoped data, add `CycleSelectorDropdown` in the top-right and apply the cycle-aware query pattern above

---

## Adding a New Settings Master Table

1. Write a migration:
   ```sql
   CREATE TABLE IF NOT EXISTS settings_my_items (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     name text UNIQUE NOT NULL,
     is_active boolean NOT NULL DEFAULT true,
     created_at timestamptz DEFAULT now()
   );
   ALTER TABLE settings_my_items ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Authenticated users can read my items"
     ON settings_my_items FOR SELECT TO authenticated USING (true);
   CREATE POLICY "TMG and admin can manage my items"
     ON settings_my_items FOR INSERT TO authenticated
     WITH CHECK (get_my_role() IN ('tmg', 'admin'));
   ```
2. Apply via `mcp__supabase__apply_migration`
3. Add a query + UI section in `src/pages/SettingsPage.tsx` (or `EmpSettingsPage.tsx` for grade/designation-style settings)

---

## Adding a New Form Step

1. Create the employee component: `src/pages/form/Step{N}MyStep.tsx`
2. Create the manager-review variant: `src/pages/form/Step{N}MyStepManager.tsx`
3. Add the step definition to `FORM_STEPS` in `src/types/form.ts`
4. Add the corresponding `useState` for the step's values in `SkillFormPage.tsx`
5. Render the step inside the step switcher in `SkillFormPage.tsx`
6. Persist the step's data inside `persistForm()` in `SkillFormPage.tsx`
7. Load the step's data from the DB in the `init()` function in `SkillFormPage.tsx`
8. Do the same for the manager review path in `ManagerReviewPage.tsx`

---

## Deploying Edge Functions

Use the Supabase MCP tool — do not use the CLI:

```
mcp__supabase__deploy_edge_function(
  slug: "my-function",
  verify_jwt: true
)
```

Function code lives in `supabase/functions/<slug>/index.ts`. Always:
- Wrap the entire handler in `try/catch`
- Return CORS headers on every response including errors
- Use `npm:` or `jsr:` prefixes for external imports
- Use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (pre-populated automatically) for service-role operations

---

## Google SSO Configuration

Google SSO is database-driven. When enabled, a "Continue with Google" button appears on the login page. All configuration is stored in the `sso_config` table and managed through the Admin panel.

### Prerequisites

Before enabling Google SSO in the Admin panel, you must configure Google OAuth in two places:

#### 1. Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (Application type: Web application)
3. Add your Supabase callback URL to **Authorized redirect URIs**:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
4. Copy the **Client ID** (you will need it in step 3 below)

#### 2. Supabase Dashboard

1. Open your Supabase project → Authentication → Providers → Google
2. Toggle **Google** to **enabled**
3. Paste the **Client ID** and **Client Secret** from Google Cloud Console
4. Save

#### 3. SkillSync Admin Panel

1. Sign in as an `admin` user
2. Navigate to the **Admin** page
3. In the **SSO Configuration** panel, enter the Google **Client ID**
4. Toggle **Enable Google SSO** to on and click **Save**
5. The login page will now show the Google button

### How It Works

The login page fetches `sso_config` on mount using an anon-accessible RLS policy — before the user is authenticated. This means the Google button only appears when the admin has enabled it in the DB, with no code deploy required.

```typescript
// LoginPage.tsx — fetch on mount (anon-accessible)
const { data } = await supabase
  .from('sso_config')
  .select('enabled')
  .eq('provider', 'google')
  .maybeSingle();
setSsoEnabled(data?.enabled ?? false);
```

OAuth uses the redirect flow (not popup): the browser navigates to Google's consent page, then returns to `window.location.origin` where Supabase exchanges the code for a session.

### First-Time Google Users

When a user signs in with Google for the first time, Supabase creates an `auth.users` entry automatically. However, the corresponding `public.users` profile row must be created manually by an admin (or add a `handle_new_user` trigger). Until the profile exists, the user will see a loading state and be signed out.

---

## Database Migrations

Apply migrations using `mcp__supabase__apply_migration`. See [DATABASE.md — Migrations](DATABASE.md#migrations) for conventions and the full migration history.

Key rules:
- Every migration file starts with a descriptive multi-line comment block
- Use `IF NOT EXISTS` / `IF EXISTS` guards on all DDL statements
- Never drop columns, tables, or data in production
- Enable RLS on every new table immediately after creation
- Use `get_my_role()` in policies to avoid recursive `users` table lookups

---

## Type Generation

The TypeScript types in `src/types/index.ts` and `src/types/form.ts` are hand-maintained. The key types related to cycles:

```typescript
// src/types/index.ts
export type CycleStatus = 'draft' | 'active' | 'closed';
export type CycleType = 'annual' | 'mid_year' | 'quarterly';

export interface ReviewCycle {
  id: string;
  name: string;
  cycle_type: CycleType;
  status: CycleStatus;
  created_at: string;
  activated_at: string | null;
  closed_at: string | null;
}

export const CYCLE_TYPE_LABELS: Record<CycleType, string> = {
  annual: 'Annual',
  mid_year: 'Mid-Year',
  quarterly: 'Quarterly',
};
```

If the schema changes significantly, update the interfaces to match. Future: Supabase CLI can auto-generate types with `supabase gen types typescript`.

---

## Testing

The project uses **Vitest** with `@testing-library/react` and `jsdom`. See [TEST_PLAN.md](TEST_PLAN.md) for full coverage details.

```bash
npx vitest          # watch mode
npx vitest run      # single run (CI)
```

Test files live in `src/test/`. The setup file `src/test/setup.ts` imports `@testing-library/jest-dom` matchers.

---

## Build and Deployment

### Local production build

```bash
npm run build
```

The `dist/` folder contains the static SPA. The app uses client-side routing — configure your host to serve `index.html` for all routes (`try_files $uri /index.html;` in nginx).

### Docker

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://xxx.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=eyJ... \
  -t skillsync:latest .
docker run -p 8080:80 skillsync:latest
```

`VITE_*` variables are inlined into the JS bundle at Docker build time. They cannot be changed at container runtime.

### AWS ECS (Production)

Deployments are fully automated via GitHub Actions. Merging to `main` triggers the CD workflow:

1. CI passes (lint + typecheck + tests)
2. Docker image built with Supabase credentials from GitHub Secrets
3. Image pushed to Amazon ECR
4. ECS task definition updated with the new image URI
5. ECS service performs a rolling deployment

See [ARCHITECTURE.md — CI/CD Pipeline](ARCHITECTURE.md#cicd-pipeline) for the full pipeline diagram.

**GitHub Secrets required:**
- `AWS_ROLE_ARN` — IAM role ARN for OIDC
- `AWS_REGION` — e.g. `ap-south-1`
- `ECR_REPOSITORY` — ECR repository name
- `ECS_CLUSTER` — ECS cluster name
- `ECS_SERVICE` — ECS service name
- `CONTAINER_NAME` — container name in task definition
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key
