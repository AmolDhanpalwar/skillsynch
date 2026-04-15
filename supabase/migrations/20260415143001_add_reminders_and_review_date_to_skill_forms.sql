/*
  # Add reminders_sent and manager_review_date to skill_forms

  ## Changes
  - Adds `reminders_sent` integer column (default 0) to track how many reminder notifications were sent
  - Adds `manager_review_date` timestamptz column to record when the manager last reviewed the form
  - Seeds demo skill forms for Employee1 (draft), Employee2 (pending_review), and a third approved form
    using the existing seed users
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_forms' AND column_name = 'reminders_sent'
  ) THEN
    ALTER TABLE public.skill_forms ADD COLUMN reminders_sent integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_forms' AND column_name = 'manager_review_date'
  ) THEN
    ALTER TABLE public.skill_forms ADD COLUMN manager_review_date timestamptz;
  END IF;
END $$;

DO $$
DECLARE
  v_emp1_id     uuid;
  v_emp2_id     uuid;
  v_tmg1_id     uuid;
  v_tmg2_id     uuid;
  v_form1_id    uuid;
  v_form2_id    uuid;
BEGIN
  SELECT id INTO v_emp1_id  FROM auth.users WHERE email = 'employee1@haptiq.com' LIMIT 1;
  SELECT id INTO v_emp2_id  FROM auth.users WHERE email = 'employee2@haptiq.com' LIMIT 1;
  SELECT id INTO v_tmg1_id  FROM auth.users WHERE email = 'tmg1@haptiq.com'      LIMIT 1;
  SELECT id INTO v_tmg2_id  FROM auth.users WHERE email = 'tmg2@haptiq.com'      LIMIT 1;

  IF v_emp1_id IS NULL OR v_emp2_id IS NULL THEN
    RAISE NOTICE 'Seed users not found, skipping form seeding';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.skill_forms WHERE employee_id = v_emp1_id) THEN
    INSERT INTO public.skill_forms (
      employee_id, manager_id, status,
      total_exp, relevant_exp, haptiq_exp,
      current_project, tools, databases,
      certifications, upskilling_plan,
      updated_at
    ) VALUES (
      v_emp1_id, v_tmg1_id, 'draft',
      4, 3, 1.5,
      'SkillSync Portal', 'Git, Docker, VS Code', 'PostgreSQL, Redis',
      ARRAY['AWS Cloud Practitioner']::text[], 'Complete AWS Solutions Architect certification in next 6 months.',
      now() - interval '2 days'
    )
    RETURNING id INTO v_form1_id;

    INSERT INTO public.skill_items (form_id, category, name, employee_rating, sort_order)
    VALUES
      (v_form1_id, 'language',  'Python',     3, 0),
      (v_form1_id, 'language',  'JavaScript', 3, 1),
      (v_form1_id, 'language',  'TypeScript', 2, 2),
      (v_form1_id, 'language',  'SQL',        3, 3),
      (v_form1_id, 'framework', 'React',      3, 0),
      (v_form1_id, 'framework', 'Node.js',    2, 1),
      (v_form1_id, 'framework', 'FastAPI',    2, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.skill_forms WHERE employee_id = v_emp2_id) THEN
    INSERT INTO public.skill_forms (
      employee_id, manager_id, status,
      total_exp, relevant_exp, haptiq_exp,
      current_project, tools, databases,
      certifications, upskilling_plan,
      submitted_at, reminders_sent,
      updated_at
    ) VALUES (
      v_emp2_id, v_tmg2_id, 'pending_review',
      6, 5, 2,
      'Data Pipeline Modernisation', 'Jira, Confluence, Postman', 'MySQL, MongoDB',
      ARRAY['Scrum Master', 'Google Cloud Associate']::text[], 'Upskill in Kubernetes and container orchestration.',
      now() - interval '4 days', 1,
      now() - interval '4 days'
    )
    RETURNING id INTO v_form2_id;

    INSERT INTO public.skill_items (form_id, category, name, employee_rating, manager_rating, sort_order)
    VALUES
      (v_form2_id, 'language',  'Java',       3, 3, 0),
      (v_form2_id, 'language',  'Python',     2, 2, 1),
      (v_form2_id, 'language',  'SQL',        3, 3, 2),
      (v_form2_id, 'language',  'Bash',       2, 1, 3),
      (v_form2_id, 'framework', 'Spring Boot',3, 3, 0),
      (v_form2_id, 'framework', 'React',      2, 2, 1),
      (v_form2_id, 'framework', 'Django',     1, 1, 2);
  END IF;
END $$;
