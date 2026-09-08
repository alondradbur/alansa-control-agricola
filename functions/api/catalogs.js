/* =========================================================
   SISTEMA DE CONTROL AGRÍCOLA
   MÓDULO: GASTOS

   Cálculo:
   Monto unitario × cantidad = gasto total

   La cantidad puede ser:
   - 1 por registro.
   - Hectáreas de la siembra.
   - Captura manual.
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
  expense_units: [],
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

    const catalogData =
      responses[1] || {};

    catalogs = {
      plantings:
        responses[2] || [],

      expense_categories:
        catalogData.expense_categories || [],

      expense_units:
        catalogData.expense_units || [],

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
      expense_units: [],
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
      const amount =
        numeric(
          row.amount
        );

      const mxnEquivalent =
        numeric(
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
          <td colspan="12">
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
            <th>Aplicación</th>
            <th>Monto unitario</th>
            <th>Cantidad</th>
            <th>Total</th>
            <th>Proveedor</th>
            <th>Concepto</th>
            <th>Equivalente MXN</th>
            <th>Método</th>
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
  const unitAmount =
    row.unit_amount ??
    row.amount ??
    0;

  const quantity =
    row.quantity ??
    1;

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
          row.expense_unit_name ||
          'Registro anterior'
        )}
      </td>

      <td>
        ${money(
          unitAmount,
          row.currency
        )}
      </td>

      <td>
        ${number(
          quantity,
          2
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
        ${escapeHtml(
          row.supplier_name || '—'
        )}
      </td>

      <td>
        ${escapeHtml(
          row.concept || '—'
        )}
      </td>

      <td>
        ${
          row.mxn_equivalent !== null &&
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
          const unitAmount =
            row.unit_amount ??
            row.amount ??
            0;

          const quantity =
            row.quantity ??
            1;

          return `
            <article class="mobile-record">

              <div class="mobile-record-top">

                <div>
                  <div class="mobile-record-title">
                    ${escapeHtml(
                      row.concept || 'Gasto'
                    )}
                  </div>

                  <div class="muted">
                    ${date(
                      row.expense_date
                    )}
                    ·
                    ${escapeHtml(
                      row.category_name ||
                      'Sin categoría'
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
                  <span>Siembra</span>

                  <strong>
                    ${escapeHtml(
                      row.contract_number || '—'
                    )}
                  </strong>
                </div>

                <div class="mobile-record-data">
                  <span>Aplicación</span>

                  <strong>
                    ${escapeHtml(
                      row.expense_unit_name ||
                      'Registro anterior'
                    )}
                  </strong>
                </div>

                <div class="mobile-record-data">
                  <span>Monto unitario</span>

                  <strong>
                    ${money(
                      unitAmount,
                      row.currency
                    )}
                  </strong>
                </div>

                <div class="mobile-record-data">
                  <span>Cantidad</span>

                  <strong>
                    ${number(
                      quantity,
                      2
                    )}
                  </strong>
                </div>

                <div class="mobile-record-data">
                  <span>Proveedor</span>

                  <strong>
                    ${escapeHtml(
                      row.supplier_name || '—'
                    )}
                  </strong>
                </div>

                <div class="mobile-record-data">
                  <span>Equivalente MXN</span>

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

  const modalRoot =
    document.querySelector(
      '#expenseModalRoot'
    );

  if (!modalRoot) {
    return;
  }

  const fallbackUnit =
    catalogs.expense_units[0] || {};

  const selectedUnitId =
    row?.expense_unit_id ||
    fallbackUnit.id ||
    '';

  const selectedCategory =
    catalogs.expense_categories
      .find(item => {
        return Number(item.id) ===
          Number(row?.category_id);
      });

  const unitAmount =
    row?.unit_amount ??
    row?.amount ??
    selectedCategory?.default_amount ??
    '';

  const currency =
    row?.currency ||
    selectedCategory?.default_currency ||
    'MXN';

  const quantity =
    row?.quantity ??
    initialQuantity(
      selectedUnitId,
      row?.planting_id
    );

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
              Monto unitario × cantidad = gasto total
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
              true,
              'expensePlanting'
            )}

            ${selectField(
              'category_id',
              'Categoría',
              categoryOptions(
                row?.category_id
              ),
              true,
              'expenseCategory'
            )}

            ${selectField(
              'expense_unit_id',
              '¿Cómo se aplica el monto?',
              expenseUnitOptions(
                selectedUnitId
              ),
              true,
              'expenseUnit'
            )}

            ${moneyField(
              'unit_amount',
              'Monto unitario',
              formatMoneyText(
                unitAmount
              )
            )}

            ${currencyField(
              'currency',
              'Moneda',
              currency
            )}

            ${inputField(
              'quantity',
              'Cantidad',
              quantity,
              'number',
              'required min="0.0001" step="0.0001"'
            )}

            <div class="field">
              <label>
                Gasto total
              </label>

              <input
                class="input"
                id="expenseTotalDisplay"
                type="text"
                value=""
                readonly
              >
            </div>

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
              —
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

  bindExpenseCalculation(
    modalRoot,
    editing
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

        if (editing) {
          payload.id =
            Number(row.id);
        } else {
          delete payload.id;
        }

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
   10. CÁLCULO AUTOMÁTICO
   ========================================================= */

function bindExpenseCalculation(
  root,
  editing
) {
  const planting =
    root.querySelector(
      '#expensePlanting'
    );

  const category =
    root.querySelector(
      '#expenseCategory'
    );

  const unit =
    root.querySelector(
      '#expenseUnit'
    );

  const unitAmount =
    root.querySelector(
      '[name="unit_amount"]'
    );

  const quantity =
    root.querySelector(
      '[name="quantity"]'
    );

  const currency =
    root.querySelector(
      '[name="currency"]'
    );

  const exchangeRate =
    root.querySelector(
      '[name="exchange_rate"]'
    );

  const totalDisplay =
    root.querySelector(
      '#expenseTotalDisplay'
    );

  const mxnPreview =
    root.querySelector(
      '#expenseMxnPreview'
    );

  const applyUnitQuantity = () => {
    const unitRow =
      selectedExpenseUnit(
        unit?.value
      );

    if (!quantity || !unitRow) {
      return;
    }

    if (
      unitRow.quantity_source === 'ONE'
    ) {
      quantity.value = '1';
      quantity.readOnly = true;
    } else if (
      unitRow.quantity_source === 'HECTARES'
    ) {
      const plantingRow =
        selectedPlanting(
          planting?.value
        );

      quantity.value =
        plantingRow?.hectares ?? '';

      quantity.readOnly = true;
    } else {
      quantity.readOnly = false;

      if (
        !editing &&
        Number(quantity.value) <= 0
      ) {
        quantity.value = '1';
      }
    }
  };

  const updateTotals = () => {
    const unitValue =
      numericMoney(
        unitAmount?.value
      );

    const quantityValue =
      numeric(
        quantity?.value
      );

    const total =
      unitValue * quantityValue;

    if (totalDisplay) {
      totalDisplay.value =
        money(
          total,
          currency?.value || 'MXN'
        );
    }

    if (!mxnPreview) {
      return;
    }

    if (
      currency?.value === 'MXN'
    ) {
      mxnPreview.textContent =
        money(
          total,
          'MXN'
        );

      return;
    }

    const rate =
      numeric(
        exchangeRate?.value
      );

    mxnPreview.textContent =
      rate > 0
        ? money(
            total * rate,
            'MXN'
          )
        : 'Captura tipo de cambio';
  };

  const refresh = () => {
    applyUnitQuantity();
    updateTotals();
  };

  unit?.addEventListener(
    'change',
    refresh
  );

  planting?.addEventListener(
    'change',
    refresh
  );

  unitAmount?.addEventListener(
    'input',
    updateTotals
  );

  quantity?.addEventListener(
    'input',
    updateTotals
  );

  currency?.addEventListener(
    'change',
    updateTotals
  );

  exchangeRate?.addEventListener(
    'input',
    updateTotals
  );

  category?.addEventListener(
    'change',
    () => {
      const categoryRow =
        catalogs.expense_categories
          .find(item => {
            return Number(item.id) ===
              Number(category.value);
          });

      if (!categoryRow) {
        return;
      }

      if (
        categoryRow.default_amount !== null &&
        categoryRow.default_amount !== undefined &&
        categoryRow.default_amount !== ''
      ) {
        unitAmount.value =
          formatMoneyText(
            categoryRow.default_amount
          );
      }

      if (
        categoryRow.default_currency
      ) {
        currency.value =
          categoryRow.default_currency;
      }

      updateTotals();
    }
  );

  refresh();
}


/* =========================================================
   11. ELIMINAR GASTO
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

  if (
    !window.confirm(
      `¿Eliminar "${description}"? Esta acción no se puede deshacer.`
    )
  ) {
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
   12. OPCIONES DE CATÁLOGOS
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
          `${item.contract_number} · ${number(
            item.hectares,
            2
          )} ha`,
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


function expenseUnitOptions(
  selectedId
) {
  return `
    <option value="">
      Seleccionar aplicación
    </option>

    ${catalogs.expense_units
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
   13. GENERADORES DE CAMPOS
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
  required = false,
  id = ''
) {
  return `
    <div class="field">

      <label>
        ${label}
      </label>

      <select
        class="input"
        name="${name}"
        ${id ? `id="${id}"` : ''}
        ${required ? 'required' : ''}
      >
        ${options}
      </select>

    </div>
  `;
}


/* =========================================================
   14. BÚSQUEDAS INTERNAS
   ========================================================= */

function selectedExpenseUnit(
  id
) {
  return catalogs.expense_units
    .find(item => {
      return Number(item.id) ===
        Number(id);
    });
}


function selectedPlanting(
  id
) {
  return catalogs.plantings
    .find(item => {
      return Number(item.id) ===
        Number(id);
    });
}


function initialQuantity(
  unitId,
  plantingId
) {
  const unit =
    selectedExpenseUnit(
      unitId
    );

  if (!unit) {
    return 1;
  }

  if (
    unit.quantity_source === 'HECTARES'
  ) {
    return selectedPlanting(
      plantingId
    )?.hectares || '';
  }

  return 1;
}


/* =========================================================
   15. FORMATO MONETARIO
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

          input.dispatchEvent(
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
   16. UTILIDADES
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
  const now = new Date();

  const localDate =
    new Date(
      now.getTime() -
      now.getTimezoneOffset() * 60000
    );

  return localDate
    .toISOString()
    .slice(0, 10);
}
