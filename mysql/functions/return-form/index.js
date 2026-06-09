/**
 * MySQL equivalent of supabase/functions/return-form
 *
 * Mount at: POST /functions/v1/return-form
 * Auth:     requireAuth middleware (sets req.userId)
 * Deps:     req.app.locals.pool  — mysql2 PromisePool
 *
 * Business logic:
 *   1. Save manager inputs + set status='returned'
 *   2. Insert a notification for the employee with the return reason
 */
export default async function handler(req, res) {
  const pool = req.app.locals.pool;
  const { form_id, manager_id, manager_inputs, employee_id, reason } = req.body;

  if (!form_id || !employee_id || !reason) {
    return res.status(400).json({ error: 'form_id, employee_id, and reason are required' });
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Save manager inputs + mark as returned
    const updateFields = {
      status: 'returned',
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

    // 2. Notify employee (non-fatal)
    try {
      await conn.execute(
        `INSERT INTO notifications (user_id, type, message, form_id, is_read, created_at)
         VALUES (?, 'form_returned', ?, ?, 0, NOW())`,
        [employee_id, `Your Skill Profile was returned for revision. Reason: ${reason}`, form_id]
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
