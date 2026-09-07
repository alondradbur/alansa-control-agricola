/* =========================================================
   SISTEMA DE CONTROL AGRÍCOLA
   MÓDULO: GASTOS

   Funciones:
   - Consultar gastos.
   - Registrar gastos.
   - Editar gastos.
   - Eliminar gastos.
   - Manejar MXN y USD.
   - Calcular equivalente en MXN cuando corresponde.
   ========================================================= */


/* =========================================================
   1. IMPORTACIONES
   ========================================================= */

import { api } from '../core/api.js';

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
  plantings: [],
  expense_categories: [],
  suppliers: [],
  payment_methods: []
};


/* =========================================================
   3. RENDER PRINCIPAL
   ========================================================= */

export async function expenses() {
  try {
    const responses = await Promise.all([
      api('expenses'),
      api('catalogs'),
      api('plantings')
    ]);

    rows = responses[0] || [];

    const catalogData = responses[1] || {};
    const plantingData = responses[2] || [];

    catalogs = {
      plantings: plantingData,
      expense_categories:
        catalogData.expense_categories || [],
      suppliers:
        catalogData.suppliers || [],
      payment_methods:
        catalogData.payment_methods || []
    };
  } catch {
    rows = [];

    catalogs = {
      plantings: [],
      expense_categories: [],
      suppliers: [],
      payment_methods: []
    };
  }

  return `
    ${moduleHeader(
      'Gastos',
      'Costos por siembra y categoría',
      `
        <button
          class="btn primary"
          id="newExpenseBtn"
          type="button"
        >
          ＋ Nuevo gasto
        </button>
      `
    )}

    <div class="content">

      ${summaryCards()}

      <section class="card table-card">

        <div class="table-toolbar">
          <strong>
            Gastos registrados
          </strong>
        </div>

        ${desktopTable()}

        ${mobileList()}

      </section>

    </div>

    <div id="expenseModalRoot"></div>
  `;
}


/* =========================================================
   4. RESUMEN
   ========================================================= */

function summaryCards() {
  const totals = rows.reduce(
    (accumulator, row) => {
      const amount = numeric(
        row.amount
      );

      const mxnEquivalent = numeric(
        row.mxn_equivalent
      );

      if (row.currency === 'USD') {
        accumulator.usd += amount;
      } else {
        accumulator.mxn += amount;
      }

      accumulator.mxnEquivalent +=
        mxnEquivalent;

      return accumulator;
    },
    {
      usd: 0,
      mxn: 0,
      mxnEquivalent: 0
    }
  );

  return `
    <section class="dashboard-kpis">

      <article class="card dashboard-kpi dashboard-kpi-neutral">
        <div class="dashboard-kpi-label">
          Gastos MXN
        </div>

        <div class="dashboard-kpi-value">
          ${money(
            totals.mxn,
            'MXN'
          )}
        </div>

        <div class="dashboard-kpi-meta">
          Importe registrado en pesos
        </div>
      </article>

      <article class="card dashboard-kpi dashboard-kpi-neutral">
        <div class="dashboard-kpi-label">
          Gastos USD
        </div>

        <div class="dashboard-kpi-value">
          ${money(
            totals.usd,
            'USD'
          )}
        </div>

        <div class="dashboard-kpi-meta">
          Importe registrado en dólares
        </div>
      </article>

      <article class="card dashboard-kpi dashboard-kpi-primary">
        <div class="dashboard-kpi-label">
          Equivalente MXN
        </div>

        <div class="dashboard-kpi-value">
          ${money(
            totals.mxnEquivalent,
            'MXN'
          )}
        </div>

        <div class="dashboard-kpi-meta">
          Según tipo de cambio capturado
        </div>
      </article>

    </section>
  `;
}


/* =========================================================
   5. TABLA DE ESCRITORIO
   ========================================================= */

function desktopTable() {
  const body = rows.length
    ? rows
        .map(row => desktopRow(row))
        .join('')
    : `
        <tr>
          <td colspan="10">
            ${empty(
              'Todavía no hay gastos registrados.'
            )}
          </td>
        </tr>
      `;

  return `
    <div class="table-scroll desktop-table">

      <table>

        <thead>
          <tr>
            <th>Fecha</th>
            <th>Siembra</th>
            <th>Categoría</th>
            <th>Proveedor</th>
            <th>Concepto</th>
            <th>Importe</th>
            <th>Tipo de cambio</th>
            <th>Equivalente MXN</th>
            <th>Método de pago</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          ${body}
        </tbody>

      </table>

    </div>
  `;
}


function desktopRow(
  row
) {
  return `
    <tr>

      <td>
        ${date(
          row.expense_date
        )}
      </td>

      <td>
        ${escapeHtml(
          row.contract_number || '—'
        )}
      </td>

      <td>
        ${escapeHtml(
          row.category_name || '—'
        )}
      </td>

      <td>
        ${escapeHtml(
          row.supplier_name || '—'
        )}
      </td>

      <td>
        ${escapeHtml(
          row.concept
        )}
      </td>

      <td>
        <strong>
          ${money(
            row.amount,
            row.currency
          )}
        </strong>
      </td>

      <td>
        ${row.exchange_rate
          ? number(
              row.exchange_rate,
              4
            )
          : '—'
        }
      </td>

      <td>
        ${row.mxn_equivalent !== null &&
        row.mxn_equivalent !== undefined
          ? money(
              row.mxn_equivalent,
              'MXN'
            )
          : '—'
        }
      </td>

      <td>
        ${escapeHtml(
          row.payment_method_name || '—'
        )}
      </td>

      <td>
        ${actionButtons(
          row.id
        )}
      </td>

    </tr>
  `;
}


/* =========================================================
   6. LISTA MÓVIL
   ========================================================= */

function mobileList() {
  if (!rows.length) {
    return `
      <div class="mobile-records">
        ${empty(
          'Todavía no hay gastos registrados.'
        )}
      </div>
    `;
  }

  return `
    <div class="mobile-records">

      ${rows
        .map(row => {
          return `
            <article class="mobile-record">

              <div class="mobile-record-top">

                <div>
                  <div class="mobile-record-title">
                    ${escapeHtml(
                      row.concept
                    )}
                  </div>

                  <div class="muted">
                    ${date(
                      row.expense_date
                    )}
                    ·
                    ${escapeHtml(
                      row.category_name || 'Sin categoría'
                    )}
                  </div>
                </div>

                <div class="mobile-record-amount">
                  ${money(
                    row.amount,
                    row.currency
                  )}
                </div>

              </div>

              <div class="mobile-record-meta">

                <div class="mobile-record-data">
                  <span>
                    Siembra
                  </span>

                  <strong>
                    ${escapeHtml(
                      row.contract_number || '—'
                    )}
                  </strong>
                </div>

                <div class="mobile-record-data">
                  <span>
                    Proveedor
                  </span>

                  <strong>
                    ${escapeHtml(
                      row.supplier_name || '—'
                    )}
                  </strong>
                </div>

                <div class="mobile-record-data">
                  <span>
                    Equivalente MXN
                  </span>

                  <strong>
                    ${
                      row.mxn_equivalent !== null &&
                      row.mxn_equivalent !== undefined
                        ? money(
                            row.mxn_equivalent,
                            'MXN'
                          )
                        : '—'
                    }
                  </strong>
                </div>

                <div class="mobile-record-data">
                  <span>
                    Método
                  </span>

                  <strong>
                    ${escapeHtml(
                      row.payment_method_name || '—'
                    )}
                  </strong>
                </div>

              </div>

              <div class="expense-mobile-actions">
                ${actionButtons(
                  row.id
                )}
              </div>

            </article>
          `;
        })
        .join('')}

    </div>
  `;
}


/* =========================================================
   7. BOTONES DE ACCIÓN
   ========================================================= */

function actionButtons(
  id
) {
  return `
    <div class="row-actions">

      <button
        class="btn soft edit-expense"
        type="button"
        data-id="${id}"
      >
        Editar
      </button>

      <button
        class="btn danger delete-expense"
        type="button"
        data-id="${id}"
      >
        Eliminar
      </button>

    </div>
  `;
}


/* =========================================================
   8. EVENTOS DEL MÓDULO
   ========================================================= */

export function bindExpenses(
  rerender
) {
  document
    .querySelector(
      '#newExpenseBtn'
    )
    ?.addEventListener(
      'click',
      () => {
        openExpenseForm(
          rerender
        );
      }
    );

  document
    .querySelectorAll(
      '.edit-expense'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          const id = Number(
            button.dataset.id
          );

          const row = rows.find(
            item => {
              return Number(item.id) === id;
            }
          );

          if (row) {
            openExpenseForm(
              rerender,
              row
            );
          }
        }
      );
    });

  document
    .querySelectorAll(
      '.delete-expense'
    )
    .forEach(button => {
      button.addEventListener(
        'click',
        async () => {
          await removeExpense(
            Number(
              button.dataset.id
            ),
            rerender
          );
        }
      );
    });
}


/* =========================================================
   9. FORMULARIO NUEVO / EDITAR
   ========================================================= */

function openExpenseForm(
  rerender,
  row = null
) {
  const editing = Boolean(
    row?.id
  );

  const modalRoot = document.querySelector(
    '#expenseModalRoot'
  );

  if (!modalRoot) {
    return;
  }

  const currency =
    row?.currency || 'MXN';

  modalRoot.innerHTML = `
    <div class="modal-backdrop">

      <div class="modal">

        <div class="modal-head">

          <div>
            <h2>
              ${
                editing
                  ? 'Editar gasto'
                  : 'Nuevo gasto'
              }
            </h2>

            <p class="muted">
              ${
                editing
                  ? 'Modifica los datos y guarda los cambios.'
                  : 'Registra un gasto asociado a una siembra.'
              }
            </p>
          </div>

          <button
            class="btn"
            id="closeExpenseModal"
            type="button"
          >
            Cerrar
          </button>

        </div>

        <form
          class="modal-body"
          id="expenseForm"
        >

          <input
            type="hidden"
            name="id"
            value="${row?.id || ''}"
          >

          <div class="form-grid">

            ${inputField(
              'expense_date',
              'Fecha',
              row?.expense_date || today(),
              'date',
              'required'
            )}

            ${selectField(
              'planting_id',
              'Siembra / contrato',
              plantingOptions(
                row?.planting_id
              ),
              true
            )}

            ${selectField(
              'category_id',
              'Categoría',
              categoryOptions(
                row?.category_id
              ),
              true
            )}

            ${selectField(
              'supplier_id',
              'Proveedor',
              supplierOptions(
                row?.supplier_id
              ),
              false
            )}

            ${inputField(
              'concept',
              'Concepto',
              row?.concept || '',
              'text',
              'required'
            )}

            ${moneyField(
              'amount',
              'Monto',
              row?.amount !== undefined
                ? formatMoneyText(
                    row.amount
                  )
                : ''
            )}

            ${currencyField(
              'currency',
              'Moneda',
              currency
            )}

            ${inputField(
              'exchange_rate',
              'Tipo de cambio a MXN',
              row?.exchange_rate || '',
              'number',
              'min="0" step="0.0001"'
            )}

            ${selectField(
              'payment_method_id',
              'Método de pago',
              paymentMethodOptions(
                row?.payment_method_id
              ),
              false
            )}

            ${inputField(
              'invoice_number',
              'Factura / comprobante',
              row?.invoice_number || '',
              'text'
            )}

            <div class="field form-grid-full">

              <label>
                Notas
              </label>

              <textarea
                class="input"
                name="notes"
                rows="3"
              >${escapeHtml(
                row?.notes || ''
              )}</textarea>

            </div>

          </div>

          <div class="expense-calculation">

            <span>
              Equivalente estimado en MXN
            </span>

            <strong id="expenseMxnPreview">
              ${previewMxn(
                row?.amount,
                currency,
                row?.exchange_rate
              )}
            </strong>

          </div>

          <div class="modal-actions">

            <button
              class="btn primary"
              type="submit"
            >
              ${
                editing
                  ? 'Guardar cambios'
                  : 'Guardar gasto'
              }
            </button>

          </div>

        </form>

      </div>

    </div>
  `;

  bindMoneyInputs(
    modalRoot
  );

  bindMxnPreview(
    modalRoot
  );

  modalRoot
    .querySelector(
      '#closeExpenseModal'
    )
    ?.addEventListener(
      'click',
      () => {
        modalRoot.innerHTML = '';
      }
    );

  modalRoot
    .querySelector(
      '#expenseForm'
    )
    ?.addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        const formData =
          new FormData(
            event.currentTarget
          );

        const payload =
          Object.fromEntries(
            formData.entries()
          );

        payload.supplier_id =
          payload.supplier_id || null;

        payload.payment_method_id =
          payload.payment_method_id || null;

        payload.exchange_rate =
          payload.exchange_rate || null;

        try {
          await api(
            'expenses',
            {
              method:
                editing
                  ? 'PUT'
                  : 'POST',

              body:
                JSON.stringify(
                  payload
                )
            }
          );

          modalRoot.innerHTML = '';

          toast(
            editing
              ? 'Gasto actualizado correctamente.'
              : 'Gasto guardado correctamente.'
          );

          await rerender();

        } catch (exception) {
          toast(
            exception.message
          );
        }
      }
    );
}


/* =========================================================
   10. ELIMINAR GASTO
   ========================================================= */

async function removeExpense(
  id,
  rerender
) {
  const row = rows.find(
    item => {
      return Number(item.id) ===
        Number(id);
    }
  );

  const description =
    row?.concept || 'este gasto';

  const confirmed = window.confirm(
    `¿Eliminar "${description}"? Esta acción no se puede deshacer.`
  );

  if (!confirmed) {
    return;
  }

  try {
    await api(
      'expenses',
      {
        method: 'DELETE',
        body: JSON.stringify({
          id
        })
      }
    );

    toast(
      'Gasto eliminado correctamente.'
    );

    await rerender();

  } catch (exception) {
    toast(
      exception.message
    );
  }
}


/* =========================================================
   11. OPCIONES DE CATÁLOGOS
   ========================================================= */

function plantingOptions(
  selectedId
) {
  return `
    <option value="">
      Seleccionar siembra
    </option>

    ${catalogs.plantings
      .map(item => {
        return option(
          item.id,
          item.contract_number,
          selectedId
        );
      })
      .join('')}
  `;
}


function categoryOptions(
  selectedId
) {
  return `
    <option value="">
      Seleccionar categoría
    </option>

    ${catalogs.expense_categories
      .map(item => {
        return option(
          item.id,
          item.name,
          selectedId
        );
      })
      .join('')}
  `;
}


function supplierOptions(
  selectedId
) {
  return `
    <option value="">
      Sin proveedor
    </option>

    ${catalogs.suppliers
      .map(item => {
        return option(
          item.id,
          item.name,
          selectedId
        );
      })
      .join('')}
  `;
}


function paymentMethodOptions(
  selectedId
) {
  return `
    <option value="">
      Sin especificar
    </option>

    ${catalogs.payment_methods
      .map(item => {
        return option(
          item.id,
          item.name,
          selectedId
        );
      })
      .join('')}
  `;
}


function option(
  value,
  label,
  selectedId
) {
  const selected =
    Number(value) ===
    Number(selectedId);

  return `
    <option
      value="${value}"
      ${selected ? 'selected' : ''}
    >
      ${escapeHtml(
        label
      )}
    </option>
  `;
}


/* =========================================================
   12. GENERADORES DE CAMPOS
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
        value="${escapeHtml(
          value ?? ''
        )}"
        ${extra}
      >

    </div>
  `;
}


function moneyField(
  name,
  label,
  value = ''
) {
  return `
    <div class="field">

      <label>
        ${label}
      </label>

      <input
        class="input money-input"
        name="${name}"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        value="${escapeHtml(
          value
        )}"
        placeholder="0.00"
        required
      >

    </div>
  `;
}


function currencyField(
  name,
  label,
  selected = 'MXN'
) {
  return `
    <div class="field">

      <label>
        ${label}
      </label>

      <select
        class="input"
        name="${name}"
        id="expenseCurrency"
        required
      >

        <option
          value="MXN"
          ${selected === 'MXN' ? 'selected' : ''}
        >
          MXN
        </option>

        <option
          value="USD"
          ${selected === 'USD' ? 'selected' : ''}
        >
          USD
        </option>

      </select>

    </div>
  `;
}


function selectField(
  name,
  label,
  options,
  required = false
) {
  return `
    <div class="field">

      <label>
        ${label}
      </label>

      <select
        class="input"
        name="${name}"
        ${required ? 'required' : ''}
      >
        ${options}
      </select>

    </div>
  `;
}


/* =========================================================
   13. VISTA PREVIA MXN
   ========================================================= */

function bindMxnPreview(
  root
) {
  const amount =
    root.querySelector(
      '[name="amount"]'
    );

  const currency =
    root.querySelector(
      '[name="currency"]'
    );

  const exchangeRate =
    root.querySelector(
      '[name="exchange_rate"]'
    );

  const preview =
    root.querySelector(
      '#expenseMxnPreview'
    );

  const update = () => {
    if (!preview) {
      return;
    }

    preview.textContent =
      previewMxn(
        amount?.value,
        currency?.value,
        exchangeRate?.value
      );
  };

  amount?.addEventListener(
    'input',
    update
  );

  currency?.addEventListener(
    'change',
    update
  );

  exchangeRate?.addEventListener(
    'input',
    update
  );
}


function previewMxn(
  amount,
  currency,
  exchangeRate
) {
  const cleanAmount =
    numericMoney(
      amount
    );

  if (currency === 'MXN') {
    return money(
      cleanAmount,
      'MXN'
    );
  }

  const rate = numeric(
    exchangeRate
  );

  if (rate <= 0) {
    return 'Captura tipo de cambio';
  }

  return money(
    cleanAmount * rate,
    'MXN'
  );
}


/* =========================================================
   14. FORMATO MONETARIO
   ========================================================= */

function bindMoneyInputs(
  root
) {
  root
    .querySelectorAll(
      '.money-input'
    )
    .forEach(input => {
      input.addEventListener(
        'focus',
        () => {
          input.value =
            normalizeMoneyText(
              input.value
            );
        }
      );

      input.addEventListener(
        'blur',
        () => {
          input.value =
            formatMoneyText(
              input.value
            );

          root
            .querySelector(
              '[name="exchange_rate"]'
            )
            ?.dispatchEvent(
              new Event('input')
            );
        }
      );
    });
}


function normalizeMoneyText(
  value
) {
  return String(
    value || ''
  )
    .replaceAll(',', '')
    .replace(/[^\d.-]/g, '');
}


function formatMoneyText(
  value
) {
  const normalized =
    normalizeMoneyText(
      value
    );

  if (!normalized) {
    return '';
  }

  const amount = Number(
    normalized
  );

  if (!Number.isFinite(amount)) {
    return '';
  }

  return new Intl.NumberFormat(
    'en-US',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ).format(amount);
}


/* =========================================================
   15. UTILIDADES
   ========================================================= */

function numericMoney(
  value
) {
  return numeric(
    normalizeMoneyText(
      value
    )
  );
}


function numeric(
  value
) {
  const result = Number(
    value || 0
  );

  return Number.isFinite(result)
    ? result
    : 0;
}


function today() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}
