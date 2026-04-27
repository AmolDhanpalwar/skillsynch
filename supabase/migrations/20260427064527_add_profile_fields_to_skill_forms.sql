/*
  # Add profile fields to skill_forms

  Adds employee_name, employee_email, employee_number, designation, grade
  to the skill_forms table so the form can be fully restored on reload
  without depending on the users table profile being up to date.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skill_forms' AND column_name = 'employee_name') THEN
    ALTER TABLE public.skill_forms ADD COLUMN employee_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skill_forms' AND column_name = 'employee_email') THEN
    ALTER TABLE public.skill_forms ADD COLUMN employee_email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skill_forms' AND column_name = 'employee_number') THEN
    ALTER TABLE public.skill_forms ADD COLUMN employee_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skill_forms' AND column_name = 'designation') THEN
    ALTER TABLE public.skill_forms ADD COLUMN designation text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skill_forms' AND column_name = 'grade') THEN
    ALTER TABLE public.skill_forms ADD COLUMN grade text;
  END IF;
END $$;
