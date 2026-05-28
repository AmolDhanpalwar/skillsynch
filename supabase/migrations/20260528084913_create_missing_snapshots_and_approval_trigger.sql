/*
  # Fix missing cycle snapshots and add auto-snapshot trigger

  ## Summary
  1. Creates missing skill_form_versions records for 4 employees who were approved
     in the "Mid-Yr-2026" closed cycle but whose snapshots were never persisted.
  2. Adds a PostgreSQL trigger on skill_forms that automatically creates a
     skill_form_versions snapshot whenever a form transitions to 'approved'.
  3. Adds a SECURITY DEFINER function for cycle activation that bypasses RLS,
     allowing the system to reset all forms to draft when a new cycle starts.

  ## New Database Objects
  - Function: `create_approval_snapshot()` — trigger function for auto-snapshots
  - Trigger: `trg_skill_form_approval_snapshot` — fires AFTER UPDATE on skill_forms
  - Function: `activate_cycle(cycle_uuid UUID)` — service function for cycle activation

  ## Security
  - Trigger function runs as SECURITY DEFINER (postgres role) so it can always
    insert into skill_form_versions regardless of calling user's RLS policies
  - activate_cycle() also SECURITY DEFINER so TMG can reset all forms atomically
*/

-- ── Step 1: Create missing snapshots for 4 employees from closed cycle ─────────

DO $$
DECLARE
  v_cycle_id uuid := '1ba1df45-f9f8-41f8-a478-b4f2795ae565';
  v_approved_at timestamptz := '2026-05-27 13:10:00+00';

  -- Employee Three (5710c938)
  v_emp3_form_id uuid := '57a066f9-64ee-4440-ab30-dd04b5642294';
  v_emp3_id uuid := '5710c938-0970-4bea-8627-ba8407502700';

  -- Employee One (8408d823)
  v_emp1_form_id uuid := 'ce2e6f8c-abc0-416a-9b68-9bcc53ab776c';
  v_emp1_id uuid := '8408d823-3a77-4bb8-8130-d1e4074b3d68';

  -- Employee Two (11d05aed)
  v_emp2_form_id uuid := 'a33abed5-b13a-4c8d-8cd9-91e6e28248e7';
  v_emp2_id uuid := '11d05aed-0b7c-406e-9a79-14ac62bffeb0';

  -- Employee Four (e87f9a89)
  v_emp4_form_id uuid := '57e22510-414d-420f-8453-6edec421222f';
  v_emp4_id uuid := 'e87f9a89-c52d-44e7-a4dd-c581c8d6f53e';
BEGIN

  -- Employee Three snapshot
  IF NOT EXISTS (SELECT 1 FROM skill_form_versions WHERE employee_id = v_emp3_id AND cycle_id = v_cycle_id) THEN
    INSERT INTO skill_form_versions (cycle_id, form_id, employee_id, snapshot, approved_at, approved_by)
    VALUES (
      v_cycle_id,
      v_emp3_form_id,
      v_emp3_id,
      jsonb_build_object(
        'id', v_emp3_form_id,
        'employee_id', v_emp3_id,
        'cycle_id', v_cycle_id,
        'status', 'approved',
        'employee_name', 'Employee Three',
        'employee_email', 'employee3@haptiq.com',
        'employee_number', 'EMP003',
        'designation', 'Devops Engineer II',
        'grade', 'IC04',
        'total_exp', 8,
        'relevant_exp', 7,
        'haptiq_exp', 7,
        'current_project', 'Unimed',
        'tools', 'GitHub Actions, Docker, Ansible, Android Studio, API',
        'databases', 'MySQL, DynamoDB, MariaDB',
        'certifications', array_to_json(ARRAY['AWS Certified Developer','Certified Kubernetes Administrator (CKA)','Certified Ethical Hacker (CEH)'])::jsonb,
        'upskilling_plan', 'Will be focusing on learning javascript. Have more certifications and new framework in next 6 months.',
        'manager_expectation_plan', 'Tested ok',
        'tools_manager_comment', 'Test',
        'databases_manager_comment', 'Test',
        'environments_manager_comment', 'Test',
        'submitted_at', '2026-05-27T13:00:05.347+00:00',
        'approved_at', v_approved_at,
        'manager_review_date', null,
        'reminders_sent', 0,
        'skill_items', (
          SELECT jsonb_agg(jsonb_build_object(
            'id', si.id, 'form_id', si.form_id, 'category', si.category,
            'name', si.name, 'employee_rating', si.employee_rating,
            'manager_rating', si.manager_rating, 'manager_comment', si.manager_comment,
            'sort_order', si.sort_order
          ) ORDER BY si.sort_order)
          FROM skill_items si WHERE si.form_id = v_emp3_form_id
        )
      ),
      v_approved_at,
      null
    );
  END IF;

  -- Employee One snapshot
  IF NOT EXISTS (SELECT 1 FROM skill_form_versions WHERE employee_id = v_emp1_id AND cycle_id = v_cycle_id) THEN
    INSERT INTO skill_form_versions (cycle_id, form_id, employee_id, snapshot, approved_at, approved_by)
    VALUES (
      v_cycle_id,
      v_emp1_form_id,
      v_emp1_id,
      jsonb_build_object(
        'id', v_emp1_form_id,
        'employee_id', v_emp1_id,
        'cycle_id', v_cycle_id,
        'status', 'approved',
        'employee_name', 'Employee One',
        'employee_email', 'employee1@haptiq.com',
        'employee_number', 'EMP001',
        'designation', 'Director',
        'grade', 'MGMT10',
        'total_exp', 10,
        'relevant_exp', 9,
        'haptiq_exp', 2,
        'current_project', 'Unimed',
        'tools', 'Git, Docker, VS Code, API',
        'databases', 'PostgreSQL, Redis, MySQL',
        'certifications', array_to_json(ARRAY['AWS Cloud Practitioner','Certified Ethical Hacker (CEH)'])::jsonb,
        'upskilling_plan', 'Complete AWS Solutions Architect certification in next 6 months.',
        'manager_expectation_plan', 'There is more expectation on learning new tools and frameworks due to senior role. Need to focus on completing certifications in next 6 months.',
        'tools_manager_comment', 'Start exploring Jenkins.',
        'databases_manager_comment', 'good for now',
        'environments_manager_comment', 'Let''s discuss in person to align more skill',
        'submitted_at', '2026-05-27T12:43:31.163+00:00',
        'approved_at', v_approved_at,
        'manager_review_date', null,
        'reminders_sent', 0,
        'skill_items', (
          SELECT jsonb_agg(jsonb_build_object(
            'id', si.id, 'form_id', si.form_id, 'category', si.category,
            'name', si.name, 'employee_rating', si.employee_rating,
            'manager_rating', si.manager_rating, 'manager_comment', si.manager_comment,
            'sort_order', si.sort_order
          ) ORDER BY si.sort_order)
          FROM skill_items si WHERE si.form_id = v_emp1_form_id
        )
      ),
      v_approved_at,
      null
    );
  END IF;

  -- Employee Two snapshot
  IF NOT EXISTS (SELECT 1 FROM skill_form_versions WHERE employee_id = v_emp2_id AND cycle_id = v_cycle_id) THEN
    INSERT INTO skill_form_versions (cycle_id, form_id, employee_id, snapshot, approved_at, approved_by)
    VALUES (
      v_cycle_id,
      v_emp2_form_id,
      v_emp2_id,
      jsonb_build_object(
        'id', v_emp2_form_id,
        'employee_id', v_emp2_id,
        'cycle_id', v_cycle_id,
        'status', 'approved',
        'employee_name', 'Employee Two',
        'employee_email', 'employee2@haptiq.com',
        'employee_number', 'EMP002',
        'designation', 'Software Engineer',
        'grade', 'IC03',
        'total_exp', 5,
        'relevant_exp', 4,
        'haptiq_exp', 4,
        'current_project', 'DRF',
        'tools', 'Github, GitHub Actions, GitLab CI/CD, GitLab',
        'databases', 'DynamoDB, MongoDB, Microsoft SQL Server, ClickHouse',
        'certifications', array_to_json(ARRAY['Microsoft Azure Administrator (AZ-104)','Certified Ethical Hacker (CEH)'])::jsonb,
        'upskilling_plan', 'Will focus on learning new language: YAML',
        'manager_expectation_plan', 'OK Tested',
        'tools_manager_comment', 'good',
        'databases_manager_comment', 'good',
        'environments_manager_comment', 'Test',
        'submitted_at', '2026-05-27T12:44:27.061+00:00',
        'approved_at', v_approved_at,
        'manager_review_date', null,
        'reminders_sent', 0,
        'skill_items', (
          SELECT jsonb_agg(jsonb_build_object(
            'id', si.id, 'form_id', si.form_id, 'category', si.category,
            'name', si.name, 'employee_rating', si.employee_rating,
            'manager_rating', si.manager_rating, 'manager_comment', si.manager_comment,
            'sort_order', si.sort_order
          ) ORDER BY si.sort_order)
          FROM skill_items si WHERE si.form_id = v_emp2_form_id
        )
      ),
      v_approved_at,
      null
    );
  END IF;

  -- Employee Four snapshot
  IF NOT EXISTS (SELECT 1 FROM skill_form_versions WHERE employee_id = v_emp4_id AND cycle_id = v_cycle_id) THEN
    INSERT INTO skill_form_versions (cycle_id, form_id, employee_id, snapshot, approved_at, approved_by)
    VALUES (
      v_cycle_id,
      v_emp4_form_id,
      v_emp4_id,
      jsonb_build_object(
        'id', v_emp4_form_id,
        'employee_id', v_emp4_id,
        'cycle_id', v_cycle_id,
        'status', 'approved',
        'employee_name', 'Employee Four',
        'employee_email', 'employee4@haptiq.com',
        'employee_number', 'EMP004',
        'designation', 'Staff Software Engineer I',
        'grade', 'IC08',
        'total_exp', 5,
        'relevant_exp', 5,
        'haptiq_exp', 1,
        'current_project', 'Silvur',
        'tools', 'Jenkins, Apache Kafka, API, Butter CMS',
        'databases', 'MySQL, Microsoft SQL Server, MongoDB, ClickHouse',
        'certifications', array_to_json(ARRAY['Scrum Master Certification (CSM)','Certified Ethical Hacker (CEH)'])::jsonb,
        'upskilling_plan', 'Over the next 6 months, I aim to strengthen my expertise in Go backend development.',
        'manager_expectation_plan', 'The employee has shown a positive approach toward learning and technical growth.',
        'tools_manager_comment', 'Strongly agree with the tools mentioned.',
        'databases_manager_comment', 'Has a good foundational understanding of databases.',
        'environments_manager_comment', 'Demonstrates good efficiency in work execution.',
        'submitted_at', '2026-05-27T13:00:58.019+00:00',
        'approved_at', v_approved_at,
        'manager_review_date', null,
        'reminders_sent', 0,
        'skill_items', (
          SELECT jsonb_agg(jsonb_build_object(
            'id', si.id, 'form_id', si.form_id, 'category', si.category,
            'name', si.name, 'employee_rating', si.employee_rating,
            'manager_rating', si.manager_rating, 'manager_comment', si.manager_comment,
            'sort_order', si.sort_order
          ) ORDER BY si.sort_order)
          FROM skill_items si WHERE si.form_id = v_emp4_form_id
        )
      ),
      v_approved_at,
      null
    );
  END IF;

END $$;


-- ── Step 2: Auto-snapshot trigger on approval ──────────────────────────────────

CREATE OR REPLACE FUNCTION create_approval_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot jsonb;
BEGIN
  -- Only fire when status changes TO 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') AND NEW.cycle_id IS NOT NULL THEN
    -- Don't create duplicate snapshot for same employee+cycle
    IF NOT EXISTS (
      SELECT 1 FROM skill_form_versions
      WHERE employee_id = NEW.employee_id AND cycle_id = NEW.cycle_id
    ) THEN
      -- Build snapshot including current skill_items
      SELECT jsonb_build_object(
        'id', NEW.id,
        'employee_id', NEW.employee_id,
        'cycle_id', NEW.cycle_id,
        'status', 'approved',
        'employee_name', NEW.employee_name,
        'employee_email', NEW.employee_email,
        'employee_number', NEW.employee_number,
        'designation', NEW.designation,
        'grade', NEW.grade,
        'total_exp', NEW.total_exp,
        'relevant_exp', NEW.relevant_exp,
        'haptiq_exp', NEW.haptiq_exp,
        'current_project', NEW.current_project,
        'tools', NEW.tools,
        'databases', NEW.databases,
        'certifications', NEW.certifications,
        'upskilling_plan', NEW.upskilling_plan,
        'manager_expectation_plan', NEW.manager_expectation_plan,
        'tools_manager_comment', NEW.tools_manager_comment,
        'databases_manager_comment', NEW.databases_manager_comment,
        'environments_manager_comment', NEW.environments_manager_comment,
        'submitted_at', NEW.submitted_at,
        'approved_at', NEW.approved_at,
        'manager_review_date', NEW.manager_review_date,
        'reminders_sent', NEW.reminders_sent,
        'skill_items', COALESCE(
          (SELECT jsonb_agg(jsonb_build_object(
            'id', si.id,
            'form_id', si.form_id,
            'category', si.category,
            'name', si.name,
            'employee_rating', si.employee_rating,
            'manager_rating', si.manager_rating,
            'manager_comment', si.manager_comment,
            'sort_order', si.sort_order
          ) ORDER BY si.sort_order)
          FROM skill_items si WHERE si.form_id = NEW.id),
          '[]'::jsonb
        )
      ) INTO v_snapshot;

      INSERT INTO skill_form_versions (cycle_id, form_id, employee_id, snapshot, approved_at, approved_by)
      VALUES (NEW.cycle_id, NEW.id, NEW.employee_id, v_snapshot, COALESCE(NEW.approved_at, now()), null);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_skill_form_approval_snapshot ON skill_forms;
CREATE TRIGGER trg_skill_form_approval_snapshot
  AFTER UPDATE ON skill_forms
  FOR EACH ROW
  EXECUTE FUNCTION create_approval_snapshot();


-- ── Step 3: SECURITY DEFINER function for cycle activation ────────────────────
-- Allows the frontend (calling as any role) to atomically reset all skill_forms
-- when a new cycle is activated, bypassing per-row RLS restrictions.

CREATE OR REPLACE FUNCTION activate_cycle_reset_forms(p_cycle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE skill_forms
  SET
    cycle_id = p_cycle_id,
    status = 'draft',
    submitted_at = NULL,
    approved_at = NULL,
    manager_review_date = NULL,
    updated_at = now()
  WHERE true; -- all rows
END;
$$;

-- Grant execute to authenticated users so the frontend can call it via RPC
GRANT EXECUTE ON FUNCTION activate_cycle_reset_forms(uuid) TO authenticated;
