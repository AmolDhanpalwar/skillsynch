/*
  # Add manager DELETE and INSERT policies on skill_items

  ## Problem
  When a manager saves/returns a form, the code deletes all skill_items for
  that form and re-inserts them with manager ratings/comments. However, there
  were no DELETE or INSERT policies for managers on skill_items, causing those
  operations to silently fail under RLS.

  ## Changes
  - Add DELETE policy: managers can delete skill_items for forms they manage
  - Add INSERT policy: managers can insert skill_items for forms they manage
  - Add DELETE/INSERT policies for TMG and admin roles
*/

-- Managers can delete skill items for their team's forms
CREATE POLICY "Managers can delete team skill items"
  ON skill_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM skill_forms sf
      WHERE sf.id = skill_items.form_id
        AND sf.manager_id = auth.uid()
    )
  );

-- Managers can insert skill items for their team's forms
CREATE POLICY "Managers can insert team skill items"
  ON skill_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM skill_forms sf
      WHERE sf.id = skill_items.form_id
        AND sf.manager_id = auth.uid()
    )
  );

-- TMG and admin can delete any skill items
CREATE POLICY "TMG and admin can delete any skill items"
  ON skill_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = ANY (ARRAY['tmg'::user_role, 'admin'::user_role])
    )
  );

-- TMG and admin can insert any skill items
CREATE POLICY "TMG and admin can insert any skill items"
  ON skill_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = ANY (ARRAY['tmg'::user_role, 'admin'::user_role])
    )
  );
