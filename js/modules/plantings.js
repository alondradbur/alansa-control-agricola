/* =========================================================
   SISTEMA DE CONTROL AGRÍCOLA
   MÓDULO: SIEMBRAS / CONTRATOS

   Objetivo:
   - Registrar los datos base de cada siembra.
   - Construir la proyección productiva y comercial.
   - Presupuestar costos usando conceptos y unidades de Catálogo.
   - Mostrar resultados por hectárea y por siembra completa.
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
   2. ESTADO
   ========================================================= */

let rows = [];

let catalogs = {
  products: [],
  clients: [],
  expense_categories: [],
  expense_units: []
};


/* =========================================================
   3. RENDER PRINCIPAL
   ========================================================= */

export async function plantings() {
  try {
    const [
      plantingResponse,
      catalogResponse
    ] = await Promise.all([
      api('plantings'),
      api('catalogs')
    ]);

    rows =
      plantingResponse || [];

    catalogs = {
      products:
        catalogResponse?.products || [],
      clients:
        catalogResponse?.clients || [],
      expense_categories:
        catalogResponse?.expense_categories || [],
      expense_units:
        catalogResponse?.expense_units || []
    };

  } catch {
    rows = [];

    catalogs = {
      products: [],
      clients: [],
      expense_categories: [],
      expense_units: []
    };
  }

  const tableBody =
    rows.length
      ? rows
          .map(createRow)
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
      'Planeación productiva, comercial y de costos por contrato',
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
          <div>
            <strong>
              Siembras / contratos
            </strong>

            <div class="muted">
              Cada contrato identifica una siembra y alimenta
              la proyección del Dashboard.
            </div>
          </div>
        </div>

        <div class="table-scroll">

          <table>

            <thead>
              <tr>
                <th>Contrato</th>
                <th>Cliente</th>
                <th>Producto</th>
                <th>Hectáreas</th>
                <th>Rendimiento / ha</th>
                <th>Cajas proyectadas</th>
                <th>Ingreso proyectado</th>
                <th>Costos proyectados</th>
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
    numeric(
      row.projected_boxes
    ) ||
    (
      numeric(row.hectares) *
      numeric(
        row.expected_yield_boxes_ha
      )
    );

  const projectedRevenue =
    numeric(
      row.projected_revenue
    ) ||
    (
      projectedBoxes *
      numeric(
        row.price_per_box
      )
    );

  const costTotals =
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
        cajas
      </td>

      <td>
        ${number(
          projectedBoxes,
          0
        )}
      </td>

      <td>
        ${money(
          projectedRevenue,
          row.price_currency || 'USD'
        )}
      </td>

      <td>
        ${estimatedCostSummaryHtml(
          costTotals
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
   5. EVENTOS PRINCIPALES
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

          const contract =
            row?.contract_number ||
            'esta siembra';

          if (
            !confirm(
              `¿Eliminar la siembra del contrato "${contract}"?`
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
          .find(product => {
            return Number(product.id) ===
              Number(row.product_id);
          })
      : (
          catalogs.products
            .find(product => {
              return Number(
                product.is_default
              ) === 1;
            })
          ||
          catalogs.products[0]
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

      <div class="modal planting-modal">

        <div class="modal-head">

          <div>
            <h2>
              ${
                editing
                  ? `Editar contrato ${escapeHtml(
                      row.contract_number
                    )}`
                  : 'Nueva siembra'
              }
            </h2>

            <p class="muted">
              Registra la información de la siembra y construye
              su proyección completa antes de guardar.
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
          class="modal-body planting-form"
          id="plantingForm"
        >

          <input
            type="hidden"
            name="id"
            value="${row?.id || ''}"
          >


          ${formSection(
            '1',
            'Identificación de la siembra',
            'El contrato es el identificador operativo de esta siembra.',
            `
              <div class="form-grid">

                ${inputField(
                  'contract_number',
                  'Contrato',
                  row?.contract_number || '',
                  'text',
                  'required placeholder="Ej. 01"'
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

                <div class="field">
                  <label>
                    Tipo de cambio (MXN por USD)
                  </label>

                  <input
                    class="input money-input"
                    name="projection_exchange_rate"
                    id="projectionExchangeRate"
                    type="text"
                    inputmode="decimal"
                    autocomplete="off"
                    required
                    value="${escapeHtml(
                      formatMoneyText(
                        row?.projection_exchange_rate ?? ''
                      )
                    )}"
                    placeholder="Ej. 20.00"
                  >

                  <small class="muted">
                    Se utilizará en toda la proyección.
                  </small>
                </div>

              </div>
            `
          )}


          ${formSection(
            '2',
            'Superficie y establecimiento',
            'Estos datos determinan la escala de la siembra y los costos vinculados a hectáreas o millares de plantas.',
            `
              <div class="form-grid">

                ${inputField(
                  'hectares',
                  'Hectáreas',
                  row?.hectares ?? '',
                  'number',
                  'required min="0.01" step="0.01"'
                )}

                ${inputField(
                  'density_per_ha',
                  'Densidad de plantas / ha',
                  row?.density_per_ha ??
                    selectedProduct.default_density_per_ha ??
                    '',
                  'number',
                  'required min="1" step="1"'
                )}

                ${readonlyField(
                  'Plantas por hectárea',
                  'plantsPerHaPreview',
                  '0'
                )}

                ${readonlyField(
                  'Plantas totales',
                  'totalPlantsPreview',
                  '0'
                )}

              </div>
            `
          )}


          ${formSection(
            '3',
            'Proyección de producción',
            'Define el rendimiento esperado. El sistema calcula automáticamente la producción de toda la siembra.',
            `
              <div class="form-grid">

                ${inputField(
                  'expected_yield_boxes_ha',
                  'Rendimiento esperado (cajas / ha)',
                  row?.expected_yield_boxes_ha ?? '',
                  'number',
                  'required min="0" step="0.01"'
                )}

                ${inputField(
                  'standard_box_lbs',
                  'Peso estimado por caja (lb)',
                  row?.standard_box_lbs ??
                    selectedProduct.standard_box_lbs ??
                    12,
                  'number',
                  'required min="0.01" step="0.01"'
                )}

                ${readonlyField(
                  'Cajas proyectadas',
                  'projectedBoxesPreview',
                  '0'
                )}

                ${readonlyField(
                  'Libras proyectadas',
                  'projectedPoundsPreview',
                  '0'
                )}

              </div>
            `
          )}


          ${formSection(
            '4',
            'Comercialización proyectada',
            'El ingreso se calcula con la producción proyectada y el precio esperado por caja.',
            `
              <div class="form-grid">

                ${moneyField(
                  'price_per_box',
                  'Precio esperado por caja',
                  formatMoneyText(
                    row?.price_per_box ??
                    selectedProduct.default_price_per_box ??
                    0
                  )
                )}

                ${currencyField(
                  'price_currency',
                  'Moneda del ingreso',
                  row?.price_currency ||
                    selectedProduct.price_currency ||
                    'USD'
                )}

                ${readonlyField(
                  'Ingreso proyectado / ha',
                  'revenuePerHaPreview',
                  '—'
                )}

                ${readonlyField(
                  'Ingreso proyectado total',
                  'totalRevenuePreview',
                  '—'
                )}

              </div>
            `
          )}


          ${formSection(
            '5',
            'Periodo productivo',
            'Periodo estimado en el que se realizará la cosecha.',
            `
              <div class="form-grid">

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

              </div>
            `
          )}


          ${formSection(
            '6',
            'Costos proyectados',
            'Selecciona conceptos definidos en Catálogo. La cantidad se calcula automáticamente según la unidad seleccionada.',
            `
              <div class="planting-costs-head">

                <div class="muted">
                  Ejemplo: un costo por hectárea utilizará
                  automáticamente las hectáreas de este contrato.
                </div>

                <button
                  class="btn soft"
                  id="addEstimatedCost"
                  type="button"
                >
                  ＋ Agregar costo proyectado
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

              ${
                catalogs.expense_categories.length === 0
                  ? `
                      <div class="planting-form-notice">
                        Primero agrega conceptos en
                        Catálogo → Categorías de gastos.
                      </div>
                    `
                  : ''
              }

              ${
                catalogs.expense_units.length === 0
                  ? `
                      <div class="planting-form-notice">
                        Primero configura unidades de costo
                        en Catálogo.
                      </div>
                    `
                  : ''
              }

            `
          )}


          ${formSection(
            '7',
            'Resultado de la proyección',
            'Resumen por hectárea y de la siembra completa.',
            `
              <div class="planting-projection-table">
                <div class="projection-table-head">
                  <span>
                    Concepto
                  </span>

                  <span>
                    Por hectárea
                  </span>

                  <span>
                    Siembra completa
                  </span>
                </div>

                ${projectionGroup(
                  'Indicadores generales'
                )}

                ${projectionLine(
                  'Producción proyectada',
                  'summaryBoxesHa',
                  'summaryBoxesTotal'
                )}

                ${projectionLine(
                  'Libras proyectadas',
                  'summaryPoundsHa',
                  'summaryPoundsTotal'
                )}

                ${projectionGroup(
                  'Ingresos proyectados'
                )}

                ${projectionLine(
                  'Total en MXN',
                  'summaryRevenueMxnHa',
                  'summaryRevenueMxnTotal'
                )}

                ${projectionLine(
                  'Total en USD',
                  'summaryRevenueUsdHa',
                  'summaryRevenueUsdTotal'
                )}

                ${projectionGroup(
                  'Gastos proyectados'
                )}

                <div
                  class="projection-cost-detail"
                  id="projectionCostDetail"
                ></div>

                ${projectionLine(
                  'Total gastos en MXN',
                  'summaryConsolidatedCostMxnHa',
                  'summaryConsolidatedCostMxnTotal'
                )}

                ${projectionLine(
                  'Total gastos en USD',
                  'summaryConsolidatedCostHa',
                  'summaryConsolidatedCostTotal'
                )}

                ${projectionGroup(
                  'Utilidad proyectada'
                )}

                ${projectionLine(
                  'Utilidad en MXN',
                  'summaryProfitMxnHa',
                  'summaryProfitMxnTotal'
                )}

                ${projectionLine(
                  'Utilidad en USD',
                  'summaryProfitHa',
                  'summaryProfitTotal'
                )}
              </div>

              <p class="muted planting-projection-note">
                Todos los totales se convierten con el tipo de cambio
                definido al inicio de la siembra.
              </p>
            `
          )}


          ${formSection(
            '8',
            'Notas',
            'Información adicional de la siembra.',
            `
              <div class="field">
                <textarea
                  class="input"
                  name="notes"
                  rows="3"
                  placeholder="Notas opcionales"
                >${escapeHtml(
                  row?.notes || ''
                )}</textarea>
              </div>
            `
          )}


          <div class="modal-actions">

            <button
              class="btn"
              id="cancelPlanting"
              type="button"
            >
              Cancelar
            </button>

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
    modalRoot
  );

  bindEstimatedCosts(
    modalRoot
  );

  bindProjectionFields(
    modalRoot
  );

  updateProjectionPreview(
    modalRoot
  );

  const closeModal = () => {
    modalRoot.innerHTML = '';
  };

  modalRoot
    .querySelector(
      '#closePlantingModal'
    )
    ?.addEventListener(
      'click',
      closeModal
    );

  modalRoot
    .querySelector(
      '#cancelPlanting'
    )
    ?.addEventListener(
      'click',
      closeModal
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

        if (
          catalogs.products.length === 0
        ) {
          toast(
            'Primero agrega un producto en Catálogos.'
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
         * Columnas heredadas de la estructura anterior.
         * La proyección de costos ya no utiliza estos campos.
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

          closeModal();

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
   7. SECCIONES Y CAMPOS
   ========================================================= */

function formSection(
  numberValue,
  title,
  description,
  content
) {
  return `
    <section class="planting-form-section">

      <div class="planting-section-head">

        <div class="planting-section-number">
          ${numberValue}
        </div>

        <div>
          <h3>
            ${title}
          </h3>

          <p class="muted">
            ${description}
          </p>
        </div>

      </div>

      <div class="planting-section-body">
        ${content}
      </div>

    </section>
  `;
}


function readonlyField(
  label,
  id,
  value
) {
  return `
    <div class="field">

      <label>
        ${label}
      </label>

      <div
        class="input planting-readonly"
        id="${id}"
      >
        ${value}
      </div>

    </div>
  `;
}


function projectionGroup(
  label
) {
  return `
    <div class="projection-table-group">
      <strong>
        ${escapeHtml(label)}
      </strong>
    </div>
  `;
}


function projectionLine(
  label,
  perHaId,
  totalId
) {
  return `
    <div class="projection-table-row">
      <span>${label}</span>
      <strong id="${perHaId}">—</strong>
      <strong id="${totalId}">—</strong>
    </div>
  `;
}


/* =========================================================
   8. COSTOS PROYECTADOS
   ========================================================= */

function estimatedCostRows(
  costs
) {
  if (!costs.length) {
    return `
      <div
        class="planting-costs-empty"
        id="plantingCostsEmpty"
      >
        No hay costos proyectados agregados.
      </div>
    `;
  }

  return costs
    .map(estimatedCostRow)
    .join('');
}


function estimatedCostRow(
  cost = {}
) {
  const categoryId =
    Number(
      cost.category_id
    ) || '';

  const unitId =
    Number(
      cost.expense_unit_id
    ) || '';

  const unit =
    catalogs.expense_units
      .find(item => {
        return Number(item.id) ===
          Number(unitId);
      });

  const quantitySource =
    unit?.quantity_source ||
    cost.quantity_source ||
    'MANUAL';

  const legacy =
    !categoryId ||
    !unitId;

  return `
    <div class="planting-cost-row">

      <div class="field">
        <label>
          Concepto
        </label>

        ${
          legacy &&
          cost.concept
            ? `
                <select
                  class="input estimated-cost-category"
                >
                  <option value="">
                    ${escapeHtml(
                      cost.concept
                    )} — seleccionar del catálogo
                  </option>

                  ${expenseCategoryOptions(
                    ''
                  )}
                </select>
              `
            : `
                <select
                  class="input estimated-cost-category"
                >
                  <option value="">
                    Seleccionar concepto
                  </option>

                  ${expenseCategoryOptions(
                    categoryId
                  )}
                </select>
              `
        }
      </div>

      <div class="field">
        <label>
          Unidad
        </label>

        <select
          class="input estimated-cost-unit"
        >
          <option value="">
            Seleccionar unidad
          </option>

          ${expenseUnitOptions(
            unitId
          )}
        </select>
      </div>

      <div class="field">
        <label>
          Costo unitario
        </label>

        <input
          class="input money-input estimated-cost-unit-amount"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          value="${escapeHtml(
            formatMoneyText(
              cost.unit_amount ??
              cost.amount ??
              ''
            )
          )}"
          placeholder="0.00"
        >
      </div>

      <div class="field">
        <label>
          Cantidad
        </label>

        <input
          class="input estimated-cost-quantity"
          type="number"
          min="0.0001"
          step="0.0001"
          value="${escapeHtml(
            cost.quantity ?? ''
          )}"
          ${
            quantitySource === 'MANUAL'
              ? ''
              : 'readonly'
          }
        >

        <small class="muted estimated-cost-rule">
          ${quantitySourceLabel(
            quantitySource
          )}
        </small>
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

      <div class="field">
        <label>
          Total proyectado
        </label>

        <div class="input planting-readonly estimated-cost-total">
          ${money(
            numeric(cost.amount),
            cost.currency || 'MXN'
          )}
        </div>
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
        if (
          catalogs.expense_categories.length === 0
        ) {
          toast(
            'Primero agrega conceptos de gasto en Catálogos.'
          );

          return;
        }

        if (
          catalogs.expense_units.length === 0
        ) {
          toast(
            'Primero configura unidades de costo en Catálogos.'
          );

          return;
        }

        list
          ?.querySelector(
            '#plantingCostsEmpty'
          )
          ?.remove();

        list?.insertAdjacentHTML(
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
            '.estimated-cost-category'
          )
          ?.focus();

        updateProjectionPreview(
          root
        );
      }
    );

  list
    ?.querySelectorAll(
      '.planting-cost-row'
    )
    .forEach(costRow => {
      bindEstimatedCostRow(
        costRow,
        root
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

        ensureCostsEmptyState(
          root
        );

        updateProjectionPreview(
          root
        );
      }
    );

  row
    ?.querySelector(
      '.estimated-cost-unit'
    )
    ?.addEventListener(
      'change',
      () => {
        updateCostRow(
          row,
          root
        );

        updateProjectionPreview(
          root
        );
      }
    );

  row
    ?.querySelectorAll(
      '.estimated-cost-category, .estimated-cost-unit-amount, .estimated-cost-quantity, .estimated-cost-currency'
    )
    .forEach(field => {
      field.addEventListener(
        'input',
        () => {
          updateCostRow(
            row,
            root
          );

          updateProjectionPreview(
            root
          );
        }
      );

      field.addEventListener(
        'change',
        () => {
          updateCostRow(
            row,
            root
          );

          updateProjectionPreview(
            root
          );
        }
      );
    });

  bindMoneyInputs(
    row
  );

  updateCostRow(
    row,
    root
  );
}


function updateCostRow(
  row,
  root
) {
  if (!row) {
    return;
  }

  const unitId =
    Number(
      row
        .querySelector(
          '.estimated-cost-unit'
        )
        ?.value
    );

  const unit =
    catalogs.expense_units
      .find(item => {
        return Number(item.id) ===
          unitId;
      });

  const source =
    unit?.quantity_source ||
    'MANUAL';

  const quantityInput =
    row.querySelector(
      '.estimated-cost-quantity'
    );

  const rule =
    row.querySelector(
      '.estimated-cost-rule'
    );

  if (quantityInput) {
    if (source === 'MANUAL') {
      quantityInput.readOnly = false;

    } else {
      quantityInput.readOnly = true;

      quantityInput.value =
        calculatedQuantity(
          source,
          root
        );
    }
  }

  if (rule) {
    rule.textContent =
      quantitySourceLabel(
        source
      );
  }

  const unitAmount =
    numeric(
      normalizeMoneyText(
        row
          .querySelector(
            '.estimated-cost-unit-amount'
          )
          ?.value || ''
      )
    );

  const quantity =
    numeric(
      quantityInput?.value
    );

  const currency =
    row
      .querySelector(
        '.estimated-cost-currency'
      )
      ?.value || 'MXN';

  updateExchangeRateVisibility(
    root
  );

  const total =
    unitAmount * quantity;

  const totalElement =
    row.querySelector(
      '.estimated-cost-total'
    );

  if (totalElement) {
    totalElement.textContent =
      money(
        total,
        currency
      );
  }
}


function updateExchangeRateVisibility(
  root
) {
  const field =
    root.querySelector(
      '[name="projection_exchange_rate"]'
    );

  if (field) {
    field.required = true;
  }
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
        category_id:
          Number(
            row
              .querySelector(
                '.estimated-cost-category'
              )
              ?.value
          ) || null,

        expense_unit_id:
          Number(
            row
              .querySelector(
                '.estimated-cost-unit'
              )
              ?.value
          ) || null,

        unit_amount:
          normalizeMoneyText(
            row
              .querySelector(
                '.estimated-cost-unit-amount'
              )
              ?.value || ''
          ),

        quantity:
          numeric(
            row
              .querySelector(
                '.estimated-cost-quantity'
              )
              ?.value
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
        cost.category_id ||
        cost.expense_unit_id ||
        numeric(
          cost.unit_amount
        ) > 0
      );
    });
}


function ensureCostsEmptyState(
  root
) {
  const list =
    root.querySelector(
      '#estimatedCostsList'
    );

  if (
    list &&
    !list.querySelector(
      '.planting-cost-row'
    )
  ) {
    list.innerHTML = `
      <div
        class="planting-costs-empty"
        id="plantingCostsEmpty"
      >
        No hay costos proyectados agregados.
      </div>
    `;
  }
}


/* =========================================================
   9. CÁLCULOS DE PROYECCIÓN
   ========================================================= */

function bindProjectionFields(
  root
) {
  [
    'hectares',
    'density_per_ha',
    'expected_yield_boxes_ha',
    'standard_box_lbs',
    'price_per_box',
    'price_currency',
    'projection_exchange_rate'
  ].forEach(name => {
    const field =
      root.querySelector(
        `[name="${name}"]`
      );

    field?.addEventListener(
      'input',
      () => {
        refreshCalculatedCostQuantities(
          root
        );

        updateProjectionPreview(
          root
        );
      }
    );

    field?.addEventListener(
      'change',
      () => {
        refreshCalculatedCostQuantities(
          root
        );

        updateProjectionPreview(
          root
        );
      }
    );
  });
}


function projectionValues(
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

  const density =
    numeric(
      root
        .querySelector(
          '[name="density_per_ha"]'
        )
        ?.value
    );

  const yieldPerHa =
    numeric(
      root
        .querySelector(
          '[name="expected_yield_boxes_ha"]'
        )
        ?.value
    );

  const boxLbs =
    numeric(
      root
        .querySelector(
          '[name="standard_box_lbs"]'
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

  const currency =
    root
      .querySelector(
        '[name="price_currency"]'
      )
      ?.value || 'USD';

  const exchangeRate =
    numeric(
      normalizeMoneyText(
        root
          .querySelector(
            '[name="projection_exchange_rate"]'
          )
          ?.value || ''
      )
    );

  const totalPlants =
    hectares * density;

  const projectedBoxes =
    hectares * yieldPerHa;

  const projectedPounds =
    projectedBoxes * boxLbs;

  const revenuePerHa =
    yieldPerHa * pricePerBox;

  const totalRevenue =
    projectedBoxes * pricePerBox;

  return {
    hectares,
    density,
    yieldPerHa,
    boxLbs,
    pricePerBox,
    currency,
    exchangeRate,
    totalPlants,
    projectedBoxes,
    projectedPounds,
    revenuePerHa,
    totalRevenue
  };
}


function calculatedQuantity(
  source,
  root
) {
  const values =
    projectionValues(
      root
    );

  switch (source) {
    case 'ONE':
      return 1;

    case 'HECTARES':
      return values.hectares;

    case 'PROJECTED_BOXES':
      return values.projectedBoxes;

    case 'PROJECTED_POUNDS':
      return values.projectedPounds;

    case 'THOUSAND_PLANTS':
      return values.totalPlants / 1000;

    default:
      return 0;
  }
}


function refreshCalculatedCostQuantities(
  root
) {
  root
    .querySelectorAll(
      '.planting-cost-row'
    )
    .forEach(row => {
      updateCostRow(
        row,
        root
      );
    });
}


function renderProjectionCostDetail(
  root,
  hectares
) {
  const container =
    root.querySelector(
      '#projectionCostDetail'
    );

  if (!container) {
    return;
  }

  const rows =
    Array.from(
      root.querySelectorAll(
        '.planting-cost-row'
      )
    );

  if (rows.length === 0) {
    container.innerHTML = `
      <div class="projection-table-row projection-cost-empty">
        <span>
          Sin gastos proyectados
        </span>
        <span>—</span>
        <span>—</span>
      </div>
    `;

    return;
  }

  container.innerHTML =
    rows.map(row => {
      const categorySelect =
        row.querySelector(
          '.estimated-cost-category'
        );

      const selectedCategory =
        categorySelect
          ?.options[
            categorySelect.selectedIndex
          ];

      const concept =
        selectedCategory?.value
          ? selectedCategory.textContent.trim()
          : (
              selectedCategory?.textContent
                ?.split('—')[0]
                ?.trim() ||
              'Gasto proyectado'
            );

      const currency =
        row.querySelector(
          '.estimated-cost-currency'
        )?.value || 'MXN';

      const unitAmount =
        numeric(
          normalizeMoneyText(
            row.querySelector(
              '.estimated-cost-unit-amount'
            )?.value || ''
          )
        );

      const quantity =
        numeric(
          row.querySelector(
            '.estimated-cost-quantity'
          )?.value
        );

      const total =
        unitAmount * quantity;

      const perHa =
        hectares > 0
          ? total / hectares
          : 0;

      return `
        <div class="projection-table-row projection-cost-line">
          <span>
            ${escapeHtml(concept)}
          </span>

          <span>
            ${money(
              perHa,
              currency
            )}
          </span>

          <span>
            ${money(
              total,
              currency
            )}
          </span>
        </div>
      `;
    }).join('');
}


function updateProjectionPreview(
  root
) {
  const values =
    projectionValues(
      root
    );

  setText(
    root,
    '#plantsPerHaPreview',
    number(
      values.density,
      0
    )
  );

  setText(
    root,
    '#totalPlantsPreview',
    number(
      values.totalPlants,
      0
    )
  );

  setText(
    root,
    '#projectedBoxesPreview',
    `${number(
      values.projectedBoxes,
      0
    )} cajas`
  );

  setText(
    root,
    '#projectedPoundsPreview',
    `${number(
      values.projectedPounds,
      0
    )} lb`
  );

  setText(
    root,
    '#revenuePerHaPreview',
    money(
      values.revenuePerHa,
      values.currency
    )
  );

  setText(
    root,
    '#totalRevenuePreview',
    money(
      values.totalRevenue,
      values.currency
    )
  );

  const costs =
    collectEstimatedCosts(
      root
    );

  const totals =
    summarizeEstimatedCosts(
      costs.map(cost => {
        return {
          ...cost,
          amount:
            numeric(
              cost.unit_amount
            ) *
            numeric(
              cost.quantity
            )
        };
      })
    );

  const hectares =
    values.hectares;

  renderProjectionCostDetail(
    root,
    hectares
  );

  const exchangeRate =
    values.exchangeRate;

  const convertedMxnUsd =
    exchangeRate > 0
      ? totals.mxn /
        exchangeRate
      : 0;

  const consolidatedCostUsd =
    totals.usd +
    convertedMxnUsd;

  const revenueUsd =
    values.currency === 'MXN'
      ? (
          exchangeRate > 0
            ? values.totalRevenue /
              exchangeRate
            : 0
        )
      : values.totalRevenue;

  const revenueUsdPerHa =
    hectares > 0
      ? revenueUsd /
        hectares
      : 0;

  const projectedProfitUsd =
    revenueUsd -
    consolidatedCostUsd;

  const revenueMxn =
    exchangeRate > 0
      ? revenueUsd *
        exchangeRate
      : (
          values.currency === 'MXN'
            ? values.totalRevenue
            : 0
        );

  const consolidatedCostMxn =
    exchangeRate > 0
      ? consolidatedCostUsd *
        exchangeRate
      : totals.mxn;

  const projectedProfitMxn =
    revenueMxn -
    consolidatedCostMxn;

  const projectedProfitUsdPerHa =
    hectares > 0
      ? projectedProfitUsd /
        hectares
      : 0;

  updateExchangeRateVisibility(
    root
  );

  setText(
    root,
    '#summaryBoxesHa',
    `${number(
      values.yieldPerHa,
      0
    )} cajas`
  );

  setText(
    root,
    '#summaryBoxesTotal',
    `${number(
      values.projectedBoxes,
      0
    )} cajas`
  );

  setText(
    root,
    '#summaryPoundsHa',
    `${number(
      values.yieldPerHa *
      values.boxLbs,
      0
    )} lb`
  );

  setText(
    root,
    '#summaryPoundsTotal',
    `${number(
      values.projectedPounds,
      0
    )} lb`
  );

  setText(
    root,
    '#summaryRevenueUsdHa',
    money(
      hectares > 0
        ? revenueUsd / hectares
        : 0,
      'USD'
    )
  );

  setText(
    root,
    '#summaryRevenueUsdTotal',
    money(
      revenueUsd,
      'USD'
    )
  );

  setText(
    root,
    '#summaryRevenueMxnHa',
    money(
      hectares > 0
        ? revenueMxn / hectares
        : 0,
      'MXN'
    )
  );

  setText(
    root,
    '#summaryRevenueMxnTotal',
    money(
      revenueMxn,
      'MXN'
    )
  );

  setText(
    root,
    '#summaryConsolidatedCostHa',
    money(
      hectares > 0
        ? consolidatedCostUsd / hectares
        : 0,
      'USD'
    )
  );

  setText(
    root,
    '#summaryConsolidatedCostTotal',
    money(
      consolidatedCostUsd,
      'USD'
    )
  );

  setText(
    root,
    '#summaryConsolidatedCostMxnHa',
    money(
      hectares > 0
        ? consolidatedCostMxn / hectares
        : 0,
      'MXN'
    )
  );

  setText(
    root,
    '#summaryConsolidatedCostMxnTotal',
    money(
      consolidatedCostMxn,
      'MXN'
    )
  );

  setText(
    root,
    '#summaryProfitHa',
    money(
      projectedProfitUsdPerHa,
      'USD'
    )
  );

  setText(
    root,
    '#summaryProfitTotal',
    money(
      projectedProfitUsd,
      'USD'
    )
  );

  setText(
    root,
    '#summaryProfitMxnHa',
    money(
      hectares > 0
        ? projectedProfitMxn / hectares
        : 0,
      'MXN'
    )
  );

  setText(
    root,
    '#summaryProfitMxnTotal',
    money(
      projectedProfitMxn,
      'MXN'
    )
  );

}


/* =========================================================
   10. OPCIONES DE CATÁLOGO
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


function expenseCategoryOptions(
  selectedId
) {
  return catalogs.expense_categories
    .map(category => {
      const selected =
        Number(category.id) ===
        Number(selectedId);

      return `
        <option
          value="${category.id}"
          ${selected ? 'selected' : ''}
        >
          ${escapeHtml(
            category.name
          )}
        </option>
      `;
    })
    .join('');
}


function expenseUnitOptions(
  selectedId
) {
  return catalogs.expense_units
    .map(unit => {
      const selected =
        Number(unit.id) ===
        Number(selectedId);

      return `
        <option
          value="${unit.id}"
          ${selected ? 'selected' : ''}
        >
          ${escapeHtml(
            unit.name
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
   11. CAMPOS GENÉRICOS
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
   12. VALORES PREDETERMINADOS DEL PRODUCTO
   ========================================================= */

function bindProductDefaults(
  root
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

        refreshCalculatedCostQuantities(
          root
        );

        updateProjectionPreview(
          root
        );
      }
    );
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
   13. RESUMEN Y REGLAS DE COSTOS
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


function quantitySourceLabel(
  source
) {
  const labels = {
    ONE:
      'Cantidad automática: 1',
    HECTARES:
      'Cantidad automática: hectáreas',
    PROJECTED_BOXES:
      'Cantidad automática: cajas proyectadas',
    PROJECTED_POUNDS:
      'Cantidad automática: libras proyectadas',
    THOUSAND_PLANTS:
      'Cantidad automática: millares de plantas',
    MANUAL:
      'Cantidad capturada manualmente'
  };

  return labels[source] ||
    'Cantidad capturada manualmente';
}


/* =========================================================
   14. FORMATO DE DINERO
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
   15. UTILIDADES
   ========================================================= */

function setText(
  root,
  selector,
  value
) {
  const element =
    root.querySelector(
      selector
    );

  if (element) {
    element.textContent =
      value;
  }
}


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
