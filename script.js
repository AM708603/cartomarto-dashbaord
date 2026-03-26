// API Configuration
const API_URL = 'https://cartomarto-api.borntow2.workers.dev'; // FIX: removed trailing slash

let allOrders = [];
let filteredOrders = [];
let currentPage = 1;
let ordersPerPage = 10;
let token = localStorage.getItem('token');

// Check authentication
// FIX: removed call to /api/auth/check (route doesn't exist in worker).
// Instead we validate the token locally — it's a base64-encoded JSON with an exp field.
function checkAuth() {
  if (!token) {
    window.location.href = '/login.html';
    return false;
  }

  try {
    const payload = JSON.parse(atob(token));
    if (!payload.email || !payload.exp || Date.now() > payload.exp) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login.html';
      return false;
    }
    return true;
  } catch (e) {
    // Token is malformed
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
    return false;
  }
}

// Load orders from API
async function loadOrders() {
  try {
    const response = await fetch(`${API_URL}/api/orders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      allOrders = await response.json();
      filteredOrders = [...allOrders];
      updateStats();
      applyFilters();
      renderOrders();
    } else if (response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login.html';
    }
  } catch (error) {
    console.error('Error loading orders:', error);
  }
}

// Update statistics
function updateStats() {
  const total = allOrders.length;
  const fulfilled = allOrders.filter(o => o.status === 'fulfilled').length;
  const pending = total - fulfilled;
  const revenue = allOrders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0);
  
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-fulfilled').textContent = fulfilled;
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('stat-revenue').textContent = `د.إ${revenue.toFixed(2)}`;
}

// Apply filters
function applyFilters() {
  const search = document.getElementById('search-input')?.value.toLowerCase() || '';
  const status = document.getElementById('status-filter')?.value || 'all';
  const platform = document.getElementById('platform-filter')?.value || 'all';
  const fromDate = document.getElementById('from-date')?.value;
  const toDate = document.getElementById('to-date')?.value;
  
  filteredOrders = allOrders.filter(order => {
    if (search && !order.customer_name?.toLowerCase().includes(search) && 
        !order.order_number?.toLowerCase().includes(search)) {
      return false;
    }
    if (status !== 'all' && order.status !== status) return false;
    if (platform !== 'all' && order.platform !== platform) return false;
    if (fromDate && new Date(order.created_at) < new Date(fromDate)) return false;
    if (toDate && new Date(order.created_at) > new Date(toDate)) return false;
    return true;
  });
  
  currentPage = 1;
  renderOrders();
  updatePagination();
}

// Render orders table
function renderOrders() {
  const tbody = document.getElementById('orders-body');
  const start = (currentPage - 1) * ordersPerPage;
  const pageOrders = filteredOrders.slice(start, start + ordersPerPage);
  
  if (pageOrders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading-cell">No orders found</td></tr>';
    return;
  }
  
  tbody.innerHTML = pageOrders.map(order => `
    <tr>
      <td>#${order.order_number || order.id}</td>
      <td>${new Date(order.created_at).toLocaleDateString()}</td>
      <td>${order.customer_name || 'Guest'}</td>
      <td>${order.platform || 'N/A'}</td>
      <td>د.إ${parseFloat(order.total_price || 0).toFixed(2)}</td>
      <td><span class="status-badge ${order.status === 'fulfilled' ? 'fulfilled' : 'pending'}">${order.status || 'pending'}</span></td>
      <td>${order.csr || 'N/A'}</td>
      <td><button class="btn-icon view-details" data-id="${order.id}"><i class="fas fa-eye"></i></button></td>
    </tr>
  `).join('');
  
  document.querySelectorAll('.view-details').forEach(btn => {
    btn.addEventListener('click', () => showOrderDetails(btn.dataset.id));
  });
}

// Show order details modal
function showOrderDetails(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;
  
  const modal = document.getElementById('order-modal');
  const details = document.getElementById('order-details');
  
  details.innerHTML = `
    <div class="order-detail"><strong>Order ID:</strong> #${order.order_number || order.id}</div>
    <div class="order-detail"><strong>Customer:</strong> ${order.customer_name || 'Guest'}</div>
    <div class="order-detail"><strong>Phone:</strong> ${order.customer_phone || 'N/A'}</div>
    <div class="order-detail"><strong>Address:</strong> ${order.delivery_address || 'N/A'}</div>
    <div class="order-detail"><strong>Platform:</strong> ${order.platform || 'N/A'}</div>
    <div class="order-detail"><strong>CSR:</strong> ${order.csr || 'N/A'}</div>
    <div class="order-detail"><strong>Notes:</strong> ${order.notes || 'N/A'}</div>
    <div class="order-detail"><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</div>
    <div class="order-detail"><strong>Total:</strong> د.إ${parseFloat(order.total_price || 0).toFixed(2)}</div>
    <div class="order-detail"><strong>Status:</strong> ${order.status || 'pending'}</div>
  `;
  
  modal.style.display = 'block';
}

// Update pagination
function updatePagination() {
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  const paginationDiv = document.getElementById('pagination-numbers');
  
  let html = '';
  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    html += `<button class="page-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  paginationDiv.innerHTML = html;
  
  document.querySelectorAll('.page-number').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.page);
      renderOrders();
      updatePagination();
    });
  });
}

// Create order
async function createOrder(orderData) {
  try {
    const response = await fetch(`${API_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(orderData)
    });
    
    if (response.ok) {
      const result = await response.json();
      document.getElementById('order-result').innerHTML = '<span style="color: green;">✓ Order created successfully!</span>';
      setTimeout(() => document.getElementById('order-result').innerHTML = '', 3000);
      loadOrders();
      clearOrderForm();
    } else {
      const error = await response.json();
      document.getElementById('order-result').innerHTML = `<span style="color: red;">✗ Error: ${error.error || 'Failed to create order'}</span>`;
    }
  } catch (error) {
    console.error('Error creating order:', error);
    document.getElementById('order-result').innerHTML = '<span style="color: red;">✗ Network error. Please try again.</span>';
  }
}

// Clear order form
function clearOrderForm() {
  document.getElementById('customer_name').value = '';
  document.getElementById('customer_phone').value = '';
  document.getElementById('delivery_address').value = '';
  document.getElementById('platform').value = '';
  document.getElementById('csr_name').value = '';
  document.getElementById('notes').value = '';
  document.getElementById('order-items').innerHTML = '';
  document.getElementById('subtotal').textContent = 'د.إ0.00';
  document.getElementById('grand-total').textContent = 'د.إ0.00';
}

// Load products for create order
async function loadProducts(search = '') {
  try {
    const url = search ? `${API_URL}/api/products?query=${encodeURIComponent(search)}` : `${API_URL}/api/products`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      renderProducts(data.products || []);
    }
  } catch (error) {
    console.error('Error loading products:', error);
  }
}

// Render products grid
function renderProducts(products) {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  
  if (products.length === 0) {
    grid.innerHTML = '<div class="empty-state">No products found</div>';
    return;
  }
  
  grid.innerHTML = products.map(product => `
    <div class="product-card" data-id="${product.id}" data-title="${product.title}" data-price="${product.price}">
      <div class="product-image">
        <i class="fas fa-box" style="font-size: 48px; color: #ccc;"></i>
      </div>
      <div class="product-info">
        <div class="product-title">${product.title}</div>
        <div class="product-price">د.إ${parseFloat(product.price || 0).toFixed(2)}</div>
      </div>
    </div>
  `).join('');
  
  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => addToCart(card));
  });
}

// Cart functionality
let cart = [];

function addToCart(card) {
  const id = card.dataset.id;
  const title = card.dataset.title;
  const price = parseFloat(card.dataset.price);
  
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ id, title, price, quantity: 1 });
  }
  
  updateCartDisplay();
}

function updateCartDisplay() {
  const cartDiv = document.getElementById('order-items');
  let subtotal = 0;
  
  if (cart.length === 0) {
    cartDiv.innerHTML = '<div class="empty-cart">No items in cart</div>';
  } else {
    cartDiv.innerHTML = cart.map((item, index) => {
      subtotal += item.price * item.quantity;
      return `
        <div class="order-item">
          <div class="order-item-details">
            <div class="order-item-title">${item.title}</div>
            <div class="order-item-meta">د.إ${item.price.toFixed(2)} each</div>
          </div>
          <div class="order-item-actions">
            <input type="number" min="1" max="99" class="order-qty" value="${item.quantity}" data-index="${index}">
            <button class="btn-icon remove-item" data-index="${index}"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
    }).join('');
    
    document.querySelectorAll('.order-qty').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        cart[idx].quantity = parseInt(e.target.value) || 1;
        updateCartDisplay();
      });
    });
    
    document.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(btn.dataset.index);
        cart.splice(idx, 1);
        updateCartDisplay();
      });
    });
  }
  
  const shipping = 15;
  const total = subtotal + shipping;
  document.getElementById('subtotal').textContent = `د.إ${subtotal.toFixed(2)}`;
  document.getElementById('grand-total').textContent = `د.إ${total.toFixed(2)}`;
}

// Navigation
function showDashboard() {
  document.getElementById('orders-card').style.display = 'block';
  document.getElementById('create-order-page').style.display = 'none';
  document.getElementById('rto-page').style.display = 'none';
  document.querySelectorAll('.nav-item').forEach(li => li.classList.remove('active'));
  document.querySelector('#nav-dashboard').closest('.nav-item').classList.add('active');
  document.querySelector('.page-title').textContent = 'Order Management';
}

function showCreateOrder() {
  document.getElementById('orders-card').style.display = 'none';
  document.getElementById('create-order-page').style.display = 'block';
  document.getElementById('rto-page').style.display = 'none';
  document.querySelectorAll('.nav-item').forEach(li => li.classList.remove('active'));
  document.querySelector('#nav-create-order').closest('.nav-item').classList.add('active');
  document.querySelector('.page-title').textContent = 'Create Order';
  loadProducts();
}

function showRTO() {
  document.getElementById('orders-card').style.display = 'none';
  document.getElementById('create-order-page').style.display = 'none';
  document.getElementById('rto-page').style.display = 'block';
  document.querySelectorAll('.nav-item').forEach(li => li.classList.remove('active'));
  document.querySelector('#nav-rto').closest('.nav-item').classList.add('active');
  document.querySelector('.page-title').textContent = 'RTO Management';
}

// Logout
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // FIX: checkAuth is now synchronous, no need for await
  const authenticated = checkAuth();
  if (!authenticated) return;
  
  // Load data
  loadOrders();
  
  // Setup event listeners
  document.getElementById('search-input')?.addEventListener('input', applyFilters);
  document.getElementById('status-filter')?.addEventListener('change', applyFilters);
  document.getElementById('platform-filter')?.addEventListener('change', applyFilters);
  document.getElementById('from-date')?.addEventListener('change', applyFilters);
  document.getElementById('to-date')?.addEventListener('change', applyFilters);
  document.getElementById('reset-btn')?.addEventListener('click', () => {
    document.getElementById('search-input').value = '';
    document.getElementById('status-filter').value = 'all';
    document.getElementById('platform-filter').value = 'all';
    document.getElementById('from-date').value = '';
    document.getElementById('to-date').value = '';
    applyFilters();
  });
  document.getElementById('export-btn')?.addEventListener('click', () => {
    const headers = ['Order ID', 'Customer', 'Platform', 'Total', 'Status', 'CSR', 'Date'];
    const rows = filteredOrders.map(o => [
      o.order_number || o.id,
      o.customer_name || '',
      o.platform || '',
      o.total_price || 0,
      o.status || '',
      o.csr || '',
      new Date(o.created_at).toLocaleDateString()
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById('refresh-btn')?.addEventListener('click', loadOrders);
  document.getElementById('prev-page')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderOrders();
      updatePagination();
    }
  });
  document.getElementById('next-page')?.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderOrders();
      updatePagination();
    }
  });
  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.getElementById('nav-dashboard')?.addEventListener('click', (e) => { e.preventDefault(); showDashboard(); });
  document.getElementById('nav-create-order')?.addEventListener('click', (e) => { e.preventDefault(); showCreateOrder(); });
  document.getElementById('nav-rto')?.addEventListener('click', (e) => { e.preventDefault(); showRTO(); });
  document.getElementById('back-to-orders')?.addEventListener('click', showDashboard);
  document.getElementById('create-order-btn')?.addEventListener('click', () => {
    const orderData = {
      order_number: `ORD-${Date.now()}`,
      customer_name: document.getElementById('customer_name').value,
      customer_phone: document.getElementById('country_code').value + document.getElementById('customer_phone').value,
      delivery_address: document.getElementById('delivery_address').value,
      platform: document.getElementById('platform').value,
      csr: document.getElementById('csr_name').value,
      notes: document.getElementById('notes').value,
      products: cart,
      total_price: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + 15,
      status: 'pending'
    };
    
    if (!orderData.customer_name || !orderData.customer_phone || !orderData.delivery_address) {
      document.getElementById('order-result').innerHTML = '<span style="color: red;">✗ Please fill all required fields</span>';
      return;
    }
    
    if (cart.length === 0) {
      document.getElementById('order-result').innerHTML = '<span style="color: red;">✗ Please add items to cart</span>';
      return;
    }
    
    createOrder(orderData);
  });
  document.getElementById('clear-order-btn')?.addEventListener('click', () => {
    cart = [];
    updateCartDisplay();
  });
  document.getElementById('product-search')?.addEventListener('input', (e) => {
    setTimeout(() => loadProducts(e.target.value), 300);
  });
  
  // Modal close
  document.querySelector('.modal .close')?.addEventListener('click', () => {
    document.getElementById('order-modal').style.display = 'none';
  });
  window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('order-modal')) {
      document.getElementById('order-modal').style.display = 'none';
    }
  });
  
  // Sidebar toggle
  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('collapsed');
  });
  
  // Mobile menu
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('active');
  });
  
  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const icon = document.getElementById('theme-toggle').querySelector('i');
    if (document.body.classList.contains('dark-theme')) {
      icon.className = 'fas fa-sun';
      localStorage.setItem('theme', 'dark');
    } else {
      icon.className = 'fas fa-moon';
      localStorage.setItem('theme', 'light');
    }
  });
  
  // Load theme preference
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
    document.getElementById('theme-toggle').querySelector('i').className = 'fas fa-sun';
  }
});
