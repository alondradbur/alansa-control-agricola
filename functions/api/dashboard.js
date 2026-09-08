import { json } from './_util.js';


/* =========================================================
   ALANSA - API DASHBOARD
   Entrega datos operativos para filtros y cálculos del
   Dashboard. Los filtros de fecha se aplican en frontend
   para mantener una experiencia inmediata.
   ========================================================= */

export async function onRequestGet({
  env
}) {
  const db = env.DB;

  const [
    plantingsResult,
    estimatedCostsResult,
    shipmentsResult,
    expensesResult,
    productsResult,
    clientsResult
  ] = await Promise.all([
    db.prepare(`
      SELECT
        p.*,
        pr.name AS product_name,
        c.name AS client_name,
        c.credit_days

      FROM plantings p

      JOIN products pr
        ON pr.id = p.product_id

      JOIN clients c
        ON c.id = p.client_id

      ORDER BY
        p.contract_number
    `).all(),

    db.prepare(`
      SELECT
        pec.*

      FROM planting_estimated_costs pec

      ORDER BY
        pec.planting_id,
        pec.id
    `).all(),

    db.prepare(`
      SELECT
        s.*,
        pl.contract_number,
        pl.projection_exchange_rate,
        c.name AS client_name,
        c.credit_days,
        pr.name AS product_name,
        COALESCE(
          (
            SELECT SUM(pa.applied_amount)
            FROM payment_applications pa
            WHERE pa.shipment_id = s.id
          ),
          0
        ) AS collected_amount

      FROM shipments s

      JOIN plantings pl
        ON pl.id = s.planting_id

      JOIN clients c
        ON c.id = s.client_id

      JOIN products pr
        ON pr.id = s.product_id

      ORDER BY
        s.shipment_date DESC,
        s.id DESC
    `).all(),

    db.prepare(`
      SELECT
        e.*,
        pl.contract_number,
        pl.product_id,
        pl.projection_exchange_rate,
        pr.name AS product_name

      FROM expenses e

      JOIN plantings pl
        ON pl.id = e.planting_id

      JOIN products pr
        ON pr.id = pl.product_id

      ORDER BY
        e.expense_date DESC,
        e.id DESC
    `).all(),

    db.prepare(`
      SELECT
        id,
        name

      FROM products

      ORDER BY
        name
    `).all(),

    db.prepare(`
      SELECT
        id,
        name,
        credit_days

      FROM clients

      ORDER BY
        name
    `).all()
  ]);

  const plantings =
    plantingsResult.results || [];

  const estimatedCosts =
    estimatedCostsResult.results || [];

  const costsByPlanting =
    estimatedCosts.reduce(
      (map, row) => {
        const key =
          String(
            row.planting_id
          );

        if (!map[key]) {
          map[key] = [];
        }

        map[key].push(
          row
        );

        return map;
      },
      {}
    );

  plantings.forEach(row => {
    row.estimated_costs =
      costsByPlanting[
        String(row.id)
      ] || [];

    row.projected_boxes =
      Number(
        row.hectares || 0
      ) *
      Number(
        row.expected_yield_boxes_ha || 0
      );

    row.projected_revenue =
      row.projected_boxes *
      Number(
        row.price_per_box || 0
      );
  });

  const shipments =
    (
      shipmentsResult.results ||
      []
    ).map(row => {
      const shipmentDate =
        String(
          row.shipment_date || ''
        ).slice(0, 10);

      if (
        !row.due_date &&
        shipmentDate
      ) {
        row.due_date =
          addDays(
            shipmentDate,
            Number(
              row.credit_days || 0
            )
          );
      }

      row.amount =
        Number(
          row.boxes || 0
        ) *
        Number(
          row.price_per_box || 0
        );

      return row;
    });

  return json({
    plantings,

    shipments,

    expenses:
      expensesResult.results || [],

    products:
      productsResult.results || [],

    clients:
      clientsResult.results || []
  });
}


function addDays(
  isoDate,
  days
) {
  const parts =
    String(
      isoDate
    )
      .split('-')
      .map(Number);

  if (
    parts.length !== 3 ||
    parts.some(
      value => !Number.isFinite(
        value
      )
    )
  ) {
    return null;
  }

  const date =
    new Date(
      Date.UTC(
        parts[0],
        parts[1] - 1,
        parts[2]
      )
    );

  date.setUTCDate(
    date.getUTCDate() +
    Math.max(
      0,
      Number(days || 0)
    )
  );

  return [
    date.getUTCFullYear(),
    String(
      date.getUTCMonth() + 1
    ).padStart(2, '0'),
    String(
      date.getUTCDate()
    ).padStart(2, '0')
  ].join('-');
}
