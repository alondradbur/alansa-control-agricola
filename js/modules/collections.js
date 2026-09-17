import { api } from '../core/api.js';
import { escapeHtml, money, number, date } from '../core/format.js';
import { moduleHeader, toast } from '../components/common.js';


/* =========================================================
   ALANSA · COBRANZA
   Cartera derivada de Remisiones + pagos aplicados.
   ========================================================= */

let data = { shipments: [], payments: [] };

let filters = {
  plantingId: '',
  clientId: '',
  status: '',
  from: '',
  to: ''
};

let tableState = {
  search: {},
  selected: {},
  sortKey: 'due_date',
  sortDirection: 'asc',
  openColumn: ''
};

const COLUMNS = [
  { key: 'folio', label: 'Folio', type: 'text' },
  { key: 'shipment_date', label: 'Fecha', type: 'date' },
  { key: 'due_date', label: 'Vencimiento', type: 'date' },
  { key: 'contract_number', label: 'Contrato', type: 'text' },
  { key: 'client_name', label: 'Cliente', type: 'text' },
  { key: 'total_mxn', label: 'Total MXN', type: 'number' },
  { key: 'total_usd', label: 'Total USD', type: 'number' },
  { key: 'collected_mxn', label: 'Cobrado MXN', type: 'number' },
  { key: 'collected_usd', label: 'Cobrado USD', type: 'number' },
  { key: 'balance_mxn', label: 'Saldo MXN', type: 'number' },
  { key: 'balance_usd', label: 'Saldo USD', type: 'number' },
  { key: 'days_remaining', label: 'Días', type: 'number' },
  { key: 'financial_status', label: 'Estatus', type: 'text' }
];


/* =========================================================
   1. RENDER PRINCIPAL
   ========================================================= */

export async function collections() {
  try {
    data = await api('collections');
  } catch (err) {
    data = { shipments: [], payments: [] };
    setTimeout(() => toast(err.message), 0);
  }

  return `
    ${moduleHeader(
      'Cobranza',
      'Control de cuentas por cobrar y pagos de remisiones.'
    )}

    <div class="content collections-content">
      ${globalFilters()}

      <div id="collectionsSummary">
        ${summaryCards()}
      </div>

      <section class="collections-panel">
        <div class="collections-panel-head">
          <div>
            <h2>Cartera de clientes</h2>
            <p>Remisiones, cobros aplicados y saldos pendientes.</p>
          </div>

          <div class="collections-actions">
            <button class="btn" id="collectionsExcel" type="button">
              Exportar Excel
            </button>

            <button class="btn" id="collectionsPdf" type="button">
              Generar PDF
            </button>
          </div>
        </div>

        <div id="collectionsTable">
          ${portfolioTable()}
        </div>
        
        <div
  id="modalRoot"
  class="collections-modal-root"
></div>

      </section>
    </div>
  `;
}


/* =========================================================
   2. EVENTOS
   ========================================================= */

export function bindCollections() {
  ['collectionPlanting', 'collectionClient', 'collectionStatus', 'collectionFrom', 'collectionTo']
    .forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        readGlobalFilters();
        renderDynamic();
      });
    });

  document.getElementById('collectionClear')?.addEventListener('click', () => {
    filters = { plantingId: '', clientId: '', status: '', from: '', to: '' };
    tableState = { search: {}, selected: {}, sortKey: 'due_date', sortDirection: 'asc', openColumn: '' };

    ['collectionPlanting', 'collectionClient', 'collectionStatus', 'collectionFrom', 'collectionTo']
      .forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
      });

    renderDynamic();
  });

  document.getElementById('collectionsExcel')?.addEventListener('click', exportExcel);
  document.getElementById('collectionsPdf')?.addEventListener('click', printReport);

  bindTableEvents();
}


/* =========================================================
   3. FILTROS GENERALES
   ========================================================= */

function globalFilters() {
  const plantings = uniqueBy(
    data.shipments || [],
    'planting_id',
    'contract_number'
  );

  const clients = uniqueBy(
    data.shipments || [],
    'client_id',
    'client_name'
  );

  return `
    <section class="collections-filters">
      <div class="collections-filter-field">
        <label for="collectionPlanting">Siembra</label>
        <select id="collectionPlanting">
          <option value="">Todas</option>
          ${plantings.map(row => `
            <option value="${row.value}">${escapeHtml(row.label)}</option>
          `).join('')}
        </select>
      </div>

      <div class="collections-filter-field">
        <label for="collectionClient">Cliente</label>
        <select id="collectionClient">
          <option value="">Todos</option>
          ${clients.map(row => `
            <option value="${row.value}">${escapeHtml(row.label)}</option>
          `).join('')}
        </select>
      </div>

      <div class="collections-filter-field">
        <label for="collectionStatus">Estatus</label>
        <select id="collectionStatus">
          <option value="">Todos</option>
          <option>Pendiente</option>
          <option>Pago parcial</option>
          <option>Vencida</option>
          <option>Cobrada</option>
        </select>
      </div>

      <div class="collections-filter-field">
        <label for="collectionFrom">Vencimiento desde</label>
        <input id="collectionFrom" type="date">
      </div>

      <div class="collections-filter-field">
        <label for="collectionTo">Vencimiento hasta</label>
        <input id="collectionTo" type="date">
      </div>

      <button class="btn collections-clear" id="collectionClear" type="button">
        Limpiar filtros
      </button>
    </section>
  `;
}

function readGlobalFilters() {
  filters = {
    plantingId: valueOf('collectionPlanting'),
    clientId: valueOf('collectionClient'),
    status: valueOf('collectionStatus'),
    from: valueOf('collectionFrom'),
    to: valueOf('collectionTo')
  };
}


/* =========================================================
   4. KPIs
   ========================================================= */

function summaryCards() {
  const rows = globalRows();
  const totals = rows.reduce((sum, row) => {
    sum.balanceMxn += row.balance_mxn;
    sum.balanceUsd += row.balance_usd;
    sum.collectedMxn += row.collected_mxn;
    sum.collectedUsd += row.collected_usd;

    if (row.financial_status === 'Vencida') {
      sum.overdueMxn += row.balance_mxn;
      sum.overdueUsd += row.balance_usd;
    }

    if (row.balance_original > 0 && row.financial_status !== 'Vencida') {
      sum.upcomingMxn += row.balance_mxn;
      sum.upcomingUsd += row.balance_usd;
    }

    if (row.balance_original > 0) sum.pendingCount += 1;
    return sum;
  }, {
    balanceMxn: 0, balanceUsd: 0,
    collectedMxn: 0, collectedUsd: 0,
    overdueMxn: 0, overdueUsd: 0,
    upcomingMxn: 0, upcomingUsd: 0,
    pendingCount: 0
  });

  return `
    <div class="collections-kpis">
      ${moneyKpi('Por cobrar', totals.balanceMxn, totals.balanceUsd, 'receivable')}
      ${moneyKpi('Cobrado', totals.collectedMxn, totals.collectedUsd, 'collected')}
      ${moneyKpi('Vencido', totals.overdueMxn, totals.overdueUsd, 'overdue')}
      ${moneyKpi('Por vencer', totals.upcomingMxn, totals.upcomingUsd, 'upcoming')}

      <article class="collections-kpi collections-kpi-count">
        <span>Remisiones pendientes</span>
        <strong>${number(totals.pendingCount)}</strong>
        <small>de ${number(rows.length)} remisiones</small>
      </article>
    </div>
  `;
}

function moneyKpi(label, mxn, usd, tone) {
  return `
    <article class="collections-kpi collections-kpi-${tone}">
      <span>${label}</span>
      <strong>${money(mxn, 'MXN')}</strong>
      <small>${money(usd, 'USD')}</small>
    </article>
  `;
}


/* =========================================================
   5. CARTERA Y CÁLCULOS
   ========================================================= */

function normalizedRows() {
  return (data.shipments || []).map(row => {
    const totalOriginal = numeric(row.total_amount);
    const collectedOriginal = Math.min(numeric(row.collected_amount), totalOriginal);
    const balanceOriginal = Math.max(totalOriginal - collectedOriginal, 0);
    const rate = numeric(row.exchange_rate) || numeric(row.projection_exchange_rate) || 1;
    const total = both(totalOriginal, row.currency, rate);
    const collected = both(collectedOriginal, row.currency, rate);
    const balance = both(balanceOriginal, row.currency, rate);
    const days = daysBetween(todayIso(), row.due_date);

    return {
      ...row,
      total_original: totalOriginal,
      collected_original: collectedOriginal,
      balance_original: balanceOriginal,
      total_mxn: total.mxn,
      total_usd: total.usd,
      collected_mxn: collected.mxn,
      collected_usd: collected.usd,
      balance_mxn: balance.mxn,
      balance_usd: balance.usd,
      days_remaining: days,
      financial_status: financialStatus(balanceOriginal, collectedOriginal, days)
    };
  });
}

function globalRows() {
  return normalizedRows().filter(row => {
    if (filters.plantingId && String(row.planting_id) !== filters.plantingId) return false;
    if (filters.clientId && String(row.client_id) !== filters.clientId) return false;
    if (filters.status && row.financial_status !== filters.status) return false;
    if (filters.from && String(row.due_date || '') < filters.from) return false;
    if (filters.to && String(row.due_date || '') > filters.to) return false;
    return true;
  });
}

function visibleRows() {
  let rows = globalRows().filter(row => COLUMNS.every(column => {
    const search = String(tableState.search[column.key] || '').trim().toLowerCase();
    const selected = tableState.selected[column.key];
    const display = filterDisplay(row, column);

    if (search && !display.toLowerCase().includes(search)) return false;
    if (selected?.length && !selected.includes(display)) return false;
    return true;
  }));

  const column = COLUMNS.find(item => item.key === tableState.sortKey);
  if (column) {
    rows = [...rows].sort((a, b) => compareValues(a[column.key], b[column.key], column.type));
    if (tableState.sortDirection === 'desc') rows.reverse();
  }

  return rows;
}

function financialStatus(balance, collected, days) {
  if (balance <= 0.009) return 'Cobrada';
  if (days < 0) return 'Vencida';
  if (collected > 0) return 'Pago parcial';
  return 'Pendiente';
}


/* =========================================================
   6. TABLA
   ========================================================= */

function portfolioTable() {
  const rows = visibleRows();
  const totals = rows.reduce((sum, row) => {
    ['total_mxn', 'total_usd', 'collected_mxn', 'collected_usd', 'balance_mxn', 'balance_usd']
      .forEach(key => { sum[key] += numeric(row[key]); });
    return sum;
  }, {
    total_mxn: 0, total_usd: 0,
    collected_mxn: 0, collected_usd: 0,
    balance_mxn: 0, balance_usd: 0
  });

  if (!rows.length) {
    return `<div class="collections-empty">No se encontraron remisiones con los filtros seleccionados.</div>`;
  }

  return `
    <div class="collections-table-scroll">
      <table class="collections-table">
        <thead>
          <tr>
            ${COLUMNS.map(column => tableHeader(column)).join('')}
            <th class="collections-actions-col">Acciones</th>
          </tr>
        </thead>

        <tbody>
          ${rows.map(row => `
            <tr>
              <td><button class="collections-folio" data-detail="${row.id}" type="button">${escapeHtml(row.folio)}</button></td>
              <td>${date(row.shipment_date)}</td>
              <td>${date(row.due_date)}</td>
              <td>${escapeHtml(row.contract_number || '—')}</td>
              <td class="collections-client">${escapeHtml(row.client_name || '—')}</td>
              <td class="num">${money(row.total_mxn, 'MXN')}</td>
              <td class="num">${money(row.total_usd, 'USD')}</td>
              <td class="num">${money(row.collected_mxn, 'MXN')}</td>
              <td class="num">${money(row.collected_usd, 'USD')}</td>
              <td class="num collections-balance">${money(row.balance_mxn, 'MXN')}</td>
              <td class="num collections-balance">${money(row.balance_usd, 'USD')}</td>
              <td class="num">${daysLabel(row)}</td>
              <td>${statusBadge(row.financial_status)}</td>
              <td class="collections-row-actions">
                <button class="icon-btn" data-detail="${row.id}" type="button" title="Ver detalle">Ver</button>
                ${row.balance_original > 0 ? `
                  <button class="btn collections-pay-btn" data-pay="${row.id}" type="button">Registrar pago</button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>

        <tfoot>
          <tr>
            <td colspan="5">TOTAL</td>
            <td class="num">${money(totals.total_mxn, 'MXN')}</td>
            <td class="num">${money(totals.total_usd, 'USD')}</td>
            <td class="num">${money(totals.collected_mxn, 'MXN')}</td>
            <td class="num">${money(totals.collected_usd, 'USD')}</td>
            <td class="num">${money(totals.balance_mxn, 'MXN')}</td>
            <td class="num">${money(totals.balance_usd, 'USD')}</td>
            <td colspan="3"></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="collections-mobile-list">
      ${rows.map(collectionMobileCard).join('')}
    </div>

    <div class="collections-table-meta">
      Mostrando ${number(rows.length)} de ${number(globalRows().length)} remisiones
    </div>
  `;
}

function collectionMobileCard(row) {
  return `
    <article class="collection-mobile-card">
      <div class="collection-mobile-head">
        <button class="collections-folio collection-mobile-folio" data-detail="${row.id}" type="button">${escapeHtml(row.folio)}</button>
        ${statusBadge(row.financial_status)}
      </div>

      <div class="collection-mobile-client">
        <strong>${escapeHtml(row.client_name || '—')}</strong>
        <span>Contrato ${escapeHtml(row.contract_number || '—')}</span>
      </div>

      <div class="collection-mobile-dates">
        <div><span>Fecha</span><strong>${date(row.shipment_date)}</strong></div>
        <div><span>Vencimiento</span><strong>${date(row.due_date)}</strong></div>
        <div><span>Días</span><strong>${daysLabel(row)}</strong></div>
      </div>

      <div class="collection-mobile-money">
        <div><span>Total MXN</span><strong>${money(row.total_mxn, 'MXN')}</strong></div>
        <div><span>Total USD</span><strong>${money(row.total_usd, 'USD')}</strong></div>
        <div><span>Cobrado MXN</span><strong>${money(row.collected_mxn, 'MXN')}</strong></div>
        <div><span>Cobrado USD</span><strong>${money(row.collected_usd, 'USD')}</strong></div>
        <div class="collection-mobile-balance"><span>Saldo MXN</span><strong>${money(row.balance_mxn, 'MXN')}</strong></div>
        <div class="collection-mobile-balance"><span>Saldo USD</span><strong>${money(row.balance_usd, 'USD')}</strong></div>
      </div>

      <div class="collection-mobile-actions">
        <button class="btn" data-detail="${row.id}" type="button">Ver detalle</button>
        ${row.balance_original > 0 ? `<button class="btn primary collections-pay-btn" data-pay="${row.id}" type="button">Registrar pago</button>` : ''}
      </div>
    </article>
  `;
}

function tableHeader(column) {
  const active = tableState.search[column.key] || tableState.selected[column.key]?.length;
  return `
    <th>
      <div class="collections-th">
        <span>${column.label}</span>
        <button
          class="collections-filter-trigger ${active ? 'active' : ''}"
          data-column="${column.key}"
          type="button"
          aria-label="Filtrar ${column.label}"
        >⌄</button>
      </div>
      ${tableState.openColumn === column.key ? filterMenu(column) : ''}
    </th>
  `;
}

function filterMenu(column) {
  const values = [...new Set(globalRows().map(row => filterDisplay(row, column)))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  const selected = tableState.selected[column.key] || [];

  return `
    <div class="collections-filter-menu" data-filter-menu="${column.key}">
      <button class="collections-sort" data-sort="asc" data-sort-column="${column.key}" type="button">
        ${column.type === 'date' ? 'Más antiguo primero' : 'Ordenar ascendente'}
      </button>
      <button class="collections-sort" data-sort="desc" data-sort-column="${column.key}" type="button">
        ${column.type === 'date' ? 'Más reciente primero' : 'Ordenar descendente'}
      </button>

      <input
        class="collections-filter-search"
        data-filter-search="${column.key}"
        type="search"
        placeholder="Buscar..."
        value="${escapeHtml(tableState.search[column.key] || '')}"
      >

      <div class="collections-filter-values">
        ${values.map(value => `
          <label>
            <input
              type="checkbox"
              data-filter-value="${column.key}"
              value="${escapeHtml(value)}"
              ${selected.includes(value) ? 'checked' : ''}
            >
            <span>${escapeHtml(value)}</span>
          </label>
        `).join('')}
      </div>

      <div class="collections-filter-actions">
        <button class="btn" data-filter-clear="${column.key}" type="button">Limpiar</button>
        <button class="btn primary" data-filter-apply="${column.key}" type="button">Aplicar</button>
      </div>
    </div>
  `;
}

function bindTableEvents() {

  document
    .querySelectorAll(
      '[data-column]'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        event => {
          event.preventDefault();
          event.stopPropagation();

          const column =
            button.dataset.column;

          const isSame =
            tableState.openColumn ===
            column;

          closeFilterMenu();

          tableState.openColumn =
            isSame
              ? ''
              : column;

          renderTableOnly();

          if (
            tableState.openColumn
          ) {
            mountFilterMenu();
          }
        }
      );
    });


  document
    .querySelectorAll(
      '[data-sort-column]'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        event => {
          event.preventDefault();
          event.stopPropagation();

          tableState.sortKey =
            button.dataset.sortColumn;

          tableState.sortDirection =
            button.dataset.sort;

          tableState.openColumn = '';

          closeFilterMenu();
          renderTableOnly();
        }
      );
    });


  document
    .querySelectorAll(
      '[data-filter-apply]'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        event => {
          event.preventDefault();
          event.stopPropagation();

          const key =
            button.dataset.filterApply;

          const search =
            document.querySelector(
              `[data-filter-search="${key}"]`
            );

          tableState.search[key] =
            search?.value.trim() || '';

          tableState.selected[key] =
            [
              ...document.querySelectorAll(
                `[data-filter-value="${key}"]:checked`
              )
            ].map(
              input => input.value
            );

          tableState.openColumn = '';

          closeFilterMenu();
          renderTableOnly();
        }
      );
    });


  document
    .querySelectorAll(
      '[data-filter-clear]'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        event => {
          event.preventDefault();
          event.stopPropagation();

          const key =
            button.dataset.filterClear;

          delete tableState.search[key];
          delete tableState.selected[key];

          tableState.openColumn = '';

          closeFilterMenu();
          renderTableOnly();
        }
      );
    });


  document
    .querySelectorAll(
      '[data-filter-menu]'
    )
    .forEach(menu => {
      menu.addEventListener(
        'click',
        event => {
          event.stopPropagation();
        }
      );
    });


  document
    .querySelectorAll(
      '[data-pay]'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          closeFilterMenu();

          openPaymentModal(
            Number(
              button.dataset.pay
            )
          );
        }
      );
    });


  document
    .querySelectorAll(
      '[data-detail]'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          closeFilterMenu();

          openDetailModal(
            Number(
              button.dataset.detail
            )
          );
        }
      );
    });
}

function closeFilterMenu() {
  document
    .querySelectorAll(
      '.collections-filter-menu-portal'
    )
    .forEach(menu => {
      menu.remove();
    });
}


function mountFilterMenu() {

  closeFilterMenu();

  if (!tableState.openColumn) {
    return;
  }


  const column =
    tableState.openColumn;

  const trigger =
    document.querySelector(
      `[data-column="${column}"]`
    );

  const menu =
    document.querySelector(
      `[data-filter-menu="${column}"]`
    );

  if (!trigger || !menu) {
    return;
  }


  /*
   * El menú se posiciona tomando como
   * referencia la columna real, no únicamente
   * el pequeño botón del filtro.
   */
  const header =
    trigger.closest('th');

  const rect =
    (
      header ||
      trigger
    ).getBoundingClientRect();


  const padding = 12;
  const gap = 7;

  const width =
    Math.min(
      300,
      window.innerWidth -
      padding * 2
    );


  /*
   * El filtro se mueve al body para evitar
   * que el overflow de la tabla lo recorte.
   */
  document.body.appendChild(
    menu
  );

  menu.classList.add(
    'collections-filter-menu-portal'
  );

  menu.style.width =
    `${width}px`;

  menu.style.visibility =
    'hidden';


  const availableHeight =
    window.innerHeight -
    padding * 2;

  const maxHeight =
    Math.min(
      440,
      availableHeight
    );

  menu.style.maxHeight =
    `${maxHeight}px`;


  const measuredHeight =
    menu.getBoundingClientRect()
      .height;

  const height =
    Math.min(
      measuredHeight,
      maxHeight
    );


  /*
   * Alineación horizontal:
   * intenta iniciar exactamente donde
   * comienza la columna.
   */
  let left =
    rect.left;

  if (
    left + width >
    window.innerWidth - padding
  ) {
    left =
      rect.right -
      width;
  }

  left =
    Math.max(
      padding,
      Math.min(
        left,
        window.innerWidth -
        width -
        padding
      )
    );


  /*
   * Alineación vertical:
   * abre debajo del encabezado siempre
   * que haya espacio suficiente.
   */
  const spaceBelow =
    window.innerHeight -
    rect.bottom -
    padding -
    gap;

  const spaceAbove =
    rect.top -
    padding -
    gap;


  let top;

  if (
    height <= spaceBelow ||
    spaceBelow >= spaceAbove
  ) {
    top =
      rect.bottom +
      gap;
  } else {
    top =
      rect.top -
      height -
      gap;
  }


  top =
    Math.max(
      padding,
      Math.min(
        top,
        window.innerHeight -
        height -
        padding
      )
    );


  menu.style.left =
    `${left}px`;

  menu.style.top =
    `${top}px`;

  menu.style.visibility =
    'visible';


  /*
   * Impide que un clic dentro del menú
   * sea interpretado como clic exterior.
   */
  menu.addEventListener(
    'click',
    event => {
      event.stopPropagation();
    }
  );
}

/* =========================================================
   7. REGISTRAR / EDITAR PAGO
   ========================================================= */

function openPaymentModal(shipmentId, paymentId = 0) {
  const row = normalizedRows().find(item => Number(item.id) === shipmentId);
  const payment = paymentId ? (data.payments || []).find(item => Number(item.id) === paymentId) : null;
  if (!row) return;

  const root = document.getElementById('modalRoot');
  if (!root) return;

  const rate = numeric(payment?.exchange_rate) || numeric(row.exchange_rate) || numeric(row.projection_exchange_rate) || 1;

  root.innerHTML = `
    <div class="modal-backdrop collections-modal-backdrop">
      <div class="modal collections-payment-modal">
        <div class="modal-head">
          <div>
            <h2>${payment ? 'Editar pago' : 'Registrar pago'}</h2>
            <p>${escapeHtml(row.folio)} · ${escapeHtml(row.client_name)}</p>
          </div>
          <button class="icon-btn" data-close-modal type="button">×</button>
        </div>

        <form id="collectionPaymentForm" class="modal-body">
          <div class="collections-payment-summary">
            ${summaryAmount('Total de remisión', row.total_mxn, row.total_usd)}
            ${summaryAmount('Cobrado', row.collected_mxn, row.collected_usd)}
            ${summaryAmount('Saldo pendiente', row.balance_mxn, row.balance_usd, true)}
          </div>

          <div class="collections-form-grid">
            <label>
              <span>Fecha de pago</span>
              <input name="payment_date" type="date" required value="${payment?.payment_date || todayIso()}">
            </label>

            <label>
              <span>Monto recibido</span>
              <input name="amount" inputmode="decimal" required placeholder="0.00" value="${payment ? formatInput(payment.amount) : ''}">
            </label>

            <label>
              <span>Moneda</span>
              <select name="currency" required>
                <option value="USD" ${(payment?.currency || row.currency) === 'USD' ? 'selected' : ''}>USD</option>
                <option value="MXN" ${(payment?.currency || row.currency) === 'MXN' ? 'selected' : ''}>MXN</option>
              </select>
            </label>

            <label>
              <span>Cuenta receptora</span>
              <select name="account" required>
                <option value="USD" ${(payment?.account || row.currency) === 'USD' ? 'selected' : ''}>USD</option>
                <option value="MXN" ${(payment?.account || row.currency) === 'MXN' ? 'selected' : ''}>MXN</option>
              </select>
            </label>

            <label>
              <span>Tipo de cambio</span>
              <input name="exchange_rate" inputmode="decimal" value="${formatInput(rate)}">
            </label>

            <label class="collections-form-wide">
              <span>Referencia</span>
              <input name="reference" maxlength="120" placeholder="Ej. TRANSF-002" value="${escapeHtml(payment?.reference || '')}">
            </label>

            <label class="collections-form-wide">
              <span>Notas</span>
              <textarea name="notes" rows="3" placeholder="Notas adicionales (opcional)">${escapeHtml(payment?.notes || '')}</textarea>
            </label>
          </div>

          <div class="collections-receipt-note">
            <strong>Comprobante</strong>
            <span>La estructura ya contempla el comprobante. La carga de archivos se habilitará al conectar almacenamiento R2; no se guardan archivos pesados dentro de D1.</span>
          </div>

          <div class="modal-actions">
            <button class="btn" data-close-modal type="button">Cancelar</button>
            <button class="btn primary" type="submit">${payment ? 'Guardar cambios' : 'Registrar pago'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', () => { root.innerHTML = ''; }));

  document.getElementById('collectionPaymentForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const payload = {
      id: paymentId || undefined,
      shipment_id: shipmentId,
      payment_date: form.get('payment_date'),
      amount: parseMoney(form.get('amount')),
      currency: form.get('currency'),
      account: form.get('account'),
      exchange_rate: parseMoney(form.get('exchange_rate')),
      reference: form.get('reference'),
      notes: form.get('notes'),
      receipt_url: payment?.receipt_url || null
    };

    try {
      await api('collections', {
        method: payment ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });

      root.innerHTML = '';
      toast(payment ? 'Pago actualizado.' : 'Pago registrado.');
      await reloadCollections();
    } catch (err) {
      toast(err.message);
    }
  });
}

function summaryAmount(label, mxn, usd, highlight = false) {
  return `
    <div class="${highlight ? 'highlight' : ''}">
      <span>${label}</span>
      <strong>${money(mxn, 'MXN')}</strong>
      <small>${money(usd, 'USD')}</small>
    </div>
  `;
}


/* =========================================================
   8. DETALLE E HISTORIAL
   ========================================================= */

function openDetailModal(shipmentId) {
  const row = normalizedRows().find(item => Number(item.id) === shipmentId);
  if (!row) return;

  const payments = (data.payments || []).filter(item => Number(item.shipment_id) === shipmentId);
  const root = document.getElementById('modalRoot');
  if (!root) return;

  root.innerHTML = `
    <div class="modal-backdrop collections-modal-backdrop">
      <div class="modal collections-detail-modal">
        <div class="modal-head">
          <div>
            <h2>Detalle de remisión</h2>
            <p>${escapeHtml(row.folio)}</p>
          </div>
          <button class="icon-btn" data-close-modal type="button">×</button>
        </div>

        <div class="modal-body">
          <div class="collections-detail-grid">
            ${detailItem('Folio', row.folio)}
            ${detailItem('Estatus', row.financial_status, true)}
            ${detailItem('Fecha', date(row.shipment_date))}
            ${detailItem('Vencimiento', date(row.due_date))}
            ${detailItem('Cliente', row.client_name)}
            ${detailItem('Contrato', row.contract_number)}
            ${detailItem('Crédito', `${number(row.credit_days)} días`)}
            ${detailItem('Total', `${money(row.total_mxn, 'MXN')} | ${money(row.total_usd, 'USD')}`)}
            ${detailItem('Cobrado', `${money(row.collected_mxn, 'MXN')} | ${money(row.collected_usd, 'USD')}`)}
            ${detailItem('Saldo', `${money(row.balance_mxn, 'MXN')} | ${money(row.balance_usd, 'USD')}`)}
          </div>

          <div class="collections-history-head">
            <h3>Historial de pagos</h3>
            ${row.balance_original > 0 ? `<button class="btn primary" data-pay-from-detail="${row.id}" type="button">Registrar pago</button>` : ''}
          </div>

          ${payments.length ? `
            <div class="collections-history-scroll">
              <table class="collections-history-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Monto</th>
                    <th>Moneda</th>
                    <th>Cuenta</th>
                    <th>Referencia</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${payments.map(payment => `
                    <tr>
                      <td>${date(payment.payment_date)}</td>
                      <td class="num">${money(payment.amount, payment.currency)}</td>
                      <td>${escapeHtml(payment.currency)}</td>
                      <td>${escapeHtml(payment.account || '—')}</td>
                      <td>${escapeHtml(payment.reference || '—')}</td>
                      <td class="collections-history-actions">
                        <button class="icon-btn" data-edit-payment="${payment.id}" type="button">Editar</button>
                        <button class="icon-btn danger" data-delete-payment="${payment.id}" type="button">Eliminar</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `<div class="collections-empty compact">Esta remisión todavía no tiene pagos registrados.</div>`}

          <div class="modal-actions">
            <button class="btn" data-close-modal type="button">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', () => { root.innerHTML = ''; }));

  root.querySelector('[data-pay-from-detail]')?.addEventListener('click', () => openPaymentModal(shipmentId));

  root.querySelectorAll('[data-edit-payment]').forEach(button => {
    button.addEventListener('click', () => openPaymentModal(shipmentId, Number(button.dataset.editPayment)));
  });

  root.querySelectorAll('[data-delete-payment]').forEach(button => {
    button.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este pago? El saldo de la remisión se recalculará automáticamente.')) return;

      try {
        await api(`collections?id=${button.dataset.deletePayment}`, { method: 'DELETE' });
        root.innerHTML = '';
        toast('Pago eliminado.');
        await reloadCollections();
      } catch (err) {
        toast(err.message);
      }
    });
  });
}

function detailItem(label, value, badge = false) {
  return `
    <div>
      <span>${label}</span>
      ${badge ? statusBadge(value) : `<strong>${escapeHtml(value ?? '—')}</strong>`}
    </div>
  `;
}


/* =========================================================
   9. EXCEL Y REPORTE PDF
   ========================================================= */

function exportExcel() {
  const rows = visibleRows();
  if (!rows.length) return toast('No hay registros para exportar.');

  const headers = COLUMNS.map(column => column.label);
  const values = rows.map(row => COLUMNS.map(column => exportValue(row, column)));
  const html = excelWorksheet(headers, values);
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  downloadBlob(blob, `Cobranza_ALANSA_${todayIso()}.xls`);
}

function printReport() {
  const rows = visibleRows();
  if (!rows.length) return toast('No hay registros para generar el reporte.');

  const popup = window.open('', '_blank');
  if (!popup) return toast('El navegador bloqueó la ventana del reporte.');

  const totals = rows.reduce((sum, row) => {
    sum.totalMxn += row.total_mxn; sum.totalUsd += row.total_usd;
    sum.collectedMxn += row.collected_mxn; sum.collectedUsd += row.collected_usd;
    sum.balanceMxn += row.balance_mxn; sum.balanceUsd += row.balance_usd;
    return sum;
  }, { totalMxn: 0, totalUsd: 0, collectedMxn: 0, collectedUsd: 0, balanceMxn: 0, balanceUsd: 0 });

  popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte de Cobranza</title><style>
    @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#1d2b23;margin:0}.toolbar{display:flex;justify-content:flex-end;margin-bottom:14px}.toolbar button{padding:9px 14px;border:1px solid #ccd7d0;background:#fff;border-radius:7px;cursor:pointer}.head{display:flex;align-items:center;gap:18px;border-bottom:2px solid #245d39;padding-bottom:12px;margin-bottom:14px}.head img{width:82px;height:55px;object-fit:contain}.head h1{font-size:20px;margin:0}.head p{font-size:11px;color:#66736c;margin:4px 0 0}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}.summary div{border:1px solid #dbe4de;border-radius:8px;padding:9px}.summary span{display:block;font-size:9px;color:#68766e;text-transform:uppercase}.summary strong{display:block;font-size:12px;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:8px}th,td{border:1px solid #dce4df;padding:5px;text-align:left}th{background:#eef4f0}.num{text-align:right}tfoot{font-weight:700;background:#f3f6f4}@media print{.toolbar{display:none}}
  </style></head><body>
    <div class="toolbar"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>
    <div class="head"><img src="/assets/logo-alansa.png"><div><h1>REPORTE DE COBRANZA</h1><p>Reporte generado el ${date(todayIso())}</p></div></div>
    <div class="summary"><div><span>Total remisiones</span><strong>${money(totals.totalMxn,'MXN')} | ${money(totals.totalUsd,'USD')}</strong></div><div><span>Cobrado</span><strong>${money(totals.collectedMxn,'MXN')} | ${money(totals.collectedUsd,'USD')}</strong></div><div><span>Saldo</span><strong>${money(totals.balanceMxn,'MXN')} | ${money(totals.balanceUsd,'USD')}</strong></div></div>
    <table><thead><tr><th>Folio</th><th>Fecha</th><th>Vencimiento</th><th>Contrato</th><th>Cliente</th><th>Total MXN</th><th>Total USD</th><th>Cobrado MXN</th><th>Cobrado USD</th><th>Saldo MXN</th><th>Saldo USD</th><th>Estatus</th></tr></thead><tbody>
      ${rows.map(row => `<tr><td>${escapeHtml(row.folio)}</td><td>${date(row.shipment_date)}</td><td>${date(row.due_date)}</td><td>${escapeHtml(row.contract_number||'—')}</td><td>${escapeHtml(row.client_name||'—')}</td><td class="num">${money(row.total_mxn,'MXN')}</td><td class="num">${money(row.total_usd,'USD')}</td><td class="num">${money(row.collected_mxn,'MXN')}</td><td class="num">${money(row.collected_usd,'USD')}</td><td class="num">${money(row.balance_mxn,'MXN')}</td><td class="num">${money(row.balance_usd,'USD')}</td><td>${row.financial_status}</td></tr>`).join('')}
    </tbody><tfoot><tr><td colspan="5">TOTAL</td><td class="num">${money(totals.totalMxn,'MXN')}</td><td class="num">${money(totals.totalUsd,'USD')}</td><td class="num">${money(totals.collectedMxn,'MXN')}</td><td class="num">${money(totals.collectedUsd,'USD')}</td><td class="num">${money(totals.balanceMxn,'MXN')}</td><td class="num">${money(totals.balanceUsd,'USD')}</td><td></td></tr></tfoot></table>
    <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script>
  </body></html>`);
  popup.document.close();
}


/* =========================================================
   10. UTILIDADES
   ========================================================= */

async function reloadCollections() {
  data = await api('collections');
  renderDynamic();
}

function renderDynamic() {
  closeFilterMenu();

  const summary =
    document.getElementById(
      'collectionsSummary'
    );

  const table =
    document.getElementById(
      'collectionsTable'
    );

  if (summary) {
    summary.innerHTML =
      summaryCards();
  }

  if (table) {
    table.innerHTML =
      portfolioTable();
  }

  bindTableEvents();
}


function renderTableOnly() {
  closeFilterMenu();

  const table =
    document.getElementById(
      'collectionsTable'
    );

  if (table) {
    table.innerHTML =
      portfolioTable();
  }

  bindTableEvents();
}

function statusBadge(status) {
  const cls = status.toLowerCase().replaceAll(' ', '-');
  return `<span class="collections-status collections-status-${cls}">${escapeHtml(status)}</span>`;
}

function daysLabel(row) {
  if (row.balance_original <= 0) return '—';
  return row.days_remaining < 0 ? `${Math.abs(row.days_remaining)} venc.` : number(row.days_remaining);
}

function filterDisplay(row, column) {
  if (column.type === 'number') return String(round2(row[column.key]));
  if (column.type === 'date') return String(row[column.key] || '');
  return String(row[column.key] ?? '—');
}

function exportValue(row, column) {
  if (column.type === 'number') return round2(row[column.key]);
  return row[column.key] ?? '';
}

function compareValues(a, b, type) {
  if (type === 'number') return numeric(a) - numeric(b);
  return String(a ?? '').localeCompare(String(b ?? ''), 'es', { numeric: true });
}

function both(amount, currency, rate) {
  const value = numeric(amount);
  const fx = numeric(rate) || 1;
  return String(currency).toUpperCase() === 'MXN'
    ? { mxn: value, usd: value / fx }
    : { mxn: value * fx, usd: value };
}

function uniqueBy(rows, valueKey, labelKey) {
  const map = new Map();
  rows.forEach(row => map.set(String(row[valueKey]), { value: String(row[valueKey]), label: row[labelKey] || '—' }));
  return [...map.values()].sort((a, b) => String(a.label).localeCompare(String(b.label), 'es', { numeric: true }));
}

function valueOf(id) { return document.getElementById(id)?.value || ''; }
function numeric(value) { const n = Number(value || 0); return Number.isFinite(n) ? n : 0; }
function round2(value) { return Math.round((numeric(value) + Number.EPSILON) * 100) / 100; }
function parseMoney(value) { return numeric(String(value ?? '').replaceAll(',', '')); }
function formatInput(value) { return numeric(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }); }
function todayIso() { return new Date().toISOString().slice(0, 10); }

function daysBetween(from, to) {
  if (!to) return 0;
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${String(to).slice(0, 10)}T12:00:00`);
  return Math.round((b - a) / 86400000);
}

function excelWorksheet(headers, rows) {
  const cell = value => `<td>${escapeHtml(value ?? '')}</td>`;
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell).join('')}</tr>`).join('')}</tbody></table></body></html>`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
