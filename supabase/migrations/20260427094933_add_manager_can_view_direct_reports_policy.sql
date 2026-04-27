/*
  # Allow managers to view their direct reports' profiles

  ## Problem
  The users SELECT RLS only allows:
  - Viewing your own row
  - Viewing your direct manager's row
  - Privileged roles (tmg, admin, management) viewing all

  When an employee (e.g. Employee Two) is assigned as a manager for another
  employee (Employee One), they cannot read Employee One's users row because
  no policy covers "view users who report to me". The skill form JOIN to users
  returns null, causing profile fields to show as unknown/blank in the review page.

  ## Fix
  Add a SECURITY DEFINER helper function to safely look up which users have
  auth.uid() as their manager_id, then add a SELECT policy using it.
*/

CREATE OR REPLACE FUNCTION public.get_my_direct_report_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM public.users WHERE manager_id = auth.uid();
$$;

CREATE POLICY "Managers can view their direct reports"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.get_my_direct_report_ids()));
