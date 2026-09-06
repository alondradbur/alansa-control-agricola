# ALANSA — Sistema de Control Agrícola

Base técnica inicial de ALANSA v1.0.

## Arquitectura

- Frontend: HTML + CSS + JavaScript modular
- Hosting: Cloudflare Pages
- API: Cloudflare Pages Functions
- Base de datos: Cloudflare D1
- Repositorio: GitHub
- PWA: `manifest.webmanifest`
- Diseño: responsive escritorio/móvil

## Primera instalación

1. Crear un repositorio nuevo en GitHub.
2. Subir el contenido de esta carpeta.
3. En Cloudflare crear una base D1 llamada `alansa-agricola-db`.
4. Ejecutar `schema.sql`.
5. Ejecutar `seed.sql`.
6. Sustituir `REEMPLAZAR_CON_ID_D1` en `wrangler.toml`.
7. En Pages, crear el binding D1 con nombre exacto `DB`.
8. Desplegar.

## Datos iniciales

- Producto predeterminado: Minibell
- Densidad: 100,000 semillas/ha
- Semilla: USD 400/millar
- Caja: 12 lb
- Precio: USD 14/caja
- Meta: 1 tráiler/semana
- Habilitación predeterminada: MXN 80,000

## Estado de esta entrega

Esta es la **base técnica funcional**, no la aplicación final.

Ya incluye:

- identidad ALANSA y logo real;
- layout desktop;
- navegación móvil tipo app;
- PWA/manifest;
- login base A/R;
- arquitectura modular;
- esquema D1 completo inicial;
- datos semilla;
- dashboard conectado a D1;
- lectura de Catálogos;
- lectura de Remisiones;
- tablas con encabezado fijo y scroll;
- estructura de filtros por fecha;
- módulos reservados para continuar sin rehacer la arquitectura.

## Siguiente fase

Conectar CRUD completo de Catálogos y Siembras, después Gastos,
Producción/Inventario, Remisiones/PDF, Cobranza, Liquidaciones,
Dashboard final, reportes Excel/PDF, autenticación por rol y R2.
