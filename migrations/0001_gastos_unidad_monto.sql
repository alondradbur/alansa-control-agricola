-- =========================================================
-- Migración: gastos con unidad de costo, monto unitario y cantidad
--
-- Ejecuta en la consola de D1 SOLO las partes que te falten.
-- Para revisar qué tienes:
--   SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'expense_units';
--   PRAGMA table_info(expenses);
-- =========================================================

-- 1) Solo si la primera consulta no devolvió nada:
CREATE TABLE IF NOT EXISTS expense_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  quantity_source TEXT NOT NULL DEFAULT 'MANUAL'
    CHECK(quantity_source IN ('ONE','HECTARES','MANUAL')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO expense_units (name, quantity_source) VALUES
  ('Por hectárea', 'HECTARES'),
  ('Pago único', 'ONE'),
  ('Por unidad', 'MANUAL');

-- 2) Solo las columnas que NO aparezcan en PRAGMA table_info(expenses):
ALTER TABLE expenses ADD COLUMN expense_unit_id INTEGER REFERENCES expense_units(id);
ALTER TABLE expenses ADD COLUMN unit_amount REAL;
ALTER TABLE expenses ADD COLUMN quantity REAL;

-- 3) Opcional: completa los gastos viejos como "pago único".
UPDATE expenses
SET unit_amount = amount,
    quantity = 1
WHERE unit_amount IS NULL;
