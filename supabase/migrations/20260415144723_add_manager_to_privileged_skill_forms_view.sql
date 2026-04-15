/*
  # Allow managers to view all skill forms

  ## Changes
  - Updates the "Privileged roles can view all skill forms" SELECT policy to include 'manager' role
    so that managers can access the Skills Matrix (TmgDashboardPage) which lists all employees.

  ## Security
  - Managers already had a policy to view their direct team's forms; this extends it to all forms
    to support the Skills Matrix overview page.
*/

DROP POLICY IF EXISTS "Privileged roles can view all skill forms" ON skill_forms;

CREATE POLICY "Privileged roles can view all skill forms"
  ON skill_forms
  FOR SELECT
  TO authenticated
  USING (get_my_role() = ANY (ARRAY['tmg'::text, 'admin'::text, 'management'::text, 'manager'::text]));
