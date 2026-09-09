import { state, setUser, restoreUser } from './core/state.js';
import { shell, bindLayout } from './components/layout.js';
import {
  dashboard,
  bindDashboard
} from './modules/dashboard.js';
import { catalogs, bindCatalogs } from './modules/catalogs.js';
import { plantings, bindPlantings } from './modules/plantings.js';
import { shipments, bindShipments } from './modules/shipments.js';
import { expenses, bindExpenses } from './modules/expenses.js';
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
    <section class="login login-premium">

      <div class="login-visual">

        <div class="login-brand">
  <h1>
    Sistema de<br>
    <span>Control Agrícola</span>
  </h1>
</div>

      </div>

      <div class="login-access">

        <div
          class="login-leaf"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 260 520"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M38 500C82 399 116 310 148 214C169 151 193 87 238 28"
            />
            <path
              d="M147 217C110 183 85 141 82 88C126 100 156 132 147 217Z"
            />
            <path
              d="M115 310C157 281 198 267 240 273C223 320 181 342 115 310Z"
            />
            <path
              d="M82 399C55 364 42 326 47 284C87 302 103 340 82 399Z"
            />
          </svg>
        </div>

        <div class="login-access-card">

  <div class="login-access-heading">

    <img
      src="/assets/icon-512.png"
      alt="Sistema Agrícola"
      class="login-access-icon"
    >

    <div>
      <div class="login-access-accent"></div>

      <h2>
        Iniciar sesión
      </h2>
    </div>

  </div>

          <p class="login-access-subtitle">
            Selecciona quién está ingresando.
          </p>

          <div class="login-user-list">

            <button
              class="login-user-button"
              data-user="A"
              type="button"
            >
              <span class="login-user-avatar">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="8"
                    r="3.5"
                  />
                  <path
                    d="M5.5 20v-1.5A6.5 6.5 0 0 1 12 12a6.5 6.5 0 0 1 6.5 6.5V20"
                  />
                </svg>
              </span>

              <span class="login-user-name">
                Usuario A
              </span>

              <span
                class="login-user-arrow"
                aria-hidden="true"
              >
                ›
              </span>
            </button>

            <button
              class="login-user-button"
              data-user="R"
              type="button"
            >
              <span class="login-user-avatar">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="8"
                    r="3.5"
                  />
                  <path
                    d="M5.5 20v-1.5A6.5 6.5 0 0 1 12 12a6.5 6.5 0 0 1 6.5 6.5V20"
                  />
                </svg>
              </span>

              <span class="login-user-name">
                Usuario R
              </span>

              <span
                class="login-user-arrow"
                aria-hidden="true"
              >
                ›
              </span>
            </button>

          </div>

          <div class="login-role-note">
            <span class="login-role-line"></span>

            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M12 20V10"
              />
              <path
                d="M12 13C7.5 13 5 10.5 5 6c4.5 0 7 2.5 7 7Z"
              />
              <path
                d="M12 16c4.5 0 7-2.5 7-7-4.5 0-7 2.5-7 7Z"
              />
            </svg>

            <span class="login-role-line"></span>
          </div>

          <p class="login-role-text">
            El rol Administrador u Operador se asignará
            a cada usuario desde Configuración.
          </p>

        </div>

      </div>

    </section>
  `;

  document
    .querySelectorAll(
      '[data-user]'
    )
    .forEach(btn => {
      btn.addEventListener(
        'click',
        () => {
          setUser({
            code: btn.dataset.user,
            display_name: btn.dataset.user,
            role: 'Operador'
          });

          navigate(
            'dashboard'
          );
        }
      );
    });
}
async function navigate(
  route
) {
  state.route = route;

  let content;

  if (route === 'dashboard') {
    content = await dashboard();

  } else if (route === 'catalogs') {
    content = await catalogs();

  } else if (route === 'plantings') {
    content = await plantings();

  } else if (route === 'shipments') {
    content = await shipments();

  } else if (route === 'expenses') {
    content = await expenses();

  } else {
    content = await placeholder(
      route
    );
  }

  app.innerHTML = shell(
    content
  );

    bindLayout(
    navigate
  );

  if (route === 'dashboard') {
    bindDashboard();
  }

  if (route === 'catalogs') {
    bindCatalogs(
      () => navigate(
        'catalogs'
      )
    );
  }

  if (route === 'plantings') {
    bindPlantings(
      () => navigate(
        'plantings'
      )
    );
  }

  if (route === 'shipments') {
    bindShipments();
  }

  if (route === 'expenses') {
    bindExpenses(
      () => navigate(
        'expenses'
      )
    );
  }

  window.scrollTo({
    top: 0,
    behavior: 'instant'
  });
}

