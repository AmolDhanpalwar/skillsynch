/**
 * MySQL equivalent of supabase/functions/seed-users
 *
 * Mount at: POST /functions/v1/seed-users
 * Auth:     requireAuth middleware (admin only) — or called internally at startup
 * Deps:     req.app.locals.pool  — mysql2 PromisePool
 *           npm install bcrypt uuid
 *
 * Seeds demo users if the users table is empty.
 * Mirrors the seed data in supabase/functions/seed-users/index.ts.
 */
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const SALT_ROUNDS = 12;

const SEED_DATA = [
  { email: 'employee1@haptiq.com', password: 'emp@123',  full_name: 'Employee One',    role: 'employee',   employee_number: 'EMP001', designation: 'Software Engineer',        grade: 'L2' },
  { email: 'employee2@haptiq.com', password: 'emp@123',  full_name: 'Employee Two',    role: 'employee',   employee_number: 'EMP002', designation: 'Software Engineer',        grade: 'L2' },
  { email: 'employee3@haptiq.com', password: 'emp@123',  full_name: 'Employee Three',  role: 'employee',   employee_number: 'EMP003', designation: 'Software Engineer',        grade: 'L3' },
  { email: 'employee4@haptiq.com', password: 'emp@123',  full_name: 'Employee Four',   role: 'employee',   employee_number: 'EMP004', designation: 'Senior Software Engineer', grade: 'L4' },
  { email: 'employee5@haptiq.com', password: 'emp@123',  full_name: 'Employee Five',   role: 'employee',   employee_number: 'EMP005', designation: 'Senior Software Engineer', grade: 'L4' },
  { email: 'tmg1@haptiq.com',      password: 'tmg@123',  full_name: 'TMG One',         role: 'tmg',        employee_number: 'TMG001', designation: 'Technical Manager',        grade: 'M1' },
  { email: 'tmg2@haptiq.com',      password: 'tmg@123',  full_name: 'TMG Two',         role: 'tmg',        employee_number: 'TMG002', designation: 'Technical Manager',        grade: 'M1' },
  { email: 'mgmt@haptiq.com',      password: 'mgmt@123', full_name: 'Management User', role: 'management', employee_number: 'MGT001', designation: 'Head of Engineering',      grade: 'D1' },
  { email: 'admin@haptiq.com',     password: 'admin@123',full_name: 'System Admin',    role: 'admin',      employee_number: 'ADM001', designation: 'System Administrator',    grade: 'A1' },
];

// Employees → manager assignment: email → manager email
const MANAGER_MAP = {
  'employee1@haptiq.com': 'tmg1@haptiq.com',
  'employee2@haptiq.com': 'tmg1@haptiq.com',
  'employee3@haptiq.com': 'tmg2@haptiq.com',
  'employee4@haptiq.com': 'tmg2@haptiq.com',
  'employee5@haptiq.com': 'tmg2@haptiq.com',
};

export default async function handler(req, res) {
  const pool = req.app.locals.pool;
  const conn = await pool.getConnection();

  try {
    // Check if already seeded
    const [[{ count }]] = await conn.execute(
      `SELECT COUNT(*) AS count FROM users`
    );
    if (Number(count) > 0) {
      return res.json({ message: 'Already seeded', count: Number(count) });
    }

    await conn.beginTransaction();

    const createdIds = {};

    for (const user of SEED_DATA) {
      const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);
      const userId = uuidv4();

      await conn.execute(
        `INSERT INTO auth_users (id, email, password_hash) VALUES (?, ?, ?)`,
        [userId, user.email, passwordHash]
      );

      await conn.execute(
        `INSERT INTO users (id, email, full_name, role, employee_number, designation, grade, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
        [userId, user.email, user.full_name, user.role, user.employee_number, user.designation, user.grade]
      );

      createdIds[user.email] = userId;
    }

    // Assign managers
    for (const [empEmail, mgrEmail] of Object.entries(MANAGER_MAP)) {
      const empId = createdIds[empEmail];
      const mgrId = createdIds[mgrEmail];
      if (empId && mgrId) {
        await conn.execute(
          `UPDATE users SET manager_id = ? WHERE id = ?`,
          [mgrId, empId]
        );
      }
    }

    await conn.commit();
    return res.json({ message: 'Seeded successfully', users: createdIds });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
}
