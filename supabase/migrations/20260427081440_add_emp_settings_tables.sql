/*
  # Add Employee Settings Tables

  ## Summary
  Adds two new master lookup tables for employee profile fields:
  - `settings_grades` — list of employee grades (e.g. L1, L2, Senior, etc.)
  - `settings_designations` — list of employee designations (e.g. Software Engineer, etc.)

  ## New Tables
  Both tables follow the same schema as existing settings tables:
  - `id` (uuid, primary key)
  - `name` (text, unique, not null)
  - `is_active` (boolean, default true)
  - `created_at` (timestamptz, default now())

  ## Security
  - RLS enabled on both tables
  - All authenticated users can SELECT (needed for the employee form dropdown)
  - Only admin/tmg users can INSERT/UPDATE (reuses existing `is_admin_or_tmg()` helper)

  ## Seed Data
  Common grades and designations pre-populated for immediate use.
*/

-- Grades table
CREATE TABLE IF NOT EXISTS settings_grades (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text UNIQUE NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE settings_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view grades"
  ON settings_grades FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin or TMG can insert grades"
  ON settings_grades FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_tmg());

CREATE POLICY "Admin or TMG can update grades"
  ON settings_grades FOR UPDATE
  TO authenticated
  USING (is_admin_or_tmg())
  WITH CHECK (is_admin_or_tmg());

-- Designations table
CREATE TABLE IF NOT EXISTS settings_designations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text UNIQUE NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE settings_designations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view designations"
  ON settings_designations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin or TMG can insert designations"
  ON settings_designations FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_tmg());

CREATE POLICY "Admin or TMG can update designations"
  ON settings_designations FOR UPDATE
  TO authenticated
  USING (is_admin_or_tmg())
  WITH CHECK (is_admin_or_tmg());

-- Seed grades
INSERT INTO settings_grades (name) VALUES
  ('L1'), ('L2'), ('L3'), ('L4'), ('L5'),
  ('Junior'), ('Mid'), ('Senior'), ('Lead'), ('Principal'), ('Staff')
ON CONFLICT (name) DO NOTHING;

-- Seed designations
INSERT INTO settings_designations (name) VALUES
  ('Software Engineer'),
  ('Senior Software Engineer'),
  ('Lead Software Engineer'),
  ('Principal Engineer'),
  ('Software Architect'),
  ('Frontend Developer'),
  ('Backend Developer'),
  ('Full Stack Developer'),
  ('DevOps Engineer'),
  ('QA Engineer'),
  ('Data Engineer'),
  ('Data Scientist'),
  ('Product Manager'),
  ('Scrum Master'),
  ('Engineering Manager')
ON CONFLICT (name) DO NOTHING;
