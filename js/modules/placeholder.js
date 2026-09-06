import { moduleHeader } from '../components/common.js';

const names = {
  plantings: ['Siembras', 'Contratos, hectáreas y periodos de cosecha'],
  production: ['Producción', 'Captura diaria y semanal'],
  inventory: ['Inventario', 'Producción menos remisiones y merma'],
  collections: ['Cobranza', 'Pagos totales, parciales y aplicaciones'],
  expenses: ['Gastos', 'Costos por siembra y categoría'],
  settlements: ['Liquidaciones', 'Esperado, descuentos, fletes y neto'],
  reports: ['Reportes', 'Reportes mensuales, PDF y Excel'],
  settings: ['Configuración', 'Usuarios, roles y parámetros del sistema'],
  more: ['Más', 'Acceso a módulos adicionales']
};

export async function placeholder(route) {
  const [title, subtitle] = names[route] || ['ALANSA', 'Sistema de Control Agrícola'];

  return `
    ${moduleHeader(title, subtitle)}
    <div class="content">
      <section class="card panel">
        <h2>${title}</h2>
        <p class="muted">
          La estructura de este módulo ya está reservada dentro de la arquitectura
          modular. Se conectará a D1 en la siguiente etapa de construcción.
        </p>
      </section>
    </div>
  `;
}
