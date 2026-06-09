/**
 * MySQL equivalent of supabase/functions/add-sample-employees
 *
 * Mount at: POST /functions/v1/add-sample-employees
 * Auth:     requireAuth middleware (admin only)
 * Deps:     req.app.locals.pool  — mysql2 PromisePool
 *           npm install bcrypt uuid
 *
 * Adds sample employee accounts (employees 3–5) if they don't already exist.
 * Idempotent — skips users whose email already exists in the users table.
 */
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const SALT_ROUNDS = 12;

const NEW_EMPLOYEES = [
  { email: 'employee3@haptiq.com', password: 'emp@123', full_name: 'Employee Three', role: 'employee', employee_number: 'EMP003', designation: 'Software Engineer',        grade: 'L3' },
  { email: 'employee4@haptiq.com', password: 'emp@123', full_name: 'Employee Four',  role: 'employee', employee_number: 'EMP004', designation: 'Senior Software Engineer', grade: 'L4' },
  { email: 'employee5@haptiq.com', password: 'emp@123', full_name: 'Employee Five',  role: 'employee', employee_number: 'EMP005', designation: 'Senior Software Engineer', grade: 'L4' },
];

export default async function handler(req, res) {
  const pool = req.app.locals.pool;
  const results = {};

  for (const emp of NEW_EMPLOYEES) {
    try {
      const [[existing]] = await pool.execute(
        `SELECT id FROM users WHERE email = ?`,
        [emp.email]
      );
      if (existing) {
        results[emp.email] = 'already_exists';
        continue;
      }

      const passwordHash = await bcrypt.hash(emp.password, SALT_ROUNDS);
      const userId = uuidv4();

      await pool.execute(
        `INSERT INTO auth_users (id, email, password_hash) VALUES (?, ?, ?)`,
        [userId, emp.email, passwordHash]
      );

      await pool.execute(
        `INSERT INTO users (id, email, full_name, role, employee_number, designation, grade, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
        [userId, emp.email, emp.full_name, emp.role, emp.employee_number, emp.designation, emp.grade]
      );

      results[emp.email] = 'created';
    } catch (err) {
      results[emp.email] = `error: ${err.message}`;
    }
  }

  return res.json({ results });
}
