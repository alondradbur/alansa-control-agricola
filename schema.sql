PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  password_hash TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  short_code TEXT NOT NULL UNIQUE,
  default_density_per_ha REAL NOT NULL DEFAULT 0,
  seed_cost_per_thousand REAL NOT NULL DEFAULT 0,
  seed_currency TEXT NOT NULL DEFAULT 'USD',
  standard_box_lbs REAL NOT NULL DEFAULT 12,
  default_price_per_box REAL NOT NULL DEFAULT 0,
  price_currency TEXT NOT NULL DEFAULT 'USD',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  credit_days INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  contact TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  default_amount REAL,
  default_currency TEXT CHECK(default_currency IN ('MXN','USD')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plantings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_number TEXT NOT NULL UNIQUE,
  product_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  hectares REAL NOT NULL CHECK(hectares > 0),
  density_per_ha REAL NOT NULL CHECK(density_per_ha > 0),
  seed_cost_per_thousand REAL NOT NULL DEFAULT 0,
  estimated_seed_cost REAL NOT NULL DEFAULT 0,
  actual_seed_cost REAL,
  seed_currency TEXT NOT NULL DEFAULT 'USD',
  harvest_start TEXT NOT NULL,
  harvest_end TEXT NOT NULL,
  price_per_box REAL NOT NULL DEFAULT 0,
  price_currency TEXT NOT NULL DEFAULT 'USD',
  standard_box_lbs REAL NOT NULL DEFAULT 12,
  trailers_per_week REAL NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Activa',
  notes TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(product_id) REFERENCES products(id),
  FOREIGN KEY(client_id) REFERENCES clients(id),
  FOREIGN KEY(created_by) REFERENCES users(id),
  FOREIGN KEY(updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS production_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_date TEXT NOT NULL,
  planting_id INTEGER NOT NULL,
  period_type TEXT NOT NULL CHECK(period_type IN ('Diario','Semanal')),
  boxes REAL NOT NULL DEFAULT 0 CHECK(boxes >= 0),
  pounds REAL NOT NULL DEFAULT 0 CHECK(pounds >= 0),
  waste_boxes REAL NOT NULL DEFAULT 0 CHECK(waste_boxes >= 0),
  waste_pounds REAL NOT NULL DEFAULT 0 CHECK(waste_pounds >= 0),
  notes TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(planting_id) REFERENCES plantings(id),
  FOREIGN KEY(created_by) REFERENCES users(id),
  FOREIGN KEY(updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  folio TEXT NOT NULL UNIQUE,
  sequence INTEGER NOT NULL UNIQUE,
  shipment_date TEXT NOT NULL,
  planting_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  boxes REAL NOT NULL CHECK(boxes > 0),
  pounds REAL NOT NULL CHECK(pounds > 0),
  standard_box_lbs REAL NOT NULL DEFAULT 12,
  price_per_box REAL NOT NULL CHECK(price_per_box >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate REAL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'Emitida',
  notes TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(planting_id) REFERENCES plantings(id),
  FOREIGN KEY(client_id) REFERENCES clients(id),
  FOREIGN KEY(product_id) REFERENCES products(id),
  FOREIGN KEY(created_by) REFERENCES users(id),
  FOREIGN KEY(updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_date TEXT NOT NULL,
  client_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  currency TEXT NOT NULL CHECK(currency IN ('MXN','USD')),
  exchange_rate REAL,
  payment_method_id INTEGER,
  reference TEXT,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(client_id) REFERENCES clients(id),
  FOREIGN KEY(payment_method_id) REFERENCES payment_methods(id),
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payment_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER NOT NULL,
  shipment_id INTEGER NOT NULL,
  applied_amount REAL NOT NULL CHECK(applied_amount > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  FOREIGN KEY(shipment_id) REFERENCES shipments(id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT NOT NULL,
  planting_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  supplier_id INTEGER,
  concept TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount >= 0),
  currency TEXT NOT NULL CHECK(currency IN ('MXN','USD')),
  exchange_rate REAL,
  mxn_equivalent REAL,
  payment_method_id INTEGER,
  invoice_number TEXT,
  notes TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(planting_id) REFERENCES plantings(id),
  FOREIGN KEY(category_id) REFERENCES expense_categories(id),
  FOREIGN KEY(supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY(payment_method_id) REFERENCES payment_methods(id),
  FOREIGN KEY(created_by) REFERENCES users(id),
  FOREIGN KEY(updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS expense_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  storage_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(expense_id) REFERENCES expenses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settlement_date TEXT NOT NULL,
  client_id INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  expected_amount REAL NOT NULL DEFAULT 0,
  net_amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(client_id) REFERENCES clients(id),
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS settlement_shipments (
  settlement_id INTEGER NOT NULL,
  shipment_id INTEGER NOT NULL,
  PRIMARY KEY(settlement_id, shipment_id),
  FOREIGN KEY(settlement_id) REFERENCES settlements(id) ON DELETE CASCADE,
  FOREIGN KEY(shipment_id) REFERENCES shipments(id)
);

CREATE TABLE IF NOT EXISTS settlement_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settlement_id INTEGER NOT NULL,
  adjustment_type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  FOREIGN KEY(settlement_id) REFERENCES settlements(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_plantings_harvest ON plantings(harvest_start, harvest_end);
CREATE INDEX IF NOT EXISTS idx_production_date ON production_records(record_date);
CREATE INDEX IF NOT EXISTS idx_shipments_date ON shipments(shipment_date);
CREATE INDEX IF NOT EXISTS idx_shipments_client ON shipments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
