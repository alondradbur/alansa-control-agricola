import { state, logout } from '../core/state.js';

const items = [
  ['dashboard','Dashboard'],
  ['plantings','Siembras'],
  ['production','Producción'],
  ['inventory','Inventario'],
  ['shipments','Remisiones'],
  ['collections','Cobranza'],
  ['expenses','Gastos'],
  ['settlements','Liquidaciones'],
  ['reports','Reportes'],
  ['catalogs','Catálogos'],
  ['settings','Configuración']
];

export function shell(content) {
  const nav = items.map(([id,label]) => `
    <button data-route="${id}" class="${state.route === id ? 'active' : ''}">
      ${label}
    </button>
  `).join('');

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <img src="/assets/logo-alansa.png" alt="ALANSA">
          <div>
            <strong>ALANSA</strong>
            <small>Sistema de Control Agrícola</small>
          </div>
        </div>

        <nav class="nav">${nav}</nav>

        <div class="sidebar-foot">
          Usuario ${state.user?.display_name || '—'} · ${state.user?.role || '—'}
          <br><br>
          <button class="btn soft" id="logoutBtn">Salir</button>
        </div>
      </aside>

      <main class="main">${content}</main>

      <nav class="mobile-bar">
        <button data-route="dashboard" class="${state.route==='dashboard'?'active':''}">⌂<span>Inicio</span></button>
        <button data-route="shipments" class="${state.route==='shipments'?'active':''}">▤<span>Remisiones</span></button>
        <button id="quickAdd"><span class="plus">＋</span><span>Nuevo</span></button>
        <button data-route="collections" class="${state.route==='collections'?'active':''}">$<span>Cobranza</span></button>
        <button data-route="more">☰<span>Más</span></button>
      </nav>
    </div>
  `;
}

export function bindLayout(navigate) {
  document.querySelectorAll('[data-route]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.route));
  });

  document.querySelector('#logoutBtn')?.addEventListener('click', () => {
    logout();
    location.reload();
  });

  document.querySelector('#quickAdd')?.addEventListener('click', () => {
    navigate('shipments');
  });
}
