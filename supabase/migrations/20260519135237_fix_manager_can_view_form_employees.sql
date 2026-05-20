/*
  # Fix users SELECT policy for managers

  ## Problem
  When an employee acts as a manager (their ID is in skill_forms.manager_id),
  the Supabase FK join in InboxPage returns null for the employee's users row
  because the RLS policy "Managers can view their direct reports" only checks
  users.manager_id, not skill_forms.manager_id.

  ## Change
  Drop and recreate the "Managers can view their direct reports" policy to also
  include employees who have a skill_form managed by the current user.
  This ensures the FK join in InboxPage resolves correctly.
*/

DROP POLICY IF EXISTS "Managers can view their direct reports" ON users;

CREATE POLICY "Managers can view their direct reports"
  ON users FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT id FROM public.users WHERE manager_id = auth.uid())
    OR
    id IN (SELECT employee_id FROM public.skill_forms WHERE manager_id = auth.uid())
  );
