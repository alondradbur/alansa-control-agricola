/* =========================================================
   ALANSA - SISTEMA DE CONTROL AGRÍCOLA

   MÓDULO:
   SIEMBRAS / CONTRATOS

   Archivo:
   js/modules/plantings.js

   Funciones:
   - Mostrar siembras.
   - Abrir formulario de nueva siembra.
   - Cargar Minibell como producto predeterminado.
   - Registrar contratos.
   - Calcular el costo estimado desde la API.
   ========================================================= */


/* =========================================================
   1. IMPORTACIONES
   ========================================================= */

import {
  api
} from '../core/api.js';

import {
  escapeHtml,
  money,
  number,
  date
} from '../core/format.js';

import {
  moduleHeader,
  empty,
  toast
} from '../components/common.js';


/* =========================================================
   2. ESTADO DEL MÓDULO
   ========================================================= */

let rows = [];

let catalogs = {
  products: [],
  clients: []
};


/* =========================================================
   3. RENDER PRINCIPAL
   ========================================================= */

export async function plantings() {

  /* ---------------------------------------------------------
     3.1. CARGAR DATOS
     --------------------------------------------------------- */

  try {

    const responses =
      await Promise.all([
        api(
          'plantings'
        ),

        api(
          'catalogs'
        )
      ]);


    rows =
      responses[0] || [];


    catalogs =
      responses[1] || {
        products: [],
        clients: []
      };

  } catch {

    rows = [];

    catalogs = {
      products: [],
      clients: []
    };

  }


  /* ---------------------------------------------------------
     3.2. CONSTRUIR FILAS DE LA TABLA
     --------------------------------------------------------- */

  const tableBody =
    rows.length > 0

      ? rows
          .map(
            row =>
              createRow(
                row
              )
          )
          .join('')

      : `
          <tr>

            <td colspan="8">

              ${empty(
                'Todavía no hay siembras registradas.'
              )}

            </td>

          </tr>
        `;


  /* ---------------------------------------------------------
     3.3. INTERFAZ
     --------------------------------------------------------- */

  return `

    ${moduleHeader(

      'Siembras',

      'Contratos, hectáreas y periodos de cosecha',

      `
        <button
          class="btn primary"
          id="newPlantingBtn"
        >
          ＋ Nueva siembra
        </button>
      `

    )}


    <div class="content">


      <section
        class="card table-card"
      >


        <div
          class="table-toolbar"
        >

          <strong>
            Siembras / contratos
          </strong>

        </div>


        <div
          class="table-scroll"
        >


          <table>


            <thead>

              <tr>

                <th>
                  Contrato
                </th>

                <th>
                  Cliente
                </th>

                <th>
                  Producto
                </th>

                <th>
                  Hectáreas
                </th>

                <th>
                  Periodo de cosecha
                </th>

                <th>
                  Semilla estimada
                </th>

                <th>
                  Precio / caja
                </th>

                <th>
                  Estado
                </th>

              </tr>

            </thead>


            <tbody>

              ${tableBody}

            </tbody>


          </table>


        </div>


      </section>


    </div>


    <div
      id="plantingModalRoot"
    ></div>

  `;

}


/* =========================================================
   4. CREAR FILA DE SIEMBRA
   ========================================================= */

function createRow(
  row
) {

  return `

    <tr>


      <td>

        <strong>

          ${escapeHtml(
            row.contract_number
          )}

        </strong>

      </td>


      <td>

        ${escapeHtml(
          row.client_name
        )}

      </td>


      <td>

        ${escapeHtml(
          row.product_name
        )}

      </td>


      <td>

        ${number(
          row.hectares,
          2
        )}

      </td>


      <td>

        ${date(
          row.harvest_start
        )}

        –

        ${date(
          row.harvest_end
        )}

      </td>


      <td>

        ${money(
          row.estimated_seed_cost,
          row.seed_currency
        )}

      </td>


      <td>

        ${money(
          row.price_per_box,
          row.price_currency
        )}

      </td>


      <td>

        <span
          class="
            status
            ${escapeHtml(
              row.status
            )}
          "
        >

          ${escapeHtml(
            row.status
          )}

        </span>

      </td>


    </tr>

  `;

}


/* =========================================================
   5. EVENTOS DEL MÓDULO
   ========================================================= */

export function bindPlantings(
  rerender
) {

  const newButton =
    document.querySelector(
      '#newPlantingBtn'
    );


  newButton
    ?.addEventListener(
      'click',
      () => {

        openPlantingForm(
          rerender
        );

      }
    );

}


/* =========================================================
   6. ABRIR FORMULARIO DE NUEVA SIEMBRA
   ========================================================= */

function openPlantingForm(
  rerender
) {

  /* ---------------------------------------------------------
     6.1. BUSCAR PRODUCTO PREDETERMINADO
     --------------------------------------------------------- */

  const defaultProduct =
    catalogs.products
      ?.find(
        product =>
          Number(
            product.is_default
          ) === 1
      )

    ||

    catalogs.products?.[0]

    ||

    {};


  /* ---------------------------------------------------------
     6.2. CONTENEDOR DEL MODAL
     --------------------------------------------------------- */

  const modalRoot =
    document.querySelector(
      '#plantingModalRoot'
    );


  if (
    !modalRoot
  ) {

    return;

  }


  /* ---------------------------------------------------------
     6.3. FORMULARIO
     --------------------------------------------------------- */

  modalRoot.innerHTML = `

    <div
      class="modal-backdrop"
    >


      <div
        class="modal"
      >


        <div
          class="modal-head"
        >

          <h2>
            Nueva siembra
          </h2>


          <button
            class="btn"
            id="closePlantingModal"
            type="button"
          >
            Cerrar
          </button>

        </div>


        <form
          class="modal-body"
          id="plantingForm"
        >


          <div
            class="form-grid"
          >


            ${inputField(

              'contract_number',

              'Contrato / folio',

              '',

              'text',

              'required'

            )}


            <div
              class="field"
            >

              <label>
                Cliente
              </label>


              <select
                class="input"
                name="client_id"
                required
              >

                <option value="">
                  Seleccionar cliente
                </option>


                ${clientOptions()}


              </select>

            </div>


            <div
              class="field"
            >

              <label>
                Producto
              </label>


              <select
                class="input"
                name="product_id"
                required
              >

                ${productOptions(
                  defaultProduct.id
                )}

              </select>

            </div>


            ${inputField(

              'hectares',

              'Hectáreas',

              '',

              'number',

              `
                required
                min="0.01"
                step="0.01"
              `

            )}


            ${inputField(

              'density_per_ha',

              'Semillas por hectárea',

              defaultProduct.default_density_per_ha
                || 100000,

              'number',

              `
                required
                min="1"
                step="1"
              `

            )}


            ${inputField(

              'seed_cost_per_thousand',

              'Costo de semilla por millar',

              defaultProduct.seed_cost_per_thousand
                || 400,

              'number',

              `
                min="0"
                step="0.01"
              `

            )}


            ${inputField(

              'actual_seed_cost',

              'Costo real de semilla',

              '',

              'number',

              `
                min="0"
                step="0.01"
              `

            )}


            ${inputField(

              'harvest_start',

              'Inicio de cosecha',

              '',

              'date',

              'required'

            )}


            ${inputField(

              'harvest_end',

              'Fin de cosecha',

              '',

              'date',

              'required'

            )}


            ${inputField(

              'price_per_box',

              'Precio por caja',

              defaultProduct.default_price_per_box
                || 14,

              'number',

              `
                min="0"
                step="0.01"
              `

            )}


            ${inputField(

              'standard_box_lbs',

              'Peso estándar por caja (lb)',

              defaultProduct.standard_box_lbs
                || 12,

              'number',

              `
                min="0"
                step="0.01"
              `

            )}


            ${inputField(

              'trailers_per_week',

              'Meta de tráileres por semana',

              1,

              'number',

              `
                min="0"
                step="0.01"
              `

            )}


            <input
              type="hidden"
              name="seed_currency"
              value="${
                escapeHtml(
                  defaultProduct.seed_currency
                    || 'USD'
                )
              }"
            >


            <input
              type="hidden"
              name="price_currency"
              value="${
                escapeHtml(
                  defaultProduct.price_currency
                    || 'USD'
                )
              }"
            >


            <input
              type="hidden"
              name="status"
              value="Activa"
            >


          </div>


          <div
            class="modal-actions"
          >

            <button
              class="btn primary"
              type="submit"
            >
              Guardar siembra
            </button>

          </div>


        </form>


      </div>


    </div>

  `;


  /* ---------------------------------------------------------
     6.4. CERRAR MODAL
     --------------------------------------------------------- */

  const closeButton =
    document.querySelector(
      '#closePlantingModal'
    );


  closeButton
    ?.addEventListener(
      'click',
      () => {

        modalRoot.innerHTML =
          '';

      }
    );


  /* ---------------------------------------------------------
     6.5. GUARDAR FORMULARIO
     --------------------------------------------------------- */

  const form =
    document.querySelector(
      '#plantingForm'
    );


  form
    ?.addEventListener(
      'submit',
      async event => {

        event.preventDefault();


        if (
          catalogs.clients.length === 0
        ) {

          toast(
            'Primero agrega un cliente en Catálogos.'
          );

          return;

        }


        const formData =
          new FormData(
            event.currentTarget
          );


        const payload =
          Object.fromEntries(
            formData.entries()
          );


        try {

          await api(
            'plantings',
            {
              method:
                'POST',

              body:
                JSON.stringify(
                  payload
                )
            }
          );


          modalRoot.innerHTML =
            '';


          toast(
            'Siembra guardada correctamente.'
          );


          await rerender();

        } catch (
          exception
        ) {

          toast(
            exception.message
          );

        }

      }
    );

}


/* =========================================================
   7. OPCIONES DE CLIENTES
   ========================================================= */

function clientOptions() {

  return catalogs.clients
    .map(
      client => `

        <option
          value="${client.id}"
        >

          ${escapeHtml(
            client.name
          )}

        </option>

      `
    )
    .join('');

}


/* =========================================================
   8. OPCIONES DE PRODUCTOS
   ========================================================= */

function productOptions(
  selectedId
) {

  return catalogs.products
    .map(
      product => `

        <option

          value="${product.id}"

          ${
            Number(
              product.id
            ) ===
            Number(
              selectedId
            )

              ? 'selected'

              : ''
          }

        >

          ${escapeHtml(
            product.name
          )}

        </option>

      `
    )
    .join('');

}


/* =========================================================
   9. GENERADOR DE CAMPOS
   ========================================================= */

function inputField(

  name,

  label,

  value = '',

  type = 'text',

  extra = ''

) {

  return `

    <div
      class="field"
    >

      <label>
        ${label}
      </label>


      <input

        class="input"

        name="${name}"

        type="${type}"

        value="${
          escapeHtml(
            value ?? ''
          )
        }"

        ${extra}

      >

    </div>

  `;

}
