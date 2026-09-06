import { api } from '../core/api.js';
import { money, date, number, escapeHtml } from '../core/format.js';
import { moduleHeader, empty, toast } from '../components/common.js';

export async function shipments() {
  let rows = [];
  try { rows = await api('shipments'); } catch {}

  const body = rows.length ? rows.map(r => `
    <tr>
      <td><strong>${escapeHtml(r.folio)}</strong></td>
      <td>${date(r.shipment_date)}</td>
      <td>${escapeHtml(r.client_name)}</td>
      <td>${escapeHtml(r.product_name)}</td>
      <td>${number(r.boxes)}</td>
      <td>${number(r.pounds,2)}</td>
      <td>${number(r.avg_lbs,2)} lb</td>
      <td>${money(r.amount,r.currency)}</td>
      <td><span class="status ${escapeHtml(r.status)}">${escapeHtml(r.status)}</span></td>
    </tr>
  `).join('') : `<tr><td colspan="9">${empty()}</td></tr>`;

  return `
    ${moduleHeader(
      'Remisiones',
      'Control de embarques, folios y saldos',
      '<button class="btn primary" id="newShipment">＋ Nueva remisión</button>'
    )}

    <div class="content">
      <section class="card filters">
        <div class="field"><label>Desde</label><input class="input" type="date"></div>
        <div class="field"><label>Hasta</label><input class="input" type="date"></div>
        <div class="field"><label>Estado</label><select class="input"><option>Todos</option><option>Pendiente</option><option>Pagada</option></select></div>
        <div class="field"><label>Producto</label><select class="input"><option>Todos</option><option selected>Minibell</option></select></div>
        <button class="btn">Limpiar filtros</button>
      </section>

      <section class="card table-card">
        <div class="table-toolbar">
          <strong>Remisiones registradas</strong>
          <button class="btn">Exportar Excel</button>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Folio</th><th>Fecha</th><th>Cliente</th><th>Producto</th>
                <th>Cajas</th><th>Libras</th><th>Promedio</th><th>Importe</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

export function bindShipments() {
  document.querySelector('#newShipment')?.addEventListener('click', () => {
    toast('La captura de remisión será el siguiente formulario operativo a conectar.');
  });
}
