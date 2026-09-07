import { api } from '../core/api.js';
import { money, number } from '../core/format.js';
import { moduleHeader } from '../components/common.js';


/* =========================================================
   1. DASHBOARD
   ========================================================= */

export async function dashboard() {
  let data = {
    sales_usd: 0,
    collected_usd: 0,
    receivable_usd: 0,
    expenses_mxn: 0,
    production_boxes: 0,
    production_pounds: 0
  };

  let plantings = [];

  try {
    const responses = await Promise.all([
      api('dashboard'),
      api('plantings')
    ]);

    data = {
      ...data,
      ...(responses[0] || {})
    };

    plantings = responses[1] || [];
  } catch {}

  const projection = calculateProjection(
    plantings,
    data
  );

  return `
    ${moduleHeader(
      'Dashboard',
      'Visión general de la operación agrícola'
    )}

    <div class="content dashboard-content">

      ${filters()}

      <section class="dashboard-kpis">

        ${kpi(
          'Ventas',
          money(data.sales_usd, 'USD'),
          'Importe bruto remitido',
          'primary'
        )}

        ${kpi(
          'Cobrado',
          money(data.collected_usd, 'USD'),
          'Pagos aplicados',
          'success'
        )}

        ${kpi(
          'Por cobrar',
          money(data.receivable_usd, 'USD'),
          'Saldo pendiente',
          'warning'
        )}

        ${kpi(
          'Producción',
          `${number(data.production_boxes)} cajas`,
          `${number(data.production_pounds)} lb`,
          'neutral'
        )}

        ${kpi(
          'Gastos',
          money(data.expenses_mxn, 'MXN'),
          'Equivalente acumulado',
          'neutral'
        )}

      </section>


      ${projectionSection(
        projection
      )}


      <section class="dashboard-charts">

        <article class="card dashboard-panel">

          <div class="dashboard-panel-head">
            <div>
              <span class="dashboard-eyebrow">
                Producción
              </span>

              <h2>
                Producción por semana
              </h2>
            </div>
          </div>

          <div class="chart-placeholder">
            Las gráficas se alimentarán de D1.
            <br>
            Cada punto mostrará su valor.
          </div>

        </article>


        <article class="card dashboard-panel">

          <div class="dashboard-panel-head">
            <div>
              <span class="dashboard-eyebrow">
                Gastos
              </span>

              <h2>
                Gastos por categoría
              </h2>
            </div>
          </div>

          <div class="chart-placeholder">
            Valores y porcentajes visibles
            en cada categoría.
          </div>

        </article>

      </section>

    </div>
  `;
}


/* =========================================================
   2. FILTROS
   ========================================================= */

function filters() {
  return `
    <section class="card dashboard-filters">

      <div class="dashboard-filter-grid">

        <div class="field">
          <label>Desde</label>

          <input
            class="input"
            type="date"
            id="filterFrom"
          >
        </div>

        <div class="field">
          <label>Hasta</label>

          <input
            class="input"
            type="date"
            id="filterTo"
          >
        </div>

        <div class="field">
          <label>Siembra / contrato</label>

          <select class="input">
            <option>
              Todos
            </option>
          </select>
        </div>

        <div class="field">
          <label>Producto</label>

          <select class="input">
            <option>
              Todos
            </option>

            <option selected>
              Minibell
            </option>
          </select>
        </div>

      </div>

      <div class="dashboard-filter-actions">

        <button
          class="btn dashboard-clear"
          type="button"
        >
          Limpiar filtros
        </button>

      </div>

    </section>
  `;
}


/* =========================================================
   3. KPI
   ========================================================= */

function kpi(
  label,
  value,
  meta,
  tone
) {
  return `
    <article
      class="card dashboard-kpi dashboard-kpi-${tone}"
    >

      <div class="dashboard-kpi-label">
        ${label}
      </div>

      <div class="dashboard-kpi-value">
        ${value}
      </div>

      <div class="dashboard-kpi-meta">
        ${meta}
      </div>

    </article>
  `;
}


/* =========================================================
   4. CALCULAR PROYECCIÓN
   ========================================================= */

function calculateProjection(
  plantings,
  dashboardData
) {
  const projection = {
    plantings: 0,
    hectares: 0,

    boxes: 0,
    pounds: 0,

    salesUsd: 0,
    salesMxn: 0,

    seedUsd: 0,
    seedMxn: 0,

    productionBoxes:
      numeric(
        dashboardData.production_boxes
      ),

    progress: 0,
    remainingBoxes: 0
  };

  plantings.forEach(planting => {
    const hectares = numeric(
      planting.hectares
    );

    const expectedYield = numeric(
      planting.expected_yield_boxes_ha
    );

    if (
      hectares <= 0 ||
      expectedYield <= 0
    ) {
      return;
    }

    const projectedBoxes =
      hectares *
      expectedYield;

    const standardWeight = numeric(
      planting.standard_box_lbs
    ) || 12;

    const projectedPounds =
      projectedBoxes *
      standardWeight;

    const pricePerBox = numeric(
      planting.price_per_box
    );

    const projectedSales =
      projectedBoxes *
      pricePerBox;

    const seedCost = numeric(
      planting.estimated_seed_cost
    );

    projection.plantings += 1;
    projection.hectares += hectares;
    projection.boxes += projectedBoxes;
    projection.pounds += projectedPounds;

    if (
      planting.price_currency === 'MXN'
    ) {
      projection.salesMxn +=
        projectedSales;
    } else {
      projection.salesUsd +=
        projectedSales;
    }

    if (
      planting.seed_currency === 'MXN'
    ) {
      projection.seedMxn +=
        seedCost;
    } else {
      projection.seedUsd +=
        seedCost;
    }
  });

  if (projection.boxes > 0) {
    projection.progress =
      (
        projection.productionBoxes /
        projection.boxes
      ) * 100;

    projection.remainingBoxes =
      Math.max(
        projection.boxes -
        projection.productionBoxes,
        0
      );
  }

  return projection;
}


/* =========================================================
   5. SECCIÓN PROYECCIÓN
   ========================================================= */

function projectionSection(
  projection
) {
  if (
    projection.plantings === 0
  ) {
    return `
      <section class="dashboard-projection">

        <div class="dashboard-section-head">

          <div>
            <span class="dashboard-eyebrow">
              Planeación
            </span>

            <h2>
              Proyección
            </h2>

            <p>
              Agrega el rendimiento esperado
              a tus siembras para generar
              la proyección.
            </p>
          </div>

        </div>

        <article class="card projection-empty">

          <strong>
            Todavía no hay datos suficientes
          </strong>

          <span>
            La proyección necesita hectáreas y
            rendimiento esperado en cajas por hectárea.
          </span>

        </article>

      </section>
    `;
  }

  return `
    <section class="dashboard-projection">

      <div class="dashboard-section-head">

        <div>
          <span class="dashboard-eyebrow">
            Planeación
          </span>

          <h2>
            Proyección
          </h2>

          <p>
            Estimación basada en las condiciones
            registradas de cada siembra.
          </p>
        </div>

        <div class="projection-summary">

          <strong>
            ${number(
              projection.plantings
            )}
          </strong>

          <span>
            ${
              projection.plantings === 1
                ? 'siembra proyectada'
                : 'siembras proyectadas'
            }
          </span>

        </div>

      </div>


      <div class="projection-main">

        <article class="card projection-hero">

          <div class="projection-hero-label">
            Producción estimada
          </div>

          <div class="projection-hero-value">
            ${number(
              projection.boxes,
              0
            )}
            <span>
              cajas
            </span>
          </div>

          <div class="projection-hero-meta">

            <span>
              ${number(
                projection.pounds,
                0
              )}
              lb
            </span>

            <span>
              ${number(
                projection.hectares,
                2
              )}
              ha
            </span>

          </div>

        </article>


        <div class="projection-cards">

          ${projectionCard(
            'Venta proyectada',
            money(
              projection.salesUsd,
              'USD'
            ),
            projection.salesMxn > 0
              ? money(
                  projection.salesMxn,
                  'MXN'
                )
              : 'Valor estimado',
            'sales'
          )}

          ${projectionCard(
            'Semilla estimada',
            money(
              projection.seedUsd,
              'USD'
            ),
            projection.seedMxn > 0
              ? money(
                  projection.seedMxn,
                  'MXN'
                )
              : 'Costo estimado',
            'seed'
          )}

          ${projectionCard(
            'Producción real',
            `${number(
              projection.productionBoxes,
              0
            )} cajas`,
            'Registrado a la fecha',
            'production'
          )}

          ${projectionCard(
            'Pendiente estimado',
            `${number(
              projection.remainingBoxes,
              0
            )} cajas`,
            'Por producir',
            'remaining'
          )}

        </div>

      </div>


      <article class="card projection-progress">

        <div class="projection-progress-head">

          <div>
            <span>
              Avance de producción
            </span>

            <strong>
              ${formatPercent(
                projection.progress
              )}
            </strong>
          </div>

          <div class="projection-progress-values">

            <span>
              ${number(
                projection.productionBoxes,
                0
              )}
              producidas
            </span>

            <span>
              de
              ${number(
                projection.boxes,
                0
              )}
              proyectadas
            </span>

          </div>

        </div>

        <div class="projection-progress-track">

          <div
            class="projection-progress-bar"
            style="width:${Math.min(
              projection.progress,
              100
            )}%"
          ></div>

        </div>

      </article>

    </section>
  `;
}


/* =========================================================
   6. TARJETA DE PROYECCIÓN
   ========================================================= */

function projectionCard(
  label,
  value,
  meta,
  tone
) {
  return `
    <article
      class="card projection-card projection-card-${tone}"
    >

      <span class="projection-card-label">
        ${label}
      </span>

      <strong class="projection-card-value">
        ${value}
      </strong>

      <span class="projection-card-meta">
        ${meta}
      </span>

    </article>
  `;
}


/* =========================================================
   7. UTILIDADES
   ========================================================= */

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


function formatPercent(
  value
) {
  const safeValue = Number.isFinite(
    value
  )
    ? value
    : 0;

  return `${safeValue.toLocaleString(
    'es-MX',
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }
  )}%`;
}
