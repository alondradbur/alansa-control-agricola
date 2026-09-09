import { json } from './_util.js';


/* =========================================================
   ALANSA - API REMISIONES
   Encabezado: shipments
   Detalle: shipment_lines
   ========================================================= */

export async function onRequest(context) {
  switch (context.request.method) {
    case 'GET':
      return onGet(context);

    case 'POST':
      return onPost(context);

    case 'PUT':
      return onPut(context);

    case 'DELETE':
      return onDelete(context);

    default:
      return json(
        { error: 'Método no permitido.' },
        405
      );
  }
}


/* =========================================================
   1. CONSULTAR REMISIONES / CATÁLOGOS
   ========================================================= */

async function onGet({ env, request }) {
  const db = env.DB;
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode');

  if (mode === 'form') {
    const [
      plantings,
      clients,
      products
    ] = await Promise.all([
      db.prepare(`
        SELECT
          p.id,
          p.contract_number,
          p.client_id,
          p.product_id,
          p.standard_box_lbs,
          p.price_per_box,
          p.price_currency,
          p.projection_exchange_rate,
          c.name AS client_name,
          c.credit_days,
          pr.name AS product_name
        FROM plantings p
        JOIN clients c
          ON c.id = p.client_id
        JOIN products pr
          ON pr.id = p.product_id
        ORDER BY p.contract_number
      `).all(),

      db.prepare(`
        SELECT
          id,
          name,
          credit_days
        FROM clients
        ORDER BY name
      `).all(),

      db.prepare(`
        SELECT
          id,
          name
        FROM products
        ORDER BY name
      `).all()
    ]);

    return json({
      plantings: plantings.results || [],
      clients: clients.results || [],
      products: products.results || []
    });
  }

  const id = Number(
    url.searchParams.get('id') || 0
  );

  if (id > 0) {
    return getOne(db, id);
  }

  const result = await db.prepare(`
    SELECT
      s.id,
      s.folio,
      s.sequence,
      s.shipment_date,
      s.planting_id,
      s.client_id,
      s.currency,
      s.exchange_rate,
      s.due_date,
      s.status,
      s.notes,
      s.credit_days,
      s.total_boxes,
      s.total_pounds,
      s.total_amount,
      s.mxn_equivalent,
      pl.contract_number,
      c.name AS client_name,
      GROUP_CONCAT(
        DISTINCT pr.name
      ) AS product_names
    FROM shipments s
    JOIN plantings pl
      ON pl.id = s.planting_id
    JOIN clients c
      ON c.id = s.client_id
    LEFT JOIN shipment_lines sl
      ON sl.shipment_id = s.id
    LEFT JOIN products pr
      ON pr.id = sl.product_id
    GROUP BY s.id
    ORDER BY s.sequence DESC
  `).all();

  return json(
    result.results || []
  );
}


async function getOne(db, id) {
  const shipment = await db.prepare(`
    SELECT
      s.*,
      pl.contract_number,
      c.name AS client_name
    FROM shipments s
    JOIN plantings pl
      ON pl.id = s.planting_id
    JOIN clients c
      ON c.id = s.client_id
    WHERE s.id = ?
  `).bind(id).first();

  if (!shipment) {
    return json(
      { error: 'Remisión no encontrada.' },
      404
    );
  }

  const lines = await db.prepare(`
    SELECT
      sl.*,
      p.name AS product_name
    FROM shipment_lines sl
    JOIN products p
      ON p.id = sl.product_id
    WHERE sl.shipment_id = ?
    ORDER BY sl.id
  `).bind(id).all();

  return json({
    ...shipment,
    lines: lines.results || []
  });
}


/* =========================================================
   2. CREAR
   ========================================================= */

async function onPost({ env, request }) {
  const db = env.DB;
  const body = await request.json();

  const validation =
    await validatePayload(
      db,
      body
    );

  if (validation.error) {
    return json(
      { error: validation.error },
      400
    );
  }

  const data = validation.data;

  try {
    const next =
      await nextSequence(db);

    const folio =
      `REM-${String(next).padStart(6, '0')}`;

    const first =
      data.lines[0];

    const insert =
      await db.prepare(`
        INSERT INTO shipments (
  folio,
  sequence,
  shipment_date,
  planting_id,
  client_id,
  product_id,
  boxes,
  pounds,
  standard_box_lbs,
  price_per_box,
  currency,
  exchange_rate,
  due_date,
  status,
  notes,
  signature_user,
  credit_days,
  total_boxes,
  total_pounds,
  total_amount,
  mxn_equivalent,
  updated_at
)
VALUES (
  ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?, ?,
  ?, ?, ?,
  CURRENT_TIMESTAMP
)
      `).bind(
        folio,
        next,
        data.shipmentDate,
        data.plantingId,
        data.clientId,
        first.productId,
        first.boxes,
        first.pounds,
        first.lbsPerBox,
        first.pricePerBox,
        data.currency,
        data.exchangeRate || null,
        data.dueDate,
        'Emitida',
data.notes || null,
data.signatureUser,
data.creditDays,
        data.totalBoxes,
        data.totalPounds,
        data.totalAmount,
        data.mxnEquivalent
      ).run();

    const shipmentId =
      Number(
        insert.meta?.last_row_id || 0
      );

    if (!shipmentId) {
      throw new Error(
        'No fue posible obtener el ID de la remisión.'
      );
    }

    try {
      await insertLines(
        db,
        shipmentId,
        data.lines,
        data.currency
      );
    } catch (error) {
      await db.prepare(`
        DELETE FROM shipments
        WHERE id = ?
      `).bind(
        shipmentId
      ).run();

      throw error;
    }

    return json({
      ok: true,
      id: shipmentId,
      folio
    });

  } catch (error) {
    return json(
      {
        error:
          error?.message ||
          'No fue posible guardar la remisión.'
      },
      500
    );
  }
}


/* =========================================================
   3. EDITAR
   ========================================================= */

async function onPut({ env, request }) {
  const db = env.DB;
  const body = await request.json();

  const id =
    Number(body.id || 0);

  if (!id) {
    return json(
      { error: 'Remisión inválida.' },
      400
    );
  }

  const current =
    await db.prepare(`
      SELECT id
      FROM shipments
      WHERE id = ?
    `).bind(id).first();

  if (!current) {
    return json(
      { error: 'Remisión no encontrada.' },
      404
    );
  }

  const validation =
    await validatePayload(
      db,
      body
    );

  if (validation.error) {
    return json(
      { error: validation.error },
      400
    );
  }

  const data =
    validation.data;

  const first =
    data.lines[0];

  try {
    await db.prepare(`
      UPDATE shipments
      SET
        shipment_date = ?,
        planting_id = ?,
        client_id = ?,
        product_id = ?,
        boxes = ?,
        pounds = ?,
        standard_box_lbs = ?,
        price_per_box = ?,
        currency = ?,
        exchange_rate = ?,
        due_date = ?,
notes = ?,
signature_user = ?,
credit_days = ?,
        total_boxes = ?,
        total_pounds = ?,
        total_amount = ?,
        mxn_equivalent = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      data.shipmentDate,
      data.plantingId,
      data.clientId,
      first.productId,
      first.boxes,
      first.pounds,
      first.lbsPerBox,
      first.pricePerBox,
      data.currency,
      data.exchangeRate || null,
      data.dueDate,
data.notes || null,
data.signatureUser,
data.creditDays,
      data.totalBoxes,
      data.totalPounds,
      data.totalAmount,
      data.mxnEquivalent,
      id
    ).run();

    await db.prepare(`
      DELETE FROM shipment_lines
      WHERE shipment_id = ?
    `).bind(id).run();

    try {
      await insertLines(
        db,
        id,
        data.lines,
        data.currency
      );
    } catch (error) {
      throw error;
    }

    return json({
      ok: true,
      id
    });

  } catch (error) {
    return json(
      {
        error:
          error?.message ||
          'No fue posible actualizar la remisión.'
      },
      500
    );
  }
}


/* =========================================================
   4. ELIMINAR
   ========================================================= */

async function onDelete({ env, request }) {
  const db = env.DB;
  const url = new URL(request.url);

  let id =
    Number(
      url.searchParams.get('id') || 0
    );

  if (!id) {
    try {
      const body =
        await request.json();

      id =
        Number(
          body.id || 0
        );
    } catch {}
  }

  if (!id) {
    return json(
      { error: 'Remisión inválida.' },
      400
    );
  }

  const applications =
    await db.prepare(`
      SELECT COUNT(*) AS total
      FROM payment_applications
      WHERE shipment_id = ?
    `).bind(id).first();

  if (
    Number(
      applications?.total || 0
    ) > 0
  ) {
    return json(
      {
        error:
          'La remisión tiene cobranza aplicada. Elimina primero sus aplicaciones de cobro.'
      },
      409
    );
  }

  try {
    await db.prepare(`
      DELETE FROM shipment_lines
      WHERE shipment_id = ?
    `).bind(id).run();

    await db.prepare(`
      DELETE FROM shipments
      WHERE id = ?
    `).bind(id).run();

    return json({
      ok: true
    });

  } catch (error) {
    return json(
      {
        error:
          error?.message ||
          'No fue posible eliminar la remisión.'
      },
      500
    );
  }
}


/* =========================================================
   5. VALIDACIÓN Y CÁLCULOS
   ========================================================= */

async function validatePayload(
  db,
  body
) {
  const plantingId =
    Number(
      body.planting_id || 0
    );

  const shipmentDate =
    cleanText(
      body.shipment_date
    );

  const currency =
    body.currency === 'MXN'
      ? 'MXN'
      : body.currency === 'USD'
        ? 'USD'
        : '';

  const exchangeRate =
    numeric(
      body.exchange_rate
    );

  const notes =
    cleanText(
      body.notes
    );
   
const signatureUser =
  ['A', 'R'].includes(
    body.signature_user
  )
    ? body.signature_user
    : null;
   
  const rawLines =
    Array.isArray(
      body.lines
    )
      ? body.lines
      : [];

  if (!plantingId) {
    return {
      error:
        'Selecciona una siembra.'
    };
  }

  if (!shipmentDate) {
    return {
      error:
        'Captura la fecha de la remisión.'
    };
  }

  if (!currency) {
    return {
      error:
        'Selecciona la moneda de la remisión.'
    };
  }

  if (exchangeRate <= 0) {
    return {
      error:
        'Captura un tipo de cambio mayor a cero.'
    };
  }

  if (rawLines.length === 0) {
    return {
      error:
        'Agrega al menos una línea a la remisión.'
    };
  }

  const planting =
    await db.prepare(`
      SELECT
        p.id,
        p.client_id,
        c.credit_days
      FROM plantings p
      JOIN clients c
        ON c.id = p.client_id
      WHERE p.id = ?
    `).bind(
      plantingId
    ).first();

  if (!planting) {
    return {
      error:
        'La siembra seleccionada no existe.'
    };
  }

  const lines = [];

  for (
    let index = 0;
    index < rawLines.length;
    index += 1
  ) {
    const raw =
      rawLines[index];

    const productId =
      Number(
        raw.product_id || 0
      );

    const boxes =
      numeric(
        raw.boxes
      );

    const lbsPerBox =
      numeric(
        raw.lbs_per_box
      );

    const pricePerBox =
      numeric(
        raw.price_per_box
      );

    if (!productId) {
      return {
        error:
          `Selecciona el producto de la línea ${index + 1}.`
      };
    }

    if (boxes <= 0) {
      return {
        error:
          `Las cajas de la línea ${index + 1} deben ser mayores a cero.`
      };
    }

    if (lbsPerBox <= 0) {
      return {
        error:
          `Las libras por caja de la línea ${index + 1} deben ser mayores a cero.`
      };
    }

    if (pricePerBox < 0) {
      return {
        error:
          `El precio de la línea ${index + 1} no puede ser negativo.`
      };
    }

    const product =
      await db.prepare(`
        SELECT id
        FROM products
        WHERE id = ?
      `).bind(
        productId
      ).first();

    if (!product) {
      return {
        error:
          `El producto de la línea ${index + 1} no existe.`
      };
    }

    const pounds =
      boxes *
      lbsPerBox;

    const lineAmount =
      boxes *
      pricePerBox;

    lines.push({
      productId,
      boxes,
      lbsPerBox,
      pounds,
      pricePerBox,
      lineAmount
    });
  }

  const totalBoxes =
    lines.reduce(
      (sum, line) =>
        sum + line.boxes,
      0
    );

  const totalPounds =
    lines.reduce(
      (sum, line) =>
        sum + line.pounds,
      0
    );

  const totalAmount =
    lines.reduce(
      (sum, line) =>
        sum + line.lineAmount,
      0
    );

  const creditDays =
    Math.max(
      0,
      Number(
        planting.credit_days || 0
      )
    );

  const dueDate =
    addDays(
      shipmentDate,
      creditDays
    );

  const mxnEquivalent =
    currency === 'USD'
      ? totalAmount * exchangeRate
      : totalAmount;

  return {
  data: {
    plantingId,
    clientId:
      Number(
        planting.client_id
      ),
    shipmentDate,
    currency,
    exchangeRate,
    signatureUser,
    notes,
      creditDays,
      dueDate,
      totalBoxes,
      totalPounds,
      totalAmount,
      mxnEquivalent,
      lines
    }
  };
}


/* =========================================================
   6. CONSECUTIVO
   ========================================================= */

async function nextSequence(db) {
  const row =
    await db.prepare(`
      SELECT
        COALESCE(
          MAX(sequence),
          0
        ) + 1 AS next_sequence
      FROM shipments
    `).first();

  return Math.max(
    1,
    Number(
      row?.next_sequence || 1
    )
  );
}


/* =========================================================
   7. INSERTAR LÍNEAS
   ========================================================= */

async function insertLines(
  db,
  shipmentId,
  lines,
  currency
) {
  for (const line of lines) {
    await db.prepare(`
      INSERT INTO shipment_lines (
        shipment_id,
        product_id,
        boxes,
        lbs_per_box,
        pounds,
        price_per_box,
        currency,
        line_amount,
        updated_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        CURRENT_TIMESTAMP
      )
    `).bind(
      shipmentId,
      line.productId,
      line.boxes,
      line.lbsPerBox,
      line.pounds,
      line.pricePerBox,
      currency,
      line.lineAmount
    ).run();
  }
}


/* =========================================================
   8. UTILIDADES
   ========================================================= */

function numeric(value) {
  const result =
    Number(
      String(
        value ?? 0
      ).replace(
        /,/g,
        ''
      )
    );

  return Number.isFinite(result)
    ? result
    : 0;
}


function cleanText(value) {
  return String(
    value ?? ''
  ).trim();
}


function addDays(
  isoDate,
  days
) {
  const parts =
    String(
      isoDate
    )
      .slice(0, 10)
      .split('-')
      .map(Number);

  if (
    parts.length !== 3 ||
    parts.some(
      value =>
        !Number.isFinite(value)
    )
  ) {
    return null;
  }

  const result =
    new Date(
      Date.UTC(
        parts[0],
        parts[1] - 1,
        parts[2]
      )
    );

  result.setUTCDate(
    result.getUTCDate() +
    Number(days || 0)
  );

  return [
    result.getUTCFullYear(),
    String(
      result.getUTCMonth() + 1
    ).padStart(2, '0'),
    String(
      result.getUTCDate()
    ).padStart(2, '0')
  ].join('-');
}
