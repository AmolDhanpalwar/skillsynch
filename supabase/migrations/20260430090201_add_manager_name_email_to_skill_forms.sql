/*
  # Add manager_name and manager_email to skill_forms

  ## Summary
  Adds two text columns to skill_forms to persist the manager name and email
  as entered by the employee, independent of whether the manager exists as a
  user record. Previously these were only derivable via manager_id lookup,
  meaning free-typed values were silently lost on save.

  ## Changes
  - skill_forms: add `manager_name` (text, nullable)
  - skill_forms: add `manager_email` (text, nullable)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_forms' AND column_name = 'manager_name'
  ) THEN
    ALTER TABLE skill_forms ADD COLUMN manager_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_forms' AND column_name = 'manager_email'
  ) THEN
    ALTER TABLE skill_forms ADD COLUMN manager_email text;
  END IF;
END $$;
