import { state, setUser, restoreUser } from './core/state.js';
import { shell, bindLayout } from './components/layout.js';
import { dashboard } from './modules/dashboard.js';
import { catalogs, bindCatalogs } from './modules/catalogs.js';
import { plantings, bindPlantings } from './modules/plantings.js';
import { shipments, bindShipments } from './modules/shipments.js';
import { placeholder } from './modules/placeholder.js';

const app = document.querySelector('#app');

boot();

async function boot() {
  restoreUser();

  if (!state.user) {
    renderLogin();
    return;
  }

  await navigate('dashboard');
}

function renderLogin() {
  app.innerHTML = `
    <section class="login">
      <div class="card login-card">
       <img
  src="/assets/icon-512.png"
  alt="Sistema Agrícola"
  class="login-app-icon"
>
        <h1>Sistema de Control Agrícola</h1>
        <p class="muted">Selecciona quién está ingresando.</p>

        <div class="user-choice">
          <button class="btn" data-user="A">Usuario A</button>
          <button class="btn" data-user="R">Usuario R</button>
        </div>

        <p class="muted" style="font-size:.75rem">
          El rol Administrador u Operador se asignará a cada usuario desde Configuración.
        </p>
      </div>
    </section>
  `;

  document.querySelectorAll('[data-user]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Fase inicial: se conserva la identidad de A/R.
      // La validación de contraseña por rol se conectará al endpoint de autenticación.
      setUser({
        code: btn.dataset.user,
        display_name: btn.dataset.user,
        role: 'Operador'
      });
      navigate('dashboard');
    });
  });
}

async function navigate(route) {
  state.route = route;

  let content;

  if (route === 'dashboard') content = await dashboard();
  else if (route === 'catalogs') content = await catalogs();
  else if (route === 'plantings') content = await plantings();
  else if (route === 'shipments') content = await shipments();
  else content = await placeholder(route);

  app.innerHTML = shell(content);
  bindLayout(navigate);

  if (route === 'catalogs') bindCatalogs(() => navigate('catalogs'));
  if (route === 'plantings') bindPlantings(() => navigate('plantings'));
  if (route === 'shipments') bindShipments();

  window.scrollTo({ top: 0, behavior: 'instant' });
}
