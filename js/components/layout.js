import { state, logout } from '../core/state.js';

/* =========================================================
   1. ICONOS DEL MENÚ
   ========================================================= */

const icons = {
  dashboard: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="2"></rect>
      <rect x="14" y="3" width="7" height="7" rx="2"></rect>
      <rect x="3" y="14" width="7" height="7" rx="2"></rect>
      <rect x="14" y="14" width="7" height="7" rx="2"></rect>
    </svg>
  `,

  plantings: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21V10"></path>
      <path d="M12 13C8 13 5 10 5 6c4 0 7 3 7 7Z"></path>
      <path d="M12 10c0-4 3-7 7-7 0 4-3 7-7 7Z"></path>
    </svg>
  `,

  production: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20V10"></path>
      <path d="M10 20V4"></path>
      <path d="M16 20v-7"></path>
      <path d="M22 20H2"></path>
    </svg>
  `,

  inventory: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5Z"></path>
      <path d="M4 7.5 12 12l8-4.5"></path>
      <path d="M12 12v9"></path>
    </svg>
  `,

  shipments: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7h11v10H3Z"></path>
      <path d="M14 10h4l3 3v4h-7Z"></path>
      <circle cx="7" cy="18" r="2"></circle>
      <circle cx="18" cy="18" r="2"></circle>
    </svg>
  `,

  collections: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M15 8.5c-.7-.6-1.7-1-3-1-1.8 0-3 .9-3 2.2 0 1.5 1.3 2 3.2 2.4 1.8.3 2.8.8 2.8 2.2 0 1.3-1.2 2.2-3 2.2-1.4 0-2.6-.4-3.5-1.2"></path>
      <path d="M12 5.5v13"></path>
    </svg>
  `,

  expenses: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v14"></path>
      <path d="m7 12 5 5 5-5"></path>
      <path d="M5 21h14"></path>
    </svg>
  `,

  settlements: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h14v16H5Z"></path>
      <path d="M8 8h8"></path>
      <path d="M8 12h8"></path>
      <path d="M8 16h5"></path>
    </svg>
  `,

  reports: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h9l4 4v14H6Z"></path>
      <path d="M15 3v5h5"></path>
      <path d="M9 17v-3"></path>
      <path d="M12 17v-6"></path>
      <path d="M15 17v-2"></path>
    </svg>
  `,

  catalogs: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1.5"></rect>
      <rect x="14" y="4" width="6" height="6" rx="1.5"></rect>
      <rect x="4" y="14" width="6" height="6" rx="1.5"></rect>
      <rect x="14" y="14" width="6" height="6" rx="1.5"></rect>
    </svg>
  `,

  settings: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"></path>
    </svg>
  `
};


/* =========================================================
   2. OPCIONES DEL MENÚ
   ========================================================= */

const items = [
  ['dashboard', 'Dashboard'],
  ['plantings', 'Siembras'],
  ['production', 'Producción'],
  ['inventory', 'Inventario'],
  ['shipments', 'Remisiones'],
  ['collections', 'Cobranza'],
  ['expenses', 'Gastos'],
  ['settlements', 'Liquidaciones'],
  ['reports', 'Reportes'],
  ['catalogs', 'Catálogos'],
  ['settings', 'Configuración']
];


/* =========================================================
   3. ESTRUCTURA PRINCIPAL
   ========================================================= */

export function shell(content) {
  const nav = items.map(([id, label]) => `
    <button
      data-route="${id}"
      class="nav-item ${state.route === id ? 'active' : ''}"
      type="button"
    >
      <span class="nav-icon">
        ${icons[id]}
      </span>

      <span class="nav-label">
        ${label}
      </span>
    </button>
  `).join('');

  return `
    <div class="app-shell">

      <aside class="sidebar">

        <div class="sidebar-brand">

          <img
            src="/assets/icon-512.png"
            alt="Sistema Agrícola"
            class="sidebar-brand-icon"
          >

          <div class="sidebar-brand-text">
            <strong>Sistema de Control</strong>
            <span>Agrícola</span>
          </div>

        </div>

        <nav class="nav">
          ${nav}
        </nav>

        <div class="sidebar-foot">

          <div class="sidebar-user">
            <div class="sidebar-user-avatar">
              ${state.user?.display_name || '—'}
            </div>

            <div class="sidebar-user-info">
              <strong>
                Usuario ${state.user?.display_name || '—'}
              </strong>

              <span>
                ${state.user?.role || '—'}
              </span>
            </div>
          </div>

          <button
            class="sidebar-logout"
            id="logoutBtn"
            type="button"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 4H5v16h5"></path>
              <path d="M14 8l4 4-4 4"></path>
              <path d="M18 12H9"></path>
            </svg>

            <span>Salir</span>
          </button>

        </div>

      </aside>

      <main class="main">
        ${content}
      </main>

      <nav class="mobile-bar">

        <button
          data-route="dashboard"
          class="${state.route === 'dashboard' ? 'active' : ''}"
        >
          ⌂
          <span>Inicio</span>
        </button>

        <button
          data-route="shipments"
          class="${state.route === 'shipments' ? 'active' : ''}"
        >
          ▤
          <span>Remisiones</span>
        </button>

        <button id="quickAdd">
          <span class="plus">＋</span>
          <span>Nuevo</span>
        </button>

        <button
          data-route="collections"
          class="${state.route === 'collections' ? 'active' : ''}"
        >
          $
          <span>Cobranza</span>
        </button>

        <button data-route="more">
          ☰
          <span>Más</span>
        </button>

      </nav>

    </div>
  `;
}


/* =========================================================
   4. EVENTOS DEL LAYOUT
   ========================================================= */

export function bindLayout(navigate) {
  document.querySelectorAll('[data-route]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate(btn.dataset.route);
    });
  });

  document.querySelector('#logoutBtn')?.addEventListener('click', () => {
    logout();
    location.reload();
  });

  document.querySelector('#quickAdd')?.addEventListener('click', () => {
    navigate('shipments');
  });
}
