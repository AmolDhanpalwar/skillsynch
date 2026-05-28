/*
  # Restore Approved Forms from Snapshots & Fix suspend_cycle

  ## Summary
  Two problems are addressed:

  1. The previous `suspend_cycle` function deleted ALL skill_forms and skill_items for a
     cycle, including already-approved ones. This data loss is wrong — only non-approved
     (draft/pending/returned) forms should be purged on suspension; approved forms must
     be preserved.

  2. As a result of the bug, the approved skill_form for "Employee One" in "Mid Year
     Cycle 2026" (suspended cycle) was deleted. Its snapshot still exists in
     `skill_form_versions`. This migration restores the skill_form and skill_items from
     that snapshot.

  ## Changes

  ### Restore deleted data
  - Re-inserts the approved skill_form for Employee One (id: ce2e6f8c-...) from the
    snapshot stored in skill_form_versions for cycle 35ca4812-...
  - Re-inserts all 10 skill_items that were part of that approved form

  ### Fix suspend_cycle function
  - Rewrites the SECURITY DEFINER function to only DELETE skill_items/skill_forms where
    the form status IS NOT 'approved'
  - Approved forms remain in the database alongside their snapshots

  ## Security
  - No RLS changes — existing policies already restrict access correctly
*/

-- ─── 1. Restore the deleted approved skill_form ──────────────────────────────

INSERT INTO skill_forms (
  id, employee_id, cycle_id, status,
  total_exp, relevant_exp, haptiq_exp,
  current_project, tools, databases,
  tools_manager_comment, databases_manager_comment,
  certifications, upskilling_plan, manager_expectation_plan,
  submitted_at, approved_at,
  employee_name, employee_email, employee_number,
  designation, grade,
  environments_manager_comment, reminders_sent
)
SELECT
  (snapshot->>'id')::uuid,
  '8408d823-3a77-4bb8-8130-d1e4074b3d68'::uuid,
  '35ca4812-66fc-4b25-a865-2ef970f00686'::uuid,
  'approved'::form_status,
  (snapshot->>'total_exp')::numeric,
  (snapshot->>'relevant_exp')::numeric,
  (snapshot->>'haptiq_exp')::numeric,
  snapshot->>'current_project',
  snapshot->>'tools',
  snapshot->>'databases',
  snapshot->>'tools_manager_comment',
  snapshot->>'databases_manager_comment',
  ARRAY(SELECT jsonb_array_elements_text(snapshot->'certifications')),
  snapshot->>'upskilling_plan',
  snapshot->>'manager_expectation_plan',
  (snapshot->>'submitted_at')::timestamptz,
  (snapshot->>'approved_at')::timestamptz,
  snapshot->>'employee_name',
  snapshot->>'employee_email',
  snapshot->>'employee_number',
  snapshot->>'designation',
  snapshot->>'grade',
  snapshot->>'environments_manager_comment',
  COALESCE((snapshot->>'reminders_sent')::int, 0)
FROM skill_form_versions
WHERE cycle_id = '35ca4812-66fc-4b25-a865-2ef970f00686'
  AND employee_id = '8408d823-3a77-4bb8-8130-d1e4074b3d68'
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Restore the deleted skill_items for that form ────────────────────────

INSERT INTO skill_items (id, form_id, category, name, sort_order, employee_rating, manager_rating, manager_comment)
SELECT
  (item->>'id')::uuid,
  (item->>'form_id')::uuid,
  (item->>'category')::skill_category,
  item->>'name',
  (item->>'sort_order')::int,
  (item->>'employee_rating')::int,
  (item->>'manager_rating')::int,
  item->>'manager_comment'
FROM skill_form_versions,
  jsonb_array_elements(snapshot->'skill_items') AS item
WHERE cycle_id = '35ca4812-66fc-4b25-a865-2ef970f00686'
  AND employee_id = '8408d823-3a77-4bb8-8130-d1e4074b3d68'
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Link the snapshot's form_id back (it was null) ───────────────────────

UPDATE skill_form_versions
SET form_id = (snapshot->>'id')::uuid
WHERE cycle_id = '35ca4812-66fc-4b25-a865-2ef970f00686'
  AND employee_id = '8408d823-3a77-4bb8-8130-d1e4074b3d68'
  AND form_id IS NULL;

-- ─── 4. Fix suspend_cycle — only purge non-approved forms ────────────────────

CREATE OR REPLACE FUNCTION suspend_cycle(
  p_cycle_id    uuid,
  p_reason      text,
  p_user_id     uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark cycle as suspended
  UPDATE review_cycles
  SET
    status            = 'suspended',
    suspended_at      = now(),
    suspension_reason = p_reason,
    suspended_by      = p_user_id
  WHERE id = p_cycle_id
    AND status = 'active';

  -- Purge skill_items that belong to non-approved forms in this cycle
  DELETE FROM skill_items
  WHERE form_id IN (
    SELECT id FROM skill_forms
    WHERE cycle_id = p_cycle_id
      AND status != 'approved'
  );

  -- Purge only non-approved skill_forms in this cycle
  DELETE FROM skill_forms
  WHERE cycle_id = p_cycle_id
    AND status != 'approved';
END;
$$;

GRANT EXECUTE ON FUNCTION suspend_cycle(uuid, text, uuid) TO authenticated;
