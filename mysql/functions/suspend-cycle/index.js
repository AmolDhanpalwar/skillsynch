/**
 * MySQL equivalent of supabase/functions/suspend-cycle
 *
 * Mount at: POST /functions/v1/suspend-cycle
 * Auth:     requireAuth middleware (sets req.userId)
 * Deps:     req.app.locals.pool  — mysql2 PromisePool
 *
 * Business logic:
 *   1. Mark cycle as suspended (only if currently active)
 *   2. Collect IDs of non-approved skill_forms in this cycle
 *   3. Delete skill_items for those forms
 *   4. Delete those skill_forms
 *      (approved forms and their skill_items are preserved)
 */
export default async function handler(req, res) {
  const pool = req.app.locals.pool;
  const { cycle_id, reason, user_id } = req.body;

  if (!cycle_id || !reason || !user_id) {
    return res.status(400).json({ error: 'cycle_id, reason, and user_id are required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Suspend cycle
    const [cycleResult] = await conn.execute(
      `UPDATE review_cycles
          SET status             = 'suspended',
              suspended_at       = NOW(),
              suspension_reason  = ?,
              suspended_by       = ?
        WHERE id = ? AND status = 'active'`,
      [reason.trim(), user_id, cycle_id]
    );

    if (cycleResult.affectedRows === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Cycle not found or not in active status' });
    }

    // 2. Find non-approved form IDs
    const [formsToDelete] = await conn.execute(
      `SELECT id FROM skill_forms WHERE cycle_id = ? AND status != 'approved'`,
      [cycle_id]
    );

    const formIds = formsToDelete.map((r) => r.id);

    if (formIds.length > 0) {
      const placeholders = formIds.map(() => '?').join(',');

      // 3. Delete skill_items for those forms
      await conn.execute(
        `DELETE FROM skill_items WHERE form_id IN (${placeholders})`,
        formIds
      );

      // 4. Delete the non-approved forms
      await conn.execute(
        `DELETE FROM skill_forms WHERE id IN (${placeholders})`,
        formIds
      );
    }

    await conn.commit();
    return res.json({ success: true, purged_forms: formIds.length });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
}
