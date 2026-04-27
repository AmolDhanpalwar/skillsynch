/*
  # Manager access for any role

  ## Summary
  Previously, "Managers can view/update team skill forms" policies only applied to
  users whose manager_id matched. But since any employee can BE a manager (by having
  forms pointing to their user id), we need to ensure:

  1. The existing "Managers can view team skill forms" policy already uses manager_id = auth.uid()
     which works for any role — no change needed there.
  2. Add a SELECT policy on skill_items so any user whose id is manager_id on the
     parent form can view all items (already exists via "Managers can view team skill items").
  3. Add an UPDATE policy on skill_items for anyone who is manager_id (already exists).

  The real gap is: skill_forms "Managers can view team skill forms" is separate from
  "Privileged roles can view all skill forms". We need to confirm the manager_id-based
  policy has no role restriction — it doesn't, so it already works for any role.

  However the skill_forms UPDATE policy "Managers can update team skill forms" checks
  manager_id = auth.uid() with no role restriction — already fine.

  What IS missing: the skill_items policies for managers check
  "sf.manager_id = auth.uid()" with no role filter — already fine.

  No new policies needed at the DB level. This migration is a no-op confirmation.
  The real fix is in the frontend routing and InboxPage query.

  ## Actual change
  Add a helper view that makes it easy for the frontend to query
  "forms where I am the assigned manager" regardless of my role.

  We do need one real fix: ensure employees (role=employee) who ARE someone's
  manager can UPDATE skill_forms. The existing UPDATE policy only has
  "Managers can update team skill forms" using manager_id = auth.uid() with no
  role restriction — this already covers it. No migration needed.

  This migration intentionally contains only a comment to document the analysis.
*/

-- No DDL change required. Existing RLS policies already cover manager_id = auth.uid()
-- regardless of the user's role. Frontend routing fix handles the rest.
SELECT 1;
