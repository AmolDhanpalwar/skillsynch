/*
  # Add HaptiqDemand flag to all Skill Master tables

  1. Changes
    - Adds `is_haptiq_demand` boolean column (default false) to all 6 master tables:
      - settings_certifications
      - settings_languages
      - settings_frameworks
      - settings_tools
      - settings_databases
      - settings_environments

  2. Purpose
    Allows admins to mark which skills are specifically in demand at Haptiq,
    surfacing demand signals without altering the active/inactive status.
*/

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'settings_certifications',
    'settings_languages',
    'settings_frameworks',
    'settings_tools',
    'settings_databases',
    'settings_environments'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = tbl AND column_name = 'is_haptiq_demand'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN is_haptiq_demand boolean NOT NULL DEFAULT false', tbl);
    END IF;
  END LOOP;
END $$;
