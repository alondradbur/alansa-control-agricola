import { api } from '../core/api.js';
import { escapeHtml } from '../core/format.js';
import { moduleHeader, empty, toast } from '../components/common.js';

export async function catalogs() {
  let data = { products: [], expense_categories: [], clients: [], suppliers: [] };
  try { data = await api('catalogs'); } catch {}

  return `
    ${moduleHeader('Catálogos', 'Listas maestras que alimentan el resto del sistema')}
    <div class="content">
      ${catalogCard('Productos', data.products, ['name','short_code'])}
      ${catalogCard('Categorías de gastos', data.expense_categories, ['name','default_amount','default_currency'])}
      ${catalogCard('Clientes', data.clients, ['name','credit_days'])}
      ${catalogCard('Proveedores', data.suppliers, ['name','contact'])}
    </div>
  `;
}

function catalogCard(title, rows, fields) {
  const body = rows.length
    ? rows.map(row => `<tr>${fields.map(f => `<td>${escapeHtml(row[f] ?? '—')}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${fields.length}">${empty('No hay registros en este catálogo.')}</td></tr>`;

  return `
    <section class="card table-card">
      <div class="table-toolbar">
        <strong>${title}</strong>
        <button class="btn primary" data-demo-add>＋ Agregar</button>
      </div>
      <div class="table-scroll">
        <table>
          <thead><tr>${fields.map(f => `<th>${escapeHtml(f.replaceAll('_',' '))}</th>`).join('')}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>
  `;
}

export function bindCatalogs() {
  document.querySelectorAll('[data-demo-add]').forEach(btn => {
    btn.addEventListener('click', () => toast('Formulario de alta preparado para la siguiente fase.'));
  });
}
