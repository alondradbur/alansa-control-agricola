# Modelo de datos ALANSA

Flujo principal:

Siembra → Producción → Inventario → Remisión → Cobranza
                         ↓             ↓
                       Gastos      Liquidaciones

Principios:

1. Minibell es predeterminado, no está rígido en las fórmulas.
2. Condiciones de cada siembra se copian como snapshot histórico.
3. A y R son usuarios; Administrador/Operador son roles.
4. `created_by` y `updated_by` identifican usuario, no rol.
5. Los folios de remisión conservan consecutivo global.
6. Los pagos pueden aplicarse a varias remisiones.
7. Los tipos de cambio históricos no se recalculan.
8. Las categorías de gastos proceden de Catálogos.
9. Los archivos se preparan para R2; D1 conserva referencias.
10. Dashboard y reportes calculan desde datos operativos, sin duplicar totales.
