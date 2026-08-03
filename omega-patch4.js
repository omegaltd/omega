// ==================== OMEGA PATCH 4 (v2) ====================
// 1. Видео-кружки — ПОЛНАЯ ПЕРЕЗАПИСЬ чтения (fetch->blob, без CDN-зависимостей, с fallback)
// 2. Web Push — устранение CDN-зависимости в SW (причина случайных сбоев) + ретраи подписки
// ============================================================

(function(){

// ============================================================
// CSS
// ============================================================
(function injectStyles(){
  let css = `
  .vnote-spinner{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    width:28px;height:28px;border:3px solid rgba(220,20,60,.25);border-top-color:var(--acc);
    border-radius:50%;animation:spin .6s linear infinite;z-index:3}
  .vnote-error{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;
    justify-content:center;background:rgba(0,0,0,.55);color:#fff;font-size:.72em;text-align:center;
    gap:3px;padding:8px;cursor:pointer;z-index:3}
  .vnote-error span{font-size:.85em;opacity:.85}
  .vnote-circle.omega-vn-error{border-color:var(--err)}
  `;
  let s = document.createElement('style');
  s.id = 'omegaPatch4Styles_v2';
  let old = document.getElementById('omegaPatch4Styles_v2');
  if (old) old.remove();
  s.textContent = css;
  document.head.appendChild(s);
})();

// ============================================================
// 1. ВИДЕО-КРУЖКИ — ПОЛНАЯ ПЕРЕЗАПИСЬ ЗАПИСИ + ЧТЕНИЯ
// ============================================================

window._omegaVNoteCache = window._omegaVNoteCache || {}; // id -> { url, mime, status }

function omegaFmtDur(s) {
  s = Math.round(s || 0);
  return Math.floor(s/60) + ':' + (s%60 < 10 ? '0' : '') + (s%60);
}

// ---------- НАДЁЖНАЯ КОНВЕРТАЦИЯ data:URI -> Blob ----------
async function omegaDataURLtoBlob(dataUrl, fallbackMime) {
  // Способ 1 — через fetch (самый надёжный, браузер сам разбирает base64)
  try {
    let res = await fetch(dataUrl);
    let blob = await res.blob();
    if (blob && blob.size > 0) return blob;
  } catch(e) {
    console.warn('[VNote] fetch->blob failed, fallback to manual decode:', e.message);
  }
  // Способ 2 — ручной разбор (запасной вариант)
  try {
    let commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    let header = dataUrl.substring(0, commaIdx);
    let base64 = dataUrl.substring(commaIdx + 1);
    let mimeMatch = header.match(/data:(.*?);base64/);
    let mime = mimeMatch ? mimeMatch[1] : (fallbackMime || 'video/webm');
    let binary = atob(base64);
    let len = binary.length;
    let bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch(e2) {
    console.error('[VNote] manual decode also failed:', e2.message);
    return null;
  }
}

function omegaRevokeVNote(id) {
  let c = window._omegaVNoteCache[id];
  if (c && c.url) { try { URL.revokeObjectURL(c.url); } catch(e) {} }
  delete window._omegaVNoteCache[id];
}

// ---------- РЕНДЕР (плейсхолдер сразу, медиа догружается асинхронно) ----------
window.buildVNoteHtml = function(m) {
  let id = m._id;
  let durText = omegaFmtDur(m.duration || 0);
  let mime = m.mimeType || 'video/webm';

  let html =
    '<div class="vnote-bubble" id="vn_' + id + '" data-dur="' + (m.duration || 0) + '" data-mime="' + esc(mime) + '">' +
      '<div class="vnote-circle" id="vnc_' + id + '" onclick="omegaVNoteClick(\'' + id + '\')">' +
        '<div class="vnote-spinner" id="vnspin_' + id + '"></div>' +
        '<video id="vnv_' + id + '" playsinline preload="none" style="display:none"></video>' +
        '<div class="vnote-ring" id="vnring_' + id + '"></div>' +
        '<div class="vnote-playbtn" id="vnplay_' + id + '" style="display:none">▶</div>' +
        '<div class="vnote-error" id="vnerr_' + id + '">⚠️<span>Скачать видео</span></div>' +
      '</div>' +
      '<div class="vnote-dur" id="vndur_' + id + '">' + durText + '</div>' +
    '</div>';

  // Асинхронная подгрузка сразу после вставки в DOM
  setTimeout(() => omegaLoadVNote(m), 10);

  return html;
};

async function omegaLoadVNote(m) {
  let id = m._id;
  if (!m.media) { omegaShowVNoteError(id); return; }

  // Если уже сконвертировано ранее — переиспользуем
  let cached = window._omegaVNoteCache[id];
  if (cached && cached.status === 'ready') { omegaApplyVNoteSrc(id, cached.url, cached.mime); return; }
  if (cached && cached.status === 'error') { omegaShowVNoteError(id); return; }

  window._omegaVNoteCache[id] = { url: null, mime: m.mimeType || 'video/webm', status: 'loading' };

  let mediaSrc = m.media;

  // Если это уже готовая ссылка (не data:), используем напрямую
  if (!mediaSrc.startsWith('data:')) {
    window._omegaVNoteCache[id] = { url: mediaSrc, mime: m.mimeType || 'video/webm', status: 'ready' };
    omegaApplyVNoteSrc(id, mediaSrc, m.mimeType || 'video/webm');
    return;
  }

  let blob = await omegaDataURLtoBlob(mediaSrc, m.mimeType);
  if (!blob) {
    window._omegaVNoteCache[id] = { url: null, mime: '', status: 'error' };
    omegaShowVNoteError(id);
    return;
  }

  let mime = m.mimeType || blob.type || 'video/webm';
  let url = URL.createObjectURL(blob);
  window._omegaVNoteCache[id] = { url, mime, status: 'ready' };
  omegaApplyVNoteSrc(id, url, mime);
}

function omegaApplyVNoteSrc(id, url, mime) {
  let v = $('vnv_' + id);
  let spin = $('vnspin_' + id);
  let playBtn = $('vnplay_' + id);
  let errEl = $('vnerr_' + id);
  if (!v) return;

  // Проверка поддержки кодека (если можем определить)
  let canPlay = true;
  try {
    if (mime && v.canPlayType) {
      let res = v.canPlayType(mime);
      if (res === '') canPlay = false;
    }
  } catch(e) {}

  if (!canPlay) {
    omegaShowVNoteError(id);
    return;
  }

  v.src = url;
  v.load();

  v.addEventListener('loadeddata', () => {
    if (spin) spin.style.display = 'none';
    v.style.display = 'block';
    if (playBtn) playBtn.style.display = 'flex';
    if (errEl) errEl.style.display = 'none';
  }, { once: true });

  v.addEventListener('error', () => {
    console.warn('[VNote] video element error for', id);
    omegaShowVNoteError(id);
  }, { once: true });

  // Таймаут на случай если событие loadeddata никогда не придёт
  setTimeout(() => {
    if (v.readyState === 0 && spin && spin.style.display !== 'none') {
      omegaShowVNoteError(id);
    }
  }, 8000);
}

function omegaShowVNoteError(id) {
  let spin = $('vnspin_' + id);
  let errEl = $('vnerr_' + id);
  let circle = $('vnc_' + id);
  if (spin) spin.style.display = 'none';
  if (errEl) errEl.style.display = 'flex';
  if (circle) circle.classList.add('omega-vn-error');
}

// ---------- КЛИК ПО КРУЖКУ: play/pause ИЛИ скачать при ошибке ----------
window.omegaVNoteClick = function(id) {
  let circle = $('vnc_' + id);
  if (circle && circle.classList.contains('omega-vn-error')) {
    // Скачиваем то что есть (cache может быть пуст — пробуем достать заново из БД)
    omegaDownloadVNote(id);
    return;
  }
  let v = $('vnv_' + id);
  let bubble = $('vn_' + id);
  if (!v || !v.src) { toast('Видео ещё загружается...'); return; }

  if (v.paused) {
    document.querySelectorAll('.vnote-circle video').forEach(ov => {
      if (ov !== v && !ov.paused) {
        ov.pause();
        let ob = ov.closest('.vnote-bubble');
        if (ob) ob.classList.remove('playing');
      }
    });
    v.play().catch(() => toast('Ошибка воспроизведения', true));
    if (bubble) bubble.classList.add('playing');
  } else {
    v.pause();
    if (bubble) bubble.classList.remove('playing');
  }
};

async function omegaDownloadVNote(id) {
  let cached = window._omegaVNoteCache[id];
  if (cached && cached.url) {
    let a = document.createElement('a');
    a.href = cached.url;
    a.download = 'video_' + id + '.webm';
    a.click();
    return;
  }
  toast('Видео недоступно для скачивания', true);
}

// ---------- Обновление кольца/таймера по СОХРАНЁННОЙ длительности (не video.duration) ----------
document.addEventListener('timeupdate', e => {
  if (!e.target.matches('.vnote-circle video')) return;
  let v = e.target;
  let bubble = v.closest('.vnote-bubble');
  if (!bubble) return;
  let id = bubble.id.replace('vn_', '');
  let storedDur = parseFloat(bubble.dataset.dur) || 0;
  let effectiveDur = (v.duration && isFinite(v.duration) && v.duration > 0) ? v.duration : storedDur;
  if (!effectiveDur) return;

  let ring = $('vnring_' + id);
  let durEl = $('vndur_' + id);
  let pct = Math.min(100, (v.currentTime / effectiveDur) * 100);
  if (ring) ring.style.background = 'conic-gradient(var(--acc) ' + pct + '%, transparent ' + pct + '%)';
  if (durEl) durEl.textContent = omegaFmtDur(v.currentTime);
}, true);

document.addEventListener('ended', e => {
  if (!e.target.matches('.vnote-circle video')) return;
  let v = e.target;
  let bubble = v.closest('.vnote-bubble');
  if (!bubble) return;
  let id = bubble.id.replace('vn_', '');
  let storedDur = parseFloat(bubble.dataset.dur) || 0;
  bubble.classList.remove('playing');
  let durEl = $('vndur_' + id);
  if (durEl) durEl.textContent = omegaFmtDur(storedDur);
  let ring = $('vnring_' + id);
  if (ring) ring.style.background = 'conic-gradient(var(--acc) 0%, transparent 0%)';
}, true);

// Чистим blob-URL при удалении сообщения и выходе из чата
(function patchDelMsgVNote2(){
  const _prev = window.delMsg;
  window.delMsg = async function(mid, all) {
    omegaRevokeVNote(mid);
    if (_prev) await _prev(mid, all);
  };
})();
(function patchGoBackVNote2(){
  const _prev = window.goBack;
  window.goBack = function() {
    Object.keys(window._omegaVNoteCache).forEach(id => omegaRevokeVNote(id));
    if (_prev) _prev();
  };
})();

// ============================================================
// ЗАПИСЬ: сохраняем реальный mimeType вместе с сообщением
// ============================================================
let vnStream2 = null, vnMr2 = null, vnChunks2 = [], vnMime2 = '', vnTimer2 = null, vnSeconds2 = 0, vnCancelled2 = false;

function ensureVNOverlay2() {
  if ($('vnoteRecOverlay')) return;
  let div = document.createElement('div');
  div.id = 'vnoteRecOverlay';
  div.className = 'vnote-rec-overlay';
  div.innerHTML =
    '<div class="vnote-rec-circle">' +
      '<video id="vnoteRecPreview" autoplay muted playsinline></video>' +
      '<div class="vnote-rec-dot"></div>' +
    '</div>' +
    '<div class="vnote-rec-timer" id="vnoteRecTimer">0:00</div>' +
    '<div class="vnote-rec-btns">' +
      '<button class="vnote-rec-btn cancel" id="vnoteCancelBtn" title="Отмена">✕</button>' +
      '<button class="vnote-rec-btn send" id="vnoteSendBtn" title="Отправить">➤</button>' +
    '</div>';
  document.body.appendChild(div);
  $('vnoteCancelBtn').onclick = () => window.cancelVNoteRecord();
  $('vnoteSendBtn').onclick = () => window.stopVNoteRecord();
}

function cleanupVNStream2() {
  if (vnStream2) { vnStream2.getTracks().forEach(t => t.stop()); vnStream2 = null; }
  clearInterval(vnTimer2); vnTimer2 = null; vnSeconds2 = 0;
  let ov = $('vnoteRecOverlay'); if (ov) ov.classList.remove('active');
  let vb = $('vnoteBtn'); if (vb) vb.classList.remove('recording');
  S.vnRec = false;
}

window.startVNoteRecord = async function() {
  if (S.rec || S.vnRec) return;
  let p = getMPath();
  if (!p) { toast('Откройте чат', true); return; }

  try {
    vnStream2 = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 480 }, height: { ideal: 480 }, aspectRatio: 1, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true }
    });
  } catch(e) {
    toast('Нет доступа к камере/микрофону: ' + e.message, true);
    return;
  }

  ensureVNOverlay2();
  let prevVid = $('vnoteRecPreview');
  if (prevVid) prevVid.srcObject = vnStream2;
  $('vnoteRecOverlay').classList.add('active');

  // Приоритет: mp4 (совместим со всеми, включая Safari), затем webm-варианты
  let types = [
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm'
  ];
  vnMime2 = types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';

  try {
    vnMr2 = new MediaRecorder(vnStream2, vnMime2 ? { mimeType: vnMime2, videoBitsPerSecond: 900000 } : {});
  } catch(e) {
    toast('Запись видео не поддерживается: ' + e.message, true);
    cleanupVNStream2();
    return;
  }

  vnChunks2 = [];
  vnCancelled2 = false;
  let t0 = Date.now();

  vnMr2.ondataavailable = ev => { if (ev.data && ev.data.size > 0) vnChunks2.push(ev.data); };

  vnMr2.onerror = err => {
    console.error('[VNote] MediaRecorder error:', err);
    toast('Ошибка записи видео', true);
    cleanupVNStream2();
  };

  vnMr2.onstop = async () => {
    cleanupVNStream2();
    if (vnCancelled2) { vnChunks2 = []; return; }
    if (!vnChunks2.length) { toast('Запись пустая', true); return; }

    let realMime = vnMr2.mimeType || vnMime2 || 'video/webm';
    let blob = new Blob(vnChunks2, { type: realMime });
    if (blob.size < 500) { toast('Запись слишком короткая', true); return; }

    let dur = (Date.now() - t0) / 1000;
    try {
      let b64 = await b2b64(blob);
      let pm = getMPath();
      if (!pm) { toast('Чат не открыт', true); return; }
      let msgData = {
        sender: S.user, senderNick: S.nick, type: 'videoNote',
        media: b64, mimeType: realMime,
        duration: Math.round(dur), timestamp: Date.now()
      };
      if (S.replyTo) { msgData.replyTo = S.replyTo; cancelReply(); }
      await db.ref(pm + '/messages').push(msgData);
      updLast('📹 Видео-кружок');
      toast('📹 Видео-кружок отправлен!');
    } catch(e) {
      console.error('[VNote] send error:', e);
      toast('Ошибка отправки: ' + e.message, true);
    }
  };

  vnMr2.start(250);
  S.vnRec = true;
  let vb = $('vnoteBtn'); if (vb) vb.classList.add('recording');

  vnSeconds2 = 0;
  vnTimer2 = setInterval(() => {
    vnSeconds2++;
    let t = $('vnoteRecTimer'); if (t) t.textContent = omegaFmtDur(vnSeconds2);
    if (vnSeconds2 >= 60) { toast('⏱ Максимум 60 сек'); window.stopVNoteRecord(); }
  }, 1000);
};

window.stopVNoteRecord = function() {
  if (!vnMr2 || !S.vnRec) return;
  vnCancelled2 = false;
  try { if (vnMr2.state !== 'inactive') vnMr2.stop(); } catch(e) { cleanupVNStream2(); }
};

window.cancelVNoteRecord = function() {
  if (!vnMr2 || !S.vnRec) { cleanupVNStream2(); return; }
  vnCancelled2 = true;
  try { if (vnMr2.state !== 'inactive') vnMr2.stop(); } catch(e) { cleanupVNStream2(); }
  toast('Запись отменена');
};

window.toggleVNoteRecord = function() {
  if (S.rec) { toast('Сначала остановите голосовую запись', true); return; }
  if (S.vnRec) window.stopVNoteRecord();
  else window.startVNoteRecord();
};

setTimeout(() => {
  let vb = document.getElementById('vnoteBtn');
  if (vb) vb.onclick = window.toggleVNoteRecord;
}, 500);

(function patchGoBackForVNote3(){
  const _origGoBack = window.goBack;
  window.goBack = function() {
    if (S.vnRec) window.cancelVNoteRecord();
    _origGoBack();
  };
})();


// ============================================================
// 2. WEB PUSH — ИСПРАВЛЕНИЕ (без CDN-зависимостей в SW)
// ============================================================

const OMEGA_VAPID_KEY = 'BPPp0QQDY6qcEGUF_RXrqTALFDNKg9A8wwU2x9zz4RDkHeERGpVrScUftIuSAICnyOAIluflE77tJ0RYpAabaDU';

// ВАЖНО: никаких importScripts с CDN — это и было причиной случайных сбоев
// (если сеть/CDN недоступны в момент установки SW — весь push переставал работать)
const OMEGA_SW_CODE = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; }
  catch(err) {
    try { data = { title: 'Omega', body: e.data ? e.data.text() : 'Новое сообщение' }; }
    catch(err2) { data = { title: 'Omega', body: 'Новое сообщение' }; }
  }
  const iconSvg = 'data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 192 192\\'%3E%3Crect fill=\\'%23dc143c\\' width=\\'192\\' height=\\'192\\'/%3E%3Ctext x=\\'96\\' y=\\'120\\' font-size=\\'120\\' font-weight=\\'bold\\' fill=\\'white\\' text-anchor=\\'middle\\'%3E%26%23937%3B%3C/text%3E%3C/svg%3E';
  const options = {
    body: data.body || 'Новое сообщение',
    icon: data.icon || iconSvg,
    tag: data.tag || ('omega-' + Date.now()),
    vibrate: [150, 80, 150],
    requireInteraction: false,
    data: { url: data.url || '/' }
  };
  e.waitUntil(self.registration.showNotification(data.title || 'Omega', options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  let url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (let c of list) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
`;

let _omegaSwRegPromise = null;

// Единая функция регистрации SW — переопределяет старую registerSW() из bundle.js,
// чтобы исключить гонку между двумя разными регистрациями на scope '/'
async function omegaRegisterUnifiedSW() {
  if (_omegaSwRegPromise) return _omegaSwRegPromise;
  if (!('serviceWorker' in navigator)) return null;

  _omegaSwRegPromise = (async () => {
    try {
      let blob = new Blob([OMEGA_SW_CODE], { type: 'application/javascript' });
      let swUrl = URL.createObjectURL(blob);
      let reg = await navigator.serviceWorker.register(swUrl, { scope: '/', updateViaCache: 'none' });
      await navigator.serviceWorker.ready;
      return reg;
    } catch(e) {
      console.warn('[Push] Blob SW registration failed:', e.message);
      try {
        let reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
        await navigator.serviceWorker.ready;
        return reg;
      } catch(e2) {
        console.warn('[Push] Fallback /service-worker.js also failed:', e2.message);
        return null;
      }
    }
  })();

  return _omegaSwRegPromise;
}

// Переопределяем старую registerSW() из bundle.js — теперь используется только эта функция
window.registerSW = omegaRegisterUnifiedSW;

function urlBase64ToUint8Array(base64String) {
  let padding = '='.repeat((4 - base64String.length % 4) % 4);
  let base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  let rawData = atob(base64);
  let outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Подписка с ретраями и обработкой конфликта applicationServerKey
async function omegaGetPushSubscription(swReg, attempt) {
  attempt = attempt || 1;
  try {
    let existing = await swReg.pushManager.getSubscription();
    if (existing) return existing;

    let sub = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(OMEGA_VAPID_KEY)
    });
    return sub;
  } catch(e) {
    let msg = String(e && e.message || '');
    console.warn('[Push] subscribe attempt ' + attempt + ' failed:', msg);

    // Конфликт ключей — отписываемся от старой подписки и пробуем снова
    if (msg.includes('applicationServerKey') || e.name === 'InvalidStateError') {
      try {
        let existing = await swReg.pushManager.getSubscription();
        if (existing) await existing.unsubscribe();
      } catch(e2) {}
      if (attempt < 3) { await sleep(400); return omegaGetPushSubscription(swReg, attempt + 1); }
      return null;
    }

    // Транзитная ошибка push-сервиса — просто повторяем с задержкой
    if (attempt < 3) {
      await sleep(600 * attempt);
      return omegaGetPushSubscription(swReg, attempt + 1);
    }
    return null;
  }
}

async function omegaSavePushSubscription(sub) {
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
    console.log('[Push] Subscription saved:', platform);
    return true;
  } catch(e) {
    console.warn('[Push] Save subscription failed:', e.message);
    return false;
  }
}

async function omegaInitWebPush(silent) {
  if (!S.user) return;
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[Push] Not supported in this browser');
    return;
  }

  let perm = Notification.permission;
  if (perm === 'denied') { console.log('[Push] Denied by user'); return; }
  if (perm === 'default') {
    try { perm = await Notification.requestPermission(); }
    catch(e) { console.warn('[Push] requestPermission error:', e.message); return; }
  }
  if (perm !== 'granted') return;

  try {
    let swReg = await omegaRegisterUnifiedSW();
    if (!swReg) { if (!silent) toast('Не удалось настроить push (SW)', true); return; }
    S.swRegistration = swReg;

    let sub = await omegaGetPushSubscription(swReg);
    if (!sub) { if (!silent) toast('Не удалось подписаться на push', true); return; }

    let ok = await omegaSavePushSubscription(sub);
    if (ok && !silent) toast('🔔 Push-уведомления включены');
    console.log('[Push] Web Push initialized OK');
  } catch(e) {
    console.error('[Push] initWebPush unexpected error:', e);
    if (!silent) toast('Ошибка настройки push: ' + e.message, true);
  }
}
window.omegaInitWebPush = omegaInitWebPush;
window.retryPushSetup = () => omegaInitWebPush(false);

async function omegaUnsubscribeWebPush() {
  try {
    let reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) return;
    let sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    let ua = navigator.userAgent.toLowerCase();
    let platform = /android/.test(ua) ? 'android' : /iphone|ipad|ipod/.test(ua) ? 'ios' : 'web';
    await db.ref('pushSubscriptions/' + platform + '/' + S.user).remove();
    toast('Push уведомления отключены');
  } catch(e) { console.warn('[Push] Unsubscribe error:', e.message); }
}
window.unsubscribeWebPush = omegaUnsubscribeWebPush;

// ---- Просмотр подписок в debug-меню ----
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
      '<button class="btn btn-secondary" style="margin-top:6px" onclick="retryPushSetup()">🔁 Повторить настройку push (для себя)</button>' +
      '<button class="btn btn-danger" style="margin-top:8px" onclick="clearAllPushSubs()">🗑 Очистить все</button>' +
      '</div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  } catch(e) { toast('Ошибка: ' + e.message, true); }
}
window.showPushSubscriptions = showPushSubscriptions;

window.delPushSub = async function(pl, user) {
  try { await db.ref('pushSubscriptions/' + pl + '/' + user).remove(); toast('Подписка удалена'); showPushSubscriptions(); }
  catch(e) { toast('Ошибка', true); }
};
window.clearAllPushSubs = async function() {
  let ok = await confirm2('Удалить все Push подписки?'); if (!ok) return;
  try {
    await db.ref('pushSubscriptions').remove();
    toast('Все подписки удалены');
    let m = document.getElementById('pushSubsModal'); if (m) m.remove();
  } catch(e) { toast('Ошибка', true); }
};

function addPushSubsToDebugMenu() {
  let dp = $('debugPanel');
  if (!dp || dp.querySelector('#debugPushSubsItem')) return;
  let item = document.createElement('div');
  item.id = 'debugPushSubsItem';
  item.className = 'debug-item';
  item.innerHTML = '<div class="debug-item-title">📡 Push подписки</div><div class="debug-item-desc">Просмотр и повтор настройки Web Push</div>';
  item.onclick = () => showPushSubscriptions();
  dp.appendChild(item);
}

// ---- Инициализация после логина ----
(function patchAfterLoginPush(){
  const _prev = window.afterLogin;
  window.afterLogin = async function() {
    await _prev();
    setTimeout(() => omegaInitWebPush(true), 1500);
    setTimeout(() => addPushSubsToDebugMenu(), 2000);
  };
})();

if (S && S.user) {
  setTimeout(() => omegaInitWebPush(true), 500);
  setTimeout(() => addPushSubsToDebugMenu(), 1000);
}

console.log('✅ omega-patch4.js v2: video-note read rewrite (fetch->blob) + push fix (no CDN deps in SW)');
})();    }
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
