import { json } from './_util.js';

export async function onRequestGet(context) {
  const db = context.env.DB;

  const [products, categories, clients, suppliers] = await Promise.all([
    db.prepare(`SELECT * FROM products ORDER BY is_default DESC, name`).all(),
    db.prepare(`SELECT * FROM expense_categories ORDER BY name`).all(),
    db.prepare(`SELECT * FROM clients ORDER BY name`).all(),
    db.prepare(`SELECT * FROM suppliers ORDER BY name`).all()
  ]);

  return json({
    products: products.results || [],
    expense_categories: categories.results || [],
    clients: clients.results || [],
    suppliers: suppliers.results || []
  });
}
