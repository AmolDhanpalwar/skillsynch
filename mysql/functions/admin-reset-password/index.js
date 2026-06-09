/**
 * MySQL equivalent of supabase/functions/admin-reset-password
 *
 * Mount at: POST /functions/v1/admin-reset-password
 * Auth:     requireAuth middleware (caller must have role='admin')
 * Deps:     req.app.locals.pool  — mysql2 PromisePool
 *           npm install bcrypt
 *
 * Resets the target user's password to the default "Welcome@123".
 * On first login the user should be prompted to change it.
 */
import bcrypt from 'bcrypt';

const DEFAULT_PASSWORD = 'Welcome@123';
const SALT_ROUNDS = 12;

export default async function handler(req, res) {
  const pool = req.app.locals.pool;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  try {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    const [result] = await pool.execute(
      `UPDATE auth_users SET password_hash = ? WHERE id = ?`,
      [passwordHash, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
