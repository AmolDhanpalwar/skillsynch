/*
  # Add Cycle Suspension Support

  ## Summary
  Adds the ability to suspend an active review cycle with a mandatory reason.
  Suspended cycles are hidden from the cycle selector dropdown but visible on
  the Review Cycles admin page. All employee skill_forms created during that
  cycle's activation are purged on suspension.

  ## Changes

  ### cycle_status_enum
  - Adds 'suspended' value to the existing enum

  ### review_cycles table
  - Adds `suspended_at` (timestamptz) — when the suspension occurred
  - Adds `suspension_reason` (text) — mandatory reason entered by admin/TMG
  - Adds `suspended_by` (uuid, FK → users) — who performed the suspension

  ### New SECURITY DEFINER function: `suspend_cycle(p_cycle_id, p_reason, p_user_id)`
  - Sets review_cycles.status = 'suspended'
  - Records suspended_at, suspension_reason, suspended_by
  - Deletes all skill_items + skill_forms with cycle_id = p_cycle_id (purges employee records)
  - GRANT EXECUTE TO authenticated

  ## Security
  - The SECURITY DEFINER function bypasses RLS on skill_forms/skill_items for the purge step
  - suspended_by FK references users for auditability
*/

-- 1. Add 'suspended' to the cycle_status_enum
ALTER TYPE cycle_status_enum ADD VALUE IF NOT EXISTS 'suspended';

-- 2. Add suspension columns to review_cycles
ALTER TABLE review_cycles
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- 3. Create the suspend_cycle SECURITY DEFINER function
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

  -- Purge all skill_items that belong to forms in this cycle
  DELETE FROM skill_items
  WHERE form_id IN (
    SELECT id FROM skill_forms WHERE cycle_id = p_cycle_id
  );

  -- Purge all skill_forms that belong to this cycle
  DELETE FROM skill_forms
  WHERE cycle_id = p_cycle_id;
END;
$$;

GRANT EXECUTE ON FUNCTION suspend_cycle(uuid, text, uuid) TO authenticated;
