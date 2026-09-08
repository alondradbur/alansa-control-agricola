/* =========================================================
   SISTEMA DE CONTROL AGRÍCOLA
   API: SIEMBRAS / CONTRATOS

   Funciones:
   - Consultar siembras.
   - Crear nuevas siembras.
   - Editar registros existentes.
   - Eliminar solo si no tienen movimientos relacionados.
   - Calcular costo estimado de semilla.
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
  try {
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

  } catch {
    return error(
      'No fue posible consultar las siembras.'
    );
  }
}


/* =========================================================
   3. CREAR NUEVA SIEMBRA
   ========================================================= */

export async function onRequestPost({
  env,
  request
}) {
  const data = await request.json();

  const validation =
    validatePlanting(
      data
    );

  if (validation.error) {
    return error(
      validation.error
    );
  }

  const values =
    validation.values;

  try {
    const result = await env.DB
      .prepare(`
        INSERT INTO plantings (
          contract_number,
          product_id,
          client_id,
          hectares,
          expected_yield_boxes_ha,
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
          ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `)
      .bind(
        values.contractNumber,
        values.productId,
        values.clientId,
        values.hectares,
        values.expectedYield,
        values.density,
        values.seedCost,
        values.estimatedSeedCost,
        values.actualSeedCost,
        values.seedCurrency,
        values.harvestStart,
        values.harvestEnd,
        values.pricePerBox,
        values.priceCurrency,
        values.standardBoxLbs,
        values.trailersPerWeek,
        values.status,
        values.notes
      )
      .run();

    return json({
      ok: true,
      id:
        result.meta?.last_row_id,
      estimated_seed_cost:
        values.estimatedSeedCost
    });

  } catch (exception) {
    return plantingError(
      exception,
      'guardar'
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

  const validation =
    validatePlanting(
      data
    );

  if (validation.error) {
    return error(
      validation.error
    );
  }

  const values =
    validation.values;

  try {
    const result = await env.DB
      .prepare(`
        UPDATE plantings

        SET
          contract_number = ?,
          product_id = ?,
          client_id = ?,
          hectares = ?,
          expected_yield_boxes_ha = ?,
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
        values.contractNumber,
        values.productId,
        values.clientId,
        values.hectares,
        values.expectedYield,
        values.density,
        values.seedCost,
        values.estimatedSeedCost,
        values.actualSeedCost,
        values.seedCurrency,
        values.harvestStart,
        values.harvestEnd,
        values.pricePerBox,
        values.priceCurrency,
        values.standardBoxLbs,
        values.trailersPerWeek,
        values.status,
        values.notes,
        id
      )
      .run();

    if (
      Number(
        result.meta?.changes || 0
      ) === 0
    ) {
      return error(
        'No se encontró la siembra que intentas actualizar.'
      );
    }

    return json({
      ok: true,
      id,
      estimated_seed_cost:
        values.estimatedSeedCost
    });

  } catch (exception) {
    return plantingError(
      exception,
      'actualizar'
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
    const dependencies =
      await hasRelatedMovements(
        env.DB,
        id
      );

    if (dependencies) {
      return error(
        'Esta siembra ya tiene movimientos relacionados y no puede eliminarse. Puedes conservarla y cambiar su estado.'
      );
    }

    const result = await env.DB
      .prepare(`
        DELETE FROM plantings
        WHERE id = ?
      `)
      .bind(
        id
      )
      .run();

    if (
      Number(
        result.meta?.changes || 0
      ) === 0
    ) {
      return error(
        'No se encontró la siembra que intentas eliminar.'
      );
    }

    return json({
      ok: true
    });

  } catch {
    return error(
      'No fue posible eliminar la siembra.'
    );
  }
}


/* =========================================================
   6. VALIDAR Y NORMALIZAR SIEMBRA
   ========================================================= */

function validatePlanting(
  data
) {
  const contractNumber =
    String(
      data.contract_number || ''
    ).trim();

  const productId = Number(
    data.product_id
  );

  const clientId = Number(
    data.client_id
  );

  const hectares = positiveNumber(
    data.hectares
  );

  const expectedYield = positiveNumber(
    data.expected_yield_boxes_ha
  );

  const density = positiveNumber(
    data.density_per_ha
  );

  const seedCost =
    parseMoney(
      data.seed_cost_per_thousand
    ) ?? 0;

  const actualSeedCost =
    parseMoney(
      data.actual_seed_cost
    );

  const seedCurrency =
    validCurrency(
      data.seed_currency,
      'USD'
    );

  const harvestStart =
    String(
      data.harvest_start || ''
    ).trim();

  const harvestEnd =
    String(
      data.harvest_end || ''
    ).trim();

  const pricePerBox =
    parseMoney(
      data.price_per_box
    ) ?? 0;

  const priceCurrency =
    validCurrency(
      data.price_currency,
      'USD'
    );

  const standardBoxLbs =
    positiveNumber(
      data.standard_box_lbs
    ) ?? 12;

  const trailersPerWeek =
    positiveNumber(
      data.trailers_per_week
    ) ?? 1;

  const status =
    validStatus(
      data.status
    );

  const notes =
    optionalText(
      data.notes
    );

  if (!contractNumber) {
    return {
      error:
        'El número de contrato es obligatorio.'
    };
  }

  if (!productId) {
    return {
      error:
        'Debes seleccionar un producto.'
    };
  }

  if (!clientId) {
    return {
      error:
        'Debes seleccionar un cliente.'
    };
  }

  if (
    hectares === null ||
    hectares <= 0
  ) {
    return {
      error:
        'Las hectáreas deben ser mayores a cero.'
    };
  }

  if (
    expectedYield === null ||
    expectedYield <= 0
  ) {
    return {
      error:
        'El rendimiento esperado por hectárea debe ser mayor a cero.'
    };
  }

  if (
    density === null ||
    density <= 0
  ) {
    return {
      error:
        'La densidad de siembra debe ser mayor a cero.'
    };
  }

  if (
    seedCost < 0 ||
    pricePerBox < 0
  ) {
    return {
      error:
        'Los importes no pueden ser negativos.'
    };
  }

  if (
    actualSeedCost !== null &&
    actualSeedCost < 0
  ) {
    return {
      error:
        'El costo real de semilla no puede ser negativo.'
    };
  }

  if (
    !harvestStart ||
    !harvestEnd
  ) {
    return {
      error:
        'Debes indicar el periodo de cosecha.'
    };
  }

  if (
    harvestEnd < harvestStart
  ) {
    return {
      error:
        'La fecha final de cosecha no puede ser anterior a la fecha inicial.'
    };
  }

  if (!status) {
    return {
      error:
        'El estado de la siembra no es válido.'
    };
  }

  const estimatedSeedCost =
    (
      hectares *
      density /
      1000
    ) *
    seedCost;

  return {
    values: {
      contractNumber,
      productId,
      clientId,
      hectares,
      expectedYield,
      density,
      seedCost,
      estimatedSeedCost,
      actualSeedCost,
      seedCurrency,
      harvestStart,
      harvestEnd,
      pricePerBox,
      priceCurrency,
      standardBoxLbs,
      trailersPerWeek,
      status,
      notes
    }
  };
}


/* =========================================================
   7. PROTEGER REGISTROS CON MOVIMIENTOS
   ========================================================= */

async function hasRelatedMovements(
  db,
  plantingId
) {
  const checks = [
    'production_records',
    'shipments',
    'expenses'
  ];

  for (const table of checks) {
    const result = await db
      .prepare(`
        SELECT id
        FROM ${table}
        WHERE planting_id = ?
        LIMIT 1
      `)
      .bind(
        plantingId
      )
      .first();

    if (result) {
      return true;
    }
  }

  return false;
}


/* =========================================================
   8. UTILIDADES
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

  const normalized =
    String(value)
      .replaceAll(',', '')
      .replace(/[^\d.-]/g, '');

  const amount = Number(
    normalized
  );

  return Number.isFinite(amount)
    ? amount
    : null;
}


function positiveNumber(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const result = Number(
    String(value)
      .replaceAll(',', '')
  );

  return Number.isFinite(result)
    ? result
    : null;
}


function validCurrency(
  value,
  fallback = 'USD'
) {
  return [
    'MXN',
    'USD'
  ].includes(value)
    ? value
    : fallback;
}


function validStatus(
  value
) {
  const status =
    String(
      value || 'Activa'
    ).trim();

  return [
    'Activa',
    'Finalizada',
    'Cancelada'
  ].includes(status)
    ? status
    : null;
}


function optionalText(
  value
) {
  const result =
    String(
      value || ''
    ).trim();

  return result || null;
}


function plantingError(
  exception,
  action
) {
  const message =
    String(
      exception?.message || ''
    );

  if (
    message.includes('UNIQUE')
  ) {
    return error(
      'Ya existe una siembra con ese número de contrato.'
    );
  }

  if (
    message.includes('FOREIGN KEY')
  ) {
    return error(
      'El cliente o producto seleccionado ya no existe.'
    );
  }

  return error(
    `No fue posible ${action} la siembra.`
  );
}
