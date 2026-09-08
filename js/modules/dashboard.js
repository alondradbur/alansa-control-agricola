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

let shipmentTableState = {
  status: '',
  client: '',
  search: ''
};

let dueTableState = {
  days: '30',
  client: ''
};


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

        shipmentTableState = {
          status: '',
          client: '',
          search: ''
        };

        dueTableState = {
          days: '30',
          client: ''
        };

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
  root
    .querySelector(
      '#shipmentStatusFilter'
    )
    ?.addEventListener(
      'change',
      event => {
        shipmentTableState.status =
          event.target.value;

        renderShipmentTable(
          root
        );
      }
    );

  root
    .querySelector(
      '#shipmentClientFilter'
    )
    ?.addEventListener(
      'change',
      event => {
        shipmentTableState.client =
          event.target.value;

        renderShipmentTable(
          root
        );
      }
    );

  root
    .querySelector(
      '#shipmentSearchFilter'
    )
    ?.addEventListener(
      'input',
      event => {
        shipmentTableState.search =
          event.target.value;

        renderShipmentTable(
          root
        );
      }
    );

  root
    .querySelector(
      '#dueDaysFilter'
    )
    ?.addEventListener(
      'change',
      event => {
        dueTableState.days =
          event.target.value;

        renderDueTable(
          root
        );
      }
    );

  root
    .querySelector(
      '#dueClientFilter'
    )
    ?.addEventListener(
      'change',
      event => {
        dueTableState.client =
          event.target.value;

        renderDueTable(
          root
        );
      }
    );
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

      <div class="dashboard-v2-local-filters">

        <div class="field">
          <label>
            Estatus
          </label>

          <select
            class="input"
            id="shipmentStatusFilter"
          >
            ${statusFilterOptions(
              shipmentTableState.status
            )}
          </select>
        </div>

        <div class="field">
          <label>
            Cliente
          </label>

          <select
            class="input"
            id="shipmentClientFilter"
          >
            ${clientFilterOptions(
              shipmentTableState.client
            )}
          </select>
        </div>

        <div class="field dashboard-v2-search">
          <label>
            Buscar remisión
          </label>

          <input
            class="input"
            id="shipmentSearchFilter"
            type="search"
            value="${escapeHtml(
              shipmentTableState.search
            )}"
            placeholder="Folio..."
          >
        </div>

      </div>

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
  const rows =
    filteredShipments(
      true
    );

  if (rows.length === 0) {
    return emptyState(
      'No se encontraron remisiones para los filtros seleccionados.'
    );
  }

  const totals =
    sumShipments(
      rows
    );

  return `
    <div class="dashboard-v2-table-scroll">

      <table class="dashboard-v2-table">

        <thead>
          <tr>
            <th>No. remisión</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Monto MXN</th>
            <th>Monto USD</th>
            <th>Estatus</th>
          </tr>
        </thead>

        <tbody>
          ${rows
            .map(shipmentRow)
            .join('')}
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

      <div class="dashboard-v2-local-filters dashboard-v2-due-filters">

        <div class="field">
          <label>
            Días próximos
          </label>

          <select
            class="input"
            id="dueDaysFilter"
          >
            ${dueDaysOptions(
              dueTableState.days
            )}
          </select>
        </div>

        <div class="field">
          <label>
            Cliente
          </label>

          <select
            class="input"
            id="dueClientFilter"
          >
            ${clientFilterOptions(
              dueTableState.client
            )}
          </select>
        </div>

      </div>

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

  const limit =
    Number(
      dueTableState.days || 30
    );

  const rows =
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

        if (
          dueTableState.client &&
          String(row.client_id) !==
            String(
              dueTableState.client
            )
        ) {
          return false;
        }

        const due =
          parseDate(
            row.due_date
          );

        if (!due) {
          return false;
        }

        const days =
          daysBetween(
            today,
            due
          );

        return (
          days >= 0 &&
          days <= limit
        );
      })
      .sort((a, b) => {
        return String(
          a.due_date
        ).localeCompare(
          String(
            b.due_date
          )
        );
      });

  if (rows.length === 0) {
    return emptyState(
      'No hay remisiones próximas a vencer en el periodo seleccionado.'
    );
  }

  return `
    <div class="dashboard-v2-table-scroll dashboard-v2-due-scroll">

      <table class="dashboard-v2-table">

        <thead>
          <tr>
            <th>No. remisión</th>
            <th>Fecha</th>
            <th>Vencimiento</th>
            <th>Cliente</th>
            <th>Monto MXN</th>
            <th>Monto USD</th>
            <th>Días restantes</th>
          </tr>
        </thead>

        <tbody>
          ${rows
            .map(dueRow)
            .join('')}
        </tbody>

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
      String(row.product_id) !==
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
      String(row.product_id) !==
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

    if (!includeLocalFilters) {
      return true;
    }

    if (
      shipmentTableState.status &&
      shipmentFinancialStatus(
        row
      ) !==
        shipmentTableState.status
    ) {
      return false;
    }

    if (
      shipmentTableState.client &&
      String(row.client_id) !==
        String(
          shipmentTableState.client
        )
    ) {
      return false;
    }

    if (
      shipmentTableState.search &&
      !String(
        row.folio || ''
      )
        .toLowerCase()
        .includes(
          shipmentTableState.search
            .trim()
            .toLowerCase()
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


function clientFilterOptions(
  selected
) {
  return `
    <option value="">
      Todos
    </option>

    ${
      (
        dashboardData?.clients ||
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
        .join('')
    }
  `;
}


function statusFilterOptions(
  selected
) {
  return [
    ['', 'Todos'],
    ['Pendiente', 'Pendiente'],
    ['Parcial', 'Parcial'],
    ['Cobrada', 'Cobrada']
  ]
    .map(([value, label]) => {
      return `
        <option
          value="${value}"
          ${value === selected
            ? 'selected'
            : ''}
        >
          ${label}
        </option>
      `;
    })
    .join('');
}


function dueDaysOptions(
  selected
) {
  return [
    ['7', 'Próximos 7 días'],
    ['15', 'Próximos 15 días'],
    ['30', 'Próximos 30 días'],
    ['60', 'Próximos 60 días'],
    ['90', 'Próximos 90 días']
  ]
    .map(([value, label]) => {
      return `
        <option
          value="${value}"
          ${value === selected
            ? 'selected'
            : ''}
        >
          ${label}
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
