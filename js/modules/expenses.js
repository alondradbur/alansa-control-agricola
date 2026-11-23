/* =========================================================
   SISTEMA DE CONTROL AGRÍCOLA
   MÓDULO: GASTOS

   Funciones:
   - Consultar gastos.
   - Registrar gastos.
   - Editar gastos.
   - Eliminar gastos.
   - Manejar MXN y USD.
   - Calcular equivalente en MXN cuando corresponde.
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

let rerenderModule = null;

let outsideCloseBound = false;

/*
 * Filtros por columna (combinables).
 * search: texto que debe contener la columna.
 * selected: valores marcados en la lista.
 */
let tableState = {
  search: {},
  selected: {},
  sortKey: '',
  sortDirection: 'asc',
  openColumn: ''
};

const COLUMNS = [
  { key: 'expense_date', label: 'Fecha', type: 'date' },
  { key: 'contract_number', label: 'Siembra', type: 'text' },
  { key: 'category_name', label: 'Categoría', type: 'text' },
  { key: 'supplier_name', label: 'Proveedor', type: 'text' },
  { key: 'concept', label: 'Concepto', type: 'text' },
  { key: 'amount', label: 'Importe', type: 'number' },
  { key: 'exchange_rate', label: 'Tipo de cambio', type: 'number' },
  { key: 'mxn_equivalent', label: 'Equivalente MXN', type: 'number' },
  { key: 'payment_method_name', label: 'Método de pago', type: 'text' }
];

let catalogs = {
  plantings: [],
  expense_categories: [],
  expense_units: [],
  suppliers: [],
  payment_methods: []
};


/* =========================================================
   3. RENDER PRINCIPAL
   ========================================================= */

export async function expenses() {
  try {
    const responses = await Promise.all([
      api('expenses'),
      api('catalogs'),
      api('plantings')
    ]);

    rows = responses[0] || [];

    const catalogData = responses[1] || {};
    const plantingData = responses[2] || [];

    catalogs = {
      plantings: plantingData,
      expense_categories:
        catalogData.expense_categories || [],
      expense_units:
        catalogData.expense_units || [],
      suppliers:
        catalogData.suppliers || [],
      payment_methods:
        catalogData.payment_methods || []
    };
  } catch {
    rows = [];

    catalogs = {
      plantings: [],
      expense_categories: [],
      expense_units: [],
      suppliers: [],
      payment_methods: []
    };
  }

  return `
    ${moduleHeader(
      'Gastos',
      'Costos por siembra y categoría',
      `
        <button
          class="btn primary"
          id="newExpenseBtn"
          type="button"
        >
          ＋ Nuevo gasto
        </button>
      `
    )}

    <div class="content">

      <div id="expensesSummary">
        ${summaryCards()}
      </div>

      <section class="card table-card">

        <div id="expensesTableArea">
          ${tableArea()}
        </div>

      </section>

    </div>

    <div id="expenseModalRoot"></div>
  `;
}


/* =========================================================
   4. RESUMEN
   ========================================================= */

function summaryCards() {
  const list = visibleRows();

  const filtered = hasActiveFilters();

  const scopeNote = filtered
    ? `Filtrado: ${list.length} de ${rows.length} gastos`
    : '';

  const totals = list.reduce(
    (accumulator, row) => {
      const amount = numeric(
        row.amount
      );

      const mxnEquivalent = numeric(
        row.mxn_equivalent
      );

      if (row.currency === 'USD') {
        accumulator.usd += amount;
      } else {
        accumulator.mxn += amount;
      }

      accumulator.mxnEquivalent +=
        mxnEquivalent;

      return accumulator;
    },
    {
      usd: 0,
      mxn: 0,
      mxnEquivalent: 0
    }
  );

  return `
    <section class="dashboard-kpis">

      <article class="card dashboard-kpi dashboard-kpi-neutral">
        <div class="dashboard-kpi-label">
          Gastos MXN
        </div>

        <div class="dashboard-kpi-value">
          ${money(
            totals.mxn,
            'MXN'
          )}
        </div>

        <div class="dashboard-kpi-meta">
          ${scopeNote || 'Importe registrado en pesos'}
        </div>
      </article>

      <article class="card dashboard-kpi dashboard-kpi-neutral">
        <div class="dashboard-kpi-label">
          Gastos USD
        </div>

        <div class="dashboard-kpi-value">
          ${money(
            totals.usd,
            'USD'
          )}
        </div>

        <div class="dashboard-kpi-meta">
          ${scopeNote || 'Importe registrado en dólares'}
        </div>
      </article>

      <article class="card dashboard-kpi dashboard-kpi-primary">
        <div class="dashboard-kpi-label">
          Equivalente MXN
        </div>

        <div class="dashboard-kpi-value">
          ${money(
            totals.mxnEquivalent,
            'MXN'
          )}
        </div>

        <div class="dashboard-kpi-meta">
          ${scopeNote || 'Según tipo de cambio capturado'}
        </div>
      </article>

    </section>
  `;
}


/* =========================================================
   5. TABLA DE ESCRITORIO
   ========================================================= */

function emptyMessage() {
  return rows.length
    ? 'Ningún gasto coincide con los filtros.'
    : 'Todavía no hay gastos registrados.';
}

function tableArea() {
  const filtered = hasActiveFilters();

  const list = visibleRows();

  return `
    <div class="table-toolbar expenses-toolbar">
      <strong>
        Gastos registrados
      </strong>

      <div class="expenses-toolbar-meta">
        <span class="muted">
          ${filtered
            ? `${list.length} de ${rows.length}`
            : `${rows.length}`
          }
          ${rows.length === 1 ? 'gasto' : 'gastos'}
        </span>

        ${filtered
          ? `
            <button
              class="btn soft"
              id="clearExpenseFilters"
              type="button"
            >
              Quitar filtros
            </button>
          `
          : ''
        }
      </div>
    </div>

    <div class="expenses-filter-chips">
      ${COLUMNS.map(column => {
        const active = isColumnActive(
          column.key
        );

        return `
          <button
            class="expenses-filter-chip ${active ? 'active' : ''}"
            data-expense-column="${column.key}"
            type="button"
          >
            ${escapeHtml(column.label)} ⌄
          </button>
        `;
      }).join('')}
    </div>

    ${desktopTable(list)}

    ${mobileList(list)}
  `;
}

function headerCell(
  column
) {
  const active = isColumnActive(
    column.key
  );

  const sorted =
    tableState.sortKey === column.key
      ? (tableState.sortDirection === 'asc' ? ' ↑' : ' ↓')
      : '';

  return `
    <th>
      <div class="collections-th">
        <span>${escapeHtml(column.label)}${sorted}</span>
        <button
          class="collections-filter-trigger ${active ? 'active' : ''}"
          data-expense-column="${column.key}"
          type="button"
          aria-label="Filtrar ${escapeHtml(column.label)}"
        >⌄</button>
      </div>
    </th>
  `;
}

function desktopTable(
  list
) {
  const body = list.length
    ? list
        .map(row => desktopRow(row))
        .join('')
    : `
        <tr>
          <td colspan="10">
            ${empty(
              emptyMessage()
            )}
          </td>
        </tr>
      `;

  return `
    <div class="table-scroll desktop-table">

      <table class="expenses-table">

        <thead>
          <tr>
            ${COLUMNS.map(headerCell).join('')}
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          ${body}
        </tbody>

      </table>

    </div>
  `;
}


function desktopRow(
  row
) {
  return `
    <tr>

      <td>
        ${date(
          row.expense_date
        )}
      </td>

      <td>
        ${escapeHtml(
          row.contract_number || '—'
        )}
      </td>

      <td>
        ${escapeHtml(
          row.category_name || '—'
        )}
      </td>

      <td>
        ${escapeHtml(
          row.supplier_name || '—'
        )}
      </td>

      <td>
        ${escapeHtml(
          row.concept || '—'
        )}
      </td>

      <td>
        <strong>
          ${money(
            row.amount,
            row.currency
          )}
        </strong>
      </td>

      <td>
        ${row.exchange_rate
          ? number(
              row.exchange_rate,
              4
            )
          : '—'
        }
      </td>

      <td>
        ${row.mxn_equivalent !== null &&
        row.mxn_equivalent !== undefined
          ? money(
              row.mxn_equivalent,
              'MXN'
            )
          : '—'
        }
      </td>

      <td>
        ${escapeHtml(
          row.payment_method_name || '—'
        )}
      </td>

      <td>
        ${actionButtons(
          row.id
        )}
      </td>

    </tr>
  `;
}


/* =========================================================
   6. LISTA MÓVIL
   ========================================================= */

function mobileList(
  list
) {
  if (!list.length) {
    return `
      <div class="mobile-records">
        ${empty(
          emptyMessage()
        )}
      </div>
    `;
  }

  return `
    <div class="mobile-records">

      ${list
        .map(row => {
          return `
            <article class="mobile-record">

              <div class="mobile-record-top">

                <div>
                  <div class="mobile-record-title">
                    ${escapeHtml(
                      row.concept ||
                      row.category_name ||
                      'Gasto'
                    )}
                  </div>

                  <div class="muted">
                    ${date(
                      row.expense_date
                    )}
                    ·
                    ${escapeHtml(
                      row.category_name || 'Sin categoría'
                    )}
                  </div>
                </div>

                <div class="mobile-record-amount">
                  ${money(
                    row.amount,
                    row.currency
                  )}
                </div>

              </div>

              <div class="mobile-record-meta">

                <div class="mobile-record-data">
                  <span>
                    Siembra
                  </span>

                  <strong>
                    ${escapeHtml(
                      row.contract_number || '—'
                    )}
                  </strong>
                </div>

                <div class="mobile-record-data">
                  <span>
                    Proveedor
                  </span>

                  <strong>
                    ${escapeHtml(
                      row.supplier_name || '—'
                    )}
                  </strong>
                </div>

                <div class="mobile-record-data">
                  <span>
                    Equivalente MXN
                  </span>

                  <strong>
                    ${
                      row.mxn_equivalent !== null &&
                      row.mxn_equivalent !== undefined
                        ? money(
                            row.mxn_equivalent,
                            'MXN'
                          )
                        : '—'
                    }
                  </strong>
                </div>

                <div class="mobile-record-data">
                  <span>
                    Método
                  </span>

                  <strong>
                    ${escapeHtml(
                      row.payment_method_name || '—'
                    )}
                  </strong>
                </div>

              </div>

              <div class="expense-mobile-actions">
                ${actionButtons(
                  row.id
                )}
              </div>

            </article>
          `;
        })
        .join('')}

    </div>
  `;
}


/* =========================================================
   7. BOTONES DE ACCIÓN
   ========================================================= */

function actionButtons(
  id
) {
  return `
    <div class="row-actions">

      <button
        class="btn soft edit-expense"
        type="button"
        data-id="${id}"
      >
        Editar
      </button>

      <button
        class="btn danger delete-expense"
        type="button"
        data-id="${id}"
      >
        Eliminar
      </button>

    </div>
  `;
}


/* =========================================================
   8. EVENTOS DEL MÓDULO
   ========================================================= */

export function bindExpenses(
  rerender
) {
  rerenderModule = rerender;

  closeFilterMenu();

  bindOutsideClose();

  document
    .querySelector(
      '#newExpenseBtn'
    )
    ?.addEventListener(
      'click',
      () => {
        openExpenseForm(
          rerender
        );
      }
    );

  bindTableEvents();
}


function bindTableEvents() {
  const rerender = rerenderModule;

  document
    .querySelector(
      '#clearExpenseFilters'
    )
    ?.addEventListener(
      'click',
      () => {
        tableState.search = {};
        tableState.selected = {};
        renderDynamic();
      }
    );

  document
    .querySelectorAll(
      '[data-expense-column]'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        event => {
          event.preventDefault();
          event.stopPropagation();

          const key =
            button.dataset.expenseColumn;

          const isSame =
            tableState.openColumn === key;

          closeFilterMenu();

          if (!isSame) {
            openFilterMenu(
              key,
              button
            );
          }
        }
      );
    });

  document
    .querySelectorAll(
      '.edit-expense'
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

          if (row) {
            openExpenseForm(
              rerender,
              row
            );
          }
        }
      );
    });

  document
    .querySelectorAll(
      '.delete-expense'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        async () => {
          await removeExpense(
            Number(
              button.dataset.id
            ),
            rerender
          );
        }
      );
    });
}


/* =========================================================
   8.1 FILTROS POR COLUMNA
   ========================================================= */

function isColumnActive(
  key
) {
  return Boolean(
    tableState.search[key] ||
    tableState.selected[key]?.length
  );
}

function hasActiveFilters() {
  return COLUMNS.some(column => {
    return isColumnActive(
      column.key
    );
  });
}

function filterDisplay(
  row,
  column
) {
  const value = row[column.key];

  const missing =
    value === null ||
    value === undefined ||
    value === '';

  if (column.key === 'amount') {
    return money(
      value,
      row.currency || 'MXN'
    );
  }

  if (missing) {
    return '—';
  }

  if (column.key === 'expense_date') {
    return date(value);
  }

  if (column.key === 'exchange_rate') {
    return number(value, 4);
  }

  if (column.key === 'mxn_equivalent') {
    return money(value, 'MXN');
  }

  return String(value);
}

function sortValue(
  row,
  column
) {
  if (column.key === 'amount') {
    return `${row.currency || 'MXN'}|${numeric(row.amount).toFixed(2).padStart(20, '0')}`;
  }

  return row[column.key];
}

function compareValues(
  a,
  b,
  type
) {
  if (type === 'number') {
    const aMissing = a === null || a === undefined || a === '';
    const bMissing = b === null || b === undefined || b === '';

    if (aMissing || bMissing) {
      return Number(aMissing) - Number(bMissing);
    }

    if (typeof a === 'string' && a.includes('|')) {
      return a.localeCompare(b);
    }

    return numeric(a) - numeric(b);
  }

  return String(a ?? '').localeCompare(
    String(b ?? ''),
    'es',
    { numeric: true }
  );
}

function matchesColumn(
  row,
  column
) {
  const search = String(
    tableState.search[column.key] || ''
  ).trim().toLowerCase();

  const selected =
    tableState.selected[column.key];

  const display = filterDisplay(
    row,
    column
  );

  if (
    search &&
    !display.toLowerCase().includes(search)
  ) {
    return false;
  }

  if (
    selected?.length &&
    !selected.includes(display)
  ) {
    return false;
  }

  return true;
}

/*
 * Filas que pasan todos los filtros excepto
 * el de una columna: sirve para que la lista
 * de valores de cada filtro muestre solo lo
 * que existe con los demás filtros aplicados.
 */
function rowsExcept(
  exceptKey
) {
  return rows.filter(row => {
    return COLUMNS.every(column => {
      return column.key === exceptKey ||
        matchesColumn(row, column);
    });
  });
}

function visibleRows() {
  let list = rowsExcept('');

  const column = COLUMNS.find(item => {
    return item.key === tableState.sortKey;
  });

  if (column) {
    list = [...list].sort((a, b) => {
      return compareValues(
        sortValue(a, column),
        sortValue(b, column),
        column.type
      );
    });

    if (tableState.sortDirection === 'desc') {
      list.reverse();
    }
  }

  return list;
}

function filterMenu(
  column
) {
  const seen = new Map();

  rowsExcept(column.key).forEach(row => {
    const display = filterDisplay(
      row,
      column
    );

    if (!seen.has(display)) {
      seen.set(
        display,
        sortValue(row, column)
      );
    }
  });

  (tableState.selected[column.key] || [])
    .forEach(value => {
      if (!seen.has(value)) {
        seen.set(value, value);
      }
    });

  const values = [...seen.entries()]
    .sort((a, b) => {
      return compareValues(
        a[1],
        b[1],
        column.type
      );
    })
    .map(entry => entry[0]);

  const selected =
    tableState.selected[column.key] || [];

  const ascLabel =
    column.type === 'date'
      ? 'Más antiguo primero'
      : column.type === 'number'
        ? 'Menor a mayor'
        : 'Ordenar A → Z';

  const descLabel =
    column.type === 'date'
      ? 'Más reciente primero'
      : column.type === 'number'
        ? 'Mayor a menor'
        : 'Ordenar Z → A';

  return `
    <div class="collections-filter-menu collections-filter-menu-portal expenses-filter-menu" data-expense-menu="${column.key}">

      <strong class="expenses-filter-title">
        ${escapeHtml(column.label)}
      </strong>

      <button class="collections-sort" data-expense-sort="asc" type="button">
        ${ascLabel}
      </button>

      <button class="collections-sort" data-expense-sort="desc" type="button">
        ${descLabel}
      </button>

      <input
        class="collections-filter-search"
        data-expense-search
        type="search"
        placeholder="Buscar..."
        value="${escapeHtml(tableState.search[column.key] || '')}"
      >

      <div class="collections-filter-values">
        ${values.length
          ? values.map(value => `
            <label>
              <input
                type="checkbox"
                data-expense-value
                value="${escapeHtml(value)}"
                ${selected.includes(value) ? 'checked' : ''}
              >
              <span>${escapeHtml(value)}</span>
            </label>
          `).join('')
          : '<span class="muted">Sin valores</span>'
        }
      </div>

      <div class="collections-filter-actions">
        <button class="btn" data-expense-clear type="button">Limpiar</button>
        <button class="btn primary" data-expense-apply type="button">Aplicar</button>
      </div>

    </div>
  `;
}

function openFilterMenu(
  key,
  trigger
) {
  const column = COLUMNS.find(item => {
    return item.key === key;
  });

  if (!column) {
    return;
  }

  tableState.openColumn = key;

  const holder = document.createElement('div');

  holder.innerHTML = filterMenu(column).trim();

  const menu = holder.firstElementChild;

  document.body.appendChild(menu);

  positionMenu(
    menu,
    trigger.closest('th') || trigger
  );

  menu.addEventListener('click', event => {
    event.stopPropagation();
  });

  const search = menu.querySelector(
    '[data-expense-search]'
  );

  const labels = [
    ...menu.querySelectorAll(
      '.collections-filter-values label'
    )
  ];

  // La búsqueda va acotando la lista de valores.
  const narrow = () => {
    const text = search.value
      .trim()
      .toLowerCase();

    labels.forEach(label => {
      label.hidden = Boolean(text) &&
        !label.textContent
          .toLowerCase()
          .includes(text);
    });
  };

  narrow();

  search.addEventListener('input', narrow);

  const apply = () => {
    tableState.search[key] =
      search.value.trim();

    tableState.selected[key] = [
      ...menu.querySelectorAll(
        '[data-expense-value]:checked'
      )
    ].map(input => input.value);

    if (!tableState.search[key]) {
      delete tableState.search[key];
    }

    if (!tableState.selected[key].length) {
      delete tableState.selected[key];
    }

    closeFilterMenu();
    renderDynamic();
  };

  search.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      apply();
    }
  });

  menu
    .querySelector('[data-expense-apply]')
    .addEventListener('click', apply);

  menu
    .querySelector('[data-expense-clear]')
    .addEventListener('click', () => {
      delete tableState.search[key];
      delete tableState.selected[key];

      closeFilterMenu();
      renderDynamic();
    });

  menu
    .querySelectorAll('[data-expense-sort]')
    .forEach(button => {
      button.addEventListener('click', () => {
        tableState.sortKey = key;
        tableState.sortDirection =
          button.dataset.expenseSort;

        closeFilterMenu();
        renderDynamic();
      });
    });

  if (window.matchMedia('(min-width: 761px)').matches) {
    search.focus();
  }
}

function positionMenu(
  menu,
  anchor
) {
  const rect = anchor.getBoundingClientRect();

  const padding = 12;
  const gap = 7;

  const width = Math.min(
    300,
    window.innerWidth - padding * 2
  );

  const maxHeight = Math.min(
    440,
    window.innerHeight - padding * 2
  );

  menu.style.width = `${width}px`;
  menu.style.maxHeight = `${maxHeight}px`;
  menu.style.visibility = 'hidden';

  const height = Math.min(
    menu.getBoundingClientRect().height,
    maxHeight
  );

  let left = rect.left;

  if (left + width > window.innerWidth - padding) {
    left = rect.right - width;
  }

  left = Math.max(
    padding,
    Math.min(
      left,
      window.innerWidth - width - padding
    )
  );

  const spaceBelow =
    window.innerHeight - rect.bottom - padding - gap;

  const spaceAbove =
    rect.top - padding - gap;

  let top =
    height <= spaceBelow || spaceBelow >= spaceAbove
      ? rect.bottom + gap
      : rect.top - height - gap;

  top = Math.max(
    padding,
    Math.min(
      top,
      window.innerHeight - height - padding
    )
  );

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.visibility = 'visible';
}

function closeFilterMenu() {
  tableState.openColumn = '';

  document
    .querySelectorAll(
      '.expenses-filter-menu'
    )
    .forEach(menu => menu.remove());
}

function bindOutsideClose() {
  if (outsideCloseBound) {
    return;
  }

  outsideCloseBound = true;

  document.addEventListener('click', () => {
    if (tableState.openColumn) {
      closeFilterMenu();
    }
  });

  document.addEventListener('keydown', event => {
    if (
      event.key === 'Escape' &&
      tableState.openColumn
    ) {
      closeFilterMenu();
    }
  });
}

function renderDynamic() {
  const summary = document.getElementById(
    'expensesSummary'
  );

  const table = document.getElementById(
    'expensesTableArea'
  );

  if (summary) {
    summary.innerHTML = summaryCards();
  }

  if (table) {
    table.innerHTML = tableArea();
  }

  bindTableEvents();
}


/* =========================================================
   9. FORMULARIO NUEVO / EDITAR
   ========================================================= */

function openExpenseForm(
  rerender,
  row = null
) {
  const editing = Boolean(
    row?.id
  );

  const modalRoot = document.querySelector(
    '#expenseModalRoot'
  );

  if (!modalRoot) {
    return;
  }

  const currency =
    row?.currency || 'MXN';

  modalRoot.innerHTML = `
    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-head">

          <div>
            <h2>
              ${
                editing
                  ? 'Editar gasto'
                  : 'Nuevo gasto'
              }
            </h2>

            <p class="muted">
              ${
                editing
                  ? 'Modifica los datos y guarda los cambios.'
                  : 'Registra un gasto asociado a una siembra.'
              }
            </p>
          </div>

          <button
            class="btn"
            id="closeExpenseModal"
            type="button"
          >
            Cerrar
          </button>

        </div>

        <form
          class="modal-body"
          id="expenseForm"
        >

          <input
            type="hidden"
            name="id"
            value="${row?.id || ''}"
          >

          <div class="form-grid">

            ${inputField(
              'expense_date',
              'Fecha',
              row?.expense_date || today(),
              'date',
              'required'
            )}

            ${selectField(
              'planting_id',
              'Siembra / contrato',
              plantingOptions(
                row?.planting_id
              ),
              true
            )}

            ${selectField(
              'category_id',
              'Categoría',
              categoryOptions(
                row?.category_id
              ),
              true
            )}

            ${selectField(
              'supplier_id',
              'Proveedor',
              supplierOptions(
                row?.supplier_id
              ),
              false
            )}

            ${inputField(
              'concept',
              'Concepto (opcional)',
              row?.concept || '',
              'text'
            )}

            ${selectField(
              'expense_unit_id',
              'Cómo se aplica el monto',
              expenseUnitOptions(
                row?.expense_unit_id
              ),
              true
            )}

            ${moneyField(
              'unit_amount',
              'Monto unitario',
              unitAmountValue(
                row
              )
            )}

            <div class="field">

              <label>
                Cantidad
              </label>

              <input
                class="input"
                name="quantity"
                type="number"
                min="0"
                step="0.0001"
                value="${escapeHtml(
                  row?.quantity ?? 1
                )}"
                required
              >

              <small
                class="muted"
                id="expenseQuantityRule"
              ></small>

            </div>

            ${currencyField(
              'currency',
              'Moneda',
              currency
            )}

            ${inputField(
              'exchange_rate',
              'Tipo de cambio a MXN',
              row?.exchange_rate || '',
              'number',
              'min="0" step="0.0001"'
            )}

            ${selectField(
              'payment_method_id',
              'Método de pago',
              paymentMethodOptions(
                row?.payment_method_id
              ),
              false
            )}

            ${inputField(
              'invoice_number',
              'Factura / comprobante',
              row?.invoice_number || '',
              'text'
            )}

            <div class="field form-grid-full">

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

          <div class="expense-calculation">

            <span>
              Importe total
            </span>

            <strong id="expenseTotalPreview">
              ${money(
                expenseTotal(
                  unitAmountValue(row),
                  row?.quantity ?? 1
                ),
                currency
              )}
            </strong>

          </div>

          <div class="expense-calculation">

            <span>
              Equivalente estimado en MXN
            </span>

            <strong id="expenseMxnPreview">
              ${previewMxn(
                expenseTotal(
                  unitAmountValue(row),
                  row?.quantity ?? 1
                ),
                currency,
                row?.exchange_rate
              )}
            </strong>

          </div>

          <div class="modal-actions">

            <button
              class="btn primary"
              type="submit"
            >
              ${
                editing
                  ? 'Guardar cambios'
                  : 'Guardar gasto'
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

  bindQuantityRule(
    modalRoot
  );

  bindMxnPreview(
    modalRoot
  );

  modalRoot
    .querySelector(
      '#closeExpenseModal'
    )
    ?.addEventListener(
      'click',
      () => {
        modalRoot.innerHTML = '';
      }
    );

  modalRoot
    .querySelector(
      '#expenseForm'
    )
    ?.addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        const formData =
          new FormData(
            event.currentTarget
          );

        const payload =
          Object.fromEntries(
            formData.entries()
          );

        payload.supplier_id =
          payload.supplier_id || null;

        payload.payment_method_id =
          payload.payment_method_id || null;

        payload.exchange_rate =
          payload.exchange_rate || null;

        payload.amount =
          expenseTotal(
            payload.unit_amount,
            payload.quantity
          );

        try {
          await api(
            'expenses',
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
              ? 'Gasto actualizado correctamente.'
              : 'Gasto guardado correctamente.'
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
   10. ELIMINAR GASTO
   ========================================================= */

async function removeExpense(
  id,
  rerender
) {
  const row = rows.find(
    item => {
      return Number(item.id) ===
        Number(id);
    }
  );

  const description =
    row?.concept || 'este gasto';

  const confirmed = window.confirm(
    `¿Eliminar "${description}"? Esta acción no se puede deshacer.`
  );

  if (!confirmed) {
    return;
  }

  try {
    await api(
      'expenses',
      {
        method: 'DELETE',
        body: JSON.stringify({
          id
        })
      }
    );

    toast(
      'Gasto eliminado correctamente.'
    );

    await rerender();

  } catch (exception) {
    toast(
      exception.message
    );
  }
}


/* =========================================================
   11. OPCIONES DE CATÁLOGOS
   ========================================================= */

function plantingOptions(
  selectedId
) {
  return `
    <option value="">
      Seleccionar siembra
    </option>

    ${catalogs.plantings
      .map(item => {
        return option(
          item.id,
          item.contract_number,
          selectedId
        );
      })
      .join('')}
  `;
}


function categoryOptions(
  selectedId
) {
  return `
    <option value="">
      Seleccionar categoría
    </option>

    ${catalogs.expense_categories
      .map(item => {
        return option(
          item.id,
          item.name,
          selectedId
        );
      })
      .join('')}
  `;
}


function supplierOptions(
  selectedId
) {
  return `
    <option value="">
      Sin proveedor
    </option>

    ${catalogs.suppliers
      .map(item => {
        return option(
          item.id,
          item.name,
          selectedId
        );
      })
      .join('')}
  `;
}


function expenseUnitOptions(
  selectedId
) {
  if (!selectedId) {
    selectedId =
      defaultExpenseUnit()?.id;
  }

  return `
    <option value="">
      Seleccionar cómo se aplica
    </option>

    ${catalogs.expense_units
      .map(item => {
        return option(
          item.id,
          item.name,
          selectedId
        );
      })
      .join('')}
  `;
}


function defaultExpenseUnit() {
  const normalize = value =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

  return catalogs.expense_units
    .find(item => {
      return normalize(item.name) ===
        'por siembra';
    });
}


function paymentMethodOptions(
  selectedId
) {
  return `
    <option value="">
      Sin especificar
    </option>

    ${catalogs.payment_methods
      .map(item => {
        return option(
          item.id,
          item.name,
          selectedId
        );
      })
      .join('')}
  `;
}


function option(
  value,
  label,
  selectedId
) {
  const selected =
    Number(value) ===
    Number(selectedId);

  return `
    <option
      value="${value}"
      ${selected ? 'selected' : ''}
    >
      ${escapeHtml(
        label
      )}
    </option>
  `;
}


/* =========================================================
   12. GENERADORES DE CAMPOS
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
        required
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
        id="expenseCurrency"
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


function selectField(
  name,
  label,
  options,
  required = false
) {
  return `
    <div class="field">

      <label>
        ${label}
      </label>

      <select
        class="input"
        name="${name}"
        ${required ? 'required' : ''}
      >
        ${options}
      </select>

    </div>
  `;
}


/* =========================================================
   13. VISTA PREVIA MXN
   ========================================================= */

function bindQuantityRule(
  root
) {
  const unitSelect =
    root.querySelector(
      '[name="expense_unit_id"]'
    );

  const plantingSelect =
    root.querySelector(
      '[name="planting_id"]'
    );

  const quantityInput =
    root.querySelector(
      '[name="quantity"]'
    );

  const rule =
    root.querySelector(
      '#expenseQuantityRule'
    );

  const apply = () => {
    if (!quantityInput) {
      return;
    }

    const unit =
      catalogs.expense_units
        .find(item => {
          return Number(item.id) ===
            Number(unitSelect?.value);
        });

    const source =
      unit?.quantity_source ||
      'MANUAL';

    if (source === 'ONE') {
      quantityInput.value = 1;
      quantityInput.readOnly = true;

    } else if (source === 'HECTARES') {
      const planting =
        catalogs.plantings
          .find(item => {
            return Number(item.id) ===
              Number(plantingSelect?.value);
          });

      quantityInput.value =
        planting?.hectares ?? '';

      quantityInput.readOnly = true;

    } else {
      quantityInput.readOnly = false;
    }

    if (rule) {
      rule.textContent =
        quantitySourceLabel(
          source
        );
    }

    quantityInput.dispatchEvent(
      new Event('input')
    );
  };

  unitSelect?.addEventListener(
    'change',
    apply
  );

  plantingSelect?.addEventListener(
    'change',
    apply
  );

  if (unitSelect?.value) {
    apply();
  }
}


function quantitySourceLabel(
  value
) {
  const labels = {
    ONE: '1 por registro',
    HECTARES: 'Hectáreas de la siembra',
    MANUAL: 'Captura manual'
  };

  return labels[value] || '';
}


function unitAmountValue(
  row
) {
  const value =
    row?.unit_amount ??
    row?.amount;

  return value === undefined ||
    value === null
    ? ''
    : formatMoneyText(
        value
      );
}


function expenseTotal(
  unitAmount,
  quantity
) {
  return numericMoney(
    unitAmount
  ) * numeric(
    quantity
  );
}


function bindMxnPreview(
  root
) {
  const unitAmount =
    root.querySelector(
      '[name="unit_amount"]'
    );

  const quantity =
    root.querySelector(
      '[name="quantity"]'
    );

  const total =
    root.querySelector(
      '#expenseTotalPreview'
    );

  const currency =
    root.querySelector(
      '[name="currency"]'
    );

  const exchangeRate =
    root.querySelector(
      '[name="exchange_rate"]'
    );

  const preview =
    root.querySelector(
      '#expenseMxnPreview'
    );

  const update = () => {
    const amount =
      expenseTotal(
        unitAmount?.value,
        quantity?.value
      );

    if (total) {
      total.textContent =
        money(
          amount,
          currency?.value || 'MXN'
        );
    }

    if (!preview) {
      return;
    }

    preview.textContent =
      previewMxn(
        amount,
        currency?.value,
        exchangeRate?.value
      );
  };

  unitAmount?.addEventListener(
    'input',
    update
  );

  quantity?.addEventListener(
    'input',
    update
  );

  currency?.addEventListener(
    'change',
    update
  );

  exchangeRate?.addEventListener(
    'input',
    update
  );
}


function previewMxn(
  amount,
  currency,
  exchangeRate
) {
  const cleanAmount =
    numericMoney(
      amount
    );

  if (currency === 'MXN') {
    return money(
      cleanAmount,
      'MXN'
    );
  }

  const rate = numeric(
    exchangeRate
  );

  if (rate <= 0) {
    return 'Captura tipo de cambio';
  }

  return money(
    cleanAmount * rate,
    'MXN'
  );
}


/* =========================================================
   14. FORMATO MONETARIO
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

          root
            .querySelector(
              '[name="exchange_rate"]'
            )
            ?.dispatchEvent(
              new Event('input')
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


/* =========================================================
   15. UTILIDADES
   ========================================================= */

function numericMoney(
  value
) {
  return numeric(
    normalizeMoneyText(
      value
    )
  );
}


function numeric(
  value
) {
  const result = Number(
    value || 0
  );

  return Number.isFinite(result)
    ? result
    : 0;
}


function today() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}
