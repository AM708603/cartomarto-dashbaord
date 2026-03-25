// worker.js - CartoMarto Backend API (No external dependencies)

// ==================== AUTH FUNCTIONS ====================

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
function generateToken(user) {
  const payload = { 
    email: user.email, 
    role: user.role, 
    exp: Math.floor(Date.now() / 1000) + 3600 
  };
  return btoa(JSON.stringify(payload));
}

function verifyToken(token) {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// ==================== MAIN HANDLER ====================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    
    // ==================== AUTH ENDPOINTS ====================
    
    // Login
    if (method === 'POST' && url.pathname === '/api/login') {
      try {
        const body = await request.json();
        const user = USERS.find(u => u.email === body.email && u.password === body.password);
        
        if (!user) {
          return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
            status: 401,
            headers: corsHeaders
          });
        }
        
        const token = generateToken({ email: user.email, role: user.role });
        return new Response(JSON.stringify({ 
          token, 
          user: { email: user.email, role: user.role },
          message: 'Login successful'
        }), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: corsHeaders
        });
      }
    }
    
    // Auth check
    if (method === 'GET' && url.pathname === '/api/auth/check') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      const token = authHeader.substring(7);
      const user = verifyToken(token);
      if (!user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      return new Response(JSON.stringify({ user }), { headers: corsHeaders });
    }
    
    // ==================== ORDERS ENDPOINTS ====================
    
    // Get all orders
    if (method === 'GET' && url.pathname === '/api/orders') {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const { results } = await db.prepare(
          'SELECT * FROM orders ORDER BY created_at DESC LIMIT 500'
        ).all();
        
        return new Response(JSON.stringify(results || []), { headers: corsHeaders });
      } catch (error) {
        console.error('Database error:', error);
        return new Response(JSON.stringify([]), { headers: corsHeaders });
      }
    }
    
    // Create order
    if (method === 'POST' && url.pathname === '/api/orders') {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const body = await request.json();
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
        
        return new Response(JSON.stringify({ success: true, id, message: 'Order created' }), {
          headers: corsHeaders
        });
      } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: 'Failed to create order' }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    // Update order
    if (method === 'PATCH' && url.pathname.startsWith('/api/orders/')) {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const id = url.pathname.split('/')[3];
        const body = await request.json();
        
        await db.prepare(`
          UPDATE orders SET status = ?, updated_at = ? WHERE id = ?
        `).bind(body.status || 'pending', new Date().toISOString(), id).run();
        
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to update' }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    // Delete order
    if (method === 'DELETE' && url.pathname.startsWith('/api/orders/')) {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const id = url.pathname.split('/')[3];
        await db.prepare('DELETE FROM orders WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to delete' }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    // ==================== PRODUCTS ENDPOINTS ====================
    
    // Get products
    if (method === 'GET' && url.pathname === '/api/products') {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const query = url.searchParams.get('query') || '';
        
        let sql = 'SELECT * FROM products ORDER BY created_at DESC';
        let params = [];
        
        if (query) {
          sql = 'SELECT * FROM products WHERE title LIKE ? OR sku LIKE ? ORDER BY created_at DESC';
          const term = `%${query}%`;
          params = [term, term];
        }
        
        const { results } = await db.prepare(sql).bind(...params).all();
        return new Response(JSON.stringify({ products: results || [], total: results?.length || 0 }), {
          headers: corsHeaders
        });
      } catch (error) {
        return new Response(JSON.stringify({ products: [], total: 0 }), { headers: corsHeaders });
      }
    }
    
    // Create product
    if (method === 'POST' && url.pathname === '/api/products') {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const body = await request.json();
        const id = `PROD-${Date.now()}`;
        
        await db.prepare(`
          INSERT INTO products (id, title, description, price, sku, stock_quantity, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id, body.title, body.description || '', parseFloat(body.price) || 0,
          body.sku || '', parseInt(body.stock_quantity) || 0, new Date().toISOString()
        ).run();
        
        return new Response(JSON.stringify({ success: true, id }), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to create product' }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    // ==================== RTO ENDPOINTS ====================
    
    // Get RTO records
    if (method === 'GET' && url.pathname === '/api/rto') {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const { results } = await db.prepare(
          'SELECT * FROM rto_records ORDER BY created_at DESC'
        ).all();
        
        return new Response(JSON.stringify(results || []), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify([]), { headers: corsHeaders });
      }
    }
    
    // Create RTO record
    if (method === 'POST' && url.pathname === '/api/rto') {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const body = await request.json();
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
        
        return new Response(JSON.stringify({ success: true, id }), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to create' }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    // Update RTO record
    if (method === 'PATCH' && url.pathname.startsWith('/api/rto/')) {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const id = url.pathname.split('/')[3];
        const body = await request.json();
        
        await db.prepare(`
          UPDATE rto_records SET status = ?, csr = ?, updated_at = ? WHERE id = ?
        `).bind(body.status || 'Pending', body.csr || '', new Date().toISOString(), id).run();
        
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to update' }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    // Delete RTO record
    if (method === 'DELETE' && url.pathname.startsWith('/api/rto/')) {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const id = url.pathname.split('/')[3];
        await db.prepare('DELETE FROM rto_records WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to delete' }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    // ==================== STATS ENDPOINTS ====================
    
    // Get stats
    if (method === 'GET' && url.pathname === '/api/stats') {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const total = await db.prepare('SELECT COUNT(*) as c FROM orders').first();
        const pending = await db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").first();
        const revenue = await db.prepare('SELECT SUM(total_price) as t FROM orders').first();
        const rto = await db.prepare('SELECT COUNT(*) as c FROM rto_records').first();
        
        return new Response(JSON.stringify({
          totalOrders: total?.c || 0,
          pendingOrders: pending?.c || 0,
          totalRevenue: revenue?.t || 0,
          totalRTO: rto?.c || 0
        }), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ totalOrders: 0, pendingOrders: 0, totalRevenue: 0, totalRTO: 0 }), {
          headers: corsHeaders
        });
      }
    }
    
    // Health check
    if (method === 'GET' && url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        headers: corsHeaders
      });
    }
    
    // 404 for any other route
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: corsHeaders
    });
  }
};

// Helper function to check authentication
async function checkAuth(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false };
  }
  
  const token = authHeader.substring(7);
  const user = verifyToken(token);
  if (!user) {
    return { valid: false };
  }
  
  return { valid: true, user };
}
