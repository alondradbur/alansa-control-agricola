import { json, error } from './_util.js';
const TABLES={products:'products',clients:'clients',suppliers:'suppliers',expense_categories:'expense_categories',payment_methods:'payment_methods'};

export async function onRequestGet({env}) {
  const [products,expense_categories,clients,suppliers,payment_methods]=await Promise.all([
    env.DB.prepare(`SELECT * FROM products ORDER BY is_default DESC,name`).all(),
    env.DB.prepare(`SELECT * FROM expense_categories ORDER BY name`).all(),
    env.DB.prepare(`SELECT * FROM clients ORDER BY name`).all(),
    env.DB.prepare(`SELECT * FROM suppliers ORDER BY name`).all(),
    env.DB.prepare(`SELECT * FROM payment_methods ORDER BY name`).all()
  ]);
  return json({products:products.results||[],expense_categories:expense_categories.results||[],clients:clients.results||[],suppliers:suppliers.results||[],payment_methods:payment_methods.results||[]});
}

export async function onRequestPost({env,request}) {
  const {entity,data={}}=await request.json();
  try {
    if(entity==='clients'){
      const r=await env.DB.prepare(`INSERT INTO clients(name,credit_days,notes) VALUES(?,?,?)`).bind(data.name.trim(),Number(data.credit_days||0),data.notes||null).run();
      return json({ok:true,id:r.meta?.last_row_id});
    }
    if(entity==='suppliers'){
      const r=await env.DB.prepare(`INSERT INTO suppliers(name,contact,notes) VALUES(?,?,?)`).bind(data.name.trim(),data.contact||null,data.notes||null).run();
      return json({ok:true,id:r.meta?.last_row_id});
    }
    if(entity==='expense_categories'){
      const r=await env.DB.prepare(`INSERT INTO expense_categories(name,default_amount,default_currency) VALUES(?,?,?)`).bind(data.name.trim(),data.default_amount===''?null:Number(data.default_amount),data.default_currency||'MXN').run();
      return json({ok:true,id:r.meta?.last_row_id});
    }
    if(entity==='payment_methods'){
      const r=await env.DB.prepare(`INSERT INTO payment_methods(name) VALUES(?)`).bind(data.name.trim()).run();
      return json({ok:true,id:r.meta?.last_row_id});
    }
    if(entity==='products'){
      if(Number(data.is_default)===1) await env.DB.prepare(`UPDATE products SET is_default=0`).run();
      const r=await env.DB.prepare(`INSERT INTO products(name,short_code,default_density_per_ha,seed_cost_per_thousand,seed_currency,standard_box_lbs,default_price_per_box,price_currency,is_default) VALUES(?,?,?,?,?,?,?,?,?)`).bind(
        data.name.trim(),data.short_code.trim().toUpperCase(),Number(data.default_density_per_ha||0),Number(data.seed_cost_per_thousand||0),data.seed_currency||'USD',Number(data.standard_box_lbs||12),Number(data.default_price_per_box||0),data.price_currency||'USD',Number(data.is_default||0)
      ).run();
      return json({ok:true,id:r.meta?.last_row_id});
    }
    return error('Catálogo no reconocido.');
  } catch(e){return error(String(e.message||'').includes('UNIQUE')?'Ya existe un registro con esos datos.':'No fue posible guardar el registro.');}
}

export async function onRequestDelete({env,request}){
  const {entity,id}=await request.json(); const table=TABLES[entity]; if(!table) return error('Catálogo no reconocido.');
  try{await env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(id).run();return json({ok:true});}
  catch{return error('Este registro ya tiene movimientos relacionados y no puede eliminarse.');}
}
