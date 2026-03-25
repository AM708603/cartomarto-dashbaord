document.addEventListener('DOMContentLoaded', function() {

  // ── CONFIG ──────────────────────────────────────────────────────────────
  // FIX: single source of truth, no trailing slash
  const API_URL = 'https://cartomarto-api.borntow2.workers.dev';

  // ── DOM REFS ─────────────────────────────────────────────────────────────
  const ordersBody          = document.getElementById('orders-body');
  const searchInput         = document.getElementById('search-input');
  const statusFilter        = document.getElementById('status-filter');
  const inventoryFilter     = document.getElementById('inventory-filter');
  const platformFilter      = document.getElementById('platforms-filter');
  const courierStatusFilter = document.getElementById('courier-status-filter');
  const courierFilter       = document.getElementById('courier-filter');
  const minTotal            = document.getElementById('min-total');
  const maxTotal            = document.getElementById('max-total');
  const csrFilter           = document.getElementById('csr-filter');
  const customerFilter      = document.getElementById('customer-filter');
  const fromDateEl          = document.getElementById('from-date');
  const toDateEl            = document.getElementById('to-date');
  const refreshBtn          = document.getElementById('refresh-btn');
  const exportBtn           = document.getElementById('export-btn');
  const resetBtn            = document.getElementById('reset-btn');
  const prevPageBtn         = document.getElementById('prev-page');
  const nextPageBtn         = document.getElementById('next-page');
  const modal               = document.getElementById('order-modal');
  const modalClose          = document.querySelector('.modal .close');
  const orderDetails        = document.getElementById('order-details');

  // Create Order page
  const productGrid       = document.getElementById('product-grid');
  const productSearchInput= document.getElementById('product-search-input');
  const productsEmpty     = document.getElementById('products-empty');
  const productsCount     = document.getElementById('products-count');
  const navCreateOrder    = document.getElementById('nav-create-order');
  const ordersCard        = document.getElementById('orders-card');
  const createOrderPage   = document.getElementById('create-order-page');
  const orderItemsEl      = document.getElementById('order-items');
  const orderEmpty        = document.getElementById('order-empty');
  const createOrderBtn    = document.getElementById('create-order-btn');
  const clearOrderBtn     = document.getElementById('clear-order-btn');
  const createOrderResult = document.getElementById('create-order-result');
  const backToOrdersBtn   = document.getElementById('back-to-orders');

  // Customer inputs
  const cFullName       = document.getElementById('customer_full_name');
  const cMobile         = document.getElementById('customer_mobile');
  const cEmirates       = document.getElementById('customer_emirates');
  const dAddress        = document.getElementById('delivery_address');
  const cCSR            = document.getElementById('csr_name');
  const cPlatform       = document.getElementById('Platform');
  const cNotes          = document.getElementById('customer_notes');
  const cInventoryNotes = document.getElementById('inventory_notes');

  // ── STATE ─────────────────────────────────────────────────────────────────
  let allOrders      = [];
  let filteredOrders = [];
  let currentPage    = 1;
  let ordersPerPage  = 10;
  let sortColumn     = 'created_at';
  let sortDirection  = 'desc';
  let productsCache  = [];
  let currentAbort   = null;

  // ── STATUS CONFIG ─────────────────────────────────────────────────────────
  const statusConfig = {
    fulfillment: {
      fulfilled:   { text: 'Fulfilled',   class: 'fulfilled' },
      unfulfilled: { text: 'Unfulfilled', class: 'pending'   },
      partial:     { text: 'Partial',     class: 'partial'   },
      cancelled:   { text: 'Cancelled',   class: 'cancelled' },
      returned:    { text: 'Returned',    class: 'returned'  }
    },
    courier: {
      'delivered':           { text: 'Delivered',        class: 'delivered'       },
      'out for delivery':    { text: 'Out for Delivery',  class: 'out-for-delivery'},
      'in transit':          { text: 'In Transit',        class: 'in-transit'      },
      'at hub':              { text: 'At Hub',            class: 'info'            },
      'at facility':         { text: 'At Facility',       class: 'info'            },
      'no response':         { text: 'No Response',       class: 'warning'         },
      'returned to hub':     { text: 'Returned',          class: 'returned'        },
      'created':             { text: 'Created',           class: 'info'            },
      'service unavailable': { text: 'Service Down',      class: 'failed'          },
      'tracking unavailable':{ text: 'No Tracking',       class: 'info'            },
      'unknown courier':     { text: 'Unknown Courier',   class: 'info'            },
      'pending pickup':      { text: 'Pending Pickup',    class: 'info'            },
      'submitted':           { text: 'Submitted',         class: 'info'            }
    },
    inventory: {
      pending:           { text: 'Pending',  class: 'pending'  },
      pick:              { text: 'Pick',     class: 'info'     },
      pack:              { text: 'Pack',     class: 'partial'  },
      returned_received: { text: 'Returned', class: 'returned' }
    }
  };

  // ── AUTH (local token validation — no /api/auth/check needed) ─────────────
  function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return false; }
    try {
      const payload = JSON.parse(atob(token));
      if (!payload.email || !payload.exp || Date.now() > payload.exp) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
        return false;
      }
      return true;
    } catch(e) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login.html';
      return false;
    }
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────
  function isValidDate(d) {
    if (!d) return false;
    const dt = (d instanceof Date) ? d : new Date(d);
    return !Number.isNaN(dt.getTime());
  }
  function formatDateTime(dateString) {
    try {
      if (!isValidDate(dateString)) return 'N/A';
      return new Date(dateString).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch { return 'N/A'; }
  }
  function formatDate(dateString) {
    try {
      if (!isValidDate(dateString)) return 'N/A';
      return new Date(dateString).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
    } catch { return 'N/A'; }
  }
  function formatPrice(price, currency) {
    try {
      const symbols = { AED:'د.إ', USD:'$', EUR:'€', GBP:'£' };
      if (symbols[currency]) return `${symbols[currency]}${parseFloat(price||0).toFixed(2)}`;
      return new Intl.NumberFormat('en-US',{style:'currency',currency:currency||'AED',minimumFractionDigits:2}).format(parseFloat(price||0));
    } catch { return `${currency||'AED'} ${parseFloat(price||0).toFixed(2)}`; }
  }
  function escapeHtml(str) {
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function getCustomerDisplay(order) {
    if (!order) return 'Guest';
    let name = order.customer_name || 'Guest';
    let phone = order.customer_phone || '';
    if (phone && phone !== 'N/A') return `${name} (${phone})`;
    return name;
  }
  function createStatusBadge(status, type='fulfillment') {
    if (!status) status = 'pending';
    const clean = String(status).toLowerCase();
    const cfg = statusConfig[type] || statusConfig.fulfillment;
    const info = cfg[clean] || Object.entries(cfg).find(([k]) => clean.includes(k))?.[1] || { text: status, class: 'pending' };
    return `<span class="status-badge ${info.class}">${info.text}</span>`;
  }
  function generateTrackingLinks(order) {
    if (!order.courier || !order.tracking_id || order.tracking_id === 'N/A') return 'N/A';
    if (order.courier.toLowerCase().includes('eco'))
      return `<a href="https://app.ecofreight.ae/tracking/${order.tracking_id}" target="_blank">${order.tracking_id}</a>`;
    if (order.courier.toLowerCase().includes('panda'))
      return `<a href="https://deliverypanda.me/track/?awb=${order.tracking_id}" target="_blank">${order.tracking_id}</a>`;
    return order.tracking_id;
  }
  function parseProducts(raw) {
    if (!raw) return [];
    return raw.split(', ').map(item => {
      const match = item.match(/(\d+)x (.*)/);
      return match ? { quantity: parseInt(match[1]), name: match[2].trim() } : null;
    }).filter(Boolean);
  }

  // ── ANALYTICS ────────────────────────────────────────────────────────────
  function updateAnalytics() {
    try {
      const statCards = document.querySelectorAll('.stat-card');
      function setCard(card, value, trendPct) {
        const valueEl = card.querySelector('.stat-value');
        const trendEl = card.querySelector('.stat-trend');
        const spanEl  = trendEl?.querySelector('span');
        const iconEl  = trendEl?.querySelector('i');
        if (valueEl) valueEl.textContent = value;
        if (!trendEl || !spanEl) return;
        const abs = Math.abs(trendPct);
        if (trendPct === 0) {
          trendEl.className='stat-trend neutral'; if(iconEl) iconEl.className='fas fa-minus'; spanEl.textContent='0.0%';
        } else if (!isFinite(trendPct)||isNaN(trendPct)) {
          trendEl.style.display='none';
        } else if (trendPct > 0) {
          trendEl.className='stat-trend positive'; if(iconEl) iconEl.className='fas fa-arrow-up'; spanEl.textContent='+'+abs.toFixed(1)+'%';
        } else {
          trendEl.className='stat-trend negative'; if(iconEl) iconEl.className='fas fa-arrow-down'; spanEl.textContent='-'+abs.toFixed(1)+'%';
        }
        trendEl.style.display='';
      }
      if (!filteredOrders.length) {
        statCards.forEach(card => setCard(card, card.dataset.statType?.includes('revenue')||card.dataset.statType?.includes('avg') ? 'د.إ0.00':'0', 0));
        return;
      }
      const ordersWithDate = filteredOrders.filter(o => isValidDate(o.created_at));
      let periodStart, periodEnd, prevStart, prevEnd;
      if (ordersWithDate.length) {
        const ts = ordersWithDate.map(o => new Date(o.created_at).getTime());
        periodEnd=new Date(Math.max(...ts)); periodStart=new Date(Math.min(...ts));
        const span=periodEnd-periodStart||1; prevEnd=new Date(periodStart-1); prevStart=new Date(periodStart-span);
      } else { periodStart=new Date(0); periodEnd=new Date(); prevStart=new Date(0); prevEnd=new Date(0); }
      const currency=filteredOrders[0]?.currency||'AED';
      const totalOrders=filteredOrders.length, fulfilled=filteredOrders.filter(o=>o.status==='fulfilled').length;
      const pending=totalOrders-fulfilled, totalValue=filteredOrders.reduce((s,o)=>s+(parseFloat(o.total_price)||0),0);
      const avgOrder=totalOrders?totalValue/totalOrders:0;
      const prevOrders=allOrders.filter(o=>{ if(!isValidDate(o.created_at)) return false; const t=new Date(o.created_at).getTime(); return t>=prevStart&&t<=prevEnd; });
      const prevTotal=prevOrders.length, prevFulfilled=prevOrders.filter(o=>o.status==='fulfilled').length;
      const prevRevenue=prevOrders.reduce((s,o)=>s+(parseFloat(o.total_price)||0),0), prevAvg=prevTotal?prevRevenue/prevTotal:0;
      function pctChange(cur,prev) { if(prev===0&&cur===0) return 0; if(prev===0) return Infinity; return((cur-prev)/prev)*100; }
      statCards.forEach(card => {
        switch(card.dataset.statType) {
          case 'total-orders': setCard(card,totalOrders,pctChange(totalOrders,prevTotal)); break;
          case 'fulfilled':    setCard(card,fulfilled,pctChange(fulfilled,prevFulfilled)); break;
          case 'pending':      setCard(card,pending,-pctChange(pending,prevTotal-prevFulfilled)); break;
          case 'revenue':      setCard(card,formatPrice(totalValue,currency),pctChange(totalValue,prevRevenue)); break;
          case 'avg-order':    setCard(card,formatPrice(avgOrder,currency),pctChange(avgOrder,prevAvg)); break;
        }
      });
    } catch(e) { console.error('Analytics error:',e); }
  }

  // ── FETCH ORDERS (from Google Sheet) ─────────────────────────────────────
  async function fetchOrders() {
    try {
      showLoading();
      const response = await fetch('https://script.google.com/macros/s/AKfycby2zXZrwBAfxqKOl-vpYjUU3rtERBCGDk6tzz5_-Cawdn9J43vWJEkYcK6P7qs_hshy/exec');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const ct = response.headers.get('content-type');
      if (!ct || !ct.includes('application/json')) throw new Error(`Invalid response format`);
      const rawOrders = await response.json();

      allOrders = rawOrders.map(order => {
        const rawTotal = (order['TOTAL']!==undefined&&order['TOTAL']!==null) ? String(order['TOTAL']).trim() : '0 AED';
        const totalParts = rawTotal.split(/\s+/);
        const total_price = parseFloat(totalParts[0].replace(/[^0-9.\-]/g,''))||0;
        const currency = totalParts[1]||'AED';
        let customer_name='', customer_phone='', delivery_address='';
        const customerLines = order['CUSTOMER'] ? String(order['CUSTOMER']).split('\n') : [];
        customerLines.forEach(line => {
          if (line.startsWith('Full Name: '))  customer_name    = line.replace('Full Name: ','').trim();
          else if (line.startsWith('Phone: '))  customer_phone   = line.replace('Phone: ','').trim();
          else if (line.startsWith('Address: ')) delivery_address = line.replace('Address: ','').trim();
        });
        const products_raw = (order['PRODUCTS ']!==undefined&&order['PRODUCTS ']!==null) ? String(order['PRODUCTS ']).trim() : (order['PRODUCTS']!==undefined&&order['PRODUCTS']!==null ? String(order['PRODUCTS']).trim() : '');
        const rawDate = order['DATE']||order['Created At']||order['created_at']||null;
        const created_at = isValidDate(rawDate) ? rawDate : null;
        return {
          id:               order['ORDER ID'] ? String(order['ORDER ID']).replace('TSD','') : 'N/A',
          name:             order['ORDER ID']||'N/A',
          created_at,
          customer_name:    customer_name||'Guest',
          customer_phone:   customer_phone||'N/A',
          delivery_address: delivery_address||'N/A',
          platform:         order['PLATFORM']||'N/A',
          total_price, currency,
          status:           order['FULFILL STATUS']||'pending',
          inventory_status: order['INVENTORY']||'pending',
          courier:          order['COURIER']||'N/A',
          tracking_id:      order['TRACKING ID']||'N/A',
          courier_status:   order['STATUS']||'N/A',
          csr:              order['CSR']||order['csr']||order['CSR Name']||'N/A',
          note:             order['ADDITIONAL NOTES']||'N/A',
          products_raw
        };
      }).sort((a,b) => {
        const ta=isValidDate(a.created_at)?new Date(a.created_at).getTime():0;
        const tb=isValidDate(b.created_at)?new Date(b.created_at).getTime():0;
        return tb-ta;
      });

      applyFilters();
      updateLastUpdated();
      initializeDashboardCharts();
    } catch (error) {
      showError(error);
    } finally {
      hideLoading();
    }
  }

  function showLoading() {
    ordersBody.innerHTML = `<tr class="loading-row"><td colspan="11" class="loading-cell"><div class="loading-content"><div class="spinner"></div><p>Loading orders...</p></div></td></tr>`;
  }
  function showError(error) {
    ordersBody.innerHTML = `<tr class="error-row"><td colspan="11">Failed to load orders: ${error.message} <button class="btn retry-btn" id="retry-btn"><i class="fas fa-sync-alt"></i> Retry</button></td></tr>`;
  }
  function hideLoading() { const lr=ordersBody.querySelector('.loading-row'); if(lr) lr.remove(); }
  function updateLastUpdated() { const el=document.getElementById('last-updated'); if(el) el.textContent=new Date().toLocaleTimeString(); }

  // ── FILTERS ───────────────────────────────────────────────────────────────
  function applyFilters() {
    let filtered = [...allOrders];
    const searchTerm    = searchInput?.value.toLowerCase()||'';
    const statusValue   = statusFilter?.value||'all';
    const invValue      = inventoryFilter?.value||'all';
    const courierStVal  = courierStatusFilter?.value||'all';
    const courierVal    = courierFilter?.value||'all';
    const minTotalVal   = parseFloat(minTotal?.value)||0;
    const maxTotalVal   = parseFloat(maxTotal?.value)||Infinity;
    const csrVal        = csrFilter?.value.toLowerCase()||'';
    const customerVal   = customerFilter?.value.toLowerCase()||'';
    const platformVal   = platformFilter?.value||'all';

    if (searchTerm) filtered=filtered.filter(o => String(o.id||'').includes(searchTerm)||(o.name&&o.name.toLowerCase().includes(searchTerm))||(o.customer_name&&o.customer_name.toLowerCase().includes(searchTerm))||(o.tracking_id&&o.tracking_id.toLowerCase().includes(searchTerm))||(o.platform&&o.platform.toLowerCase().includes(searchTerm)));
    if (statusValue!=='all') filtered=filtered.filter(o=>o.status&&o.status.toLowerCase()===statusValue.toLowerCase());
    if (invValue!=='all')    filtered=filtered.filter(o=>o.inventory_status&&o.inventory_status.toLowerCase()===invValue.toLowerCase());
    if (courierStVal!=='all') filtered=filtered.filter(o=>o.courier_status&&o.courier_status.toLowerCase()===courierStVal.toLowerCase());
    if (courierVal!=='all')  filtered=filtered.filter(o=>o.courier&&o.courier.toLowerCase().includes(courierVal.toLowerCase()));
    if (minTotalVal||maxTotalVal!==Infinity) filtered=filtered.filter(o=>{ const t=parseFloat(o.total_price)||0; return t>=minTotalVal&&t<=maxTotalVal; });
    if (csrVal) filtered=filtered.filter(o=>(o.csr||o.CSR||o['CSR Name']||'').toString().toLowerCase().includes(csrVal));
    if (customerVal) filtered=filtered.filter(o=>String(o.id).toLowerCase().includes(customerVal)||(o.customer_name&&o.customer_name.toLowerCase().includes(customerVal))||(o.customer_phone&&o.customer_phone.toLowerCase().includes(customerVal))||(o.delivery_address&&o.delivery_address.toLowerCase().includes(customerVal))||(o.tracking_id&&String(o.tracking_id).toLowerCase().includes(customerVal)));
    if (platformVal!=='all') filtered=filtered.filter(o=>o.platform&&o.platform.toLowerCase()===platformVal.toLowerCase());
    if (fromDateEl?.value||toDateEl?.value) {
      const from=fromDateEl.value?new Date(fromDateEl.value+'T00:00:00'):new Date('1970-01-01');
      const to=toDateEl.value?new Date(toDateEl.value+'T23:59:59'):new Date();
      filtered=filtered.filter(o=>{ try{ const d=new Date(o.created_at); return d>=from&&d<=to; }catch{return false;} });
    }
    filteredOrders=filtered;
    sortOrders();
    renderOrders(getPagedOrders());
    updateAnalytics();
    updatePagination();
  }

  function sortOrders() {
    filteredOrders.sort((a,b) => {
      let va=a[sortColumn]||'', vb=b[sortColumn]||'';
      if(sortColumn==='total'){ va=parseFloat(va)||0; vb=parseFloat(vb)||0; }
      else if(sortColumn==='date'){ va=new Date(va).getTime(); vb=new Date(vb).getTime(); }
      else { va=String(va).toLowerCase(); vb=String(vb).toLowerCase(); }
      return sortDirection==='asc'?(va>vb?1:-1):(va<vb?1:-1);
    });
  }
  function getPagedOrders() { const s=(currentPage-1)*ordersPerPage; return filteredOrders.slice(s,s+ordersPerPage); }

  // ── PAGINATION ────────────────────────────────────────────────────────────
  function updatePagination() {
    const totalPages = Math.ceil(filteredOrders.length/ordersPerPage);
    const pn=document.getElementById('pagination-numbers');
    const ps=document.getElementById('pagination-start');
    const pe=document.getElementById('pagination-end');
    const pt=document.getElementById('pagination-total');
    if(ps) ps.textContent=filteredOrders.length?((currentPage-1)*ordersPerPage+1):0;
    if(pe) pe.textContent=Math.min(currentPage*ordersPerPage,filteredOrders.length);
    if(pt) pt.textContent=filteredOrders.length;
    const pageRange=5;
    let startP=Math.max(1,currentPage-Math.floor(pageRange/2));
    let endP=Math.min(totalPages,startP+pageRange-1);
    if(endP-startP+1<pageRange) startP=Math.max(1,endP-pageRange+1);
    let html='';
    if(startP>1){ html+=`<button class="page-number${1===currentPage?' active':''}" data-page="1">1</button>`; if(startP>2) html+=`<span class="pagination-ellipsis">...</span>`; }
    for(let i=startP;i<=endP;i++) html+=`<button class="page-number${i===currentPage?' active':''}" data-page="${i}">${i}</button>`;
    if(endP<totalPages){ if(endP<totalPages-1) html+=`<span class="pagination-ellipsis">...</span>`; html+=`<button class="page-number${totalPages===currentPage?' active':''}" data-page="${totalPages}">${totalPages}</button>`; }
    if(pn){ pn.innerHTML=html; pn.style.display='flex'; pn.style.flexDirection='row'; pn.style.alignItems='center'; pn.style.gap='6px'; }
    if(prevPageBtn) prevPageBtn.disabled=currentPage===1;
    if(nextPageBtn) nextPageBtn.disabled=currentPage===totalPages||totalPages===0;
  }

  // ── RENDER ORDERS ─────────────────────────────────────────────────────────
  function renderOrders(orders) {
    if (!ordersBody) return;
    if (!orders?.length) {
      ordersBody.innerHTML=`<tr><td colspan="11" class="no-orders"><i class="fas fa-box-open"></i> No orders found</td></tr>`;
      return;
    }
    ordersBody.innerHTML = orders.map(order => `
      <tr data-order-id="${order.id}">
        <td>#${order.name||order.id||'N/A'}</td>
        <td>${formatDateTime(order.created_at)}</td>
        <td>${getCustomerDisplay(order)}</td>
        <td>${order.platform||'N/A'}</td>
        <td>${formatPrice(order.total_price,order.currency)}</td>
        <td>${createStatusBadge(order.status,'fulfillment')}</td>
        <td>${createStatusBadge(order.inventory_status||'pending','inventory')}</td>
        <td>${order.courier||'N/A'}</td>
        <td>${generateTrackingLinks(order)}</td>
        <td class="courier-status">${createStatusBadge(order.courier_status,'courier')}</td>
        <td>${order.csr||'N/A'}</td>
        <td><button class="btn-icon view-details" data-order-id="${order.id}" title="View Details"><i class="fas fa-eye"></i></button></td>
      </tr>`).join('');
  }

  // ── EXPORT CSV ────────────────────────────────────────────────────────────
  function exportToCSV() {
    const headers=['Order ID','Date','Customer','Platform','Total','Fulfillment','Inventory','Courier','Tracking ID','Courier Status','CSR','Notes','Products'];
    const csvEscape=v=>{ const s=String(v??'').trim(); return /[,"\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; };
    const rows=filteredOrders.map(o=>[
      o.name||o.id||'N/A', formatDate(o.created_at), getCustomerDisplay(o), o.platform||'N/A',
      formatPrice(o.total_price,o.currency), o.status||'pending', o.inventory_status||'pending',
      o.courier||'N/A', o.tracking_id||'N/A', o.courier_status||'N/A', o.csr||'N/A', o.note||'N/A',
      o.products_raw?parseProducts(o.products_raw).map(p=>`${p.quantity}x ${p.name}`).join(', '):'N/A'
    ].map(csvEscape));
    const csv=[[...headers].map(csvEscape),...rows].map(r=>r.join(',')).join('\r\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`orders_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  // ── PRODUCTS (from Cloudflare Worker) ────────────────────────────────────
  async function fetchAndRenderProducts(q='') {
    try {
      if (currentAbort) currentAbort.abort();
      currentAbort = new AbortController();
      if (!productGrid) return;
      productGrid.innerHTML=`<div class="loading-spinner">Loading products...</div>`;
      if (productsEmpty) productsEmpty.style.display='none';
      const url = new URL(`${API_URL}/api/products`);
      url.searchParams.set('query',q); url.searchParams.set('limit','120');
      const token=localStorage.getItem('token')||'';
      const res=await fetch(url.toString(),{ headers:{'Authorization':`Bearer ${token}`}, signal:currentAbort.signal });
      if (!res.ok) {
        if (res.status===401||res.status===403) { localStorage.removeItem('token'); window.location.href='/login.html'; return; }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data=await res.json();
      productsCache=data.products||[];
      renderProductGrid(productsCache);
      if (productsCount) productsCount.textContent=(data.total!=null?data.total:productsCache.length)+' products';
    } catch(err) {
      if (err.name==='AbortError') return;
      console.error('Products load failed:',err);
      if (productGrid) productGrid.innerHTML=`<div class="error-message">Failed to load products. ${err.message||err} <button class="btn retry-btn" id="retry-products-btn">Retry</button></div>`;
    }
  }

  function renderProductGrid(products) {
    if (!productGrid) return;
    if (!products||!products.length) { productGrid.innerHTML=''; if(productsEmpty) productsEmpty.style.display='block'; if(productsCount) productsCount.textContent='0 products'; return; }
    let html='', totalVariants=0;
    products.forEach(p => {
      const tags=Array.isArray(p.tags)?p.tags:(typeof p.tags==='string'?p.tags.split(',').map(t=>t.trim()):[]);
      if (!p.variants||!p.variants.length) return;
      p.variants.forEach(v => {
        const variantId=v.id??v.variant_id??v.variantId??null;
        const img=v.image||p.image||'https://via.placeholder.com/300x300?text=No+Image';
        const priceTxt=v.price?formatPrice(v.price,'AED'):'-';
        const title=p.title+(v.title&&v.title!=='Default Title'?' - '+v.title:'');
        totalVariants++;
        html+=`<div class="product-card" data-product-id="${p.id}" data-variant-id="${variantId!=null?String(variantId):''}" data-title="${escapeHtml(title)}" data-price="${v.price||0}" data-tags="${escapeHtml((tags||[]).join(','))}" data-sku="${escapeHtml(v.sku||'')}" data-handle="${escapeHtml(p.handle||'')}">
          <div class="product-image"><img src="${img}" alt="${escapeHtml(title)}"></div>
          <div class="product-info">
            <div class="product-title">${escapeHtml(title)}</div>
            <div class="product-meta">Inventory: ${v.inventory_quantity??'N/A'} • Shipping: ${tags.includes('Free Delivery')?'Free':'د.إ15'}</div>
            <div class="product-price">${priceTxt}</div>
          </div></div>`;
      });
    });
    productGrid.innerHTML=html;
    if (productsCount) productsCount.textContent=totalVariants+' variants';
  }

  // ── CREATE ORDER ─────────────────────────────────────────────────────────
  function setupCreateOrder() {
    if (!navCreateOrder||!createOrderPage||!productGrid) return;
    let selectedItems=[];
    setupNotesDropdown();

    function resetCart() {
      selectedItems=[];
      const disc=document.getElementById('discount-input'); if(disc) disc.value=0;
      renderOrderItems(); if(createOrderResult) createOrderResult.textContent='';
    }
    function showCreateOrderPage() {
      ordersCard.style.display='none'; createOrderPage.style.display='block';
      resetCart();
      if (productsCache.length) renderProductGrid(productsCache); else fetchAndRenderProducts('');
    }
    document.addEventListener('resetCreateOrder', resetCart);
    function hideCreateOrderPage() { createOrderPage.style.display='none'; ordersCard.style.display='block'; }

    navCreateOrder.addEventListener('click', e=>{ e.preventDefault(); showCreateOrderPage(); });
    backToOrdersBtn.addEventListener('click', e=>{ e.preventDefault(); hideCreateOrderPage(); });

    // Product search
    productSearchInput.addEventListener('input', (e) => {
      clearTimeout(productSearchInput.dataset.debounce);
      productSearchInput.dataset.debounce=setTimeout(()=>{
        let raw=(e.target.value||'').trim();
        if (!raw){ renderProductGrid(productsCache); return; }
        const clean=s=>String(s||'').normalize('NFKD').replace(/[^\w\s]/g,' ').replace(/\s+/g,' ').toLowerCase().trim();
        const sizeMap={s:'small',m:'medium',l:'large',xl:'xl',xxl:'xxl',xs:'xs'};
        const words=clean(raw).split(' ').filter(Boolean);
        const matched=[];
        productsCache.forEach(product=>{
          const pTitle=clean(product.title);
          (product.variants||[]).forEach(v=>{
            const opt1=clean(v.option1), opt2=clean(v.option2);
            const searchable=[pTitle,clean(v.title),opt1,opt2,opt1?`size_${opt1}`:'',opt1&&sizeMap[opt1]?`size_${sizeMap[opt1]}`:'']. join(' ');
            const ok=words.every(w=>searchable.includes(w)||(w in sizeMap&&searchable.includes(sizeMap[w]))||searchable.includes(`size_${w}`));
            if(ok) matched.push({product,variant:v});
          });
        });
        const grouped={};
        matched.forEach(m=>{ const id=m.product.id||m.product.handle; if(!grouped[id]) grouped[id]={...m.product,variants:[]}; grouped[id].variants.push(m.variant); });
        renderProductGrid(Object.values(grouped));
        if(productsCount) productsCount.textContent=matched.length+' variant'+(matched.length!==1?'s':'')+' found';
      },200);
    });

    productGrid.addEventListener('click', e=>{
      const card=e.target.closest('.product-card'); if(!card) return;
      const variantIdRaw=card.getAttribute('data-variant-id');
      const variantId=Number(variantIdRaw);
      if(!Number.isFinite(variantId)||variantId<=0) {
        if(createOrderResult){ createOrderResult.style.color='#d44'; createOrderResult.textContent='This product variant is not orderable.'; } return;
      }
      const title=card.getAttribute('data-title'), price=parseFloat(card.getAttribute('data-price')||0);
      const tags=(card.getAttribute('data-tags')||'').split(',').map(t=>t.trim()).filter(Boolean);
      addOrIncreaseSelected({productId:Number(card.getAttribute('data-product-id')),variantId,title,price,tags});
    });

    function addOrIncreaseSelected(item) {
      let found=selectedItems.find(si=>si.variantId===item.variantId);
      if(found) found.qty=Math.min((found.qty||1)+1,99); else selectedItems.push({...item,qty:1});
      renderOrderItems();
    }

    const discountEl=document.getElementById('discount-input');
    if(discountEl) discountEl.addEventListener('input',()=>renderOrderItems());

    function calculateOrderTotals() {
      const subtotal=selectedItems.reduce((s,i)=>s+(i.price*i.qty),0);
      const hasFreeDelivery=selectedItems.some(i=>i.tags?.includes('Free Delivery'));
      const shippingFee=hasFreeDelivery?0:15;
      const vat=Math.ceil(subtotal/5)*5-subtotal;
      let discount=discountEl?parseFloat(discountEl.value)||0:0;
      if(discount<0) discount=0;
      if(discount>subtotal+shippingFee+vat){ discount=subtotal+shippingFee+vat; if(discountEl) discountEl.value=discount.toFixed(2); }
      return {subtotal,shippingFee,vat,discount,grandTotal:Math.max(0,subtotal+shippingFee+vat-discount),hasFreeDelivery};
    }

    function renderOrderItems() {
      if (!orderItemsEl) return;
      if (!selectedItems.length) {
        orderItemsEl.innerHTML=''; orderEmpty.style.display='block';
        ['order-subtotal','order-shipping','order-vat','order-grand-total'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='د.إ0.00';});
        return;
      }
      orderEmpty.style.display='none';
      const {subtotal,shippingFee,vat,discount,grandTotal,hasFreeDelivery}=calculateOrderTotals();
      document.getElementById('order-grand-total').textContent=formatPrice(grandTotal,'AED');
      document.getElementById('order-subtotal').textContent=formatPrice(subtotal,'AED');
      document.getElementById('order-shipping').textContent=hasFreeDelivery?'Free':formatPrice(shippingFee,'AED');
      document.getElementById('order-vat').textContent=formatPrice(vat,'AED');
      orderItemsEl.innerHTML=selectedItems.map((it,idx)=>`
        <div class="order-item" data-idx="${idx}">
          <div class="order-item-details">
            <div class="order-item-title">${escapeHtml(it.title)}</div>
            <div class="order-item-meta">Variant: ${it.variantId} • ${formatPrice(it.price,'AED')} • Shipping: ${it.tags?.includes('Free Delivery')?'Free':'د.إ15'}</div>
          </div>
          <div class="order-item-actions">
            <input type="number" min="1" max="99" class="order-qty" value="${it.qty}">
            <button class="btn-icon remove-item"><i class="fas fa-trash"></i></button>
          </div>
        </div>`).join('');
      orderItemsEl.querySelectorAll('.order-item').forEach(div=>{
        const idx=Number(div.getAttribute('data-idx'));
        div.querySelector('.order-qty').addEventListener('change',e=>{ selectedItems[idx].qty=Math.max(1,Math.min(99,parseInt(e.target.value)||1)); renderOrderItems(); });
        div.querySelector('.remove-item').addEventListener('click',()=>{ selectedItems.splice(idx,1); renderOrderItems(); });
      });
    }

    clearOrderBtn.addEventListener('click', e=>{
      e.preventDefault(); selectedItems=[]; if(discountEl) discountEl.value=0; renderOrderItems(); if(createOrderResult) createOrderResult.textContent='';
      [cFullName,cMobile,cEmirates,cPlatform,cCSR,dAddress,cNotes,cInventoryNotes].forEach(el=>{if(el) el.value='';});
      if(cNotes) cNotes.classList.remove('has-content');
      const cc=document.getElementById('country_code'); if(cc){ cc.value='+971'; cc.dispatchEvent(new Event('change')); }
    });

    // ── CREATE ORDER: POST to Cloudflare Worker ──
    createOrderBtn.addEventListener('click', async e=>{
      e.preventDefault(); e.stopImmediatePropagation();
      if (createOrderBtn.disabled||createOrderBtn.dataset.submitting==='true') return;
      createOrderBtn.dataset.submitting='true';

      if (!selectedItems.length) { createOrderResult.style.color='#d44'; createOrderResult.textContent='Please add at least one item.'; createOrderBtn.dataset.submitting='false'; return; }

      const requiredFields=[
        {el:cFullName,label:'Full Name'},{el:cMobile,label:'Mobile Number'},
        {el:cEmirates,label:'Emirate'},{el:cPlatform,label:'Platform'},
        {el:cCSR,label:'CSR Name'},{el:dAddress,label:'Delivery Address'}
      ];
      const missing=requiredFields.find(f=>!f.el||!f.el.value.trim());
      if (missing) { createOrderResult.style.color='#d44'; createOrderResult.textContent=`⚠️ Please fill in the "${missing.label}" field.`; if(missing.el) missing.el.focus(); createOrderBtn.dataset.submitting='false'; return; }

      const originalHtml=createOrderBtn.innerHTML;
      createOrderBtn.innerHTML='<span class="loading-spinner"></span>Processing...';
      createOrderBtn.disabled=true;
      if(createOrderResult){ createOrderResult.style.color='#333'; createOrderResult.textContent='Creating order...'; }

      const countryCode=document.getElementById('country_code')?.value?.trim()||'+971';
      const localPhone=cMobile.value.trim().replace(/^0+/,'');
      const customerPhone=countryCode+localPhone;
      const fullName=cFullName.value.trim();
      let firstName=fullName, lastName=' ';
      if(fullName.includes(' ')){ const parts=fullName.split(' '); firstName=parts[0]; lastName=parts.slice(1).join(' '); }
      const {subtotal,shippingFee,vat,discount,grandTotal,hasFreeDelivery}=calculateOrderTotals();
      const lineItems=selectedItems.map(it=>({variant_id:Number(it.variantId),quantity:Number(it.qty)})).filter(li=>li.variant_id>0&&li.quantity>0);

      const orderData={
        order_number:`ORD-${Date.now()}`,
        customer_name:fullName,
        customer_phone:customerPhone,
        delivery_address:dAddress.value.trim(),
        platform:cPlatform.value.trim(),
        csr:cCSR.value.trim(),
        notes:cNotes?.value.trim()||'',
        inventory_notes:cInventoryNotes?.value.trim()||'',
        emirate:cEmirates.value.trim(),
        products:selectedItems.map(it=>({variant_id:it.variantId,title:it.title,qty:it.qty,price:it.price})),
        line_items:lineItems,
        total_price:grandTotal,
        subtotal, shipping:shippingFee, vat, discount,
        status:'pending'
      };

      try {
        const token=localStorage.getItem('token')||'';
        const response=await fetch(`${API_URL}/api/orders`,{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
          body:JSON.stringify(orderData)
        });
        const result=await response.json();
        if (response.ok) {
          if(createOrderResult){ createOrderResult.style.color='green'; createOrderResult.textContent=`✅ Order created successfully: #${result.order_number||result.id||'N/A'}`; }
          selectedItems=[]; renderOrderItems();
          [cFullName,cMobile,cEmirates,cPlatform,cCSR,dAddress,cNotes,cInventoryNotes].forEach(el=>{if(el) el.value='';});
          if(discountEl) discountEl.value='';
          setTimeout(()=>{ if(createOrderResult) createOrderResult.textContent=''; },4000);
          fetchOrders();
        } else {
          if(createOrderResult){ createOrderResult.style.color='#d44'; createOrderResult.textContent=`✗ Error: ${result.error||'Failed to create order'}`; }
        }
      } catch(err) {
        if(createOrderResult){ createOrderResult.style.color='#d44'; createOrderResult.textContent='Something went wrong. Please try again.'; }
      } finally {
        createOrderBtn.innerHTML=originalHtml; createOrderBtn.disabled=false; createOrderBtn.dataset.submitting='false';
      }
    });

    // Phone placeholder
    function setupNotesDropdown() {
      const dropdown=document.getElementById('notes-dropdown');
      const addBtn=document.getElementById('add-note-btn');
      const textarea=document.getElementById('customer_notes');
      if(!dropdown||!addBtn||!textarea) return;
      addBtn.addEventListener('click',()=>{
        const val=dropdown.value; if(!val||val==='custom'){ textarea.focus(); return; }
        const cur=textarea.value.trim();
        if(cur.includes(val)) return;
        textarea.value=cur?cur+'\n• '+val:'• '+val;
        textarea.classList.add('has-content'); dropdown.value=''; textarea.scrollTop=textarea.scrollHeight; textarea.focus();
      });
      dropdown.addEventListener('change',function(){ if(this.value==='custom'){ textarea.focus(); setTimeout(()=>{this.value='';},100); } });
      textarea.addEventListener('input',function(){ this.classList.toggle('has-content',!!this.value.trim()); });
    }
  }

  // ── RESET FILTERS ─────────────────────────────────────────────────────────
  function resetFilters() {
    if(searchInput) searchInput.value='';
    if(statusFilter) statusFilter.value='all';
    if(inventoryFilter) inventoryFilter.value='all';
    if(courierStatusFilter) courierStatusFilter.value='all';
    if(courierFilter) courierFilter.value='all';
    if(platformFilter) platformFilter.value='all';
    if(minTotal) minTotal.value='';
    if(maxTotal) maxTotal.value='';
    if(csrFilter) csrFilter.value='';
    if(customerFilter) customerFilter.value='';
    if(fromDateEl) fromDateEl.value='';
    if(toDateEl) toDateEl.value='';
    currentPage=1; sortColumn='created_at'; sortDirection='desc';
    applyFilters();
  }

  // ── CHARTS ────────────────────────────────────────────────────────────────
  let salesChart, topProductsChart;
  function initializeDashboardCharts() {
    const dailyData={};
    allOrders.forEach(o=>{
      if(!isValidDate(o.created_at)) return;
      const d=new Date(o.created_at).toISOString().split('T')[0];
      if(!dailyData[d]) dailyData[d]={orders:0,revenue:0};
      dailyData[d].orders+=1; dailyData[d].revenue+=o.total_price;
    });
    const sortedDates=Object.keys(dailyData).sort();
    const labels=sortedDates.map(d=>new Date(d).toLocaleDateString('en-US',{weekday:'short'}));
    const salesCtx=document.getElementById('salesChart')?.getContext('2d');
    if(salesCtx){
      if(salesChart) salesChart.destroy();
      salesChart=new Chart(salesCtx,{type:'line',data:{labels:labels.length?labels:['No Data'],datasets:[{label:'Orders',data:sortedDates.map(d=>dailyData[d].orders),borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.1)',tension:0.4,fill:true},{label:'Revenue',data:sortedDates.map(d=>dailyData[d].revenue),borderColor:'#10b981',backgroundColor:'rgba(16,185,129,0.1)',tension:0.4,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}},scales:{y:{beginAtZero:true}}}});
    }
    const productCounts=new Map();
    allOrders.forEach(o=>parseProducts(o.products_raw).forEach(p=>productCounts.set(p.name,(productCounts.get(p.name)||0)+p.quantity)));
    const top=Array.from(productCounts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const topCtx=document.getElementById('topProductsChart')?.getContext('2d');
    if(topCtx){
      if(topProductsChart) topProductsChart.destroy();
      topProductsChart=new Chart(topCtx,{type:'doughnut',data:{labels:top.length?top.map(e=>e[0]):['No Products'],datasets:[{data:top.length?top.map(e=>e[1]):[0],backgroundColor:['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444'],borderWidth:2,borderColor:'#ffffff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});
    }
  }

  // ── EVENT LISTENERS ───────────────────────────────────────────────────────
  function setupEventListeners() {
    searchInput?.addEventListener('input',applyFilters);
    statusFilter?.addEventListener('change',applyFilters);
    inventoryFilter?.addEventListener('change',applyFilters);
    courierStatusFilter?.addEventListener('change',applyFilters);
    courierFilter?.addEventListener('change',applyFilters);
    platformFilter?.addEventListener('change',applyFilters);
    minTotal?.addEventListener('input',applyFilters);
    maxTotal?.addEventListener('input',applyFilters);
    csrFilter?.addEventListener('input',applyFilters);
    customerFilter?.addEventListener('input',applyFilters);
    fromDateEl?.addEventListener('change',applyFilters);
    toDateEl?.addEventListener('change',applyFilters);
    refreshBtn?.addEventListener('click',fetchOrders);
    exportBtn?.addEventListener('click',exportToCSV);
    resetBtn?.addEventListener('click',resetFilters);
    prevPageBtn?.addEventListener('click',()=>{ if(currentPage>1){currentPage--;renderOrders(getPagedOrders());updatePagination();} });
    nextPageBtn?.addEventListener('click',()=>{ const tp=Math.ceil(filteredOrders.length/ordersPerPage); if(currentPage<tp){currentPage++;renderOrders(getPagedOrders());updatePagination();} });

    const pn=document.getElementById('pagination-numbers');
    if(pn) pn.addEventListener('click',e=>{ const btn=e.target.closest('.page-number[data-page]'); if(!btn) return; currentPage=parseInt(btn.dataset.page); renderOrders(getPagedOrders()); updatePagination(); });

    const rppSelect=document.getElementById('rows-per-page');
    if(rppSelect) rppSelect.addEventListener('change',function(){ ordersPerPage=parseInt(this.value,10); currentPage=1; renderOrders(getPagedOrders()); updatePagination(); });

    document.addEventListener('click',e=>{
      if(e.target.closest('#retry-btn')) fetchOrders();
      if(e.target.closest('#retry-products-btn')) fetchAndRenderProducts(document.getElementById('product-search-input')?.value.trim()||'');
    });

    modalClose?.addEventListener('click',()=>{ modal.style.display='none'; });
    if(modal) window.addEventListener('click',e=>{ if(e.target===modal) modal.style.display='none'; });

    if(ordersBody) ordersBody.addEventListener('click',async e=>{
      const vd=e.target.closest('.view-details'); if(!vd) return;
      const orderId=vd.dataset.orderId;
      const order=allOrders.find(o=>o.id==orderId);
      if(order){
        orderDetails.innerHTML=`
          <div class="order-detail"><strong>Order ID:</strong> #${order.name||order.id}</div>
          <div class="order-detail"><strong>Customer Name:</strong> ${order.customer_name||'Guest'}</div>
          <div class="order-detail"><strong>Phone:</strong> ${order.customer_phone||'N/A'}</div>
          <div class="order-detail"><strong>Delivery Address:</strong> ${order.delivery_address||'N/A'}</div>
          <div class="order-detail"><strong>CSR:</strong> ${order.csr||'N/A'}</div>
          <div class="order-detail"><strong>Platform:</strong> ${order.platform||'N/A'}</div>
          <div class="order-detail"><strong>Notes:</strong> ${order.note||'N/A'}</div>
          <div class="order-detail"><strong>Products:</strong> <pre>${escapeHtml(order.products_raw||'N/A')}</pre></div>
          <div class="order-detail"><strong>Date:</strong> ${formatDateTime(order.created_at)}</div>
          <div class="order-detail"><strong>Total:</strong> ${formatPrice(order.total_price,order.currency)}</div>
          <div class="order-detail"><strong>Fulfillment Status:</strong> ${createStatusBadge(order.status,'fulfillment')}</div>
          <div class="order-detail"><strong>Inventory Status:</strong> ${createStatusBadge(order.inventory_status||'pending','inventory')}</div>
          <div class="order-detail"><strong>Courier:</strong> ${order.courier||'N/A'}</div>
          <div class="order-detail"><strong>Tracking ID:</strong> ${generateTrackingLinks(order)}</div>
          <div class="order-detail"><strong>Courier Status:</strong> ${createStatusBadge(order.courier_status,'courier')}</div>`;
        modal.style.display='block';
      }
    });

    document.querySelectorAll('th[data-sort]').forEach(th=>{
      th.addEventListener('click',()=>{
        const col=th.dataset.sort;
        if(sortColumn===col) sortDirection=sortDirection==='asc'?'desc':'asc'; else{sortColumn=col;sortDirection='asc';}
        th.querySelector('i').className=`fas fa-sort-${sortDirection==='asc'?'up':'down'}`;
        document.querySelectorAll('th[data-sort] i').forEach(icon=>{ if(icon.parentElement!==th) icon.className='fas fa-sort'; });
        applyFilters();
      });
    });

    document.getElementById('logout-btn')?.addEventListener('click',()=>{ localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href='/login.html'; });

    // Phone placeholder update
    const countryCodeSelect=document.getElementById('country_code');
    const mobileInput=document.getElementById('customer_mobile');
    if(countryCodeSelect&&mobileInput){
      const placeholderMap={'+971':'52XXXXXXX','+94':'77XXXXXXX','+63':'917XXXXXXX','+966':'50XXXXXXX','+62':'812XXXXXXX','+92':'300XXXXXXX','+91':'98XXXXXXXX','+256':'77XXXXXXX','+244':'923XXXXXX','+251':'91XXXXXXX','+234':'803XXXXXXX','+974':'55XXXXXX','+968':'99XXXXXX','+973':'36XXXXXX','+255':'71XXXXXXX','+254':'7XXXXXXX','+965':'5XXXXXXX','+20':'10XXXXXXX','+233':'24XXXXXXX','+95':'9XXXXXXX','+977':'9XXXXXXX','+852':'6XXXXXXX','+60':'17XXXXXXX','+232':'90XXXXXX','+27':'6XXXXXXX','+998':'90XXXXXXX','+243':'8XXXXXXXX','+221':'90XXXXXX','+962':'79XXXXXXX','+220':'XXXXXXX','+66':'XXXXXXXXX','+225':'XXXXXXXX','+961':'XXXXXXXX','+261':'XXXXXXXXX','+970':'52XXXXXXX','+226':'52XXXXXX','+237':'6XXXXXXXX'};
      const updatePlaceholder=()=>{ mobileInput.placeholder=placeholderMap[countryCodeSelect.value]||'Enter local number'; };
      countryCodeSelect.addEventListener('change',updatePlaceholder);
      updatePlaceholder();
    }

    setupCreateOrder();
  }

  // ── BARCODE SCANNER ───────────────────────────────────────────────────────
  document.addEventListener('barcodeScanned',e=>{
    const {code,status}=e.detail;
    const order=allOrders.find(o=>o.tracking_id===code);
    if(order){ order.inventory_status=status; order.last_scan=new Date().toISOString(); applyFilters(); } else fetchOrders();
  });

  // ── INIT ──────────────────────────────────────────────────────────────────
  function init() {
    const isAuthenticated = checkAuth();
    if (!isAuthenticated) return;
    setupEventListeners();
    fetchOrders();
    updateAnalytics();
    fetchAndRenderProducts();
  }

  init();
});
