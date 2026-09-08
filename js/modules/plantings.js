/* =========================================================
   SISTEMA DE CONTROL AGRÍCOLA
   MÓDULO: SIEMBRAS / CONTRATOS

   Funciones:
   - Crear y editar siembras.
   - Capturar datos productivos para proyección.
   - Capturar costos aproximados por siembra.
   - Eliminar siembras sin movimientos relacionados.
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
    const responses =
      await Promise.all([
        api('plantings'),
        api('catalogs')
      ]);

    rows =
      responses[0] || [];

    catalogs =
      responses[1] || {
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

  const tableBody =
    rows.length
      ? rows
          .map(row => createRow(row))
          .join('')
      : `
          <tr>
            <td colspan="11">
              ${empty(
                'Todavía no hay siembras registradas.'
              )}
            </td>
          </tr>
        `;

  return `
    ${moduleHeader(
      'Siembras',
      'Datos productivos y costos aproximados para proyección',
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
                <th>Cajas proyectadas</th>
                <th>Periodo de cosecha</th>
                <th>Otros costos aproximados</th>
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
  const projectedBoxes =
    numeric(row.hectares) *
    numeric(
      row.expected_yield_boxes_ha
    );

  const otherCosts =
    summarizeEstimatedCosts(
      row.estimated_costs || []
    );

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
        ${number(
          projectedBoxes,
          0
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
        ${estimatedCostSummaryHtml(
          otherCosts
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
        <div class="row-actions">

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

  document
    .querySelectorAll(
      '.edit-planting'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          const id =
            Number(
              button.dataset.id
            );

          const row =
            rows.find(item => {
              return Number(item.id) === id;
            });

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

  document
    .querySelectorAll(
      '.delete-planting'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        async () => {
          const id =
            Number(
              button.dataset.id
            );

          const row =
            rows.find(item => {
              return Number(item.id) === id;
            });

          const folio =
            row?.contract_number ||
            'esta siembra';

          if (
            !confirm(
              `¿Eliminar la siembra "${folio}"?`
            )
          ) {
            return;
          }

          try {
            await api(
              'plantings',
              {
                method: 'DELETE',
                body:
                  JSON.stringify({
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
  const editing =
    Boolean(row?.id);

  const defaultProduct =
    editing
      ? catalogs.products
          ?.find(product => {
            return Number(product.id) ===
              Number(row.product_id);
          })
      : (
          catalogs.products
            ?.find(product => {
              return Number(
                product.is_default
              ) === 1;
            })
          ||
          catalogs.products?.[0]
          ||
          {}
        );

  const selectedProduct =
    defaultProduct || {};

  const modalRoot =
    document.querySelector(
      '#plantingModalRoot'
    );

  if (!modalRoot) {
    return;
  }

  const initialCosts =
    Array.isArray(
      row?.estimated_costs
    )
      ? row.estimated_costs
      : [];

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

            <p class="muted">
              Estos datos alimentan la proyección del Dashboard.
            </p>
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
              'Densidad de siembra (semillas/ha)',
              row?.density_per_ha ??
                selectedProduct.default_density_per_ha ??
                100000,
              'number',
              'required min="1" step="1"'
            )}


            ${inputField(
              'harvest_start',
              'Inicio estimado de cosecha',
              row?.harvest_start || '',
              'date',
              'required'
            )}

            ${inputField(
              'harvest_end',
              'Fin estimado de cosecha',
              row?.harvest_end || '',
              'date',
              'required'
            )}

            ${moneyField(
              'price_per_box',
              'Precio esperado por caja',
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
              'Peso estimado por caja (lb)',
              row?.standard_box_lbs ??
                selectedProduct.standard_box_lbs ??
                12,
              'number',
              'min="0.01" step="0.01"'
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


          <section class="planting-costs-section">

            <div class="planting-costs-head">

              <div>
                <h3>
                  Costos aproximados
                </h3>

                <p class="muted">
                  Captura los costos que estimas para esta siembra.
                  Los gastos reales y sus unidades se registran en Gastos.
                </p>
              </div>

              <button
                class="btn soft"
                id="addEstimatedCost"
                type="button"
              >
                ＋ Agregar costo
              </button>

            </div>

            <div
              id="estimatedCostsList"
              class="planting-costs-list"
            >
              ${estimatedCostRows(
                initialCosts
              )}
            </div>

            <div class="planting-projection-preview">

              <div>
                <span>Producción estimada</span>
                <strong id="projectedProductionPreview">
                  0 cajas
                </strong>
              </div>

              <div>
                <span>Venta proyectada</span>
                <strong id="projectedSalesPreview">
                  —
                </strong>
              </div>

              <div>
                <span>Costos aproximados MXN</span>
                <strong id="otherCostsMxnPreview">
                  $0.00 MXN
                </strong>
              </div>

              <div>
                <span>Costos aproximados USD</span>
                <strong id="otherCostsUsdPreview">
                  $0.00 USD
                </strong>
              </div>

            </div>

          </section>


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

  bindEstimatedCosts(
    modalRoot
  );

  updateProjectionPreview(
    modalRoot
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

        payload.estimated_costs =
          collectEstimatedCosts(
            modalRoot
          );

        /*
         * Compatibilidad con columnas existentes en D1.
         * Estos valores ya no se capturan ni se usan
         * para la proyección financiera.
         */
        payload.seed_cost_per_thousand = 0;
        payload.seed_currency = 'USD';
        payload.trailers_per_week =
          row?.trailers_per_week ?? 1;

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

              body:
                JSON.stringify(
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
   7. COSTOS APROXIMADOS
   ========================================================= */

function estimatedCostRows(
  costs
) {
  if (!costs.length) {
    return '';
  }

  return costs
    .map(cost => {
      return estimatedCostRow(
        cost
      );
    })
    .join('');
}


function estimatedCostRow(
  cost = {}
) {
  return `
    <div class="planting-cost-row">

      <div class="field">
        <label>
          Concepto
        </label>

        <input
          class="input estimated-cost-concept"
          type="text"
          value="${escapeHtml(
            cost.concept || ''
          )}"
          placeholder="Ej. Fertilizante"
        >
      </div>

      <div class="field">
        <label>
          Monto aproximado
        </label>

        <input
          class="input money-input estimated-cost-amount"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          value="${escapeHtml(
            formatMoneyText(
              cost.amount ?? ''
            )
          )}"
          placeholder="0.00"
        >
      </div>

      <div class="field">
        <label>
          Moneda
        </label>

        <select
          class="input estimated-cost-currency"
        >
          <option
            value="MXN"
            ${
              (
                cost.currency || 'MXN'
              ) === 'MXN'
                ? 'selected'
                : ''
            }
          >
            MXN
          </option>

          <option
            value="USD"
            ${
              cost.currency === 'USD'
                ? 'selected'
                : ''
            }
          >
            USD
          </option>
        </select>
      </div>

      <div class="planting-cost-remove">
        <button
          class="btn danger remove-estimated-cost"
          type="button"
        >
          Eliminar
        </button>
      </div>

    </div>
  `;
}


function bindEstimatedCosts(
  root
) {
  const list =
    root.querySelector(
      '#estimatedCostsList'
    );

  root
    .querySelector(
      '#addEstimatedCost'
    )
    ?.addEventListener(
      'click',
      () => {
        list.insertAdjacentHTML(
          'beforeend',
          estimatedCostRow()
        );

        const newRow =
          list.lastElementChild;

        bindEstimatedCostRow(
          newRow,
          root
        );

        newRow
          ?.querySelector(
            '.estimated-cost-concept'
          )
          ?.focus();
      }
    );

  list
    ?.querySelectorAll(
      '.planting-cost-row'
    )
    .forEach(row => {
      bindEstimatedCostRow(
        row,
        root
      );
    });

  [
    'hectares',
    'expected_yield_boxes_ha',
    'price_per_box',
    'price_currency'
  ].forEach(name => {
    root
      .querySelector(
        `[name="${name}"]`
      )
      ?.addEventListener(
        'input',
        () => {
          updateProjectionPreview(
            root
          );
        }
      );

    root
      .querySelector(
        `[name="${name}"]`
      )
      ?.addEventListener(
        'change',
        () => {
          updateProjectionPreview(
            root
          );
        }
      );
  });
}


function bindEstimatedCostRow(
  row,
  root
) {
  row
    ?.querySelector(
      '.remove-estimated-cost'
    )
    ?.addEventListener(
      'click',
      () => {
        row.remove();

        updateProjectionPreview(
          root
        );
      }
    );

  row
    ?.querySelectorAll(
      'input, select'
    )
    .forEach(field => {
      field.addEventListener(
        'input',
        () => {
          updateProjectionPreview(
            root
          );
        }
      );

      field.addEventListener(
        'change',
        () => {
          updateProjectionPreview(
            root
          );
        }
      );
    });

  bindMoneyInputs(
    row
  );
}


function collectEstimatedCosts(
  root
) {
  return Array
    .from(
      root.querySelectorAll(
        '.planting-cost-row'
      )
    )
    .map(row => {
      return {
        concept:
          row
            .querySelector(
              '.estimated-cost-concept'
            )
            ?.value
            ?.trim() || '',

        amount:
          normalizeMoneyText(
            row
              .querySelector(
                '.estimated-cost-amount'
              )
              ?.value || ''
          ),

        currency:
          row
            .querySelector(
              '.estimated-cost-currency'
            )
            ?.value || 'MXN'
      };
    })
    .filter(cost => {
      return (
        cost.concept ||
        numeric(cost.amount) > 0
      );
    });
}


/* =========================================================
   8. PREVISUALIZACIÓN DE PROYECCIÓN
   ========================================================= */

function updateProjectionPreview(
  root
) {
  const hectares =
    numeric(
      root
        .querySelector(
          '[name="hectares"]'
        )
        ?.value
    );

  const expectedYield =
    numeric(
      root
        .querySelector(
          '[name="expected_yield_boxes_ha"]'
        )
        ?.value
    );

  const pricePerBox =
    numeric(
      normalizeMoneyText(
        root
          .querySelector(
            '[name="price_per_box"]'
          )
          ?.value || ''
      )
    );

  const priceCurrency =
    root
      .querySelector(
        '[name="price_currency"]'
      )
      ?.value || 'USD';

  const projectedBoxes =
    hectares * expectedYield;

  const projectedSales =
    projectedBoxes * pricePerBox;

  const costs =
    collectEstimatedCosts(
      root
    );

  const totals =
    summarizeEstimatedCosts(
      costs
    );

  const production =
    root.querySelector(
      '#projectedProductionPreview'
    );

  const sales =
    root.querySelector(
      '#projectedSalesPreview'
    );

  const mxn =
    root.querySelector(
      '#otherCostsMxnPreview'
    );

  const usd =
    root.querySelector(
      '#otherCostsUsdPreview'
    );

  if (production) {
    production.textContent =
      `${number(projectedBoxes, 0)} cajas`;
  }

  if (sales) {
    sales.textContent =
      money(
        projectedSales,
        priceCurrency
      );
  }

  if (mxn) {
    mxn.textContent =
      money(
        totals.mxn,
        'MXN'
      );
  }

  if (usd) {
    usd.textContent =
      money(
        totals.usd,
        'USD'
      );
  }
}


/* =========================================================
   9. OPCIONES DE CLIENTES, PRODUCTOS Y ESTADO
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
   10. GENERADORES DE CAMPOS
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
   11. VALORES DEL PRODUCTO
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

        updateProjectionPreview(
          root
        );
      }
    );

  if (editing) {
    return;
  }
}


function setFieldValue(
  root,
  name,
  value
) {
  const field =
    root.querySelector(
      `[name="${name}"]`
    );

  if (field) {
    field.value = value;
  }
}


/* =========================================================
   12. RESUMEN DE COSTOS
   ========================================================= */

function summarizeEstimatedCosts(
  costs
) {
  return costs.reduce(
    (totals, cost) => {
      const amount =
        numeric(
          cost.amount
        );

      if (
        cost.currency === 'USD'
      ) {
        totals.usd += amount;
      } else {
        totals.mxn += amount;
      }

      return totals;
    },
    {
      mxn: 0,
      usd: 0
    }
  );
}


function estimatedCostSummaryHtml(
  totals
) {
  if (
    totals.mxn === 0 &&
    totals.usd === 0
  ) {
    return '—';
  }

  const values = [];

  if (totals.mxn > 0) {
    values.push(
      money(
        totals.mxn,
        'MXN'
      )
    );
  }

  if (totals.usd > 0) {
    values.push(
      money(
        totals.usd,
        'USD'
      )
    );
  }

  return values.join('<br>');
}


/* =========================================================
   13. FORMATO DE CAMPOS MONETARIOS
   ========================================================= */

function bindMoneyInputs(
  root
) {
  root
    .querySelectorAll(
      '.money-input'
    )
    .forEach(input => {
      if (
        input.dataset.moneyBound === '1'
      ) {
        return;
      }

      input.dataset.moneyBound = '1';

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
  return String(
    value || ''
  )
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

  const amount =
    Number(normalized);

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


/* =========================================================
   14. UTILIDADES
   ========================================================= */

function numeric(
  value
) {
  const result =
    Number(
      String(
        value ?? 0
      )
        .replaceAll(',', '')
    );

  return Number.isFinite(result)
    ? result
    : 0;
}
