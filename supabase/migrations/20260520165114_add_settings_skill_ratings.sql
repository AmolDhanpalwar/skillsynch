/*
  # Add settings_skill_ratings table

  ## Summary
  Replaces the hardcoded 0–4 skill rating scale with an admin-managed master table.
  The employee self-rating dropdown across Step 2 & Step 3 of the Skill Assessment Form
  will be driven by active rows in this table.

  ## New Tables
  - `settings_skill_ratings`
    - `id` (uuid, primary key)
    - `sort_order` (smallint, not null) — display order in dropdown
    - `label` (text, unique, not null) — the full label shown in the dropdown
    - `is_active` (boolean, default true)
    - `created_at` (timestamptz)

  ## Modified Tables
  - `skill_items`
    - Drops the CHECK constraint that limited employee_rating and manager_rating to 0–4
    - Allows any smallint value matching a settings_skill_ratings sort_order

  ## Security
  - RLS enabled on `settings_skill_ratings`
  - SELECT: all authenticated users
  - INSERT/UPDATE/DELETE: admin only (via get_my_role())

  ## Seed Data
  5 initial rating levels as specified
*/

-- ─── Create settings_skill_ratings ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings_skill_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order smallint NOT NULL,
  label text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE settings_skill_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view skill ratings"
  ON settings_skill_ratings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert skill ratings"
  ON settings_skill_ratings FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "Admins can update skill ratings"
  ON settings_skill_ratings FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "Admins can delete skill ratings"
  ON settings_skill_ratings FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');

-- ─── Seed initial rating levels ──────────────────────────────────────────────

INSERT INTO settings_skill_ratings (sort_order, label) VALUES
  (1, '1 — Only Training / Certification'),
  (2, '2 — Basic Work Knowledge'),
  (3, '3 — Intermediate'),
  (4, '4 — Proficient'),
  (5, '5 — Expert')
ON CONFLICT (label) DO NOTHING;

-- ─── Widen skill_items rating columns ────────────────────────────────────────
-- Drop the old 0–4 CHECK constraints so the new 1–5 scale is accepted.

ALTER TABLE skill_items
  DROP CONSTRAINT IF EXISTS skill_items_employee_rating_check;

ALTER TABLE skill_items
  DROP CONSTRAINT IF EXISTS skill_items_manager_rating_check;
