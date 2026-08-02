// ============================================================================
// BARCHI FURNITURE ADMIN - SERVICE WORKER & WEB PUSH ORDER NOTIFICATIONS
// ============================================================================

const CACHE_NAME = 'barchi-admin-pwa-v2';
const VAPID_PUBLIC_KEY = 'BLRlIrTI65YeYRK_UbJyEbtYpz6b6zLFs5NNG9-VzFT3CYQ2D_hmm8RQ0qf9UsTBEfXjNnw2FSqkaZnI7IX6wuM';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './orders.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Non-critical asset cache notice:', err);
      });
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// LISTEN FOR PUSH NOTIFICATIONS FROM SERVER / WEB PUSH VAPID
self.addEventListener('push', (e) => {
  let data = {};
  if (e.data) {
    try {
      data = e.data.json();
    } catch (err) {
      data = { title: '🚨 NEW BARCHI ORDER RECEIVED!', body: e.data.text() };
    }
  } else {
    data = {
      title: '🚨 NEW BARCHI ORDER RECEIVED!',
      body: 'A customer has placed a new order. Tap to view order details.'
    };
  }

  const title = data.title || '🚨 NEW BARCHI ORDER RECEIVED!';
  const options = {
    body: data.body || 'New customer order placed on website.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    image: '/icon-512.png',
    vibrate: [300, 100, 300, 100, 300, 100, 500],
    data: { url: '/orders.html', orderId: data.orderId || '' },
    tag: 'barchi-order-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    silent: false,
    actions: [
      { action: 'view_order', title: '📦 View Order Details' },
      { action: 'close', title: 'Close' }
    ]
  };

  e.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// LISTEN FOR POSTMESSAGE EVENTS FROM APP (REALTIME LOCAL ORDER TRIGGER)
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'NEW_ORDER_NOTIFICATION') {
    const ord = e.data.order || {};
    const title = `🚨 NEW ORDER RECEIVED: #${ord.id || 'ORD'}`;
    const body = `Client: ${ord.client_name || 'Barchi Customer'} | Total: ₹${(parseFloat(ord.total_amount) || 0).toLocaleString()}`;

    const options = {
      body: body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [250, 100, 250, 100, 300],
      data: { url: './orders.html', orderId: ord.id },
      tag: 'barchi-new-order-' + (ord.id || Date.now()),
      renotify: true
    };

    self.registration.showNotification(title, options);
  }
});

// NOTIFICATION CLICK EVENT HANDLER
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const targetUrl = (e.notification.data && e.notification.data.url) ? e.notification.data.url : './orders.html';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('orders.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
