/*
  # Move business logic out of database into Edge Functions

  ## Summary
  Drops the SECURITY DEFINER functions and DB trigger that previously housed
  business logic. All logic is now in Git-tracked Edge Functions:
    - activate-cycle  → replaces activate_cycle_reset_forms()
    - suspend-cycle   → replaces suspend_cycle()
    - approve-form    → replaces trg_skill_form_approval_snapshot trigger
    - return-form     → new edge function for returning forms

  The GRANT statements are also revoked since the functions no longer exist.

  ## What is kept in the DB
  - Tables, indexes, RLS policies (data layer only)
  - get_my_role() helper (used by RLS policies — not business logic)
*/

-- Drop trigger first (depends on the function)
DROP TRIGGER IF EXISTS trg_skill_form_approval_snapshot ON skill_forms;

-- Drop SECURITY DEFINER functions
DROP FUNCTION IF EXISTS create_approval_snapshot();
DROP FUNCTION IF EXISTS activate_cycle_reset_forms(uuid);
DROP FUNCTION IF EXISTS suspend_cycle(uuid, text, uuid);
