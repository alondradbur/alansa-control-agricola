PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO roles (name) VALUES ('Administrador');
INSERT OR IGNORE INTO roles (name) VALUES ('Operador');

INSERT OR IGNORE INTO users (code, display_name, role_id)
SELECT 'A', 'A', id FROM roles WHERE name = 'Operador';

INSERT OR IGNORE INTO users (code, display_name, role_id)
SELECT 'R', 'R', id FROM roles WHERE name = 'Operador';

INSERT OR IGNORE INTO products (
  name, short_code, default_density_per_ha, seed_cost_per_thousand,
  seed_currency, standard_box_lbs, default_price_per_box,
  price_currency, is_default
) VALUES (
  'Minibell', 'MINI', 100000, 400,
  'USD', 12, 14,
  'USD', 1
);

INSERT OR IGNORE INTO expense_categories (name, default_amount, default_currency) VALUES
('Semilla', NULL, 'USD'),
('Cinta de riego', NULL, 'MXN'),
('Plástico', NULL, 'MXN'),
('Tubería PVC', NULL, 'MXN'),
('Nómina de la semana', NULL, 'MXN'),
('Diesel', NULL, 'MXN'),
('Fertilizantes', NULL, 'MXN'),
('Agroquímicos', NULL, 'MXN'),
('Gasolina', NULL, 'MXN'),
('Ferretería', NULL, 'MXN'),
('Lavado de baños', NULL, 'MXN'),
('Habilitación', 80000, 'MXN');

INSERT OR IGNORE INTO payment_methods (name) VALUES
('Transferencia'), ('Efectivo'), ('Cheque');

INSERT OR REPLACE INTO settings (key, value) VALUES
('system_name', 'Sistema de Control Agrícola'),
('default_currency', 'MXN'),
('secondary_currency', 'USD'),
('default_product', 'Minibell'),
('weight_tolerance_lbs', '0.50'),
('default_trailers_per_week', '1');
