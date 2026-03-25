// worker.js - CartoMarto Backend API
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
app.use('/api/*', cors());

// Your users
const USERS = [
  { email: 'cartomartoadmin@gmail.com', password: '@CM#123xyzq', role: 'admin' },
  { email: 'amworkmanage@gmail.com', password: 'AM#123xyzq', role: 'user' },
  { email: 'areeba.sana5498@gmail.com', password: 'Sunny#5498!', role: 'user' },
  { email: 'asadbinnasir@gmail.com', password: 'Nasir$786', role: 'user' },
  { email: 'clarencevicente444@gmail.com', password: 'Clarence444$', role: 'user' },
  { email: 'izmarizvi29@gmail.com', password: 'Izma29*Star', role: 'user' },
  { email: 'khawajaburhan4@gmail.com', password: 'Burhan44#', role: 'user' },
  { email: 'keythebron12@gmail.com', password: 'KeyBron12@', role: 'user' },
  { email: 'muhammaddilawaroo5@gmail.com', password: 'Dilawar#55!', role: 'user' },
  { email: 'sf776449@gmail.com', password: 'Safe7764!', role: 'user' },
  { email: 'hamzahabibkhan09@gamil.com', password: 'Hamza09#', role: 'user' },
  { email: 'somairnasir257@gmail.com', password: 'Somair257$', role: 'user' },
  { email: 'nadeesha.wimaladarmasooriya@gmail.com', password: 'Nadeesha22!', role: 'user' },
  { email: 'rashidshafia6@gmail.com', password: 'Shafia6@!', role: 'user' },
  { email: 'worktatheer@gmail.com', password: 'Tatheer@2024', role: 'user' },
  { email: 'tyrnvcnt@gmail.com', password: 'Vincent88#', role: 'user' },
];

// Simple JWT functions
async function generateToken(user) {
  const payload = { 
    email: user.email, 
    role: user.role, 
    exp: Math.floor(Date.now() / 1000) + 3600 
  };
  return btoa(JSON.stringify(payload));
}

async function verifyToken(token) {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// Auth middleware
async function auth(c, next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.substring(7);
  const user = await verifyToken(token);
  if (!user) return c.json({ error: 'Invalid token' }, 401);
  c.set('user', user);
  await next();
}

// ==================== AUTH ENDPOINTS ====================

app.post('/api/login', async (c) => {
  const { email, password } = await c.req.json();
  const user = USERS.find(u => u.email === email && u.password === password);
  
  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  
  const token = await generateToken({ email: user.email, role: user.role });
  return c.json({ 
    token, 
    user: { email: user.email, role: user.role },
    message: 'Login successful'
  });
});

app.get('/api/auth/check', auth, async (c) => {
  return c.json({ user: c.get('user') });
});

// ==================== ORDERS ENDPOINTS ====================

app.get('/api/orders', auth, async (c) => {
  const db = c.env.DB;
  try {
    const { results } = await db.prepare(
      'SELECT * FROM orders ORDER BY created_at DESC LIMIT 500'
    ).all();
    return c.json(results || []);
  } catch (error) {
    console.error('Database error:', error);
    return c.json([], 200);
  }
});

app.post('/api/orders', auth, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  
  try {
    const id = `ORD-${Date.now()}`;
    const now = new Date().toISOString();
    
    await db.prepare(`
      INSERT INTO orders (
        id, order_number, customer_name, customer_phone, delivery_address,
        platform, total_price, status, csr, notes, products, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.order_number || `ORD-${Date.now()}`,
      body.customer_name || '',
      body.customer_phone || '',
      body.delivery_address || '',
      body.platform || '',
      parseFloat(body.total_price) || 0,
      body.status || 'pending',
      body.csr || '',
      body.notes || '',
      JSON.stringify(body.products || []),
      now
    ).run();
    
    return c.json({ success: true, id, message: 'Order created' });
  } catch (error) {
    console.error('Error:', error);
    return c.json({ error: 'Failed to create order' }, 500);
  }
});

app.patch('/api/orders/:id', auth, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const { status } = await c.req.json();
  
  try {
    await db.prepare(`
      UPDATE orders SET status = ?, updated_at = ? WHERE id = ?
    `).bind(status || 'pending', new Date().toISOString(), id).run();
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to update' }, 500);
  }
});

app.delete('/api/orders/:id', auth, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM orders WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ==================== PRODUCTS ====================

app.get('/api/products', auth, async (c) => {
  const db = c.env.DB;
  const query = c.req.query('query') || '';
  
  try {
    let sql = 'SELECT * FROM products ORDER BY created_at DESC';
    let params = [];
    
    if (query) {
      sql = 'SELECT * FROM products WHERE title LIKE ? OR sku LIKE ? ORDER BY created_at DESC';
      const term = `%${query}%`;
      params = [term, term];
    }
    
    const { results } = await db.prepare(sql).bind(...params).all();
    return c.json({ products: results || [], total: results?.length || 0 });
  } catch (error) {
    return c.json({ products: [], total: 0 }, 200);
  }
});

app.post('/api/products', auth, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  
  try {
    const id = `PROD-${Date.now()}`;
    await db.prepare(`
      INSERT INTO products (id, title, description, price, sku, stock_quantity, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, body.title, body.description || '', parseFloat(body.price) || 0,
      body.sku || '', parseInt(body.stock_quantity) || 0, new Date().toISOString()
    ).run();
    
    return c.json({ success: true, id });
  } catch (error) {
    return c.json({ error: 'Failed to create product' }, 500);
  }
});

// ==================== RTO RECORDS ====================

app.get('/api/rto', auth, async (c) => {
  const db = c.env.DB;
  try {
    const { results } = await db.prepare(
      'SELECT * FROM rto_records ORDER BY created_at DESC'
    ).all();
    return c.json(results || []);
  } catch (error) {
    return c.json([], 200);
  }
});

app.post('/api/rto', auth, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  
  try {
    const id = `RTO-${Date.now()}`;
    await db.prepare(`
      INSERT INTO rto_records (
        id, order_id, customer_name, phone, area, emirate, reason,
        courier, platform, status, csr, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, body.order_id || '', body.customer_name || '', body.phone || '',
      body.area || '', body.emirate || '', body.reason || '', body.courier || '',
      body.platform || '', body.status || 'Pending', body.csr || '',
      new Date().toISOString()
    ).run();
    
    return c.json({ success: true, id });
  } catch (error) {
    return c.json({ error: 'Failed to create' }, 500);
  }
});

app.patch('/api/rto/:id', auth, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const { status, csr } = await c.req.json();
  
  try {
    await db.prepare(`
      UPDATE rto_records SET status = ?, csr = ?, updated_at = ? WHERE id = ?
    `).bind(status || 'Pending', csr || '', new Date().toISOString(), id).run();
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to update' }, 500);
  }
});

app.delete('/api/rto/:id', auth, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM rto_records WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ==================== STATISTICS ====================

app.get('/api/stats', auth, async (c) => {
  const db = c.env.DB;
  try {
    const total = await db.prepare('SELECT COUNT(*) as c FROM orders').first();
    const pending = await db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").first();
    const revenue = await db.prepare('SELECT SUM(total_price) as t FROM orders').first();
    const rto = await db.prepare('SELECT COUNT(*) as c FROM rto_records').first();
    
    return c.json({
      totalOrders: total?.c || 0,
      pendingOrders: pending?.c || 0,
      totalRevenue: revenue?.t || 0,
      totalRTO: rto?.c || 0
    });
  } catch (error) {
    return c.json({ totalOrders: 0, pendingOrders: 0, totalRevenue: 0, totalRTO: 0 });
  }
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
