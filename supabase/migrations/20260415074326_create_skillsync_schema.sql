/*
  # SkillSync Core Schema

  ## Summary
  Creates all tables required for the SkillSync skill-tracking platform.

  ## New Tables

  ### 1. public.users
  Mirrors auth.users with additional profile fields.
  - id: References auth.users(id) — PK
  - email, full_name, employee_number, designation, grade
  - role: Enum (employee | manager | tmg | management | admin)
  - manager_id: Self-referencing FK (nullable)
  - created_at

  ### 2. public.skill_forms
  One skill assessment form per employee per cycle.
  - employee_id FK → users, manager_id FK → users
  - status: Enum (draft | pending_review | returned | approved)
  - Experience fields: total_exp, relevant_exp, haptiq_exp
  - Free-text fields: tools, databases, certifications[], upskilling_plan, etc.
  - Manager comment fields, timestamps

  ### 3. public.skill_items
  Individual language/framework skill rows inside a form.
  - form_id FK → skill_forms
  - category: Enum (language | framework)
  - employee_rating 0–4, manager_rating 0–4 (nullable)
  - manager_comment, sort_order

  ### 4. public.notifications
  Per-user notification feed.
  - user_id FK → users
  - type, message, is_read (default false)
  - optional form_id FK

  ## Security
  - RLS enabled on all four tables
  - Helper function get_my_role() with SECURITY DEFINER avoids self-referential recursion in users table policies
  - Trigger handle_new_user() auto-creates public.users row on auth signup using metadata

  ## Indexes
  - FK columns and frequently-filtered columns indexed
*/

-- ──────────────────────────────────────────────
-- ENUMS
-- ──────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('employee', 'manager', 'tmg', 'management', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE form_status AS ENUM ('draft', 'pending_review', 'returned', 'approved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE skill_category AS ENUM ('language', 'framework');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────
-- USERS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text        NOT NULL,
  full_name     text        NOT NULL DEFAULT '',
  employee_number text,
  designation   text,
  grade         text,
  role          user_role   NOT NULL DEFAULT 'employee',
  manager_id    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helper — reads users table bypassing RLS to avoid recursion
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid();
$$;

CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Privileged roles can view all users"
  ON public.users FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('tmg', 'admin', 'management', 'manager'));

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Auto-create profile row on auth.users INSERT
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

-- ──────────────────────────────────────────────
-- SKILL FORMS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.skill_forms (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id                 uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  manager_id                  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  status                      form_status NOT NULL DEFAULT 'draft',
  total_exp                   numeric(4,1),
  relevant_exp                numeric(4,1),
  haptiq_exp                  numeric(4,1),
  current_project             text,
  tools                       text,
  databases                   text,
  tools_manager_comment       text,
  databases_manager_comment   text,
  certifications              text[],
  upskilling_plan             text,
  manager_expectation_plan    text,
  submitted_at                timestamptz,
  approved_at                 timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.skill_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own skill forms"
  ON public.skill_forms FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Employees can insert own skill forms"
  ON public.skill_forms FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Employees can update own non-approved forms"
  ON public.skill_forms FOR UPDATE TO authenticated
  USING (employee_id = auth.uid() AND status != 'approved')
  WITH CHECK (employee_id = auth.uid() AND status != 'approved');

CREATE POLICY "Managers can view team skill forms"
  ON public.skill_forms FOR SELECT TO authenticated
  USING (manager_id = auth.uid());

CREATE POLICY "Managers can update team skill forms"
  ON public.skill_forms FOR UPDATE TO authenticated
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

CREATE POLICY "Privileged roles can view all skill forms"
  ON public.skill_forms FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('tmg', 'admin', 'management'));

-- ──────────────────────────────────────────────
-- SKILL ITEMS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.skill_items (
  id               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id          uuid           NOT NULL REFERENCES public.skill_forms(id) ON DELETE CASCADE,
  category         skill_category NOT NULL,
  name             text           NOT NULL,
  employee_rating  smallint       CHECK (employee_rating BETWEEN 0 AND 4),
  manager_rating   smallint       CHECK (manager_rating BETWEEN 0 AND 4),
  manager_comment  text,
  sort_order       smallint       NOT NULL DEFAULT 0
);

ALTER TABLE public.skill_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own skill items"
  ON public.skill_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.skill_forms sf
      WHERE sf.id = skill_items.form_id AND sf.employee_id = auth.uid()
    )
  );

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

CREATE POLICY "Managers can view team skill items"
  ON public.skill_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.skill_forms sf
      WHERE sf.id = skill_items.form_id AND sf.manager_id = auth.uid()
    )
  );

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

CREATE POLICY "Privileged roles can view all skill items"
  ON public.skill_items FOR SELECT TO authenticated
  USING (public.get_my_role() IN ('tmg', 'admin', 'management'));

-- ──────────────────────────────────────────────
-- NOTIFICATIONS
-- ──────────────────────────────────────────────
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

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ──────────────────────────────────────────────
-- INDEXES
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_manager_id         ON public.users(manager_id);
CREATE INDEX IF NOT EXISTS idx_users_role               ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_skill_forms_employee_id  ON public.skill_forms(employee_id);
CREATE INDEX IF NOT EXISTS idx_skill_forms_manager_id   ON public.skill_forms(manager_id);
CREATE INDEX IF NOT EXISTS idx_skill_forms_status       ON public.skill_forms(status);
CREATE INDEX IF NOT EXISTS idx_skill_items_form_id      ON public.skill_items(form_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read    ON public.notifications(is_read);
