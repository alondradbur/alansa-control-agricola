/* =========================================================
   ALANSA - SISTEMA DE CONTROL AGRÍCOLA
   API: SIEMBRAS / CONTRATOS

   Ajuste:
   - Normaliza importes con separadores de miles.
   - Conserva MXN o USD en campos independientes.
   ========================================================= */


/* =========================================================
   1. IMPORTACIONES
   ========================================================= */

import {
  json,
  error
} from './_util.js';


/* =========================================================
   2. CONSULTAR SIEMBRAS
   ========================================================= */

export async function onRequestGet({
  env
}) {
  const result = await env.DB
    .prepare(`
      SELECT
        pl.*,
        p.name AS product_name,
        c.name AS client_name

      FROM plantings pl

      JOIN products p
        ON p.id = pl.product_id

      JOIN clients c
        ON c.id = pl.client_id

      ORDER BY
        pl.harvest_start DESC,
        pl.id DESC
    `)
    .all();

  return json(
    result.results || []
  );
}


/* =========================================================
   3. CREAR NUEVA SIEMBRA
   ========================================================= */

export async function onRequestPost({
  env,
  request
}) {
  const data = await request.json();

  const hectares = Number(
    data.hectares || 0
  );

  const density = Number(
    data.density_per_ha || 0
  );

  const seedCost = parseMoney(
    data.seed_cost_per_thousand
  ) || 0;

  const actualSeedCost = parseMoney(
    data.actual_seed_cost
  );

  const pricePerBox = parseMoney(
    data.price_per_box
  ) || 0;

  const seedCurrency = validCurrency(
    data.seed_currency,
    'USD'
  );

  const priceCurrency = validCurrency(
    data.price_currency,
    'USD'
  );


  /* ---------------------------------------------------------
     3.1. VALIDACIONES
     --------------------------------------------------------- */

  if (
    !data.contract_number ||
    !data.product_id ||
    !data.client_id
  ) {
    return error(
      'Contrato, cliente y producto son obligatorios.'
    );
  }

  if (
    hectares <= 0 ||
    density <= 0
  ) {
    return error(
      'Hectáreas y densidad deben ser mayores a cero.'
    );
  }

  if (
    !data.harvest_start ||
    !data.harvest_end
  ) {
    return error(
      'Debes indicar el periodo de cosecha.'
    );
  }

  if (
    data.harvest_end <
    data.harvest_start
  ) {
    return error(
      'La fecha final de cosecha no puede ser anterior a la fecha inicial.'
    );
  }


  /* ---------------------------------------------------------
     3.2. COSTO ESTIMADO DE SEMILLA
     --------------------------------------------------------- */

  const estimatedSeedCost =
    (hectares * density / 1000) *
    seedCost;


  /* ---------------------------------------------------------
     3.3. GUARDAR EN D1
     --------------------------------------------------------- */

  try {
    const result = await env.DB
      .prepare(`
        INSERT INTO plantings (
          contract_number,
          product_id,
          client_id,
          hectares,
          density_per_ha,
          seed_cost_per_thousand,
          estimated_seed_cost,
          actual_seed_cost,
          seed_currency,
          harvest_start,
          harvest_end,
          price_per_box,
          price_currency,
          standard_box_lbs,
          trailers_per_week,
          status,
          notes
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?
        )
      `)
      .bind(
        data.contract_number.trim(),
        Number(data.product_id),
        Number(data.client_id),
        hectares,
        density,
        seedCost,
        estimatedSeedCost,
        actualSeedCost,
        seedCurrency,
        data.harvest_start,
        data.harvest_end,
        pricePerBox,
        priceCurrency,
        Number(
          data.standard_box_lbs || 12
        ),
        Number(
          data.trailers_per_week || 1
        ),
        data.status || 'Activa',
        data.notes || null
      )
      .run();

    return json({
      ok: true,
      id:
        result.meta?.last_row_id,
      estimated_seed_cost:
        estimatedSeedCost
    });

  } catch (exception) {
    const message = String(
      exception.message || ''
    );

    if (
      message.includes('UNIQUE')
    ) {
      return error(
        'Ya existe una siembra con ese número de contrato.'
      );
    }

    return error(
      'No fue posible guardar la siembra.'
    );
  }
}


/* =========================================================
   4. ACTUALIZAR SIEMBRA
   ========================================================= */

export async function onRequestPut({
  env,
  request
}) {
  const data = await request.json();

  const id = Number(
    data.id
  );

  if (!id) {
    return error(
      'Falta el identificador de la siembra.'
    );
  }

  const hectares = Number(
    data.hectares || 0
  );

  const density = Number(
    data.density_per_ha || 0
  );

  const seedCost = parseMoney(
    data.seed_cost_per_thousand
  ) || 0;

  const estimatedSeedCost =
    (hectares * density / 1000) *
    seedCost;

  try {
    await env.DB
      .prepare(`
        UPDATE plantings

        SET
          contract_number = ?,
          product_id = ?,
          client_id = ?,
          hectares = ?,
          density_per_ha = ?,
          seed_cost_per_thousand = ?,
          estimated_seed_cost = ?,
          actual_seed_cost = ?,
          seed_currency = ?,
          harvest_start = ?,
          harvest_end = ?,
          price_per_box = ?,
          price_currency = ?,
          standard_box_lbs = ?,
          trailers_per_week = ?,
          status = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP

        WHERE id = ?
      `)
      .bind(
        data.contract_number.trim(),
        Number(data.product_id),
        Number(data.client_id),
        hectares,
        density,
        seedCost,
        estimatedSeedCost,
        parseMoney(
          data.actual_seed_cost
        ),
        validCurrency(
          data.seed_currency,
          'USD'
        ),
        data.harvest_start,
        data.harvest_end,
        parseMoney(
          data.price_per_box
        ) || 0,
        validCurrency(
          data.price_currency,
          'USD'
        ),
        Number(
          data.standard_box_lbs || 12
        ),
        Number(
          data.trailers_per_week || 1
        ),
        data.status || 'Activa',
        data.notes || null,
        id
      )
      .run();

    return json({
      ok: true,
      estimated_seed_cost:
        estimatedSeedCost
    });

  } catch {
    return error(
      'No fue posible actualizar la siembra.'
    );
  }
}


/* =========================================================
   5. ELIMINAR SIEMBRA
   ========================================================= */

export async function onRequestDelete({
  env,
  request
}) {
  const body = await request.json();

  const id = Number(
    body.id
  );

  if (!id) {
    return error(
      'Falta el identificador de la siembra.'
    );
  }

  try {
    await env.DB
      .prepare(`
        DELETE FROM plantings
        WHERE id = ?
      `)
      .bind(id)
      .run();

    return json({
      ok: true
    });

  } catch {
    return error(
      'Esta siembra ya tiene movimientos relacionados y no puede eliminarse.'
    );
  }
}


/* =========================================================
   6. UTILIDADES MONETARIAS
   ========================================================= */

function parseMoney(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const normalized = String(value)
    .replaceAll(',', '')
    .replace(/[^\d.-]/g, '');

  const amount = Number(
    normalized
  );

  return Number.isFinite(amount)
    ? amount
    : null;
}


function validCurrency(
  value,
  fallback = 'USD'
) {
  return ['MXN', 'USD']
    .includes(value)
      ? value
      : fallback;
}
