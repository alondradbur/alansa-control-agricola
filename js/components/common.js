import { escapeHtml } from '../core/format.js';

export function moduleHeader(title, subtitle, actions = '') {
  return `
    <div class="module-sticky">
      <div class="module-head">
        <div>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        <div>${actions}</div>
      </div>
    </div>
  `;
}

export function empty(message = 'No se encontraron registros con los filtros seleccionados.') {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

export function toast(message) {
  const root = document.querySelector('#toastRoot');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}
