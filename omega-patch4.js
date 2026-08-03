// ==================== OMEGA PATCH 4 ====================
// 1. Фикс видео-кружков (Blob URL + chunked base64)
// 2. FCM Web Push с реальным VAPID ключом
// ============================================================

(function(){

// ============================================================
// 1. ФИКС ВИДЕО-КРУЖКОВ
// ============================================================

// Конвертация base64 -> Blob -> Object URL (чанками, без зависания UI)
function base64ToBlob(base64, mime) {
  try {
    // Убираем data:...;base64, префикс если есть
    let b64 = base64;
    if (base64.includes(',')) {
      let parts = base64.split(',');
      if (!mime) {
        let m = parts[0].match(/data:(.*?);base64/);
        if (m) mime = m[1];
      }
      b64 = parts[1];
    }
    if (!mime) mime = 'video/webm';

    let byteChars = atob(b64);
    let chunkSize = 512;
    let chunks = [];
    for (let i = 0; i < byteChars.length; i += chunkSize) {
      let slice = byteChars.slice(i, i + chunkSize);
      let bytes = new Uint8Array(slice.length);
      for (let j = 0; j < slice.length; j++) {
        bytes[j] = slice.charCodeAt(j);
      }
      chunks.push(bytes);
    }
    return new Blob(chunks, { type: mime });
  } catch(e) {
    console.error('[VNote] base64ToBlob error:', e);
    return null;
  }
}

// Кэш Blob URL: msgId -> blobUrl
window._vnoteBlobCache = window._vnoteBlobCache || {};

function getVNoteBlobUrl(m) {
  if (window._vnoteBlobCache[m._id]) {
    return window._vnoteBlobCache[m._id];
  }
  if (!m.media) return '';

  // Если уже обычный URL (не data:) — возвращаем как есть
  if (!m.media.startsWith('data:')) {
    return m.media;
  }

  let blob = base64ToBlob(m.media, 'video/webm');
  if (!blob) return m.media;
  let url = URL.createObjectURL(blob);
  window._vnoteBlobCache[m._id] = url;
  return url;
}

function revokeVNoteBlobUrl(id) {
  if (window._vnoteBlobCache[id]) {
    try { URL.revokeObjectURL(window._vnoteBlobCache[id]); } catch(e) {}
    delete window._vnoteBlobCache[id];
  }
}

// Переопределяем buildVNoteHtml — используем Blob URL
window.buildVNoteHtml = function(m) {
  let dur = (typeof fmtDur === 'function') ? fmtDur(m.duration || 0)
          : (typeof formatDur === 'function') ? formatDur(m.duration || 0)
          : '0:00';

  // Blob URL генерируем асинхронно после вставки в DOM
  // Сначала ставим пустой src, потом патчим
  let tmpId = 'vnv_' + m._id;

  // Генерим URL синхронно (base64 -> blob -> objectURL)
  let src = '';
  try {
    src = getVNoteBlobUrl(m);
  } catch(e) {
    src = '';
  }

  return '<div class="vnote-bubble" id="vn_' + m._id + '">' +
    '<div class="vnote-circle" onclick="toggleVNPlay(\'' + m._id + '\')">' +
      '<video id="' + tmpId + '" src="' + src + '" playsinline preload="metadata" ' +
        'onerror="omegaVNoteLoadErr(this,\'' + m._id + '\')">' +
      '</video>' +
      '<div class="vnote-ring" id="vnring_' + m._id + '"></div>' +
      '<div class="vnote-playbtn" id="vnplay_' + m._id + '">▶</div>' +
    '</div>' +
    '<div class="vnote-dur" id="vndur_' + m._id + '">' + dur + '</div>' +
  '</div>';
};

// Fallback: если src не загрузился — пробуем заново через Blob
window.omegaVNoteLoadErr = function(videoEl, msgId) {
  // Уже пробовали blob — выходим
  if (videoEl.dataset.blobTried) return;
  videoEl.dataset.blobTried = '1';

  // Достаём оригинальный media из кэша сообщений
  // (ищем в DOM data-атрибут или запрашиваем из Firebase)
  let path = getMPath();
  if (!path) return;
  db.ref(path + '/messages/' + msgId).once('value').then(sn => {
    if (!sn.exists()) return;
    let m = sn.val(); m._id = msgId;
    if (!m.media) return;
    // Сбрасываем кэш и пересоздаём
    revokeVNoteBlobUrl(msgId);
    let blob = base64ToBlob(m.media, 'video/webm');
    if (!blob) return;
    let url = URL.createObjectURL(blob);
    window._vnoteBlobCache[msgId] = url;
    videoEl.src = url;
    videoEl.load();
  }).catch(() => {});
};

// Чистим blob URL при удалении сообщения
(function patchDelMsgVNote(){
  const _prev = window.delMsg;
  window.delMsg = async function(mid, all) {
    revokeVNoteBlobUrl(mid);
    if (_prev) await _prev(mid, all);
  };
})();

// Чистим blob URL при выходе из чата
(function patchGoBackVNote(){
  const _prev = window.goBack;
  window.goBack = function() {
    // Отзываем все blob URL текущего чата
    Object.keys(window._vnoteBlobCache).forEach(id => revokeVNoteBlobUrl(id));
    if (_prev) _prev();
  };
})();

// ============================================================
// 2. FCM WEB PUSH
// ============================================================

const OMEGA_VAPID_KEY = 'BPPp0QQDY6qcEGUF_RXrqTALFDNKg9A8wwU2x9zz4RDkHeERGpVrScUftIuSAICnyOAIluflE77tJ0RYpAabaDU';

// SW код с FCM поддержкой (отдельный файл не нужен — используем Blob SW)
const FCM_SW_CODE = `
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyExample",
  authDomain: "omega-e3d75.firebaseapp.com",
  databaseURL: "https://omega-e3d75-default-rtdb.firebaseio.com",
  projectId: "omega-e3d75",
  storageBucket: "omega-e3d75.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || 'Omega', {
    body: n.body || 'Новое сообщение',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%23dc143c" width="192" height="192"/><text x="96" y="120" font-size="120" font-weight="bold" fill="white" text-anchor="middle">%26Omega%3B</text></svg>',
    tag: 'omega-' + Date.now(),
    vibrate: [150, 80, 150],
    data: payload.data || {}
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
    for (let c of list) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('/');
  }));
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) { data = {}; }
  const options = {
    body: data.body || 'Новое сообщение',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%23dc143c" width="192" height="192"/><text x="96" y="120" font-size="120" font-weight="bold" fill="white" text-anchor="middle">%26Omega%3B</text></svg>',
    tag: data.tag || 'omega-push',
    vibrate: [150, 80, 150]
  };
  e.waitUntil(self.registration.showNotification(data.title || 'Omega', options));
});
`;

// ---- Регистрируем FCM SW через Blob (не нужен отдельный файл) ----
async function registerFCMServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    // Проверяем, есть ли уже зарегистрированный SW
    let existing = await navigator.serviceWorker.getRegistration('/');
    if (existing) return existing;

    let blob = new Blob([FCM_SW_CODE], { type: 'application/javascript' });
    let swUrl = URL.createObjectURL(blob);
    let reg = await navigator.serviceWorker.register(swUrl, { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch(e) {
    console.warn('[FCM SW] Blob SW failed, trying /service-worker.js:', e.message);
    try {
      let reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      return reg;
    } catch(e2) {
      console.warn('[FCM SW] /service-worker.js also failed:', e2.message);
      return null;
    }
  }
}

// ---- Получаем FCM токен через Push API (без FCM SDK — только VAPID) ----
async function getVAPIDPushSubscription(swReg) {
  try {
    let existing = await swReg.pushManager.getSubscription();
    if (existing) return existing;

    let sub = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(OMEGA_VAPID_KEY)
    });
    return sub;
  } catch(e) {
    console.warn('[FCM] pushManager.subscribe failed:', e.message);
    return null;
  }
}

function urlBase64ToUint8Array(base64String) {
  let padding = '='.repeat((4 - base64String.length % 4) % 4);
  let base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  let rawData = atob(base64);
  let outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ---- Сохраняем подписку в Firebase ----
async function savePushSubscription(sub) {
  if (!S.user || !sub) return;
  let ua = navigator.userAgent.toLowerCase();
  let platform = /android/.test(ua) ? 'android' : /iphone|ipad|ipod/.test(ua) ? 'ios' : 'web';
  try {
    let subJSON = sub.toJSON();
    await db.ref('pushSubscriptions/' + platform + '/' + S.user).set({
      endpoint: subJSON.endpoint,
      keys: subJSON.keys,
      platform: platform,
      updatedAt: Date.now(),
      userAgent: navigator.userAgent.substring(0, 120)
    });
    console.log('[FCM] Push subscription saved:', platform);
  } catch(e) {
    console.warn('[FCM] Save subscription failed:', e.message);
  }
}

// ---- Основная инициализация FCM ----
async function initWebPush() {
  if (!S.user) return;
  if (!('Notification' in window)) {
    console.log('[FCM] Notifications not supported');
    return;
  }

  // Запрашиваем разрешение
  let perm = Notification.permission;
  if (perm === 'denied') {
    console.log('[FCM] Notifications denied by user');
    return;
  }
  if (perm === 'default') {
    try {
      perm = await Notification.requestPermission();
    } catch(e) {
      console.warn('[FCM] requestPermission error:', e.message);
      return;
    }
  }
  if (perm !== 'granted') return;

  // Регистрируем SW
  let swReg = await registerFCMServiceWorker();
  if (!swReg) {
    console.warn('[FCM] No SW registration, using fallback notifications only');
    return;
  }
  S.swRegistration = swReg;

  // Получаем Push подписку
  let sub = await getVAPIDPushSubscription(swReg);
  if (!sub) {
    console.warn('[FCM] No push subscription');
    return;
  }

  // Сохраняем в Firebase
  await savePushSubscription(sub);

  // Слушаем foreground push через SW message
  navigator.serviceWorker.addEventListener('message', event => {
    let d = event.data;
    if (d && d.type === 'PUSH_MSG') {
      showNotif(d.title || 'Omega', d.body || 'Новое сообщение');
    }
  });

  console.log('[FCM] Web Push initialized successfully');
}

// ---- Отписка ----
async function unsubscribeWebPush() {
  try {
    let reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) return;
    let sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    let ua = navigator.userAgent.toLowerCase();
    let platform = /android/.test(ua) ? 'android' : /iphone|ipad|ipod/.test(ua) ? 'ios' : 'web';
    await db.ref('pushSubscriptions/' + platform + '/' + S.user).remove();
    toast('Push уведомления отключены');
  } catch(e) {
    console.warn('[FCM] Unsubscribe error:', e.message);
  }
}
window.unsubscribeWebPush = unsubscribeWebPush;

// ---- Просмотр Push подписок в debug меню ----
async function showPushSubscriptions() {
  if (S.rank < 8 && !isDev(S.uname)) { toast('Нет доступа', true); return; }
  closeDebugPanel();
  try {
    let sn = await db.ref('pushSubscriptions').once('value');
    let data = sn.exists() ? sn.val() : {};
    let total = 0;
    let html = '';
    ['web', 'android', 'ios'].forEach(pl => {
      let entries = Object.entries(data[pl] || {});
      total += entries.length;
      let icon = pl === 'web' ? '🌐' : pl === 'android' ? '🤖' : '🍎';
      html += '<div style="margin-bottom:12px;padding:10px;background:var(--bg3);border-radius:8px;border:1px solid var(--custom-border)">';
      html += '<b style="color:var(--acc)">' + icon + ' ' + pl.toUpperCase() + ' (' + entries.length + ')</b>';
      if (!entries.length) {
        html += '<p style="color:var(--t3);font-size:.82em;margin:6px 0">Нет подписчиков</p>';
      } else {
        entries.forEach(([user, v]) => {
          let upd = v.updatedAt ? new Date(v.updatedAt).toLocaleString('ru') : '—';
          html += '<div style="padding:6px 0;border-top:1px solid var(--brd);font-size:.82em">' +
            '<b>' + esc(user) + '</b> <span style="color:var(--t3)">' + upd + '</span>' +
            '<button onclick="delPushSub(\'' + pl + '\',\'' + user + '\')" style="margin-left:8px;background:var(--err);color:#fff;border:none;border-radius:4px;padding:1px 6px;cursor:pointer;font-size:.72em">✕</button>' +
            '</div>';
        });
      }
      html += '</div>';
    });

    let modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'pushSubsModal';
    modal.innerHTML = '<div class="modal" style="max-height:85vh">' +
      '<button class="modal-close" onclick="document.getElementById(\'pushSubsModal\').remove()">×</button>' +
      '<h2>📡 Push подписки</h2>' +
      '<div style="text-align:center;padding:4px 0 10px;font-size:.85em;color:var(--t2)">Всего: <b style="color:var(--acc)">' + total + '</b></div>' +
      '<div class="modal-body">' + html +
      '<button class="btn btn-danger" onclick="clearAllPushSubs()">🗑 Очистить все</button>' +
      '</div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  } catch(e) { toast('Ошибка: ' + e.message, true); }
}
window.showPushSubscriptions = showPushSubscriptions;

window.delPushSub = async function(pl, user) {
  try {
    await db.ref('pushSubscriptions/' + pl + '/' + user).remove();
    toast('Подписка удалена');
    showPushSubscriptions();
  } catch(e) { toast('Ошибка', true); }
};

window.clearAllPushSubs = async function() {
  let ok = await confirm2('Удалить все Push подписки?'); if (!ok) return;
  try {
    await db.ref('pushSubscriptions').remove();
    toast('Все подписки удалены');
    let m = document.getElementById('pushSubsModal');
    if (m) m.remove();
  } catch(e) { toast('Ошибка', true); }
};

// ---- Добавляем пункт в debug меню ----
function addPushSubsToDebugMenu() {
  let dp = $('debugPanel');
  if (!dp || dp.querySelector('#debugPushSubsItem')) return;
  let item = document.createElement('div');
  item.id = 'debugPushSubsItem';
  item.className = 'debug-item';
  item.innerHTML = '<div class="debug-item-title">📡 Push подписки</div><div class="debug-item-desc">Просмотр Web Push подписок</div>';
  item.onclick = () => showPushSubscriptions();
  dp.appendChild(item);
}

// ---- Перехватываем afterLogin для инициализации ----
(function patchAfterLoginFCM(){
  const _prev = window.afterLogin;
  window.afterLogin = async function() {
    await _prev();
    // Небольшая задержка чтобы S.user точно был установлен
    setTimeout(() => initWebPush(), 1500);
    setTimeout(() => {
      addPushSubsToDebugMenu();
    }, 2000);
  };
})();

// Если уже залогинен (init уже прошёл)
if (S && S.user) {
  setTimeout(() => initWebPush(), 500);
  setTimeout(() => addPushSubsToDebugMenu(), 1000);
}

console.log('✅ omega-patch4.js: VNote blob fix + Web Push VAPID initialized');
})();