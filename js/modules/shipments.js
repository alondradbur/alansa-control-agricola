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

const SHIPMENT_FILTER_COLUMNS = [
  'folio',
  'shipment_date',
  'contract_number',
  'client_name',
  'product_names',
  'total_boxes',
  'total_pounds',
  'total_mxn',
  'total_usd',
  'due_date',
  'status'
];

let shipmentFilters = createEmptyShipmentFilters();
let openShipmentFilter = null;

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

  bindShipmentTableEvents();
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
   4. FILTROS TIPO EXCEL
   ========================================================= */

function createEmptyShipmentFilters() {
  return Object.fromEntries(
    SHIPMENT_FILTER_COLUMNS.map(
      key => [
        key,
        {
          selected: null,
          search: '',
          from: '',
          to: '',
          min: '',
          max: ''
        }
      ]
    )
  );
}


function shipmentColumnValue(
  row,
  key
) {
  const totals =
    bothCurrencies(row);

  switch (key) {
    case 'folio':
      return String(
        row.folio || ''
      );

    case 'shipment_date':
      return String(
        row.shipment_date || ''
      ).slice(0, 10);

    case 'contract_number':
      return String(
        row.contract_number || ''
      );

    case 'client_name':
      return String(
        row.client_name || ''
      );

    case 'product_names':
      return String(
        row.product_names || ''
      );

    case 'total_boxes':
      return numeric(
        row.total_boxes
      );

    case 'total_pounds':
      return numeric(
        row.total_pounds
      );

    case 'total_mxn':
      return totals.mxn;

    case 'total_usd':
      return totals.usd;

    case 'due_date':
      return String(
        row.due_date || ''
      ).slice(0, 10);

    case 'status':
      return financialStatus(row);

    default:
      return '';
  }
}


function shipmentFilterType(key) {
  if (
    key === 'shipment_date' ||
    key === 'due_date'
  ) {
    return 'date';
  }

  if (
    [
      'total_boxes',
      'total_pounds',
      'total_mxn',
      'total_usd'
    ].includes(key)
  ) {
    return 'number';
  }

  return 'text';
}


function shipmentFilterIsActive(key) {
  const filter =
    shipmentFilters[key];

  if (!filter) {
    return false;
  }

  return Boolean(
    filter.search ||
    filter.from ||
    filter.to ||
    filter.min !== '' ||
    filter.max !== '' ||
    (
      Array.isArray(
        filter.selected
      ) &&
      filter.selected.length
    )
  );
}


function shipmentFilterLabel(
  key,
  value
) {
  if (
    key === 'shipment_date' ||
    key === 'due_date'
  ) {
    return value
      ? safeDate(value)
      : '(Vacío)';
  }

  if (key === 'total_boxes') {
    return number(
      numeric(value),
      0
    );
  }

  if (key === 'total_pounds') {
    return number(
      numeric(value),
      2
    );
  }

  if (key === 'total_mxn') {
    return money(
      numeric(value),
      'MXN'
    );
  }

  if (key === 'total_usd') {
    return money(
      numeric(value),
      'USD'
    );
  }

  return String(
    value || '(Vacío)'
  );
}


function shipmentUniqueValues(key) {
  const type =
    shipmentFilterType(key);

  const values =
    Array.from(
      new Set(
        shipmentRows.map(
          row =>
            String(
              shipmentColumnValue(
                row,
                key
              ) ?? ''
            )
        )
      )
    );

  if (type === 'number') {
    return values.sort(
      (a, b) =>
        numeric(a) -
        numeric(b)
    );
  }

  return values.sort(
    (a, b) =>
      a.localeCompare(
        b,
        'es',
        {
          numeric: true,
          sensitivity: 'base'
        }
      )
  );
}


function shipmentHeaderHtml(
  key,
  label
) {
  const active =
    shipmentFilterIsActive(
      key
    );

  return `
    <th class="${
      active
        ? 'shipment-filter-active'
        : ''
    }">
      <div class="shipment-th-inner">
        <span>
          ${escapeHtml(label)}
        </span>

        <button
          class="shipment-filter-trigger ${
            active
              ? 'active'
              : ''
          }"
          data-filter-column="${key}"
          type="button"
          title="Filtrar ${escapeHtml(label)}"
          aria-label="Filtrar ${escapeHtml(label)}"
        >
          ▾
        </button>
      </div>

      ${
        openShipmentFilter === key
          ? shipmentFilterMenuHtml(
              key
            )
          : ''
      }
    </th>
  `;
}


function shipmentFilterMenuHtml(key) {
  const filter =
    shipmentFilters[key];

  const type =
    shipmentFilterType(key);

  const values =
    shipmentUniqueValues(key);

  const search =
    String(
      filter.search || ''
    ).trim().toLowerCase();

  const visibleValues =
    values.filter(value =>
      !search ||
      shipmentFilterLabel(
        key,
        value
      )
        .toLowerCase()
        .includes(search)
    );

  const selected =
    Array.isArray(
      filter.selected
    )
      ? filter.selected
      : null;

  const allVisibleSelected =
    visibleValues.length > 0 &&
    visibleValues.every(value =>
      !selected ||
      selected.includes(value)
    );

  return `
    <div
      class="shipment-filter-menu"
      data-filter-menu="${key}"
    >
      <div class="shipment-filter-menu-head">
        <strong>
          Filtrar columna
        </strong>

        <button
          class="shipment-filter-close"
          type="button"
          title="Cerrar"
        >
          ×
        </button>
      </div>

      ${
        type === 'text'
          ? `
              <input
                class="input shipment-filter-search"
                data-filter-search="${key}"
                type="search"
                placeholder="Buscar..."
                value="${escapeHtml(
                  filter.search || ''
                )}"
              >
            `
          : ''
      }

      ${
        type === 'date'
          ? `
              <div class="shipment-filter-range">
                <label>
                  Desde
                  <input
                    class="input shipment-filter-date-from"
                    data-filter-date-from="${key}"
                    type="date"
                    value="${escapeHtml(
                      filter.from || ''
                    )}"
                  >
                </label>

                <label>
                  Hasta
                  <input
                    class="input shipment-filter-date-to"
                    data-filter-date-to="${key}"
                    type="date"
                    value="${escapeHtml(
                      filter.to || ''
                    )}"
                  >
                </label>
              </div>
            `
          : ''
      }

      ${
        type === 'number'
          ? `
              <div class="shipment-filter-range">
                <label>
                  Mínimo
                  <input
                    class="input shipment-filter-number-min"
                    data-filter-number-min="${key}"
                    type="number"
                    step="any"
                    value="${escapeHtml(
                      filter.min
                    )}"
                  >
                </label>

                <label>
                  Máximo
                  <input
                    class="input shipment-filter-number-max"
                    data-filter-number-max="${key}"
                    type="number"
                    step="any"
                    value="${escapeHtml(
                      filter.max
                    )}"
                  >
                </label>
              </div>
            `
          : ''
      }

      <div class="shipment-filter-select-row">
        <label>
          <input
            class="shipment-filter-select-all"
            data-filter-select-all="${key}"
            type="checkbox"
            ${allVisibleSelected
              ? 'checked'
              : ''}
          >
          Seleccionar todo
        </label>
      </div>

      <div class="shipment-filter-values">
        ${
          visibleValues.length
            ? visibleValues
                .map(value => `
                  <label
                    class="shipment-filter-value"
                  >
                    <input
                      class="shipment-filter-value-checkbox"
                      data-filter-value-column="${key}"
                      value="${escapeHtml(value)}"
                      type="checkbox"
                      ${
                        !selected ||
                        selected.includes(value)
                          ? 'checked'
                          : ''
                      }
                    >

                    <span>
                      ${escapeHtml(
                        shipmentFilterLabel(
                          key,
                          value
                        )
                      )}
                    </span>
                  </label>
                `)
                .join('')
            : `
                <div class="shipment-filter-no-values">
                  No se encontraron valores.
                </div>
              `
        }
      </div>

      <div class="shipment-filter-actions">
        <button
          class="btn shipment-filter-clear-column"
          data-filter-clear="${key}"
          type="button"
        >
          Limpiar
        </button>

        <button
          class="btn primary shipment-filter-apply"
          data-filter-apply="${key}"
          type="button"
        >
          Aplicar
        </button>
      </div>
    </div>
  `;
}


function rowMatchesShipmentFilter(
  row,
  key
) {
  const filter =
    shipmentFilters[key];

  if (!filter) {
    return true;
  }

  const type =
    shipmentFilterType(key);

  const rawValue =
    shipmentColumnValue(
      row,
      key
    );

  const stringValue =
    String(
      rawValue ?? ''
    );

  if (
    Array.isArray(
      filter.selected
    ) &&
    !filter.selected.includes(
      stringValue
    )
  ) {
    return false;
  }

  if (
    type === 'text' &&
    filter.search
  ) {
    const search =
      filter.search
        .trim()
        .toLowerCase();

    if (
      !stringValue
        .toLowerCase()
        .includes(search)
    ) {
      return false;
    }
  }

  if (type === 'date') {
    const value =
      stringValue.slice(
        0,
        10
      );

    if (
      filter.from &&
      value < filter.from
    ) {
      return false;
    }

    if (
      filter.to &&
      value > filter.to
    ) {
      return false;
    }
  }

  if (type === 'number') {
    const value =
      numeric(rawValue);

    if (
      filter.min !== '' &&
      value <
        numeric(filter.min)
    ) {
      return false;
    }

    if (
      filter.max !== '' &&
      value >
        numeric(filter.max)
    ) {
      return false;
    }
  }

  return true;
}


function filteredRows() {
  return shipmentRows.filter(
    row =>
      SHIPMENT_FILTER_COLUMNS.every(
        key =>
          rowMatchesShipmentFilter(
            row,
            key
          )
      )
  );
}


function clearShipmentColumnFilter(key) {
  shipmentFilters[key] = {
    selected: null,
    search: '',
    from: '',
    to: '',
    min: '',
    max: ''
  };
}


function clearAllShipmentFilters() {
  shipmentFilters =
    createEmptyShipmentFilters();

  openShipmentFilter = null;

  renderTableArea();
}


function applyShipmentFilterMenu(key) {
  const menu =
    document.querySelector(
      `[data-filter-menu="${key}"]`
    );

  if (!menu) {
    return;
  }

  const values =
    shipmentUniqueValues(key);

  const checked =
    Array.from(
      menu.querySelectorAll(
        '.shipment-filter-value-checkbox:checked'
      )
    ).map(
      input =>
        input.value
    );

  shipmentFilters[key].selected =
    checked.length ===
      values.length
      ? null
      : checked;

  const search =
    menu.querySelector(
      '.shipment-filter-search'
    );

  const from =
    menu.querySelector(
      '.shipment-filter-date-from'
    );

  const to =
    menu.querySelector(
      '.shipment-filter-date-to'
    );

  const min =
    menu.querySelector(
      '.shipment-filter-number-min'
    );

  const max =
    menu.querySelector(
      '.shipment-filter-number-max'
    );

  shipmentFilters[key].search =
    search?.value || '';

  shipmentFilters[key].from =
    from?.value || '';

  shipmentFilters[key].to =
    to?.value || '';

  shipmentFilters[key].min =
    min?.value || '';

  shipmentFilters[key].max =
    max?.value || '';

  openShipmentFilter = null;

  renderTableArea();
}


/* =========================================================
   5. TABLA

   ========================================================= */

function tableAreaHtml() {
  const rows =
    filteredRows();

  return `
    <div class="shipments-filter-summary">
      <div>
        <strong>
          ${rows.length}
        </strong>
        de
        ${shipmentRows.length}
        remisión(es)
      </div>

      ${
        SHIPMENT_FILTER_COLUMNS.some(
          shipmentFilterIsActive
        )
          ? `
              <button
                class="btn"
                id="clearAllShipmentColumnFilters"
                type="button"
              >
                Limpiar todos los filtros
              </button>
            `
          : ''
      }
    </div>

    <div class="table-scroll shipments-v2-scroll">

      <table class="shipments-v2-table">

        <thead>
          <tr>
            ${shipmentHeaderHtml(
              'folio',
              'Folio'
            )}
            ${shipmentHeaderHtml(
              'shipment_date',
              'Fecha'
            )}
            ${shipmentHeaderHtml(
              'contract_number',
              'Contrato'
            )}
            ${shipmentHeaderHtml(
              'client_name',
              'Cliente'
            )}
            ${shipmentHeaderHtml(
              'product_names',
              'Producto(s)'
            )}
            ${shipmentHeaderHtml(
              'total_boxes',
              'Cajas'
            )}
            ${shipmentHeaderHtml(
              'total_pounds',
              'Libras'
            )}
            ${shipmentHeaderHtml(
              'total_mxn',
              'Total MXN'
            )}
            ${shipmentHeaderHtml(
              'total_usd',
              'Total USD'
            )}
            ${shipmentHeaderHtml(
              'due_date',
              'Vencimiento'
            )}
            ${shipmentHeaderHtml(
              'status',
              'Estado'
            )}
            <th class="shipment-actions-head">
              Acciones
            </th>
          </tr>
        </thead>

        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    tableRowHtml
                  )
                  .join('')
              : `
                  <tr>
                    <td
                      colspan="12"
                      class="shipment-table-empty-cell"
                    >
                      No se encontraron remisiones con los filtros seleccionados.
                    </td>
                  </tr>
                `
          }
        </tbody>

        ${shipmentTotalsHtml(rows)}

      </table>

    </div>
  `;
}


function shipmentTotalsHtml(rows) {
  const totals =
    rows.reduce(
      (acc, row) => {
        const currencies =
          bothCurrencies(row);

        acc.boxes +=
          numeric(
            row.total_boxes
          );

        acc.pounds +=
          numeric(
            row.total_pounds
          );

        acc.mxn +=
          currencies.mxn;

        acc.usd +=
          currencies.usd;

        return acc;
      },
      {
        boxes: 0,
        pounds: 0,
        mxn: 0,
        usd: 0
      }
    );

  return `
    <tfoot>
      <tr class="shipment-totals-row">
        <td colspan="5">
          <strong>
            TOTALES FILTRADOS
          </strong>

          <span class="shipment-total-records">
            ${rows.length}
            remisión(es)
          </span>
        </td>

        <td>
          <strong>
            ${number(
              totals.boxes,
              0
            )}
          </strong>
        </td>

        <td>
          <strong>
            ${number(
              totals.pounds,
              2
            )}
          </strong>
        </td>

        <td>
          <strong>
            ${money(
              totals.mxn,
              'MXN'
            )}
          </strong>
        </td>

        <td>
          <strong>
            ${money(
              totals.usd,
              'USD'
            )}
          </strong>
        </td>

        <td colspan="3"></td>
      </tr>
    </tfoot>
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

  bindShipmentTableEvents();
}


/* =========================================================
   6. ACCIONES DE TABLA

   ========================================================= */

function bindShipmentTableEvents() {
  bindRowActions();

  document
    .querySelectorAll(
      '.shipment-filter-trigger'
    )
    .forEach(button => {
      button.onclick =
        event => {
          event.stopPropagation();

          const key =
            button.dataset.filterColumn;

          openShipmentFilter =
            openShipmentFilter === key
              ? null
              : key;

          renderTableArea();
        };
    });

  document
    .querySelectorAll(
      '.shipment-filter-close'
    )
    .forEach(button => {
      button.onclick =
        event => {
          event.stopPropagation();

          openShipmentFilter = null;
          renderTableArea();
        };
    });

  document
    .querySelectorAll(
      '.shipment-filter-menu'
    )
    .forEach(menu => {
      menu.onclick =
        event => {
          event.stopPropagation();
        };
    });

  document
    .querySelectorAll(
      '.shipment-filter-search'
    )
    .forEach(input => {
      input.oninput =
        () => {
          const key =
            input.dataset.filterSearch;

          shipmentFilters[key].search =
            input.value;

          openShipmentFilter = key;
          renderTableArea();

          requestAnimationFrame(
            () => {
              const next =
                document.querySelector(
                  `[data-filter-search="${key}"]`
                );

              if (next) {
                next.focus();
                next.setSelectionRange(
                  next.value.length,
                  next.value.length
                );
              }
            }
          );
        };
    });

  document
    .querySelectorAll(
      '.shipment-filter-select-all'
    )
    .forEach(input => {
      input.onchange =
        () => {
          const menu =
            input.closest(
              '.shipment-filter-menu'
            );

          menu
            ?.querySelectorAll(
              '.shipment-filter-value-checkbox'
            )
            .forEach(
              checkbox => {
                checkbox.checked =
                  input.checked;
              }
            );
        };
    });

  document
    .querySelectorAll(
      '.shipment-filter-apply'
    )
    .forEach(button => {
      button.onclick =
        () => {
          applyShipmentFilterMenu(
            button.dataset.filterApply
          );
        };
    });

  document
    .querySelectorAll(
      '.shipment-filter-clear-column'
    )
    .forEach(button => {
      button.onclick =
        () => {
          clearShipmentColumnFilter(
            button.dataset.filterClear
          );

          openShipmentFilter = null;
          renderTableArea();
        };
    });

  document
    .getElementById(
      'clearAllShipmentColumnFilters'
    )
    ?.addEventListener(
      'click',
      clearAllShipmentFilters
    );
}


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

<div class="field">
  <label>
    Firma en remisión
  </label>

  <select
    class="input"
    id="shipmentSignatureUser"
  >
    <option
      value=""
      ${!current.signature_user
        ? 'selected'
        : ''}
    >
      Sin firma
    </option>

    <option
      value="A"
      ${current.signature_user === 'A'
        ? 'selected'
        : ''}
    >
      Usuario A
    </option>

    <option
      value="R"
      ${current.signature_user === 'R'
        ? 'selected'
        : ''}
    >
      Usuario R
    </option>
  </select>
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
  return (
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

  const signatureUser =
  document
    .getElementById(
      'shipmentSignatureUser'
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
  signature_user:
    signatureUser || null,
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

.pdf-total-secondary {
  color: #777;
}

.pdf-total-secondary strong {
  color: #777;
}

.notes {
            margin-top: 24px;
            padding: 12px;
            background: #f6f8f7;
            font-size: 11px;
          }

.signature-section {
  width: 260px;
  margin: 45px 0 10px auto;
  text-align: center;
}

.signature-title {
  margin-bottom: 6px;
  font-size: 12px;
  color: #6b7785;
}

.signature-image {
  display: block;
  max-width: 190px;
  max-height: 75px;
  margin: 0 auto 5px;
  object-fit: contain;
}

.signature-user {
  padding-top: 5px;
  border-top: 1px solid #8c9892;
  font-size: 11px;
  font-weight: 700;
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
  shipment.signature_user
    ? `
        <section class="signature-section">
          <div class="signature-title">
            Revisó
          </div>

          <img
            class="signature-image"
            src="${
              shipment.signature_user === 'A'
                ? '/assets/firma-usuario-a.png'
                : '/assets/firma-usuario-r.png'
            }"
            alt="Firma"
          >

          <div class="signature-user">
            ${
              shipment.signature_user === 'A'
                ? 'Usuario A'
                : 'Usuario R'
            }
          </div>
        </section>
      `
    : ''
}

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

