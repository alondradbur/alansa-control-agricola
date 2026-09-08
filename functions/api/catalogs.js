/* =========================================================
   SISTEMA DE CONTROL AGRÍCOLA
   API: CATÁLOGOS

   Incluye:
   - Productos
   - Clientes
   - Proveedores
   - Categorías de gastos
   - Unidades de costo
   - Formas de pago
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
  expense_units: 'expense_units',
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
    expenseUnits,
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
        FROM expense_units
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

    expense_units:
      expenseUnits.results || [],

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

    if (entity === 'clients') {
      requireText(
        data.name,
        'El nombre del cliente es obligatorio.'
      );

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
          optionalText(data.notes)
        )
        .run();

      return created(
        result
      );
    }

    if (entity === 'suppliers') {
      requireText(
        data.name,
        'El nombre del proveedor es obligatorio.'
      );

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
          optionalText(data.contact),
          optionalText(data.notes)
        )
        .run();

      return created(
        result
      );
    }

    if (entity === 'expense_categories') {
  requireText(
    data.name,
    'El concepto de gasto es obligatorio.'
  );

  const result = await env.DB
    .prepare(`
      INSERT INTO expense_categories (
        name
      )
      VALUES (?)
    `)
    .bind(
      data.name.trim()
    )
    .run();

  return created(
    result
  );
}

    if (entity === 'expense_units') {
      requireText(
        data.name,
        'El nombre de la unidad es obligatorio.'
      );

      const source =
        validQuantitySource(
          data.quantity_source
        );

      if (!source) {
        return error(
          'Selecciona cómo se obtiene la cantidad.'
        );
      }

      const result = await env.DB
        .prepare(`
          INSERT INTO expense_units (
            name,
            quantity_source
          )
          VALUES (?, ?)
        `)
        .bind(
          data.name.trim(),
          source
        )
        .run();

      return created(
        result
      );
    }

    if (entity === 'payment_methods') {
      requireText(
        data.name,
        'El nombre de la forma de pago es obligatorio.'
      );

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

      return created(
        result
      );
    }

    if (entity === 'products') {
      requireText(
        data.name,
        'El nombre del producto es obligatorio.'
      );

      requireText(
        data.short_code,
        'El código del producto es obligatorio.'
      );

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

      return created(
        result
      );
    }

    return error(
      'Catálogo no reconocido.'
    );

  } catch (exception) {
    return catalogError(
      exception
    );
  }
}


/* =========================================================
   4. ACTUALIZAR REGISTRO
   ========================================================= */

export async function onRequestPut({
  env,
  request
}) {
  const {
    entity,
    id,
    data = {}
  } = await request.json();

  const recordId = Number(
    id
  );

  if (!recordId) {
    return error(
      'Falta el identificador del registro.'
    );
  }

  if (!TABLES[entity]) {
    return error(
      'Catálogo no reconocido.'
    );
  }

  try {

    if (entity === 'clients') {
      requireText(
        data.name,
        'El nombre del cliente es obligatorio.'
      );

      await env.DB
        .prepare(`
          UPDATE clients
          SET
            name = ?,
            credit_days = ?,
            notes = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(
          data.name.trim(),
          Number(data.credit_days || 0),
          optionalText(data.notes),
          recordId
        )
        .run();

      return updated(
        recordId
      );
    }

    if (entity === 'suppliers') {
      requireText(
        data.name,
        'El nombre del proveedor es obligatorio.'
      );

      await env.DB
        .prepare(`
          UPDATE suppliers
          SET
            name = ?,
            contact = ?,
            notes = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(
          data.name.trim(),
          optionalText(data.contact),
          optionalText(data.notes),
          recordId
        )
        .run();

      return updated(
        recordId
      );
    }

    if (entity === 'expense_categories') {
  requireText(
    data.name,
    'El concepto de gasto es obligatorio.'
  );

  await env.DB
    .prepare(`
      UPDATE expense_categories
      SET
        name = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(
      data.name.trim(),
      recordId
    )
    .run();

  return updated(
    recordId
  );
}

    if (entity === 'expense_units') {
      requireText(
        data.name,
        'El nombre de la unidad es obligatorio.'
      );

      const source =
        validQuantitySource(
          data.quantity_source
        );

      if (!source) {
        return error(
          'Selecciona cómo se obtiene la cantidad.'
        );
      }

      await env.DB
        .prepare(`
          UPDATE expense_units
          SET
            name = ?,
            quantity_source = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(
          data.name.trim(),
          source,
          recordId
        )
        .run();

      return updated(
        recordId
      );
    }

    if (entity === 'payment_methods') {
      requireText(
        data.name,
        'El nombre de la forma de pago es obligatorio.'
      );

      await env.DB
        .prepare(`
          UPDATE payment_methods
          SET name = ?
          WHERE id = ?
        `)
        .bind(
          data.name.trim(),
          recordId
        )
        .run();

      return updated(
        recordId
      );
    }

    if (entity === 'products') {
      requireText(
        data.name,
        'El nombre del producto es obligatorio.'
      );

      requireText(
        data.short_code,
        'El código del producto es obligatorio.'
      );

      if (
        Number(data.is_default) === 1
      ) {
        await env.DB
          .prepare(`
            UPDATE products
            SET
              is_default = 0,
              updated_at = CURRENT_TIMESTAMP
            WHERE id <> ?
          `)
          .bind(
            recordId
          )
          .run();
      }

      await env.DB
        .prepare(`
          UPDATE products
          SET
            name = ?,
            short_code = ?,
            default_density_per_ha = ?,
            seed_cost_per_thousand = ?,
            seed_currency = ?,
            standard_box_lbs = ?,
            default_price_per_box = ?,
            price_currency = ?,
            is_default = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
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
          ),
          recordId
        )
        .run();

      return updated(
        recordId
      );
    }

    return error(
      'Catálogo no reconocido.'
    );

  } catch (exception) {
    return catalogError(
      exception
    );
  }
}


/* =========================================================
   5. ELIMINAR REGISTRO
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
    const result = await env.DB
      .prepare(`
        DELETE FROM ${table}
        WHERE id = ?
      `)
      .bind(
        Number(id)
      )
      .run();

    if (
      Number(
        result.meta?.changes || 0
      ) === 0
    ) {
      return error(
        'No se encontró el registro.'
      );
    }

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
   6. UTILIDADES
   ========================================================= */

function created(
  result
) {
  return json({
    ok: true,
    id: result.meta?.last_row_id
  });
}


function updated(
  id
) {
  return json({
    ok: true,
    id
  });
}


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


function validCurrency(
  value,
  fallback = 'MXN'
) {
  return ['MXN', 'USD']
    .includes(value)
      ? value
      : fallback;
}


function validQuantitySource(
  value
) {
  return [
    'ONE',
    'HECTARES',
    'MANUAL'
  ].includes(value)
    ? value
    : null;
}


function optionalText(
  value
) {
  const result = String(
    value || ''
  ).trim();

  return result || null;
}


function requireText(
  value,
  message
) {
  if (
    !String(
      value || ''
    ).trim()
  ) {
    throw new Error(
      message
    );
  }
}


function catalogError(
  exception
) {
  const message = String(
    exception?.message || ''
  );

  if (
    message.includes('UNIQUE')
  ) {
    return error(
      'Ya existe un registro con esos datos.'
    );
  }

  if (
    message.includes('obligatorio')
  ) {
    return error(
      message
    );
  }

  return error(
    'No fue posible guardar los cambios.'
  );
}
