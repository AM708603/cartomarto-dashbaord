// worker.js - CartoMarto Backend API

// ==================== AUTH FUNCTIONS ====================

// Simple JWT functions
function generateToken(user) {
  const payload = { 
    email: user.email, 
    role: user.role,
    id: user.id,
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

// ==================== DATABASE INITIALIZATION ====================

// Ensure all tables exist
async function initDatabase(db) {
  try {
    // Create users table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
      )
    `).run();
    
    // Create orders table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_number TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        delivery_address TEXT,
        platform TEXT,
        total_price REAL,
        status TEXT,
        csr TEXT,
        notes TEXT,
        products TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `).run();
    
    // Create products table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        price REAL,
        sku TEXT,
        stock_quantity INTEGER,
        created_at TEXT,
        updated_at TEXT
      )
    `).run();
    
    // Create rto_records table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS rto_records (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        customer_name TEXT,
        phone TEXT,
        area TEXT,
        emirate TEXT,
        reason TEXT,
        courier TEXT,
        platform TEXT,
        status TEXT,
        csr TEXT,
        notes TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `).run();
    
    // Insert default admin if not exists
    const existingAdmin = await db.prepare("SELECT * FROM users WHERE email = ?").bind('cartomartoadmin@gmail.com').first();
    if (!existingAdmin) {
      await db.prepare(`
        INSERT INTO users (id, email, password, name, role, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        'user_1', 
        'cartomartoadmin@gmail.com', 
        '@CM#123xyzq', 
        'Admin User', 
        'admin', 
        1, 
        new Date().toISOString()
      ).run();
    }
    
    // Insert default manager if not exists
    const existingManager = await db.prepare("SELECT * FROM users WHERE email = ?").bind('amworkmanage@gmail.com').first();
    if (!existingManager) {
      await db.prepare(`
        INSERT INTO users (id, email, password, name, role, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        'user_2', 
        'amworkmanage@gmail.com', 
        'AM#123xyzq', 
        'Manager User', 
        'manager', 
        1, 
        new Date().toISOString()
      ).run();
    }
    
    // Insert default users
    const defaultUsers = [
      { email: 'areeba.sana5498@gmail.com', password: 'Sunny#5498!', name: 'Areeba Sana', role: 'user' },
      { email: 'asadbinnasir@gmail.com', password: 'Nasir$786', name: 'Asad Bin Nasir', role: 'user' },
      { email: 'clarencevicente444@gmail.com', password: 'Clarence444$', name: 'Clarence Vicente', role: 'user' },
      { email: 'izmarizvi29@gmail.com', password: 'Izma29*Star', name: 'Izma Rizvi', role: 'user' },
      { email: 'khawajaburhan4@gmail.com', password: 'Burhan44#', name: 'Khawaja Burhan', role: 'user' },
      { email: 'keythebron12@gmail.com', password: 'KeyBron12@', name: 'Keythe Bron', role: 'user' },
      { email: 'muhammaddilawaroo5@gmail.com', password: 'Dilawar#55!', name: 'Muhammad Dilawar', role: 'user' },
      { email: 'sf776449@gmail.com', password: 'Safe7764!', name: 'Safeer', role: 'user' },
      { email: 'somairnasir257@gmail.com', password: 'Somair257$', name: 'Somair Nasir', role: 'user' },
      { email: 'nadeesha.wimaladarmasooriya@gmail.com', password: 'Nadeesha22!', name: 'Nadeesha', role: 'user' },
      { email: 'rashidshafia6@gmail.com', password: 'Shafia6@!', name: 'Rashid Shafia', role: 'user' },
      { email: 'worktatheer@gmail.com', password: 'Tatheer@2024', name: 'Tatheer', role: 'user' },
      { email: 'tyrnvcnt@gmail.com', password: 'Vincent88#', name: 'Vincent', role: 'user' },
      { email: 'hamzahabibkhan09@gmail.com', password: 'Hamza09#', name: 'Hamza Habib', role: 'user' }
    ];
    
    for (const user of defaultUsers) {
      const existing = await db.prepare("SELECT * FROM users WHERE email = ?").bind(user.email).first();
      if (!existing) {
        await db.prepare(`
          INSERT INTO users (id, email, password, name, role, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, 
          user.email, 
          user.password, 
          user.name, 
          user.role, 
          1, 
          new Date().toISOString()
        ).run();
      }
    }
    
  } catch (error) {
    console.error('Database init error:', error);
  }
}

// ==================== ANALYTICS HELPER FUNCTIONS ====================

// Get daily revenue for last 7 days
async function getDailyRevenue(db) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0];
  
  const { results } = await db.prepare(`
    SELECT DATE(created_at) as date, 
           COUNT(*) as orders, 
           SUM(total_price) as revenue
    FROM orders 
    WHERE created_at >= ?
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `).bind(sevenDaysStr).all();
  
  const dailyData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const existing = results.find(r => r.date === dateStr);
    dailyData.push({
      date: dateStr,
      orders: existing?.orders || 0,
      revenue: existing?.revenue || 0
    });
  }
  return dailyData;
}

// Get platform breakdown
async function getPlatformBreakdown(db) {
  const { results } = await db.prepare(`
    SELECT platform, 
           COUNT(*) as orders, 
           SUM(total_price) as revenue
    FROM orders 
    WHERE platform IS NOT NULL AND platform != ''
    GROUP BY platform
    ORDER BY orders DESC
  `).all();
  
  const total = results.reduce((sum, r) => sum + r.orders, 0);
  return results.map(r => ({
    platform: r.platform,
    orders: r.orders,
    revenue: r.revenue || 0,
    percentage: total > 0 ? Math.round((r.orders / total) * 100) : 0
  }));
}

// Get CSR performance
async function getCsrPerformance(db) {
  const { results } = await db.prepare(`
    SELECT csr,
           COUNT(*) as total_orders,
           SUM(CASE WHEN status IN ('fulfilled', 'delivered') THEN 1 ELSE 0 END) as delivered,
           SUM(CASE WHEN status IN ('rto', 'cancelled') THEN 1 ELSE 0 END) as rto,
           SUM(total_price) as total_revenue
    FROM orders 
    WHERE csr IS NOT NULL AND csr != ''
    GROUP BY csr
    ORDER BY total_orders DESC
  `).all();
  
  return results.map(r => ({
    csr: r.csr,
    total_orders: r.total_orders,
    delivered: r.delivered,
    rto: r.rto,
    delivery_rate: r.total_orders > 0 ? Math.round((r.delivered / r.total_orders) * 100) : 0,
    avg_order_value: r.total_orders > 0 ? (r.total_revenue / r.total_orders) : 0
  }));
}

// Get RTO statistics
async function getRtoStats(db) {
  const { results } = await db.prepare(`
    SELECT status, COUNT(*) as count
    FROM rto_records
    GROUP BY status
  `).all();
  
  const total = results.reduce((sum, r) => sum + r.count, 0);
  return {
    total: total,
    pending: results.find(r => r.status === 'PLS FOLLOW UP ME' || r.status === 'Pending')?.count || 0,
    inProgress: results.find(r => r.status === 'FOLLOWED UP' || r.status === 'In Progress')?.count || 0,
    resolved: results.find(r => r.status === 'DELIVERED' || r.status === 'Resolved')?.count || 0,
    reDispatched: results.find(r => r.status === 'REPROCESS' || r.status === 'Re-Dispatched')?.count || 0
  };
}

// Get top products by revenue
async function getTopProducts(db) {
  const { results } = await db.prepare(`
    SELECT products, total_price
    FROM orders
    WHERE products IS NOT NULL AND products != '[]'
  `).all();
  
  const productMap = new Map();
  
  results.forEach(order => {
    try {
      const products = JSON.parse(order.products);
      products.forEach(p => {
        const name = p.title || p.name || 'Unknown';
        const qty = p.quantity || p.qty || 1;
        const price = p.price || 0;
        if (!productMap.has(name)) {
          productMap.set(name, { sold: 0, revenue: 0 });
        }
        const item = productMap.get(name);
        item.sold += qty;
        item.revenue += price * qty;
      });
    } catch (e) {}
  });
  
  const topProducts = Array.from(productMap.entries())
    .map(([name, data]) => ({ productName: name, totalSold: data.sold, revenue: data.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  
  return topProducts;
}

// ==================== MAIN HANDLER ====================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    
    // Initialize database
    await initDatabase(env.DB);
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    
    // ==================== AUTH ENDPOINTS ====================
    
    // Login
    if (method === 'POST' && url.pathname === '/api/login') {
      try {
        const body = await request.json();
        const db = env.DB;
        
        const user = await db.prepare(`
          SELECT * FROM users WHERE email = ? AND password = ? AND is_active = 1
        `).bind(body.email, body.password).first();
        
        if (!user) {
          return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
            status: 401,
            headers: corsHeaders
          });
        }
        
        const token = generateToken({ id: user.id, email: user.email, role: user.role });
        return new Response(JSON.stringify({ 
          token, 
          user: { id: user.id, email: user.email, role: user.role, name: user.name },
          message: 'Login successful'
        }), { headers: corsHeaders });
      } catch (error) {
        console.error('Login error:', error);
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
    
    // ==================== USER MANAGEMENT ENDPOINTS ====================
    
    // Get all users (admin only)
    if (method === 'GET' && url.pathname === '/api/users') {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      // Only admin can list all users
      if (auth.user.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const { results } = await db.prepare(`
          SELECT id, email, name, role, is_active, created_at FROM users ORDER BY created_at DESC
        `).all();
        
        return new Response(JSON.stringify(results || []), { headers: corsHeaders });
      } catch (error) {
        console.error('Get users error:', error);
        return new Response(JSON.stringify([]), { headers: corsHeaders });
      }
    }
    
    // Create new user (admin only)
    if (method === 'POST' && url.pathname === '/api/users') {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      // Only admin can create users
      if (auth.user.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const body = await request.json();
        const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const now = new Date().toISOString();
        
        // Check if email already exists
        const existing = await db.prepare("SELECT * FROM users WHERE email = ?").bind(body.email).first();
        if (existing) {
          return new Response(JSON.stringify({ error: 'Email already exists' }), {
            status: 400,
            headers: corsHeaders
          });
        }
        
        await db.prepare(`
          INSERT INTO users (id, email, password, name, role, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          body.email,
          body.password,
          body.name,
          body.role || 'user',
          1,
          now
        ).run();
        
        const newUser = await db.prepare(`
          SELECT id, email, name, role, is_active, created_at FROM users WHERE id = ?
        `).bind(id).first();
        
        return new Response(JSON.stringify(newUser), { headers: corsHeaders });
      } catch (error) {
        console.error('Create user error:', error);
        return new Response(JSON.stringify({ error: 'Failed to create user' }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    // Update user role (admin only)
    if (method === 'PATCH' && url.pathname.match(/^\/api\/users\/[^/]+\/role$/)) {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      // Only admin can update roles
      if (auth.user.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const userId = url.pathname.split('/')[3];
        const body = await request.json();
        
        // Don't allow changing own role to non-admin
        if (userId === auth.user.id && body.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Cannot change your own admin role' }), {
            status: 400,
            headers: corsHeaders
          });
        }
        
        await db.prepare(`
          UPDATE users SET role = ? WHERE id = ?
        `).bind(body.role, userId).run();
        
        const updatedUser = await db.prepare(`
          SELECT id, email, name, role, is_active, created_at FROM users WHERE id = ?
        `).bind(userId).first();
        
        return new Response(JSON.stringify(updatedUser), { headers: corsHeaders });
      } catch (error) {
        console.error('Update user role error:', error);
        return new Response(JSON.stringify({ error: 'Failed to update role' }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    // Update user active status (admin only)
    if (method === 'PATCH' && url.pathname.match(/^\/api\/users\/[^/]+\/active$/)) {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      // Only admin can activate/deactivate users
      if (auth.user.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const userId = url.pathname.split('/')[3];
        const body = await request.json();
        
        // Don't allow deactivating yourself
        if (userId === auth.user.id && body.is_active === 0) {
          return new Response(JSON.stringify({ error: 'Cannot deactivate your own account' }), {
            status: 400,
            headers: corsHeaders
          });
        }
        
        await db.prepare(`
          UPDATE users SET is_active = ? WHERE id = ?
        `).bind(body.is_active ? 1 : 0, userId).run();
        
        const updatedUser = await db.prepare(`
          SELECT id, email, name, role, is_active, created_at FROM users WHERE id = ?
        `).bind(userId).first();
        
        return new Response(JSON.stringify(updatedUser), { headers: corsHeaders });
      } catch (error) {
        console.error('Update user status error:', error);
        return new Response(JSON.stringify({ error: 'Failed to update status' }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    // ==================== ANALYTICS ENDPOINTS ====================
    
    // Enhanced stats for admin/manager
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
        const delivered = await db.prepare("SELECT COUNT(*) as c FROM orders WHERE status IN ('fulfilled', 'delivered')").first();
        const revenue = await db.prepare('SELECT SUM(total_price) as t FROM orders').first();
        const rto = await db.prepare('SELECT COUNT(*) as c FROM rto_records').first();
        
        const totalOrders = total?.c || 0;
        const deliveredOrders = delivered?.c || 0;
        const deliveryRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;
        const rtoRate = totalOrders > 0 ? Math.round(((rto?.c || 0) / totalOrders) * 100) : 0;
        
        return new Response(JSON.stringify({
          totalOrders: totalOrders,
          pendingOrders: pending?.c || 0,
          deliveredOrders: deliveredOrders,
          totalRevenue: revenue?.t || 0,
          totalRTO: rto?.c || 0,
          deliveryRate: deliveryRate,
          rtoRate: rtoRate
        }), { headers: corsHeaders });
      } catch (error) {
        console.error('Stats error:', error);
        return new Response(JSON.stringify({ 
          totalOrders: 0, pendingOrders: 0, deliveredOrders: 0, 
          totalRevenue: 0, totalRTO: 0, deliveryRate: 0, rtoRate: 0 
        }), { headers: corsHeaders });
      }
    }
    
    // Daily revenue for charts
    if (method === 'GET' && url.pathname === '/api/stats/daily-revenue') {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const dailyData = await getDailyRevenue(db);
        return new Response(JSON.stringify(dailyData), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify([]), { headers: corsHeaders });
      }
    }
    
    // Platform breakdown
    if (method === 'GET' && url.pathname === '/api/stats/platform') {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const platformData = await getPlatformBreakdown(db);
        return new Response(JSON.stringify(platformData), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify([]), { headers: corsHeaders });
      }
    }
    
    // CSR performance
    if (method === 'GET' && url.pathname === '/api/stats/csr') {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const csrData = await getCsrPerformance(db);
        return new Response(JSON.stringify(csrData), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify([]), { headers: corsHeaders });
      }
    }
    
    // RTO statistics
    if (method === 'GET' && url.pathname === '/api/stats/rto') {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const rtoStats = await getRtoStats(db);
        return new Response(JSON.stringify(rtoStats), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ total: 0, pending: 0, inProgress: 0, resolved: 0, reDispatched: 0 }), { headers: corsHeaders });
      }
    }
    
    // Top products
    if (method === 'GET' && url.pathname === '/api/stats/top-products') {
      const auth = await checkAuth(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: corsHeaders
        });
      }
      
      try {
        const db = env.DB;
        const topProducts = await getTopProducts(db);
        return new Response(JSON.stringify(topProducts), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify([]), { headers: corsHeaders });
      }
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
    
    // Update product
    if (method === 'PATCH' && url.pathname.startsWith('/api/products/')) {
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
          UPDATE products SET title = ?, description = ?, price = ?, sku = ?, stock_quantity = ?, updated_at = ? WHERE id = ?
        `).bind(
          body.title, body.description || '', parseFloat(body.price) || 0,
          body.sku || '', parseInt(body.stock_quantity) || 0, new Date().toISOString(), id
        ).run();
        
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to update product' }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    // Delete product
    if (method === 'DELETE' && url.pathname.startsWith('/api/products/')) {
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
        await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to delete product' }), {
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
            courier, platform, status, csr, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id, body.order_id || '', body.customer_name || '', body.phone || '',
          body.area || '', body.emirate || '', body.reason || '', body.courier || '',
          body.platform || '', body.status || 'PLS FOLLOW UP ME', body.csr || '',
          body.notes || '', new Date().toISOString()
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
          UPDATE rto_records SET status = ?, notes = ?, csr = ?, updated_at = ? WHERE id = ?
        `).bind(
          body.status || 'PLS FOLLOW UP ME', 
          body.notes || '', 
          body.csr || '', 
          new Date().toISOString(), 
          id
        ).run();
        
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
