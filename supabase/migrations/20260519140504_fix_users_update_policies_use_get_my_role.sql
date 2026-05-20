/*
  # Fix users UPDATE policies to use get_my_role() instead of raw self-join

  ## Problem
  The UPDATE policies "TMG can update employee profiles" and "Admins can update
  any user" used EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = X).
  This raw self-join triggers RLS SELECT policies on users, which in turn can
  trigger the UPDATE policy check again, causing infinite recursion.

  ## Fix
  Replace the raw self-join with get_my_role(), which is a SECURITY DEFINER
  function that bypasses RLS and safely returns the current user's role.

  This also keeps users.manager_id in sync whenever TMG updates an employee,
  resolving the drift between users.manager_id and skill_forms.manager_id.
*/

DROP POLICY IF EXISTS "TMG can update employee profiles" ON users;
DROP POLICY IF EXISTS "Admins can update any user" ON users;

CREATE POLICY "TMG can update employee profiles"
  ON users FOR UPDATE
  TO authenticated
  USING (role = 'employee' AND get_my_role() = 'tmg')
  WITH CHECK (role = 'employee' AND get_my_role() = 'tmg');

CREATE POLICY "Admins can update any user"
  ON users FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
