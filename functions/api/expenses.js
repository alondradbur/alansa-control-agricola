/* =========================================================
   SISTEMA DE CONTROL AGRÍCOLA
   API: GASTOS

   El gasto guarda:
   - Monto unitario.
   - Unidad de costo.
   - Cantidad aplicada.
   - Importe total.
   - Moneda y equivalente MXN.
   ========================================================= */


/* =========================================================
   1. IMPORTACIONES
   ========================================================= */

import {
  json,
  error
} from './_util.js';


/* =========================================================
   2. CONSULTAR GASTOS
   ========================================================= */

export async function onRequestGet({
  env
}) {
  const result = await env.DB
    .prepare(`
      SELECT
        e.*,
        pl.contract_number,
        pl.hectares,
        ec.name AS category_name,
        eu.name AS expense_unit_name,
        eu.quantity_source,
        s.name AS supplier_name,
        pm.name AS payment_method_name

      FROM expenses e

      JOIN plantings pl
        ON pl.id = e.planting_id

      JOIN expense_categories ec
        ON ec.id = e.category_id

      LEFT JOIN expense_units eu
        ON eu.id = e.expense_unit_id

      LEFT JOIN suppliers s
        ON s.id = e.supplier_id

      LEFT JOIN payment_methods pm
        ON pm.id = e.payment_method_id

      ORDER BY
        e.expense_date DESC,
        e.id DESC
    `)
    .all();

  return json(
    result.results || []
  );
}


/* =========================================================
   3. CREAR GASTO
   ========================================================= */

export async function onRequestPost({
  env,
  request
}) {
  const data = await request.json();

  const validated =
    validateExpense(
      data
    );

  if (validated.error) {
    return error(
      validated.error
    );
  }

  const values =
    validated.values;

  try {
    const result = await env.DB
      .prepare(`
        INSERT INTO expenses (
          expense_date,
          planting_id,
          category_id,
          supplier_id,
          concept,
          amount,
          currency,
          exchange_rate,
          mxn_equivalent,
          payment_method_id,
          invoice_number,
          notes,
          expense_unit_id,
          unit_amount,
          quantity
        )

        VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?
        )
      `)
      .bind(
        values.expenseDate,
        values.plantingId,
        values.categoryId,
        values.supplierId,
        values.concept,
        values.amount,
        values.currency,
        values.exchangeRate,
        values.mxnEquivalent,
        values.paymentMethodId,
        values.invoiceNumber,
        values.notes,
        values.expenseUnitId,
        values.unitAmount,
        values.quantity
      )
      .run();

    return json({
      ok: true,
      id:
        result.meta?.last_row_id
    });

  } catch {
    return error(
      'No fue posible guardar el gasto.'
    );
  }
}


/* =========================================================
   4. ACTUALIZAR GASTO
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
      'Falta el identificador del gasto.'
    );
  }

  const validated =
    validateExpense(
      data
    );

  if (validated.error) {
    return error(
      validated.error
    );
  }

  const values =
    validated.values;

  try {
    const result = await env.DB
      .prepare(`
        UPDATE expenses

        SET
          expense_date = ?,
          planting_id = ?,
          category_id = ?,
          supplier_id = ?,
          concept = ?,
          amount = ?,
          currency = ?,
          exchange_rate = ?,
          mxn_equivalent = ?,
          payment_method_id = ?,
          invoice_number = ?,
          notes = ?,
          expense_unit_id = ?,
          unit_amount = ?,
          quantity = ?,
          updated_at = CURRENT_TIMESTAMP

        WHERE id = ?
      `)
      .bind(
        values.expenseDate,
        values.plantingId,
        values.categoryId,
        values.supplierId,
        values.concept,
        values.amount,
        values.currency,
        values.exchangeRate,
        values.mxnEquivalent,
        values.paymentMethodId,
        values.invoiceNumber,
        values.notes,
        values.expenseUnitId,
        values.unitAmount,
        values.quantity,
        id
      )
      .run();

    if (
      Number(
        result.meta?.changes || 0
      ) === 0
    ) {
      return error(
        'No se encontró el gasto que intentas actualizar.'
      );
    }

    return json({
      ok: true,
      id
    });

  } catch {
    return error(
      'No fue posible actualizar el gasto.'
    );
  }
}


/* =========================================================
   5. ELIMINAR GASTO
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
      'Falta el identificador del gasto.'
    );
  }

  try {
    const result = await env.DB
      .prepare(`
        DELETE FROM expenses
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
        'No se encontró el gasto que intentas eliminar.'
      );
    }

    return json({
      ok: true
    });

  } catch {
    return error(
      'No fue posible eliminar el gasto.'
    );
  }
}


/* =========================================================
   6. VALIDAR Y NORMALIZAR GASTO
   ========================================================= */

function validateExpense(
  data
) {
  const expenseDate =
    String(
      data.expense_date || ''
    ).trim();

  const plantingId = Number(
    data.planting_id
  );

  const categoryId = Number(
    data.category_id
  );

  const expenseUnitId = Number(
    data.expense_unit_id
  );

  const supplierId =
    optionalId(
      data.supplier_id
    );

  const concept =
    String(
      data.concept || ''
    ).trim();

  const unitAmount =
    parseMoney(
      data.unit_amount
    );

  const quantity =
    positiveNumber(
      data.quantity
    );

  const currency =
    validCurrency(
      data.currency
    );

  const exchangeRate =
    optionalPositiveNumber(
      data.exchange_rate
    );

  const paymentMethodId =
    optionalId(
      data.payment_method_id
    );

  const invoiceNumber =
    optionalText(
      data.invoice_number
    );

  const notes =
    optionalText(
      data.notes
    );

  if (!expenseDate) {
    return {
      error:
        'La fecha del gasto es obligatoria.'
    };
  }

  if (!plantingId) {
    return {
      error:
        'Debes seleccionar una siembra.'
    };
  }

  if (!categoryId) {
    return {
      error:
        'Debes seleccionar una categoría.'
    };
  }

  if (!expenseUnitId) {
    return {
      error:
        'Debes seleccionar cómo se aplica el monto.'
    };
  }

  if (!concept) {
    return {
      error:
        'El concepto del gasto es obligatorio.'
    };
  }

  if (
    unitAmount === null ||
    unitAmount < 0
  ) {
    return {
      error:
        'El monto unitario no es válido.'
    };
  }

  if (
    quantity === null ||
    quantity <= 0
  ) {
    return {
      error:
        'La cantidad debe ser mayor a cero.'
    };
  }

  if (!currency) {
    return {
      error:
        'La moneda debe ser MXN o USD.'
    };
  }

  if (
    currency === 'USD' &&
    (
      exchangeRate === null ||
      exchangeRate <= 0
    )
  ) {
    return {
      error:
        'Para gastos en USD debes capturar un tipo de cambio mayor a cero.'
    };
  }

  const amount =
    unitAmount * quantity;

  const mxnEquivalent =
    currency === 'MXN'
      ? amount
      : amount * exchangeRate;

  return {
    values: {
      expenseDate,
      plantingId,
      categoryId,
      expenseUnitId,
      supplierId,
      concept,
      unitAmount,
      quantity,
      amount,
      currency,
      exchangeRate:
        currency === 'MXN'
          ? null
          : exchangeRate,
      mxnEquivalent,
      paymentMethodId,
      invoiceNumber,
      notes
    }
  };
}


/* =========================================================
   7. UTILIDADES
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

  const normalized = String(
    value
  )
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
    String(value).replaceAll(',', '')
  );

  return Number.isFinite(result)
    ? result
    : null;
}


function validCurrency(
  value
) {
  return ['MXN', 'USD']
    .includes(value)
      ? value
      : null;
}


function optionalPositiveNumber(
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
    value
  );

  return Number.isFinite(result)
    ? result
    : null;
}


function optionalId(
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
    value
  );

  return Number.isFinite(result) &&
    result > 0
      ? result
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
