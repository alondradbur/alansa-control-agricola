/* =========================================================
   ALANSA - SISTEMA DE CONTROL AGRÍCOLA
   API: CATÁLOGOS

   Ajuste:
   - Normaliza importes con separadores de miles.
   - Conserva la moneda en un campo independiente.
   ========================================================= */


/* =========================================================
   1. IMPORTACIONES Y CONFIGURACIÓN
   ========================================================= */

import {
  json,
  error
} from './_util.js';

const TABLES = {
  products: 'products',
  clients: 'clients',
  suppliers: 'suppliers',
  expense_categories: 'expense_categories',
  payment_methods: 'payment_methods'
};


/* =========================================================
   2. CONSULTAR CATÁLOGOS
   ========================================================= */

export async function onRequestGet({
  env
}) {
  const [
    products,
    expenseCategories,
    clients,
    suppliers,
    paymentMethods
  ] = await Promise.all([
    env.DB
      .prepare(`
        SELECT *
        FROM products
        ORDER BY is_default DESC, name
      `)
      .all(),

    env.DB
      .prepare(`
        SELECT *
        FROM expense_categories
        ORDER BY name
      `)
      .all(),

    env.DB
      .prepare(`
        SELECT *
        FROM clients
        ORDER BY name
      `)
      .all(),

    env.DB
      .prepare(`
        SELECT *
        FROM suppliers
        ORDER BY name
      `)
      .all(),

    env.DB
      .prepare(`
        SELECT *
        FROM payment_methods
        ORDER BY name
      `)
      .all()
  ]);

  return json({
    products:
      products.results || [],

    expense_categories:
      expenseCategories.results || [],

    clients:
      clients.results || [],

    suppliers:
      suppliers.results || [],

    payment_methods:
      paymentMethods.results || []
  });
}


/* =========================================================
   3. CREAR REGISTRO
   ========================================================= */

export async function onRequestPost({
  env,
  request
}) {
  const {
    entity,
    data = {}
  } = await request.json();

  try {

    /* -------------------------------------------------------
       3.1. CLIENTES
       ------------------------------------------------------- */

    if (entity === 'clients') {
      const result = await env.DB
        .prepare(`
          INSERT INTO clients (
            name,
            credit_days,
            notes
          )
          VALUES (?, ?, ?)
        `)
        .bind(
          data.name.trim(),
          Number(data.credit_days || 0),
          data.notes || null
        )
        .run();

      return json({
        ok: true,
        id: result.meta?.last_row_id
      });
    }


    /* -------------------------------------------------------
       3.2. PROVEEDORES
       ------------------------------------------------------- */

    if (entity === 'suppliers') {
      const result = await env.DB
        .prepare(`
          INSERT INTO suppliers (
            name,
            contact,
            notes
          )
          VALUES (?, ?, ?)
        `)
        .bind(
          data.name.trim(),
          data.contact || null,
          data.notes || null
        )
        .run();

      return json({
        ok: true,
        id: result.meta?.last_row_id
      });
    }


    /* -------------------------------------------------------
       3.3. CATEGORÍAS DE GASTO
       ------------------------------------------------------- */

    if (entity === 'expense_categories') {
      const defaultAmount =
        parseMoney(
          data.default_amount
        );

      const result = await env.DB
        .prepare(`
          INSERT INTO expense_categories (
            name,
            default_amount,
            default_currency
          )
          VALUES (?, ?, ?)
        `)
        .bind(
          data.name.trim(),
          defaultAmount,
          validCurrency(
            data.default_currency,
            'MXN'
          )
        )
        .run();

      return json({
        ok: true,
        id: result.meta?.last_row_id
      });
    }


    /* -------------------------------------------------------
       3.4. FORMAS DE PAGO
       ------------------------------------------------------- */

    if (entity === 'payment_methods') {
      const result = await env.DB
        .prepare(`
          INSERT INTO payment_methods (
            name
          )
          VALUES (?)
        `)
        .bind(
          data.name.trim()
        )
        .run();

      return json({
        ok: true,
        id: result.meta?.last_row_id
      });
    }


    /* -------------------------------------------------------
       3.5. PRODUCTOS
       ------------------------------------------------------- */

    if (entity === 'products') {
      if (
        Number(data.is_default) === 1
      ) {
        await env.DB
          .prepare(`
            UPDATE products
            SET is_default = 0
          `)
          .run();
      }

      const result = await env.DB
        .prepare(`
          INSERT INTO products (
            name,
            short_code,
            default_density_per_ha,
            seed_cost_per_thousand,
            seed_currency,
            standard_box_lbs,
            default_price_per_box,
            price_currency,
            is_default
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          data.name.trim(),
          data.short_code
            .trim()
            .toUpperCase(),
          Number(
            data.default_density_per_ha || 0
          ),
          parseMoney(
            data.seed_cost_per_thousand
          ) || 0,
          validCurrency(
            data.seed_currency,
            'USD'
          ),
          Number(
            data.standard_box_lbs || 12
          ),
          parseMoney(
            data.default_price_per_box
          ) || 0,
          validCurrency(
            data.price_currency,
            'USD'
          ),
          Number(
            data.is_default || 0
          )
        )
        .run();

      return json({
        ok: true,
        id: result.meta?.last_row_id
      });
    }

    return error(
      'Catálogo no reconocido.'
    );

  } catch (exception) {
    const message = String(
      exception.message || ''
    );

    return error(
      message.includes('UNIQUE')
        ? 'Ya existe un registro con esos datos.'
        : 'No fue posible guardar el registro.'
    );
  }
}


/* =========================================================
   4. ELIMINAR REGISTRO
   ========================================================= */

export async function onRequestDelete({
  env,
  request
}) {
  const {
    entity,
    id
  } = await request.json();

  const table = TABLES[entity];

  if (!table) {
    return error(
      'Catálogo no reconocido.'
    );
  }

  try {
    await env.DB
      .prepare(`
        DELETE FROM ${table}
        WHERE id = ?
      `)
      .bind(id)
      .run();

    return json({
      ok: true
    });

  } catch {
    return error(
      'Este registro ya tiene movimientos relacionados y no puede eliminarse.'
    );
  }
}


/* =========================================================
   5. UTILIDADES MONETARIAS
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
  fallback = 'MXN'
) {
  return ['MXN', 'USD']
    .includes(value)
      ? value
      : fallback;
}

