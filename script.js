// API Configuration
const API_URL = 'https://cartomarto-api.borntow2.workers.dev';

let allOrders = [];
let filteredOrders = [];
let currentPage = 1;
let ordersPerPage = 10;

// FIXED: Always read fresh token from localStorage
function checkAuth() {
  const currentToken = localStorage.getItem('token');
  
  if (!currentToken) {
    window.location.href = '/login.html';
    return false;
  }

  try {
    const payload = JSON.parse(atob(currentToken));
    if (!payload.email || !payload.exp || Date.now() > payload.exp * 1000) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login.html';
      return false;
    }
    return true;
  } catch (e) {
    console.error('Token validation error:', e);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
    return false;
  }
}

// Get token for API calls
function getToken() {
  return localStorage.getItem('token');
}

// Load orders from API
async function loadOrders() {
  const token = getToken();
  if (!token) return;
  
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
      localStorage.removeItem('user');
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
  
  // Update stat cards with correct IDs
  const totalOrdersEl = document.querySelector('[data-stat-type="total-orders"] .stat-value');
  const fulfilledEl = document.querySelector('[data-stat-type="fulfilled"] .stat-value');
  const pendingEl = document.querySelector('[data-stat-type="pending"] .stat-value');
  const revenueEl = document.querySelector('[data-stat-type="revenue"] .stat-value');
  
  if (totalOrdersEl) totalOrdersEl.textContent = total;
  if (fulfilledEl) fulfilledEl.textContent = fulfilled;
  if (pendingEl) pendingEl.textContent = pending;
  if (revenueEl) revenueEl.textContent = `د.إ${revenue.toFixed(2)}`;
}

// Apply filters
function applyFilters() {
  const search = document.getElementById('search-input')?.value.toLowerCase() || '';
  const status = document.getElementById('status-filter')?.value || 'all';
  const platform = document.getElementById('platforms-filter')?.value || 'all';
  const fromDate = document.getElementById('from-date')?.value;
  const toDate = document.getElementById('to-date')?.value;
  const csr = document.getElementById('csr-filter')?.value.toLowerCase() || '';
  const customer = document.getElementById('customer-filter')?.value.toLowerCase() || '';
  const minTotal = parseFloat(document.getElementById('min-total')?.value) || 0;
  const maxTotal = parseFloat(document.getElementById('max-total')?.value) || Infinity;
  
  filteredOrders = allOrders.filter(order => {
    if (search && !order.customer_name?.toLowerCase().includes(search) && 
        !order.order_number?.toLowerCase().includes(search) &&
        !order.id?.toLowerCase().includes(search)) {
      return false;
    }
    if (status !== 'all' && order.status !== status) return false;
    if (platform !== 'all' && order.platform !== platform) return false;
    if (fromDate && new Date(order.created_at) < new Date(fromDate)) return false;
    if (toDate && new Date(order.created_at) > new Date(toDate)) return false;
    if (csr && !order.csr?.toLowerCase().includes(csr)) return false;
    if (customer && !order.customer_name?.toLowerCase().includes(customer)) return false;
    const total = parseFloat(order.total_price) || 0;
    if (total < minTotal) return false;
    if (total > maxTotal) return false;
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
  
  if (!tbody) return;
  
  if (pageOrders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="loading-cell">No orders found</td></tr>';
    return;
  }
  
  tbody.innerHTML = pageOrders.map(order => `
    <tr>
      <td>#${order.order_number || order.id?.slice(-8) || 'N/A'}</td>
      <td>${new Date(order.created_at).toLocaleDateString()}</td>
      <td>${order.customer_name || 'Guest'}</td>
      <td>${order.platform || 'N/A'}</td>
      <td>د.إ${parseFloat(order.total_price || 0).toFixed(2)}</td>
      <td><span class="status-badge ${order.status === 'fulfilled' ? 'fulfilled' : order.status === 'cancelled' ? 'cancelled' : 'pending'}">${order.status || 'pending'}</span></td>
      <td>${order.inventory_status || 'N/A'}</td>
      <td>${order.courier || 'N/A'}</td>
      <td>${order.tracking_id || 'N/A'}</td>
      <td>${order.courier_status || 'N/A'}</td>
      <td>${order.csr || 'N/A'}</td>
      <td><button class="btn-icon view-details" data-id="${order.id}"><i class="fas fa-eye"></i></button></td>
    </tr>
  `).join('');
  
  document.querySelectorAll('.view-details').forEach(btn => {
    btn.addEventListener('click', () => showOrderDetails(btn.dataset.id));
  });
  
  // Update pagination info
  const startNum = start + 1;
  const endNum = Math.min(start + ordersPerPage, filteredOrders.length);
  const startSpan = document.getElementById('pagination-start');
  const endSpan = document.getElementById('pagination-end');
  const totalSpan = document.getElementById('pagination-total');
  if (startSpan) startSpan.textContent = startNum;
  if (endSpan) endSpan.textContent = endNum;
  if (totalSpan) totalSpan.textContent = filteredOrders.length;
}

// Show order details modal
function showOrderDetails(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;
  
  const modal = document.getElementById('order-modal');
  const details = document.getElementById('order-details');
  
  if (!modal || !details) return;
  
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
  
  if (!paginationDiv) return;
  
  let html = '';
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }
  
  for (let i = startPage; i <= endPage; i++) {
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
  const token = getToken();
  if (!token) return;
  
  try {
    const response = await fetch(`${API_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(orderData)
    });
    
    const resultDiv = document.getElementById('create-order-result');
    if (!resultDiv) return;
    
    if (response.ok) {
      resultDiv.innerHTML = '<span style="color: green;">✓ Order created successfully!</span>';
      resultDiv.className = 'result-message success';
      setTimeout(() => {
        resultDiv.innerHTML = '';
        resultDiv.className = 'result-message';
      }, 3000);
      loadOrders();
      clearOrderForm();
    } else {
      const error = await response.json();
      resultDiv.innerHTML = `<span style="color: red;">✗ Error: ${error.error || 'Failed to create order'}</span>`;
      resultDiv.className = 'result-message error';
    }
  } catch (error) {
    console.error('Error creating order:', error);
    const resultDiv = document.getElementById('create-order-result');
    if (resultDiv) {
      resultDiv.innerHTML = '<span style="color: red;">✗ Network error. Please try again.</span>';
      resultDiv.className = 'result-message error';
    }
  }
}

// Clear order form
function clearOrderForm() {
  const fields = ['customer_full_name', 'customer_mobile', 'delivery_address', 'Platform', 'csr_name', 'customer_notes', 'inventory_notes'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const countryCode = document.getElementById('country_code');
  if (countryCode) countryCode.value = '+971';
  const emirates = document.getElementById('customer_emirates');
  if (emirates) emirates.value = '';
  
  cart = [];
  updateCartDisplay();
}

// Load products for create order
async function loadProducts(search = '') {
  const token = getToken();
  if (!token) return;
  
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
  const countSpan = document.getElementById('products-count');
  const emptyDiv = document.getElementById('products-empty');
  
  if (!grid) return;
  
  if (products.length === 0) {
    grid.innerHTML = '';
    if (countSpan) countSpan.textContent = '0 products';
    if (emptyDiv) emptyDiv.style.display = 'flex';
    return;
  }
  
  if (emptyDiv) emptyDiv.style.display = 'none';
  if (countSpan) countSpan.textContent = `${products.length} products`;
  
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
  const emptyDiv = document.getElementById('order-empty');
  let subtotal = 0;
  
  if (!cartDiv) return;
  
  if (cart.length === 0) {
    cartDiv.innerHTML = '';
    if (emptyDiv) emptyDiv.style.display = 'flex';
  } else {
    if (emptyDiv) emptyDiv.style.display = 'none';
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
  const subtotalEl = document.getElementById('order-subtotal');
  const grandTotalEl = document.getElementById('order-grand-total');
  if (subtotalEl) subtotalEl.textContent = `د.إ${subtotal.toFixed(2)}`;
  if (grandTotalEl) grandTotalEl.textContent = `د.إ${total.toFixed(2)}`;
}

// Navigation
function showDashboard() {
  const ordersCard = document.getElementById('orders-card');
  const createPage = document.getElementById('create-order-page');
  const rtoPage = document.getElementById('rto-page');
  const statsSection = document.querySelector('.stats-section');
  
  if (ordersCard) ordersCard.style.display = 'block';
  if (createPage) createPage.style.display = 'none';
  if (rtoPage) rtoPage.style.display = 'none';
  if (statsSection) statsSection.style.display = '';
  
  document.querySelectorAll('.nav-item').forEach(li => li.classList.remove('active'));
  const dashboardNav = document.querySelector('#nav-dashboard');
  if (dashboardNav) dashboardNav.closest('.nav-item').classList.add('active');
  
  const pageTitle = document.querySelector('.page-title');
  if (pageTitle) pageTitle.textContent = 'Order Management';
}

function showCreateOrder() {
  const ordersCard = document.getElementById('orders-card');
  const createPage = document.getElementById('create-order-page');
  const rtoPage = document.getElementById('rto-page');
  const statsSection = document.querySelector('.stats-section');
  
  if (ordersCard) ordersCard.style.display = 'none';
  if (createPage) createPage.style.display = 'block';
  if (rtoPage) rtoPage.style.display = 'none';
  if (statsSection) statsSection.style.display = 'none';
  
  document.querySelectorAll('.nav-item').forEach(li => li.classList.remove('active'));
  const createNav = document.querySelector('#nav-create-order');
  if (createNav) createNav.closest('.nav-item').classList.add('active');
  
  const pageTitle = document.querySelector('.page-title');
  if (pageTitle) pageTitle.textContent = 'Create Order';
  loadProducts();
}

function showRTO() {
  const ordersCard = document.getElementById('orders-card');
  const createPage = document.getElementById('create-order-page');
  const rtoPage = document.getElementById('rto-page');
  const statsSection = document.querySelector('.stats-section');
  
  if (ordersCard) ordersCard.style.display = 'none';
  if (createPage) createPage.style.display = 'none';
  if (rtoPage) rtoPage.style.display = 'block';
  if (statsSection) statsSection.style.display = 'none';
  
  document.querySelectorAll('.nav-item').forEach(li => li.classList.remove('active'));
  const rtoNav = document.querySelector('#nav-rto');
  if (rtoNav) rtoNav.closest('.nav-item').classList.add('active');
  
  const pageTitle = document.querySelector('.page-title');
  if (pageTitle) pageTitle.textContent = 'RTO Management';
}

// Logout
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  const authenticated = checkAuth();
  if (!authenticated) return;
  
  // Load data
  loadOrders();
  
  // Setup event listeners
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.addEventListener('input', applyFilters);
  
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) statusFilter.addEventListener('change', applyFilters);
  
  const platformsFilter = document.getElementById('platforms-filter');
  if (platformsFilter) platformsFilter.addEventListener('change', applyFilters);
  
  const fromDate = document.getElementById('from-date');
  if (fromDate) fromDate.addEventListener('change', applyFilters);
  
  const toDate = document.getElementById('to-date');
  if (toDate) toDate.addEventListener('change', applyFilters);
  
  const csrFilter = document.getElementById('csr-filter');
  if (csrFilter) csrFilter.addEventListener('input', applyFilters);
  
  const customerFilter = document.getElementById('customer-filter');
  if (customerFilter) customerFilter.addEventListener('input', applyFilters);
  
  const minTotal = document.getElementById('min-total');
  if (minTotal) minTotal.addEventListener('input', applyFilters);
  
  const maxTotal = document.getElementById('max-total');
  if (maxTotal) maxTotal.addEventListener('input', applyFilters);
  
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const inputs = ['search-input', 'status-filter', 'platforms-filter', 'from-date', 'to-date', 'csr-filter', 'customer-filter', 'min-total', 'max-total'];
      inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      if (statusFilter) statusFilter.value = 'all';
      if (platformsFilter) platformsFilter.value = 'all';
      applyFilters();
    });
  }
  
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
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
  }
  
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', loadOrders);
  
  const prevPage = document.getElementById('prev-page');
  if (prevPage) {
    prevPage.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderOrders();
        updatePagination();
      }
    });
  }
  
  const nextPage = document.getElementById('next-page');
  if (nextPage) {
    nextPage.addEventListener('click', () => {
      const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        renderOrders();
        updatePagination();
      }
    });
  }
  
  const rowsPerPage = document.getElementById('rows-per-page');
  if (rowsPerPage) {
    rowsPerPage.addEventListener('change', (e) => {
      ordersPerPage = parseInt(e.target.value);
      currentPage = 1;
      renderOrders();
      updatePagination();
    });
  }
  
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  
  const navDashboard = document.getElementById('nav-dashboard');
  if (navDashboard) navDashboard.addEventListener('click', (e) => { e.preventDefault(); showDashboard(); });
  
  const navCreateOrder = document.getElementById('nav-create-order');
  if (navCreateOrder) navCreateOrder.addEventListener('click', (e) => { e.preventDefault(); showCreateOrder(); });
  
  const navRTO = document.getElementById('nav-rto');
  if (navRTO) navRTO.addEventListener('click', (e) => { e.preventDefault(); showRTO(); });
  
  const backToOrders = document.getElementById('back-to-orders');
  if (backToOrders) backToOrders.addEventListener('click', showDashboard);
  
  const createOrderBtn = document.getElementById('create-order-btn');
  if (createOrderBtn) {
    createOrderBtn.addEventListener('click', () => {
      const customerName = document.getElementById('customer_full_name')?.value;
      const customerPhone = document.getElementById('customer_mobile')?.value;
      const countryCode = document.getElementById('country_code')?.value;
      const deliveryAddress = document.getElementById('delivery_address')?.value;
      const platform = document.getElementById('Platform')?.value;
      const csrName = document.getElementById('csr_name')?.value;
      const notes = document.getElementById('customer_notes')?.value;
      
      if (!customerName || !customerPhone || !deliveryAddress || !platform || !csrName) {
        const resultDiv = document.getElementById('create-order-result');
        if (resultDiv) {
          resultDiv.innerHTML = '<span style="color: red;">✗ Please fill all required fields</span>';
          resultDiv.className = 'result-message error';
        }
        return;
      }
      
      if (cart.length === 0) {
        const resultDiv = document.getElementById('create-order-result');
        if (resultDiv) {
          resultDiv.innerHTML = '<span style="color: red;">✗ Please add items to cart</span>';
          resultDiv.className = 'result-message error';
        }
        return;
      }
      
      const orderData = {
        order_number: `ORD-${Date.now()}`,
        customer_name: customerName,
        customer_phone: countryCode + customerPhone,
        delivery_address: deliveryAddress,
        platform: platform,
        csr: csrName,
        notes: notes,
        products: cart,
        total_price: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + 15,
        status: 'pending'
      };
      
      createOrder(orderData);
    });
  }
  
  const clearOrderBtn = document.getElementById('clear-order-btn');
  if (clearOrderBtn) {
    clearOrderBtn.addEventListener('click', () => {
      cart = [];
      updateCartDisplay();
    });
  }
  
  const productSearch = document.getElementById('product-search-input');
  if (productSearch) {
    let timeout;
    productSearch.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => loadProducts(e.target.value), 300);
    });
  }
  
  // Modal close
  const modalClose = document.querySelector('#order-modal .close');
  if (modalClose) {
    modalClose.addEventListener('click', () => {
      document.getElementById('order-modal').style.display = 'none';
    });
  }
  
  window.addEventListener('click', (e) => {
    const modal = document.getElementById('order-modal');
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
  
  // Sidebar toggle
  const sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('collapsed');
    });
  }
  
  // Mobile menu
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('active');
    });
  }
  
  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      const icon = themeToggle.querySelector('i');
      if (document.body.classList.contains('dark-theme')) {
        icon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
      } else {
        icon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
      }
    });
  }
  
  // Load theme preference
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
    const themeToggleIcon = document.querySelector('#theme-toggle i');
    if (themeToggleIcon) themeToggleIcon.className = 'fas fa-sun';
  }
});
