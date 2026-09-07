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

  try {
    data = {
      ...data,
      ...(await api('dashboard'))
    };
  } catch {}


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

function kpi(label, value, meta, tone) {

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
