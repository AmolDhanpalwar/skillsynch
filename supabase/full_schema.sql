/*
  ============================================================================
  HAPTIQ SKILLSYNC — COMPLETE DATABASE SCHEMA
  ============================================================================

  This is the single-file, idempotent full schema script.
  It is the authoritative source of truth for a fresh DB migration.

  PURPOSE
  -------
  Use this file when:
    • Provisioning a brand-new Supabase project
    • Recovering from catastrophic DB loss
    • Syncing a staging/QA environment to match production schema

  SAFETY
  ------
  Every statement uses IF NOT EXISTS / IF EXISTS / DO $$ BEGIN ... END $$
  guards so this script can be re-run safely against an existing database
  without duplicating objects or raising errors.

  HOW TO RUN
  ----------
  Paste into the Supabase SQL Editor and click "Run", or apply via:
    mcp__supabase__apply_migration(filename: "...", content: <this file>)

  DO NOT include this file in the normal migrations sequence —
  it is a snapshot for disaster recovery, not an incremental migration.

  MAINTENANCE
  -----------
  Whenever a new migration is applied (supabase/migrations/), the
  corresponding section of this file MUST be updated to keep the schema
  in sync. Search for the relevant section by table name and update inline.

  CONTENTS
  --------
  1.  Extensions
  2.  Custom Types (Enums)
  3.  Helper Functions
  4.  Core Tables
      a. users
      b. skill_forms
      c. skill_items
      d. notifications
  5.  Triggers
  6.  Indexes
  7.  Row Level Security — users
  8.  Row Level Security — skill_forms
  9.  Row Level Security — skill_items
  10. Row Level Security — notifications
  11. Settings Master Tables
      a. settings_certifications
      b. settings_languages
      c. settings_frameworks
      d. settings_tools
      e. settings_databases
      f. settings_environments
      g. settings_skill_ratings
      h. settings_grades
      i. settings_designations
  12. Seed Data — settings tables
  13. Seed Data — grades & designations

  ============================================================================
*/


-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_salt(), crypt()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- uuid_generate_v4() (fallback)


-- ============================================================================
-- 2. CUSTOM TYPES (ENUMS)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('employee', 'manager', 'tmg', 'management', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE form_status AS ENUM ('draft', 'pending_review', 'returned', 'approved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE skill_category AS ENUM ('language', 'framework', 'environment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- If skill_category already exists without 'environment', add the value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'skill_category'::regtype
      AND enumlabel = 'environment'
  ) THEN
    ALTER TYPE skill_category ADD VALUE 'environment';
  END IF;
END $$;


-- ============================================================================
-- 3. HELPER FUNCTIONS
-- ============================================================================

/*
  get_my_role()
  Returns the role of the currently authenticated user.
  SECURITY DEFINER bypasses RLS on the users table to avoid infinite recursion
  when this function is called from within an RLS policy on users.
*/
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid();
$$;

/*
  get_my_manager_id()
  Returns the manager_id of the currently authenticated user.
  Used in RLS policies to allow users to view their direct manager's profile.
*/
CREATE OR REPLACE FUNCTION public.get_my_manager_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT manager_id FROM public.users WHERE id = auth.uid();
$$;

/*
  get_my_direct_report_ids()
  Returns the set of user IDs who have auth.uid() as their manager_id.
  Used in RLS policies on skill_forms to allow managers to view subordinate forms.
*/
CREATE OR REPLACE FUNCTION public.get_my_direct_report_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM public.users WHERE manager_id = auth.uid();
$$;

/*
  is_admin_or_tmg()
  Returns true if the current user has role 'admin' or 'tmg' and is active.
  Used in settings table INSERT/UPDATE policies.
*/
CREATE OR REPLACE FUNCTION public.is_admin_or_tmg()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'tmg')
      AND is_active = true
  );
$$;


-- ============================================================================
-- 4a. TABLE: users
-- ============================================================================
/*
  Mirrors auth.users with additional profile fields.
  Created automatically via trigger when a user signs up, or manually via
  the admin-create-user Edge Function.

  Columns:
    id              — PK, references auth.users(id), CASCADE delete
    email           — unique, not null
    full_name       — display name (default: '' for trigger-created rows)
    employee_number — e.g. EMP001 (nullable)
    designation     — job title, validated against settings_designations (nullable)
    grade           — grade level, validated against settings_grades (nullable)
    role            — one of the user_role enum values (default: 'employee')
    manager_id      — self-referencing FK to users.id (nullable)
    is_active       — soft delete flag (default: true)
    created_at      — timestamp of record creation
*/

CREATE TABLE IF NOT EXISTS public.users (
  id              uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text        NOT NULL,
  full_name       text        NOT NULL DEFAULT '',
  employee_number text,
  designation     text,
  grade           text,
  role            user_role   NOT NULL DEFAULT 'employee',
  manager_id      uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 4b. TABLE: skill_forms
-- ============================================================================
/*
  One skill assessment form per employee per review cycle.
  Upserted on every "Save Draft" or form submission.

  Key fields:
    employee_id, manager_id   — FK to users
    status                    — lifecycle state (draft → pending_review → approved/returned)
    total_exp/relevant_exp/   — experience in years (numeric 4.1)
      haptiq_exp
    tools, databases          — tag-picker selections (stored as text)
    certifications            — array of certification names
    upskilling_plan           — employee's 6-month learning goals
    manager_expectation_plan  — manager fills during review
    employee_name/email/      — denormalized from users at save time
      employee_number/
      designation/grade
    submitted_at, approved_at — lifecycle timestamps
    manager_review_date       — when manager first opened the form
    reminders_sent            — count of reminder notifications sent
    environments              — selected environment/infra items (text)
    environments_manager_comment — manager comment on environments section
*/

CREATE TABLE IF NOT EXISTS public.skill_forms (
  id                            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id                   uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  manager_id                    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  status                        form_status NOT NULL DEFAULT 'draft',
  total_exp                     numeric(4,1),
  relevant_exp                  numeric(4,1),
  haptiq_exp                    numeric(4,1),
  current_project               text,
  tools                         text,
  databases                     text,
  tools_manager_comment         text,
  databases_manager_comment     text,
  environments                  text        DEFAULT '',
  environments_manager_comment  text        DEFAULT '',
  certifications                text[],
  upskilling_plan               text,
  manager_expectation_plan      text,
  employee_name                 text,
  employee_email                text,
  employee_number               text,
  designation                   text,
  grade                         text,
  submitted_at                  timestamptz,
  approved_at                   timestamptz,
  manager_review_date           timestamptz,
  reminders_sent                integer     NOT NULL DEFAULT 0,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.skill_forms ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 4c. TABLE: skill_items
-- ============================================================================
/*
  Individual skill rows inside a form. Deleted and re-inserted on every save
  (full replace strategy — no partial updates).

  category: 'language' | 'framework' | 'environment'
  employee_rating / manager_rating: smallint matching settings_skill_ratings.sort_order
    (1 = Only Training, 2 = Basic, 3 = Intermediate, 4 = Proficient, 5 = Expert)
  sort_order: display order within category
*/

CREATE TABLE IF NOT EXISTS public.skill_items (
  id               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id          uuid           NOT NULL REFERENCES public.skill_forms(id) ON DELETE CASCADE,
  category         skill_category NOT NULL,
  name             text           NOT NULL,
  employee_rating  smallint,
  manager_rating   smallint,
  manager_comment  text           NOT NULL DEFAULT '',
  sort_order       smallint       NOT NULL DEFAULT 0
);

ALTER TABLE public.skill_items ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 4d. TABLE: notifications
-- ============================================================================
/*
  Per-user in-app notification feed.
  Inserted by application code after form submit, approve, or return events.

  type examples: 'form_submitted', 'form_approved', 'form_returned'
  is_read: toggled by the user via the notification drawer
  form_id: optional link to the relevant form
*/

CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       text        NOT NULL,
  message    text        NOT NULL,
  is_read    boolean     NOT NULL DEFAULT false,
  form_id    uuid        REFERENCES public.skill_forms(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

/*
  handle_new_user()
  Auto-creates a public.users profile row when a new auth.users row is inserted
  (i.e., when a user signs up or is created via the admin Edge Function).
  Reads full_name and role from raw_user_meta_data if present.
*/
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- 6. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_manager_id               ON public.users(manager_id);
CREATE INDEX IF NOT EXISTS idx_users_role                     ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_skill_forms_employee_id        ON public.skill_forms(employee_id);
CREATE INDEX IF NOT EXISTS idx_skill_forms_manager_id         ON public.skill_forms(manager_id);
CREATE INDEX IF NOT EXISTS idx_skill_forms_status             ON public.skill_forms(status);
CREATE INDEX IF NOT EXISTS idx_skill_items_form_id            ON public.skill_items(form_id);
CREATE INDEX IF NOT EXISTS idx_skill_items_form_category      ON public.skill_items(form_id, category);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id          ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read          ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_settings_designations_grade_id ON public.settings_designations(grade_id);


-- ============================================================================
-- 7. ROW LEVEL SECURITY — users
-- ============================================================================

-- Drop existing policies before recreating (idempotency)
DROP POLICY IF EXISTS "Users can view own profile"                      ON public.users;
DROP POLICY IF EXISTS "Privileged roles can view all users"             ON public.users;
DROP POLICY IF EXISTS "Users can view their direct manager profile"     ON public.users;
DROP POLICY IF EXISTS "Managers can view their direct reports"          ON public.users;
DROP POLICY IF EXISTS "Users can update own profile"                    ON public.users;
DROP POLICY IF EXISTS "TMG can update employee profiles"                ON public.users;
DROP POLICY IF EXISTS "Admins can update any user"                      ON public.users;

-- SELECT: own row
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());

-- SELECT: privileged roles see everyone
CREATE POLICY "Privileged roles can view all users"
  ON public.users FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('tmg', 'admin', 'management', 'manager'));

-- SELECT: any user can see their direct manager (one level up)
CREATE POLICY "Users can view their direct manager profile"
  ON public.users FOR SELECT TO authenticated
  USING (id = public.get_my_manager_id());

-- SELECT: managers can see employees whose skill_form they manage
CREATE POLICY "Managers can view their direct reports"
  ON public.users FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT employee_id FROM public.skill_forms WHERE manager_id = auth.uid()
    )
  );

-- UPDATE: self
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- UPDATE: TMG can update employee profiles only (not other TMG/admin)
CREATE POLICY "TMG can update employee profiles"
  ON public.users FOR UPDATE TO authenticated
  USING (role = 'employee' AND public.get_my_role() = 'tmg')
  WITH CHECK (role = 'employee' AND public.get_my_role() = 'tmg');

-- UPDATE: admin can update anyone
CREATE POLICY "Admins can update any user"
  ON public.users FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');


-- ============================================================================
-- 8. ROW LEVEL SECURITY — skill_forms
-- ============================================================================

DROP POLICY IF EXISTS "Employees can view own skill forms"              ON public.skill_forms;
DROP POLICY IF EXISTS "Employees can insert own skill forms"            ON public.skill_forms;
DROP POLICY IF EXISTS "Employees can update own non-approved forms"     ON public.skill_forms;
DROP POLICY IF EXISTS "Managers can view team skill forms"              ON public.skill_forms;
DROP POLICY IF EXISTS "Managers can update team skill forms"            ON public.skill_forms;
DROP POLICY IF EXISTS "Privileged roles can view all skill forms"       ON public.skill_forms;
DROP POLICY IF EXISTS "TMG and admin can update any skill form"         ON public.skill_forms;

-- SELECT: employee sees own forms
CREATE POLICY "Employees can view own skill forms"
  ON public.skill_forms FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

-- INSERT: employee can create their own form
CREATE POLICY "Employees can insert own skill forms"
  ON public.skill_forms FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- UPDATE: employee can edit their own form only while not approved
CREATE POLICY "Employees can update own non-approved forms"
  ON public.skill_forms FOR UPDATE TO authenticated
  USING (employee_id = auth.uid() AND status != 'approved')
  WITH CHECK (employee_id = auth.uid() AND status != 'approved');

-- SELECT: assigned manager sees their team's forms
CREATE POLICY "Managers can view team skill forms"
  ON public.skill_forms FOR SELECT TO authenticated
  USING (manager_id = auth.uid());

-- UPDATE: assigned manager can update their team's forms
CREATE POLICY "Managers can update team skill forms"
  ON public.skill_forms FOR UPDATE TO authenticated
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

-- SELECT: privileged roles (tmg, admin, management, manager) see all forms
CREATE POLICY "Privileged roles can view all skill forms"
  ON public.skill_forms FOR SELECT TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['tmg', 'admin', 'management', 'manager']));

-- UPDATE: TMG and admin can update any form (manager reassignment, review actions)
CREATE POLICY "TMG and admin can update any skill form"
  ON public.skill_forms FOR UPDATE TO authenticated
  USING (public.get_my_role() IN ('tmg', 'admin'))
  WITH CHECK (public.get_my_role() IN ('tmg', 'admin'));


-- ============================================================================
-- 9. ROW LEVEL SECURITY — skill_items
-- ============================================================================

DROP POLICY IF EXISTS "Employees can view own skill items"              ON public.skill_items;
DROP POLICY IF EXISTS "Employees can insert own skill items"            ON public.skill_items;
DROP POLICY IF EXISTS "Employees can update own skill items"            ON public.skill_items;
DROP POLICY IF EXISTS "Employees can delete own skill items"            ON public.skill_items;
DROP POLICY IF EXISTS "Managers can view team skill items"              ON public.skill_items;
DROP POLICY IF EXISTS "Managers can update team skill items"            ON public.skill_items;
DROP POLICY IF EXISTS "Managers can delete team skill items"            ON public.skill_items;
DROP POLICY IF EXISTS "Managers can insert team skill items"            ON public.skill_items;
DROP POLICY IF EXISTS "TMG and admin can delete any skill items"        ON public.skill_items;
DROP POLICY IF EXISTS "TMG and admin can insert any skill items"        ON public.skill_items;
DROP POLICY IF EXISTS "Privileged roles can view all skill items"       ON public.skill_items;

-- SELECT: employee sees own form's items
CREATE POLICY "Employees can view own skill items"
  ON public.skill_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.skill_forms sf
      WHERE sf.id = skill_items.form_id AND sf.employee_id = auth.uid()
    )
  );

-- INSERT: employee can add items to their non-approved forms
CREATE POLICY "Employees can insert own skill items"
  ON public.skill_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.skill_forms sf
      WHERE sf.id = skill_items.form_id
        AND sf.employee_id = auth.uid()
        AND sf.status != 'approved'
    )
  );

-- UPDATE: employee can update items on their non-approved forms
CREATE POLICY "Employees can update own skill items"
  ON public.skill_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.skill_forms sf
      WHERE sf.id = skill_items.form_id
        AND sf.employee_id = auth.uid()
        AND sf.status != 'approved'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.skill_forms sf
      WHERE sf.id = skill_items.form_id
        AND sf.employee_id = auth.uid()
        AND sf.status != 'approved'
    )
  );

-- DELETE: employee can delete items on their non-approved forms
CREATE POLICY "Employees can delete own skill items"
  ON public.skill_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.skill_forms sf
      WHERE sf.id = skill_items.form_id
        AND sf.employee_id = auth.uid()
        AND sf.status != 'approved'
    )
  );

-- SELECT: assigned manager sees their team's items
CREATE POLICY "Managers can view team skill items"
  ON public.skill_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.skill_forms sf
      WHERE sf.id = skill_items.form_id AND sf.manager_id = auth.uid()
    )
  );

-- UPDATE: assigned manager can update their team's items
CREATE POLICY "Managers can update team skill items"
  ON public.skill_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.skill_forms sf
      WHERE sf.id = skill_items.form_id AND sf.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.skill_forms sf
      WHERE sf.id = skill_items.form_id AND sf.manager_id = auth.uid()
    )
  );

-- DELETE: manager can delete items on forms they manage (needed for full replace on save)
CREATE POLICY "Managers can delete team skill items"
  ON public.skill_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.skill_forms sf
      WHERE sf.id = skill_items.form_id AND sf.manager_id = auth.uid()
    )
  );

-- INSERT: manager can insert items on forms they manage
CREATE POLICY "Managers can insert team skill items"
  ON public.skill_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.skill_forms sf
      WHERE sf.id = skill_items.form_id AND sf.manager_id = auth.uid()
    )
  );

-- SELECT: privileged roles see all items
CREATE POLICY "Privileged roles can view all skill items"
  ON public.skill_items FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('tmg', 'admin', 'management'));

-- DELETE: TMG and admin can delete any items
CREATE POLICY "TMG and admin can delete any skill items"
  ON public.skill_items FOR DELETE TO authenticated
  USING (public.get_my_role() IN ('tmg', 'admin'));

-- INSERT: TMG and admin can insert any items
CREATE POLICY "TMG and admin can insert any skill items"
  ON public.skill_items FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() IN ('tmg', 'admin'));


-- ============================================================================
-- 10. ROW LEVEL SECURITY — notifications
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own notifications"                ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications"              ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications"    ON public.notifications;

-- SELECT: users see only their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- UPDATE: users can mark their own notifications as read
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- INSERT: any authenticated user can insert a notification for any recipient
-- (employees notify their manager on submission; manager notifies employee on review)
-- The SELECT policy guarantees each user only sees their own rows.
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);


-- ============================================================================
-- 11a. SETTINGS TABLE: settings_certifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.settings_certifications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  is_active       boolean     NOT NULL DEFAULT true,
  is_haptiq_demand boolean    NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_certifications_name_unique UNIQUE (name)
);

ALTER TABLE public.settings_certifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view certifications"     ON public.settings_certifications;
DROP POLICY IF EXISTS "Admin or TMG can insert certifications"          ON public.settings_certifications;
DROP POLICY IF EXISTS "Admin or TMG can update certifications"          ON public.settings_certifications;

CREATE POLICY "Authenticated users can view certifications"
  ON public.settings_certifications FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin or TMG can insert certifications"
  ON public.settings_certifications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_tmg());

CREATE POLICY "Admin or TMG can update certifications"
  ON public.settings_certifications FOR UPDATE TO authenticated
  USING (public.is_admin_or_tmg()) WITH CHECK (public.is_admin_or_tmg());


-- ============================================================================
-- 11b. SETTINGS TABLE: settings_languages
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.settings_languages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  is_active       boolean     NOT NULL DEFAULT true,
  is_haptiq_demand boolean    NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_languages_name_unique UNIQUE (name)
);

ALTER TABLE public.settings_languages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view languages"          ON public.settings_languages;
DROP POLICY IF EXISTS "Admin or TMG can insert languages"               ON public.settings_languages;
DROP POLICY IF EXISTS "Admin or TMG can update languages"               ON public.settings_languages;

CREATE POLICY "Authenticated users can view languages"
  ON public.settings_languages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin or TMG can insert languages"
  ON public.settings_languages FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_tmg());

CREATE POLICY "Admin or TMG can update languages"
  ON public.settings_languages FOR UPDATE TO authenticated
  USING (public.is_admin_or_tmg()) WITH CHECK (public.is_admin_or_tmg());


-- ============================================================================
-- 11c. SETTINGS TABLE: settings_frameworks
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.settings_frameworks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  is_active       boolean     NOT NULL DEFAULT true,
  is_haptiq_demand boolean    NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_frameworks_name_unique UNIQUE (name)
);

ALTER TABLE public.settings_frameworks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view frameworks"         ON public.settings_frameworks;
DROP POLICY IF EXISTS "Admin or TMG can insert frameworks"              ON public.settings_frameworks;
DROP POLICY IF EXISTS "Admin or TMG can update frameworks"              ON public.settings_frameworks;

CREATE POLICY "Authenticated users can view frameworks"
  ON public.settings_frameworks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin or TMG can insert frameworks"
  ON public.settings_frameworks FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_tmg());

CREATE POLICY "Admin or TMG can update frameworks"
  ON public.settings_frameworks FOR UPDATE TO authenticated
  USING (public.is_admin_or_tmg()) WITH CHECK (public.is_admin_or_tmg());


-- ============================================================================
-- 11d. SETTINGS TABLE: settings_tools
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.settings_tools (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  is_active       boolean     NOT NULL DEFAULT true,
  is_haptiq_demand boolean    NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_tools_name_unique UNIQUE (name)
);

ALTER TABLE public.settings_tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view tools"              ON public.settings_tools;
DROP POLICY IF EXISTS "Admin or TMG can insert tools"                   ON public.settings_tools;
DROP POLICY IF EXISTS "Admin or TMG can update tools"                   ON public.settings_tools;

CREATE POLICY "Authenticated users can view tools"
  ON public.settings_tools FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin or TMG can insert tools"
  ON public.settings_tools FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_tmg());

CREATE POLICY "Admin or TMG can update tools"
  ON public.settings_tools FOR UPDATE TO authenticated
  USING (public.is_admin_or_tmg()) WITH CHECK (public.is_admin_or_tmg());


-- ============================================================================
-- 11e. SETTINGS TABLE: settings_databases
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.settings_databases (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  is_active       boolean     NOT NULL DEFAULT true,
  is_haptiq_demand boolean    NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_databases_name_unique UNIQUE (name)
);

ALTER TABLE public.settings_databases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view databases"          ON public.settings_databases;
DROP POLICY IF EXISTS "Admin or TMG can insert databases"               ON public.settings_databases;
DROP POLICY IF EXISTS "Admin or TMG can update databases"               ON public.settings_databases;

CREATE POLICY "Authenticated users can view databases"
  ON public.settings_databases FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin or TMG can insert databases"
  ON public.settings_databases FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_tmg());

CREATE POLICY "Admin or TMG can update databases"
  ON public.settings_databases FOR UPDATE TO authenticated
  USING (public.is_admin_or_tmg()) WITH CHECK (public.is_admin_or_tmg());


-- ============================================================================
-- 11f. SETTINGS TABLE: settings_environments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.settings_environments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        UNIQUE NOT NULL,
  is_active       boolean     NOT NULL DEFAULT true,
  is_haptiq_demand boolean    NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.settings_environments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view environments"       ON public.settings_environments;
DROP POLICY IF EXISTS "Admins can insert environments"                  ON public.settings_environments;
DROP POLICY IF EXISTS "Admins can update environments"                  ON public.settings_environments;
DROP POLICY IF EXISTS "Admins can delete environments"                  ON public.settings_environments;

CREATE POLICY "Authenticated users can view environments"
  ON public.settings_environments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert environments"
  ON public.settings_environments FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "Admins can update environments"
  ON public.settings_environments FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "Admins can delete environments"
  ON public.settings_environments FOR DELETE TO authenticated
  USING (public.get_my_role() = 'admin');


-- ============================================================================
-- 11g. SETTINGS TABLE: settings_skill_ratings
-- ============================================================================
/*
  Admin-managed rating scale. sort_order is the numeric value stored in
  skill_items.employee_rating / manager_rating.
  Default seed: 1 (Only Training) through 5 (Expert).
*/

CREATE TABLE IF NOT EXISTS public.settings_skill_ratings (
  id         uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order smallint NOT NULL,
  label      text     UNIQUE NOT NULL,
  is_active  boolean  NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.settings_skill_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view skill ratings"      ON public.settings_skill_ratings;
DROP POLICY IF EXISTS "Admins can insert skill ratings"                 ON public.settings_skill_ratings;
DROP POLICY IF EXISTS "Admins can update skill ratings"                 ON public.settings_skill_ratings;
DROP POLICY IF EXISTS "Admins can delete skill ratings"                 ON public.settings_skill_ratings;

CREATE POLICY "Authenticated users can view skill ratings"
  ON public.settings_skill_ratings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert skill ratings"
  ON public.settings_skill_ratings FOR INSERT TO authenticated
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "Admins can update skill ratings"
  ON public.settings_skill_ratings FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "Admins can delete skill ratings"
  ON public.settings_skill_ratings FOR DELETE TO authenticated
  USING (public.get_my_role() = 'admin');


-- ============================================================================
-- 11h. SETTINGS TABLE: settings_grades
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.settings_grades (
  id         uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text     UNIQUE NOT NULL,
  sort_order int      NOT NULL DEFAULT 0,
  is_active  boolean  NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.settings_grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view grades"             ON public.settings_grades;
DROP POLICY IF EXISTS "Admin or TMG can insert grades"                  ON public.settings_grades;
DROP POLICY IF EXISTS "Admin or TMG can update grades"                  ON public.settings_grades;

CREATE POLICY "Authenticated users can view grades"
  ON public.settings_grades FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin or TMG can insert grades"
  ON public.settings_grades FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_tmg());

CREATE POLICY "Admin or TMG can update grades"
  ON public.settings_grades FOR UPDATE TO authenticated
  USING (public.is_admin_or_tmg()) WITH CHECK (public.is_admin_or_tmg());


-- ============================================================================
-- 11i. SETTINGS TABLE: settings_designations
-- ============================================================================
/*
  Designations are grouped by grade. The composite unique constraint
  (grade_id, name) allows the same job title to appear under different grades.
*/

CREATE TABLE IF NOT EXISTS public.settings_designations (
  id         uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id   uuid     REFERENCES public.settings_grades(id) ON DELETE CASCADE,
  name       text     NOT NULL,
  is_active  boolean  NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT settings_designations_grade_id_name_key UNIQUE (grade_id, name)
);

ALTER TABLE public.settings_designations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view designations"       ON public.settings_designations;
DROP POLICY IF EXISTS "Admin or TMG can insert designations"            ON public.settings_designations;
DROP POLICY IF EXISTS "Admin or TMG can update designations"            ON public.settings_designations;

CREATE POLICY "Authenticated users can view designations"
  ON public.settings_designations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin or TMG can insert designations"
  ON public.settings_designations FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_tmg());

CREATE POLICY "Admin or TMG can update designations"
  ON public.settings_designations FOR UPDATE TO authenticated
  USING (public.is_admin_or_tmg()) WITH CHECK (public.is_admin_or_tmg());


-- ============================================================================
-- 12. SEED DATA — Settings tables
-- ============================================================================

-- Skill Ratings
INSERT INTO public.settings_skill_ratings (sort_order, label) VALUES
  (1, '1 — Only Training / Certification'),
  (2, '2 — Basic Work Knowledge'),
  (3, '3 — Intermediate'),
  (4, '4 — Proficient'),
  (5, '5 — Expert')
ON CONFLICT (label) DO NOTHING;

-- Certifications
INSERT INTO public.settings_certifications (name) VALUES
  ('AWS Certified Solutions Architect'),
  ('AWS Certified Developer'),
  ('AWS Certified DevOps Engineer'),
  ('Google Cloud Professional Cloud Architect'),
  ('Google Cloud Associate Cloud Engineer'),
  ('Microsoft Azure Administrator (AZ-104)'),
  ('Microsoft Azure Developer (AZ-204)'),
  ('Certified Kubernetes Administrator (CKA)'),
  ('Certified Kubernetes Application Developer (CKAD)'),
  ('HashiCorp Certified Terraform Associate'),
  ('PMP - Project Management Professional'),
  ('Scrum Master Certification (CSM)'),
  ('Oracle Certified Java Programmer'),
  ('CompTIA Security+'),
  ('Certified Ethical Hacker (CEH)')
ON CONFLICT (name) DO NOTHING;

-- Languages
INSERT INTO public.settings_languages (name) VALUES
  ('JavaScript'),('TypeScript'),('Python'),('Java'),('C#'),('C++'),
  ('Go'),('Rust'),('Kotlin'),('Swift'),('PHP'),('Ruby'),('Scala'),
  ('R'),('Dart'),('SQL'),('Shell / Bash')
ON CONFLICT (name) DO NOTHING;

-- Frameworks
INSERT INTO public.settings_frameworks (name) VALUES
  ('React'),('Angular'),('Vue.js'),('Next.js'),('Nuxt.js'),('Node.js'),
  ('Express.js'),('NestJS'),('Spring Boot'),('Django'),('FastAPI'),('Flask'),
  ('.NET / ASP.NET Core'),('Laravel'),('Ruby on Rails'),('Flutter'),
  ('React Native'),('GraphQL'),('gRPC')
ON CONFLICT (name) DO NOTHING;

-- Tools
INSERT INTO public.settings_tools (name) VALUES
  ('Docker'),('Kubernetes'),('Jenkins'),('GitHub Actions'),('GitLab CI/CD'),
  ('Terraform'),('Ansible'),('Helm'),('Jira'),('Confluence'),('Postman'),
  ('VS Code'),('IntelliJ IDEA'),('SonarQube'),('Grafana'),('Prometheus'),
  ('Elasticsearch / ELK Stack'),('Apache Kafka'),('RabbitMQ'),('Nginx')
ON CONFLICT (name) DO NOTHING;

-- Databases
INSERT INTO public.settings_databases (name) VALUES
  ('PostgreSQL'),('MySQL'),('Microsoft SQL Server'),('Oracle DB'),('MongoDB'),
  ('Redis'),('Cassandra'),('DynamoDB'),('Firebase Firestore'),('Supabase'),
  ('SQLite'),('MariaDB'),('Elasticsearch'),('Neo4j'),('ClickHouse')
ON CONFLICT (name) DO NOTHING;

-- Environments
INSERT INTO public.settings_environments (name) VALUES
  ('AWS'),('Azure'),('GCP'),('AWS S3'),('S3'),('ECR'),('ECS'),('CDN'),
  ('Kubernetes'),('Docker'),('Firebase'),('Apache'),('Nginx'),
  ('Load Balancers'),('Auto-scaling groups'),('Stage / Staging'),
  ('Drupal'),('WordPress'),('Webflow'),('Shopify'),('Meta/Facebook'),
  ('Android'),('Android Studio'),('iOS'),('CMS'),
  ('AWS Secrets Manager'),('Vault')
ON CONFLICT (name) DO NOTHING;


-- ============================================================================
-- 13. SEED DATA — Grades & Designations
-- ============================================================================
/*
  Grades: IC01–IC12 (Individual Contributor), MGMT05–MGMT15 (Management)
  Designations are grouped under their respective grades.

  This block is safe to re-run: INSERT ... ON CONFLICT DO NOTHING.
  The DELETE+re-seed approach from migrations is intentionally NOT used here
  to preserve any custom grades/designations added by admins after initial setup.
*/

INSERT INTO public.settings_grades (name, sort_order) VALUES
  ('IC01',     1),('IC02',    2),('IC03',    3),('IC04',    4),('IC05',    5),
  ('IC06',     6),('IC07',    7),('IC08',    8),('IC09',    9),('IC10',   10),
  ('IC11',    11),('IC12',   12),
  ('MGMT05',  13),('MGMT06', 14),('MGMT07', 15),('MGMT08', 16),('MGMT09', 17),
  ('MGMT10',  18),('MGMT11', 19),('MGMT12', 20),('MGMT13', 21),('MGMT14', 22),
  ('MGMT15',  23)
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE gid uuid;
BEGIN

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC01';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Admin'),(gid,'Assistant Data Engineer'),(gid,'Assistant Data Analyst'),
    (gid,'Assistant Devops Engineer'),(gid,'Assistant Software Engineer'),
    (gid,'Assistant UX/UI Designer'),(gid,'Junior Sales Director'),
    (gid,'Junior RevOps Associate'),(gid,'QA Tester'),(gid,'Support Staff')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC02';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Admin'),(gid,'Associate / Intern'),(gid,'Associate AI Engineer'),
    (gid,'Associate Data Engineer'),(gid,'Associate Data Analyst'),
    (gid,'Associate QA Analyst'),(gid,'Associate Software Devops'),
    (gid,'Associate Software Engineer'),(gid,'Associate UX/UI Designer'),
    (gid,'Jr Accountant'),(gid,'Jr Associate'),(gid,'Junior Sales Director'),
    (gid,'RevOps Associate')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC03';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Software Engineer'),(gid,'Accountant'),(gid,'Admin'),
    (gid,'AI Engineer'),(gid,'Data Engineer'),(gid,'Data Analyst'),
    (gid,'Data AI Research Scientist'),(gid,'Devops Engineer'),(gid,'Release Engineer'),
    (gid,'HR Ops Coordinator'),(gid,'Associate Talent Acquisition Specialist'),
    (gid,'QA Analyst'),(gid,'Sales Director'),(gid,'RevOps Associate'),
    (gid,'UX/UI / Graphic Designer')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC04';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Admin II'),(gid,'Resourcing Specialist'),(gid,'AI Engineer II'),
    (gid,'Data Engineer II'),(gid,'Data Analyst II'),(gid,'Devops Engineer II'),
    (gid,'HR Ops Admin'),(gid,'Talent Acquisition Specialist'),(gid,'HRBP'),
    (gid,'QA Engineer'),(gid,'Sales Director'),(gid,'RevOps Manager'),
    (gid,'Senior Accountant'),(gid,'Software Engineer II'),(gid,'UX/UI / Graphic Designer II')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC05';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Admin II'),(gid,'Resourcing Specialist'),(gid,'AI Engineer III'),
    (gid,'Data Engineer III'),(gid,'Data Analyst III'),(gid,'Devops Engineer III'),
    (gid,'HR Ops Admin'),(gid,'Talent Acquisition Specialist II'),(gid,'HRBP II'),
    (gid,'QA Engineer II'),(gid,'Sales Director'),(gid,'RevOps Manager'),
    (gid,'Senior Accountant II'),(gid,'Software Engineer III'),(gid,'UX/UI / Graphic Designer III')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC06';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Senior Admin'),(gid,'Senior Resourcing Specialist'),(gid,'Senior AI Engineer'),
    (gid,'Senior Assistant Controller'),(gid,'Senior Data Engineer'),(gid,'Senior Data Analyst'),
    (gid,'Senior Devops Engineer'),(gid,'Senior HR Ops Admin'),
    (gid,'Senior Talent Acquisition Specialist'),(gid,'Senior HRBP'),
    (gid,'Senior QA Engineer'),(gid,'Senior Sales Director'),(gid,'Senior RevOps Manager'),
    (gid,'Senior Software Engineer'),(gid,'Senior UX/UI'),(gid,'Senior Graphic Designer')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC07';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'AI Architect'),(gid,'Data Warehouse Architect'),(gid,'Data Architect'),
    (gid,'Devops Architect'),(gid,'Senior HR Ops Admin II'),
    (gid,'Senior Talent Acquisition Specialist II'),(gid,'HRBP II'),(gid,'Senior II'),
    (gid,'Senior Admin II'),(gid,'Senior Resourcing Specialist'),
    (gid,'Senior Assistant Controller II'),(gid,'Senior Sales Director II'),
    (gid,'Senior QA Engineer II'),(gid,'Senior Graphic Designer II'),
    (gid,'Senior UX/UI II'),(gid,'Software Architect'),(gid,'Solution Designer')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC08';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Site Reliability Engineer I'),(gid,'Staff'),(gid,'Staff AI Engineer'),
    (gid,'Staff Controller'),(gid,'Staff Data Engineer I'),(gid,'Staff Data Analyst I'),
    (gid,'Staff HR Ops Admin'),(gid,'Staff Talent Acquisition Specialist'),(gid,'Staff HRBP'),
    (gid,'Staff QA Engineer'),(gid,'Staff Software Engineer I'),(gid,'Staff Solution Designer'),
    (gid,'Staff UX/UI I'),(gid,'Staff Graphic Designer I')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC09';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Site Reliability Engineer II'),(gid,'Staff AI Engineer II'),
    (gid,'Staff Data Engineer/Analyst II'),(gid,'Staff II'),(gid,'Staff QA Engineer II'),
    (gid,'Staff Software Engineer II'),(gid,'Solutions Architect'),
    (gid,'Staff Solutions Architect'),(gid,'Staff UX/UI II'),(gid,'Staff Graphic Designer II')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC10';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Principal'),(gid,'Principal AI Engineer'),(gid,'Principal Data Engineer I'),
    (gid,'Principal Data Analyst I'),(gid,'Principal Devops Engineer I'),
    (gid,'Principal QA Engineer'),(gid,'Principal Software Engineer'),
    (gid,'Principal Software Engineer I'),(gid,'Principal UX/UI I'),
    (gid,'Principal Graphic Engineer I')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC11';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Principal AI Engineer II'),(gid,'Principal Data Engineer II'),
    (gid,'Principal Data Analyst II'),(gid,'Principal Devops Engineer II'),
    (gid,'Principal II'),(gid,'Principal QA Engineer II'),
    (gid,'Principal Software Engineer II'),(gid,'Principal UX/UI'),(gid,'Graphic Engineer II')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC12';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'AI Fellow Engineer'),(gid,'Data and AI Fellow'),(gid,'Devops Fellow'),
    (gid,'Engineering Fellow'),(gid,'Fellow'),(gid,'Fellow QA Engineer'),
    (gid,'UX/UI Fellow'),(gid,'Graphic Designer Fellow')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT05';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Associate Lead'),(gid,'Associate Lead, AI Engineering'),
    (gid,'Associate Lead, Data Engineering'),(gid,'Associate Lead, Design'),
    (gid,'Associate Lead, Devops'),(gid,'Associate Lead, Marketing Management'),
    (gid,'Associate Lead, Marketing Technology'),(gid,'Associate Lead, Marketing Analysis'),
    (gid,'Digital Analytics'),(gid,'Associate Lead, QA'),
    (gid,'Associate Lead, Software Engineering'),(gid,'Associate Lead, BA')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT06';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Lead'),(gid,'Team Lead'),(gid,'Team Lead, AI Engineering'),
    (gid,'Team Lead, Data Engineering'),(gid,'Team Lead, Design'),
    (gid,'Team Lead, Devops'),(gid,'Team Lead, Marketing Management'),
    (gid,'Team Lead, Marketing Technology'),(gid,'Team Lead, Marketing Analysis'),
    (gid,'Digital Analytics'),(gid,'Team Lead, QA'),(gid,'Team Lead, Software Engineering'),
    (gid,'Team Lead, BA'),(gid,'Lead Admin'),(gid,'Resourcing Specialist Lead')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT07';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Manager'),(gid,'Manager UX/UI Design'),(gid,'Manager, AI Engineering'),
    (gid,'Manager, Data Engineering'),(gid,'Manager, Devops'),
    (gid,'Manager, Marketing Management'),(gid,'Manager, Marketing Technology'),
    (gid,'Manager, Marketing Analysis'),(gid,'Digital Analytics'),(gid,'Manager, QA'),
    (gid,'Technical Manager'),(gid,'Manager, BA'),(gid,'Manager Admin'),
    (gid,'Resourcing Specialist Manager')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT08';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Senior Manager'),(gid,'Senior Manager, AI Engineering'),
    (gid,'Senior Manager, Data Engineering'),(gid,'Senior Manager, Design'),
    (gid,'Senior Manager, Devops'),(gid,'Senior Manager, QA'),
    (gid,'Senior Marketing Manager'),(gid,'Senior Manager, Marketing Technology'),
    (gid,'Marketing Analysis'),(gid,'Digital Analytics'),
    (gid,'Senior Technical Manager'),(gid,'Senior Manager, BA')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT09';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Deputy / Associate Director'),
    (gid,'Deputy / Associate Director of AI Engineering'),
    (gid,'Deputy / Associate Director of Data Engineering'),
    (gid,'Deputy / Associate Director of Design'),
    (gid,'Deputy / Associate Director of Devops'),
    (gid,'Deputy / Associate Director of Engineering'),
    (gid,'Deputy / Associate Director of Marketing Technology'),
    (gid,'Digital Analytics'),
    (gid,'Deputy / Associate Director of QA'),
    (gid,'Deputy / Associate Director, BA')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT10';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Director'),(gid,'Director of AI Engineering'),(gid,'Director of Data Engineering'),
    (gid,'Director of Design'),(gid,'Director of Devops'),(gid,'Director of Engineering'),
    (gid,'Director of Marketing Technology'),(gid,'Director of QA'),(gid,'Director, BA')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT11';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Senior Director'),(gid,'Senior Director of AI Engineering'),
    (gid,'Senior Director of Data Engineering'),(gid,'Senior Director of Design'),
    (gid,'Senior Director of Devops'),(gid,'Senior Director of Engineering'),
    (gid,'Senior Director of Marketing Technology'),(gid,'Senior Director of QA'),
    (gid,'Senior Director, BA')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT12';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'VP of AI Engineering I'),(gid,'VP of Data and AI Engineering I'),
    (gid,'Deputy Head of Data'),(gid,'VP of Devops I'),(gid,'Deputy Head of Devops'),
    (gid,'VP of Engineering I'),(gid,'Deputy Head of Engineering'),
    (gid,'Deputy Head of Marketing Technology'),(gid,'VP of QA I'),(gid,'Deputy Head of QA'),
    (gid,'VP of UX I'),(gid,'Deputy Head of Design')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT13';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'VP of AI Engineering II'),(gid,'VP of Data and AI Engineering II'),
    (gid,'Head of Data'),(gid,'VP of Devops II'),(gid,'Head of Devops'),
    (gid,'VP of Engineering II'),(gid,'Head of Engineering'),
    (gid,'VP of Marketing Technology II'),(gid,'Head of Marketing Technology'),
    (gid,'VP of QA II'),(gid,'Head of QA'),(gid,'VP of UX II'),(gid,'Head of Design')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT14';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'Chief AI Officer'),(gid,'Chief Data Officer'),(gid,'Chief Quality Officer'),
    (gid,'Chief Reliability Officer'),(gid,'Chief Usability Officer'),
    (gid,'CMO'),(gid,'CTO'),(gid,'SVP'),(gid,'GM'),(gid,'CXO')
  ON CONFLICT (grade_id, name) DO NOTHING;

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT15';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid,'CEO')
  ON CONFLICT (grade_id, name) DO NOTHING;

END $$;


-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
/*
  Schema version: as of 2026-05-21
  Last migration applied: 20260520173855_reset_all_skill_forms_to_draft.sql

  To verify the schema is correct after applying:
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name;

  Expected tables (13 total):
    notifications, settings_certifications, settings_databases,
    settings_designations, settings_environments, settings_frameworks,
    settings_grades, settings_languages, settings_skill_ratings,
    settings_tools, skill_forms, skill_items, users
*/
