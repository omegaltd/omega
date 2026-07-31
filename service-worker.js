// ==================== SERVICE WORKER - PUSH NOTIFICATIONS ====================

const CACHE_NAME = 'omega-v7';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/omega-part2.js',
  '/omega-fixes.js'
];

// Install
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {
        console.log('[SW] Cache add failed - offline mode');
      });
    })
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (!response || response.status !== 200) {
          return caches.match(e.request);
        }

        let responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseClone);
        });

        return response;
      })
      .catch(() => {
        return caches.match(e.request).then((response) => {
          return response || new Response('Offline', { status: 503 });
        });
      })
  );
});

// Push Notifications
self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch (err) {
    data = { title: 'Omega', body: e.data?.text() || 'Новое сообщение' };
  }

  const options = {
    body: data.body || 'Новое сообщение',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%23dc143c" width="192" height="192"/><text x="96" y="120" font-size="120" font-weight="bold" fill="white" text-anchor="middle">&Omega;</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect fill="%23dc143c" width="96" height="96"/><text x="48" y="60" font-size="60" font-weight="bold" fill="white" text-anchor="middle">&Omega;</text></svg>',
    tag: data.tag || 'omega-' + Date.now(),
    vibrate: [200, 100, 200],
    data: data.url ? { url: data.url } : {},
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'close', title: 'Закрыть' }
    ]
  };

  e.waitUntil(
    self.registration.showNotification(data.title || 'Omega Messenger', options)
  );
});

// Notification Click
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  if (e.action === 'close') {
    return;
  }

  let url = (e.notification.data && e.notification.data.url) || '/';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (let c of list) {
        if (c.url === url && 'focus' in c) {
          return c.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Background Sync
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-messages') {
    e.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  try {
    const response = await fetch('/api/sync-messages');
    return response.json();
  } catch (e) {
    console.error('[SW] Sync error:', e);
    return Promise.reject(e);
  }
}

// Periodic Background Sync (если поддерживается)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (e) => {
    if (e.tag === 'check-messages') {
      e.waitUntil(checkNewMessages());
    }
  });
}

async function checkNewMessages() {
  try {
    const response = await fetch('/api/check-messages');
    const data = await response.json();

    if (data.unread && data.unread > 0) {
      await self.registration.showNotification('Omega Messenger', {
        body: `У вас ${data.unread} новое сообщение(й)`,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%23dc143c" width="192" height="192"/><text x="96" y="120" font-size="120" font-weight="bold" fill="white" text-anchor="middle">&Omega;</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect fill="%23dc143c" width="96" height="96"/><text x="48" y="60" font-size="60" font-weight="bold" fill="white" text-anchor="middle">&Omega;</text></svg>',
        tag: 'new-messages',
        requireInteraction: true
      });
    }
  } catch (e) {
    console.error('[SW] Check messages error:', e);
  }
}

console.log('[SW] Service Worker loaded - v7');
