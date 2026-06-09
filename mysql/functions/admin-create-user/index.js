/**
 * MySQL equivalent of supabase/functions/admin-create-user
 *
 * Mount at: POST /functions/v1/admin-create-user
 * Auth:     requireAuth middleware (caller must have role='admin')
 * Deps:     req.app.locals.pool  — mysql2 PromisePool
 *           npm install bcrypt uuid
 *
 * Business logic:
 *   1. Check for duplicate email
 *   2. Hash the password with bcrypt
 *   3. Insert into auth_users (stores credentials)
 *   4. Insert into users (profile row, same UUID)
 *
 * MySQL auth_users table expected schema:
 *   CREATE TABLE auth_users (
 *     id         CHAR(36) PRIMARY KEY,
 *     email      VARCHAR(255) UNIQUE NOT NULL,
 *     password_hash VARCHAR(255) NOT NULL,
 *     created_at DATETIME DEFAULT NOW()
 *   );
 */
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const SALT_ROUNDS = 12;

export default async function handler(req, res) {
  const pool = req.app.locals.pool;
  const { full_name, email, password, role } = req.body;

  if (!full_name || !email || !password || !role) {
    return res.status(400).json({ error: 'full_name, email, password, and role are required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Check duplicate
    const [[existing]] = await conn.execute(
      `SELECT id FROM auth_users WHERE email = ?`,
      [email]
    );
    if (existing) {
      await conn.rollback();
      return res.status(400).json({ error: 'A user with this email address already exists.' });
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = uuidv4();

    // 3. Create auth record
    await conn.execute(
      `INSERT INTO auth_users (id, email, password_hash) VALUES (?, ?, ?)`,
      [userId, email.toLowerCase().trim(), passwordHash]
    );

    // 4. Create profile row
    await conn.execute(
      `INSERT INTO users (id, email, full_name, role, is_active, created_at)
       VALUES (?, ?, ?, ?, 1, NOW())`,
      [userId, email.toLowerCase().trim(), full_name, role]
    );

    await conn.commit();
    return res.json({ success: true, user_id: userId });
  } catch (err) {
    await conn.rollback();
    const isDuplicate =
      err.code === 'ER_DUP_ENTRY' ||
      err.message.toLowerCase().includes('duplicate');
    if (isDuplicate) {
      return res.status(400).json({ error: 'A user with this email address already exists.' });
    }
    return res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
}
