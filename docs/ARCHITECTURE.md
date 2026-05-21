# Architecture

## Overview

SkillSync is a single-page application (SPA) built with React and backed entirely by Supabase. There is no custom API server — all data access goes through the Supabase JS client using Row Level Security (RLS) policies to enforce authorization, with a small number of Edge Functions handling privileged operations that require the service role key.

```
┌─────────────────────────────────────────────────────┐
│                    Browser (SPA)                     │
│                                                     │
│  React + TypeScript + Vite                          │
│  React Router (client-side routing)                 │
│  React Hook Form + Zod (form state & validation)    │
│  Tailwind CSS (styling)                             │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS / WebSocket
                        ▼
┌─────────────────────────────────────────────────────┐
│                    Supabase                          │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │  Auth    │  │ Postgres │  │  Edge Functions   │ │
│  │          │  │ + RLS    │  │  (Deno)           │ │
│  └──────────┘  └──────────┘  └───────────────────┘ │
│                      │                              │
│               ┌──────────────┐                      │
│               │   Realtime   │ (notifications)      │
│               └──────────────┘                      │
└─────────────────────────────────────────────────────┘
```

---

## Frontend

### Entry Point

`src/main.tsx` mounts the React app inside `<React.StrictMode>` with all context providers:

```
BrowserRouter
  └── ToastProvider
        └── AuthProvider
              └── NotificationProvider
                    └── App (route definitions)
```

### Routing (`src/App.tsx`)

All protected routes are wrapped in `<PrivateRoute allowedRoles={[...]} />`, which checks the authenticated user's role before rendering the page. Unauthorized users are redirected to `/login`; authenticated users accessing `/login` are redirected to their role-specific home.

```
/login                          → LoginPage (public)
/                               → redirect → /login

/dashboard                      → DashboardPage        [employee, manager, tmg, management, admin]
/form                           → SkillFormPage         [employee]
/form/review/:formId            → ManagerReviewPage     [manager, tmg, admin]
/inbox                          → InboxPage             [manager, tmg, admin]
/inbox/review/:formId           → ManagerReviewPage     [manager, tmg, admin]
/tmg-dashboard                  → TmgDashboardPage      [tmg, management, admin]
/skills-matrix                  → SkillsMatrixPage      [tmg, management, admin]
/status                         → StatusPage            [tmg, management, admin]
/reports                        → ReportsPage           [management, admin]
/settings                       → SettingsPage          [tmg, admin]
/emp-settings                   → EmpSettingsPage       [tmg, admin]
/admin                          → AdminPage             [admin]
/help/powerbi                   → PowerBiHelpPage       [all authenticated]
```

### Component Hierarchy

```
AppShell
├── Header
│   ├── Logo
│   ├── GlobalSearch
│   ├── NotificationBell → NotificationDrawer
│   └── UserMenu (name, role, sign out)
├── Sidebar
│   └── NavLinks (filtered by role)
└── <page content />
```

### Context Providers

| Context | Purpose | Key exports |
|---|---|---|
| `AuthContext` | Supabase session + user profile | `user`, `session`, `loading`, `signIn()`, `signOut()`, `refreshProfile()` |
| `FormContext` | Step navigation within SkillFormPage | `currentStep`, `setCurrentStep`, `formId`, `formStatus` |
| `NotificationContext` | Real-time notification feed | `notifications`, `unreadCount`, `markRead()`, `markAllRead()` |
| `ToastContext` | Global transient messages | `toast()`, `success()`, `error()`, `info()`, `warning()` |

### Data Flow: Skill Form

```
SkillFormPage
├── useForm (React Hook Form + Zod resolver built from DB-validated options)
├── Step1Profile         reads: settings_grades, settings_designations, users
│                        writes: form state (grade, designation, manager, etc.)
├── Step2Skills          reads: settings_languages, settings_frameworks,
│                                settings_tools, settings_databases, settings_skill_ratings
│                        writes: step2 state
├── Step3Additional      reads: settings_environments, settings_skill_ratings
│                        writes: stepAdditional state
├── Step3Certifications  reads: settings_certifications
│                        writes: step3 state
└── Step4Plans           reads/writes: step4 state
    └── handleNext / handleSaveDraft → persistForm()
                                        → upsert skill_forms
                                        → upsert skill_items
                                        → update users (grade, designation, manager_id)
                                        → insert notifications (on submit)
```

### Data Flow: Manager Review

```
ManagerReviewPage
├── fetch skill_forms (by formId)
├── fetch skill_items (by formId)
├── Step2SkillsManager       manager can edit ratings & comments
├── Step3AdditionalManager   manager can edit ratings & comments
├── Step3CertificationsManager
├── Step4PlansManager        manager fills expectation plan
└── handleApprove / handleReturn
    → update skill_forms.status = 'approved' | 'returned'
    → update skill_items (manager_rating, manager_comment)
    → insert notifications (notify employee)
```

---

## Backend

### Supabase Client (`src/lib/supabaseClient.ts`)

A single client instance is created at module load time using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. All queries from the browser use the anon key — the RLS policies on each table determine what each authenticated user can see and modify.

### Edge Functions

Edge Functions run in Deno and use the Supabase service role key (available automatically as `SUPABASE_SERVICE_ROLE_KEY`), allowing them to bypass RLS for privileged operations.

| Function | Trigger | Purpose |
|---|---|---|
| `seed-users` | POST (dev utility) | Populate initial demo users and auth accounts |
| `admin-create-user` | POST from AdminPage | Create an auth account + public.users profile row atomically |
| `admin-reset-password` | POST from AdminPage | Reset a user's auth password |
| `add-sample-employees` | POST (dev utility) | Insert additional sample employee data |

All Edge Functions implement CORS headers and wrap their body in a `try/catch` to return structured JSON errors.

### Authentication

Supabase Auth handles session management. On successful login the client stores the JWT in `localStorage`. `AuthContext` listens to `onAuthStateChange` and re-fetches the `users` profile row on every session event to keep `user.role`, `user.grade`, and other profile fields current.

```
signInWithPassword(email, password)
  └── onAuthStateChange fires
        └── fetchProfile() → SELECT * FROM users WHERE id = auth.uid()
              └── sets user: UserProfile in context
                    └── PrivateRoute evaluates user.role → redirect or render
```

---

## State Management Summary

SkillSync does **not** use a global state library (Redux, Zustand, etc.). State is managed at three levels:

| Level | Tool | Where |
|---|---|---|
| Server state | Supabase JS client (direct queries) | Inside page components and hooks |
| Form state | React Hook Form | `SkillFormPage` and `ManagerReviewPage` |
| Cross-component UI state | React Context | Auth, Form step, Notifications, Toasts |
| Local ephemeral | `useState` / `useRef` | Inside individual components |

Auto-save uses `localStorage` as a draft buffer while the user is on Step 1 (before first DB persist). Once a form record exists in Supabase, the DB is the source of truth and the localStorage draft is discarded.

---

## File Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Pages | PascalCase + `Page` suffix | `DashboardPage.tsx` |
| Form steps | `Step{N}{Name}[Manager].tsx` | `Step2SkillsManager.tsx` |
| Contexts | PascalCase + `Context` suffix | `AuthContext.tsx` |
| Hooks | camelCase + `use` prefix | `useSkillRatings.ts` |
| Services | camelCase + `Service` suffix | `exportService.ts` |
| Types | camelCase or PascalCase, grouped by domain | `form.ts`, `index.ts` |
