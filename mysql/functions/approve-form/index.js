/**
 * MySQL equivalent of supabase/functions/approve-form
 *
 * Mount at: POST /functions/v1/approve-form
 * Auth:     requireAuth middleware (sets req.userId)
 * Deps:     req.app.locals.pool  — mysql2 PromisePool
 *
 * Business logic:
 *   1. Save manager inputs + set status='approved', approved_at=NOW()
 *   2. Fetch the fully updated form + skill_items for snapshot
 *   3. Upsert immutable snapshot into skill_form_versions
 *   4. Insert a notification for the employee (non-fatal if it fails)
 */
export default async function handler(req, res) {
  const pool = req.app.locals.pool;
  const { form_id, manager_id, manager_inputs, cycle_id, employee_id, cycle_name, approved_by } =
    req.body;

  if (!form_id || !employee_id || !cycle_id) {
    return res.status(400).json({ error: 'form_id, employee_id, and cycle_id are required' });
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Build dynamic UPDATE for manager_inputs + core approval fields
    const updateFields = {
      status: 'approved',
      approved_at: now,
      manager_id: manager_id ?? null,
      ...(manager_inputs ?? {}),
      updated_at: now,
    };
    const setClauses = Object.keys(updateFields)
      .map((k) => `\`${k}\` = ?`)
      .join(', ');
    const updateValues = [...Object.values(updateFields), form_id];

    const [updateResult] = await conn.execute(
      `UPDATE skill_forms SET ${setClauses} WHERE id = ?`,
      updateValues
    );

    if (updateResult.affectedRows === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Form not found' });
    }

    // 2. Fetch the updated form row
    const [[formRow]] = await conn.execute(
      `SELECT * FROM skill_forms WHERE id = ?`,
      [form_id]
    );

    if (!formRow) {
      await conn.rollback();
      return res.status(500).json({ error: 'Form not found after update' });
    }

    // Fetch associated skill_items
    const [skillItems] = await conn.execute(
      `SELECT * FROM skill_items WHERE form_id = ? ORDER BY sort_order`,
      [form_id]
    );

    const snapshot = JSON.stringify({ ...formRow, skill_items: skillItems });

    // 3. Upsert snapshot (INSERT … ON DUPLICATE KEY UPDATE)
    await conn.execute(
      `INSERT INTO skill_form_versions
         (cycle_id, form_id, employee_id, snapshot, approved_at, approved_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         snapshot    = VALUES(snapshot),
         approved_at = VALUES(approved_at),
         approved_by = VALUES(approved_by)`,
      [cycle_id, form_id, employee_id, snapshot, now, approved_by ?? null]
    );

    // 4. Notify employee (non-fatal)
    const message = cycle_name
      ? `Your Skill Profile for "${cycle_name}" has been approved.`
      : 'Your Skill Profile has been approved.';

    try {
      await conn.execute(
        `INSERT INTO notifications (user_id, type, message, form_id, is_read, created_at)
         VALUES (?, 'form_approved', ?, ?, 0, NOW())`,
        [employee_id, message, form_id]
      );
    } catch (notifErr) {
      console.error('Notification insert failed:', notifErr.message);
    }

    await conn.commit();
    return res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
}
