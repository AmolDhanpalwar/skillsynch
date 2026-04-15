/*
  # Add notifications INSERT policy

  ## Summary
  Allows authenticated users to insert notification rows for other users
  (specifically employees notifying their manager on form submission).
  Without this policy, RLS blocks employees from inserting a notification
  targeted at their manager's user_id.

  ## Changes
  - Adds an INSERT policy on public.notifications allowing any authenticated
    user to insert a notification, with no restriction on the target user_id.
    This is intentional: the row is addressed to another user (the manager)
    and the receiver's SELECT policy already restricts visibility to their own rows.
*/

CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);
