# Development Guide

---

## Local Setup

### 1. Prerequisites

- Node.js 18+ (check: `node -v`)
- npm 9+ (check: `npm -v`)
- A Supabase project with the schema applied (see [DATABASE.md](DATABASE.md))

### 2. Clone and install

```bash
git clone <repo-url>
cd skillsync
npm install
```

### 3. Configure environment

Copy `.env.example` (or create `.env`) and fill in your Supabase credentials:

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

---

## Demo Users

The database is pre-seeded with demo accounts. All passwords follow the pattern shown below.

| Role | Email | Password |
|---|---|---|
| Employee | `employee1@haptiq.com` | `emp@123` |
| Employee | `employee2@haptiq.com` | `emp@123` |
| Employee | `employee3@haptiq.com` | `emp@123` |
| Manager (TMG) | `tmg@haptiq.com` | `tmg@123` |
| Admin | `admin@haptiq.com` | `admin@123` |

Additional accounts may exist depending on seed data applied.

---

## Project Conventions

### TypeScript

- Strict mode is on (`"strict": true` in `tsconfig.app.json`)
- Always prefer explicit types over `any`
- Use `type` imports for type-only imports: `import type { Foo } from './types'`

### Component structure

- One component per file
- Pages live in `src/pages/`; reusable UI in `src/components/`
- Step components for the skill form live in `src/pages/form/`
- Manager-specific variants of step components are named `Step{N}{Name}Manager.tsx`

### State

- Do not introduce a global state library (Redux, Zustand, etc.) — use React Context for shared state and `useState`/`useReducer` locally
- Server data is fetched directly via the Supabase client inside components or hooks; there is no caching layer
- Form state uses React Hook Form — never store form field values in a Context

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
   -- SELECT for all authenticated
   CREATE POLICY "Authenticated users can read my items"
     ON settings_my_items FOR SELECT TO authenticated USING (true);
   -- INSERT/UPDATE/DELETE for tmg and admin
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

The TypeScript types in `src/types/index.ts` and `src/types/form.ts` are hand-maintained. If the schema changes significantly, update the interfaces to match.

Future: Supabase CLI can auto-generate types with `supabase gen types typescript`. Until then, keep types in sync manually whenever a migration adds or removes columns.

---

## Testing

The project uses **Vitest** with `@testing-library/react` and `jsdom`.

```bash
npx vitest          # watch mode
npx vitest run      # single run
```

Test files live in `src/test/`. The setup file `src/test/setup.ts` imports `@testing-library/jest-dom` matchers.

Currently only `src/test/experienceFields.test.tsx` exists. New tests should follow the same pattern: render a component in isolation, interact via `userEvent`, and assert on the DOM.

---

## Build and Deployment

```bash
npm run build
```

The `dist/` folder contains the static SPA. Deploy to any static host (Vercel, Netlify, Cloudflare Pages, S3 + CloudFront).

**Important:** The app uses client-side routing. Configure your host to serve `index.html` for all routes (a catch-all / 404 rewrite rule):

- Vercel: `vercel.json` → `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
- Netlify: `_redirects` file → `/* /index.html 200`
- Nginx: `try_files $uri /index.html;`

Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) must be set in the hosting platform's environment settings at build time — they are inlined by Vite into the bundle.
