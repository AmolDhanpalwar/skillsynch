# Database

SkillSync uses **Supabase Postgres** as its sole data store. The schema is applied through versioned migration files in `supabase/migrations/`. Row Level Security (RLS) is enabled on every table.

---

## Table of Contents

- [Schema Diagram](#schema-diagram)
- [Core Tables](#core-tables)
  - [users](#users)
  - [review_cycles](#review_cycles)
  - [skill_forms](#skill_forms)
  - [skill_form_versions](#skill_form_versions)
  - [skill_items](#skill_items)
  - [notifications](#notifications)
- [Settings Master Tables](#settings-master-tables)
- [Views](#views)
- [SECURITY DEFINER Functions](#security-definer-functions)
- [Triggers](#triggers)
- [Row Level Security](#row-level-security)
- [Helper Functions](#helper-functions)
- [Migrations](#migrations)

---

## Schema Diagram

```
auth.users (Supabase managed)
    │
    ▼
users ──────────────────────────────────────────────┐
  id (PK, refs auth.users)                          │ manager_id (self-FK)
  email, full_name, employee_number                 │
  designation, grade                                │
  role (employee|manager|tmg|management|admin)      │
  manager_id (FK → users.id, nullable)  ────────────┘
  is_active
  created_at
    │
    ├──── skill_forms ──────────────────────────────────────┐
    │       id (PK)                                         │
    │       employee_id (FK → users)                        │
    │       manager_id (FK → users, nullable)               │
    │       cycle_id (FK → review_cycles)                   │
    │       status (draft|pending_review|returned|approved) │
    │       grade, designation, employee_name, ...          │
    │       submitted_at, approved_at                       │
    │           │                                           │
    │           └──── skill_items                           │
    │                   form_id (FK → skill_forms, CASCADE) │
    │                   category, name                      │
    │                   employee_rating, manager_rating     │
    │                   manager_comment, sort_order         │
    │                                                       │
    └──── skill_form_versions  ◄─── (trigger from approve) ┘
            employee_id (FK → users)
            cycle_id (FK → review_cycles)
            snapshot_data (JSONB)
            approved_at
            UNIQUE (employee_id, cycle_id)

review_cycles
  id (PK)
  name
  cycle_type (mid_year|full_year|custom)
  status (draft|active|closed|suspended)
  created_at, triggered_at, closed_at, suspended_at

notifications
  user_id (FK → users)
  type, message, is_read
  form_id (FK → skill_forms, nullable)
  created_at

sso_config                              ← NEW (migration 20260608)
  id (PK)
  provider (UNIQUE)                     — 'google'
  enabled (boolean)
  client_id (text, nullable)
  updated_by (FK → users, nullable)
  updated_at

settings_grades | settings_designations | settings_languages | settings_frameworks
settings_tools  | settings_databases    | settings_environments | settings_certifications
settings_skill_ratings
```

---

## Core Tables

### users

Mirrors `auth.users` with additional profile fields. Created automatically when a user is added via the `admin-create-user` Edge Function or on first login.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, references `auth.users(id)` |
| `email` | `text` | Unique, not null |
| `full_name` | `text` | Display name |
| `employee_number` | `text` | e.g. `EMP001` |
| `designation` | `text` | Validated against `settings_designations` |
| `grade` | `text` | Validated against `settings_grades` |
| `role` | `text` | One of: `employee`, `manager`, `tmg`, `management`, `admin` |
| `manager_id` | `uuid` | FK → `users(id)`, nullable |
| `is_active` | `boolean` | Default `true`; inactive users cannot log in |
| `created_at` | `timestamptz` | Default `now()` |

**Indexes:** `email` (unique), `manager_id`.

---

### review_cycles

One record per review cycle. Only one cycle may have `status = 'active'` at a time.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `name` | `text` | Display name, e.g. `"Mid Year Cycle 2026"` |
| `cycle_type` | `text` | `mid_year` \| `full_year` \| `custom` |
| `status` | `text` | `draft` \| `active` \| `closed` \| `suspended` |
| `employee_deadline` | `timestamptz` | Deadline for employees to submit |
| `manager_deadline` | `timestamptz` | Deadline for managers to review |
| `triggered_at` | `timestamptz` | Set when status → `active` |
| `closed_at` | `timestamptz` | Set when status → `closed` |
| `suspended_at` | `timestamptz` | Set when status → `suspended` |
| `suspension_reason` | `text` | Reason entered by the admin/TMG who suspended |
| `suspended_by` | `uuid` | FK → `users(id)`, nullable |
| `created_by` | `uuid` | FK → `users(id)`, nullable |
| `notes` | `text` | Optional notes |
| `created_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Updated on every change |

---

### skill_forms

One record per employee per review cycle. Upserted on every Save Draft or submission.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `employee_id` | `uuid` | FK → `users(id)` |
| `manager_id` | `uuid` | FK → `users(id)`, nullable |
| `cycle_id` | `uuid` | FK → `review_cycles(id)` |
| `status` | `text` | `draft` \| `pending_review` \| `returned` \| `approved` |
| `employee_name` | `text` | Denormalized from `users.full_name` at save time |
| `employee_email` | `text` | Denormalized |
| `employee_number` | `text` | Denormalized |
| `designation` | `text` | Denormalized |
| `grade` | `text` | Denormalized |
| `current_project` | `text` | |
| `total_exp` | `numeric(4,1)` | Total professional experience in years |
| `relevant_exp` | `numeric(4,1)` | Role-relevant experience |
| `haptiq_exp` | `numeric(4,1)` | Years at Haptiq |
| `tools` | `text` | Comma/newline-separated tools list |
| `databases` | `text` | Comma/newline-separated databases list |
| `tools_manager_comment` | `text` | Manager annotation |
| `databases_manager_comment` | `text` | Manager annotation |
| `environments_manager_comment` | `text` | Manager annotation |
| `certifications` | `text[]` | Array of certification names |
| `upskilling_plan` | `text` | Employee's 6-month learning plan |
| `manager_expectation_plan` | `text` | Manager's expectations (filled during review) |
| `submitted_at` | `timestamptz` | Set when status → `pending_review` |
| `approved_at` | `timestamptz` | Set when status → `approved` |
| `manager_review_date` | `timestamptz` | Set when manager first opens the form |
| `created_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Updated on every upsert |

**Indexes:** `employee_id`, `manager_id`, `status`, `cycle_id`.

---

### skill_form_versions

Immutable JSONB snapshots of approved forms. One record per employee per cycle. Written by the `create_approval_snapshot()` trigger — never written directly from the frontend.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `employee_id` | `uuid` | FK → `users(id)` |
| `cycle_id` | `uuid` | FK → `review_cycles(id)` |
| `snapshot_data` | `jsonb` | Full denormalized snapshot: form fields + `skill_items[]` |
| `approved_at` | `timestamptz` | Copied from the form at snapshot time |
| `created_at` | `timestamptz` | Default `now()` |

**Unique constraint:** `(employee_id, cycle_id)` — one snapshot per employee per cycle. On re-approval it updates (UPSERT).

**`snapshot_data` shape:**
```json
{
  "id": "...",
  "employee_name": "...",
  "grade": "...",
  "designation": "...",
  "status": "approved",
  "cycle_id": "...",
  "skill_items": [
    { "category": "language", "name": "Python", "employee_rating": 3, "manager_rating": 3, "manager_comment": "" }
  ],
  ...all other skill_forms columns...
}
```

---

### skill_items

Individual skill rows inside a form. Deleted and re-inserted on every save.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `form_id` | `uuid` | FK → `skill_forms(id)`, CASCADE delete |
| `category` | `text` | `language` \| `framework` \| `environment` |
| `name` | `text` | Skill name (e.g. `Python`, `React`) |
| `employee_rating` | `smallint` | 0–4, nullable (null = not rated yet) |
| `manager_rating` | `smallint` | 0–4, nullable |
| `manager_comment` | `text` | Default `''` |
| `sort_order` | `smallint` | Display order within category |

**Indexes:** `form_id`, `(form_id, category)`.

---

### notifications

In-app notification feed. Inserted by client-side code after submit/approve/return.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `users(id)` — recipient |
| `type` | `text` | e.g. `form_submitted`, `form_approved`, `form_returned` |
| `message` | `text` | Human-readable message |
| `is_read` | `boolean` | Default `false` |
| `form_id` | `uuid` | FK → `skill_forms(id)`, nullable |
| `created_at` | `timestamptz` | Default `now()` |

---

## Settings Master Tables

All settings tables share the same basic shape. Managed via the Settings and Employee Settings pages (TMG / admin only).

| Table | Extra columns | Purpose |
|---|---|---|
| `settings_grades` | `sort_order` | Grade levels (IC01–IC12, MGMT05–MGMT15) |
| `settings_designations` | `grade_id` (FK → settings_grades) | Job titles grouped by grade |
| `settings_languages` | — | Programming languages master list |
| `settings_frameworks` | — | Frameworks / libraries master list |
| `settings_tools` | — | Tools (CI/CD, IDE, monitoring, etc.) |
| `settings_databases` | — | Database technologies |
| `settings_environments` | `is_haptiq_demand` | Cloud, OS, infrastructure environments |
| `settings_certifications` | — | Professional certifications |
| `settings_skill_ratings` | `sort_order`, `label` | Rating scale descriptors (e.g. "Beginner", "Expert") |

All settings tables include `is_active` (boolean, default `true`). Deactivated records are hidden in dropdowns but historical form data referencing them is preserved.

---

## SSO Configuration Table

### `sso_config`

Stores admin-managed Single Sign-On provider settings. Currently supports Google OAuth 2.0. One row per provider — seeded with a disabled `google` row on initial migration.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `provider` | `text` | `UNIQUE`. Currently only `'google'` is supported |
| `enabled` | `boolean` | Default `false`. When `true`, the Google button appears on the login page |
| `client_id` | `text` | Google OAuth Client ID (`*.apps.googleusercontent.com`). Nullable — can be saved without enabling |
| `updated_by` | `uuid` | FK → `users(id)`, nullable. Last admin to save the config |
| `updated_at` | `timestamptz` | Updated on every admin save |

**RLS policies:**
- `admin_all_sso_config` — admin role can SELECT / INSERT / UPDATE / DELETE
- `authenticated_read_sso_config` — all authenticated users can SELECT (needed by admin panel and post-login pages)
- `anon_read_sso_config` — anonymous users can SELECT (needed by login page before any sign-in)

**Important:** `client_id` stored here is for display/button control only. The actual OAuth handshake uses the Client ID configured in the Supabase Dashboard → Authentication → Providers → Google. Both must match.

---

## Views

### `privileged_skill_forms_view`

A view joining `skill_forms` with the manager's `full_name` and employee profile fields. Used by TMG/management dashboards. Only accessible to users with `tmg`, `management`, or `admin` roles via RLS on the underlying tables.

---

## SECURITY DEFINER Functions

These functions run as the `postgres` superuser role and bypass RLS. Required for cycle state transitions that need to update rows not owned by the calling user.

### `activate_cycle_reset_forms(p_cycle_id uuid)`

Called via `supabase.rpc('activate_cycle_reset_forms', { p_cycle_id })` from `CyclesPage` when a manager or TMG activates a new review cycle.

**What it does:**
1. Sets `review_cycles.status = 'active'`, `activated_at = now()` for the given cycle
2. Sets all other cycles' `status = 'closed'` (or `'draft'` if they were never activated) where status was `'active'`
3. Resets **all** `skill_forms` rows: `status = 'draft'`, `cycle_id = p_cycle_id`, clears `submitted_at`, `approved_at`

**Grant:** `GRANT EXECUTE ON FUNCTION activate_cycle_reset_forms(uuid) TO authenticated;`

### `create_approval_snapshot()` (trigger function)

Not called directly — fires automatically via `trg_skill_form_approval_snapshot`.

**What it does:**
1. Reads all `skill_items` for the approved form
2. Builds a JSONB document containing all `skill_forms` columns plus `skill_items[]`
3. Upserts into `skill_form_versions` on `(employee_id, cycle_id)`

---

## Triggers

### `trg_skill_form_approval_snapshot`

```sql
CREATE TRIGGER trg_skill_form_approval_snapshot
  AFTER UPDATE ON skill_forms
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'approved')
  EXECUTE FUNCTION create_approval_snapshot();
```

Fires once per approval event. The resulting snapshot in `skill_form_versions` is the permanent historical record for that employee in that cycle.

---

## Row Level Security

RLS is **enabled on every table**. After RLS is enabled, no rows are accessible by default — every access pattern requires an explicit policy.

### users table

| Operation | Who | Condition |
|---|---|---|
| SELECT | All authenticated | Any active user (needed for manager lookups) |
| INSERT | Admin / Edge Function | Service role only |
| UPDATE | Authenticated | Own record (`auth.uid() = id`), OR `get_my_role() IN ('tmg', 'admin')` |
| DELETE | Admin only | `get_my_role() = 'admin'` |

### review_cycles table

| Operation | Who | Condition |
|---|---|---|
| SELECT | All authenticated | All cycles visible |
| INSERT | TMG / admin | `get_my_role() IN ('tmg', 'admin')` |
| UPDATE | TMG / admin | `get_my_role() IN ('tmg', 'admin')` |
| DELETE | Admin only | `get_my_role() = 'admin'` |

### skill_forms table

| Operation | Who | Condition |
|---|---|---|
| SELECT | Employee | `employee_id = auth.uid()` |
| SELECT | Manager | `manager_id = auth.uid()` |
| SELECT | TMG / management / admin | `get_my_role() IN ('tmg', 'management', 'admin')` |
| INSERT | Employee | `employee_id = auth.uid()` |
| UPDATE | Employee | Own form AND status is `draft` or `returned` |
| UPDATE | Manager | `manager_id = auth.uid()` |
| UPDATE | TMG / admin | `get_my_role() IN ('tmg', 'admin')` |

### skill_form_versions table

| Operation | Who | Condition |
|---|---|---|
| SELECT | Employee | `employee_id = auth.uid()` |
| SELECT | TMG / management / admin | `get_my_role() IN ('tmg', 'management', 'admin')` |
| SELECT | Manager | Via `manager_id` on the parent form |
| INSERT / UPDATE | SECURITY DEFINER function only | Not accessible from the anon key |

### skill_items table

| Operation | Who | Condition |
|---|---|---|
| SELECT | Employee | Via form ownership |
| SELECT | Manager | Via `manager_id` on parent form |
| SELECT | TMG / admin | Any |
| INSERT / DELETE | Employee | Own forms (draft/returned only) |
| INSERT / DELETE | Manager | Forms assigned to them |

### notifications table

| Operation | Who | Condition |
|---|---|---|
| SELECT | Authenticated | `user_id = auth.uid()` |
| INSERT | Authenticated | `user_id = auth.uid()` |
| UPDATE | Authenticated | Own records (mark read) |

### settings tables

| Operation | Who | Condition |
|---|---|---|
| SELECT | All authenticated | Any active user |
| INSERT / UPDATE / DELETE | TMG / admin | `get_my_role() IN ('tmg', 'admin')` |

---

## Helper Functions

### `get_my_role()`

```sql
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;
```

Used in RLS policies to avoid recursive `SELECT` on the `users` table inside RLS checks. Declared `STABLE` so Postgres can cache the result within a single query.

---

## Migrations

Migrations are in `supabase/migrations/` and are applied in filename order (timestamp-prefixed). Apply via `mcp__supabase__apply_migration`.

### Current Migrations

| File | Summary |
|---|---|
| `20260415074326_create_skillsync_schema.sql` | Initial schema: `users`, `skill_forms`, `skill_items`, `notifications`, all settings tables, base RLS policies |
| `20260415091026_add_manager_view_policy.sql` | Adds SELECT policy for managers on `skill_forms` |
| `20260415092936_add_notifications_insert_policy.sql` | Allows authenticated users to insert their own notifications |
| `20260415102307_add_is_active_to_users.sql` | Adds `is_active` column to `users` |
| `20260415143001_add_reminders_and_review_date_to_skill_forms.sql` | Adds `manager_review_date`, reminder columns |
| `20260415144723_add_manager_to_privileged_skill_forms_view.sql` | Updates view to include manager name |
| `20260415162655_add_settings_master_tables.sql` | Adds `settings_certifications`, `settings_environments`, etc. |
| `20260427064527_add_profile_fields_to_skill_forms.sql` | Adds denormalized profile fields to `skill_forms` |
| `20260427073517_add_employee_delete_skill_items_policy.sql` | Allows employees to delete their own skill items |
| `20260427075825_manager_id_any_role_policies.sql` | Updates policies to allow manager by `manager_id` on any role |
| `20260427081440_add_emp_settings_tables.sql` | Adds `settings_grades`, `settings_designations` |
| `20260427093535_add_employee3_4_5_auth_users.sql` | Seeds additional demo users |
| `20260427094213_add_tmg_update_users_policy.sql` | TMG/admin can update any user record |
| `20260427094621_add_tmg_skill_forms_update_policy.sql` | TMG/admin can update any form |
| `20260427094933_add_manager_can_view_direct_reports_policy.sql` | Manager can view employee profiles |
| `20260519073712_add_manager_skill_items_delete_insert_policies.sql` | Manager can insert/delete skill items on assigned forms |
| `20260519135237_fix_manager_can_view_form_employees.sql` | Fixes manager SELECT policy on `users` |
| `20260519135741_fix_users_policy_infinite_recursion.sql` | Uses `get_my_role()` to prevent RLS recursion |
| `20260519140504_fix_users_update_policies_use_get_my_role.sql` | Migrates all UPDATE policies to use `get_my_role()` |
| `20260520153944_fix_designations_unique_constraint_and_seed.sql` | Fixes unique constraint on designations, seeds data |
| `20260520160626_add_environments_skill_category.sql` | Adds `environment` to `skill_items.category` enum |
| `20260520165114_add_settings_skill_ratings.sql` | Adds `settings_skill_ratings` table |
| `20260520171119_add_is_haptiq_demand_to_skill_masters.sql` | Adds `is_haptiq_demand` to `settings_environments` |
| `20260520173855_reset_all_skill_forms_to_draft.sql` | One-time reset: all forms back to draft for data correction |
| `20260526160937_20260526000001_add_review_cycles_and_versioning.sql` | Adds `review_cycles` table, `skill_form_versions` table, `cycle_id` FK on `skill_forms`, `CycleType` enum labels, RLS policies for both new tables |
| `20260528084913_create_missing_snapshots_and_approval_trigger.sql` | Backfills 4 missing snapshots for closed cycle, creates `create_approval_snapshot()` SECURITY DEFINER trigger function, creates `trg_skill_form_approval_snapshot` trigger, creates `activate_cycle_reset_forms()` SECURITY DEFINER RPC function |
| `20260608114003_add_sso_config_table.sql` | Adds `sso_config` table for DB-driven SSO feature flags; seeds Google provider row (disabled); adds three RLS policies: admin full-access, authenticated read, anon read |
| `20260609072254_20260609000001_drop_db_business_logic.sql` | Drops `trg_skill_form_approval_snapshot` trigger and SECURITY DEFINER functions `create_approval_snapshot()`, `activate_cycle_reset_forms()`, `suspend_cycle()` — business logic moved to Edge Functions |

### Adding a New Migration

Use the Supabase MCP tool:

```
mcp__supabase__apply_migration(
  filename: "YYYYMMDDHHMMSS_descriptive_name",
  content: "-- SQL here"
)
```

**Rules:**
- Always begin the file with a multi-line comment block summarizing the change
- Use `IF NOT EXISTS` / `IF EXISTS` guards on all DDL
- Enable RLS immediately after creating any new table: `ALTER TABLE t ENABLE ROW LEVEL SECURITY;`
- Never use `DROP` or `DELETE` on production data
- Never use explicit transaction control (`BEGIN` / `COMMIT`)

**After applying a migration, update `supabase/full_schema.sql` to keep it in sync.**

---

## Full Schema Script

`supabase/full_schema.sql` is a complete, idempotent snapshot of the entire database schema. It consolidates all migrations into a single file that can be applied to a fresh Supabase project.

**Use it when:**
- Provisioning a new Supabase project from scratch
- Recovering from catastrophic database loss
- Syncing a staging or QA environment

**To apply it:** paste the contents into the Supabase SQL Editor and click Run. Do not include it in the normal migrations sequence.
