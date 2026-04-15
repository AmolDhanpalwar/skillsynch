/*
  # Allow employees to view their direct manager's profile

  ## Problem
  Employees need to display their manager's name and email on the skill form,
  but the existing RLS policy on public.users only allows users to view their own row.
  Privileged roles (tmg, admin, etc.) can view all, but regular employees cannot
  look up their manager.

  ## Change
  - Adds a SECURITY DEFINER helper function get_my_manager_id() that safely
    reads the current user's manager_id without RLS recursion.
  - Adds a SELECT policy allowing any authenticated user to view the profile
    of their direct manager (one level up only).
*/

CREATE OR REPLACE FUNCTION public.get_my_manager_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT manager_id FROM public.users WHERE id = auth.uid();
$$;

CREATE POLICY "Users can view their direct manager profile"
  ON public.users FOR SELECT TO authenticated
  USING (id = public.get_my_manager_id());
