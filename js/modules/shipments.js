import { api } from '../core/api.js';

import {
  money,
  date,
  number,
  escapeHtml
} from '../core/format.js';

import {
  moduleHeader,
  empty,
  toast
} from '../components/common.js';


/* =========================================================
   ALANSA - REMISIONES
   ========================================================= */

let shipmentRows = [];
let shipmentFormData = {
  plantings: [],
  clients: [],
  products: []
};

let shipmentFilters = {
  from: '',
  to: '',
  status: '',
  product: '',
  search: ''
};

let editingShipment = null;


/* =========================================================
   1. VISTA PRINCIPAL
   ========================================================= */

export async function shipments() {
  await loadShipments();

  return `
    ${moduleHeader(
      'Remisiones',
      'Control de embarques, folios y vencimientos',
      `
        <div class="shipment-header-actions">
          <button
            class="btn"
            id="exportShipmentsExcel"
            type="button"
          >
            Descargar Excel
          </button>

          <button
            class="btn primary"
            id="newShipment"
            type="button"
          >
            ＋ Nueva remisión
          </button>
        </div>
      `
    )}

    <div class="content shipments-v2-content">

      ${filtersHtml()}

      <section class="card table-card shipments-table-card">

        <div class="table-toolbar">
          <div>
            <strong>
              Remisiones registradas
            </strong>

            <span
              class="shipments-table-count"
              id="shipmentCount"
            ></span>
          </div>
        </div>

        <div id="shipmentsTableArea">
          ${tableAreaHtml()}
        </div>

      </section>

    </div>

    <div id="shipmentModalRoot"></div>
  `;
}


/* =========================================================
   2. EVENTOS
   ========================================================= */

export function bindShipments() {
  document
    .querySelector('#newShipment')
    ?.addEventListener(
      'click',
      async () => {
        await openShipmentForm();
      }
    );

  document
    .querySelector(
      '#exportShipmentsExcel'
    )
    ?.addEventListener(
      'click',
      exportShipmentsExcel
    );

  [
    'shipmentFilterFrom',
    'shipmentFilterTo',
    'shipmentFilterStatus',
    'shipmentFilterProduct'
  ].forEach(id => {
    document
      .getElementById(id)
      ?.addEventListener(
        'change',
        readAndRenderFilters
      );
  });

  document
    .getElementById(
      'shipmentFilterSearch'
    )
    ?.addEventListener(
      'input',
      readAndRenderFilters
    );

  document
    .getElementById(
      'clearShipmentFilters'
    )
    ?.addEventListener(
      'click',
      () => {
        shipmentFilters = {
          from: '',
          to: '',
          status: '',
          product: '',
          search: ''
        };

        [
          'shipmentFilterFrom',
          'shipmentFilterTo',
          'shipmentFilterStatus',
          'shipmentFilterProduct',
          'shipmentFilterSearch'
        ].forEach(id => {
          const field =
            document.getElementById(id);

          if (field) {
            field.value = '';
          }
        });

        renderTableArea();
      }
    );

  bindRowActions();
}


/* =========================================================
   3. CARGA DE DATOS
   ========================================================= */

async function loadShipments() {
  try {
    shipmentRows =
      await api('shipments') || [];
  } catch {
    shipmentRows = [];
  }
}


async function loadFormData() {
  try {

    const [
      plantings,
      catalogs
    ] = await Promise.all([
      api('plantings'),
      api('catalogs')
    ]);

    const clients =
      catalogs?.clients || [];

    const products =
      catalogs?.products || [];

    /*
     * Enriquecemos cada siembra con los datos
     * necesarios para Remisiones.
     */
    const normalizedPlantings =
      (plantings || []).map(
        planting => {

          const client =
            clients.find(
              item =>
                Number(item.id) ===
                Number(planting.client_id)
            );

          const product =
            products.find(
              item =>
                Number(item.id) ===
                Number(planting.product_id)
            );

          return {
            ...planting,

            client_name:
              planting.client_name ||
              client?.name ||
              '',

            credit_days:
              Number(
                planting.credit_days ??
                client?.credit_days ??
                0
              ),

            product_name:
              planting.product_name ||
              product?.name ||
              ''
          };

        }
      );

    shipmentFormData = {
      plantings:
        normalizedPlantings,

      clients,

      products
    };

  } catch (error) {

    console.error(
      'Error cargando datos de remisión:',
      error
    );

    shipmentFormData = {
      plantings: [],
      clients: [],
      products: []
    };

  }
}

/* =========================================================
   4. FILTROS
   ========================================================= */

function filtersHtml() {
  return `
    <section class="card filters shipments-v2-filters">

      <div class="field">
        <label>Desde</label>

        <input
          class="input"
          id="shipmentFilterFrom"
          type="date"
          value="${escapeHtml(
            shipmentFilters.from
          )}"
        >
      </div>

      <div class="field">
        <label>Hasta</label>

        <input
          class="input"
          id="shipmentFilterTo"
          type="date"
          value="${escapeHtml(
            shipmentFilters.to
          )}"
        >
      </div>

      <div class="field">
        <label>Estado</label>

        <select
          class="input"
          id="shipmentFilterStatus"
        >
          <option value="">
            Todos
          </option>

          <option
            value="Emitida"
            ${shipmentFilters.status ===
              'Emitida'
                ? 'selected'
                : ''}
          >
            Emitida
          </option>

          <option
            value="Parcial"
            ${shipmentFilters.status ===
              'Parcial'
                ? 'selected'
                : ''}
          >
            Parcial
          </option>

          <option
            value="Cobrada"
            ${shipmentFilters.status ===
              'Cobrada'
                ? 'selected'
                : ''}
          >
            Cobrada
          </option>
        </select>
      </div>

      <div class="field">
        <label>Producto</label>

        <select
          class="input"
          id="shipmentFilterProduct"
        >
          <option value="">
            Todos
          </option>

          ${productFilterOptions()}
        </select>
      </div>

      <div class="field shipments-search-field">
        <label>Buscar</label>

        <input
          class="input"
          id="shipmentFilterSearch"
          type="search"
          placeholder="Folio, cliente o contrato..."
          value="${escapeHtml(
            shipmentFilters.search
          )}"
        >
      </div>

      <button
        class="btn"
        id="clearShipmentFilters"
        type="button"
      >
        Limpiar filtros
      </button>

    </section>
  `;
}


function readAndRenderFilters() {
  shipmentFilters = {
    from:
      document
        .getElementById(
          'shipmentFilterFrom'
        )
        ?.value || '',

    to:
      document
        .getElementById(
          'shipmentFilterTo'
        )
        ?.value || '',

    status:
      document
        .getElementById(
          'shipmentFilterStatus'
        )
        ?.value || '',

    product:
      document
        .getElementById(
          'shipmentFilterProduct'
        )
        ?.value || '',

    search:
      document
        .getElementById(
          'shipmentFilterSearch'
        )
        ?.value || ''
  };

  renderTableArea();
}


function filteredRows() {
  const search =
    shipmentFilters.search
      .trim()
      .toLowerCase();

  return shipmentRows.filter(row => {
    const shipmentDate =
      String(
        row.shipment_date || ''
      ).slice(0, 10);

    if (
      shipmentFilters.from &&
      shipmentDate <
        shipmentFilters.from
    ) {
      return false;
    }

    if (
      shipmentFilters.to &&
      shipmentDate >
        shipmentFilters.to
    ) {
      return false;
    }

    if (
      shipmentFilters.status &&
      financialStatus(row) !==
        shipmentFilters.status
    ) {
      return false;
    }

    if (
      shipmentFilters.product &&
      !String(
        row.product_names || ''
      )
        .split(',')
        .map(value =>
          value.trim()
        )
        .includes(
          shipmentFilters.product
        )
    ) {
      return false;
    }

    if (search) {
      const haystack = [
        row.folio,
        row.client_name,
        row.contract_number,
        row.product_names
      ]
        .join(' ')
        .toLowerCase();

      if (
        !haystack.includes(search)
      ) {
        return false;
      }
    }

    return true;
  });
}


/* =========================================================
   5. TABLA
   ========================================================= */

function tableAreaHtml() {
  const rows =
    filteredRows();

  if (!rows.length) {
    return `
      <div class="shipments-empty">
        ${empty()}
      </div>
    `;
  }

  return `
    <div class="table-scroll shipments-v2-scroll">

      <table class="shipments-v2-table">

        <thead>
          <tr>
            <th>Folio</th>
            <th>Fecha</th>
            <th>Contrato</th>
            <th>Cliente</th>
            <th>Producto(s)</th>
            <th>Cajas</th>
            <th>Libras</th>
            <th>Total MXN</th>
            <th>Total USD</th>
            <th>Vencimiento</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          ${rows
            .map(tableRowHtml)
            .join('')}
        </tbody>

      </table>

    </div>
  `;
}


function tableRowHtml(row) {
  const totals =
    bothCurrencies(row);

  return `
    <tr>
      <td>
        <strong>
          ${escapeHtml(
            row.folio
          )}
        </strong>
      </td>

      <td>
        ${safeDate(
          row.shipment_date
        )}
      </td>

      <td>
        ${escapeHtml(
          row.contract_number || '—'
        )}
      </td>

      <td>
        ${escapeHtml(
          row.client_name || '—'
        )}
      </td>

      <td>
        ${escapeHtml(
          row.product_names || '—'
        )}
      </td>

      <td>
        ${number(
          row.total_boxes,
          0
        )}
      </td>

      <td>
        ${number(
          row.total_pounds,
          2
        )}
      </td>

      <td>
        ${money(
          totals.mxn,
          'MXN'
        )}
      </td>

      <td>
        ${money(
          totals.usd,
          'USD'
        )}
      </td>

      <td>
        ${safeDate(
          row.due_date
        )}
      </td>

      <td>
        ${statusBadge(
          financialStatus(row)
        )}
      </td>

      <td>
        <div class="shipment-row-actions">

          <button
            class="btn shipment-pdf"
            data-id="${row.id}"
            type="button"
          >
            PDF
          </button>

          <button
            class="btn shipment-edit"
            data-id="${row.id}"
            type="button"
          >
            Editar
          </button>

          <button
            class="btn danger shipment-delete"
            data-id="${row.id}"
            data-folio="${escapeHtml(
              row.folio
            )}"
            type="button"
          >
            Eliminar
          </button>

        </div>
      </td>
    </tr>
  `;
}


function renderTableArea() {
  const area =
    document.getElementById(
      'shipmentsTableArea'
    );

  if (area) {
    area.innerHTML =
      tableAreaHtml();
  }

  const count =
    document.getElementById(
      'shipmentCount'
    );

  if (count) {
    count.textContent =
      `${filteredRows().length} registro(s)`;
  }

  bindRowActions();
}


/* =========================================================
   6. ACCIONES DE TABLA
   ========================================================= */

function bindRowActions() {
  document
    .querySelectorAll(
      '.shipment-edit'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        async () => {
          await openShipmentForm(
            Number(
              button.dataset.id
            )
          );
        }
      );
    });

  document
    .querySelectorAll(
      '.shipment-delete'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        async () => {
          await deleteShipment(
            Number(
              button.dataset.id
            ),
            button.dataset.folio
          );
        }
      );
    });

  document
    .querySelectorAll(
      '.shipment-pdf'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        async () => {
          await printShipmentPdf(
            Number(
              button.dataset.id
            )
          );
        }
      );
    });
}


/* =========================================================
   7. FORMULARIO
   ========================================================= */

async function openShipmentForm(id = 0) {
  await loadFormData();

  editingShipment = null;

  if (id) {
    try {
      editingShipment =
        await api(
          `shipments?id=${id}`
        );
    } catch {
      toast(
        'No fue posible cargar la remisión.'
      );

      return;
    }
  }

  const root =
    document.getElementById(
      'shipmentModalRoot'
    );

  if (!root) {
    return;
  }

  root.innerHTML =
    shipmentModalHtml();

  bindShipmentForm();

  syncPlantingDefaults(
    !editingShipment
  );

  recalculateShipment();
}


function shipmentModalHtml() {
  const current =
    editingShipment || {};

  const defaultPlanting =
    current.planting_id ||
    preferredPlantingId();

  const lines =
    current.lines?.length
      ? current.lines
      : [
          defaultLine(
            defaultPlanting
          )
        ];

  return `
    <div class="shipment-modal-backdrop">

      <section class="shipment-modal card">

        <div class="shipment-modal-head">

          <div>
            <span>
              ${editingShipment
                ? escapeHtml(
                    editingShipment.folio
                  )
                : 'Nueva remisión'}
            </span>

            <h2>
              ${editingShipment
                ? 'Editar remisión'
                : 'Registrar remisión'}
            </h2>
          </div>

          <button
            class="btn"
            id="closeShipmentModal"
            type="button"
          >
            Cerrar
          </button>

        </div>

        <form id="shipmentForm">

          <div class="shipment-form-grid">

            <div class="field">
              <label>
                Siembra / contrato
              </label>

              <select
                class="input"
                id="shipmentPlanting"
                required
              >
                ${plantingFormOptions(
                  defaultPlanting
                )}
              </select>
            </div>

            <div class="field">
              <label>
                Cliente
              </label>

              <input
                class="input"
                id="shipmentClientName"
                type="text"
                readonly
              >
            </div>

            <div class="field">
              <label>
                Fecha de remisión
              </label>

              <input
                class="input"
                id="shipmentDate"
                type="date"
                value="${escapeHtml(
                  current.shipment_date ||
                  todayIso()
                )}"
                required
              >
            </div>

            <div class="field">
              <label>
                Días de crédito
              </label>

              <input
                class="input"
                id="shipmentCreditDays"
                type="text"
                readonly
              >
            </div>

            <div class="field">
              <label>
                Fecha de vencimiento
              </label>

              <input
                class="input"
                id="shipmentDueDate"
                type="date"
                readonly
              >
            </div>

            <div class="field">
              <label>
                Moneda
              </label>

              <select
                class="input"
                id="shipmentCurrency"
                required
              >
                <option
                  value="USD"
                  ${(current.currency ||
                    plantingById(
                      defaultPlanting
                    )?.price_currency) !==
                    'MXN'
                      ? 'selected'
                      : ''}
                >
                  USD
                </option>

                <option
                  value="MXN"
                  ${(current.currency ||
                    plantingById(
                      defaultPlanting
                    )?.price_currency) ===
                    'MXN'
                      ? 'selected'
                      : ''}
                >
                  MXN
                </option>
              </select>
            </div>

            <div class="field">
              <label>
                Tipo de cambio
                <small>
                  MXN por 1 USD
                </small>
              </label>

              <input
                class="input money-input"
                id="shipmentExchangeRate"
                type="text"
                inputmode="decimal"
                value="${formatInputMoney(
                  current.exchange_rate ||
                  plantingById(
                    defaultPlanting
                  )?.projection_exchange_rate ||
                  0
                )}"
                required
              >
            </div>

          </div>

          <div class="shipment-lines-head">
            <div>
              <strong>
                Detalle de la remisión
              </strong>

              <span>
                Puedes agregar varias líneas.
              </span>
            </div>

            <button
              class="btn"
              id="addShipmentLine"
              type="button"
            >
              ＋ Agregar línea
            </button>
          </div>

          <div class="shipment-lines-scroll">

            <table class="shipment-lines-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cajas</th>
                  <th>Lb/caja</th>
                  <th>Libras</th>
                  <th>Precio/caja</th>
                  <th>Importe</th>
                  <th></th>
                </tr>
              </thead>

              <tbody id="shipmentLinesBody">
                ${lines
                  .map(lineFormHtml)
                  .join('')}
              </tbody>
            </table>

          </div>

          <div class="shipment-form-bottom">

            <div class="field shipment-notes-field">
              <label>
                Notas
              </label>

              <textarea
                class="input"
                id="shipmentNotes"
                rows="4"
                placeholder="Observaciones opcionales..."
              >${escapeHtml(
                current.notes || ''
              )}</textarea>
            </div>

            <div class="shipment-totals">

              <div>
                <span>
                  Total cajas
                </span>

                <strong id="shipmentTotalBoxes">
                  0
                </strong>
              </div>

              <div>
                <span>
                  Total libras
                </span>

                <strong id="shipmentTotalPounds">
                  0
                </strong>
              </div>

              <div>
                <span>
                  Total remisión
                </span>

                <strong id="shipmentTotalOriginal">
                  $0.00
                </strong>
              </div>

              <div>
                <span>
                  Equivalente MXN
                </span>

                <strong id="shipmentTotalMxn">
                  $0.00
                </strong>
              </div>

              <div>
                <span>
                  Equivalente USD
                </span>

                <strong id="shipmentTotalUsd">
                  $0.00
                </strong>
              </div>

            </div>

          </div>

          <div class="shipment-modal-actions">

            <button
              class="btn"
              id="cancelShipment"
              type="button"
            >
              Cancelar
            </button>

            <button
              class="btn primary"
              type="submit"
            >
              ${editingShipment
                ? 'Guardar cambios'
                : 'Guardar remisión'}
            </button>

          </div>

        </form>

      </section>

    </div>
  `;
}


/* =========================================================
   8. EVENTOS DEL FORMULARIO
   ========================================================= */

function bindShipmentForm() {
  document
    .getElementById(
      'closeShipmentModal'
    )
    ?.addEventListener(
      'click',
      closeShipmentModal
    );

  document
    .getElementById(
      'cancelShipment'
    )
    ?.addEventListener(
      'click',
      closeShipmentModal
    );

  document
    .getElementById(
      'shipmentPlanting'
    )
    ?.addEventListener(
      'change',
      () => {
        syncPlantingDefaults(
          true
        );

        recalculateShipment();
      }
    );

  document
    .getElementById(
      'shipmentDate'
    )
    ?.addEventListener(
      'change',
      updateDueDate
    );

  document
    .getElementById(
      'shipmentCurrency'
    )
    ?.addEventListener(
      'change',
      recalculateShipment
    );

  document
    .getElementById(
      'shipmentExchangeRate'
    )
    ?.addEventListener(
      'input',
      event => {
        normalizeMoneyInput(
          event.target
        );

        recalculateShipment();
      }
    );

  document
    .getElementById(
      'addShipmentLine'
    )
    ?.addEventListener(
      'click',
      addShipmentLine
    );

  document
    .getElementById(
      'shipmentForm'
    )
    ?.addEventListener(
      'submit',
      saveShipment
    );

  bindLineEvents();
}


function bindLineEvents() {
  document
    .querySelectorAll(
      '.shipment-line-product'
    )
    .forEach(field => {
      field.onchange =
        event => {
          const row =
            event.target.closest(
              'tr'
            );

          applyProductDefaults(
            row
          );

          recalculateShipment();
        };
    });

  document
    .querySelectorAll(
      '.shipment-line-money'
    )
    .forEach(field => {
      field.oninput =
        event => {
          normalizeMoneyInput(
            event.target
          );

          recalculateShipment();
        };
    });

  document
    .querySelectorAll(
      '.shipment-line-number'
    )
    .forEach(field => {
      field.oninput =
        recalculateShipment;
    });

  document
    .querySelectorAll(
      '.remove-shipment-line'
    )
    .forEach(button => {
      button.onclick =
        () => {
          const rows =
            document.querySelectorAll(
              '#shipmentLinesBody tr'
            );

          if (rows.length <= 1) {
            toast(
              'La remisión debe tener al menos una línea.'
            );

            return;
          }

          button
            .closest('tr')
            ?.remove();

          recalculateShipment();
        };
    });
}


/* =========================================================
   9. LÍNEAS
   ========================================================= */

function addShipmentLine() {
  const body =
    document.getElementById(
      'shipmentLinesBody'
    );

  if (!body) {
    return;
  }

  const plantingId =
    document
      .getElementById(
        'shipmentPlanting'
      )
      ?.value;

  body.insertAdjacentHTML(
    'beforeend',
    lineFormHtml(
      defaultLine(
        plantingId
      )
    )
  );

  bindLineEvents();
  recalculateShipment();
}


function lineFormHtml(line = {}) {
  return `
    <tr class="shipment-line-row">

      <td>
        <select
          class="input shipment-line-product"
          required
        >
          ${productFormOptions(
            line.product_id
          )}
        </select>
      </td>

      <td>
        <input
          class="input shipment-line-number shipment-line-boxes"
          type="number"
          min="0"
          step="1"
          value="${numeric(
            line.boxes
          ) || ''}"
          required
        >
      </td>

      <td>
        <input
          class="input shipment-line-number shipment-line-lbs"
          type="number"
          min="0"
          step="0.01"
          value="${numeric(
            line.lbs_per_box
          ) || ''}"
          required
        >
      </td>

      <td class="shipment-line-pounds">
        0
      </td>

      <td>
        <input
          class="input money-input shipment-line-money shipment-line-price"
          type="text"
          inputmode="decimal"
          value="${formatInputMoney(
            line.price_per_box || 0
          )}"
          required
        >
      </td>

      <td class="shipment-line-amount">
        $0.00
      </td>

      <td>
        <button
          class="btn danger remove-shipment-line"
          type="button"
          title="Eliminar línea"
        >
          ×
        </button>
      </td>

    </tr>
  `;
}


function defaultLine(
  plantingId
) {
  const planting =
    plantingById(
      plantingId
    );

  return {
    product_id:
      planting?.product_id || '',
    boxes: '',
    lbs_per_box:
      numeric(
        planting?.standard_box_lbs
      ) || 12,
    price_per_box:
      numeric(
        planting?.price_per_box
      )
  };
}


function applyProductDefaults(row) {
  if (!row) {
    return;
  }

  const planting =
    plantingById(
      document
        .getElementById(
          'shipmentPlanting'
        )
        ?.value
    );

  const productId =
    row
      .querySelector(
        '.shipment-line-product'
      )
      ?.value;

  if (
    planting &&
    String(
      planting.product_id
    ) === String(productId)
  ) {
    const lbs =
      row.querySelector(
        '.shipment-line-lbs'
      );

    const price =
      row.querySelector(
        '.shipment-line-price'
      );

    if (lbs) {
      lbs.value =
        numeric(
          planting.standard_box_lbs
        ) || 12;
    }

    if (price) {
      price.value =
        formatInputMoney(
          planting.price_per_box
        );
    }
  }
}


/* =========================================================
   10. DEFAULT SIEMBRA / CLIENTE / VENCIMIENTO
   ========================================================= */

function preferredPlantingId() {
  const planting001 =
    shipmentFormData.plantings.find(
      row =>
        String(
          row.contract_number
        ) === '001'
    );

  return (
    planting001?.id ||
    shipmentFormData.plantings[0]?.id ||
    ''
  );
}


function syncPlantingDefaults(
  replaceLineDefaults
) {
  const planting =
    plantingById(
      document
        .getElementById(
          'shipmentPlanting'
        )
        ?.value
    );

  if (!planting) {
    return;
  }

  const client =
    document.getElementById(
      'shipmentClientName'
    );

  const credit =
    document.getElementById(
      'shipmentCreditDays'
    );

  if (client) {
    client.value =
      planting.client_name || '';
  }

  if (credit) {
    credit.value =
      String(
        planting.credit_days || 0
      );
  }

  if (
    replaceLineDefaults &&
    !editingShipment
  ) {
    const currency =
      document.getElementById(
        'shipmentCurrency'
      );

    const rate =
      document.getElementById(
        'shipmentExchangeRate'
      );

    if (currency) {
      currency.value =
        planting.price_currency ||
        'USD';
    }

    if (rate) {
      rate.value =
        formatInputMoney(
          planting.projection_exchange_rate ||
          0
        );
    }

    const body =
      document.getElementById(
        'shipmentLinesBody'
      );

    if (body) {
      body.innerHTML =
        lineFormHtml(
          defaultLine(
            planting.id
          )
        );

      bindLineEvents();
    }
  }

  updateDueDate();
}


function updateDueDate() {
  const planting =
    plantingById(
      document
        .getElementById(
          'shipmentPlanting'
        )
        ?.value
    );

  const shipmentDate =
    document
      .getElementById(
        'shipmentDate'
      )
      ?.value;

  const due =
    document.getElementById(
      'shipmentDueDate'
    );

  if (due) {
    due.value =
      addDaysIso(
        shipmentDate,
        numeric(
          planting?.credit_days
        )
      );
  }
}


/* =========================================================
   11. CÁLCULOS
   ========================================================= */

function recalculateShipment() {
  const currency =
    document
      .getElementById(
        'shipmentCurrency'
      )
      ?.value || 'USD';

  const rate =
    parseMoneyInput(
      document
        .getElementById(
          'shipmentExchangeRate'
        )
        ?.value
    );

  let totalBoxes = 0;
  let totalPounds = 0;
  let totalAmount = 0;

  document
    .querySelectorAll(
      '#shipmentLinesBody tr'
    )
    .forEach(row => {
      const boxes =
        numeric(
          row.querySelector(
            '.shipment-line-boxes'
          )?.value
        );

      const lbsPerBox =
        numeric(
          row.querySelector(
            '.shipment-line-lbs'
          )?.value
        );

      const price =
        parseMoneyInput(
          row.querySelector(
            '.shipment-line-price'
          )?.value
        );

      const pounds =
        boxes *
        lbsPerBox;

      const amount =
        boxes *
        price;

      totalBoxes += boxes;
      totalPounds += pounds;
      totalAmount += amount;

      const poundsCell =
        row.querySelector(
          '.shipment-line-pounds'
        );

      const amountCell =
        row.querySelector(
          '.shipment-line-amount'
        );

      if (poundsCell) {
        poundsCell.textContent =
          number(
            pounds,
            2
          );
      }

      if (amountCell) {
        amountCell.textContent =
          money(
            amount,
            currency
          );
      }
    });

  const mxn =
    currency === 'USD'
      ? totalAmount * rate
      : totalAmount;

  const usd =
    currency === 'MXN' &&
    rate > 0
      ? totalAmount / rate
      : currency === 'USD'
        ? totalAmount
        : 0;

  setText(
    'shipmentTotalBoxes',
    number(
      totalBoxes,
      0
    )
  );

  setText(
    'shipmentTotalPounds',
    `${number(
      totalPounds,
      2
    )} lb`
  );

  setText(
    'shipmentTotalOriginal',
    money(
      totalAmount,
      currency
    )
  );

  setText(
    'shipmentTotalMxn',
    money(
      mxn,
      'MXN'
    )
  );

  setText(
    'shipmentTotalUsd',
    money(
      usd,
      'USD'
    )
  );
}


/* =========================================================
   12. GUARDAR
   ========================================================= */

async function saveShipment(event) {
  event.preventDefault();

  const payload =
    collectShipmentPayload();

  if (!payload) {
    return;
  }

  const submit =
    event.submitter;

  if (submit) {
    submit.disabled = true;
  }

  try {
    const result =
      await api(
        'shipments',
        editingShipment
          ? {
              method: 'PUT',
              body: JSON.stringify({
                ...payload,
                id:
                  editingShipment.id
              })
            }
          : {
              method: 'POST',
              body: JSON.stringify(
                payload
              )
            }
      );

    toast(
      editingShipment
        ? 'Remisión actualizada correctamente.'
        : `Remisión ${result.folio} guardada correctamente.`
    );

    closeShipmentModal();

    await loadShipments();

    renderTableArea();

  } catch (error) {
    toast(
      error?.message ||
      'No fue posible guardar la remisión.'
    );
  } finally {
    if (submit) {
      submit.disabled = false;
    }
  }
}


function collectShipmentPayload() {
  const plantingId =
    Number(
      document
        .getElementById(
          'shipmentPlanting'
        )
        ?.value || 0
    );

  const shipmentDate =
    document
      .getElementById(
        'shipmentDate'
      )
      ?.value || '';

  const currency =
    document
      .getElementById(
        'shipmentCurrency'
      )
      ?.value || '';

  const exchangeRate =
    parseMoneyInput(
      document
        .getElementById(
          'shipmentExchangeRate'
        )
        ?.value
    );

  const notes =
    document
      .getElementById(
        'shipmentNotes'
      )
      ?.value || '';

  const lines =
    Array.from(
      document.querySelectorAll(
        '#shipmentLinesBody tr'
      )
    ).map(row => ({
      product_id:
        Number(
          row.querySelector(
            '.shipment-line-product'
          )?.value || 0
        ),

      boxes:
        numeric(
          row.querySelector(
            '.shipment-line-boxes'
          )?.value
        ),

      lbs_per_box:
        numeric(
          row.querySelector(
            '.shipment-line-lbs'
          )?.value
        ),

      price_per_box:
        parseMoneyInput(
          row.querySelector(
            '.shipment-line-price'
          )?.value
        )
    }));

  if (!plantingId) {
    toast(
      'Selecciona una siembra.'
    );

    return null;
  }

  if (!shipmentDate) {
    toast(
      'Captura la fecha de la remisión.'
    );

    return null;
  }

  if (exchangeRate <= 0) {
    toast(
      'El tipo de cambio debe ser mayor a cero.'
    );

    return null;
  }

  if (
    lines.some(
      line =>
        !line.product_id ||
        line.boxes <= 0 ||
        line.lbs_per_box <= 0 ||
        line.price_per_box < 0
    )
  ) {
    toast(
      'Revisa las líneas de la remisión. Producto, cajas y libras por caja son obligatorios.'
    );

    return null;
  }

  return {
    planting_id:
      plantingId,
    shipment_date:
      shipmentDate,
    currency,
    exchange_rate:
      exchangeRate,
    notes,
    lines
  };
}


/* =========================================================
   13. ELIMINAR
   ========================================================= */

async function deleteShipment(
  id,
  folio
) {
  const confirmed =
    window.confirm(
      `¿Eliminar la remisión ${folio}? Esta acción no se puede deshacer.`
    );

  if (!confirmed) {
    return;
  }

  try {
    await api(
  'shipments',
  {
    method: 'DELETE',

    body: JSON.stringify({
      id
    })
  }
);

    toast(
      'Remisión eliminada correctamente.'
    );

    await loadShipments();
    renderTableArea();

  } catch (error) {
    toast(
      error?.message ||
      'No fue posible eliminar la remisión.'
    );
  }
}


/* =========================================================
   14. PDF / IMPRESIÓN
   ========================================================= */

async function printShipmentPdf(id) {
  let shipment;

  try {
    shipment =
      await api(
        `shipments?id=${id}`
      );
  } catch {
    toast(
      'No fue posible cargar la remisión.'
    );

    return;
  }

  const totals =
    bothCurrencies(
      shipment
    );

  const printWindow =
    window.open(
      '',
      '_blank',
      'width=980,height=760'
    );

  if (!printWindow) {
    toast(
      'El navegador bloqueó la ventana del PDF.'
    );

    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>
          ${escapeHtml(
            shipment.folio
          )}
        </title>

.pdf-total-secondary {
  color: #777;
}

.pdf-total-secondary strong {
  color: #777;
}
        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 34px;
            font-family: Tahoma, Arial, sans-serif;
            color: #172536;
          }

          .head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 18px;
            border-bottom: 3px solid #1b6b45;
          }

          .pdf-brand {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
}

.pdf-logo {
  display: block;
  width: 150px;
  height: auto;
  max-height: 70px;
  object-fit: contain;
  object-position: left center;
}

          .title {
            text-align: right;
          }

          .title h1 {
            margin: 0;
            font-size: 22px;
          }

          .title strong {
            display: block;
            margin-top: 5px;
            color: #1b6b45;
          }

          .meta {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px 22px;
            margin: 24px 0;
          }

          .meta div {
            padding: 9px 0;
            border-bottom: 1px solid #dde5e1;
          }

          .meta span {
            display: block;
            margin-bottom: 4px;
            color: #6b7785;
            font-size: 11px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th,
          td {
            padding: 9px;
            border: 1px solid #d8e0dc;
            text-align: right;
            font-size: 12px;
          }

          th {
            background: #edf5f0;
          }

          th:first-child,
          td:first-child {
            text-align: left;
          }

          .totals {
            width: 390px;
            margin: 22px 0 0 auto;
          }

          .totals div {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            padding: 8px 0;
            border-bottom: 1px solid #dde5e1;
          }

          .total-main {
            font-size: 16px;
            font-weight: 800;
            color: #174f38;
          }

          .notes {
            margin-top: 24px;
            padding: 12px;
            background: #f6f8f7;
            font-size: 11px;
          }

          @media print {
            body {
              padding: 18px;
            }
          }
        </style>
      </head>

      <body>

        <header class="head">
          <div class="pdf-brand">
  <img
    src="/assets/logo-alansa.png"
    alt="ALANSA"
    class="pdf-logo"
  >

  <div>
    Remisión agrícola
  </div>
</div>

          <div class="title">
            <h1>
              REMISIÓN
            </h1>
            <strong>
              ${escapeHtml(
                shipment.folio
              )}
            </strong>
          </div>
        </header>

        <section class="meta">
          <div>
            <span>Cliente</span>
            <strong>
              ${escapeHtml(
                shipment.client_name
              )}
            </strong>
          </div>

          <div>
            <span>Contrato / Siembra</span>
            <strong>
              ${escapeHtml(
                shipment.contract_number
              )}
            </strong>
          </div>

          <div>
            <span>Fecha</span>
            <strong>
              ${safeDate(
                shipment.shipment_date
              )}
            </strong>
          </div>

          <div>
            <span>Vencimiento</span>
            <strong>
              ${safeDate(
                shipment.due_date
              )}
            </strong>
          </div>

          <div>
            <span>Días de crédito</span>
            <strong>
              ${number(
                shipment.credit_days,
                0
              )}
            </strong>
          </div>

          <div>
            <span>Tipo de cambio</span>
            <strong>
              ${number(
                shipment.exchange_rate,
                2
              )} MXN/USD
            </strong>
          </div>
        </section>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cajas</th>
              <th>Lb/caja</th>
              <th>Libras</th>
              <th>Precio/caja</th>
              <th>Importe</th>
            </tr>
          </thead>

          <tbody>
            ${(shipment.lines || [])
              .map(line => `
                <tr>
                  <td>
                    ${escapeHtml(
                      line.product_name
                    )}
                  </td>

                  <td>
                    ${number(
                      line.boxes,
                      0
                    )}
                  </td>

                  <td>
                    ${number(
                      line.lbs_per_box,
                      2
                    )}
                  </td>

                  <td>
                    ${number(
                      line.pounds,
                      2
                    )}
                  </td>

                  <td>
                    ${money(
                      line.price_per_box,
                      shipment.currency
                    )}
                  </td>

                  <td>
                    ${money(
                      line.line_amount,
                      shipment.currency
                    )}
                  </td>
                </tr>
              `)
              .join('')}
          </tbody>
        </table>

        <section class="totals">
          <div>
            <span>Total cajas</span>
            <strong>
              ${number(
                shipment.total_boxes,
                0
              )}
            </strong>
          </div>

          <div>
            <span>Total libras</span>
            <strong>
              ${number(
                shipment.total_pounds,
                2
              )} lb
            </strong>
          </div>

          <div class="total-main">
            <span>Total</span>
            <strong>
              ${money(
                shipment.total_amount,
                shipment.currency
              )}
            </strong>
          </div>

          <div class="pdf-total-secondary">
  <span>Equivalente MXN</span>
  <strong>
    ${money(
      totals.mxn,
      'MXN'
    )}
  </strong>
</div>

          </section>

        ${
          shipment.notes
            ? `
                <div class="notes">
                  <strong>Notas:</strong>
                  ${escapeHtml(
                    shipment.notes
                  )}
                </div>
              `
            : ''
        }

        <script>
          window.onload = () => {
            window.print();
          };
        <\/script>

      </body>
    </html>
  `);

  printWindow.document.close();
}


/* =========================================================
   15. EXCEL
   Exporta exactamente el resultado filtrado de la tabla.
   ========================================================= */

function exportShipmentsExcel() {
  const rows =
    filteredRows();

  if (!rows.length) {
    toast(
      'No hay remisiones para exportar.'
    );

    return;
  }

  const headers = [
    'Folio',
    'Fecha',
    'Contrato',
    'Cliente',
    'Productos',
    'Cajas',
    'Libras',
    'Total MXN',
    'Total USD',
    'Vencimiento',
    'Días de crédito',
    'Estatus'
  ];

  const dataRows =
    rows.map(row => {
      const totals =
        bothCurrencies(row);

      return [
        row.folio,
        row.shipment_date,
        row.contract_number,
        row.client_name,
        row.product_names,
        numeric(
          row.total_boxes
        ),
        numeric(
          row.total_pounds
        ),
        totals.mxn,
        totals.usd,
        row.due_date,
        numeric(
          row.credit_days
        ),
        financialStatus(row)
      ];
    });

  const worksheet =
    excelWorksheet(
      headers,
      dataRows
    );

  const blob =
    new Blob(
      [worksheet],
      {
        type:
          'application/vnd.ms-excel;charset=utf-8;'
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      'a'
    );

  link.href = url;
  link.download =
    `Remisiones_ALANSA_${todayIso()}.xls`;

  document.body.appendChild(
    link
  );

  link.click();
  link.remove();

  URL.revokeObjectURL(
    url
  );
}


function excelWorksheet(
  headers,
  rows
) {
  const escapeCell =
    value =>
      String(
        value ?? ''
      )
        .replace(
          /&/g,
          '&amp;'
        )
        .replace(
          /</g,
          '&lt;'
        )
        .replace(
          />/g,
          '&gt;'
        );

  return `
    <html
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40"
    >
      <head>
        <meta charset="utf-8">
      </head>

      <body>
        <table>
          <thead>
            <tr>
              ${headers
                .map(value =>
                  `<th>${escapeCell(value)}</th>`
                )
                .join('')}
            </tr>
          </thead>

          <tbody>
            ${rows
              .map(row => `
                <tr>
                  ${row
                    .map(value =>
                      `<td>${escapeCell(value)}</td>`
                    )
                    .join('')}
                </tr>
              `)
              .join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;
}


/* =========================================================
   16. OPCIONES
   ========================================================= */

function plantingFormOptions(
  selected
) {
  return shipmentFormData.plantings
    .map(row => `
      <option
        value="${row.id}"
        ${String(row.id) ===
          String(selected)
            ? 'selected'
            : ''}
      >
        ${escapeHtml(
          row.contract_number
        )}
        ·
        ${escapeHtml(
          row.product_name
        )}
      </option>
    `)
    .join('');
}


function productFormOptions(
  selected
) {
  return `
    <option value="">
      Seleccionar
    </option>

    ${shipmentFormData.products
      .map(row => `
        <option
          value="${row.id}"
          ${String(row.id) ===
            String(selected)
              ? 'selected'
              : ''}
        >
          ${escapeHtml(
            row.name
          )}
        </option>
      `)
      .join('')}
  `;
}


function productFilterOptions() {
  const names =
    new Set();

  shipmentRows.forEach(row => {
    String(
      row.product_names || ''
    )
      .split(',')
      .map(value =>
        value.trim()
      )
      .filter(Boolean)
      .forEach(value =>
        names.add(value)
      );
  });

  return Array.from(names)
    .sort(
      (a, b) =>
        a.localeCompare(b)
    )
    .map(name => `
      <option
        value="${escapeHtml(name)}"
        ${shipmentFilters.product ===
          name
            ? 'selected'
            : ''}
      >
        ${escapeHtml(name)}
      </option>
    `)
    .join('');
}


/* =========================================================
   17. UTILIDADES
   ========================================================= */

function plantingById(id) {
  return shipmentFormData.plantings.find(
    row =>
      String(row.id) ===
      String(id)
  );
}


function bothCurrencies(row) {
  const amount =
    numeric(
      row.total_amount
    );

  const rate =
    numeric(
      row.exchange_rate
    );

  if (
    row.currency === 'MXN'
  ) {
    return {
      mxn: amount,
      usd:
        rate > 0
          ? amount / rate
          : 0
    };
  }

  return {
    usd: amount,
    mxn:
      numeric(
        row.mxn_equivalent
      ) ||
      (
        rate > 0
          ? amount * rate
          : 0
      )
  };
}


function financialStatus(row) {
  if (
    row.status === 'Cobrada' ||
    row.status === 'Aplicada'
  ) {
    return 'Cobrada';
  }

  if (
    row.status === 'Parcial'
  ) {
    return 'Parcial';
  }

  return 'Emitida';
}


function statusBadge(status) {
  const css =
    status === 'Cobrada'
      ? 'paid'
      : status === 'Parcial'
        ? 'partial'
        : 'pending';

  return `
    <span class="shipment-status ${css}">
      ${escapeHtml(status)}
    </span>
  `;
}


function closeShipmentModal() {
  const root =
    document.getElementById(
      'shipmentModalRoot'
    );

  if (root) {
    root.innerHTML = '';
  }

  editingShipment = null;
}


function setText(id, value) {
  const element =
    document.getElementById(id);

  if (element) {
    element.textContent =
      value;
  }
}


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


function parseMoneyInput(value) {
  return numeric(value);
}


function formatInputMoney(value) {
  const result =
    numeric(value);

  if (!result) {
    return '';
  }

  return result.toLocaleString(
    'en-US',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );
}


function normalizeMoneyInput(input) {
  if (!input) {
    return;
  }

  const raw =
    String(
      input.value || ''
    )
      .replace(
        /[^0-9.]/g,
        ''
      );

  const parts =
    raw.split('.');

  const normalized =
    parts.length > 1
      ? `${parts.shift()}.${parts.join('')}`
      : parts[0];

  input.dataset.raw =
    normalized;
}


function todayIso() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      now.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}


function addDaysIso(
  isoDate,
  days
) {
  if (!isoDate) {
    return '';
  }

  const parts =
    isoDate
      .split('-')
      .map(Number);

  const result =
    new Date(
      parts[0],
      parts[1] - 1,
      parts[2]
    );

  result.setDate(
    result.getDate() +
    Number(days || 0)
  );

  return [
    result.getFullYear(),
    String(
      result.getMonth() + 1
    ).padStart(2, '0'),
    String(
      result.getDate()
    ).padStart(2, '0')
  ].join('-');
}


function safeDate(value) {
  if (!value) {
    return '—';
  }

  try {
    return date(value);
  } catch {
    return String(value);
  }
}
