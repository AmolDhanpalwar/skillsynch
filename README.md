# Haptiq SkillSync

A full-stack skill assessment platform for engineering teams. Employees complete a structured, multi-step skill profile form; managers review and annotate submissions; TMG and management access analytics, reporting, and configuration dashboards.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [User Roles](#user-roles)
- [Skill Assessment Form](#skill-assessment-form)
- [Documentation](#documentation)

---

## Overview

SkillSync streamlines the cyclical skill review process:

1. **Employees** fill a 5-step form capturing experience, languages, frameworks, environments, certifications, and growth plans.
2. **Managers** receive a notification, review each section, assign skill ratings, and either approve the form or return it for revision.
3. **TMG (Technical Managers)** oversee all team submissions, manage master data (skill lists, grades, designations), and monitor completion status.
4. **Management / Admin** access aggregated reports, analytics, and user administration.

All form data is persisted to Supabase Postgres with Row Level Security enforcing strict data isolation between users and roles.

---

## Features

| Area | Capability |
|---|---|
| Authentication | Email/password via Supabase Auth, role-based access control |
| Skill Form | 5-step guided form with auto-save (draft), validation, and submission workflow |
| Manager Review | Inline skill rating, per-section comments, approve / return with revision notes |
| Notifications | Real-time in-app notifications (Supabase Realtime + 60 s polling fallback) |
| Settings | Admin-managed master lists for skills, certifications, grades, designations, and rating scales |
| Reports & Export | Excel export (XLSX) for skill data, submission tracker, skills matrix, and settings |
| Skills Matrix | Aggregated view of employee skill ratings across languages, frameworks, and environments |
| TMG Dashboard | Per-employee status overview with grade, manager, and submission state |
| Power BI Guide | Step-by-step instructions for connecting exports to Power BI |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 5 |
| Styling | Tailwind CSS 3 (custom design tokens), Montserrat + Inter fonts |
| Forms | React Hook Form 7, Zod 4 |
| Routing | React Router DOM 7 |
| Backend | Supabase (Postgres, Auth, Realtime, Edge Functions) |
| Charts | Recharts |
| Export | XLSX (SheetJS) |
| Icons | Lucide React |

---

## Quick Start

### Prerequisites

- Node.js 18+
- A Supabase project (or use the existing one configured in `.env`)

### Install and run

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

The app runs at `http://localhost:5173`.

### Build for production

```bash
npm run build
npm run preview
```

### Type-check

```bash
npm run typecheck
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Both values are found in your Supabase project dashboard under **Settings > API**.

> The Supabase service role key is used only inside Edge Functions and is never exposed to the browser.

---

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── auth/          # PrivateRoute (role-gated routing)
│   │   ├── export/        # ExportModal
│   │   ├── form/          # Reusable form primitives (FormField, StatusBadge, StepIndicator, Toast)
│   │   ├── layout/        # AppShell, Header, Sidebar, Logo
│   │   ├── notifications/ # NotificationDrawer
│   │   └── ui/            # BackToTop, Skeleton
│   ├── context/
│   │   ├── AuthContext.tsx         # Session, user profile, sign-in/out
│   │   ├── FormContext.tsx         # Multi-step form navigation state
│   │   ├── NotificationContext.tsx # Real-time notification feed
│   │   └── ToastContext.tsx        # Global toast messages
│   ├── lib/
│   │   ├── supabaseClient.ts       # Singleton Supabase client
│   │   ├── useSkillRatings.ts      # Hook: load rating scale from DB
│   │   ├── exportService.ts        # Excel export helpers
│   │   └── seedUsers.ts            # Dev utility: seed demo users
│   ├── pages/
│   │   ├── form/                   # Step components (Step1Profile … Step4PlansManager)
│   │   ├── AdminPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── EmpSettingsPage.tsx
│   │   ├── InboxPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── ManagerReviewPage.tsx
│   │   ├── PowerBiHelpPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── SkillFormPage.tsx
│   │   ├── SkillsMatrixPage.tsx
│   │   ├── StatusPage.tsx
│   │   └── TmgDashboardPage.tsx
│   ├── types/
│   │   ├── index.ts                # UserProfile, UserRole, FormStatus
│   │   └── form.ts                 # Zod schemas, step value types, constants
│   ├── App.tsx                     # Route definitions
│   └── main.tsx
├── supabase/
│   ├── functions/                  # Edge Functions (Deno)
│   │   ├── admin-create-user/
│   │   ├── admin-reset-password/
│   │   ├── add-sample-employees/
│   │   └── seed-users/
│   └── migrations/                 # Ordered SQL migration files
└── docs/                           # Detailed documentation
```

---

## User Roles

| Role | Home Route | Primary Capability |
|---|---|---|
| `employee` | `/dashboard` | Complete and submit skill assessment form |
| `manager` | `/inbox` | Review and rate team members' forms |
| `tmg` | `/tmg-dashboard` | Oversee all submissions, manage settings |
| `management` | `/reports` | View aggregated reports and analytics |
| `admin` | `/admin` | Manage users, roles, and all master data |

See [docs/ROLES_AND_PERMISSIONS.md](docs/ROLES_AND_PERMISSIONS.md) for the full permission matrix and RLS policies.

---

## Skill Assessment Form

The employee-facing form has five steps:

| Step | Label | What is collected |
|---|---|---|
| 1 | Profile | Personal info, grade, designation, experience, manager |
| 2 | Skills | Programming languages and frameworks with self-ratings; tools and databases |
| 3 | Additional Skills | Environments, infrastructure, OS, management systems |
| 4 | Certifications | Professional certifications from master list |
| 5 | Plans & Submit | 6-month upskilling plan; manager's expectation plan (filled by manager) |

Submissions follow the lifecycle: **Draft → Pending Review → Approved / Returned → (re-submit)**.

See [docs/FORM_FLOW.md](docs/FORM_FLOW.md) for the complete lifecycle and business rules.

---

## Documentation

| Document | Description |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, component hierarchy, data flow |
| [docs/DATABASE.md](docs/DATABASE.md) | Full schema reference, RLS policies, migrations guide |
| [docs/ROLES_AND_PERMISSIONS.md](docs/ROLES_AND_PERMISSIONS.md) | Role definitions, permission matrix, route guards |
| [docs/FORM_FLOW.md](docs/FORM_FLOW.md) | Form lifecycle, step-by-step flow, validation rules |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local setup, coding conventions, adding features, deployment |
