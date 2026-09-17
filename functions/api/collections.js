import { json, error } from './_util.js';


/* =========================================================
   ALANSA · API COBRANZA
   La cartera nace de Remisiones. Los pagos se registran en
   payments y se aplican a una remisión mediante
   payment_applications.
   ========================================================= */

export async function onRequestGet({ env }) {
  const db = env.DB;

  const [shipmentsResult, paymentsResult] = await Promise.all([
    db.prepare(`
      SELECT
        s.id,
        s.folio,
        s.shipment_date,
        s.due_date,
        s.planting_id,
        s.client_id,
        s.currency,
        s.exchange_rate,
        s.total_amount,
        s.total_boxes,
        s.status,
        pl.contract_number,
        pl.projection_exchange_rate,
        c.name AS client_name,
        c.credit_days,
        COALESCE(SUM(pa.applied_amount), 0) AS collected_amount
      FROM shipments s
      JOIN plantings pl ON pl.id = s.planting_id
      JOIN clients c ON c.id = s.client_id
      LEFT JOIN payment_applications pa ON pa.shipment_id = s.id
      GROUP BY s.id
      ORDER BY s.due_date ASC, s.shipment_date DESC, s.id DESC
    `).all(),

    db.prepare(`
      SELECT
        p.id,
        p.payment_date,
        p.client_id,
        p.amount,
        p.currency,
        p.exchange_rate,
        p.account,
        p.reference,
        p.notes,
        p.receipt_url,
        p.created_at,
        p.updated_at,
        pa.shipment_id,
        pa.applied_amount,
        s.folio,
        s.currency AS shipment_currency,
        c.name AS client_name
      FROM payments p
      JOIN payment_applications pa ON pa.payment_id = p.id
      JOIN shipments s ON s.id = pa.shipment_id
      JOIN clients c ON c.id = p.client_id
      ORDER BY p.payment_date DESC, p.id DESC
    `).all()
  ]);

  return json({
    shipments: shipmentsResult.results || [],
    payments: paymentsResult.results || []
  });
}


export async function onRequestPost({ env, request }) {
  const body = await request.json();
  const validation = await validatePayment(env.DB, body);

  if (validation.error) {
    return error(validation.error);
  }

  const v = validation.values;

  try {
    const result = await env.DB.prepare(`
      INSERT INTO payments (
        payment_date,
        client_id,
        amount,
        currency,
        exchange_rate,
        account,
        reference,
        notes,
        receipt_url,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      v.paymentDate,
      v.clientId,
      v.amount,
      v.currency,
      v.exchangeRate,
      v.account,
      v.reference,
      v.notes,
      v.receiptUrl
    ).run();

    const paymentId = Number(result.meta?.last_row_id || 0);

    await env.DB.prepare(`
      INSERT INTO payment_applications (
        payment_id,
        shipment_id,
        applied_amount
      )
      VALUES (?, ?, ?)
    `).bind(
      paymentId,
      v.shipmentId,
      v.appliedAmount
    ).run();

    return json({ ok: true, id: paymentId }, 201);
  } catch (err) {
    return error(
      err?.message || 'No fue posible registrar el pago.',
      500
    );
  }
}


export async function onRequestPut({ env, request }) {
  const body = await request.json();
  const id = Number(body.id || 0);

  if (!id) {
    return error('Pago inválido.');
  }

  const validation = await validatePayment(env.DB, body, id);

  if (validation.error) {
    return error(validation.error);
  }

  const v = validation.values;

  try {
    await env.DB.prepare(`
      UPDATE payments
      SET
        payment_date = ?,
        client_id = ?,
        amount = ?,
        currency = ?,
        exchange_rate = ?,
        account = ?,
        reference = ?,
        notes = ?,
        receipt_url = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      v.paymentDate,
      v.clientId,
      v.amount,
      v.currency,
      v.exchangeRate,
      v.account,
      v.reference,
      v.notes,
      v.receiptUrl,
      id
    ).run();

    await env.DB.prepare(`
      UPDATE payment_applications
      SET
        shipment_id = ?,
        applied_amount = ?
      WHERE payment_id = ?
    `).bind(
      v.shipmentId,
      v.appliedAmount,
      id
    ).run();

    return json({ ok: true });
  } catch (err) {
    return error(
      err?.message || 'No fue posible actualizar el pago.',
      500
    );
  }
}


export async function onRequestDelete({ env, request }) {
  let id = Number(new URL(request.url).searchParams.get('id') || 0);

  if (!id) {
    try {
      const body = await request.json();
      id = Number(body.id || 0);
    } catch {}
  }

  if (!id) {
    return error('Pago inválido.');
  }

  try {
    await env.DB.prepare(`
      DELETE FROM payment_applications
      WHERE payment_id = ?
    `).bind(id).run();

    await env.DB.prepare(`
      DELETE FROM payments
      WHERE id = ?
    `).bind(id).run();

    return json({ ok: true });
  } catch (err) {
    return error(
      err?.message || 'No fue posible eliminar el pago.',
      500
    );
  }
}


/* =========================================================
   VALIDACIÓN Y CONVERSIÓN
   applied_amount siempre se guarda en la moneda original de
   la remisión. Así Dashboard y Remisiones pueden sumar cobros
   sin duplicar lógica de conversión.
   ========================================================= */

async function validatePayment(db, body, editingId = 0) {
  const shipmentId = Number(body.shipment_id || 0);
  const paymentDate = cleanDate(body.payment_date);
  const amount = positive(body.amount);
  const currency = String(body.currency || '').toUpperCase();
  const account = String(body.account || '').toUpperCase();
  const exchangeRate = positive(body.exchange_rate, true);

  if (!shipmentId) return { error: 'Selecciona una remisión.' };
  if (!paymentDate) return { error: 'Captura una fecha de pago válida.' };
  if (!amount) return { error: 'El monto recibido debe ser mayor a cero.' };
  if (!['MXN', 'USD'].includes(currency)) return { error: 'Moneda inválida.' };
  if (!['MXN', 'USD'].includes(account)) return { error: 'Cuenta receptora inválida.' };

  const shipment = await db.prepare(`
    SELECT
      s.id,
      s.client_id,
      s.currency,
      s.exchange_rate,
      s.total_amount,
      pl.projection_exchange_rate,
      COALESCE((
        SELECT SUM(pa.applied_amount)
        FROM payment_applications pa
        WHERE pa.shipment_id = s.id
          AND pa.payment_id <> ?
      ), 0) AS already_collected
    FROM shipments s
    JOIN plantings pl ON pl.id = s.planting_id
    WHERE s.id = ?
  `).bind(editingId || -1, shipmentId).first();

  if (!shipment) return { error: 'La remisión seleccionada no existe.' };

  const shipmentCurrency = String(shipment.currency || 'USD').toUpperCase();
  const rate = exchangeRate || positive(shipment.exchange_rate, true) ||
    positive(shipment.projection_exchange_rate, true);

  if (currency !== shipmentCurrency && !rate) {
    return { error: 'Captura un tipo de cambio mayor a cero.' };
  }

  const appliedAmount = convertToShipmentCurrency(
    amount,
    currency,
    shipmentCurrency,
    rate || 1
  );

  const total = Number(shipment.total_amount || 0);
  const alreadyCollected = Number(shipment.already_collected || 0);
  const balance = Math.max(total - alreadyCollected, 0);

  if (appliedAmount > balance + 0.01) {
    return {
      error: `El pago excede el saldo pendiente de la remisión (${balance.toFixed(2)} ${shipmentCurrency}).`
    };
  }

  return {
    values: {
      shipmentId,
      clientId: Number(shipment.client_id),
      paymentDate,
      amount,
      currency,
      exchangeRate: rate || null,
      account,
      reference: nullableText(body.reference),
      notes: nullableText(body.notes),
      receiptUrl: nullableText(body.receipt_url),
      appliedAmount: roundMoney(appliedAmount)
    }
  };
}

function convertToShipmentCurrency(amount, from, to, rate) {
  if (from === to) return amount;
  if (from === 'USD' && to === 'MXN') return amount * rate;
  if (from === 'MXN' && to === 'USD') return amount / rate;
  return amount;
}

function positive(value, allowEmpty = false) {
  if (allowEmpty && (value === '' || value == null)) return null;
  const n = Number(String(value ?? '').replaceAll(',', ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cleanDate(value) {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function nullableText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
