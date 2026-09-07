/* =========================================================
   ALANSA - SISTEMA DE CONTROL AGRÍCOLA
   MÓDULO: CATÁLOGOS

   Archivo:
   js/modules/catalogs.js

   Funciones:
   - Consultar catálogos.
   - Mostrar productos, clientes, proveedores,
     categorías de gasto y formas de pago.
   - Abrir formularios de alta.
   - Guardar nuevos registros.
   - Eliminar registros permitidos.
   ========================================================= */


/* =========================================================
   1. IMPORTACIONES
   ========================================================= */

import { api } from '../core/api.js';
import { escapeHtml } from '../core/format.js';
import {
  moduleHeader,
  empty,
  toast
} from '../components/common.js';


/* =========================================================
   2. ESTADO Y CONFIGURACIÓN
   ========================================================= */

let data = {};

const cfg = {
  products: [
    'Productos',
    [
      'name',
      'short_code'
    ]
  ],

  clients: [
    'Clientes',
    [
      'name',
      'credit_days'
    ]
  ],

  suppliers: [
    'Proveedores',
    [
      'name',
      'contact'
    ]
  ],

  expense_categories: [
    'Categorías de gastos',
    [
      'name',
      'default_amount',
      'default_currency'
    ]
  ],

  payment_methods: [
    'Formas de pago',
    [
      'name'
    ]
  ]
};


/* =========================================================
   3. RENDER PRINCIPAL
   ========================================================= */

export async function catalogs() {
  try {
    data = await api('catalogs');
  } catch {
    data = {};
  }

  const catalogCards = Object
    .entries(cfg)
    .map(([entity, [title, fields]]) => {
      return card(
        entity,
        title,
        fields
      );
    })
    .join('');

  return `
    ${moduleHeader(
      'Catálogos',
      'Listas maestras que alimentan el sistema'
    )}

    <div class="content">
      ${catalogCards}
    </div>

    <div id="catModal"></div>
  `;
}


/* =========================================================
   4. TARJETA DE CATÁLOGO
   ========================================================= */

function card(
  entity,
  title,
  fields
) {
  const rows = data[entity] || [];

  const body = rows.length
    ? rows
        .map(row => {
          const cells = fields
            .map(field => {
              return `
                <td>
                  ${escapeHtml(
                    row[field] ?? '—'
                  )}
                </td>
              `;
            })
            .join('');

          return `
            <tr>
              ${cells}

              <td>
                <button
                  class="btn danger"
                  data-del-cat="${entity}"
                  data-id="${row.id}"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          `;
        })
        .join('')
    : `
        <tr>
          <td colspan="${fields.length + 1}">
            ${empty(
              'No hay registros.'
            )}
          </td>
        </tr>
      `;

  const headers = fields
    .map(field => {
      return `
        <th>
          ${field.replaceAll('_', ' ')}
        </th>
      `;
    })
    .join('');

  return `
    <section class="card table-card">

      <div class="table-toolbar">
        <strong>
          ${title}
        </strong>

        <button
          class="btn primary"
          data-add-cat="${entity}"
        >
          ＋ Agregar
        </button>
      </div>

      <div class="table-scroll">

        <table>

          <thead>
            <tr>
              ${headers}

              <th>
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            ${body}
          </tbody>

        </table>

      </div>

    </section>
  `;
}


/* =========================================================
   5. EVENTOS DEL MÓDULO
   ========================================================= */

export function bindCatalogs(
  rerender
) {
  document
    .querySelectorAll(
      '[data-add-cat]'
    )
    .forEach(button => {
      button.onclick = () => {
        form(
          button.dataset.addCat,
          rerender
        );
      };
    });

  document
    .querySelectorAll(
      '[data-del-cat]'
    )
    .forEach(button => {
      button.onclick = async () => {
        const confirmed = confirm(
          '¿Eliminar este registro?'
        );

        if (!confirmed) {
          return;
        }

        try {
          await api(
            'catalogs',
            {
              method: 'DELETE',
              body: JSON.stringify({
                entity:
                  button.dataset.delCat,

                id:
                  Number(
                    button.dataset.id
                  )
              })
            }
          );

          toast(
            'Registro eliminado.'
          );

          await rerender();
        } catch (error) {
          toast(
            error.message
          );
        }
      };
    });
}


/* =========================================================
   6. FORMULARIO DE ALTA
   ========================================================= */

function form(
  entity,
  rerender
) {
  const root = document.querySelector(
    '#catModal'
  );

  root.innerHTML = `
    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-head">

          <h2>
            Agregar ${cfg[entity][0]}
          </h2>

          <button
            class="btn"
            id="closeCat"
            type="button"
          >
            Cerrar
          </button>

        </div>

        <form
          class="modal-body"
          id="catForm"
        >

          <div class="form-grid">
            ${fields(entity)}
          </div>

          <div class="modal-actions">

            <button
              class="btn primary"
              type="submit"
            >
              Guardar
            </button>

          </div>

        </form>

      </div>

    </div>
  `;

  document
    .querySelector(
      '#closeCat'
    )
    .onclick = () => {
      root.innerHTML = '';
    };

  document
    .querySelector(
      '#catForm'
    )
    .onsubmit = async event => {
      event.preventDefault();

      try {
        const formData = new FormData(
          event.currentTarget
        );

        const payload = {
          entity,
          data: Object.fromEntries(
            formData.entries()
          )
        };

        await api(
          'catalogs',
          {
            method: 'POST',
            body: JSON.stringify(
              payload
            )
          }
        );

        root.innerHTML = '';

        toast(
          'Registro guardado.'
        );

        await rerender();
      } catch (error) {
        toast(
          error.message
        );
      }
    };
}


/* =========================================================
   7. GENERADOR DE CAMPOS
   ========================================================= */

function inputField(
  name,
  label,
  value = '',
  type = 'text',
  extra = ''
) {
  return `
    <div class="field">

      <label>
        ${label}
      </label>

      <input
        class="input"
        name="${name}"
        type="${type}"
        value="${value}"
        ${extra}
      >

    </div>
  `;
}


/* =========================================================
   8. CAMPOS POR TIPO DE CATÁLOGO
   ========================================================= */

function fields(
  entity
) {

  /* ---------------------------------------------------------
     8.1. PRODUCTOS
     --------------------------------------------------------- */

  if (entity === 'products') {
    return `
      ${inputField(
        'name',
        'Producto',
        '',
        'text',
        'required'
      )}

      ${inputField(
        'short_code',
        'Código',
        '',
        'text',
        'required'
      )}

      ${inputField(
        'default_density_per_ha',
        'Semillas por ha',
        100000,
        'number'
      )}

      ${inputField(
        'seed_cost_per_thousand',
        'Costo por millar',
        400,
        'number',
        'step="0.01"'
      )}

      <input
        type="hidden"
        name="seed_currency"
        value="USD"
      >

      ${inputField(
        'standard_box_lbs',
        'Peso caja lb',
        12,
        'number',
        'step="0.01"'
      )}

      ${inputField(
        'default_price_per_box',
        'Precio por caja',
        14,
        'number',
        'step="0.01"'
      )}

      <input
        type="hidden"
        name="price_currency"
        value="USD"
      >

      <div class="field">

        <label>
          Predeterminado
        </label>

        <select
          class="input"
          name="is_default"
        >
          <option value="0">
            No
          </option>

          <option value="1">
            Sí
          </option>
        </select>

      </div>
    `;
  }


  /* ---------------------------------------------------------
     8.2. CLIENTES
     --------------------------------------------------------- */

  if (entity === 'clients') {
    return `
      ${inputField(
        'name',
        'Cliente',
        '',
        'text',
        'required'
      )}

      ${inputField(
        'credit_days',
        'Días de crédito',
        0,
        'number'
      )}

      <div class="field span-2">

        <label>
          Notas
        </label>

        <textarea
          class="input"
          name="notes"
        ></textarea>

      </div>
    `;
  }


  /* ---------------------------------------------------------
     8.3. PROVEEDORES
     --------------------------------------------------------- */

  if (entity === 'suppliers') {
    return `
      ${inputField(
        'name',
        'Proveedor',
        '',
        'text',
        'required'
      )}

      ${inputField(
        'contact',
        'Contacto'
      )}
    `;
  }


  /* ---------------------------------------------------------
     8.4. CATEGORÍAS DE GASTO
     --------------------------------------------------------- */

  if (entity === 'expense_categories') {
    return `
      ${inputField(
        'name',
        'Categoría',
        '',
        'text',
        'required'
      )}

      ${inputField(
        'default_amount',
        'Monto predeterminado',
        '',
        'number',
        'step="0.01"'
      )}

      <div class="field">

        <label>
          Moneda
        </label>

        <select
          class="input"
          name="default_currency"
        >
          <option>
            MXN
          </option>

          <option>
            USD
          </option>
        </select>

      </div>
    `;
  }


  /* ---------------------------------------------------------
     8.5. FORMAS DE PAGO
     --------------------------------------------------------- */

  return inputField(
    'name',
    'Nombre',
    '',
    'text',
    'required'
  );
}
