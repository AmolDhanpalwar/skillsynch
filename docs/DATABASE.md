# Database

SkillSync uses **Supabase Postgres** as its sole data store. The schema is applied through versioned migration files in `supabase/migrations/`. Row Level Security (RLS) is enabled on every table.

---

## Table of Contents

- [Schema Diagram](#schema-diagram)
- [Core Tables](#core-tables)
  - [users](#users)
  - [skill_forms](#skill_forms)
  - [skill_items](#skill_items)
  - [notifications](#notifications)
- [Settings Master Tables](#settings-master-tables)
- [Views](#views)
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
    ├──── skill_forms
    │       id (PK)
    │       employee_id (FK → users)
    │       manager_id (FK → users, nullable)
    │       status (draft|pending_review|returned|approved)
    │       grade, designation, employee_name, employee_email
    │       employee_number, current_project
    │       total_exp, relevant_exp, haptiq_exp (numeric)
    │       tools, databases (text)
    │       tools_manager_comment, databases_manager_comment
    │       environments_manager_comment
    │       certifications (text[])
    │       upskilling_plan, manager_expectation_plan (text)
    │       submitted_at, approved_at, manager_review_date
    │       created_at, updated_at
    │           │
    │           └──── skill_items
    │                   id (PK)
    │                   form_id (FK → skill_forms)
    │                   category (language|framework|environment)
    │                   name (text)
    │                   employee_rating (smallint 0–4, nullable)
    │                   manager_rating (smallint 0–4, nullable)
    │                   manager_comment (text)
    │                   sort_order (smallint)
    │
    └──── notifications
            id (PK)
            user_id (FK → users)
            type (text)
            message (text)
            is_read (boolean, default false)
            form_id (FK → skill_forms, nullable)
            created_at

settings_grades
  id (PK)
  name (text, unique)
  sort_order (int)
  is_active (boolean)

settings_designations
  id (PK)
  grade_id (FK → settings_grades)
  name (text)
  is_active (boolean)

settings_certifications | settings_languages | settings_frameworks
settings_tools          | settings_databases | settings_environments
  id (PK)
  name (text, unique)
  is_active (boolean)
  created_at
  [settings_environments also has: is_haptiq_demand (boolean)]

settings_skill_ratings
  id (PK)
  sort_order (int, unique)
  label (text)
  is_active (boolean)
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

### skill_forms

One record per employee per review cycle. Upserted on every Save Draft or submission.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `employee_id` | `uuid` | FK → `users(id)` |
| `manager_id` | `uuid` | FK → `users(id)`, nullable |
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

**Indexes:** `employee_id`, `manager_id`, `status`.

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

In-app notification feed. Inserted by server-side code (after submit, approve, return).

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

All settings tables share the same basic shape. They are managed via the Settings and Employee Settings pages (TMG / admin only).

| Table | Extra columns | Purpose |
|---|---|---|
| `settings_grades` | `sort_order`, `id` (uuid PK) | Grade levels (IC01–IC12, MGMT05–MGMT15) |
| `settings_designations` | `grade_id` (FK) | Job titles grouped by grade |
| `settings_languages` | — | Programming languages master list |
| `settings_frameworks` | — | Frameworks / libraries master list |
| `settings_tools` | — | Tools (CI/CD, IDE, monitoring, etc.) |
| `settings_databases` | — | Database technologies |
| `settings_environments` | `is_haptiq_demand` | Cloud, OS, infrastructure environments |
| `settings_certifications` | — | Professional certifications |
| `settings_skill_ratings` | `sort_order`, `label` | Rating scale descriptors (e.g. "Beginner", "Expert") |

All settings tables include `is_active` (boolean, default `true`). Deactivated records are hidden in dropdowns but historical form data referencing them is preserved.

---

## Views

### `privileged_skill_forms_view`

A view joining `skill_forms` with the manager's name and employee details. Used by TMG/management dashboards. Only accessible to users with `tmg`, `management`, or `admin` roles via RLS on the underlying tables.

---

## Row Level Security

RLS is **enabled on every table**. After RLS is enabled, no rows are accessible by default — every access pattern requires an explicit policy.

### Key Policies

#### users table

| Operation | Who | Condition |
|---|---|---|
| SELECT | All authenticated | Any active user (needed for manager lookups) |
| INSERT | Admin / Edge Function | Service role only |
| UPDATE | Authenticated | Own record (`auth.uid() = id`), OR TMG/admin updating any |
| DELETE | Admin only | `get_my_role() IN ('admin')` |

#### skill_forms table

| Operation | Who | Condition |
|---|---|---|
| SELECT | Employee | `employee_id = auth.uid()` |
| SELECT | Manager | `manager_id = auth.uid()` |
| SELECT | TMG / management / admin | `get_my_role() IN (...)` |
| INSERT | Employee | `employee_id = auth.uid()` |
| UPDATE | Employee | Own form AND status is `draft` or `returned` |
| UPDATE | Manager | `manager_id = auth.uid()` |
| UPDATE | TMG / admin | Any form |

#### skill_items table

| Operation | Who | Condition |
|---|---|---|
| SELECT | Employee | Via form ownership |
| SELECT | Manager | Via `manager_id` on parent form |
| SELECT | TMG / admin | Any |
| INSERT / DELETE | Employee | Own forms (draft/returned only) |
| INSERT / DELETE | Manager | Forms assigned to them |

#### notifications table

| Operation | Who | Condition |
|---|---|---|
| SELECT | Authenticated | `user_id = auth.uid()` |
| INSERT | Authenticated | `user_id = auth.uid()` (triggered after form submit) |
| UPDATE | Authenticated | Own records (mark read) |

#### settings tables

| Operation | Who | Condition |
|---|---|---|
| SELECT | All authenticated | Any active user |
| INSERT / UPDATE / DELETE | TMG / admin | `get_my_role() IN ('tmg', 'admin')` |

### Helper Function: `get_my_role()`

```sql
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;
```

Used in policies to avoid recursive `SELECT` on the `users` table inside RLS checks.

---

## Migrations

Migrations are in `supabase/migrations/` and are applied in filename order (timestamp-prefixed).

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
| `20260520173855_reset_all_skill_forms_to_draft.sql` | One-time reset: all forms back to draft for data correction cycle |

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

**After applying a migration, update `supabase/full_schema.sql` to keep it in sync.** The full schema file is the single-file disaster recovery script — it must always reflect the current state of all migrations combined.

---

## Full Schema Script

`supabase/full_schema.sql` is a complete, idempotent snapshot of the entire database schema. It consolidates all migrations into a single file that can be applied to a fresh Supabase project.

**Use it when:**
- Provisioning a new Supabase project from scratch
- Recovering from catastrophic database loss
- Syncing a staging or QA environment

**Do not** include this file in the normal migrations sequence. It is a snapshot for disaster recovery, not an incremental migration.

**To apply it:** paste the contents into the Supabase SQL Editor and click Run.
