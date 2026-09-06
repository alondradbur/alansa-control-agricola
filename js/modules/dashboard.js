import { api } from '../core/api.js';
import { money, number } from '../core/format.js';
import { moduleHeader } from '../components/common.js';

export async function dashboard() {
  let data = {
    sales_usd: 0, collected_usd: 0, receivable_usd: 0,
    expenses_mxn: 0, production_boxes: 0, production_pounds: 0
  };

  try {
    data = { ...data, ...(await api('dashboard')) };
  } catch {}

  return `
    ${moduleHeader('Dashboard', 'Visión general de la operación agrícola')}
    <div class="content">
      <section class="card filters">
        <div class="field">
          <label>Desde</label>
          <input class="input" type="date" id="filterFrom">
        </div>
        <div class="field">
          <label>Hasta</label>
          <input class="input" type="date" id="filterTo">
        </div>
        <div class="field">
          <label>Siembra / contrato</label>
          <select class="input"><option>Todos</option></select>
        </div>
        <div class="field">
          <label>Producto</label>
          <select class="input"><option>Todos</option><option selected>Minibell</option></select>
        </div>
        <button class="btn wide-mobile">Limpiar filtros</button>
      </section>

      <section class="kpi-grid">
        ${kpi('Ventas', money(data.sales_usd,'USD'), 'Importe bruto remitido')}
        ${kpi('Cobrado', money(data.collected_usd,'USD'), 'Pagos aplicados')}
        ${kpi('Por cobrar', money(data.receivable_usd,'USD'), 'Saldo pendiente')}
        ${kpi('Producción', `${number(data.production_boxes)} cajas`, `${number(data.production_pounds)} lb`)}
        ${kpi('Gastos', money(data.expenses_mxn,'MXN'), 'Equivalente acumulado')}
      </section>

      <section class="grid-2">
        <div class="card panel">
          <h2>Producción por semana</h2>
          <div class="chart-placeholder">
            Las gráficas se alimentarán de D1.<br>
            Cada punto mostrará su etiqueta de valor.
          </div>
        </div>

        <div class="card panel">
          <h2>Gastos por categoría</h2>
          <div class="chart-placeholder">
            Valores y porcentajes visibles en cada categoría.
          </div>
        </div>
      </section>
    </div>
  `;
}

function kpi(label, value, meta) {
  return `
    <article class="card kpi">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
      <div class="meta">${meta}</div>
    </article>
  `;
}
