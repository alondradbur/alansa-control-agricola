/* =========================================================
   SISTEMA DE CONTROL AGRÍCOLA
   MÓDULO: CATÁLOGOS

   Funciones:
   - Crear, editar y eliminar catálogos.
   - Incluye Unidades de costo para Gastos.
   - Permite definir cómo se obtiene la cantidad:
     1 por registro, hectáreas de la siembra o captura manual.
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
    'name'
  ]
],

  expense_units: [
    'Unidades de costo',
    [
      'name',
      'quantity_source'
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
                <div class="row-actions">

                  <button
                    class="btn soft"
                    type="button"
                    data-edit-cat="${entity}"
                    data-id="${row.id}"
                  >
                    Editar
                  </button>

                  <button
                    class="btn danger"
                    type="button"
                    data-del-cat="${entity}"
                    data-id="${row.id}"
                  >
                    Eliminar
                  </button>

                </div>
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
          ${fieldLabel(field)}
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
          type="button"
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

  if (
    entity === 'expense_units' &&
    field === 'quantity_source'
  ) {
    return escapeHtml(
      quantitySourceLabel(
        row.quantity_source
      )
    );
  }

  return escapeHtml(
    row[field] ?? '—'
  );
}


function fieldLabel(
  field
) {
  const labels = {
    name: 'Nombre',
    short_code: 'Código',
    credit_days: 'Días de crédito',
    contact: 'Contacto',
    default_amount: 'Monto predeterminado',
    default_currency: 'Moneda',
    quantity_source: 'Cantidad'
  };

  return labels[field] ||
    field.replaceAll('_', ' ');
}


function quantitySourceLabel(
  value
) {
  const labels = {
    ONE: '1 por registro',
    HECTARES: 'Hectáreas de la siembra',
    MANUAL: 'Captura manual'
  };

  return labels[value] || value || '—';
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
        openForm(
          button.dataset.addCat,
          rerender
        );
      };
    });

  document
    .querySelectorAll(
      '[data-edit-cat]'
    )
    .forEach(button => {
      button.onclick = () => {
        const entity =
          button.dataset.editCat;

        const id = Number(
          button.dataset.id
        );

        const row = (
          data[entity] || []
        ).find(item => {
          return Number(item.id) === id;
        });

        if (!row) {
          toast(
            'No se encontró el registro.'
          );

          return;
        }

        openForm(
          entity,
          rerender,
          row
        );
      };
    });

  document
    .querySelectorAll(
      '[data-del-cat]'
    )
    .forEach(button => {
      button.onclick = async () => {
        const entity =
          button.dataset.delCat;

        const id = Number(
          button.dataset.id
        );

        const row = (
          data[entity] || []
        ).find(item => {
          return Number(item.id) === id;
        });

        const label =
          row?.name || 'este registro';

        if (
          !confirm(
            `¿Eliminar "${label}"?`
          )
        ) {
          return;
        }

        try {
          await api(
            'catalogs',
            {
              method: 'DELETE',
              body: JSON.stringify({
                entity,
                id
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
   7. FORMULARIO NUEVO / EDITAR
   ========================================================= */

function openForm(
  entity,
  rerender,
  row = null
) {
  const editing = Boolean(
    row?.id
  );

  const root = document.querySelector(
    '#catModal'
  );

  if (!root) {
    return;
  }

  root.innerHTML = `
    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-head">

          <div>
            <h2>
              ${
                editing
                  ? `Editar ${cfg[entity][0]}`
                  : `Agregar ${cfg[entity][0]}`
              }
            </h2>

            ${
              editing
                ? `
                  <p class="muted">
                    Modifica los datos y guarda los cambios.
                  </p>
                `
                : ''
            }
          </div>

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
            ${fields(
              entity,
              row || {}
            )}
          </div>

          <div class="modal-actions">

            <button
              class="btn primary"
              type="submit"
            >
              ${
                editing
                  ? 'Guardar cambios'
                  : 'Guardar'
              }
            </button>

          </div>

        </form>

      </div>

    </div>
  `;

  bindMoneyInputs(
    root
  );

  root
    .querySelector(
      '#closeCat'
    )
    ?.addEventListener(
      'click',
      () => {
        root.innerHTML = '';
      }
    );

  root
    .querySelector(
      '#catForm'
    )
    ?.addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        try {
          const formData = new FormData(
            event.currentTarget
          );

          const payload = {
            entity,
            id:
              editing
                ? Number(row.id)
                : undefined,
            data:
              Object.fromEntries(
                formData.entries()
              )
          };

          await api(
            'catalogs',
            {
              method:
                editing
                  ? 'PUT'
                  : 'POST',

              body: JSON.stringify(
                payload
              )
            }
          );

          root.innerHTML = '';

          toast(
            editing
              ? 'Cambios guardados correctamente.'
              : 'Registro guardado.'
          );

          await rerender();

        } catch (error) {
          toast(
            error.message
          );
        }
      }
    );
}


/* =========================================================
   8. CAMPOS POR TIPO DE CATÁLOGO
   ========================================================= */

function fields(
  entity,
  row = {}
) {

  if (entity === 'products') {
    return `
      ${inputField(
        'name',
        'Producto',
        row.name || '',
        'text',
        'required'
      )}

      ${inputField(
        'short_code',
        'Código',
        row.short_code || '',
        'text',
        'required'
      )}

      ${inputField(
        'default_density_per_ha',
        'Semillas por ha',
        row.default_density_per_ha ?? 100000,
        'number',
        'min="0" step="1"'
      )}

      ${moneyField(
        'seed_cost_per_thousand',
        'Costo de semilla por millar',
        formatMoneyText(
          row.seed_cost_per_thousand ?? 400
        )
      )}

      ${currencyField(
        'seed_currency',
        'Moneda del costo de semilla',
        row.seed_currency || 'USD'
      )}

      ${inputField(
        'standard_box_lbs',
        'Peso caja lb',
        row.standard_box_lbs ?? 12,
        'number',
        'min="0" step="0.01"'
      )}

      ${moneyField(
        'default_price_per_box',
        'Precio por caja',
        formatMoneyText(
          row.default_price_per_box ?? 14
        )
      )}

      ${currencyField(
        'price_currency',
        'Moneda del precio por caja',
        row.price_currency || 'USD'
      )}

      <div class="field">

        <label>
          Predeterminado
        </label>

        <select
          class="input"
          name="is_default"
        >
          <option
            value="0"
            ${
              Number(
                row.is_default || 0
              ) !== 1
                ? 'selected'
                : ''
            }
          >
            No
          </option>

          <option
            value="1"
            ${
              Number(
                row.is_default || 0
              ) === 1
                ? 'selected'
                : ''
            }
          >
            Sí
          </option>
        </select>

      </div>
    `;
  }

  if (entity === 'clients') {
    return `
      ${inputField(
        'name',
        'Cliente',
        row.name || '',
        'text',
        'required'
      )}

      ${inputField(
        'credit_days',
        'Días de crédito',
        row.credit_days ?? 0,
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
        >${escapeHtml(
          row.notes || ''
        )}</textarea>

      </div>
    `;
  }

  if (entity === 'suppliers') {
    return `
      ${inputField(
        'name',
        'Proveedor',
        row.name || '',
        'text',
        'required'
      )}

      ${inputField(
        'contact',
        'Contacto',
        row.contact || ''
      )}

      <div class="field span-2">

        <label>
          Notas
        </label>

        <textarea
          class="input"
          name="notes"
        >${escapeHtml(
          row.notes || ''
        )}</textarea>

      </div>
    `;
  }

  if (entity === 'expense_categories') {
  return `
    ${inputField(
      'name',
      'Concepto de gasto',
      row.name || '',
      'text',
      'required'
    )}
  `;
}

  if (entity === 'expense_units') {
    return `
      ${inputField(
        'name',
        'Unidad de costo',
        row.name || '',
        'text',
        'required'
      )}

      <div class="field">

        <label>
          ¿Cómo se obtiene la cantidad?
        </label>

        <select
          class="input"
          name="quantity_source"
          required
        >

          <option
            value="ONE"
            ${row.quantity_source === 'ONE' ? 'selected' : ''}
          >
            1 por registro
          </option>

          <option
            value="HECTARES"
            ${row.quantity_source === 'HECTARES' ? 'selected' : ''}
          >
            Hectáreas de la siembra
          </option>

          <option
            value="MANUAL"
            ${
              !row.quantity_source ||
              row.quantity_source === 'MANUAL'
                ? 'selected'
                : ''
            }
          >
            Captura manual
          </option>

        </select>

      </div>
    `;
  }

  return inputField(
    'name',
    'Nombre',
    row.name || '',
    'text',
    'required'
  );
}


/* =========================================================
   9. GENERADORES DE CAMPOS
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
        value="${escapeHtml(
          value ?? ''
        )}"
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
        value="${escapeHtml(
          value
        )}"
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
   10. FORMATO MONETARIO
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
          input.value =
            normalizeMoneyText(
              input.value
            );
        }
      );

      input.addEventListener(
        'blur',
        () => {
          input.value =
            formatMoneyText(
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
  const normalized =
    normalizeMoneyText(
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

