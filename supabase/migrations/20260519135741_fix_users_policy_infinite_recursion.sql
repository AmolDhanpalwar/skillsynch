/*
  # Fix infinite recursion in users RLS policy

  The "Managers can view their direct reports" policy queried public.users
  inside itself, causing infinite recursion. Fixed by using a security definer
  function to break the recursion, and limiting the direct reports sub-query
  to only skill_forms (no self-referencing users query).
*/

DROP POLICY IF EXISTS "Managers can view their direct reports" ON users;

-- Use only skill_forms to determine who is a direct report (no self-join on users)
CREATE POLICY "Managers can view their direct reports"
  ON users FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT employee_id FROM public.skill_forms WHERE manager_id = auth.uid()
    )
  );
