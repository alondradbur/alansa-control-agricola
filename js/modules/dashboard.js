import { api } from '../core/api.js';
import {
  escapeHtml,
  money,
  number,
  date
} from '../core/format.js';
import { moduleHeader } from '../components/common.js';


/* =========================================================
   ALANSA - DASHBOARD
   ========================================================= */

let dashboardData = null;

let filtersState = {
  from: '',
  to: '',
  plantingId: '',
  productId: ''
};

const SHIPMENT_TABLE_COLUMNS = [
  { key: 'folio', label: 'No. remisión', type: 'text' },
  { key: 'shipment_date', label: 'Fecha', type: 'date' },
  { key: 'client_name', label: 'Cliente', type: 'text' },
  { key: 'amount_mxn', label: 'Monto MXN', type: 'number' },
  { key: 'amount_usd', label: 'Monto USD', type: 'number' },
  { key: 'status', label: 'Estatus', type: 'text' }
];

const DUE_TABLE_COLUMNS = [
  { key: 'folio', label: 'No. remisión', type: 'text' },
  { key: 'shipment_date', label: 'Fecha', type: 'date' },
  { key: 'due_date', label: 'Vencimiento', type: 'date' },
  { key: 'client_name', label: 'Cliente', type: 'text' },
  { key: 'amount_mxn', label: 'Monto MXN', type: 'number' },
  { key: 'amount_usd', label: 'Monto USD', type: 'number' },
  { key: 'days_remaining', label: 'Días restantes', type: 'number' }
];

let shipmentTableState =
  createDashboardTableState(
    SHIPMENT_TABLE_COLUMNS
  );

let dueTableState =
  createDashboardTableState(
    DUE_TABLE_COLUMNS
  );


/* =========================================================
   1. RENDER PRINCIPAL
   ========================================================= */

export async function dashboard() {
  try {
    dashboardData = await api('dashboard');
  } catch {
    dashboardData = emptyDashboardData();
  }

  return `
    ${moduleHeader(
      'Dashboard',
      'Resumen general de la operación agrícola'
    )}

    <div class="content dashboard-v2-content">

      ${dashboardFilters()}

      <div id="dashboardBlocks">
        ${dashboardBlocks()}
      </div>

    </div>
  `;
}


/* =========================================================
   2. ENLAZAR EVENTOS
   ========================================================= */

export function bindDashboard() {
  const root = document;

  [
    'dashboardFrom',
    'dashboardTo',
    'dashboardPlanting',
    'dashboardProduct'
  ].forEach(id => {
    root
      .getElementById(id)
      ?.addEventListener(
        'change',
        () => {
          if (
            id === 'dashboardPlanting'
          ) {
            const plantingValue =
              root
                .getElementById(
                  'dashboardPlanting'
                )
                ?.value || '';

            if (plantingValue) {
              const productField =
                root.getElementById(
                  'dashboardProduct'
                );

              if (productField) {
                productField.value = '';
              }
            }
          }

          filtersState = readDashboardFilters(
            root
          );

          renderDashboardBlocks(
            root
          );
        }
      );
  });

  root
    .getElementById(
      'dashboardClearFilters'
    )
    ?.addEventListener(
      'click',
      () => {
        filtersState = {
          from: '',
          to: '',
          plantingId: '',
          productId: ''
        };

        shipmentTableState =
          createDashboardTableState(
            SHIPMENT_TABLE_COLUMNS
          );

        dueTableState =
          createDashboardTableState(
            DUE_TABLE_COLUMNS
          );

        [
          'dashboardFrom',
          'dashboardTo',
          'dashboardPlanting',
          'dashboardProduct'
        ].forEach(id => {
          const field =
            root.getElementById(id);

          if (field) {
            field.value = '';
          }
        });

        renderDashboardBlocks(
          root
        );
      }
    );

  bindLocalTableFilters(
    root
  );
}


function bindLocalTableFilters(
  root
) {
  bindDashboardExcelFilters(
    root
  );
}


/* =========================================================
   FILTROS TIPO EXCEL - TABLAS DASHBOARD
   ========================================================= */

function createDashboardTableState(
  columns
) {
  return {
    openColumn: '',
    filters:
      Object.fromEntries(
        columns.map(column => [
          column.key,
          {
            selected: null,
            search: '',
            from: '',
            to: '',
            min: '',
            max: '',
            sort: ''
          }
        ])
      )
  };
}


function dashboardTableConfig(
  tableName
) {
  if (tableName === 'due') {
    return {
      columns: DUE_TABLE_COLUMNS,
      state: dueTableState
    };
  }

  return {
    columns: SHIPMENT_TABLE_COLUMNS,
    state: shipmentTableState
  };
}


function dashboardColumnConfig(
  tableName,
  key
) {
  return dashboardTableConfig(
    tableName
  ).columns.find(
    column =>
      column.key === key
  );
}


function dashboardTableValue(
  row,
  key
) {
  const amounts =
    shipmentAmounts(
      row
    );

  switch (key) {
    case 'folio':
      return String(
        row.folio || ''
      );

    case 'shipment_date':
      return String(
        row.shipment_date || ''
      ).slice(0, 10);

    case 'due_date':
      return String(
        row.due_date || ''
      ).slice(0, 10);

    case 'client_name':
      return String(
        row.client_name || ''
      );

    case 'amount_mxn':
      return amounts.mxn;

    case 'amount_usd':
      return amounts.usd;

    case 'status':
      return shipmentFinancialStatus(
        row
      );

    case 'days_remaining':
      return daysBetween(
        startOfToday(),
        parseDate(
          row.due_date
        )
      );

    default:
      return '';
  }
}


function dashboardFilterIsActive(
  tableName,
  key
) {
  const filter =
    dashboardTableConfig(
      tableName
    ).state.filters[key];

  if (!filter) {
    return false;
  }

  return Boolean(
    filter.search ||
    filter.from ||
    filter.to ||
    filter.min !== '' ||
    filter.max !== '' ||
    filter.sort ||
    (
      Array.isArray(
        filter.selected
      ) &&
      filter.selected.length
    )
  );
}


function dashboardFilterLabel(
  column,
  value
) {
  if (column.type === 'date') {
    return value
      ? safeDate(value)
      : '(Vacío)';
  }

  if (column.key === 'amount_mxn') {
    return money(
      numeric(value),
      'MXN'
    );
  }

  if (column.key === 'amount_usd') {
    return money(
      numeric(value),
      'USD'
    );
  }

  if (column.key === 'days_remaining') {
    return `${number(
      numeric(value),
      0
    )} día(s)`;
  }

  return String(
    value || '(Vacío)'
  );
}


function dashboardUniqueValues(
  tableName,
  key,
  rows
) {
  const column =
    dashboardColumnConfig(
      tableName,
      key
    );

  const values =
    Array.from(
      new Set(
        rows.map(row =>
          String(
            dashboardTableValue(
              row,
              key
            ) ?? ''
          )
        )
      )
    );

  if (
    column?.type === 'number'
  ) {
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


function dashboardFilterRowMatches(
  row,
  tableName,
  column
) {
  const state =
    dashboardTableConfig(
      tableName
    ).state;

  const filter =
    state.filters[
      column.key
    ];

  const rawValue =
    dashboardTableValue(
      row,
      column.key
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
    column.type === 'text' &&
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

  if (
    column.type === 'date'
  ) {
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

  if (
    column.type === 'number'
  ) {
    const value =
      numeric(rawValue);

    if (
      filter.min !== '' &&
      value <
        numeric(
          filter.min
        )
    ) {
      return false;
    }

    if (
      filter.max !== '' &&
      value >
        numeric(
          filter.max
        )
    ) {
      return false;
    }
  }

  return true;
}


function applyDashboardTableFilters(
  rows,
  tableName
) {
  const config =
    dashboardTableConfig(
      tableName
    );

  const filtered =
    rows.filter(row =>
      config.columns.every(
        column =>
          dashboardFilterRowMatches(
            row,
            tableName,
            column
          )
      )
    );

  const sortColumn =
    config.columns.find(
      column =>
        config.state.filters[
          column.key
        ]?.sort
    );

  if (!sortColumn) {
    return filtered;
  }

  const direction =
    config.state.filters[
      sortColumn.key
    ].sort;

  return filtered
    .slice()
    .sort((a, b) => {
      const valueA =
        dashboardTableValue(
          a,
          sortColumn.key
        );

      const valueB =
        dashboardTableValue(
          b,
          sortColumn.key
        );

      let result = 0;

      if (
        sortColumn.type === 'number'
      ) {
        result =
          numeric(valueA) -
          numeric(valueB);
      } else {
        result =
          String(
            valueA || ''
          ).localeCompare(
            String(
              valueB || ''
            ),
            'es',
            {
              numeric: true,
              sensitivity: 'base'
            }
          );
      }

      return direction === 'desc'
        ? result * -1
        : result;
    });
}


function dashboardFilterHeaderHtml(
  tableName,
  column,
  sourceRows
) {
  const state =
    dashboardTableConfig(
      tableName
    ).state;

  const active =
    dashboardFilterIsActive(
      tableName,
      column.key
    );

  return `
    <th class="${
      active
        ? 'dashboard-excel-filter-active'
        : ''
    }">
      <div class="dashboard-excel-th">
        <span>
          ${escapeHtml(
            column.label
          )}
        </span>

        <button
          class="dashboard-excel-filter-trigger ${
            active
              ? 'active'
              : ''
          }"
          data-dashboard-table="${tableName}"
          data-dashboard-column="${column.key}"
          type="button"
          title="Filtrar ${escapeHtml(
            column.label
          )}"
        >
          ▾
        </button>
      </div>

      ${
        state.openColumn ===
        column.key
          ? dashboardFilterMenuHtml(
              tableName,
              column,
              sourceRows
            )
          : ''
      }
    </th>
  `;
}


function dashboardFilterMenuHtml(
  tableName,
  column,
  sourceRows
) {
  const config =
    dashboardTableConfig(
      tableName
    );

  const filter =
    config.state.filters[
      column.key
    ];

  const values =
    dashboardUniqueValues(
      tableName,
      column.key,
      sourceRows
    );

  const selected =
    Array.isArray(
      filter.selected
    )
      ? filter.selected
      : null;

  return `
    <div
      class="dashboard-excel-filter-menu"
      data-dashboard-filter-menu="${tableName}:${column.key}"
    >
      <div class="dashboard-excel-filter-head">
        <strong>
          ${escapeHtml(
            column.label
          )}
        </strong>

        <button
          class="dashboard-excel-filter-close"
          type="button"
        >
          ×
        </button>
      </div>

      <div class="dashboard-excel-sort-actions">
        <button
          class="btn dashboard-excel-sort"
          data-dashboard-sort-table="${tableName}"
          data-dashboard-sort-column="${column.key}"
          data-dashboard-sort-direction="asc"
          type="button"
        >
          ${
            column.type === 'date'
              ? 'Antigua → reciente'
              : column.type === 'number'
                ? 'Menor → mayor'
                : 'A → Z'
          }
        </button>

        <button
          class="btn dashboard-excel-sort"
          data-dashboard-sort-table="${tableName}"
          data-dashboard-sort-column="${column.key}"
          data-dashboard-sort-direction="desc"
          type="button"
        >
          ${
            column.type === 'date'
              ? 'Reciente → antigua'
              : column.type === 'number'
                ? 'Mayor → menor'
                : 'Z → A'
          }
        </button>
      </div>

      ${
        column.type === 'text'
          ? `
              <input
                class="input dashboard-excel-filter-search"
                data-dashboard-search-table="${tableName}"
                data-dashboard-search-column="${column.key}"
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
        column.type === 'date'
          ? `
              <div class="dashboard-excel-filter-range">
                <label>
                  Desde
                  <input
                    class="input"
                    data-dashboard-from-table="${tableName}"
                    data-dashboard-from-column="${column.key}"
                    type="date"
                    value="${escapeHtml(
                      filter.from || ''
                    )}"
                  >
                </label>

                <label>
                  Hasta
                  <input
                    class="input"
                    data-dashboard-to-table="${tableName}"
                    data-dashboard-to-column="${column.key}"
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
        column.type === 'number'
          ? `
              <div class="dashboard-excel-filter-range">
                <label>
                  Mínimo
                  <input
                    class="input"
                    data-dashboard-min-table="${tableName}"
                    data-dashboard-min-column="${column.key}"
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
                    class="input"
                    data-dashboard-max-table="${tableName}"
                    data-dashboard-max-column="${column.key}"
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

      <label class="dashboard-excel-select-all">
        <input
          class="dashboard-excel-select-all-input"
          data-dashboard-select-all-table="${tableName}"
          data-dashboard-select-all-column="${column.key}"
          type="checkbox"
          ${selected ? '' : 'checked'}
        >
        Seleccionar todo
      </label>

      <div class="dashboard-excel-values">
        ${
          values.length
            ? values.map(value => `
                <label
                  class="dashboard-excel-value"
                >
                  <input
                    class="dashboard-excel-value-input"
                    data-dashboard-value-table="${tableName}"
                    data-dashboard-value-column="${column.key}"
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
                      dashboardFilterLabel(
                        column,
                        value
                      )
                    )}
                  </span>
                </label>
              `).join('')
            : `
                <div class="dashboard-excel-no-values">
                  Sin valores disponibles.
                </div>
              `
        }
      </div>

      <div class="dashboard-excel-filter-actions">
        <button
          class="btn dashboard-excel-clear"
          data-dashboard-clear-table="${tableName}"
          data-dashboard-clear-column="${column.key}"
          type="button"
        >
          Limpiar
        </button>

        <button
          class="btn primary dashboard-excel-apply"
          data-dashboard-apply-table="${tableName}"
          data-dashboard-apply-column="${column.key}"
          type="button"
        >
          Aplicar
        </button>
      </div>
    </div>
  `;
}


function clearDashboardColumnFilter(
  tableName,
  key
) {
  const config =
    dashboardTableConfig(
      tableName
    );

  config.state.filters[key] = {
    selected: null,
    search: '',
    from: '',
    to: '',
    min: '',
    max: '',
    sort: ''
  };
}


function closeDashboardFilterMenus() {
  document
    .querySelectorAll(
      '.dashboard-excel-filter-menu-portal'
    )
    .forEach(menu => {
      menu.remove();
    });
}


function mountDashboardOpenFilterMenu(
  tableName
) {
  const config =
    dashboardTableConfig(
      tableName
    );

  if (!config.state.openColumn) {
    return;
  }

  const trigger =
    document.querySelector(
      `[data-dashboard-table="${tableName}"][data-dashboard-column="${config.state.openColumn}"]`
    );

  const menu =
    document.querySelector(
      `[data-dashboard-filter-menu="${tableName}:${config.state.openColumn}"]`
    );

  if (!trigger || !menu) {
    return;
  }

  const rect =
    trigger.getBoundingClientRect();

  const padding = 12;
  const gap = 7;
  const width =
    Math.min(
      310,
      window.innerWidth -
      padding * 2
    );

  menu.classList.add(
    'dashboard-excel-filter-menu-portal'
  );

  document.body.appendChild(
    menu
  );

  menu.style.width =
    `${width}px`;

  menu.style.visibility =
    'hidden';

  const spaceBelow =
    window.innerHeight -
    rect.bottom -
    padding -
    gap;

  const spaceAbove =
    rect.top -
    padding -
    gap;

  const openAbove =
    spaceBelow < 300 &&
    spaceAbove > spaceBelow;

  const maxHeight =
    Math.max(
      230,
      Math.min(
        500,
        openAbove
          ? spaceAbove
          : spaceBelow
      )
    );

  menu.style.maxHeight =
    `${maxHeight}px`;

  const left =
    Math.min(
      Math.max(
        padding,
        rect.left
      ),
      Math.max(
        padding,
        window.innerWidth -
        width -
        padding
      )
    );

  const top =
    openAbove
      ? Math.max(
          padding,
          rect.top -
          maxHeight -
          gap
        )
      : Math.min(
          rect.bottom + gap,
          window.innerHeight -
          maxHeight -
          padding
        );

  menu.style.left =
    `${left}px`;

  menu.style.top =
    `${Math.max(
      padding,
      top
    )}px`;

  menu.style.visibility =
    'visible';
}


function renderDashboardTable(
  tableName
) {
  closeDashboardFilterMenus();

  if (tableName === 'due') {
    renderDueTable(
      document
    );
  } else {
    renderShipmentTable(
      document
    );
  }

  bindDashboardExcelFilters(
    document
  );

  mountDashboardOpenFilterMenu(
    tableName
  );
}


function bindDashboardExcelFilters(
  root
) {
  root
    .querySelectorAll(
      '.dashboard-excel-filter-trigger'
    )
    .forEach(button => {
      button.onclick =
        event => {
          event.stopPropagation();

          const tableName =
            button.dataset.dashboardTable;

          const key =
            button.dataset.dashboardColumn;

          const state =
            dashboardTableConfig(
              tableName
            ).state;

          state.openColumn =
            state.openColumn === key
              ? ''
              : key;

          renderDashboardTable(
            tableName
          );
        };
    });

  root
    .querySelectorAll(
      '.dashboard-excel-filter-close'
    )
    .forEach(button => {
      button.onclick =
        () => {
          ['shipment', 'due']
            .forEach(tableName => {
              dashboardTableConfig(
                tableName
              ).state.openColumn = '';
            });

          closeDashboardFilterMenus();
          renderShipmentTable(
            document
          );
          renderDueTable(
            document
          );
          bindDashboardExcelFilters(
            document
          );
        };
    });

  root
    .querySelectorAll(
      '.dashboard-excel-filter-menu'
    )
    .forEach(menu => {
      menu.onclick =
        event => {
          event.stopPropagation();
        };
    });

  root
    .querySelectorAll(
      '.dashboard-excel-filter-search'
    )
    .forEach(input => {
      input.oninput =
        () => {
          const tableName =
            input.dataset.dashboardSearchTable;

          const key =
            input.dataset.dashboardSearchColumn;

          dashboardTableConfig(
            tableName
          ).state.filters[key].search =
            input.value;

          const search =
            input.value
              .trim()
              .toLowerCase();

          input
            .closest(
              '.dashboard-excel-filter-menu'
            )
            ?.querySelectorAll(
              '.dashboard-excel-value'
            )
            .forEach(label => {
              label.hidden =
                Boolean(
                  search &&
                  !label.textContent
                    .trim()
                    .toLowerCase()
                    .includes(search)
                );
            });
        };
    });

  root
    .querySelectorAll(
      '.dashboard-excel-select-all-input'
    )
    .forEach(input => {
      input.onchange =
        () => {
          const menu =
            input.closest(
              '.dashboard-excel-filter-menu'
            );

          menu
            ?.querySelectorAll(
              '.dashboard-excel-value'
            )
            .forEach(label => {
              if (label.hidden) {
                return;
              }

              const checkbox =
                label.querySelector(
                  '.dashboard-excel-value-input'
                );

              if (checkbox) {
                checkbox.checked =
                  input.checked;
              }
            });
        };
    });

  root
    .querySelectorAll(
      '.dashboard-excel-sort'
    )
    .forEach(button => {
      button.onclick =
        () => {
          const tableName =
            button.dataset.dashboardSortTable;

          const key =
            button.dataset.dashboardSortColumn;

          const direction =
            button.dataset.dashboardSortDirection;

          const config =
            dashboardTableConfig(
              tableName
            );

          config.columns.forEach(
            column => {
              config.state.filters[
                column.key
              ].sort = '';
            }
          );

          config.state.filters[
            key
          ].sort =
            direction;

          config.state.openColumn = '';

          renderDashboardTable(
            tableName
          );
        };
    });

  root
    .querySelectorAll(
      '.dashboard-excel-clear'
    )
    .forEach(button => {
      button.onclick =
        () => {
          const tableName =
            button.dataset.dashboardClearTable;

          const key =
            button.dataset.dashboardClearColumn;

          clearDashboardColumnFilter(
            tableName,
            key
          );

          dashboardTableConfig(
            tableName
          ).state.openColumn = '';

          renderDashboardTable(
            tableName
          );
        };
    });

  root
    .querySelectorAll(
      '.dashboard-excel-apply'
    )
    .forEach(button => {
      button.onclick =
        () => {
          const tableName =
            button.dataset.dashboardApplyTable;

          const key =
            button.dataset.dashboardApplyColumn;

          const config =
            dashboardTableConfig(
              tableName
            );

          const menu =
            button.closest(
              '.dashboard-excel-filter-menu'
            );

          const allValues =
            Array.from(
              menu?.querySelectorAll(
                '.dashboard-excel-value-input'
              ) || []
            );

          const selected =
            allValues
              .filter(
                input =>
                  input.checked
              )
              .map(
                input =>
                  input.value
              );

          config.state.filters[
            key
          ].selected =
            selected.length ===
            allValues.length
              ? null
              : selected;

          const from =
            menu?.querySelector(
              `[data-dashboard-from-table="${tableName}"][data-dashboard-from-column="${key}"]`
            );

          const to =
            menu?.querySelector(
              `[data-dashboard-to-table="${tableName}"][data-dashboard-to-column="${key}"]`
            );

          const min =
            menu?.querySelector(
              `[data-dashboard-min-table="${tableName}"][data-dashboard-min-column="${key}"]`
            );

          const max =
            menu?.querySelector(
              `[data-dashboard-max-table="${tableName}"][data-dashboard-max-column="${key}"]`
            );

          const search =
            menu?.querySelector(
              `[data-dashboard-search-table="${tableName}"][data-dashboard-search-column="${key}"]`
            );

          config.state.filters[
            key
          ].from =
            from?.value || '';

          config.state.filters[
            key
          ].to =
            to?.value || '';

          config.state.filters[
            key
          ].min =
            min?.value || '';

          config.state.filters[
            key
          ].max =
            max?.value || '';

          config.state.filters[
            key
          ].search =
            search?.value || '';

          config.state.openColumn = '';

          renderDashboardTable(
            tableName
          );
        };
    });
}


/* =========================================================
   3. FILTROS GENERALES

   ========================================================= */

function dashboardFilters() {
  return `
    <section class="card dashboard-v2-filters">

      <div class="dashboard-v2-filter-grid">

        <div class="field">
          <label>
            Siembra / contrato
          </label>

          <select
            class="input"
            id="dashboardPlanting"
          >
            <option value="">
              Todas
            </option>

            ${plantingOptions(
              filtersState.plantingId
            )}
          </select>
        </div>

        <div class="field">
          <label>
            Producto
          </label>

          <select
            class="input"
            id="dashboardProduct"
          >
            <option value="">
              Todos
            </option>

            ${productOptions(
              filtersState.productId
            )}
          </select>
        </div>

        <div class="field">
          <label>
            Fecha inicio
          </label>

          <input
            class="input"
            id="dashboardFrom"
            type="date"
            value="${escapeHtml(
              filtersState.from
            )}"
          >
        </div>

        <div class="field">
          <label>
            Fecha fin
          </label>

          <input
            class="input"
            id="dashboardTo"
            type="date"
            value="${escapeHtml(
              filtersState.to
            )}"
          >
        </div>

      </div>

      <div class="dashboard-v2-filter-actions">
        <span class="dashboard-v2-filter-note">
          Las fechas afectan Remisiones, Gastos y Situación real.
          La Proyección corresponde a la siembra seleccionada.
        </span>

        <button
          class="btn"
          id="dashboardClearFilters"
          type="button"
        >
          Limpiar filtros
        </button>
      </div>

    </section>
  `;
}


function readDashboardFilters(
  root
) {
  return {
    from:
      root
        .getElementById(
          'dashboardFrom'
        )
        ?.value || '',

    to:
      root
        .getElementById(
          'dashboardTo'
        )
        ?.value || '',

    plantingId:
      root
        .getElementById(
          'dashboardPlanting'
        )
        ?.value || '',

    productId:
      root
        .getElementById(
          'dashboardProduct'
        )
        ?.value || ''
  };
}


/* =========================================================
   4. BLOQUES
   ========================================================= */

function dashboardBlocks() {
  const projection =
    calculateProjection();

  const real =
    calculateRealSituation();

  return `
    ${projectionBlock(
      projection
    )}

    ${realBlock(
      real
    )}

    ${shipmentsBlock()}

    ${dueBlock()}
  `;
}


function renderDashboardBlocks(
  root
) {
  const container =
    root.getElementById(
      'dashboardBlocks'
    );

  if (!container) {
    return;
  }

  container.innerHTML =
    dashboardBlocks();

  bindLocalTableFilters(
    root
  );
}


/* =========================================================
   5. BLOQUE 1 - PROYECCIÓN
   ========================================================= */

function projectionBlock(
  projection
) {
  return `
    <section class="card dashboard-v2-section dashboard-v2-projection">

      ${sectionHead(
        '1',
        'Proyección de la siembra',
        'Información registrada en el módulo de Siembras',
        'green',
        projection.meta
      )}

      ${
        projection.count === 0
          ? emptyState(
              'No hay una siembra que coincida con los filtros seleccionados.'
            )
          : `
              <div class="dashboard-v2-table-wrap">

                <table class="dashboard-v2-table projection-dashboard-table">

                  <thead>
                    <tr>
                      <th rowspan="2">
                        Concepto
                      </th>

                      <th colspan="2">
                        Por hectárea
                      </th>

                      <th colspan="2">
                        Por siembra
                      </th>
                    </tr>

                    <tr>
                      <th>MXN</th>
                      <th>USD</th>
                      <th>MXN</th>
                      <th>USD</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td>
                        <strong>
                          Cajas proyectadas
                        </strong>
                      </td>

                      <td colspan="2">
                        ${number(
                          projection.boxesPerHa,
                          0
                        )}
                      </td>

                      <td colspan="2">
                        ${number(
                          projection.boxesTotal,
                          0
                        )}
                      </td>
                    </tr>

                    ${projectionMoneyRow(
                      'Ingresos proyectados',
                      projection.revenueMxnPerHa,
                      projection.revenueUsdPerHa,
                      projection.revenueMxn,
                      projection.revenueUsd
                    )}

                    ${projectionMoneyRow(
                      'Gastos estimados',
                      projection.costMxnPerHa,
                      projection.costUsdPerHa,
                      projection.costMxn,
                      projection.costUsd
                    )}

                    ${projectionMoneyRow(
                      'Utilidad proyectada',
                      projection.profitMxnPerHa,
                      projection.profitUsdPerHa,
                      projection.profitMxn,
                      projection.profitUsd,
                      true
                    )}
                  </tbody>

                </table>

              </div>
            `
      }

    </section>
  `;
}


function projectionMoneyRow(
  label,
  mxnPerHa,
  usdPerHa,
  mxnTotal,
  usdTotal,
  strong = false
) {
  const tagOpen =
    strong ? '<strong>' : '';

  const tagClose =
    strong ? '</strong>' : '';

  return `
    <tr class="${strong
      ? 'dashboard-v2-profit-row'
      : ''}">

      <td>
        ${tagOpen}
          ${label}
        ${tagClose}
      </td>

      <td>
        ${tagOpen}
          ${money(
            mxnPerHa,
            'MXN'
          )}
        ${tagClose}
      </td>

      <td>
        ${tagOpen}
          ${money(
            usdPerHa,
            'USD'
          )}
        ${tagClose}
      </td>

      <td>
        ${tagOpen}
          ${money(
            mxnTotal,
            'MXN'
          )}
        ${tagClose}
      </td>

      <td>
        ${tagOpen}
          ${money(
            usdTotal,
            'USD'
          )}
        ${tagClose}
      </td>

    </tr>
  `;
}


/* =========================================================
   6. BLOQUE 2 - SITUACIÓN REAL
   ========================================================= */

function realBlock(
  real
) {
  return `
    <section class="card dashboard-v2-section dashboard-v2-real">

      ${sectionHead(
        '2',
        'Situación real',
        'Información de Remisiones y Gastos según los filtros seleccionados',
        'blue'
      )}

      <div class="dashboard-v2-kpis">

        ${realKpi(
          'Ingresos esperados',
          real.expectedMxn,
          real.expectedUsd,
          'success'
        )}

        ${realKpi(
          'Ingresos cobrados',
          real.collectedMxn,
          real.collectedUsd,
          'primary'
        )}

        ${realKpi(
          'Pendiente de cobro',
          real.pendingMxn,
          real.pendingUsd,
          'warning'
        )}

        ${realKpi(
          'Gastos',
          real.expensesMxn,
          real.expensesUsd,
          'danger'
        )}

        ${realKpi(
          'Utilidad total',
          real.profitMxn,
          real.profitUsd,
          'profit'
        )}

      </div>

    </section>
  `;
}


function realKpi(
  label,
  mxn,
  usd,
  tone
) {
  return `
    <article class="dashboard-v2-kpi dashboard-v2-kpi-${tone}">

      <span>
        ${label}
      </span>

      <strong>
        ${money(
          mxn,
          'MXN'
        )}
      </strong>

      <small>
        ${money(
          usd,
          'USD'
        )}
      </small>

    </article>
  `;
}


/* =========================================================
   7. BLOQUE 3 - REMISIONES
   ========================================================= */

function shipmentsBlock() {
  return `
    <section class="card dashboard-v2-section">

      ${sectionHead(
        '3',
        'Remisiones',
        'Detalle de remisiones según los filtros seleccionados',
        'dark'
      )}

      <div id="dashboardShipmentTable">
        ${shipmentTableHtml()}
      </div>

    </section>
  `;
}


function renderShipmentTable(
  root
) {
  const container =
    root.getElementById(
      'dashboardShipmentTable'
    );

  if (container) {
    container.innerHTML =
      shipmentTableHtml();
  }
}


function shipmentTableHtml() {
  const sourceRows =
    filteredShipments(
      false
    );

  const rows =
    applyDashboardTableFilters(
      sourceRows,
      'shipment'
    );

  const totals =
    sumShipments(
      rows
    );

  return `
    <div class="dashboard-table-summary">
      <span>
        ${number(
          rows.length,
          0
        )}
        de
        ${number(
          sourceRows.length,
          0
        )}
        remisiones
      </span>
    </div>

    <div class="dashboard-v2-table-scroll dashboard-excel-table-scroll">

      <table class="dashboard-v2-table dashboard-excel-table">

        <thead>
          <tr>
            ${SHIPMENT_TABLE_COLUMNS
              .map(column =>
                dashboardFilterHeaderHtml(
                  'shipment',
                  column,
                  sourceRows
                )
              )
              .join('')}
          </tr>
        </thead>

        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    shipmentRow
                  )
                  .join('')
              : `
                  <tr>
                    <td
                      colspan="6"
                      class="dashboard-table-empty-cell"
                    >
                      No se encontraron remisiones con los filtros seleccionados.
                    </td>
                  </tr>
                `
          }
        </tbody>

        <tfoot>
          <tr>
            <td colspan="3">
              <strong>
                Total general
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

            <td>
              ${number(
                rows.length,
                0
              )} remisiones
            </td>
          </tr>
        </tfoot>

      </table>

    </div>
  `;
}


function shipmentRow(
  row
) {
  const amounts =
    shipmentAmounts(
      row
    );

  return `
    <tr>

      <td>
        <strong>
          ${escapeHtml(
            row.folio || ''
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
          row.client_name || '—'
        )}
      </td>

      <td>
        ${money(
          amounts.mxn,
          'MXN'
        )}
      </td>

      <td>
        ${money(
          amounts.usd,
          'USD'
        )}
      </td>

      <td>
        ${statusBadge(
          shipmentFinancialStatus(
            row
          )
        )}
      </td>

    </tr>
  `;
}


/* =========================================================
   8. BLOQUE 4 - PRÓXIMAS A VENCER
   ========================================================= */

function dueBlock() {
  return `
    <section class="card dashboard-v2-section dashboard-v2-due">

      ${sectionHead(
        '4',
        'Próximas remisiones a vencer',
        'Basado en la fecha de vencimiento y los días de crédito del cliente',
        'red'
      )}

      <div id="dashboardDueTable">
        ${dueTableHtml()}
      </div>

    </section>
  `;
}


function renderDueTable(
  root
) {
  const container =
    root.getElementById(
      'dashboardDueTable'
    );

  if (container) {
    container.innerHTML =
      dueTableHtml();
  }
}


function dueTableHtml() {
  const today =
    startOfToday();

  const sourceRows =
    filteredShipments(
      false
    )
      .filter(row => {
        if (
          shipmentFinancialStatus(
            row
          ) === 'Cobrada'
        ) {
          return false;
        }

        if (!row.due_date) {
          return false;
        }

        const due =
          parseDate(
            row.due_date
          );

        if (!due) {
          return false;
        }

        return (
          daysBetween(
            today,
            due
          ) >= 0
        );
      });

  const rows =
    applyDashboardTableFilters(
      sourceRows,
      'due'
    );

  const totals =
    sumShipments(
      rows
    );

  return `
    <div class="dashboard-table-summary">
      <span>
        ${number(
          rows.length,
          0
        )}
        de
        ${number(
          sourceRows.length,
          0
        )}
        remisiones pendientes
      </span>
    </div>

    <div class="dashboard-v2-table-scroll dashboard-v2-due-scroll dashboard-excel-table-scroll">

      <table class="dashboard-v2-table dashboard-excel-table dashboard-due-excel-table">

        <thead>
          <tr>
            ${DUE_TABLE_COLUMNS
              .map(column =>
                dashboardFilterHeaderHtml(
                  'due',
                  column,
                  sourceRows
                )
              )
              .join('')}
          </tr>
        </thead>

        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    dueRow
                  )
                  .join('')
              : `
                  <tr>
                    <td
                      colspan="7"
                      class="dashboard-table-empty-cell"
                    >
                      No hay remisiones próximas a vencer con los filtros seleccionados.
                    </td>
                  </tr>
                `
          }
        </tbody>

        <tfoot>
          <tr>
            <td colspan="4">
              <strong>
                Total general
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

            <td>
              ${number(
                rows.length,
                0
              )} remisiones
            </td>
          </tr>
        </tfoot>

      </table>

    </div>
  `;
}


function dueRow(
  row
) {
  const amounts =
    shipmentAmounts(
      row
    );

  const days =
    daysBetween(
      startOfToday(),
      parseDate(
        row.due_date
      )
    );

  return `
    <tr>

      <td>
        <strong>
          ${escapeHtml(
            row.folio || ''
          )}
        </strong>
      </td>

      <td>
        ${safeDate(
          row.shipment_date
        )}
      </td>

      <td>
        ${safeDate(
          row.due_date
        )}
      </td>

      <td>
        ${escapeHtml(
          row.client_name || '—'
        )}
      </td>

      <td>
        ${money(
          amounts.mxn,
          'MXN'
        )}
      </td>

      <td>
        ${money(
          amounts.usd,
          'USD'
        )}
      </td>

      <td>
        <span class="dashboard-v2-days ${days <= 7
          ? 'urgent'
          : days <= 15
            ? 'soon'
            : ''}">
          ${days}
        </span>
      </td>

    </tr>
  `;
}


/* =========================================================
   9. CÁLCULOS - PROYECCIÓN
   ========================================================= */

function calculateProjection() {
  const rows =
    filteredPlantings();

  const result = {
    count: rows.length,
    hectares: 0,
    boxesTotal: 0,
    boxesPerHa: 0,

    revenueMxn: 0,
    revenueUsd: 0,
    revenueMxnPerHa: 0,
    revenueUsdPerHa: 0,

    costMxn: 0,
    costUsd: 0,
    costMxnPerHa: 0,
    costUsdPerHa: 0,

    profitMxn: 0,
    profitUsd: 0,
    profitMxnPerHa: 0,
    profitUsdPerHa: 0,

    meta: ''
  };

  rows.forEach(row => {
    const hectares =
      numeric(
        row.hectares
      );

    const boxes =
      numeric(
        row.projected_boxes
      ) ||
      (
        hectares *
        numeric(
          row.expected_yield_boxes_ha
        )
      );

    const rate =
      numeric(
        row.projection_exchange_rate
      );

    const revenueOriginal =
      numeric(
        row.projected_revenue
      ) ||
      (
        boxes *
        numeric(
          row.price_per_box
        )
      );

    const revenue =
      convertBoth(
        revenueOriginal,
        row.price_currency || 'USD',
        rate
      );

    const costs =
      sumEstimatedCosts(
        row.estimated_costs || [],
        rate
      );

    result.hectares +=
      hectares;

    result.boxesTotal +=
      boxes;

    result.revenueMxn +=
      revenue.mxn;

    result.revenueUsd +=
      revenue.usd;

    result.costMxn +=
      costs.mxn;

    result.costUsd +=
      costs.usd;
  });

  if (result.hectares > 0) {
    result.boxesPerHa =
      result.boxesTotal /
      result.hectares;

    result.revenueMxnPerHa =
      result.revenueMxn /
      result.hectares;

    result.revenueUsdPerHa =
      result.revenueUsd /
      result.hectares;

    result.costMxnPerHa =
      result.costMxn /
      result.hectares;

    result.costUsdPerHa =
      result.costUsd /
      result.hectares;
  }

  result.profitMxn =
    result.revenueMxn -
    result.costMxn;

  result.profitUsd =
    result.revenueUsd -
    result.costUsd;

  if (result.hectares > 0) {
    result.profitMxnPerHa =
      result.profitMxn /
      result.hectares;

    result.profitUsdPerHa =
      result.profitUsd /
      result.hectares;
  }

  if (rows.length === 1) {
    const row =
      rows[0];

    result.meta = `
      Contrato ${escapeHtml(
        row.contract_number || ''
      )}
      · ${number(
        row.hectares,
        2
      )} ha
      · TC ${number(
        row.projection_exchange_rate,
        2
      )} MXN/USD
    `;
  } else if (rows.length > 1) {
    result.meta = `
      ${number(
        rows.length,
        0
      )} siembras
      · ${number(
        result.hectares,
        2
      )} ha
    `;
  }

  return result;
}


function sumEstimatedCosts(
  costs,
  exchangeRate
) {
  return costs.reduce(
    (sum, cost) => {
      const converted =
        convertBoth(
          numeric(
            cost.amount
          ),
          cost.currency || 'MXN',
          exchangeRate
        );

      sum.mxn +=
        converted.mxn;

      sum.usd +=
        converted.usd;

      return sum;
    },
    {
      mxn: 0,
      usd: 0
    }
  );
}


/* =========================================================
   10. CÁLCULOS - SITUACIÓN REAL
   ========================================================= */

function calculateRealSituation() {
  const shipments =
    filteredShipments(
      false
    );

  const expenses =
    filteredExpenses();

  const expected =
    sumShipments(
      shipments
    );

  const collected =
    shipments.reduce(
      (sum, row) => {
        const amount =
          shipmentCollectedAmounts(
            row
          );

        sum.mxn +=
          amount.mxn;

        sum.usd +=
          amount.usd;

        return sum;
      },
      {
        mxn: 0,
        usd: 0
      }
    );

  const expenseTotals =
    expenses.reduce(
      (sum, row) => {
        const converted =
          expenseAmounts(
            row
          );

        sum.mxn +=
          converted.mxn;

        sum.usd +=
          converted.usd;

        return sum;
      },
      {
        mxn: 0,
        usd: 0
      }
    );

  return {
    expectedMxn:
      expected.mxn,

    expectedUsd:
      expected.usd,

    collectedMxn:
      collected.mxn,

    collectedUsd:
      collected.usd,

    pendingMxn:
      Math.max(
        expected.mxn -
        collected.mxn,
        0
      ),

    pendingUsd:
      Math.max(
        expected.usd -
        collected.usd,
        0
      ),

    expensesMxn:
      expenseTotals.mxn,

    expensesUsd:
      expenseTotals.usd,

    profitMxn:
      collected.mxn -
      expenseTotals.mxn,

    profitUsd:
      collected.usd -
      expenseTotals.usd
  };
}


/* =========================================================
   11. FILTROS DE DATOS
   ========================================================= */

function filteredPlantings() {
  return (
    dashboardData?.plantings ||
    []
  ).filter(row => {
    if (
      filtersState.plantingId &&
      String(row.id) !==
        String(
          filtersState.plantingId
        )
    ) {
      return false;
    }

    if (
      filtersState.productId &&
      String(
        row.planting_product_id ??
        row.product_id
      ) !==
        String(
          filtersState.productId
        )
    ) {
      return false;
    }

    return true;
  });
}


function filteredShipments(
  includeLocalFilters
) {
  return (
    dashboardData?.shipments ||
    []
  ).filter(row => {
    if (
      row.status === 'Cancelada'
    ) {
      return false;
    }

    if (
      filtersState.plantingId &&
      String(row.planting_id) !==
        String(
          filtersState.plantingId
        )
    ) {
      return false;
    }

    if (
      filtersState.productId &&
      String(
        row.planting_product_id ??
        row.product_id
      ) !==
        String(
          filtersState.productId
        )
    ) {
      return false;
    }

    if (
      !dateInside(
        row.shipment_date,
        filtersState.from,
        filtersState.to
      )
    ) {
      return false;
    }

    return true;
  });
}


function filteredExpenses() {
  return (
    dashboardData?.expenses ||
    []
  ).filter(row => {
    if (
      filtersState.plantingId &&
      String(row.planting_id) !==
        String(
          filtersState.plantingId
        )
    ) {
      return false;
    }

    if (
      filtersState.productId &&
      String(row.product_id) !==
        String(
          filtersState.productId
        )
    ) {
      return false;
    }

    return dateInside(
      row.expense_date,
      filtersState.from,
      filtersState.to
    );
  });
}


/* =========================================================
   12. MONTOS Y MONEDAS
   ========================================================= */

function shipmentAmounts(
  row
) {
  const amount =
    numeric(
      row.total_amount
    ) ||
    numeric(
      row.amount
    ) ||
    (
      numeric(row.boxes) *
      numeric(
        row.price_per_box
      )
    );

  return convertBoth(
    amount,
    row.currency || 'USD',
    numeric(
      row.exchange_rate
    ) ||
    numeric(
      row.projection_exchange_rate
    )
  );
}


function shipmentCollectedAmounts(
  row
) {
  const total =
    shipmentAmounts(
      row
    );

  const collectedOriginal =
    Math.min(
      numeric(
        row.collected_amount
      ),
      numeric(
        row.total_amount
      ) ||
      numeric(
        row.amount
      ) ||
      (
        numeric(row.boxes) *
        numeric(
          row.price_per_box
        )
      )
    );

  if (collectedOriginal <= 0) {
    return {
      mxn: 0,
      usd: 0
    };
  }

  const converted =
    convertBoth(
      collectedOriginal,
      row.currency || 'USD',
      numeric(
        row.exchange_rate
      ) ||
      numeric(
        row.projection_exchange_rate
      )
    );

  if (
    shipmentFinancialStatus(
      row
    ) === 'Cobrada'
  ) {
    return total;
  }

  return converted;
}


function expenseAmounts(
  row
) {
  const amount =
    numeric(
      row.amount
    );

  const rate =
    numeric(
      row.exchange_rate
    ) ||
    numeric(
      row.projection_exchange_rate
    );

  if (
    row.currency === 'USD'
  ) {
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

  return {
    mxn: amount,
    usd:
      rate > 0
        ? amount / rate
        : 0
  };
}


function convertBoth(
  amount,
  currency,
  exchangeRate
) {
  const value =
    numeric(
      amount
    );

  const rate =
    numeric(
      exchangeRate
    );

  if (currency === 'MXN') {
    return {
      mxn: value,
      usd:
        rate > 0
          ? value / rate
          : 0
    };
  }

  return {
    usd: value,
    mxn:
      rate > 0
        ? value * rate
        : 0
  };
}


/* =========================================================
   13. ESTATUS Y TOTALES
   ========================================================= */

function shipmentFinancialStatus(
  row
) {
  const total =
    numeric(
      row.total_amount
    ) ||
    numeric(
      row.amount
    ) ||
    (
      numeric(row.boxes) *
      numeric(
        row.price_per_box
      )
    );

  const collected =
    numeric(
      row.collected_amount
    );

  if (
    row.status === 'Cobrada' ||
    row.status === 'Aplicada' ||
    (
      total > 0 &&
      collected >= total
    )
  ) {
    return 'Cobrada';
  }

  if (collected > 0) {
    return 'Parcial';
  }

  return 'Pendiente';
}


function sumShipments(
  rows
) {
  return rows.reduce(
    (sum, row) => {
      const amount =
        shipmentAmounts(
          row
        );

      sum.mxn +=
        amount.mxn;

      sum.usd +=
        amount.usd;

      return sum;
    },
    {
      mxn: 0,
      usd: 0
    }
  );
}







/* =========================================================
   14. OPCIONES DE FILTROS

   ========================================================= */

function plantingOptions(
  selected
) {
  return (
    dashboardData?.plantings ||
    []
  )
    .slice()
    .sort((a, b) => {
      return String(
        a.contract_number || ''
      ).localeCompare(
        String(
          b.contract_number || ''
        ),
        undefined,
        {
          numeric: true
        }
      );
    })
    .map(row => {
      return `
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
          ${row.product_name
            ? ` · ${escapeHtml(
                row.product_name
              )}`
            : ''}
        </option>
      `;
    })
    .join('');
}


function productOptions(
  selected
) {
  return (
    dashboardData?.products ||
    []
  )
    .map(row => {
      return `
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
      `;
    })
    .join('');
}








/* =========================================================
   15. COMPONENTES VISUALES
   ========================================================= */

function sectionHead(
  numberValue,
  title,
  subtitle,
  tone,
  meta = ''
) {
  return `
    <div class="dashboard-v2-section-head">

      <div class="dashboard-v2-section-title">

        <span class="dashboard-v2-number dashboard-v2-number-${tone}">
          ${numberValue}
        </span>

        <div>
          <h2>
            ${title}
          </h2>

          <p>
            ${subtitle}
          </p>
        </div>

      </div>

      ${
        meta
          ? `
              <div class="dashboard-v2-meta">
                ${meta}
              </div>
            `
          : ''
      }

    </div>
  `;
}


function statusBadge(
  status
) {
  const css =
    status === 'Cobrada'
      ? 'paid'
      : status === 'Parcial'
        ? 'partial'
        : 'pending';

  return `
    <span class="dashboard-v2-status ${css}">
      ${status}
    </span>
  `;
}


function emptyState(
  text
) {
  return `
    <div class="dashboard-v2-empty">
      ${text}
    </div>
  `;
}


/* =========================================================
   16. FECHAS
   ========================================================= */

function dateInside(
  value,
  from,
  to
) {
  if (!value) {
    return false;
  }

  const current =
    String(value)
      .slice(0, 10);

  if (
    from &&
    current < from
  ) {
    return false;
  }

  if (
    to &&
    current > to
  ) {
    return false;
  }

  return true;
}


function parseDate(
  value
) {
  if (!value) {
    return null;
  }

  const parts =
    String(value)
      .slice(0, 10)
      .split('-')
      .map(Number);

  if (parts.length !== 3) {
    return null;
  }

  return new Date(
    parts[0],
    parts[1] - 1,
    parts[2]
  );
}


function startOfToday() {
  const now =
    new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
}


function daysBetween(
  from,
  to
) {
  if (!from || !to) {
    return 0;
  }

  return Math.ceil(
    (
      to.getTime() -
      from.getTime()
    ) /
    86400000
  );
}


function safeDate(
  value
) {
  if (!value) {
    return '—';
  }

  try {
    return date(
      value
    );
  } catch {
    return String(value);
  }
}


/* =========================================================
   17. UTILIDADES
   ========================================================= */

function numeric(
  value
) {
  const result =
    Number(
      value || 0
    );

  return Number.isFinite(
    result
  )
    ? result
    : 0;
}


function emptyDashboardData() {
  return {
    plantings: [],
    products: [],
    clients: [],
    shipments: [],
    expenses: []
  };
}
