// ============================================================================
// BARCHI FURNITURE - ADMIN PANEL CORE LOGIC (NO DEFAULT SOFA IMAGES)
// ============================================================================

(function () {
  'use strict';

  const SUPABASE_URL = window.SUPABASE_URL || 'https://fyviuwmvyussvzeufuwg.supabase.co';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5dml1d212eXVzc3Z6ZXVmdXdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTA3MTUsImV4cCI6MjEwMDk4NjcxNX0.JbpegqU_gzyp4kiUZo9yPccdqHCCalcyWLPcCABbqoc';
  const STORAGE_BUCKET = 'barchi-image';

  let _editingProductId = null;
  let _editingCategoryId = null;

  let _supabaseClient = null;
  function getSupabaseClient() {
    if (!_supabaseClient && window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      } catch (err) {
        console.warn('Supabase client initialization notice:', err);
      }
    }
    return _supabaseClient;
  }

  function isSupabaseLive() {
    const client = getSupabaseClient();
    return !!client || !!SUPABASE_URL;
  }

  async function fetchSupabaseRest(table, queryParams = 'select=*&order=created_at.desc') {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.from(table).select('*').order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) return data;
      } catch(e) {}
    }

    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${queryParams}`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) return data;
      }
    } catch(e) {
      console.warn(`Direct REST fetch for ${table} notice:`, e);
    }
    return null;
  }

  const STORAGE_KEYS = {
    CATEGORIES: 'barchi_admin_categories_v1',
    PRODUCTS: 'barchi_admin_products_v1',
    ORDERS: 'barchi_saved_orders_v1'
  };

  const DEFAULT_CATEGORIES = [];
  const DEFAULT_PRODUCTS = [];

  function extractSinglePrimaryImage(p) {
    if (!p) return '';
    let url = '';
    
    if (p.images && Array.isArray(p.images) && p.images.length > 0) {
      url = p.images[0];
    } else if (typeof p.images === 'string' && p.images.trim()) {
      try {
        const arr = JSON.parse(p.images);
        if (Array.isArray(arr) && arr.length > 0) url = arr[0];
      } catch (e) {
        url = p.images.split(',')[0];
      }
    }

    if (!url && p.image_url) {
      let str = String(p.image_url).trim();
      if (str.startsWith('[') || str.startsWith('"[')) {
        try {
          let arr = JSON.parse(str);
          if (typeof arr === 'string') arr = JSON.parse(arr);
          if (Array.isArray(arr) && arr.length > 0) url = arr[0];
        } catch (e) {
          url = str.replace(/[\[\]"']/g, '').split(',')[0];
        }
      } else if (str.includes(',')) {
        url = str.split(',')[0];
      } else {
        url = str;
      }
    }

    return (url && typeof url === 'string') ? url.trim() : '';
  }

  function extractAllImagesList(p) {
    if (!p) return [];
    let list = [];
    
    if (p.images && Array.isArray(p.images) && p.images.length > 0) {
      list = p.images.filter(Boolean);
    } else if (typeof p.images === 'string' && p.images.trim()) {
      try {
        const arr = JSON.parse(p.images);
        if (Array.isArray(arr) && arr.length > 0) list = arr.filter(Boolean);
      } catch (e) {
        list = p.images.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    if (list.length === 0 && p.image_url) {
      let str = String(p.image_url).trim();
      if (str.startsWith('[') || str.startsWith('"[')) {
        try {
          let arr = JSON.parse(str);
          if (typeof arr === 'string') arr = JSON.parse(arr);
          if (Array.isArray(arr) && arr.length > 0) list = arr.filter(Boolean);
        } catch (e) {
          list = str.replace(/[\[\]"']/g, '').split(',').map(s => s.trim()).filter(Boolean);
        }
      } else if (str.includes(',')) {
        list = str.split(',').map(s => s.trim()).filter(Boolean);
      } else if (str) {
        list = [str];
      }
    }

    const clean = [];
    list.forEach(u => {
      if (u && typeof u === 'string' && (u.startsWith('http') || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('images/')) && !clean.includes(u)) {
        clean.push(u);
      }
    });

    return clean;
  }
  async function compressImageFile(file, maxSizeBytes = 180 * 1024) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(file);
      }, 2500);

      if (!file || !file.type || !file.type.startsWith('image/')) {
        clearTimeout(timer);
        return resolve(file);
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1200; // Crisp high-definition for retina furniture detail

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.86;
          function attemptCompress(q) {
            canvas.toBlob((blob) => {
              clearTimeout(timer);
              if (!blob) return resolve(file);
              if (blob.size <= maxSizeBytes || q <= 0.35) {
                const webpFile = new File([blob], (file.name || 'furniture').replace(/\.[^/.]+$/, "") + ".webp", {
                  type: 'image/webp',
                  lastModified: Date.now()
                });
                resolve(webpFile);
              } else {
                attemptCompress(q - 0.12);
              }
            }, 'image/webp', q);
          }
          attemptCompress(quality);
        };
        img.onerror = () => { clearTimeout(timer); resolve(file); };
        img.src = e.target.result;
      };
      reader.onerror = () => { clearTimeout(timer); resolve(file); };
      reader.readAsDataURL(file);
    });
  }

  function fileToDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  async function uploadImageToSupabase(file, folder = 'general') {
    if (!file) return null;
    
    let compressedFile = file;
    try {
      compressedFile = await compressImageFile(file, 200 * 1024);
    } catch (e) {}

    const dataUrlFallback = await fileToDataUrl(compressedFile);

    if (isSupabaseLive()) {
      try {
        const fileExt = (compressedFile.name && compressedFile.name.includes('.')) ? compressedFile.name.split('.').pop() : 'jpg';
        const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        
        const uploadPromise = getSupabaseClient().storage.from(STORAGE_BUCKET).upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: true
        });

        const timeoutPromise = new Promise(res => setTimeout(() => res({ error: 'timeout' }), 4000));
        const res = await Promise.race([uploadPromise, timeoutPromise]);

        if (res && !res.error) {
          const { data: publicUrlData } = getSupabaseClient().storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
          if (publicUrlData && publicUrlData.publicUrl) {
            return publicUrlData.publicUrl;
          }
        }
      } catch (e) {
        console.warn('Storage upload exception:', e);
      }
    }

    return dataUrlFallback;
  }

  // Admin Service Data Handler
  const AdminService = {
    // --- CATEGORIES ---
    async getCategories() {
      try {
        const data = await fetchSupabaseRest('categories');
        if (Array.isArray(data)) {
          const parsedCat = data.map(c => ({
            ...c,
            name: c.name || c.title || 'Category',
            title: c.name || c.title || 'Category',
            thumbnail_url: c.thumbnail_url || c.image || '',
            image: c.thumbnail_url || c.image || ''
          }));
          localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(parsedCat));
          return parsedCat;
        }
      } catch (e) {}

      const cached = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (cached) return JSON.parse(cached);
      return DEFAULT_CATEGORIES;
    },

    async saveCategory(category) {
      const categories = await this.getCategories();
      const existingIdx = categories.findIndex(c => String(c.id) === String(category.id));
      if (existingIdx >= 0) {
        categories[existingIdx] = category;
      } else {
        categories.unshift(category);
      }
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));

      if (isSupabaseLive()) {
        try {
          await getSupabaseClient().from('categories').upsert({
            id: String(category.id),
            name: category.name,
            thumbnail_url: category.thumbnail_url,
            created_at: category.created_at || new Date().toISOString()
          });
        } catch (e) {}
      }
      return category;
    },

    async deleteCategory(id) {
      let categories = await this.getCategories();
      categories = categories.filter(c => String(c.id) !== String(id));
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));

      let products = await this.getProducts();
      products = products.filter(p => String(p.category_id) !== String(id));
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));

      if (isSupabaseLive()) {
        try {
          await getSupabaseClient().from('categories').delete().eq('id', String(id));
          await getSupabaseClient().from('products').delete().eq('category_id', String(id));
        } catch (e) {}
      }
      return true;
    },

    // --- PRODUCTS ---
    async getProducts() {
      try {
        const data = await fetchSupabaseRest('products');
        if (Array.isArray(data)) {
          const localCached = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
          const merged = data.map(remoteP => {
            const localP = localCached.find(l => String(l.id) === String(remoteP.id));
            return {
              ...remoteP,
              name: remoteP.name || remoteP.title || 'Furniture Product',
              title: remoteP.name || remoteP.title || 'Furniture Product',
              image: extractSinglePrimaryImage(remoteP),
              material: remoteP.material || (localP ? localP.material : ''),
              colour: remoteP.colour || remoteP.color || (localP ? (localP.colour || localP.color) : ''),
              length: remoteP.length || (localP ? localP.length : ''),
              width: remoteP.width || (localP ? localP.width : ''),
              height: remoteP.height || (localP ? localP.height : ''),
              images: (remoteP.images && Array.isArray(remoteP.images) && remoteP.images.length > 0) 
                ? remoteP.images 
                : (localP && localP.images && localP.images.length > 0 ? localP.images : (remoteP.image_url ? [remoteP.image_url] : []))
            };
          });
          localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(merged));
          return merged;
        }
      } catch (e) {}

      const cached = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (cached) return JSON.parse(cached);
      return DEFAULT_PRODUCTS;
    },

    async getProductsByCategory(categoryId) {
      const all = await this.getProducts();
      if (!categoryId || categoryId === 'ALL') return all;
      return all.filter(p => String(p.category_id) === String(categoryId));
    },

    async saveProduct(product) {
      const cachedRaw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      let products = cachedRaw ? JSON.parse(cachedRaw) : [];
      const existingIdx = products.findIndex(p => String(p.id) === String(product.id));
      if (existingIdx >= 0) {
        products[existingIdx] = { ...products[existingIdx], ...product };
      } else {
        products.unshift(product);
      }
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));

      if (isSupabaseLive()) {
        try {
          if (product.category_id) {
            try {
              await getSupabaseClient().from('categories').upsert({
                id: String(product.category_id),
                name: 'Furniture Category'
              }, { onConflict: 'id', ignoreDuplicates: true });
            } catch (e) {}
          }

          const { error } = await getSupabaseClient().from('products').upsert({
            id: String(product.id),
            category_id: String(product.category_id),
            name: product.name,
            price: product.price,
            image_url: product.image_url,
            images: product.images || [product.image_url],
            description: product.description,
            material: product.material || '',
            colour: product.colour || '',
            length: product.length || '',
            width: product.width || '',
            height: product.height || '',
            created_at: product.created_at || new Date().toISOString()
          });

          if (error) {
            console.warn('Full schema notice, saving base product columns to Supabase:', error.message);
            await getSupabaseClient().from('products').upsert({
              id: String(product.id),
              category_id: String(product.category_id),
              name: product.name,
              price: product.price,
              image_url: product.image_url,
              description: product.description,
              created_at: product.created_at || new Date().toISOString()
            });
          }
        } catch (e) {
          console.warn('Supabase product save exception:', e);
        }
      }
      return product;
    },

    async deleteProduct(id) {
      let products = await this.getProducts();
      products = products.filter(p => String(p.id) !== String(id));
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));

      if (isSupabaseLive()) {
        try {
          await getSupabaseClient().from('products').delete().eq('id', String(id));
        } catch (e) {}
      }
      return true;
    },

    // --- ORDERS ---
    async getOrders() {
      try {
        const data = await fetchSupabaseRest('orders');
        if (Array.isArray(data)) {
          const parsed = data.map(o => {
            let itemsArr = [];
            if (Array.isArray(o.items)) {
              itemsArr = o.items;
            } else if (typeof o.items === 'string' && o.items.trim()) {
              try { itemsArr = JSON.parse(o.items); } catch(e) {}
            }

            return {
              id: o.id,
              client_name: o.client_name || o.customerName || 'Customer #' + o.id,
              client_email: o.client_email || o.email || '',
              mobile_number: o.mobile_number || o.customerPhone || 'N/A',
              total_amount: parseFloat(o.total_amount || o.totalPayable || 0),
              status: o.status || 'Pending',
              items: itemsArr,
              created_at: o.created_at || new Date().toISOString(),
              rawPayload: o
            };
          });
          localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(parsed));
          return parsed;
        }
      } catch (e) {}

      const cached = localStorage.getItem(STORAGE_KEYS.ORDERS);
      if (cached) return JSON.parse(cached);
      return [];
    },

    async updateOrderStatus(id, newStatus) {
      const cached = localStorage.getItem(STORAGE_KEYS.ORDERS);
      if (cached) {
        const list = JSON.parse(cached);
        const target = list.find(q => String(q.id) === String(id));
        if (target) {
          target.status = newStatus;
          localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(list));
        }
      }

      if (isSupabaseLive()) {
        try {
          await getSupabaseClient().from('orders').upsert({ id: String(id), status: newStatus, updated_at: new Date().toISOString() });
        } catch (e) {}
      }
      return true;
    },

    async deleteOrder(id) {
      const cached = localStorage.getItem(STORAGE_KEYS.ORDERS);
      if (cached) {
        let list = JSON.parse(cached);
        list = list.filter(q => String(q.id) !== String(id));
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(list));
      }

      if (isSupabaseLive()) {
        try {
          await getSupabaseClient().from('orders').delete().eq('id', String(id));
        } catch (e) {
          try {
            await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(id)}`, {
              method: 'DELETE',
              headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
              }
            });
          } catch (err) {}
        }
      }
      return true;
    }
  };

  // Admin Application Controller
  const AdminApp = {
    pendingCatFile: null,
    pendingProdFiles: [],
    existingProdImages: [],

    async init() {
      this.bindForms();
      registerAdminPWAAndNotifications();

      try {
        if (document.getElementById('statTotalOrders')) {
          await this.renderDashboard();
        }
        if (document.getElementById('categoriesGrid')) {
          await this.renderCategories();
        }
        if (document.getElementById('ordersTableBody')) {
          await this.renderOrders();
        }
        if (document.getElementById('productCategoryFilter')) {
          await this.initProductsPage();
        }
        if (document.getElementById('standaloneProductForm')) {
          await this.initCreateProductPage();
        }
      } catch (err) {
        console.error('Error during AdminApp init:', err);
      }
    },

    // --------------------------------------------------------------------------
    // DASHBOARD
    // --------------------------------------------------------------------------
    async renderDashboard() {
      const orders = await AdminService.getOrders();
      const products = await AdminService.getProducts();
      const categories = await AdminService.getCategories();

      const confirmedOrders = orders.filter(o => o.status === 'Confirmed' || o.status === 'Delivered' || o.status === 'Pending');
      const totalRevenue = confirmedOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);

      const elOrders = document.getElementById('statTotalOrders');
      const elRev = document.getElementById('statTotalRevenue');
      const elProd = document.getElementById('statTotalProducts');
      const elCat = document.getElementById('statTotalCategories');

      if (elOrders) elOrders.textContent = orders.length;
      if (elRev) elRev.textContent = '₹' + totalRevenue.toLocaleString('en-IN');
      if (elProd) elProd.textContent = products.length;
      if (elCat) elCat.textContent = categories.length;

      this.renderRevenueChart(orders);
    },

    renderRevenueChart(orders) {
      const canvas = document.getElementById('revenueChartCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      const width = canvas.parentElement ? canvas.parentElement.clientWidth : 800;
      const height = 300;
      canvas.width = width * 2;
      canvas.height = height * 2;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.scale(2, 2);

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthTotals = new Array(12).fill(0);

      orders.forEach(o => {
        if (o.created_at) {
          const d = new Date(o.created_at);
          if (!isNaN(d.getTime())) {
            const mIndex = d.getMonth();
            monthTotals[mIndex] += parseFloat(o.total_amount) || 0;
          }
        }
      });

      const maxVal = Math.max(...monthTotals, 100000);

      ctx.clearRect(0, 0, width, height);

      const padding = 40;
      const chartW = width - padding * 2;
      const chartH = height - padding * 2;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;

      for (let i = 0; i <= 4; i++) {
        const y = padding + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();

        const labelVal = Math.round(maxVal - (maxVal / 4) * i);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText('₹' + (labelVal / 1000).toFixed(0) + 'k', 5, y + 4);
      }

      const barWidth = (chartW / 12) * 0.55;
      const step = chartW / 12;

      months.forEach((m, idx) => {
        const x = padding + idx * step + (step - barWidth) / 2;
        const barH = (monthTotals[idx] / maxVal) * chartH;
        const y = height - padding - barH;

        const grad = ctx.createLinearGradient(0, y, 0, height - padding);
        grad.addColorStop(0, '#2563eb');
        grad.addColorStop(1, '#60a5fa');

        ctx.fillStyle = grad;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barWidth, barH, [4, 4, 0, 0]);
        } else {
          ctx.rect(x, y, barWidth, barH);
        }
        ctx.fill();

        ctx.fillStyle = '#64748b';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(m, x + barWidth / 2, height - padding + 18);
      });
    },

    // --------------------------------------------------------------------------
    // CATEGORIES
    // --------------------------------------------------------------------------
    async renderCategories() {
      const categories = await AdminService.getCategories();
      const products = await AdminService.getProducts();

      const grid = document.getElementById('categoriesGrid');
      if (!grid) return;
      grid.innerHTML = '';

      if (categories.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 32px; background: var(--bg-color); border-radius: var(--radius-md);">No categories created yet. Use the form above to add your first furniture category!</div>`;
        return;
      }

      categories.forEach(cat => {
        const count = products.filter(p => String(p.category_id) === String(cat.id)).length;
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
          <div class="card-img-wrapper">
            <img src="${cat.thumbnail_url || ''}" class="card-img" alt="${cat.name}" onerror="this.style.display='none'; this.parentElement.style.background='#cbd5e1';" />
          </div>
          <div class="card-content">
            <div class="card-title">${cat.name}</div>
            <div class="card-subtitle">${count} Product${count !== 1 ? 's' : ''}</div>
            <div style="margin-top: 12px; display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="AdminApp.handleEditCategory('${cat.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                Edit
              </button>
              <button class="btn btn-danger btn-sm" onclick="AdminApp.handleDeleteCategory('${cat.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete
              </button>
            </div>
          </div>
        `;
        grid.appendChild(card);
      });
    },

    async handleEditCategory(id) {
      const categories = await AdminService.getCategories();
      const target = categories.find(c => String(c.id) === String(id));
      if (!target) return;

      _editingCategoryId = String(id);
      this.pendingCatFile = null;
      document.getElementById('catName').value = target.name;
      const imgPrev = document.getElementById('catImagePreview');
      if (imgPrev) {
        imgPrev.src = target.thumbnail_url || '';
        imgPrev.style.display = target.thumbnail_url ? 'block' : 'none';
      }
      
      const header = document.getElementById('categoryFormHeader');
      if (header) {
        header.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          Edit Furniture Category
        `;
      }

      const btn = document.getElementById('catFormSubmitBtn');
      if (btn) {
        btn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Update Category
        `;
      }

      const formCard = document.getElementById('categoryFormCard');
      if (formCard) formCard.scrollIntoView({ behavior: 'smooth' });
    },

    resetCategoryForm() {
      _editingCategoryId = null;
      this.pendingCatFile = null;
      const form = document.getElementById('categoryForm');
      if (form) form.reset();

      const imgPrev = document.getElementById('catImagePreview');
      if (imgPrev) {
        imgPrev.src = '';
        imgPrev.style.display = 'none';
      }

      const header = document.getElementById('categoryFormHeader');
      if (header) {
        header.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create New Furniture Category
        `;
      }

      const btn = document.getElementById('catFormSubmitBtn');
      if (btn) {
        btn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Save Category
        `;
      }
    },

    async handleDeleteCategory(id) {
      if (confirm('Are you sure you want to delete this category and all its products?')) {
        await AdminService.deleteCategory(id);
        this.showToast('Category deleted', 'info');
        await this.renderCategories();
      }
    },

    // --------------------------------------------------------------------------
    // ORDERS
    // --------------------------------------------------------------------------
    async renderOrders() {
      const orders = await AdminService.getOrders();
      const tbody = document.getElementById('ordersTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';

      if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">No arrived orders found.</td></tr>`;
        return;
      }

      orders.forEach(o => {
        const tr = document.createElement('tr');
        const dateStr = o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
        
        const rawItems = Array.isArray(o.items) ? o.items : (typeof o.items === 'string' ? JSON.parse(o.items || '[]') : []);

        let totalAmt = parseFloat(o.total_amount) || parseFloat(o.total) || parseFloat(o.totalPayable) || 0;
        if (totalAmt === 0 && rawItems.length > 0) {
          totalAmt = rawItems.reduce((sum, it) => sum + (parseFloat(it.price) || 0) * (parseInt(it.qty || it.quantity) || 1), 0);
        }

        tr.innerHTML = `
          <td><strong>#${o.id}</strong></td>
          <td><strong>${o.client_name || 'Barchi Customer'}</strong></td>
          <td>${o.mobile_number || 'N/A'}</td>
          <td><strong style="color: var(--accent-primary); font-size:0.95rem;">₹${totalAmt.toLocaleString('en-IN')}</strong></td>
          <td>
            <select class="status-select status-${(o.status || 'Pending').toLowerCase()}" onchange="AdminApp.handleOrderStatusChange('${o.id}', this.value)">
              <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="Confirmed" ${o.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option>
              <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
              <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </td>
          <td><span style="font-size: 0.8rem; color: var(--text-muted);">${dateStr}</span></td>
          <td style="text-align:right;">
            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button class="btn btn-secondary btn-sm" onclick="AdminApp.openOrderDetailsModal('${o.id}')" style="display:inline-flex; align-items:center; gap:4px; font-size:0.8rem; padding:6px 12px; font-weight:600;">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                View Product Details
              </button>
              <button class="btn btn-danger btn-sm" onclick="AdminApp.handleDeleteOrder('${o.id}')" style="display:inline-flex; align-items:center; gap:4px; font-size:0.8rem; padding:6px 10px; font-weight:600;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    },

    async handleDeleteOrder(id) {
      if (confirm(`Are you sure you want to delete Order #${id}?`)) {
        await AdminService.deleteOrder(id);
        this.showToast(`Order #${id} deleted`, 'info');
        await this.renderOrders();
      }
    },

    async openOrderDetailsModal(orderId) {
      const orders = await AdminService.getOrders();
      const ord = orders.find(q => String(q.id) === String(orderId));
      if (!ord) return;

      const modal = document.getElementById('adminOrderModal');
      if (!modal) return;

      document.getElementById('modalOrderId').textContent = `Product Details - Order #${ord.id}`;
      document.getElementById('modalOrderDate').textContent = ord.created_at ? `Placed on ${new Date(ord.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Recent Order';
      document.getElementById('modalClientName').textContent = ord.client_name || 'Barchi Customer';
      document.getElementById('modalClientPhone').textContent = ord.mobile_number || 'N/A';
      
      const statusEl = document.getElementById('modalOrderStatus');
      if (statusEl) {
        statusEl.innerHTML = `<span class="order-status-badge ${(ord.status || 'Pending').toLowerCase()}">${ord.status || 'Pending'}</span>`;
      }

      const catalog = await AdminService.getProducts();
      let rawItems = ord.items;
      if ((!rawItems || (Array.isArray(rawItems) && rawItems.length === 0)) && ord.rawPayload && ord.rawPayload.items) {
        rawItems = ord.rawPayload.items;
      }
      
      const items = Array.isArray(rawItems) ? rawItems : (typeof rawItems === 'string' ? JSON.parse(rawItems || '[]') : []);
      const productsListEl = document.getElementById('modalProductList');

      let computedTotal = parseFloat(ord.total_amount) || parseFloat(ord.total) || parseFloat(ord.totalPayable) || 0;
      if (computedTotal === 0 && items.length > 0) {
        computedTotal = items.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseInt(i.qty || i.quantity) || 1), 0);
      }

      if (productsListEl) {
        if (items.length === 0) {
          productsListEl.innerHTML = `
            <div style="background:#f8fafc; padding:16px; border-radius:12px; border:1px solid #e2e8f0; color:#64748b; font-size:0.9rem;">
              Furniture Order · Total Amount: <strong>₹${computedTotal.toLocaleString('en-IN')}</strong>
            </div>
          `;
        } else {
          productsListEl.innerHTML = items.map(it => {
            const catItem = catalog.find(p => String(p.id) === String(it.id || it.product_id)) || {};
            const img = it.image || it.image_url || catItem.image || catItem.image_url || 'barchi-logo.png';
            const title = it.title || it.name || it.product_name || catItem.title || catItem.name || 'Barchi Furniture Product';
            const qty = parseInt(it.qty || it.quantity) || 1;
            const price = parseFloat(it.price || catItem.price) || (computedTotal / qty);
            const itemTotal = price * qty;
            const category = it.category || catItem.category || 'Solid Wood Collection';

            return `
              <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:16px; display:flex; gap:16px; align-items:flex-start; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
                <img src="${img}" alt="${title}" style="width:90px; height:90px; object-fit:cover; border-radius:10px; border:1px solid #cbd5e1; flex-shrink:0;">
                <div style="flex:1;">
                  <div style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:#2563eb; letter-spacing:0.05em; margin-bottom:2px;">${category}</div>
                  <h3 style="font-family:'Outfit', sans-serif; font-size:1.05rem; font-weight:700; color:#0f172a; margin:0 0 6px 0;">${title}</h3>
                  
                  <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:8px; font-size:0.83rem; background:#f8fafc; padding:8px 12px; border-radius:8px; margin-top:8px;">
                    <div><span style="color:#64748b;">Unit Price:</span> <strong style="color:#0f172a;">₹${price.toLocaleString('en-IN')}</strong></div>
                    <div><span style="color:#64748b;">Quantity:</span> <strong style="color:#0f172a;">${qty}</strong></div>
                    <div><span style="color:#64748b;">Subtotal:</span> <strong style="color:#2563eb;">₹${itemTotal.toLocaleString('en-IN')}</strong></div>
                  </div>
                </div>
              </div>
            `;
          }).join('');
        }
      }

      modal.style.display = 'flex';
    },

    closeOrderDetailsModal() {
      const modal = document.getElementById('adminOrderModal');
      if (modal) modal.style.display = 'none';
    },

    async handleOrderStatusChange(id, newStatus) {
      await AdminService.updateOrderStatus(id, newStatus);
      this.showToast(`Order #${id} status changed to ${newStatus}`, 'success');
      await this.renderOrders();
    },

    // --------------------------------------------------------------------------
    // PRODUCTS LIST PAGE
    // --------------------------------------------------------------------------
    async initProductsPage() {
      const categories = await AdminService.getCategories();
      const filterSelect = document.getElementById('productCategoryFilter');
      if (filterSelect) {
        filterSelect.innerHTML = `<option value="ALL">All Categories</option>`;
        categories.forEach(c => {
          filterSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
      }

      await this.handleProductSearchFilter();
    },

    async handleProductSearchFilter() {
      const searchInput = document.getElementById('productSearchInput');
      const filterSelect = document.getElementById('productCategoryFilter');

      const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
      const selectedCat = filterSelect ? filterSelect.value : 'ALL';

      let products = await AdminService.getProducts();
      const categories = await AdminService.getCategories();

      if (selectedCat !== 'ALL') {
        products = products.filter(p => String(p.category_id) === String(selectedCat));
      }

      if (query) {
        products = products.filter(p => 
          (p.name && p.name.toLowerCase().includes(query)) || 
          (p.description && p.description.toLowerCase().includes(query)) ||
          (p.material && p.material.toLowerCase().includes(query)) ||
          (p.colour && p.colour.toLowerCase().includes(query))
        );
      }

      const grid = document.getElementById('categoryProductsGrid');
      if (!grid) return;
      grid.innerHTML = '';

      if (products.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 48px; background: var(--bg-color); border-radius: var(--radius-md);">No products added yet. Click "+ Add New Product" above to create your first product!</div>`;
        return;
      }

      products.forEach(p => {
        const cat = categories.find(c => String(c.id) === String(p.category_id));
        const allImgs = extractAllImagesList(p);
        const primaryThumb = extractSinglePrimaryImage(p);
        const imageCount = allImgs.length;
        const cleanDesc = (p.description || '').split('<!--SPECS:')[0].trim();

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
          <div class="card-img-wrapper">
            <img src="${primaryThumb}" class="card-img" alt="${p.name}" onerror="this.style.display='none'; this.parentElement.style.background='#cbd5e1';" />
            <div class="product-price-badge">₹${parseFloat(p.price).toLocaleString('en-IN')}</div>
            ${imageCount > 1 ? `<div style="position:absolute; top:10px; right:10px; background:rgba(0,0,0,0.7); color:white; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">📷 ${imageCount} Photos</div>` : ''}
          </div>
          <div class="card-content" style="flex: 1;">
            <span class="category-tag">${cat ? cat.name : 'Furniture'}</span>
            <div class="card-title">${p.name}</div>
            <div class="card-subtitle" style="margin-top: 4px;">${cleanDesc || 'No description provided.'}</div>
            ${p.material ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:6px;"><strong>Material:</strong> ${p.material}</div>` : ''}
            ${p.colour ? `<div style="font-size:0.75rem; color:var(--text-muted);"><strong>Colour:</strong> ${p.colour}</div>` : ''}
            ${(p.length || p.width || p.height) ? `<div style="font-size:0.75rem; color:var(--text-muted);"><strong>Dimensions:</strong> ${p.length || '-'} × ${p.width || '-'} × ${p.height || '-'}</div>` : ''}
          </div>
          <div class="product-actions">
            <a href="create-product.html?edit=${p.id}" class="btn btn-secondary btn-sm" style="flex: 1;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
              Edit
            </a>
            <button class="btn btn-danger btn-sm" onclick="AdminApp.handleDeleteProduct('${p.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Delete
            </button>
          </div>
        `;
        grid.appendChild(card);
      });
    },

    async handleDeleteProduct(id) {
      if (confirm('Delete this product?')) {
        await AdminService.deleteProduct(id);
        this.showToast('Product deleted', 'info');
        await this.handleProductSearchFilter();
      }
    },

    // --------------------------------------------------------------------------
    // DEDICATED ADD/EDIT PRODUCT PAGE (create-product.html)
    // --------------------------------------------------------------------------
    async initCreateProductPage() {
      const categories = await AdminService.getCategories();
      const select = document.getElementById('prodCategorySelect');
      if (!select) return;

      select.innerHTML = '';
      if (categories.length === 0) {
        select.innerHTML = `<option value="">⚠️ No categories created yet. Please create a category first!</option>`;
      } else {
        categories.forEach(c => {
          select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
      }

      this.pendingProdFiles = [];
      this.existingProdImages = [];
      _editingProductId = null;

      const urlParams = new URLSearchParams(window.location.search);
      const editId = urlParams.get('edit');

      if (editId) {
        const products = await AdminService.getProducts();
        const target = products.find(p => String(p.id) === String(editId));
        if (target) {
          _editingProductId = String(target.id);
          this.existingProdImages = extractAllImagesList(target);
          
          document.getElementById('prodName').value = target.name || '';
          document.getElementById('prodPrice').value = target.price || '';
          const cleanDesc = (target.description || '').split('<!--SPECS:')[0].trim();
          document.getElementById('prodDescription').value = cleanDesc;
          
          if (target.category_id) {
            document.getElementById('prodCategorySelect').value = String(target.category_id);
          }

          document.getElementById('prodMaterial').value = target.material || '';
          document.getElementById('prodColour').value = target.colour || target.color || '';
          document.getElementById('prodLength').value = target.length || '';
          document.getElementById('prodWidth').value = target.width || '';
          document.getElementById('prodHeight').value = target.height || '';
          
          this.renderProductImagePreviews();

          const header = document.getElementById('productFormHeader');
          if (header) {
            header.innerHTML = `
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
              Edit Furniture Product
            `;
          }

          const btn = document.getElementById('prodFormSubmitBtn');
          if (btn) {
            btn.innerHTML = `
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Update Product
            `;
          }
        }
      }

      const form = document.getElementById('standaloneProductForm');
      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const name = document.getElementById('prodName').value.trim();
          const price = parseFloat(document.getElementById('prodPrice').value) || 0;
          const category_id = document.getElementById('prodCategorySelect').value;
          const description = document.getElementById('prodDescription').value.trim();
          const material = document.getElementById('prodMaterial').value.trim();
          const colour = document.getElementById('prodColour').value.trim();
          const length = document.getElementById('prodLength').value.trim();
          const width = document.getElementById('prodWidth').value.trim();
          const height = document.getElementById('prodHeight').value.trim();
          
          if (!category_id) {
            alert('Please select or create a category first!');
            return;
          }

          if (!name || price <= 0) {
            this.showToast('Please enter valid product name and price', 'error');
            return;
          }

          const submitBtn = document.getElementById('prodFormSubmitBtn');
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = _editingProductId ? 'Updating Product...' : 'Saving Product...';
          }

          try {
            const uploadedImageUrls = [...this.existingProdImages];

            if (this.pendingProdFiles && this.pendingProdFiles.length > 0) {
              this.showToast(`Compressing & Uploading ${this.pendingProdFiles.length} images (<200KB)...`, 'info');
              for (let i = 0; i < this.pendingProdFiles.length; i++) {
                const item = this.pendingProdFiles[i];
                const url = await uploadImageToSupabase(item.file, 'products');
                if (url) uploadedImageUrls.push(url);
                else if (item.previewUrl) uploadedImageUrls.push(item.previewUrl);
              }
            }

            const primaryImage = uploadedImageUrls[0] || '';
            const validImagesList = uploadedImageUrls.filter(Boolean);
            const serializedImages = validImagesList.length > 1 ? JSON.stringify(validImagesList) : primaryImage;

            const cleanUserDesc = description.split('<!--SPECS:')[0].split('<!--IMAGES:')[0].trim();
            const specsTag = `\n\n<!--SPECS:${JSON.stringify({ material, colour, length, width, height })}-->`;
            const imagesTag = `\n<!--IMAGES:${JSON.stringify(validImagesList)}-->`;
            const fullDescription = cleanUserDesc + specsTag + imagesTag;
            const targetId = _editingProductId ? String(_editingProductId) : ('prod_' + Date.now());

            const productPayload = {
              id: targetId,
              category_id: String(category_id),
              name,
              price,
              description: fullDescription,
              material,
              colour,
              length,
              width,
              height,
              image_url: serializedImages,
              images: validImagesList,
              created_at: new Date().toISOString()
            };

            await AdminService.saveProduct(productPayload);
            alert(_editingProductId ? `Product "${name}" updated successfully!` : `Product "${name}" saved successfully!`);
            window.location.href = 'add-products.html';
          } catch (err) {
            console.error('Error saving product:', err);
            this.showToast('Error saving product: ' + err.message, 'error');
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = _editingProductId ? 'Update Product' : 'Save Product';
            }
          }
        };
      }
    },

    renderProductImagePreviews() {
      const container = document.getElementById('prodImagePreviewContainer');
      if (!container) return;
      container.innerHTML = '';

      this.existingProdImages.forEach((url, idx) => {
        if (!url) return;
        const box = document.createElement('div');
        box.style.cssText = 'position:relative; width:100px; height:100px; border-radius:8px; overflow:hidden; border:1px solid #cbd5e1; background:#f1f5f9; display:flex; align-items:center; justify-content:center;';
        box.innerHTML = `
          <img src="${url}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none';" />
          <button type="button" style="position:absolute; top:4px; right:4px; background:rgba(239,68,68,0.92); color:white; border:none; border-radius:50%; width:22px; height:22px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.2);" onclick="AdminApp.removeExistingImage(${idx})">✕</button>
        `;
        container.appendChild(box);
      });

      this.pendingProdFiles.forEach((item, idx) => {
        const box = document.createElement('div');
        box.style.cssText = 'position:relative; width:100px; height:100px; border-radius:8px; overflow:hidden; border:2px solid #2563eb; background:#f1f5f9; display:flex; align-items:center; justify-content:center;';
        
        const img = document.createElement('img');
        img.style.cssText = 'width:100%; height:100%; object-fit:cover;';
        img.src = item.previewUrl || '';
        img.onerror = function() { this.style.display = 'none'; };

        box.appendChild(img);
        box.innerHTML += `<button type="button" style="position:absolute; top:4px; right:4px; background:rgba(239,68,68,0.92); color:white; border:none; border-radius:50%; width:22px; height:22px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.2);" onclick="AdminApp.removePendingImage(${idx})">✕</button>`;
        container.appendChild(box);
      });
    },

    removeExistingImage(index) {
      this.existingProdImages.splice(index, 1);
      this.renderProductImagePreviews();
    },

    removePendingImage(index) {
      this.pendingProdFiles.splice(index, 1);
      this.renderProductImagePreviews();
    },

    bindForms() {
      const catFile = document.getElementById('catImageFile');
      if (catFile) {
        catFile.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (file) {
            this.pendingCatFile = file;
            const compressed = await compressImageFile(file, 200 * 1024);
            const dataUrl = await fileToDataUrl(compressed);
            const imgPrev = document.getElementById('catImagePreview');
            if (imgPrev) {
              imgPrev.src = dataUrl;
              imgPrev.style.display = 'block';
            }
          }
        });
      }

      const catForm = document.getElementById('categoryForm');
      if (catForm) {
        catForm.onsubmit = async (e) => {
          e.preventDefault();
          const name = document.getElementById('catName').value.trim();

          if (!name) {
            this.showToast('Please enter category name', 'error');
            return;
          }

          let finalImageUrl = document.getElementById('catImagePreview').src || '';

          if (this.pendingCatFile) {
            this.showToast('Compressing & Uploading category thumbnail (<200KB)...', 'info');
            const uploadedUrl = await uploadImageToSupabase(this.pendingCatFile, 'categories');
            if (uploadedUrl) {
              finalImageUrl = uploadedUrl;
            }
          }

          const categoryPayload = {
            id: _editingCategoryId ? String(_editingCategoryId) : ('cat_' + Date.now()),
            name,
            thumbnail_url: finalImageUrl,
            created_at: new Date().toISOString()
          };

          await AdminService.saveCategory(categoryPayload);
          this.showToast(_editingCategoryId ? `Category "${name}" updated!` : `Category "${name}" created!`, 'success');
          this.resetCategoryForm();
          await this.renderCategories();
        };
      }

      const prodFile = document.getElementById('prodImageFile');
      if (prodFile) {
        prodFile.addEventListener('change', async (e) => {
          const files = Array.from(e.target.files);
          if (files.length > 0) {
            this.showToast(`Loading ${files.length} image previews...`, 'info');
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const compressed = await compressImageFile(file, 200 * 1024);
              const previewUrl = await fileToDataUrl(compressed);
              this.pendingProdFiles.push({
                file: compressed,
                previewUrl: previewUrl
              });
            }
            this.renderProductImagePreviews();
          }
        });
      }
    },

    showToast(message, type = 'info') {
      let container = document.getElementById('adminToastContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'adminToastContainer';
        container.style.cssText = `
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 8px;
          pointer-events: none;
        `;
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.style.cssText = `
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#2563eb'};
        color: white;
        padding: 12px 18px;
        border-radius: 8px;
        font-size: 0.88rem;
        font-weight: 700;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
        pointer-events: auto;
      `;
      toast.textContent = message;

      container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  };

  // ============================================================================
  // VAPID WEB PUSH & REALTIME ORDER NOTIFICATIONS ENGINE
  // ============================================================================
  const VAPID_CONFIG = {
    subject: "mailto:barchi.furniture@gmail.com",
    publicKey: "BLRlIrTI65YeYRK_UbJyEbtYpz6b6zLFs5NNG9-VzFT3CYQ2D_hmm8RQ0qf9UsTBEfXjNnw2FSqkaZnI7IX6wuM",
    privateKey: "PysO4tsQFkzs3JXEQXXKgM2sZBSa4e4OwJltFZUhOPM"
  };

  let _swRegistration = null;

  function playAdminOrderChime() {
    // Notification chime sound removed per user request
  }

  let _knownOrderIds = new Set();
  let _orderPollingInterval = null;

  async function startAdminOrderPolling() {
    if (_orderPollingInterval) clearInterval(_orderPollingInterval);

    try {
      const existing = await AdminService.getOrders();
      if (Array.isArray(existing)) {
        existing.forEach(o => _knownOrderIds.add(String(o.id)));
      }
    } catch(e) {}

    _orderPollingInterval = setInterval(async () => {
      try {
        const freshOrders = await AdminService.getOrders();
        if (Array.isArray(freshOrders)) {
          const brandNewOrders = freshOrders.filter(o => !_knownOrderIds.has(String(o.id)));
          if (brandNewOrders.length > 0) {
            brandNewOrders.forEach(o => _knownOrderIds.add(String(o.id)));

            if (window.AdminApp) {
              if (document.getElementById('statTotalOrders')) window.AdminApp.renderDashboard();
              if (document.getElementById('ordersTableBody')) window.AdminApp.renderOrders();
            }

            for (const newOrd of brandNewOrders) {
              handleIncomingOrderNotification(newOrd);
            }
          }
        }
      } catch(e) {
        console.warn('Order polling notice:', e);
      }
    }, 10000);
  }

  async function registerAdminPWAAndNotifications() {
    startAdminOrderPolling();

    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        _swRegistration = await navigator.serviceWorker.ready;
        console.log('Admin PWA ServiceWorker active & ready with VAPID Push support!');
        
        await ensurePushSubscribed();
      } catch (err) {
        console.warn('ServiceWorker registration notice:', err);
      }
    }

    try {
      const channel = new BroadcastChannel('barchi_order_broadcast');
      channel.onmessage = (e) => {
        if (e.data && e.data.type === 'NEW_ORDER_PLACED') {
          handleIncomingOrderNotification(e.data.order);
        }
      };
    } catch (e) {}

    window.addEventListener('storage', (e) => {
      if (e.key === 'barchi_order_id' && e.newValue) {
        const orders = JSON.parse(localStorage.getItem('barchi_saved_orders_v1')) || [];
        const latest = orders.find(o => String(o.id) === String(e.newValue)) || orders[0];
        if (latest) handleIncomingOrderNotification(latest);
      }
    });

    if (isSupabaseLive()) {
      try {
        _supabaseClient
          .channel('admin_live_orders')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
            if (payload && payload.new) {
              handleIncomingOrderNotification(payload.new);
            }
          })
          .subscribe();
      } catch (e) {}
    }
  }

  function handleIncomingOrderNotification(ord) {
    playAdminOrderChime();

    const title = `🚨 NEW ORDER RECEIVED: #${ord.id || 'ORD'}`;
    const body = `Client: ${ord.client_name || 'Barchi Customer'} | Total: ₹${(parseFloat(ord.total_amount) || 0).toLocaleString()}`;

    if (window.AdminApp && window.AdminApp.showToast) {
      window.AdminApp.showToast(`🚨 ${title} - ${body}`, 'success');
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      if (_swRegistration && _swRegistration.active) {
        _swRegistration.active.postMessage({
          type: 'NEW_ORDER_NOTIFICATION',
          order: ord
        });
      } else {
        try {
          new Notification(title, {
            body: body,
            icon: './icon-192.png',
            tag: 'barchi-order-' + (ord.id || Date.now())
          });
        } catch (e) {}
      }
    }

    if (window.AdminApp) {
      if (document.getElementById('statTotalOrders')) window.AdminApp.renderDashboard();
      if (document.getElementById('ordersTableBody')) window.AdminApp.renderOrders();
    }
  }

  async function requestAdminNotificationPermission() {
    togglePushSubscription();
  }

  const urlB64ToUint8 = (b64) => {
    if (!b64 || typeof b64 !== 'string') return new Uint8Array();
    const cleaned = b64.trim().replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - cleaned.length % 4) % 4);
    const raw = atob(cleaned + pad);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) {
      output[i] = raw.charCodeAt(i);
    }
    return output;
  };

  async function getVapidPublicKey() {
    try {
      const res = await fetch('/api/get-config');
      if (res.ok) {
        const data = await res.json();
        if (data && data.vapidPublicKey) return data.vapidPublicKey;
      }
    } catch(e) {}
    return VAPID_CONFIG.publicKey;
  }

  async function savePushSubscriptionToSupabase(subJSON) {
    if (!subJSON || !subJSON.endpoint || !subJSON.keys) return false;

    let savedOk = false;

    try {
      const res = await fetch('/api/save-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subJSON })
      });
      const data = await res.json();
      if (data && data.success) savedOk = true;
    } catch (e) {
      console.warn('Vercel api save-subscription notice:', e);
    }

    if (getSupabaseClient()) {
      try {
        await getSupabaseClient().from('push_subscriptions').delete().gte('id', 0);
        const { error } = await getSupabaseClient().from('push_subscriptions').insert({
          endpoint: subJSON.endpoint,
          p256dh: subJSON.keys.p256dh,
          auth: subJSON.keys.auth,
          updated_at: new Date().toISOString()
        });
        if (!error) savedOk = true;
      } catch (e) {
        console.warn('Direct Supabase insert notice:', e);
      }
    }

    return savedOk;
  }

  async function ensurePushSubscribed() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      updatePushNotificationUI('unsupported');
      return null;
    }

    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      _swRegistration = await navigator.serviceWorker.ready;
    } catch (e) {
      console.warn('ServiceWorker ready error:', e);
      return null;
    }

    let pushSub = await _swRegistration.pushManager.getSubscription();

    if (!pushSub && Notification.permission === 'granted') {
      try {
        const pubKey = await getVapidPublicKey();
        const appServerKey = urlB64ToUint8(pubKey);
        pushSub = await _swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey
        });
      } catch(e) {
        console.warn('Auto subscribe error:', e);
      }
    }

    if (pushSub) {
      const subJSON = pushSub.toJSON();
      localStorage.setItem('barchi_push_sub', JSON.stringify(subJSON));
      savePushSubscriptionToSupabase(subJSON);
      updatePushNotificationUI('subscribed');
      return pushSub;
    } else {
      updatePushNotificationUI(Notification.permission === 'denied' ? 'denied' : 'idle');
      return null;
    }
  }

  async function togglePushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported in this browser.');
      return;
    }

    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      _swRegistration = await navigator.serviceWorker.ready;
    } catch (e) {
      alert('Service Worker activation error: ' + e.message);
      return;
    }

    if (Notification.permission === 'denied') {
      alert('Notifications are blocked in browser settings. Please allow notifications for this site in Chrome site settings.');
      updatePushNotificationUI('denied');
      return;
    }

    let perm = Notification.permission;
    if (perm !== 'granted') {
      perm = await Notification.requestPermission();
    }

    if (perm !== 'granted') {
      alert('Notification permission was not granted.');
      updatePushNotificationUI('denied');
      return;
    }

    try {
      let pushSub = await _swRegistration.pushManager.getSubscription();
      if (!pushSub) {
        const pubKey = await getVapidPublicKey();
        const appServerKey = urlB64ToUint8(pubKey);
        pushSub = await _swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey
        });
      }

      const subJSON = pushSub.toJSON();
      localStorage.setItem('barchi_push_sub', JSON.stringify(subJSON));
      await savePushSubscriptionToSupabase(subJSON);

      playAdminOrderChime();
      updatePushNotificationUI('subscribed');
      alert('🔔 Notifications Active! You will receive instant order push alerts even when the app is closed.');
    } catch (err) {
      console.error('Push subscribe error:', err);
      alert('Subscribe error: ' + err.message);
    }
  }

  async function sendTestPush() {
    let pushSub = null;
    if (_swRegistration) {
      try {
        pushSub = await _swRegistration.pushManager.getSubscription();
      } catch(e) {}
    }

    if (!pushSub) {
      pushSub = await ensurePushSubscribed();
    }

    if (!pushSub) {
      const saved = localStorage.getItem('barchi_push_sub');
      if (saved) {
        try { pushSub = JSON.parse(saved); } catch(e) {}
      }
    }

    if (!pushSub) {
      alert('Please click "Enable Notifications" first to activate notifications!');
      return;
    }

    const subJSON = (typeof pushSub.toJSON === 'function') ? pushSub.toJSON() : pushSub;

    playAdminOrderChime();

    if (_swRegistration && _swRegistration.active) {
      try {
        _swRegistration.active.postMessage({
          type: 'NEW_ORDER_NOTIFICATION',
          order: {
            id: 'TEST-' + Math.floor(1000 + Math.random() * 9000),
            client_name: 'Test Customer',
            total_amount: 15000
          }
        });
      } catch(e) {}
    } else if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('🛒 Barchi Admin — Test Push', {
          body: 'Push notifications are ACTIVE! You will get instant alerts on new orders even when closed.',
          icon: './icon-192.png'
        });
      } catch(e) {}
    }

    try {
      const res = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subJSON,
          title: '🛒 Barchi Admin — Test Push',
          message: 'Push notifications are ACTIVE! You will get instant alerts on new orders even when closed.',
          url: '/orders.html'
        })
      });
      const data = await res.json();
      if (data && data.success) {
        alert('✅ Test push notification sent! Check your phone notification center.');
      } else {
        alert('✅ Test notification triggered on device!');
      }
    } catch (err) {
      alert('✅ Test notification triggered on device!');
    }
  }

  function updatePushNotificationUI(state) {
    const btns = document.querySelectorAll('#pushToggleBtn, .push-toggle-btn');
    if (!btns || btns.length === 0) return;

    const isSub = (state === 'subscribed' || state === true);
    const isDenied = (state === 'denied');

    btns.forEach(btn => {
      if (isSub) {
        btn.style.background = '#10b981';
        btn.style.color = '#ffffff';
        btn.innerHTML = `
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
          Notifications Active ✓
        `;
      } else if (isDenied) {
        btn.style.background = '#ef4444';
        btn.style.color = '#ffffff';
        btn.innerHTML = `
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
          Notifications Blocked
        `;
      } else {
        btn.style.background = 'var(--accent-primary, #2563eb)';
        btn.style.color = '#ffffff';
        btn.innerHTML = `
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
          Enable Notifications
        `;
      }
    });
  }

  window.requestAdminNotificationPermission = requestAdminNotificationPermission;
  window.togglePushSubscription = togglePushSubscription;
  window.sendTestPush = sendTestPush;
  window.registerAdminPWAAndNotifications = registerAdminPWAAndNotifications;

  // Expose to window safely
  window.AdminService = AdminService;
  window.AdminApp = AdminApp;

  // Initialize Admin App safely
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.AdminApp) window.AdminApp.init();
    });
  } else {
    if (window.AdminApp) window.AdminApp.init();
  }
})();
