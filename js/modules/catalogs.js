/* =========================================================
   ALANSA - SISTEMA DE CONTROL AGRÍCOLA
   MÓDULO: CATÁLOGOS

   Ajuste:
   - Los importes aceptan separadores de miles.
   - Todo importe solicita moneda MXN o USD.
   - Los importes se muestran formateados en las tablas.
   ========================================================= */


/* =========================================================
   1. IMPORTACIONES
   ========================================================= */

import { api } from '../core/api.js';
import {
  escapeHtml,
  money
} from '../core/format.js';

import {
  moduleHeader,
  empty,
  toast
} from '../components/common.js';


/* =========================================================
   2. ESTADO Y CONFIGURACIÓN
   ========================================================= */

let data = {};

const cfg = {
  products: [
    'Productos',
    [
      'name',
      'short_code'
    ]
  ],

  clients: [
    'Clientes',
    [
      'name',
      'credit_days'
    ]
  ],

  suppliers: [
    'Proveedores',
    [
      'name',
      'contact'
    ]
  ],

  expense_categories: [
    'Categorías de gastos',
    [
      'name',
      'default_amount',
      'default_currency'
    ]
  ],

  payment_methods: [
    'Formas de pago',
    [
      'name'
    ]
  ]
};


/* =========================================================
   3. RENDER PRINCIPAL
   ========================================================= */

export async function catalogs() {
  try {
    data = await api('catalogs');
  } catch {
    data = {};
  }

  const catalogCards = Object
    .entries(cfg)
    .map(([entity, [title, fields]]) => {
      return card(
        entity,
        title,
        fields
      );
    })
    .join('');

  return `
    ${moduleHeader(
      'Catálogos',
      'Listas maestras que alimentan el sistema'
    )}

    <div class="content">
      ${catalogCards}
    </div>

    <div id="catModal"></div>
  `;
}


/* =========================================================
   4. TARJETA DE CATÁLOGO
   ========================================================= */

function card(
  entity,
  title,
  fields
) {
  const rows = data[entity] || [];

  const body = rows.length
    ? rows
        .map(row => {
          const cells = fields
            .map(field => {
              return `
                <td>
                  ${formatCell(
                    entity,
                    field,
                    row
                  )}
                </td>
              `;
            })
            .join('');

          return `
            <tr>
              ${cells}

              <td>
                <button
                  class="btn danger"
                  data-del-cat="${entity}"
                  data-id="${row.id}"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          `;
        })
        .join('')
    : `
        <tr>
          <td colspan="${fields.length + 1}">
            ${empty(
              'No hay registros.'
            )}
          </td>
        </tr>
      `;

  const headers = fields
    .map(field => {
      return `
        <th>
          ${field.replaceAll('_', ' ')}
        </th>
      `;
    })
    .join('');

  return `
    <section class="card table-card">

      <div class="table-toolbar">
        <strong>
          ${title}
        </strong>

        <button
          class="btn primary"
          data-add-cat="${entity}"
        >
          ＋ Agregar
        </button>
      </div>

      <div class="table-scroll">

        <table>

          <thead>
            <tr>
              ${headers}

              <th>
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            ${body}
          </tbody>

        </table>

      </div>

    </section>
  `;
}


/* =========================================================
   5. FORMATO DE CELDAS
   ========================================================= */

function formatCell(
  entity,
  field,
  row
) {
  if (
    entity === 'expense_categories' &&
    field === 'default_amount'
  ) {
    if (
      row.default_amount === null ||
      row.default_amount === ''
    ) {
      return '—';
    }

    return escapeHtml(
      money(
        row.default_amount,
        row.default_currency || 'MXN'
      )
    );
  }

  return escapeHtml(
    row[field] ?? '—'
  );
}


/* =========================================================
   6. EVENTOS DEL MÓDULO
   ========================================================= */

export function bindCatalogs(
  rerender
) {
  document
    .querySelectorAll(
      '[data-add-cat]'
    )
    .forEach(button => {
      button.onclick = () => {
        form(
          button.dataset.addCat,
          rerender
        );
      };
    });

  document
    .querySelectorAll(
      '[data-del-cat]'
    )
    .forEach(button => {
      button.onclick = async () => {
        const confirmed = confirm(
          '¿Eliminar este registro?'
        );

        if (!confirmed) {
          return;
        }

        try {
          await api(
            'catalogs',
            {
              method: 'DELETE',
              body: JSON.stringify({
                entity:
                  button.dataset.delCat,

                id:
                  Number(
                    button.dataset.id
                  )
              })
            }
          );

          toast(
            'Registro eliminado.'
          );

          await rerender();
        } catch (error) {
          toast(
            error.message
          );
        }
      };
    });
}


/* =========================================================
   7. FORMULARIO DE ALTA
   ========================================================= */

function form(
  entity,
  rerender
) {
  const root = document.querySelector(
    '#catModal'
  );

  root.innerHTML = `
    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-head">

          <h2>
            Agregar ${cfg[entity][0]}
          </h2>

          <button
            class="btn"
            id="closeCat"
            type="button"
          >
            Cerrar
          </button>

        </div>

        <form
          class="modal-body"
          id="catForm"
        >

          <div class="form-grid">
            ${fields(entity)}
          </div>

          <div class="modal-actions">

            <button
              class="btn primary"
              type="submit"
            >
              Guardar
            </button>

          </div>

        </form>

      </div>

    </div>
  `;

  bindMoneyInputs(root);

  document
    .querySelector(
      '#closeCat'
    )
    .onclick = () => {
      root.innerHTML = '';
    };

  document
    .querySelector(
      '#catForm'
    )
    .onsubmit = async event => {
      event.preventDefault();

      try {
        const formData = new FormData(
          event.currentTarget
        );

        const payload = {
          entity,
          data: Object.fromEntries(
            formData.entries()
          )
        };

        await api(
          'catalogs',
          {
            method: 'POST',
            body: JSON.stringify(
              payload
            )
          }
        );

        root.innerHTML = '';

        toast(
          'Registro guardado.'
        );

        await rerender();
      } catch (error) {
        toast(
          error.message
        );
      }
    };
}


/* =========================================================
   8. GENERADORES DE CAMPOS
   ========================================================= */

function inputField(
  name,
  label,
  value = '',
  type = 'text',
  extra = ''
) {
  return `
    <div class="field">

      <label>
        ${label}
      </label>

      <input
        class="input"
        name="${name}"
        type="${type}"
        value="${value}"
        ${extra}
      >

    </div>
  `;
}


function moneyField(
  name,
  label,
  value = ''
) {
  return `
    <div class="field">

      <label>
        ${label}
      </label>

      <input
        class="input money-input"
        name="${name}"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        value="${value}"
        placeholder="0.00"
      >

    </div>
  `;
}


function currencyField(
  name,
  label,
  selected = 'MXN'
) {
  return `
    <div class="field">

      <label>
        ${label}
      </label>

      <select
        class="input"
        name="${name}"
        required
      >

        <option
          value="MXN"
          ${selected === 'MXN' ? 'selected' : ''}
        >
          MXN
        </option>

        <option
          value="USD"
          ${selected === 'USD' ? 'selected' : ''}
        >
          USD
        </option>

      </select>

    </div>
  `;
}


/* =========================================================
   9. CAMPOS POR TIPO DE CATÁLOGO
   ========================================================= */

function fields(
  entity
) {

  /* ---------------------------------------------------------
     9.1. PRODUCTOS
     --------------------------------------------------------- */

  if (entity === 'products') {
    return `
      ${inputField(
        'name',
        'Producto',
        '',
        'text',
        'required'
      )}

      ${inputField(
        'short_code',
        'Código',
        '',
        'text',
        'required'
      )}

      ${inputField(
        'default_density_per_ha',
        'Semillas por ha',
        100000,
        'number',
        'min="0" step="1"'
      )}

      ${moneyField(
        'seed_cost_per_thousand',
        'Costo de semilla por millar',
        '400.00'
      )}

      ${currencyField(
        'seed_currency',
        'Moneda del costo de semilla',
        'USD'
      )}

      ${inputField(
        'standard_box_lbs',
        'Peso caja lb',
        12,
        'number',
        'min="0" step="0.01"'
      )}

      ${moneyField(
        'default_price_per_box',
        'Precio por caja',
        '14.00'
      )}

      ${currencyField(
        'price_currency',
        'Moneda del precio por caja',
        'USD'
      )}

      <div class="field">

        <label>
          Predeterminado
        </label>

        <select
          class="input"
          name="is_default"
        >
          <option value="0">
            No
          </option>

          <option value="1">
            Sí
          </option>
        </select>

      </div>
    `;
  }


  /* ---------------------------------------------------------
     9.2. CLIENTES
     --------------------------------------------------------- */

  if (entity === 'clients') {
    return `
      ${inputField(
        'name',
        'Cliente',
        '',
        'text',
        'required'
      )}

      ${inputField(
        'credit_days',
        'Días de crédito',
        0,
        'number',
        'min="0" step="1"'
      )}

      <div class="field span-2">

        <label>
          Notas
        </label>

        <textarea
          class="input"
          name="notes"
        ></textarea>

      </div>
    `;
  }


  /* ---------------------------------------------------------
     9.3. PROVEEDORES
     --------------------------------------------------------- */

  if (entity === 'suppliers') {
    return `
      ${inputField(
        'name',
        'Proveedor',
        '',
        'text',
        'required'
      )}

      ${inputField(
        'contact',
        'Contacto'
      )}
    `;
  }


  /* ---------------------------------------------------------
     9.4. CATEGORÍAS DE GASTO
     --------------------------------------------------------- */

  if (entity === 'expense_categories') {
    return `
      ${inputField(
        'name',
        'Categoría',
        '',
        'text',
        'required'
      )}

      ${moneyField(
        'default_amount',
        'Monto predeterminado'
      )}

      ${currencyField(
        'default_currency',
        'Moneda',
        'MXN'
      )}
    `;
  }


  /* ---------------------------------------------------------
     9.5. FORMAS DE PAGO
     --------------------------------------------------------- */

  return inputField(
    'name',
    'Nombre',
    '',
    'text',
    'required'
  );
}


/* =========================================================
   10. FORMATO DE CAMPOS MONETARIOS
   ========================================================= */

function bindMoneyInputs(
  root
) {
  root
    .querySelectorAll(
      '.money-input'
    )
    .forEach(input => {
      input.addEventListener(
        'focus',
        () => {
          input.value = normalizeMoneyText(
            input.value
          );
        }
      );

      input.addEventListener(
        'blur',
        () => {
          input.value = formatMoneyText(
            input.value
          );
        }
      );
    });
}


function normalizeMoneyText(
  value
) {
  return String(value || '')
    .replaceAll(',', '')
    .replace(/[^\d.-]/g, '');
}


function formatMoneyText(
  value
) {
  const normalized = normalizeMoneyText(
    value
  );

  if (!normalized) {
    return '';
  }

  const amount = Number(
    normalized
  );

  if (!Number.isFinite(amount)) {
    return '';
  }

  return new Intl.NumberFormat(
    'en-US',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ).format(amount);
}
