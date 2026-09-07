/* =========================================================
   SISTEMA DE CONTROL AGRÍCOLA
   MÓDULO: SIEMBRAS / CONTRATOS

   Funciones:
   - Crear siembras.
   - Editar registros existentes.
   - Guardar cambios en D1.
   - Eliminar siembras sin movimientos relacionados.
   - Mantener importes y monedas.
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
          <td colspan="10">
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
          type="button"
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
                <th>Rendimiento esperado</th>
                <th>Periodo de cosecha</th>
                <th>Semilla estimada</th>
                <th>Precio / caja</th>
                <th>Estado</th>
                <th>Acciones</th>
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
        ${number(
          row.expected_yield_boxes_ha,
          0
        )}
        cajas/ha
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

      <td>
        <div
          style="
            display:flex;
            gap:7px;
            align-items:center;
            white-space:nowrap;
          "
        >
          <button
            class="btn soft edit-planting"
            type="button"
            data-id="${row.id}"
          >
            Editar
          </button>

          <button
            class="btn danger delete-planting"
            type="button"
            data-id="${row.id}"
          >
            Eliminar
          </button>
        </div>
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

  /* ---------------------------------------------------------
     5.1. NUEVA SIEMBRA
     --------------------------------------------------------- */

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


  /* ---------------------------------------------------------
     5.2. EDITAR SIEMBRA
     --------------------------------------------------------- */

  document
    .querySelectorAll(
      '.edit-planting'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          const id = Number(
            button.dataset.id
          );

          const row = rows.find(
            item => {
              return Number(item.id) === id;
            }
          );

          if (!row) {
            toast(
              'No se encontró la siembra.'
            );

            return;
          }

          openPlantingForm(
            rerender,
            row
          );
        }
      );
    });


  /* ---------------------------------------------------------
     5.3. ELIMINAR SIEMBRA
     --------------------------------------------------------- */

  document
    .querySelectorAll(
      '.delete-planting'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        async () => {
          const id = Number(
            button.dataset.id
          );

          const row = rows.find(
            item => {
              return Number(item.id) === id;
            }
          );

          const folio =
            row?.contract_number ||
            'esta siembra';

          const confirmed = confirm(
            `¿Eliminar la siembra "${folio}"?`
          );

          if (!confirmed) {
            return;
          }

          try {
            await api(
              'plantings',
              {
                method: 'DELETE',
                body: JSON.stringify({
                  id
                })
              }
            );

            toast(
              'Siembra eliminada correctamente.'
            );

            await rerender();

          } catch (exception) {
            toast(
              exception.message
            );
          }
        }
      );
    });
}


/* =========================================================
   6. FORMULARIO NUEVO / EDITAR
   ========================================================= */

function openPlantingForm(
  rerender,
  row = null
) {
  const editing = Boolean(
    row?.id
  );

  const defaultProduct =
    editing
      ? catalogs.products
          ?.find(product => {
            return Number(product.id) ===
              Number(row.product_id);
          })
      : catalogs.products
          ?.find(product => {
            return Number(
              product.is_default
            ) === 1;
          })
        ||
        catalogs.products?.[0]
        ||
        {};

  const selectedProduct =
    defaultProduct || {};

  const modalRoot =
    document.querySelector(
      '#plantingModalRoot'
    );

  if (!modalRoot) {
    return;
  }

  modalRoot.innerHTML = `
    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-head">

          <div>
            <h2>
              ${
                editing
                  ? 'Editar siembra'
                  : 'Nueva siembra'
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

          <input
            type="hidden"
            name="id"
            value="${row?.id || ''}"
          >

          <div class="form-grid">

            ${inputField(
              'contract_number',
              'Contrato / folio',
              row?.contract_number || '',
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

                ${clientOptions(
                  row?.client_id
                )}
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
                  row?.product_id ||
                  selectedProduct.id
                )}
              </select>

            </div>

            ${inputField(
              'hectares',
              'Hectáreas',
              row?.hectares ?? '',
              'number',
              'required min="0.01" step="0.01"'
            )}

            ${inputField(
              'expected_yield_boxes_ha',
              'Rendimiento esperado (cajas/ha)',
              row?.expected_yield_boxes_ha ?? '',
              'number',
              'required min="1" step="1"'
            )}

            ${inputField(
              'density_per_ha',
              'Semillas por hectárea',
              row?.density_per_ha ??
                selectedProduct.default_density_per_ha ??
                100000,
              'number',
              'required min="1" step="1"'
            )}

            ${moneyField(
              'seed_cost_per_thousand',
              'Costo de semilla por millar',
              formatMoneyText(
                row?.seed_cost_per_thousand ??
                selectedProduct.seed_cost_per_thousand ??
                400
              )
            )}

            ${currencyField(
              'seed_currency',
              'Moneda del costo de semilla',
              row?.seed_currency ||
                selectedProduct.seed_currency ||
                'USD'
            )}

            ${moneyField(
              'actual_seed_cost',
              'Costo real de semilla',
              row?.actual_seed_cost === null ||
              row?.actual_seed_cost === undefined
                ? ''
                : formatMoneyText(
                    row.actual_seed_cost
                  )
            )}

            ${inputField(
              'harvest_start',
              'Inicio de cosecha',
              row?.harvest_start || '',
              'date',
              'required'
            )}

            ${inputField(
              'harvest_end',
              'Fin de cosecha',
              row?.harvest_end || '',
              'date',
              'required'
            )}

            ${moneyField(
              'price_per_box',
              'Precio por caja',
              formatMoneyText(
                row?.price_per_box ??
                selectedProduct.default_price_per_box ??
                14
              )
            )}

            ${currencyField(
              'price_currency',
              'Moneda del precio por caja',
              row?.price_currency ||
                selectedProduct.price_currency ||
                'USD'
            )}

            ${inputField(
              'standard_box_lbs',
              'Peso estándar por caja (lb)',
              row?.standard_box_lbs ??
                selectedProduct.standard_box_lbs ??
                12,
              'number',
              'min="0" step="0.01"'
            )}

            ${inputField(
              'trailers_per_week',
              'Meta de tráileres por semana',
              row?.trailers_per_week ?? 1,
              'number',
              'min="0" step="0.01"'
            )}

            <div class="field">

              <label>
                Estado
              </label>

              <select
                class="input"
                name="status"
                required
              >
                ${statusOption(
                  'Activa',
                  row?.status || 'Activa'
                )}

                ${statusOption(
                  'Finalizada',
                  row?.status || 'Activa'
                )}

                ${statusOption(
                  'Cancelada',
                  row?.status || 'Activa'
                )}
              </select>

            </div>

            <div class="field span-2">

              <label>
                Notas
              </label>

              <textarea
                class="input"
                name="notes"
                rows="3"
              >${escapeHtml(
                row?.notes || ''
              )}</textarea>

            </div>

          </div>

          <div class="modal-actions">

            <button
              class="btn primary"
              type="submit"
            >
              ${
                editing
                  ? 'Guardar cambios'
                  : 'Guardar siembra'
              }
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
    modalRoot,
    editing
  );

  modalRoot
    .querySelector(
      '#closePlantingModal'
    )
    ?.addEventListener(
      'click',
      () => {
        modalRoot.innerHTML = '';
      }
    );

  modalRoot
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

        const formData =
          new FormData(
            event.currentTarget
          );

        const payload =
          Object.fromEntries(
            formData.entries()
          );

        if (editing) {
          payload.id =
            Number(row.id);
        } else {
          delete payload.id;
        }

        try {
          await api(
            'plantings',
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

          modalRoot.innerHTML = '';

          toast(
            editing
              ? 'Siembra actualizada correctamente.'
              : 'Siembra guardada correctamente.'
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
   7. OPCIONES DE CLIENTES, PRODUCTOS Y ESTADO
   ========================================================= */

function clientOptions(
  selectedId
) {
  return catalogs.clients
    .map(client => {
      const selected =
        Number(client.id) ===
        Number(selectedId);

      return `
        <option
          value="${client.id}"
          ${selected ? 'selected' : ''}
        >
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


function statusOption(
  value,
  selectedValue
) {
  return `
    <option
      value="${value}"
      ${value === selectedValue ? 'selected' : ''}
    >
      ${value}
    </option>
  `;
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
  root,
  editing = false
) {
  const productSelect =
    root.querySelector(
      '#plantingProduct'
    );

  productSelect
    ?.addEventListener(
      'change',
      () => {
        const product =
          catalogs.products
            .find(item => {
              return Number(item.id) ===
                Number(
                  productSelect.value
                );
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

  // Al abrir edición NO dispara cambios automáticos,
  // para conservar los valores históricos de la siembra.
  if (editing) {
    return;
  }
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
