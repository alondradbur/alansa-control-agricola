/* =========================================================
   ALANSA - SISTEMA DE CONTROL AGRÍCOLA
   MÓDULO: SIEMBRAS / CONTRATOS

   Ajuste:
   - Los importes aceptan separadores de miles.
   - Todo importe solicita moneda MXN o USD.
   - Los importes se muestran formateados.
   ========================================================= */


/* =========================================================
   1. IMPORTACIONES
   ========================================================= */

import { api } from '../core/api.js';

import {
  escapeHtml,
  money,
  number,
  date
} from '../core/format.js';

import {
  moduleHeader,
  empty,
  toast
} from '../components/common.js';


/* =========================================================
   2. ESTADO DEL MÓDULO
   ========================================================= */

let rows = [];

let catalogs = {
  products: [],
  clients: []
};


/* =========================================================
   3. RENDER PRINCIPAL
   ========================================================= */

export async function plantings() {
  try {
    const responses = await Promise.all([
      api('plantings'),
      api('catalogs')
    ]);

    rows = responses[0] || [];

    catalogs = responses[1] || {
      products: [],
      clients: []
    };
  } catch {
    rows = [];

    catalogs = {
      products: [],
      clients: []
    };
  }

  const tableBody = rows.length
    ? rows
        .map(row => createRow(row))
        .join('')
    : `
        <tr>
          <td colspan="8">
            ${empty(
              'Todavía no hay siembras registradas.'
            )}
          </td>
        </tr>
      `;

  return `
    ${moduleHeader(
      'Siembras',
      'Contratos, hectáreas y periodos de cosecha',
      `
        <button
          class="btn primary"
          id="newPlantingBtn"
        >
          ＋ Nueva siembra
        </button>
      `
    )}

    <div class="content">

      <section class="card table-card">

        <div class="table-toolbar">
          <strong>
            Siembras / contratos
          </strong>
        </div>

        <div class="table-scroll">

          <table>

            <thead>
              <tr>
                <th>Contrato</th>
                <th>Cliente</th>
                <th>Producto</th>
                <th>Hectáreas</th>
                <th>Periodo de cosecha</th>
                <th>Semilla estimada</th>
                <th>Precio / caja</th>
                <th>Estado</th>
              </tr>
            </thead>

            <tbody>
              ${tableBody}
            </tbody>

          </table>

        </div>

      </section>

    </div>

    <div id="plantingModalRoot"></div>
  `;
}


/* =========================================================
   4. FILA DE SIEMBRA
   ========================================================= */

function createRow(
  row
) {
  return `
    <tr>

      <td>
        <strong>
          ${escapeHtml(
            row.contract_number
          )}
        </strong>
      </td>

      <td>
        ${escapeHtml(
          row.client_name
        )}
      </td>

      <td>
        ${escapeHtml(
          row.product_name
        )}
      </td>

      <td>
        ${number(
          row.hectares,
          2
        )}
      </td>

      <td>
        ${date(
          row.harvest_start
        )}
        –
        ${date(
          row.harvest_end
        )}
      </td>

      <td>
        ${money(
          row.estimated_seed_cost,
          row.seed_currency
        )}
      </td>

      <td>
        ${money(
          row.price_per_box,
          row.price_currency
        )}
      </td>

      <td>
        <span class="status ${escapeHtml(
          row.status
        )}">
          ${escapeHtml(
            row.status
          )}
        </span>
      </td>

    </tr>
  `;
}


/* =========================================================
   5. EVENTOS DEL MÓDULO
   ========================================================= */

export function bindPlantings(
  rerender
) {
  document
    .querySelector(
      '#newPlantingBtn'
    )
    ?.addEventListener(
      'click',
      () => {
        openPlantingForm(
          rerender
        );
      }
    );
}


/* =========================================================
   6. FORMULARIO DE NUEVA SIEMBRA
   ========================================================= */

function openPlantingForm(
  rerender
) {
  const defaultProduct =
    catalogs.products
      ?.find(product => {
        return Number(
          product.is_default
        ) === 1;
      })
    ||
    catalogs.products?.[0]
    ||
    {};

  const modalRoot = document.querySelector(
    '#plantingModalRoot'
  );

  if (!modalRoot) {
    return;
  }

  modalRoot.innerHTML = `
    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-head">

          <h2>
            Nueva siembra
          </h2>

          <button
            class="btn"
            id="closePlantingModal"
            type="button"
          >
            Cerrar
          </button>

        </div>

        <form
          class="modal-body"
          id="plantingForm"
        >

          <div class="form-grid">

            ${inputField(
              'contract_number',
              'Contrato / folio',
              '',
              'text',
              'required'
            )}

            <div class="field">

              <label>
                Cliente
              </label>

              <select
                class="input"
                name="client_id"
                required
              >
                <option value="">
                  Seleccionar cliente
                </option>

                ${clientOptions()}
              </select>

            </div>

            <div class="field">

              <label>
                Producto
              </label>

              <select
                class="input"
                name="product_id"
                id="plantingProduct"
                required
              >
                ${productOptions(
                  defaultProduct.id
                )}
              </select>

            </div>

            ${inputField(
              'hectares',
              'Hectáreas',
              '',
              'number',
              'required min="0.01" step="0.01"'
            )}

            ${inputField(
              'density_per_ha',
              'Semillas por hectárea',
              defaultProduct.default_density_per_ha || 100000,
              'number',
              'required min="1" step="1"'
            )}

            ${moneyField(
              'seed_cost_per_thousand',
              'Costo de semilla por millar',
              formatMoneyText(
                defaultProduct.seed_cost_per_thousand || 400
              )
            )}

            ${currencyField(
              'seed_currency',
              'Moneda del costo de semilla',
              defaultProduct.seed_currency || 'USD'
            )}

            ${moneyField(
              'actual_seed_cost',
              'Costo real de semilla'
            )}

            ${inputField(
              'harvest_start',
              'Inicio de cosecha',
              '',
              'date',
              'required'
            )}

            ${inputField(
              'harvest_end',
              'Fin de cosecha',
              '',
              'date',
              'required'
            )}

            ${moneyField(
              'price_per_box',
              'Precio por caja',
              formatMoneyText(
                defaultProduct.default_price_per_box || 14
              )
            )}

            ${currencyField(
              'price_currency',
              'Moneda del precio por caja',
              defaultProduct.price_currency || 'USD'
            )}

            ${inputField(
              'standard_box_lbs',
              'Peso estándar por caja (lb)',
              defaultProduct.standard_box_lbs || 12,
              'number',
              'min="0" step="0.01"'
            )}

            ${inputField(
              'trailers_per_week',
              'Meta de tráileres por semana',
              1,
              'number',
              'min="0" step="0.01"'
            )}

            <input
              type="hidden"
              name="status"
              value="Activa"
            >

          </div>

          <div class="modal-actions">

            <button
              class="btn primary"
              type="submit"
            >
              Guardar siembra
            </button>

          </div>

        </form>

      </div>

    </div>
  `;

  bindMoneyInputs(
    modalRoot
  );

  bindProductDefaults(
    modalRoot
  );

  document
    .querySelector(
      '#closePlantingModal'
    )
    ?.addEventListener(
      'click',
      () => {
        modalRoot.innerHTML = '';
      }
    );

  document
    .querySelector(
      '#plantingForm'
    )
    ?.addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        if (
          catalogs.clients.length === 0
        ) {
          toast(
            'Primero agrega un cliente en Catálogos.'
          );

          return;
        }

        const formData = new FormData(
          event.currentTarget
        );

        const payload = Object.fromEntries(
          formData.entries()
        );

        try {
          await api(
            'plantings',
            {
              method: 'POST',
              body: JSON.stringify(
                payload
              )
            }
          );

          modalRoot.innerHTML = '';

          toast(
            'Siembra guardada correctamente.'
          );

          await rerender();
        } catch (exception) {
          toast(
            exception.message
          );
        }
      }
    );
}


/* =========================================================
   7. OPCIONES DE CLIENTES Y PRODUCTOS
   ========================================================= */

function clientOptions() {
  return catalogs.clients
    .map(client => {
      return `
        <option value="${client.id}">
          ${escapeHtml(
            client.name
          )}
        </option>
      `;
    })
    .join('');
}


function productOptions(
  selectedId
) {
  return catalogs.products
    .map(product => {
      const selected =
        Number(product.id) ===
        Number(selectedId);

      return `
        <option
          value="${product.id}"
          ${selected ? 'selected' : ''}
        >
          ${escapeHtml(
            product.name
          )}
        </option>
      `;
    })
    .join('');
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
  selected = 'USD'
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
   9. ACTUALIZAR VALORES AL CAMBIAR PRODUCTO
   ========================================================= */

function bindProductDefaults(
  root
) {
  const productSelect = root.querySelector(
    '#plantingProduct'
  );

  productSelect
    ?.addEventListener(
      'change',
      () => {
        const product = catalogs.products
          .find(item => {
            return Number(item.id) ===
              Number(productSelect.value);
          });

        if (!product) {
          return;
        }

        setFieldValue(
          root,
          'density_per_ha',
          product.default_density_per_ha || ''
        );

        setFieldValue(
          root,
          'seed_cost_per_thousand',
          formatMoneyText(
            product.seed_cost_per_thousand || 0
          )
        );

        setFieldValue(
          root,
          'seed_currency',
          product.seed_currency || 'USD'
        );

        setFieldValue(
          root,
          'price_per_box',
          formatMoneyText(
            product.default_price_per_box || 0
          )
        );

        setFieldValue(
          root,
          'price_currency',
          product.price_currency || 'USD'
        );

        setFieldValue(
          root,
          'standard_box_lbs',
          product.standard_box_lbs || 12
        );
      }
    );
}


function setFieldValue(
  root,
  name,
  value
) {
  const field = root.querySelector(
    `[name="${name}"]`
  );

  if (field) {
    field.value = value;
  }
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
