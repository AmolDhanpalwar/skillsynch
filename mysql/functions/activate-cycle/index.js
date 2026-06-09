/**
 * MySQL equivalent of supabase/functions/activate-cycle
 *
 * Mount at: POST /functions/v1/activate-cycle
 * Auth:     requireAuth middleware (sets req.userId)
 * Deps:     req.app.locals.pool  — mysql2 PromisePool
 *
 * Business logic:
 *   1. Mark the target cycle as active (status='active', triggered_at=NOW())
 *      — only succeeds if current status='draft'
 *   2. Reset all skill_forms: link to this cycle, set status='draft',
 *      clear submitted_at / approved_at / manager_review_date
 */
export default async function handler(req, res) {
  const pool = req.app.locals.pool;
  const { cycle_id } = req.body;

  if (!cycle_id) {
    return res.status(400).json({ error: 'cycle_id is required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Activate cycle (only if currently draft)
    const [cycleResult] = await conn.execute(
      `UPDATE review_cycles
          SET status = 'active', triggered_at = NOW()
        WHERE id = ? AND status = 'draft'`,
      [cycle_id]
    );

    if (cycleResult.affectedRows === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Cycle not found or not in draft status' });
    }

    // 2. Reset all skill_forms
    await conn.execute(
      `UPDATE skill_forms
          SET cycle_id            = ?,
              status              = 'draft',
              submitted_at        = NULL,
              approved_at         = NULL,
              manager_review_date = NULL,
              updated_at          = NOW()
        WHERE 1 = 1`,
      [cycle_id]
    );

    await conn.commit();
    return res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
}
