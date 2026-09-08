/* =========================================================
   SISTEMA DE CONTROL AGRÍCOLA
   API: SIEMBRAS / CONTRATOS

   Funciones:
   - Consultar siembras.
   - Crear nuevas siembras.
   - Editar registros existentes.
   - Eliminar siembras sin movimientos relacionados.
   - Guardar costos proyectados por concepto y unidad.
   - Calcular cantidades proyectadas en el backend.
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
    const [
      plantingsResult,
      costsResult
    ] = await Promise.all([
      env.DB
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
        .all(),

      env.DB
        .prepare(`
          SELECT
            pec.id,
            pec.planting_id,
            pec.category_id,
            pec.expense_unit_id,
            pec.concept,
            pec.unit_amount,
            pec.quantity,
            pec.amount,
            pec.currency,
            ec.name AS category_name,
            eu.name AS unit_name,
            eu.quantity_source

          FROM planting_estimated_costs pec

          LEFT JOIN expense_categories ec
            ON ec.id = pec.category_id

          LEFT JOIN expense_units eu
            ON eu.id = pec.expense_unit_id

          ORDER BY
            pec.planting_id,
            pec.id
        `)
        .all()
    ]);

    const plantings =
      plantingsResult.results || [];

    const costs =
      costsResult.results || [];

    const costsByPlanting = {};

    costs.forEach(cost => {
      const key =
        Number(cost.planting_id);

      if (!costsByPlanting[key]) {
        costsByPlanting[key] = [];
      }

      costsByPlanting[key].push({
        id: Number(cost.id),
        category_id:
          cost.category_id === null
            ? null
            : Number(cost.category_id),
        expense_unit_id:
          cost.expense_unit_id === null
            ? null
            : Number(cost.expense_unit_id),
        concept:
          cost.category_name ||
          cost.concept ||
          '',
        category_name:
          cost.category_name ||
          cost.concept ||
          '',
        unit_name:
          cost.unit_name || '',
        quantity_source:
          cost.quantity_source || 'MANUAL',
        unit_amount:
          Number(
            cost.unit_amount ??
            cost.amount ??
            0
          ),
        quantity:
          Number(
            cost.quantity ??
            1
          ),
        amount:
          Number(
            cost.amount || 0
          ),
        currency:
          cost.currency || 'MXN'
      });
    });

    return json(
      plantings.map(planting => {
        const hectares =
          Number(planting.hectares || 0);

        const expectedYield =
          Number(
            planting.expected_yield_boxes_ha || 0
          );

        const standardBoxLbs =
          Number(
            planting.standard_box_lbs || 0
          );

        const pricePerBox =
          Number(
            planting.price_per_box || 0
          );

        const density =
          Number(
            planting.density_per_ha || 0
          );

        const projectedBoxes =
          hectares * expectedYield;

        const projectedPounds =
          projectedBoxes * standardBoxLbs;

        const projectedPlants =
          hectares * density;

        const projectedRevenue =
          projectedBoxes * pricePerBox;

        return {
          ...planting,

          hectares,
          expected_yield_boxes_ha:
            expectedYield,
          standard_box_lbs:
            standardBoxLbs,
          price_per_box:
            pricePerBox,
          density_per_ha:
            density,

          projected_boxes:
            projectedBoxes,

          projected_pounds:
            projectedPounds,

          projected_plants:
            projectedPlants,

          projected_revenue:
            projectedRevenue,

          projected_revenue_per_ha:
            hectares > 0
              ? projectedRevenue / hectares
              : 0,

          estimated_costs:
            costsByPlanting[
              Number(planting.id)
            ] || []
        };
      })
    );

  } catch (exception) {
    console.error(
      'Error al consultar siembras:',
      exception
    );

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
  const data =
    await request.json();

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

  const estimatedCosts =
    await validateProjectedCosts(
      env.DB,
      data.estimated_costs,
      values
    );

  if (estimatedCosts.error) {
    return error(
      estimatedCosts.error
    );
  }

  const exchangeValidation =
    validateProjectionExchangeRate(
      values,
      estimatedCosts.values
    );

  if (exchangeValidation) {
    return error(
      exchangeValidation
    );
  }

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
          seed_currency,
          harvest_start,
          harvest_end,
          price_per_box,
          price_currency,
          standard_box_lbs,
          trailers_per_week,
          status,
          projection_exchange_rate,
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
        values.seedCurrency,
        values.harvestStart,
        values.harvestEnd,
        values.pricePerBox,
        values.priceCurrency,
        values.standardBoxLbs,
        values.trailersPerWeek,
        values.status,
        values.projectionExchangeRate,
        values.notes
      )
      .run();

    const plantingId =
      Number(
        result.meta?.last_row_id
      );

    await replaceProjectedCosts(
      env.DB,
      plantingId,
      estimatedCosts.values
    );

    return json({
      ok: true,
      id: plantingId,
      projection:
        buildProjectionSummary(
          values,
          estimatedCosts.values
        )
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
  const data =
    await request.json();

  const id =
    Number(data.id);

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

  const estimatedCosts =
    await validateProjectedCosts(
      env.DB,
      data.estimated_costs,
      values
    );

  if (estimatedCosts.error) {
    return error(
      estimatedCosts.error
    );
  }

  const exchangeValidation =
    validateProjectionExchangeRate(
      values,
      estimatedCosts.values
    );

  if (exchangeValidation) {
    return error(
      exchangeValidation
    );
  }

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
          seed_currency = ?,
          harvest_start = ?,
          harvest_end = ?,
          price_per_box = ?,
          price_currency = ?,
          standard_box_lbs = ?,
          trailers_per_week = ?,
          status = ?,
          projection_exchange_rate = ?,
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
        values.seedCurrency,
        values.harvestStart,
        values.harvestEnd,
        values.pricePerBox,
        values.priceCurrency,
        values.standardBoxLbs,
        values.trailersPerWeek,
        values.status,
        values.projectionExchangeRate,
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

    await replaceProjectedCosts(
      env.DB,
      id,
      estimatedCosts.values
    );

    return json({
      ok: true,
      id,
      projection:
        buildProjectionSummary(
          values,
          estimatedCosts.values
        )
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
  const body =
    await request.json();

  const id =
    Number(body.id);

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

    await env.DB.batch([
      env.DB
        .prepare(`
          DELETE FROM planting_estimated_costs
          WHERE planting_id = ?
        `)
        .bind(id),

      env.DB
        .prepare(`
          DELETE FROM plantings
          WHERE id = ?
        `)
        .bind(id)
    ]);

    return json({
      ok: true
    });

  } catch (exception) {
    console.error(
      'Error al eliminar siembra:',
      exception
    );

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

  const productId =
    Number(data.product_id);

  const clientId =
    Number(data.client_id);

  const hectares =
    positiveNumber(
      data.hectares
    );

  const expectedYield =
    positiveNumber(
      data.expected_yield_boxes_ha
    );

  const density =
    positiveNumber(
      data.density_per_ha
    );

  const seedCost =
    parseMoney(
      data.seed_cost_per_thousand
    ) ?? 0;

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

  const projectionExchangeRate =
    parseMoney(
      data.projection_exchange_rate
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
    expectedYield < 0
  ) {
    return {
      error:
        'El rendimiento esperado por hectárea no puede ser negativo.'
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
    projectionExchangeRate !== null &&
    projectionExchangeRate <= 0
  ) {
    return {
      error:
        'El tipo de cambio debe ser mayor a cero.'
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

  if (
    standardBoxLbs === null ||
    standardBoxLbs <= 0
  ) {
    return {
      error:
        'El peso estándar por caja debe ser mayor a cero.'
    };
  }

  if (!status) {
    return {
      error:
        'El estado de la siembra no es válido.'
    };
  }

  /*
   * Compatibilidad con la estructura anterior.
   * La semilla dejará de sumarse por separado en el nuevo
   * formulario de proyección; el costo real de la proyección
   * vivirá en planting_estimated_costs.
   */
  const estimatedSeedCost =
    seedCost > 0
      ? (
          hectares *
          density /
          1000
        ) * seedCost
      : 0;

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
      seedCurrency,
      harvestStart,
      harvestEnd,
      pricePerBox,
      priceCurrency,
      standardBoxLbs,
      trailersPerWeek,
      status,
      projectionExchangeRate,
      notes
    }
  };
}


/* =========================================================
   7. VALIDAR COSTOS PROYECTADOS
   ========================================================= */

async function validateProjectedCosts(
  db,
  costs,
  planting
) {
  if (
    costs === undefined ||
    costs === null
  ) {
    return {
      values: []
    };
  }

  if (!Array.isArray(costs)) {
    return {
      error:
        'Los costos proyectados no tienen un formato válido.'
    };
  }

  const normalized = [];

  for (const rawCost of costs) {
    const categoryId =
      Number(
        rawCost?.category_id
      ) || null;

    const unitId =
      Number(
        rawCost?.expense_unit_id
      ) || null;

    /*
     * Compatibilidad temporal con el formulario anterior:
     * concept + amount + currency.
     */
    if (
      !categoryId &&
      !unitId
    ) {
      const legacyConcept =
        String(
          rawCost?.concept || ''
        ).trim();

      const legacyAmount =
        parseMoney(
          rawCost?.amount
        );

      if (
        !legacyConcept &&
        (
          legacyAmount === null ||
          legacyAmount === 0
        )
      ) {
        continue;
      }

      if (!legacyConcept) {
        return {
          error:
            'Cada costo proyectado debe tener un concepto.'
        };
      }

      if (
        legacyAmount === null ||
        legacyAmount < 0
      ) {
        return {
          error:
            `El costo proyectado de "${legacyConcept}" no es válido.`
        };
      }

      normalized.push({
        categoryId: null,
        expenseUnitId: null,
        concept: legacyConcept,
        unitAmount: legacyAmount,
        quantity: 1,
        amount: legacyAmount,
        currency:
          validCurrency(
            rawCost?.currency,
            'MXN'
          ),
        quantitySource: 'ONE'
      });

      continue;
    }

    if (!categoryId) {
      return {
        error:
          'Selecciona un concepto para cada costo proyectado.'
      };
    }

    if (!unitId) {
      return {
        error:
          'Selecciona una unidad para cada costo proyectado.'
      };
    }

    const [
      category,
      unit
    ] = await Promise.all([
      db
        .prepare(`
          SELECT
            id,
            name
          FROM expense_categories
          WHERE id = ?
          LIMIT 1
        `)
        .bind(
          categoryId
        )
        .first(),

      db
        .prepare(`
          SELECT
            id,
            name,
            quantity_source
          FROM expense_units
          WHERE id = ?
          LIMIT 1
        `)
        .bind(
          unitId
        )
        .first()
    ]);

    if (!category) {
      return {
        error:
          'Uno de los conceptos de gasto seleccionados ya no existe.'
      };
    }

    if (!unit) {
      return {
        error:
          'Una de las unidades seleccionadas ya no existe.'
      };
    }

    const unitAmount =
      parseMoney(
        rawCost?.unit_amount
      );

    if (
      unitAmount === null ||
      unitAmount < 0
    ) {
      return {
        error:
          `El costo unitario de "${category.name}" no es válido.`
      };
    }

    const quantityResult =
      resolveProjectedQuantity(
        unit.quantity_source,
        rawCost?.quantity,
        planting
      );

    if (quantityResult.error) {
      return {
        error:
          `${category.name}: ${quantityResult.error}`
      };
    }

    const quantity =
      quantityResult.value;

    const amount =
      roundMoney(
        unitAmount *
        quantity
      );

    normalized.push({
      categoryId:
        Number(category.id),
      expenseUnitId:
        Number(unit.id),
      concept:
        String(category.name),
      unitAmount,
      quantity,
      amount,
      currency:
        validCurrency(
          rawCost?.currency,
          'MXN'
        ),
      quantitySource:
        unit.quantity_source
    });
  }

  return {
    values:
      normalized
  };
}


/* =========================================================
   8. RESOLVER CANTIDAD SEGÚN UNIDAD
   ========================================================= */

function resolveProjectedQuantity(
  source,
  manualQuantity,
  planting
) {
  const projectedBoxes =
    planting.hectares *
    planting.expectedYield;

  const projectedPounds =
    projectedBoxes *
    planting.standardBoxLbs;

  const projectedPlants =
    planting.hectares *
    planting.density;

  switch (source) {
    case 'ONE':
      return {
        value: 1
      };

    case 'HECTARES':
      return {
        value:
          planting.hectares
      };

    case 'PROJECTED_BOXES':
      return {
        value:
          projectedBoxes
      };

    case 'PROJECTED_POUNDS':
      return {
        value:
          projectedPounds
      };

    case 'THOUSAND_PLANTS':
      return {
        value:
          projectedPlants / 1000
      };

    case 'MANUAL': {
      const quantity =
        positiveNumber(
          manualQuantity
        );

      if (
        quantity === null ||
        quantity <= 0
      ) {
        return {
          error:
            'la cantidad debe ser mayor a cero.'
        };
      }

      return {
        value:
          quantity
      };
    }

    default:
      return {
        error:
          'la regla de cálculo de la unidad no es válida.'
      };
  }
}


/* =========================================================
   9. GUARDAR COSTOS PROYECTADOS
   ========================================================= */

async function replaceProjectedCosts(
  db,
  plantingId,
  costs
) {
  const statements = [
    db
      .prepare(`
        DELETE FROM planting_estimated_costs
        WHERE planting_id = ?
      `)
      .bind(
        plantingId
      )
  ];

  costs.forEach(cost => {
    statements.push(
      db
        .prepare(`
          INSERT INTO planting_estimated_costs (
            planting_id,
            category_id,
            expense_unit_id,
            concept,
            unit_amount,
            quantity,
            amount,
            currency
          )

          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?
          )
        `)
        .bind(
          plantingId,
          cost.categoryId,
          cost.expenseUnitId,
          cost.concept,
          cost.unitAmount,
          cost.quantity,
          cost.amount,
          cost.currency
        )
    );
  });

  await db.batch(
    statements
  );
}


/* =========================================================
   10. VALIDAR TIPO DE CAMBIO DE LA PROYECCIÓN
   ========================================================= */

function validateProjectionExchangeRate(
  planting,
  costs
) {
  const hasMxnCosts =
    costs.some(cost => {
      return (
        cost.currency === 'MXN' &&
        Number(cost.amount || 0) > 0
      );
    });

  const revenueInMxn =
    planting.priceCurrency === 'MXN' &&
    (
      planting.expectedYield *
      planting.hectares *
      planting.pricePerBox
    ) > 0;

  if (
    (hasMxnCosts || revenueInMxn) &&
    (
      !planting.projectionExchangeRate ||
      planting.projectionExchangeRate <= 0
    )
  ) {
    return (
      'Captura el tipo de cambio MXN por USD ' +
      'para consolidar la proyección.'
    );
  }

  return null;
}


/* =========================================================
   11. RESUMEN DE PROYECCIÓN
   ========================================================= */

function buildProjectionSummary(
  planting,
  costs
) {
  const projectedBoxes =
    planting.hectares *
    planting.expectedYield;

  const projectedPounds =
    projectedBoxes *
    planting.standardBoxLbs;

  const projectedPlants =
    planting.hectares *
    planting.density;

  const projectedRevenue =
    projectedBoxes *
    planting.pricePerBox;

  const exchangeRate =
    Number(
      planting.projectionExchangeRate || 0
    );

  const costTotals =
    costs.reduce(
      (accumulator, cost) => {
        const currency =
          cost.currency || 'MXN';

        accumulator[currency] =
          (
            accumulator[currency] ||
            0
          ) + Number(
            cost.amount || 0
          );

        return accumulator;
      },
      {
        MXN: 0,
        USD: 0
      }
    );

  const mxnCostsInUsd =
    exchangeRate > 0
      ? costTotals.MXN /
        exchangeRate
      : 0;

  const consolidatedCostsUsd =
    costTotals.USD +
    mxnCostsInUsd;

  const revenueUsd =
    planting.priceCurrency === 'MXN'
      ? (
          exchangeRate > 0
            ? projectedRevenue /
              exchangeRate
            : 0
        )
      : projectedRevenue;

  const projectedProfitUsd =
    revenueUsd -
    consolidatedCostsUsd;

  const revenueMxn =
    exchangeRate > 0
      ? revenueUsd *
        exchangeRate
      : (
          planting.priceCurrency === 'MXN'
            ? projectedRevenue
            : 0
        );

  const consolidatedCostsMxn =
    exchangeRate > 0
      ? consolidatedCostsUsd *
        exchangeRate
      : costTotals.MXN;

  const projectedProfitMxn =
    revenueMxn -
    consolidatedCostsMxn;

  const costPerBoxUsd =
    projectedBoxes > 0
      ? consolidatedCostsUsd /
        projectedBoxes
      : 0;

  const marginPercent =
    revenueUsd > 0
      ? (
          projectedProfitUsd /
          revenueUsd
        ) * 100
      : 0;

  return {
    hectares:
      planting.hectares,

    projected_boxes:
      projectedBoxes,

    projected_boxes_per_ha:
      planting.expectedYield,

    projected_pounds:
      projectedPounds,

    projected_pounds_per_ha:
      planting.expectedYield *
      planting.standardBoxLbs,

    projected_plants:
      projectedPlants,

    projected_plants_per_ha:
      planting.density,

    projected_revenue:
      projectedRevenue,

    projected_revenue_per_ha:
      planting.hectares > 0
        ? projectedRevenue /
          planting.hectares
        : 0,

    revenue_currency:
      planting.priceCurrency,

    projection_exchange_rate:
      exchangeRate || null,

    projected_costs_original:
      {
        MXN:
          roundMoney(
            costTotals.MXN
          ),

        USD:
          roundMoney(
            costTotals.USD
          )
      },

    mxn_costs_in_usd:
      roundMoney(
        mxnCostsInUsd
      ),

    consolidated_costs_usd:
      roundMoney(
        consolidatedCostsUsd
      ),

    consolidated_costs_usd_per_ha:
      planting.hectares > 0
        ? roundMoney(
            consolidatedCostsUsd /
            planting.hectares
          )
        : 0,

    revenue_usd:
      roundMoney(
        revenueUsd
      ),

    revenue_usd_per_ha:
      planting.hectares > 0
        ? roundMoney(
            revenueUsd /
            planting.hectares
          )
        : 0,

    revenue_mxn:
      roundMoney(
        revenueMxn
      ),

    revenue_mxn_per_ha:
      planting.hectares > 0
        ? roundMoney(
            revenueMxn /
            planting.hectares
          )
        : 0,

    consolidated_costs_mxn:
      roundMoney(
        consolidatedCostsMxn
      ),

    consolidated_costs_mxn_per_ha:
      planting.hectares > 0
        ? roundMoney(
            consolidatedCostsMxn /
            planting.hectares
          )
        : 0,

    projected_profit_usd:
      roundMoney(
        projectedProfitUsd
      ),

    projected_profit_mxn:
      roundMoney(
        projectedProfitMxn
      ),

    projected_profit_mxn_per_ha:
      planting.hectares > 0
        ? roundMoney(
            projectedProfitMxn /
            planting.hectares
          )
        : 0,

    projected_profit_usd_per_ha:
      planting.hectares > 0
        ? roundMoney(
            projectedProfitUsd /
            planting.hectares
          )
        : 0,

    projected_cost_per_box_usd:
      roundMoney(
        costPerBoxUsd
      ),

    projected_margin_percent:
      roundMoney(
        marginPercent
      )
  };
}


/* =========================================================
   12. PROTEGER REGISTROS CON MOVIMIENTOS
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
   13. UTILIDADES
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

  const amount =
    Number(normalized);

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

  const result =
    Number(
      String(value)
        .replaceAll(',', '')
    );

  return Number.isFinite(result)
    ? result
    : null;
}


function roundMoney(
  value
) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.round(
    (
      number +
      Number.EPSILON
    ) * 100
  ) / 100;
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

  console.error(
    `Error al ${action} siembra:`,
    exception
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
      'Alguno de los registros relacionados ya no existe.'
    );
  }

  if (
    message.includes('CHECK')
  ) {
    return error(
      'Uno de los datos de la siembra no cumple con las reglas permitidas.'
    );
  }

  return error(
    `No fue posible ${action} la siembra.`
  );
}
