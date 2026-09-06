import { json } from './_util.js';

export async function onRequestGet(context) {
  const db = context.env.DB;

  const [sales, collected, expenses, production] = await Promise.all([
    db.prepare(`
      SELECT COALESCE(SUM(boxes * price_per_box),0) total
      FROM shipments
      WHERE status <> 'Cancelada'
    `).first(),

    db.prepare(`
      SELECT COALESCE(SUM(applied_amount),0) total
      FROM payment_applications
    `).first(),

    db.prepare(`
      SELECT COALESCE(SUM(mxn_equivalent),0) total
      FROM expenses
    `).first(),

    db.prepare(`
      SELECT
        COALESCE(SUM(boxes),0) boxes,
        COALESCE(SUM(pounds),0) pounds
      FROM production_records
    `).first()
  ]);

  const salesUsd = Number(sales?.total || 0);
  const collectedUsd = Number(collected?.total || 0);

  return json({
    sales_usd: salesUsd,
    collected_usd: collectedUsd,
    receivable_usd: Math.max(0, salesUsd - collectedUsd),
    expenses_mxn: Number(expenses?.total || 0),
    production_boxes: Number(production?.boxes || 0),
    production_pounds: Number(production?.pounds || 0)
  });
}
