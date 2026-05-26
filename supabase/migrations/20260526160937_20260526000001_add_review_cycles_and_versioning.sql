/*
  # Review Cycles & Versioned Skill Assessments

  ## Overview
  Introduces the concept of named review cycles (e.g., "Mid Year 2026", "Full Year 2026")
  that drive all skill assessment activity. Every approved assessment is now versioned by
  the cycle it belongs to. Previous cycle assessments are immutable and view-only.

  ## New Tables

  ### review_cycles
  Tracks each assessment cycle defined by TMG.
  - `id` (uuid, PK)
  - `name` (text) — e.g. "Mid Year 2026"
  - `cycle_type` (enum: mid_year | full_year | custom)
  - `status` (enum: draft | active | closed)
  - `employee_deadline` (timestamptz) — ETA for employees to submit
  - `manager_deadline` (timestamptz) — ETA for managers to complete reviews
  - `triggered_at` (timestamptz) — when TMG activated the cycle
  - `closed_at` (timestamptz) — when TMG closed the cycle
  - `created_by` (uuid → users) — TMG user who created it
  - `notes` (text) — optional description
  - created_at / updated_at

  ### skill_form_versions
  Immutable snapshot of every approved skill_form keyed by cycle.
  When a form is approved, a snapshot row is written here. This table
  is append-only — no updates, no deletes.
  - `id` (uuid, PK)
  - `cycle_id` (uuid → review_cycles)
  - `form_id` (uuid → skill_forms) — the live form
  - `employee_id` (uuid → users)
  - `snapshot` (jsonb) — complete form + skill_items at approval time
  - `approved_at` (timestamptz)
  - `approved_by` (uuid → users) — manager who approved
  - `created_at` (timestamptz)

  ## Modified Tables

  ### skill_forms
  - `cycle_id` (uuid → review_cycles, nullable) — which cycle this form belongs to

  ## Security
  - RLS enabled on both new tables
  - review_cycles: TMG/admin can insert/update; all authenticated can read
  - skill_form_versions: only system/admin insert; authenticated users can read
    their own version history; managers see their reports'; TMG sees all

  ## Important Notes
  1. A single employee has ONE active skill_form per cycle (cycle_id + employee_id unique).
  2. When a new cycle is activated, existing active forms (draft/pending/returned) for the
     PREVIOUS cycle must all be approved before TMG can trigger a new cycle.
  3. The live skill_forms row is reused across cycles; cycle_id changes when a new cycle
     starts and a form snapshot has been saved for the previous cycle.
  4. Employee/manager deadlines are per-cycle and can be updated by TMG before the cycle closes.
  5. The full_schema.sql must be updated separately.
*/

-- ============================================================================
-- 1. NEW ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE cycle_type_enum AS ENUM ('mid_year', 'full_year', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cycle_status_enum AS ENUM ('draft', 'active', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. review_cycles TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS review_cycles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  cycle_type      cycle_type_enum NOT NULL DEFAULT 'custom',
  status          cycle_status_enum NOT NULL DEFAULT 'draft',
  employee_deadline timestamptz,
  manager_deadline  timestamptz,
  triggered_at    timestamptz,
  closed_at       timestamptz,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  notes           text DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Ensure only one active cycle at a time (enforced at app level too, but belt-and-suspenders)
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_cycle
  ON review_cycles (status)
  WHERE status = 'active';

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_review_cycles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_cycles_updated_at ON review_cycles;
CREATE TRIGGER trg_review_cycles_updated_at
  BEFORE UPDATE ON review_cycles
  FOR EACH ROW EXECUTE FUNCTION update_review_cycles_updated_at();

-- ============================================================================
-- 3. skill_form_versions TABLE (immutable snapshots)
-- ============================================================================

CREATE TABLE IF NOT EXISTS skill_form_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id      uuid NOT NULL REFERENCES review_cycles(id) ON DELETE RESTRICT,
  form_id       uuid REFERENCES skill_forms(id) ON DELETE SET NULL,
  employee_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot      jsonb NOT NULL DEFAULT '{}',
  approved_at   timestamptz NOT NULL DEFAULT now(),
  approved_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One approved version per employee per cycle
CREATE UNIQUE INDEX IF NOT EXISTS uq_version_employee_cycle
  ON skill_form_versions (employee_id, cycle_id);

-- ============================================================================
-- 4. ADD cycle_id TO skill_forms
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_forms' AND column_name = 'cycle_id'
  ) THEN
    ALTER TABLE skill_forms
      ADD COLUMN cycle_id uuid REFERENCES review_cycles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index for fast lookup of forms by cycle
CREATE INDEX IF NOT EXISTS idx_skill_forms_cycle_id ON skill_forms(cycle_id);

-- ============================================================================
-- 5. RLS — review_cycles
-- ============================================================================

ALTER TABLE review_cycles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read cycles
CREATE POLICY "Authenticated users can view review cycles"
  ON review_cycles FOR SELECT
  TO authenticated
  USING (true);

-- Only TMG and admin can insert cycles
CREATE POLICY "TMG and admin can create review cycles"
  ON review_cycles FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('tmg', 'admin')
  );

-- Only TMG and admin can update cycles
CREATE POLICY "TMG and admin can update review cycles"
  ON review_cycles FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('tmg', 'admin')
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('tmg', 'admin')
  );

-- ============================================================================
-- 6. RLS — skill_form_versions
-- ============================================================================

ALTER TABLE skill_form_versions ENABLE ROW LEVEL SECURITY;

-- Employees can see their own version history
CREATE POLICY "Employees can view own version history"
  ON skill_form_versions FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- Managers can see versions of their direct reports
CREATE POLICY "Managers can view their reports version history"
  ON skill_form_versions FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'manager'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = skill_form_versions.employee_id
        AND users.manager_id = auth.uid()
    )
  );

-- TMG and admin can see all versions
CREATE POLICY "TMG and admin can view all version history"
  ON skill_form_versions FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('tmg', 'admin', 'management')
  );

-- Only system/backend inserts versions (via service role); app-level inserts
-- from managers using their session also need this policy
CREATE POLICY "Managers and TMG can insert version snapshots"
  ON skill_form_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'tmg', 'admin')
  );

-- ============================================================================
-- 7. RESET ALL CURRENT skill_forms TO draft
--    (Required: all forms start fresh for the cycle era)
-- ============================================================================

UPDATE skill_forms
SET
  status = 'draft',
  submitted_at = NULL,
  approved_at = NULL,
  manager_review_date = NULL,
  reminders_sent = 0,
  cycle_id = NULL,
  updated_at = now()
WHERE status IN ('pending_review', 'returned', 'approved');
