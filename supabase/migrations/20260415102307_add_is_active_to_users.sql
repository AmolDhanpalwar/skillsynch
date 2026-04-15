/*
  # Add is_active column to users table

  1. Changes
    - `users` table: Add `is_active` boolean column (default true)
      Allows admins to deactivate/activate user accounts without deleting them.

  2. Security
    - No RLS policy changes needed; admin updates handled via service role in edge functions.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE users ADD COLUMN is_active boolean DEFAULT true NOT NULL;
  END IF;
END $$;

CREATE POLICY "Admins can update any user"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );
