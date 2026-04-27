/*
  # Allow TMG to update employee profiles

  ## Problem
  TMG users can assign/change managers via the UI, but the update to public.users
  (setting manager_id on the employee row) was silently failing because no RLS
  UPDATE policy existed for TMG — only admins and self-updates were permitted.

  ## Change
  Add a single UPDATE policy that allows TMG (and admin, for completeness) to update
  any employee's row. Admins already have a separate policy; this adds TMG.

  The policy restricts:
  - Caller must have role 'tmg'
  - Target row must have role 'employee' (TMG cannot elevate or modify other TMG/admin accounts)
*/

CREATE POLICY "TMG can update employee profiles"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    role = 'employee'::user_role
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'tmg'::user_role
    )
  )
  WITH CHECK (
    role = 'employee'::user_role
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'tmg'::user_role
    )
  );
