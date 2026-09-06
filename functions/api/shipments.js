import { json } from './_util.js';

export async function onRequestGet(context) {
  const result = await context.env.DB.prepare(`
    SELECT
      s.id,
      s.folio,
      s.shipment_date,
      s.boxes,
      s.pounds,
      s.price_per_box,
      s.currency,
      s.status,
      c.name client_name,
      p.name product_name,
      CASE WHEN s.boxes > 0 THEN s.pounds / s.boxes ELSE 0 END avg_lbs,
      s.boxes * s.price_per_box amount
    FROM shipments s
    JOIN clients c ON c.id = s.client_id
    JOIN products p ON p.id = s.product_id
    ORDER BY s.shipment_date DESC, s.sequence DESC
  `).all();

  return json(result.results || []);
}
