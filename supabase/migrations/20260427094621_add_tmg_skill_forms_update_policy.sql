/*
  # Allow TMG and Admin to update skill_forms (for manager reassignment)

  ## Problem
  The only UPDATE policy on skill_forms is "Managers can update team skill forms"
  which checks `manager_id = auth.uid()`. This means:
  - Only the currently-assigned manager can update the form
  - When TMG reassigns a manager, they are NOT the current manager_id, so the
    `skill_forms.manager_id` update is silently blocked by RLS
  - Result: users.manager_id gets updated but skill_forms.manager_id stays stale,
    so the new manager never sees the form in their inbox

  ## Fix
  Add a policy allowing TMG and admin to update any skill_form.
  This covers both manager reassignment and review actions (approve/return).
*/

CREATE POLICY "TMG and admin can update any skill form"
  ON public.skill_forms
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('tmg'::user_role, 'admin'::user_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('tmg'::user_role, 'admin'::user_role)
    )
  );
