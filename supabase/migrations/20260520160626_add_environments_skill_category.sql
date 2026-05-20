/*
  # Add Environments / Infra / Mgmt Sys / OS skill category

  ## Summary
  Adds a new "Additional Skills" category for Environment, Infrastructure, Management Systems, and OS items.

  ## New Tables
  - `settings_environments`
    - `id` (uuid, primary key)
    - `name` (text, unique, not null) — environment/infra item name
    - `is_active` (boolean, default true)
    - `created_at` (timestamptz)

  ## Modified Tables
  - `skill_forms`
    - `environments` (text) — comma-separated selected environments (employee)
    - `environments_manager_comment` (text) — manager comment on environments

  ## Security
  - RLS enabled on `settings_environments`
  - SELECT: all authenticated users
  - INSERT/UPDATE/DELETE: admin only (via get_my_role())

  ## Seed Data
  29 environment/infra items from the Supply-Bolt Skill spreadsheet column E
*/

-- ─── settings_environments table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings_environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE settings_environments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view environments"
  ON settings_environments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert environments"
  ON settings_environments FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "Admins can update environments"
  ON settings_environments FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "Admins can delete environments"
  ON settings_environments FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');

-- ─── Seed environments ────────────────────────────────────────────────────────

INSERT INTO settings_environments (name) VALUES
  ('AWS'),
  ('Azure'),
  ('GCP'),
  ('AWS S3'),
  ('S3'),
  ('ECR'),
  ('ECS'),
  ('CDN'),
  ('Kubernetes'),
  ('Docker'),
  ('Firebase'),
  ('Apache'),
  ('Nginx'),
  ('Load Balancers'),
  ('Auto-scaling groups'),
  ('Stage / Staging'),
  ('Drupal'),
  ('WordPress'),
  ('Webflow'),
  ('Shopify'),
  ('Meta/Facebook'),
  ('Android'),
  ('Android Studio'),
  ('iOS'),
  ('CMS'),
  ('AWS Secrets Manager'),
  ('Vault')
ON CONFLICT (name) DO NOTHING;

-- ─── Add environment columns to skill_forms ───────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_forms' AND column_name = 'environments'
  ) THEN
    ALTER TABLE skill_forms ADD COLUMN environments text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_forms' AND column_name = 'environments_manager_comment'
  ) THEN
    ALTER TABLE skill_forms ADD COLUMN environments_manager_comment text DEFAULT '';
  END IF;
END $$;
