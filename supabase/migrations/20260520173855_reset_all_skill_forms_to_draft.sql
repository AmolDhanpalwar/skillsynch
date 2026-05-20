
/*
  # Reset all skill forms to draft & clean up blank entries

  1. Cleanup
     - Delete skill_items tied to the blank/unnamed skill_forms row (form_id: 56cc7a24-82c3-45a7-bf50-14deeb56beb5)
     - Delete the blank skill_forms row itself (employee_name IS NULL)

  2. Reset
     - Set ALL remaining skill_forms status to 'draft'
     - Clear submitted_at, approved_at, manager_review_date so employees start fresh
     - Manager mappings (manager_id on users table) are NOT touched

  3. Notes
     - This allows every employee to re-submit their form with corrected data
     - Skill items (language/framework ratings) are retained so employees can review and amend
*/

-- Step 1: Remove orphaned skill_items for the blank form
DELETE FROM skill_items
WHERE form_id IN (
  SELECT id FROM skill_forms WHERE employee_name IS NULL
);

-- Step 2: Remove the blank skill_forms row(s)
DELETE FROM skill_forms
WHERE employee_name IS NULL;

-- Step 3: Reset all remaining forms to draft, clear review timestamps
UPDATE skill_forms
SET
  status             = 'draft',
  submitted_at       = NULL,
  approved_at        = NULL,
  manager_review_date = NULL,
  updated_at         = now();
