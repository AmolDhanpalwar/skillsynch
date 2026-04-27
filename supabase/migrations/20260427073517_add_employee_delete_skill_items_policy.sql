/*
  # Add DELETE policy for employees on skill_items

  ## Summary
  Employees currently have INSERT and UPDATE on their own skill_items but no DELETE.
  This migration adds a DELETE policy so employees have full CRUD access to their
  skill items when the form is not approved.

  ## Changes
  - New DELETE policy on skill_items allowing employees to delete rows belonging
    to their own non-approved forms.
*/

CREATE POLICY "Employees can delete own skill items"
  ON public.skill_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM skill_forms sf
      WHERE sf.id = skill_items.form_id
        AND sf.employee_id = auth.uid()
        AND sf.status <> 'approved'
    )
  );
