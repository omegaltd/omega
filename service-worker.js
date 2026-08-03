// ==================== OMEGA SERVICE WORKER (автономный, без CDN) ====================
const CACHE_NAME = 'omega-v8';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(names => Promise.all(
      names.map(n => n !== CACHE_NAME ? caches.delete(n) : null)
    )).then(() => self.clients.claim())
  );
});

function omegaIcon() {
  return 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 192 192\'%3E%3Crect fill=\'%23dc143c\' width=\'192\' height=\'192\'/%3E%3Ctext x=\'96\' y=\'128\' font-size=\'120\' font-weight=\'bold\' fill=\'white\' text-anchor=\'middle\'%3E%26%23937%3B%3C/text%3E%3C/svg%3E';
}

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; }
  catch (err) {
    try { data = { title: 'Omega', body: e.data ? e.data.text() : 'Новое сообщение' }; }
    catch (err2) { data = { title: 'Omega', body: 'Новое сообщение' }; }
  }
  const options = {
    body: data.body || 'Новое сообщение',
    icon: data.icon || omegaIcon(),
    badge: omegaIcon(),
    tag: data.tag || ('omega-' + Date.now()),
    vibrate: [150, 80, 150, 80, 150],
    requireInteraction: false,
    renotify: true,
    data: { url: data.url || '/' }
  };
  e.waitUntil(self.registration.showNotification(data.title || 'Omega Messenger', options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  let url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (let c of list) { if ('focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Не кэшируем агрессивно — просто fallback офлайн
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

console.log('[SW] omega service-worker v8 (без внешних зависимостей)');
