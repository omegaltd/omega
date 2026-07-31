// ============================================================
// OMEGA BUNDLE — единый файл клиентской логики
// Порядок ВАЖЕН: каждый следующий блок патчит предыдущий
// 1) CORE (бывший omega-part2.js)
// 2) FIXES (бывший omega-fixes.js)
// 3) FCM (бывший omega-fcm.js)
// 4) PATCH (бывший omega-patch.js)
// 5) PATCH 2 (бывший omega-patch2.js)
// ============================================================

// ==================== 1. CORE ====================
// ==================== ENCRYPTION ====================
const ENC_KEY = 'ffqqwe433';
function encMsg(text) { return CryptoJS.AES.encrypt(String(text), ENC_KEY).toString(); }
function decMsg(encText) { try { return CryptoJS.AES.decrypt(encText, ENC_KEY).toString(CryptoJS.enc.Utf8); } catch(e) { return ''; } }

// ==================== FIREBASE ====================
let db, fbOk = false;
function initFB() {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp({ databaseURL: "https://omega-e3d75-default-rtdb.firebaseio.com" });
    }
    db = firebase.database();
    fbOk = true;
    return true;
  } catch(e) { showSt("Firebase: " + e.message, true); return false; }
}

async function testFB() {
  showSt("Подключение...");
  try {
    await db.ref("_ping/" + Date.now()).set(true);
    showSt("Подключено", false, true);
    setTimeout(() => { let s = $('fbStat'); if(s) s.style.display = 'none'; }, 2000);
    return true;
  } catch(e) { showSt("Ошибка: " + e.message, true); return false; }
}

function showSt(m, er, ok) {
  let e = $('fbStat');
  if (!e) return;
  e.style.display = 'block';
  e.textContent = m;
  e.className = 'status-bar' + (er ? ' err' : '') + (ok ? ' ok' : '');
}

// ==================== STATE ====================
const REACTS = ['👍','❤️','😂','😮','😢','😡','🔥','🎉','👏','💯','😍','🤔','👎','🥳','😎','✨','🎊','🔔','💯','⭐'];
const RANKS = {
  0:'Пользователь', 1:'Тестер', 2:'Младший модератор', 3:'Модератор', 4:'Старший модератор',
  5:'Младший администратор', 6:'Администратор', 7:'Главный модератор', 8:'Разработчик'
};

const FONTS = [
  { name: 'Стандарт', family: "'Segoe UI',system-ui,sans-serif" },
  { name: 'Roboto', family: "'Roboto',sans-serif" },
  { name: 'Courier', family: "'Courier New',monospace" },
  { name: 'Georgia', family: "Georgia,serif" },
  { name: 'Arial', family: "'Arial',sans-serif" },
  { name: 'Times', family: "'Times New Roman',serif" },
];

let S = {
  user: null, uname: '', nick: '', av: '', bio: '', hide: false, theme: 'dark', rank: 0,
  curId: null, curType: null, curChat: null, chats: {},
  rec: false, mr: null, rc: [], rt: null, rs: 0, recCancelled: false,
  vnRec: false, vnMr: null, vnRc: [], vnStream: null,
  pc: null, ls: null, callId: null, ct: null, ss: null, spk: true,
  favs: {}, stickers: [], myStickers: {},
  customBorder: '#dc133c', customFill: '#232f3d', customGlow: '#dc133c',
  brightness: 100, saturation: 100, fontColor: '#f5f5f5',
  fontFamily: "'Segoe UI',system-ui,sans-serif",
  btn3d: false, text3d: false, glowAnim: false, rainbowAnim: false, btnStyle: 'default',
  stickerPack: { name: '', stickers: [] },
  swRegistration: null, pushSub: null,
  greyscale: false, whiteNoiseActive: false, whiteNoiseAudio: null,
  debugDrag: false, debugStartX: 0, debugStartY: 0, debugOrbStartX: 0, debugOrbStartY: 0
};

// ==================== UTILS ====================
function $(id) { return document.getElementById(id); }
function san(s) { return String(s).replace(/[@.#$\[\]\/]/g, '_'); }

function toast(m, isErr) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  let t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.textContent = m;
  document.body.appendChild(t);
  setTimeout(() => { if (t.parentNode) t.remove(); }, 3200);
}

function openModal(id) { 
  let modal = $(id);
  if (modal) {
    modal.classList.add('active');
    document.querySelectorAll('.modal-overlay.active').forEach(m => {
      if (m.id !== id && m.id !== 'confModal') m.classList.remove('active');
    });
  }
}
function closeModal(id) { $(id) && $(id).classList.remove('active'); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id) && $(id).classList.add('active');
  if (id === 'chatScr') window.history.pushState({ page: 'chat' }, '', '');
  else if (id === 'mainScr') window.history.pushState({ page: 'main' }, '', '');
}

function goBack() {
  showScreen('mainScr');
  stopListen();
  S.curChat = null; S.curType = null; S.curId = null;
  stopRecUI();
  if (S.rec) cancelVoiceRecord();
  if (S.vnRec) stopVNoteRecord();
}

function autoR(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

function mkId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 7); }
function tf(ts) {
  if (!ts) return '';
  let d = new Date(ts);
  return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
}
function isDev(u) { return u === '@liagushka' || u === '_liagushka' || u === '@nata' || u === '_nata'; }
function ini(n) { return n ? n.charAt(0).toUpperCase() : '?'; }
function esc(s) { let d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

function confirm2(t) {
  return new Promise(r => {
    let confModal = $('confModal');
    if (confModal) {
      confModal.style.zIndex = '1001';
    }
    $('confText').textContent = t;
    openModal('confModal');
    $('confY').onclick = () => { closeModal('confModal'); r(true); };
    $('confN').onclick = () => { closeModal('confModal'); r(false); };
  });
}

function toggleFab() { $('fabMenu').classList.toggle('active'); }
function closeFab() { $('fabMenu').classList.remove('active'); }
function f2b64(f) { return new Promise((r,j) => { let x = new FileReader(); x.onload = () => r(x.result); x.onerror = j; x.readAsDataURL(f); }); }
function b2b64(b) { return new Promise((r,j) => { let x = new FileReader(); x.onload = () => r(x.result); x.onerror = j; x.readAsDataURL(b); }); }
function formatDur(s) { s = Math.round(s || 0); return Math.floor(s/60) + ':' + (s%60 < 10 ? '0' : '') + s%60; }

async function compImg(f, mw = 800) {
  return new Promise(r => {
    let i = new Image(), u = URL.createObjectURL(f);
    i.onload = () => {
      let w = i.width, h = i.height;
      if (w > mw) { h = Math.round(h*(mw/w)); w = mw; }
      let c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(i, 0, 0, w, h);
      URL.revokeObjectURL(u);
      r(c.toDataURL('image/jpeg', 0.72));
    };
    i.onerror = () => { URL.revokeObjectURL(u); r(''); };
    i.src = u;
  });
}

function lp(el, cb) {
  let t;
  el.addEventListener('touchstart', e => { t = setTimeout(() => { e.preventDefault(); cb(e); }, 500); }, { passive: false });
  el.addEventListener('touchend', () => clearTimeout(t));
  el.addEventListener('touchmove', () => clearTimeout(t));
  el.addEventListener('contextmenu', e => { e.preventDefault(); cb(e); });
}

function posMenu(menu, e) {
  let x = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : window.innerWidth/2);
  let y = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : window.innerHeight/2);
  let mw = 180, mh = 200;
  let left = Math.max(8, Math.min(x, window.innerWidth - mw - 8));
  let top = Math.max(8, Math.min(y, window.innerHeight - mh - 8));
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  menu.classList.add('active');
}

function acceptCookies() { $('cookieBar').classList.remove('active'); localStorage.setItem('ck','1'); }

function initHistoryHandler() {
  window.history.pushState({ page: 'main' }, '', '');
  window.addEventListener('popstate', () => {
    if (S.curId && $('chatScr').classList.contains('active')) {
      goBack();
      window.history.pushState({ page: 'main' }, '', '');
    } else {
      window.history.pushState({ page: 'main' }, '', '');
    }
  });
}

document.addEventListener('click', e => {
  if (!$('fabMenu').contains(e.target) && !$('fabBtn').contains(e.target)) closeFab();
  if ($('ctxMenu').classList.contains('active') && !$('ctxMenu').contains(e.target)) $('ctxMenu').classList.remove('active');
  if ($('reactPick').classList.contains('active') && !$('reactPick').contains(e.target)) $('reactPick').classList.remove('active');
  let dp = $('debugPanel');
  let df = $('debugFloat');
  if (dp && df && !dp.contains(e.target) && !df.contains(e.target)) dp.classList.remove('active');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    $('ctxMenu').classList.remove('active');
    $('reactPick').classList.remove('active');
  }
});

// ==================== CUSTOM DESIGN ====================
function updateCustomDesign() {
  let border = $('borderColorI').value;
  let fill = $('fillColorI').value;
  let glow = $('glowColorI').value;
  let bright = $('brightnessI').value;
  let sat = $('saturationI').value;
  let fontColor = $('fontColorI') ? $('fontColorI').value : '#f5f5f5';

  S.customBorder = border; S.customFill = fill; S.customGlow = glow;
  S.brightness = bright; S.saturation = sat; S.fontColor = fontColor;

  document.documentElement.style.setProperty('--custom-border', border);
  document.documentElement.style.setProperty('--custom-fill', fill);
  document.documentElement.style.setProperty('--custom-glow', glow);
  document.documentElement.style.setProperty('--brightness', bright + '%');
  document.documentElement.style.setProperty('--saturation', sat + '%');
  document.documentElement.style.setProperty('--font-color', fontColor);
  document.documentElement.style.setProperty('--t1', fontColor);

  let glowPrev = $('glowColorPreview');
  if (glowPrev) glowPrev.style.boxShadow = '0 0 20px ' + glow + ', 0 0 40px ' + glow;

  localStorage.setItem('design', JSON.stringify({ border, fill, glow, bright, sat, fontColor,
    font: S.fontFamily, btn3d: S.btn3d, text3d: S.text3d, glowAnim: S.glowAnim,
    rainbowAnim: S.rainbowAnim, btnStyle: S.btnStyle }));
}

function loadCustomDesign() {
  let saved = localStorage.getItem('design');
  if (!saved) return;
  try {
    let d = JSON.parse(saved);
    if ($('borderColorI')) $('borderColorI').value = d.border || '#dc133c';
    if ($('fillColorI')) $('fillColorI').value = d.fill || '#232f3d';
    if ($('glowColorI')) $('glowColorI').value = d.glow || '#dc133c';
    if ($('brightnessI')) $('brightnessI').value = d.bright || 100;
    if ($('saturationI')) $('saturationI').value = d.sat || 100;
    if ($('fontColorI')) $('fontColorI').value = d.fontColor || '#f5f5f5';
    if (d.font) { 
      S.fontFamily = d.font; 
      document.querySelectorAll('.font-option').forEach(o => { 
        o.classList.toggle('selected', o.dataset.font === d.font); 
      }); 
    }
    if (d.btn3d) { S.btn3d = true; if ($('btn3dTgl')) $('btn3dTgl').classList.add('active'); applyBtn3D(true); }
    if (d.text3d) { S.text3d = true; if ($('text3dTgl')) $('text3dTgl').classList.add('active'); applyText3D(true); }
    if (d.glowAnim) { S.glowAnim = true; if ($('animGlowTgl')) $('animGlowTgl').classList.add('active'); applyGlowAnim(true); }
    if (d.rainbowAnim) { S.rainbowAnim = true; if ($('animRainbowTgl')) $('animRainbowTgl').classList.add('active'); applyRainbowAnim(true); }
    if (d.btnStyle) { S.btnStyle = d.btnStyle; setBtnStyle(d.btnStyle, true); }
    updateCustomDesign();
  } catch(e) { console.error('loadCustomDesign:', e); }
}

function resetCustomDesign() {
  if ($('borderColorI')) $('borderColorI').value = '#dc133c';
  if ($('fillColorI')) $('fillColorI').value = '#232f3d';
  if ($('glowColorI')) $('glowColorI').value = '#dc133c';
  if ($('brightnessI')) $('brightnessI').value = 100;
  if ($('saturationI')) $('saturationI').value = 100;
  if ($('fontColorI')) $('fontColorI').value = '#f5f5f5';
  S.btn3d = false; S.text3d = false; S.glowAnim = false; S.rainbowAnim = false;
  S.fontFamily = "'Segoe UI',system-ui,sans-serif"; S.btnStyle = 'default';
  if ($('btn3dTgl')) $('btn3dTgl').classList.remove('active');
  if ($('text3dTgl')) $('text3dTgl').classList.remove('active');
  if ($('animGlowTgl')) $('animGlowTgl').classList.remove('active');
  if ($('animRainbowTgl')) $('animRainbowTgl').classList.remove('active');
  document.querySelectorAll('.font-option').forEach(o => o.classList.toggle('selected', o.dataset.font === "'Segoe UI',system-ui,sans-serif"));
  applyBtn3D(false); applyText3D(false); applyGlowAnim(false); applyRainbowAnim(false);
  setBtnStyle('default', true);
  document.documentElement.style.setProperty('--font-family', "'Segoe UI',system-ui,sans-serif");
  updateCustomDesign();
  toast('Дизайн сброшен');
}

function selectFont(el) {
  document.querySelectorAll('.font-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  S.fontFamily = el.dataset.font;
  document.documentElement.style.setProperty('--font-family', S.fontFamily);
  updateCustomDesign();
  toast('Шрифт изменён');
}

function setBtnStyle(style, silent) {
  S.btnStyle = style;
  document.documentElement.setAttribute('data-btn-style', style);
  if (!silent) { toast('Стиль кнопок: ' + style); updateCustomDesign(); }
}

function toggle3DButtons() {
  S.btn3d = !S.btn3d;
  if ($('btn3dTgl')) $('btn3dTgl').classList.toggle('active', S.btn3d);
  applyBtn3D(S.btn3d);
  updateCustomDesign();
}

function applyBtn3D(on) {
  let style = document.getElementById('btn3dStyle') || (() => { let s = document.createElement('style'); s.id = 'btn3dStyle'; document.head.appendChild(s); return s; })();
  style.textContent = on ? '.btn{transform:translateY(0);box-shadow:0 6px 0 var(--accD),0 8px 6px rgba(0,0,0,.3)!important;transition:transform .1s,box-shadow .1s!important}.btn:active{transform:translateY(4px)!important;box-shadow:0 2px 0 var(--accD)!important}' : '';
}

function toggle3DText() {
  S.text3d = !S.text3d;
  if ($('text3dTgl')) $('text3dTgl').classList.toggle('active', S.text3d);
  applyText3D(S.text3d);
  updateCustomDesign();
}

function applyText3D(on) {
  let style = document.getElementById('text3dStyle') || (() => { let s = document.createElement('style'); s.id = 'text3dStyle'; document.head.appendChild(s); return s; })();
  style.textContent = on ? 'p,span,div,h1,h2,h3,h4,label,.msg-text,.chat-name,.chat-header-name{text-shadow:1px 1px 0 rgba(0,0,0,.4),2px 2px 0 rgba(0,0,0,.3),3px 3px 0 rgba(0,0,0,.2)!important}' : '';
}

function toggleGlowAnim() {
  S.glowAnim = !S.glowAnim;
  if ($('animGlowTgl')) $('animGlowTgl').classList.toggle('active', S.glowAnim);
  applyGlowAnim(S.glowAnim);
  updateCustomDesign();
}

function applyGlowAnim(on) {
  let style = document.getElementById('glowAnimStyle') || (() => { let s = document.createElement('style'); s.id = 'glowAnimStyle'; document.head.appendChild(s); return s; })();
  style.textContent = on ? '.btn-primary{animation:pulseGlow 2s infinite}.icon-btn:hover{animation:pulseGlow 1s infinite}' : '';
}

function toggleRainbowAnim() {
  S.rainbowAnim = !S.rainbowAnim;
  if ($('animRainbowTgl')) $('animRainbowTgl').classList.toggle('active', S.rainbowAnim);
  applyRainbowAnim(S.rainbowAnim);
  updateCustomDesign();
}

function applyRainbowAnim(on) {
  let style = document.getElementById('rainbowAnimStyle') || (() => { let s = document.createElement('style'); s.id = 'rainbowAnimStyle'; document.head.appendChild(s); return s; })();
  style.textContent = on ? '.modal,.chat-item,.msg{animation:rainbowBorder 3s linear infinite!important}.header,.chat-header,.input-area{border-color:transparent;animation:rainbowBorder 3s linear infinite}' : '';
}

function saveDesignAnims() { updateCustomDesign(); }

function showVideoQuality() { $('vqP').style.display = $('vqP').style.display === 'none' ? 'block' : 'none'; }

// ==================== PUSH NOTIFICATIONS ====================
async function initNotif() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') return;
  if (Notification.permission !== 'denied') {
    try { await Notification.requestPermission(); } catch(e) {}
  }
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const swCode = `
self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'Omega', body: 'Новое сообщение' };
  e.waitUntil(self.registration.showNotification(data.title || 'Omega', {
    body: data.body || 'Новое сообщение',
    icon: '/icon.png',
    badge: '/badge.png',
    tag: 'omega-msg',
    requireInteraction: false,
    vibrate: [150, 80, 150]
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
    for (let c of list) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('/');
  }));
});
    `;
    const blob = new Blob([swCode], { type: 'application/javascript' });
    const swURL = URL.createObjectURL(blob);
    S.swRegistration = await navigator.serviceWorker.register(swURL, { scope: '/' });
    console.log('SW registered');
  } catch(e) { console.log('SW error:', e.message); }
}

async function reqPerms() {
  if ('Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch(e) {}
  }
  try {
    let s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach(t => t.stop());
  } catch(e) {}
}

function showNotif(title, body) {
  let p = document.createElement('div');
  p.className = 'notif-pop';
  p.innerHTML = '<h4>' + esc(title) + '</h4><p>' + esc(body) + '</p>';
  document.body.appendChild(p);
  setTimeout(() => { if (p.parentNode) p.remove(); }, 4500);
  p.onclick = () => p.remove();

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      if (S.swRegistration && S.swRegistration.showNotification) {
        S.swRegistration.showNotification(title, {
          body: body,
          icon: '/icon.png',
          tag: 'omega-' + Date.now(),
          vibrate: [150, 80, 150]
        });
      } else {
        new Notification(title, { body: body });
      }
    } catch(e) {
      try { new Notification(title, { body: body }); } catch(e2) {}
    }
  }

  if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
}

// ==================== ZOOM (FIXED) ====================
let zScale = 1, zX = 0, zY = 0, zEl = null;
let zDragging = false, zDragStartX = 0, zDragStartY = 0, zDragElX = 0, zDragElY = 0;
let zInitDist = 0, zInitScale = 1;

function openZoom(type, src) {
  let cnt = $('zoomC');
  zScale = 1; zX = 0; zY = 0;

  if (type === 'image') {
    cnt.innerHTML = '<img id="zEl" src="' + src + '" draggable="false">';
  } else {
    cnt.innerHTML = '<video id="zEl" src="' + src + '" controls autoplay></video>';
  }

  $('zoomOv').classList.add('active');
  zEl = $('zEl');
  if (!zEl) return;

  applyZoomTransform();

  let lastTap = 0;
  zEl.addEventListener('click', e => {
    let now = Date.now();
    if (now - lastTap < 300) {
      e.stopPropagation();
      if (zScale > 1.5) {
        zScale = 1; zX = 0; zY = 0;
      } else {
        let rect = zEl.getBoundingClientRect();
        let cx = e.clientX - rect.left - rect.width / 2;
        let cy = e.clientY - rect.top - rect.height / 2;
        zScale = 3;
        zX = -cx * (zScale - 1);
        zY = -cy * (zScale - 1);
      }
      applyZoomTransform();
    }
    lastTap = now;
  });

  let container = $('zoomContainer');
  container.addEventListener('wheel', e => {
    e.preventDefault();
    let delta = e.deltaY < 0 ? 0.25 : -0.25;
    let newScale = Math.max(0.5, Math.min(8, zScale + delta));

    let rect = container.getBoundingClientRect();
    let mx = e.clientX - rect.left - rect.width / 2;
    let my = e.clientY - rect.top - rect.height / 2;
    zX = mx - (mx - zX) * (newScale / zScale);
    zY = my - (my - zY) * (newScale / zScale);
    zScale = newScale;
    applyZoomTransform();
  }, { passive: false });

  container.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    zDragging = true;
    zDragStartX = e.clientX;
    zDragStartY = e.clientY;
    zDragElX = zX;
    zDragElY = zY;
    container.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if (!zDragging) return;
    zX = zDragElX + (e.clientX - zDragStartX);
    zY = zDragElY + (e.clientY - zDragStartY);
    applyZoomTransformNoAnim();
  });
  window.addEventListener('mouseup', () => {
    zDragging = false;
    if (container) container.style.cursor = 'grab';
  });

  let touches = [];
  container.addEventListener('touchstart', e => {
    touches = Array.from(e.touches);
    if (touches.length === 2) {
      zInitDist = Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
      zInitScale = zScale;
      e.preventDefault();
    } else if (touches.length === 1) {
      zDragStartX = touches[0].clientX;
      zDragStartY = touches[0].clientY;
      zDragElX = zX;
      zDragElY = zY;
      zDragging = true;
    }
  }, { passive: false });

  container.addEventListener('touchmove', e => {
    e.preventDefault();
    let tc = Array.from(e.touches);
    if (tc.length === 2 && zInitDist) {
      let dist = Math.hypot(tc[0].clientX - tc[1].clientX, tc[0].clientY - tc[1].clientY);
      let midX = (tc[0].clientX + tc[1].clientX) / 2;
      let midY = (tc[0].clientY + tc[1].clientY) / 2;
      let rect = container.getBoundingClientRect();
      let mx = midX - rect.left - rect.width / 2;
      let my = midY - rect.top - rect.height / 2;
      let newScale = Math.max(0.5, Math.min(8, zInitScale * (dist / zInitDist)));
      zX = mx - (mx - zX) * (newScale / zScale);
      zY = my - (my - zY) * (newScale / zScale);
      zScale = newScale;
      applyZoomTransformNoAnim();
    } else if (tc.length === 1 && zDragging) {
      zX = zDragElX + (tc[0].clientX - zDragStartX);
      zY = zDragElY + (tc[0].clientY - zDragStartY);
      applyZoomTransformNoAnim();
    }
  }, { passive: false });

  container.addEventListener('touchend', e => {
    if (e.touches.length < 2) { zInitDist = 0; }
    if (e.touches.length === 0) zDragging = false;
  });
}

function applyZoomTransform() {
  if (!zEl) return;
  zEl.style.transition = 'transform .15s ease';
  zEl.style.transform = 'translate(' + zX + 'px,' + zY + 'px) scale(' + zScale + ')';
  zEl.style.transformOrigin = 'center center';
}

function applyZoomTransformNoAnim() {
  if (!zEl) return;
  zEl.style.transition = 'none';
  zEl.style.transform = 'translate(' + zX + 'px,' + zY + 'px) scale(' + zScale + ')';
}

function closeZoom() {
  $('zoomOv').classList.remove('active');
  $('zoomC').innerHTML = '';
  zEl = null; zScale = 1; zX = 0; zY = 0; zDragging = false;
}

$('zoomOv').addEventListener('click', e => {
  if (e.target === $('zoomOv')) closeZoom();
});

// ==================== STICKER SYSTEM ====================
function openStickerPackCreator() {
  S.stickerPack = { name: '', stickers: [] };
  if ($('packNameI')) $('packNameI').value = '';
  if ($('stickerFileI')) $('stickerFileI').value = '';
  if ($('stickerPrev')) { $('stickerPrev').src = ''; }
  if ($('stickerPreviewContainer')) $('stickerPreviewContainer').style.display = 'none';
  if ($('stickerPackPreviewGrid')) $('stickerPackPreviewGrid').innerHTML = '';
  if ($('stickerCountDisplay')) $('stickerCountDisplay').textContent = '0 стикеров';
  openModal('newStickerPackModal');
}

function openStickerManager() {
  showStickerPackManager();
}

async function showStickerPackManager() {
  closeModal('setModal');
  try {
    let myPacks = await db.ref('users/' + S.user + '/stickerPacks').once('value');
    let packs = myPacks.exists() ? myPacks.val() : {};
    let html = '<button class="btn btn-primary" onclick="openStickerPackCreator();closeModal(\'myStickerPacksModal\')">+ Новый пак</button>';
    if (Object.keys(packs).length === 0) {
      html += '<p style="color:var(--t3);text-align:center;padding:20px">Нет паков стикеров</p>';
    } else {
      Object.entries(packs).forEach(([packId, pack]) => {
        let sc = pack.stickers ? Object.keys(pack.stickers).length : 0;
        html += '<div style="margin:12px 0;padding:10px;background:var(--bg3);border-radius:8px;border:1px solid var(--custom-border)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
        html += '<h4 style="margin:0">' + esc(pack.name) + ' <span style="color:var(--t3);font-size:.8em">(' + sc + ')</span></h4>';
        html += '<div style="display:flex;gap:4px">';
        html += '<button class="btn btn-secondary btn-sm" onclick="sharePackModal(\'' + packId + '\')">🔗 Поделиться</button>';
        html += '<button class="btn btn-danger btn-sm" onclick="delStickerPack(\'' + packId + '\')">✕ Удалить</button></div></div>';
        if (pack.stickers) {
          html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px">';
          Object.entries(pack.stickers).slice(0, 10).forEach(([sid, st]) => {
            html += '<img src="' + st.data + '" style="width:100%;aspect-ratio:1;border-radius:4px;border:1px solid var(--custom-border);cursor:pointer;object-fit:cover" onclick="showStickerInfo(\'' + packId + '\',\'' + esc(pack.name) + '\')" title="' + esc(st.name || '') + '">';
          });
          html += '</div>';
        }
        html += '</div>';
      });
    }
    $('myPacksC').innerHTML = html;
    openModal('myStickerPacksModal');
  } catch(e) { toast('Ошибка: ' + e.message, true); }
}

function sharePackModal(packId) {
  let packName = prompt('Поделиться пакетом стикеров?');
  if (!packName) return;
  let shareLink = window.location.origin + '?stickerPack=' + packId;
  let html = '<p style="margin-bottom:10px">Ссылка для поделиться:</p>';
  html += '<div style="padding:10px;background:var(--bg4);border-radius:8px;word-break:break-all;cursor:pointer;border:1px solid var(--custom-border)" onclick="navigator.clipboard.writeText(this.textContent);toast(\'Скопировано\')">' + shareLink + '</div>';
  html += '<p style="margin-top:10px;font-size:.8em;color:var(--t2)">Нажмите чтобы скопировать</p>';
  let modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.innerHTML = '<div class="modal"><button class="modal-close" onclick="this.parentElement.parentElement.remove()">×</button><h2>Поделиться пакетом</h2><div class="modal-body">' + html + '</div></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function showStickerInfo(packId, packName) {
  let html = '<div style="text-align:center">';
  html += '<h3>' + esc(packName) + '</h3>';
  html += '<p style="color:var(--t2);font-size:.88em;margin:8px 0">Пак стикеров от другого пользователя</p>';
  html += '<button class="btn btn-primary" onclick="addPackToMyStickers(\'' + packId + '\',\'' + esc(packName) + '\');closeModal(\'stickerInfo\')">➕ Добавить в мой</button>';
  html += '</div>';
  let modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.id = 'stickerInfo';
  modal.innerHTML = '<div class="modal"><button class="modal-close" onclick="closeModal(\'stickerInfo\')">×</button><div class="modal-body">' + html + '</div></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal('stickerInfo');
  });
  openModal('stickerInfo');
}

async function addPackToMyStickers(packId, packName) {
  try {
    let packData = await db.ref('stickers/public/' + packId).once('value');
    if (!packData.exists()) return toast('Пак не найден', true);
    await db.ref('users/' + S.user + '/stickerPacks/' + packId).set(packData.val());
    toast('Пак "' + packName + '" добавлен в ваши стикеры!');
    await loadStickers();
  } catch(e) { toast('Ошибка: ' + e.message, true); }
}

function previewSticker(input) {
  if (!input.files[0]) return;
  let file = input.files[0];
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)) { toast('Только PNG/JPEG/WebP', true); input.value = ''; return; }
  if (file.size > 2*1024*1024) { toast('Файл > 2МБ', true); input.value = ''; return; }
  let reader = new FileReader();
  reader.onload = e => {
    let img = new Image();
    img.onload = () => {
      if (Math.abs(img.width - img.height) > 10) { toast('Стикер должен быть квадратным', true); input.value = ''; return; }
      if (img.width < 32 || img.width > 512) { toast('Размер: 32-512 пикселей', true); input.value = ''; return; }
      if ($('stickerPrev')) { $('stickerPrev').src = e.target.result; }
      if ($('stickerPreviewContainer')) $('stickerPreviewContainer').style.display = 'block';
      S.stickerPack.stickers.push({ name: file.name, data: e.target.result });
      updateStickerPackGrid();
      input.value = '';
    };
    img.onerror = () => { toast('Ошибка изображения', true); input.value = ''; };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function updateStickerPackGrid() {
  let count = S.stickerPack.stickers.length;
  if ($('stickerCountDisplay')) $('stickerCountDisplay').textContent = count + ' стикер' + (count % 10 === 1 && count % 100 !== 11 ? '' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20) ? 'а' : 'ов');
  let grid = $('stickerPackPreviewGrid');
  if (!grid) return;
  grid.innerHTML = '';
  S.stickerPack.stickers.forEach((st, i) => {
    let wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;aspect-ratio:1';
    wrap.innerHTML = '<img src="' + st.data + '" style="width:100%;height:100%;object-fit:cover;border-radius:6px;border:1px solid var(--custom-border)">' +
      '<button onclick="removeStickerFromPack(' + i + ')" style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:var(--err);color:#fff;border:none;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;line-height:1">✕</button>';
    grid.appendChild(wrap);
  });
}

function removeStickerFromPack(idx) {
  S.stickerPack.stickers.splice(idx, 1);
  updateStickerPackGrid();
}

function addMoreStickers() { if ($('stickerFileI')) $('stickerFileI').click(); }

async function saveStickerPack() {
  let packName = $('packNameI') ? $('packNameI').value.trim() : '';
  if (!packName) return toast('Введите название пака', true);
  if (S.stickerPack.stickers.length === 0) return toast('Добавьте хотя бы 1 стикер', true);
  try {
    let packId = mkId();
    let packData = { name: packName, createdAt: Date.now(), createdBy: S.user, creator: S.nick, stickers: {} };
    S.stickerPack.stickers.forEach(st => { packData.stickers[mkId()] = { name: st.name, data: st.data }; });
    await db.ref('users/' + S.user + '/stickerPacks/' + packId).set(packData);
    await db.ref('stickers/public/' + packId).set(packData);
    toast('Пак «' + packName + '» создан! (' + S.stickerPack.stickers.length + ' стикеров)');
    S.stickerPack = { name: '', stickers: [] };
    closeModal('newStickerPackModal');
    await loadStickers();
  } catch(e) { toast('Ошибка: ' + e.message, true); }
}

async function delStickerPack(packId) {
  let ok = await confirm2('Удалить пак?'); if (!ok) return;
  try {
    await db.ref('users/' + S.user + '/stickerPacks/' + packId).remove();
    toast('Пак удалён');
    showStickerPackManager();
  } catch(e) { toast('Ошибка', true); }
}

async function loadStickers() {
  try {
    let sn = await db.ref('stickers/public').once('value');
    S.stickers = sn.exists() ? sn.val() : {};
    let usn = await db.ref('users/' + S.user + '/stickerPacks').once('value');
    S.myStickers = usn.exists() ? usn.val() : {};
    renderStickers();
  } catch(e) { console.error('loadStickers:', e); }
}

function renderStickers() {
  let c = $('stickersC'); if (!c) return;
  let html = '';
  if (Object.keys(S.myStickers || {}).length > 0) {
    html += '<p style="font-size:.82em;font-weight:700;color:var(--acc);margin:8px 0 5px">✨ МОИ СТИКЕРЫ</p>';
    Object.entries(S.myStickers).forEach(([setId, set]) => {
      if (!set.stickers) return;
      html += '<p style="font-size:.75em;color:var(--t2);margin:6px 0 3px">' + esc(set.name || 'Пак') + '</p>';
      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px">';
      Object.entries(set.stickers).forEach(([sid, st]) => {
        html += '<button class="sticker-btn" onclick="insertSticker(\'' + st.data.replace(/'/g,"'") + '\')" title="' + esc(set.name) + '"><img src="' + st.data + '"></button>';
      });
      html += '</div>';
    });
  } else {
    html += '<p style="color:var(--t3);text-align:center;padding:10px;font-size:.82em">Нет своих стикеров. <a href="#" onclick="openStickerPackCreator();closeModal(\'stickersModal\')" style="color:var(--acc)">Создать</a></p>';
  }
  if (Object.keys(S.stickers).length > 0) {
    html += '<p style="font-size:.82em;font-weight:700;color:var(--t2);margin:10px 0 5px;border-top:1px solid var(--brd);padding-top:8px">ВСЕ СТИКЕРЫ</p>';
    Object.entries(S.stickers).forEach(([setId, set]) => {
      if (!set.stickers) return;
      html += '<p style="font-size:.75em;color:var(--t2);margin:6px 0 3px">' + esc(set.name || 'Пак') + ' <span style="color:var(--t3);font-size:.75em">(от ' + esc(set.creator || 'неизвестно') + ')</span></p>';
      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px">';
      Object.entries(set.stickers).slice(0, 16).forEach(([sid, st]) => {
        html += '<button class="sticker-btn" onclick="showStickerInfo(\'' + setId + '\',\'' + esc(set.name || '') + '\')" title="' + esc(set.name || '') + '"><img src="' + st.data + '"></button>';
      });
      html += '</div>';
    });
  }
  c.innerHTML = html;
}

async function insertSticker(data) {
  if (!S.curId) { toast('Откройте чат', true); return; }
  let p = getMPath(); if (!p) return;
  try {
    await db.ref(p + '/messages').push({
      sender: S.user, senderNick: S.nick, type: 'sticker',
      media: data, text: '', timestamp: Date.now()
    });
    updLast('Стикер 🎭');
    closeModal('stickersModal');
  } catch(e) { toast('Ошибка: ' + e.message, true); }
}

// ==================== AUTH ====================
async function autoLogin() {
  let u = localStorage.getItem('ou'), p = localStorage.getItem('op');
  if (!u || !p) return;
  let b = $('loginBtn'); b.disabled = true; b.innerHTML = '<span class="spinner"></span>';
  try {
    let k = san(u);
    let sn = await db.ref('users/' + k).once('value');
    if (!sn.exists()) return;
    let d = sn.val();

    if (d.banned) {
      toast('Аккаунт заблокирован: ' + (d.banReason || 'нарушение правил'), true);
      localStorage.removeItem('ou'); localStorage.removeItem('op');
      return;
    }

    let decPass = decMsg(d.password) || d.password;
    if (decPass !== p) return;
    S.uname = d.username || u; S.nick = d.nickname; S.user = k;
    S.av = d.avatar || ''; S.bio = d.bio || '';
    S.hide = d.hideUsername || false; S.theme = d.theme || 'dark'; S.rank = d.rank || 0;
    afterLogin();
  } catch(e) { console.error('autoLogin:', e); }
  finally { b.disabled = false; b.textContent = 'Войти'; }
}

async function doReg() {
  if (!fbOk) return toast('Firebase не подключён', true);
  let nick = $('regNick').value.trim();
  let user = $('regUser').value.trim();
  let pass = $('regPass').value;
  let pass2 = $('regPass2').value;
  if (!user.startsWith('@')) user = '@' + user;
  if (nick.length < 3) return toast('Никнейм мин. 3 символа', true);
  if (user.length < 3) return toast('Введите username', true);
  if (pass.length < 8) return toast('Пароль мин. 8 символов', true);
  if (pass !== pass2) return toast('Пароли не совпадают', true);
  let ok = await confirm2('Создать аккаунт?'); if (!ok) return;
  let b = $('regBtn'); b.disabled = true; b.innerHTML = '<span class="spinner"></span> Создание...';
  try {
    let k = san(user);
    let sn = await db.ref('users/' + k).once('value');
    if (sn.exists()) { toast('Пользователь уже существует', true); return; }
    let encPass = encMsg(pass);
    await db.ref('users/' + k).set({
      nickname: nick, username: user, password: encPass,
      avatar: '', bio: '', hideUsername: false, theme: 'dark', rank: 0,
      createdAt: Date.now(), lastSeen: Date.now(), online: false
    });
    S.uname = user; S.nick = nick; S.user = k; S.av = ''; S.bio = ''; S.rank = 0;
    localStorage.setItem('ou', user); localStorage.setItem('op', pass);
    closeModal('regModal'); afterLogin(); toast('Аккаунт создан!');
  } catch(e) { toast('Ошибка: ' + e.message, true); }
  finally { b.disabled = false; b.textContent = 'Создать аккаунт'; }
}

async function doLogin() {
  if (!fbOk) return toast('Firebase не подключён', true);
  let user = $('loginU').value.trim();
  let pass = $('loginP').value;
  if (!user) return toast('Введите username', true);
  if (!pass) return toast('Введите пароль', true);
  if (!user.startsWith('@')) user = '@' + user;
  let b = $('loginBtn'); b.disabled = true; b.innerHTML = '<span class="spinner"></span> Вход...';
  try {
    let k = san(user);
    let sn = await db.ref('users/' + k).once('value');
    if (!sn.exists()) { toast('Пользователь не найден', true); return; }
    let d = sn.val();

    if (d.banned) { toast('Аккаунт заблокирован: ' + (d.banReason || 'нарушение правил'), true); return; }

    if (d.globalMutedUntil && d.globalMutedUntil > Date.now()) {
      let rem = Math.ceil((d.globalMutedUntil - Date.now()) / 3600000);
      toast('Отправка сообщений запрещена ещё ' + rem + ' ч.', true); return;
    }

    let decPass = decMsg(d.password) || d.password;
    if (decPass !== pass) { toast('Неверный пароль', true); return; }
    S.uname = d.username || user; S.nick = d.nickname; S.user = k;
    S.av = d.avatar || ''; S.bio = d.bio || '';
    S.hide = d.hideUsername || false; S.theme = d.theme || 'dark'; S.rank = d.rank || 0;
    localStorage.setItem('ou', user); localStorage.setItem('op', pass);
    $('loginU').value = ''; $('loginP').value = '';
    afterLogin();
  } catch(e) { toast('Ошибка: ' + e.message, true); }
  finally { b.disabled = false; b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>Войти'; }
}

async function afterLogin() {
  loadCustomDesign();
  showScreen('mainScr');
  updateProfile();
  loadChats();
  await loadStickers();
  listenIncoming();
  initPushListener();
  if (S.rank === 8 || isDev(S.uname)) {
    let df = $('debugFloat');
    if (df) df.classList.add('active');
  }
  try {
    // ИСПРАВЛЕННЫЙ СТАТУС ОНЛАЙНА
    await db.ref('users/' + S.user + '/online').set(true);
    await db.ref('users/' + S.user + '/lastSeen').set(Date.now());
    
    // Обновляем online статус каждые 30 сек
    setInterval(async () => {
      try {
        await db.ref('users/' + S.user + '/lastSeen').set(Date.now());
        await db.ref('users/' + S.user + '/online').set(true);
      } catch(e) {}
    }, 30000);
    
    // При закрытии страницы - offline
    window.addEventListener('beforeunload', async () => {
      try {
        await db.ref('users/' + S.user + '/online').set(false);
        await db.ref('users/' + S.user + '/lastSeen').set(Date.now());
      } catch(e) {}
    });
  } catch(e) {}
}

function initPushListener() {
  if (!S.user) return;
  db.ref('users/' + S.user + '/banned').on('value', sn => {
    if (sn.val() === true) {
      toast('Ваш аккаунт был заблокирован администратором', true);
      setTimeout(() => switchAcc(), 3000);
    }
  });
  db.ref('users/' + S.user + '/globalMutedUntil').on('value', sn => {
    if (sn.exists() && sn.val() > Date.now()) {
      let rem = Math.ceil((sn.val() - Date.now()) / 3600000);
      toast('Вам запрещено отправлять сообщения на ' + rem + ' ч.', true);
    }
  });
}

function updateProfile() {
  let rk = RANKS[S.rank] || 'Пользователь';
  if ($('myNickD')) $('myNickD').textContent = S.nick;
  if ($('myRankD')) $('myRankD').innerHTML = '<span class="rank-badge rank-' + (S.rank||0) + '">' + rk + '</span>';
  if ($('myUserD')) $('myUserD').textContent = S.hide ? '(скрыто)' : S.uname;
  if ($('myAvL')) $('myAvL').textContent = ini(S.nick);
  if (S.av && $('myAvP')) $('myAvP').innerHTML = '<img src="' + S.av + '">';
  if ($('bioP')) $('bioP').textContent = S.bio || 'Не указано';
  if ($('thTgl')) $('thTgl').classList.toggle('active', S.theme === 'light');
  if ($('thLbl')) $('thLbl').textContent = S.theme === 'dark' ? 'Тёмная' : 'Светлая';
  if ($('hideTgl')) $('hideTgl').classList.toggle('active', S.hide);
  document.documentElement.setAttribute('data-theme', S.theme);
}

// ==================== CHAT LIST ====================
let chatListLsn = null;
function loadChats() {
  try {
    if (chatListLsn) { try { chatListLsn.off(); } catch(e) {} }
    chatListLsn = db.ref('users/' + S.user + '/chatList');
    chatListLsn.on('value', sn => { S.chats = sn.val() || {}; renderChats(); });
  } catch(e) {}
}

function renderChats() {
  let l = $('chatList');
  l.querySelectorAll('.chat-item').forEach(e => e.remove());
  let items = Object.entries(S.chats);
  if (!items.length) { $('emptySt').style.display = 'flex'; return; }
  $('emptySt').style.display = 'none';
  items.sort((a,b) => (b[1].lastTime||0) - (a[1].lastTime||0));
  items.forEach(([id,c]) => {
    let av = '';
    if (c.avatar && c.avatar.trim()) {
      av = '<img src="' + c.avatar + '" style="width:100%;height:100%;object-fit:cover">';
    } else {
      av = ini(c.name||'?');
    }
    let un = c.unread ? '<span class="chat-unread">' + c.unread + '</span>' : '';
    let favIcon = S.favs[id] ? '<span class="fav-badge">⭐</span>' : '';
    let el = document.createElement('div');
    el.className = 'chat-item'; el.dataset.cid = id;
    el.innerHTML = '<div class="chat-avatar">' + av + '</div>' +
      '<div class="chat-info"><div class="chat-name">' + esc(c.name||'Чат') + favIcon + (isDev(c.username) ? '<span class="dev-badge">DEV</span>' : '') + '</div>' +
      '<div class="chat-last-msg">' + esc(c.lastMsg||'') + '</div></div>' +
      '<div class="chat-meta"><div class="chat-time">' + (c.lastTime ? tf(c.lastTime) : '') + '</div>' + un + '</div>';
    el.onclick = () => openChat(id);
    lp(el, e2 => chatCtx(e2, id, c));
    l.appendChild(el);
  });
}

function openChat(id) {
  let c = S.chats[id]; if (!c) return;
  S.curId = id; S.curType = c.type; S.curChat = c;
  if (c.type === 'dm') openDM(id, c);
  else if (c.type === 'group') openGrp(id, c);
  else if (c.type === 'channel') openCh(id, c);
}

function chatCtx(e, id, c) {
  let menu = $('ctxMenu'); menu.innerHTML = '';
  let items = [
    { t: '⭐ ' + (S.favs[id] ? 'Убрать из избранного' : 'В избранное'), fn: () => tglFav(id, c) }
  ];
  if (c.type === 'dm') {
    items.push({ t: '🚫 Заблокировать', cls: 'danger', fn: () => blockUser(id) });
    items.push({ t: '🗑 Удалить чат', cls: 'danger', fn: () => delChat(id) });
  } else if (c.type === 'group') {
    items.push({ t: '🚪 Покинуть группу', cls: 'danger', fn: () => leaveGrp(id, c) });
    items.push({ t: '🗑 Удалить', cls: 'danger', fn: () => delChat(id) });
  } else if (c.type === 'channel') {
    items.push({ t: '🔕 Отписаться', cls: 'danger', fn: () => unsubCh(id, c) });
    items.push({ t: '🗑 Удалить', cls: 'danger', fn: () => delChat(id) });
  }
  items.forEach(it => {
    let b = document.createElement('button');
    b.className = 'ctx-item' + (it.cls ? ' ' + it.cls : '');
    b.textContent = it.t;
    b.onclick = () => { it.fn(); menu.classList.remove('active'); };
    menu.appendChild(b);
  });
  posMenu(menu, e);
}

// ==================== FAVORITES ====================
function tglFav(id, c) {
  if (S.favs[id]) { delete S.favs[id]; toast('Убрано из избранного'); }
  else { S.favs[id] = { ...c, savedAt: Date.now() }; toast('Добавлено в избранное ⭐'); }
  localStorage.setItem('favs', JSON.stringify(S.favs));
  renderChats();
}

function openFavorites() {
  closeModal('setModal');
  let c = $('favoritesC');
  let favList = Object.entries(S.favs);
  if (!favList.length) {
    c.innerHTML = '<div class="empty-st"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><p>Нет избранных чатов</p><p style="font-size:.8em">Удерживайте чат чтобы добавить</p></div>';
  } else {
    let html = '';
    favList.sort((a,b) => (b[1].savedAt||0) - (a[1].savedAt||0));
    favList.forEach(([id, c2]) => {
      let av = c2.avatar ? '<img src="' + c2.avatar + '">' : ini(c2.name||'?');
      html += '<div class="chat-item" onclick="openChat(\'' + id + '\');closeModal(\'favoritesModal\')">' +
        '<div class="chat-avatar">' + av + '</div>' +
        '<div class="chat-info"><div class="chat-name">' + esc(c2.name||'Чат') + ' ⭐</div>' +
        '<div class="chat-last-msg">' + esc(c2.lastMsg||'') + '</div></div>' +
        '<button class="btn btn-ghost btn-sm" style="flex-shrink:0" onclick="event.stopPropagation();tglFav(\'' + id + '\',S.chats[\'' + id + '\']||{});renderFav()">✕</button></div>';
    });
    c.innerHTML = html;
  }
  openModal('favoritesModal');
}

function renderFav() { openFavorites(); }

async function blockUser(id) {
  let ok = await confirm2('Заблокировать?'); if (!ok) return;
  try {
    let oth = id.split('__').find(u => u !== S.user);
    if (oth) await db.ref('users/' + S.user + '/blocked/' + oth).set(true);
    await db.ref('users/' + S.user + '/chatList/' + id).remove();
    toast('Пользователь заблокирован');
  } catch(e) { toast('Ошибка', true); }
}

async function delChat(id) {
  let ok = await confirm2('Удалить из списка?'); if (!ok) return;
  try { await db.ref('users/' + S.user + '/chatList/' + id).remove(); } catch(e) {}
}

async function leaveGrp(id, c) {
  let ok = await confirm2('Покинуть группу?'); if (!ok) return;
  let gid = c.groupId || id.replace('g_', '');
  try {
    await db.ref('groups/' + gid + '/members/' + S.user).remove();
    await db.ref('users/' + S.user + '/chatList/' + id).remove();
    toast('Вы покинули группу');
  } catch(e) { toast('Ошибка', true); }
}

async function unsubCh(id, c) {
  let ok = await confirm2('Отписаться?'); if (!ok) return;
  let cid = c.channelId || id.replace('ch_', '');
  try {
    await db.ref('channels/' + cid + '/subscribers/' + S.user).remove();
    await db.ref('users/' + S.user + '/chatList/' + id).remove();
    toast('Отписались');
  } catch(e) { toast('Ошибка', true); }
}

// ==================== CONTACTS/GROUPS/CHANNELS ====================
async function addContact() {
  let u = $('addCntU').value.trim(), n = $('addCntN').value.trim();
  if (!u.startsWith('@')) u = '@' + u;
  if (!n) n = u;
  let k = san(u);
  if (k === S.user) return toast('Нельзя добавить себя', true);
  try {
    let sn = await db.ref('users/' + k).once('value');
    if (!sn.exists()) return toast('Пользователь не найден', true);
    let ud = sn.val();
    let cid = [S.user, k].sort().join('__');
    await db.ref('users/' + S.user + '/chatList/' + cid).set({ type:'dm', name:n, username:ud.username, avatar:ud.avatar||'', lastMsg:'', lastTime:Date.now(), unread:0 });
    await db.ref('users/' + k + '/chatList/' + cid).set({ type:'dm', name:S.nick, username:S.uname, avatar:S.av||'', lastMsg:'', lastTime:Date.now(), unread:0 });
    await db.ref('chats/' + cid + '/participants').set({ [S.user]:true, [k]:true });
    closeModal('addCntModal'); $('addCntU').value = ''; $('addCntN').value = '';
    toast('Контакт добавлен');
  } catch(e) { toast('Ошибка: ' + e.message, true); }
}

let grpAvD = '';
async function prevGrpAv(i) { if (i.files[0]) { grpAvD = await compImg(i.files[0]); $('grpAvP').innerHTML = '<img src="' + grpAvD + '">'; } }
async function createGrp() {
  let nm = $('grpNmI').value.trim(), ds = $('grpDsI').value.trim(), ms = $('grpMemI').value.trim();
  if (!nm) return toast('Введите название', true);
  try {
    let id = mkId();
    let mem = { [S.user]: { role:'creator', joinedAt:Date.now(), mutedUntil:0 } };
    if (ms) {
      for (let m of ms.split(',').map(x => x.trim()).filter(Boolean)) {
        if (!m.startsWith('@')) m = '@' + m;
        let mk = san(m);
        let sn = await db.ref('users/' + mk).once('value');
        if (sn.exists()) mem[mk] = { role:'member', joinedAt:Date.now(), mutedUntil:0 };
      }
    }
    let rules = { adminsAdd:$('gr1').classList.contains('active'), usersAv:$('gr2').classList.contains('active'), approval:$('gr3').classList.contains('active'), adminsOnly:$('gr4').classList.contains('active') };
    await db.ref('groups/' + id).set({ name:nm, desc:ds, avatar:grpAvD, creator:S.user, createdAt:Date.now(), rules, members:mem });
    for (let mk of Object.keys(mem)) {
      await db.ref('users/' + mk + '/chatList/g_' + id).set({ type:'group', name:nm, avatar:grpAvD, lastMsg:'Группа создана', lastTime:Date.now(), unread:0, groupId:id });
    }
    closeModal('createGrpModal'); grpAvD = ''; $('grpNmI').value = ''; $('grpDsI').value = ''; $('grpMemI').value = '';
    toast('Группа создана!');
  } catch(e) { toast('Ошибка: ' + e.message, true); }
}

let chAvD = '';
async function prevChAv(i) { if (i.files[0]) { chAvD = await compImg(i.files[0]); $('chAvP').innerHTML = '<img src="' + chAvD + '">'; } }
async function createCh() {
  let nm = $('chNmI').value.trim(), ds = $('chDsI').value.trim();
  if (!nm) return toast('Введите название', true);
  try {
    let id = mkId(), nid = Math.floor(Math.random()*900000)+100000;
    let rules = { comments:$('ch1').classList.contains('active'), reactions:$('ch2').classList.contains('active'), inviteOnly:$('ch3').classList.contains('active'), adminsSettings:$('ch4').classList.contains('active') };
    await db.ref('channels/' + id).set({ name:nm, desc:ds, avatar:chAvD, creator:S.user, createdAt:Date.now(), channelId:nid, rules, admins:{[S.user]:'creator'}, subscribers:{[S.user]:true} });
    await db.ref('users/' + S.user + '/chatList/ch_' + id).set({ type:'channel', name:nm, avatar:chAvD, lastMsg:'Канал создан', lastTime:Date.now(), unread:0, channelId:id });
    closeModal('createChModal'); chAvD = ''; $('chNmI').value = ''; $('chDsI').value = '';
    toast('Канал создан!');
  } catch(e) { toast('Ошибка: ' + e.message, true); }
}

// ==================== OPEN CHATS ====================
let msgLsn = null;
function stopListen() { if (msgLsn) { try { msgLsn.off(); } catch(e) {} msgLsn = null; } $('msgsWrap').innerHTML = ''; }
function getMPath() {
  if (S.curType === 'dm') return 'chats/' + S.curId;
  if (S.curType === 'group') return 'groups/' + (S.curChat.groupId || S.curId.replace('g_',''));
  if (S.curType === 'channel') return 'channels/' + (S.curChat.channelId || S.curId.replace('ch_',''));
  return null;
}

function openDM(id, info) {
  showScreen('chatScr');
  $('chNm').innerHTML = esc(info.name||'Чат') + (isDev(info.username) ? '<span class="dev-badge">DEV</span>' : '');
  $('chAv').innerHTML = info.avatar && info.avatar.trim() ? '<img src="' + info.avatar + '">' : ini(info.name);
  $('chSt').textContent = '';
  $('chCallBtn').style.display = '';
  $('inputArea').style.display = 'flex'; $('recInd').style.display = 'none';
  let oth = id.split('__').find(u => u !== S.user);
  if (oth) {
    db.ref('users/' + oth).once('value').then(sn => {
      if (sn.exists()) { 
        let d = sn.val(); 
        let status = d.online ? '🟢 в сети' : (d.lastSeen ? 'был(а) ' + tf(d.lastSeen) : 'неизвестно');
        $('chSt').textContent = status; 
      }
    }).catch(() => {});
  }
  loadWall(id);
  db.ref('users/' + S.user + '/chatList/' + id + '/unread').set(0);
  startListen('chats/' + id, 'dm');
}

function openGrp(id, info) {
  showScreen('chatScr');
  let gid = info.groupId || id.replace('g_','');
  S.curChat = { ...info, groupId: gid };
  $('chNm').innerHTML = esc(info.name||'Группа');
  $('chAv').innerHTML = info.avatar && info.avatar.trim() ? '<img src="' + info.avatar + '">' : ini(info.name);
  $('chSt').textContent = 'группа';
  $('chCallBtn').style.display = '';
  $('inputArea').style.display = 'flex'; $('recInd').style.display = 'none';
  loadWall(id);
  db.ref('users/' + S.user + '/chatList/' + id + '/unread').set(0);
  startListen('groups/' + gid, 'group');
}

function openCh(id, info) {
  showScreen('chatScr');
  let cid = info.channelId || id.replace('ch_','');
  S.curChat = { ...info, channelId: cid };
  $('chNm').innerHTML = esc(info.name||'Канал');
  $('chAv').innerHTML = info.avatar && info.avatar.trim() ? '<img src="' + info.avatar + '">' : ini(info.name);
  $('chSt').textContent = 'канал';
  $('chCallBtn').style.display = 'none';
  
  // СКРЫВАЕМ ПОЛЕ ВВОДА ДЛЯ КАНАЛОВ (если пользователь не админ)
  let isAdmin = false;
  db.ref('channels/' + cid + '/admins/' + S.user).once('value').then(sn => {
    isAdmin = sn.exists() || isDev(S.uname);
    if (!isAdmin) {
      $('inputArea').style.display = 'none';
      $('recInd').style.display = 'none';
      // Показываем сообщение что только администраторы пишут
      let notice = document.createElement('div');
      notice.style.cssText = 'padding:12px;text-align:center;color:var(--t2);font-size:.88em;background:var(--bg3);border-top:1px solid var(--brd)';
      notice.textContent = '🔒 Только администраторы канала могут писать сообщения';
      $('msgsWrap').parentElement.appendChild(notice);
    } else {
      $('inputArea').style.display = 'flex';
      $('recInd').style.display = 'none';
    }
  });
  
  $('msgsWrap').style.backgroundImage = '';
  db.ref('users/' + S.user + '/chatList/' + id + '/unread').set(0);
  startListen('channels/' + cid, 'channel');
}

function loadWall(id) {
  db.ref('users/' + S.user + '/walls/' + san(id)).once('value').then(sn => {
    $('msgsWrap').style.backgroundImage = sn.exists() ? 'url(' + sn.val() + ')' : '';
  }).catch(() => { $('msgsWrap').style.backgroundImage = ''; });
}

async function saveWall(id, data) { try { await db.ref('users/' + S.user + '/walls/' + san(id)).set(data); } catch(e) {} }
async function resetWall() {
  if (!S.curId) return;
  let ok = await confirm2('Сбросить фон?'); if (!ok) return;
  $('msgsWrap').style.backgroundImage = '';
  try { await db.ref('users/' + S.user + '/walls/' + san(S.curId)).remove(); toast('Фон сброшен'); } catch(e) {}
}

(function() {
  let mw = $('msgsWrap');
  lp(mw, e => {
    if (e.target.closest('.msg') || e.target.closest('.ch-post')) return;
    let menu = $('ctxMenu'); menu.innerHTML = '';
    let b1 = document.createElement('button'); b1.className = 'ctx-item'; b1.textContent = '🖼 Изменить фон';
    b1.onclick = () => { menu.classList.remove('active'); pickWall(); };
    let b2 = document.createElement('button'); b2.className = 'ctx-item'; b2.textContent = '🗑 Сбросить фон';
    b2.onclick = () => { menu.classList.remove('active'); resetWall(); };
    menu.appendChild(b1); menu.appendChild(b2);
    posMenu(menu, e);
  });
})();

function pickWall() {
  let i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = async function() {
    if (!this.files[0]) return;
    let d = await compImg(this.files[0], 1200);
    $('msgsWrap').style.backgroundImage = 'url(' + d + ')';
    if (S.curId) { await saveWall(S.curId, d); toast('Фон обновлён'); }
  };
  i.click();
}

// ==================== LISTEN MESSAGES ====================
function startListen(path, type) {
  stopListen();
  let ref = db.ref(path + '/messages').orderByChild('timestamp').limitToLast(100);
  msgLsn = ref;
  ref.on('child_added', sn => {
    let m = sn.val(); if (!m) return;
    m._id = sn.key; m._path = path;
    if (m.deletedForAll) return;
    if (m.deletedFor && m.deletedFor[S.user]) return;
    if (m.encrypted && m.text) m.text = decMsg(m.text) || m.text;
    renderMsg(m, type);
    if (m.sender !== S.user && document.hidden) {
      showNotif(S.curChat?.name || 'Omega', m.type === 'text' ? m.text : '📎 Медиа');
    }
  });
  ref.on('child_changed', sn => {
    let m = sn.val(); if (!m) return;
    m._id = sn.key;
    if (m.deletedForAll) {
      let el = $('msgsWrap').querySelector('[data-id="' + sn.key + '"]');
      if (el) el.remove(); return;
    }
    let el = $('msgsWrap').querySelector('[data-id="' + sn.key + '"]');
    if (el) {
      let rh = buildReactHtml(m);
      let existing = el.querySelector('.msg-reactions');
      if (existing) existing.remove();
      if (rh) el.insertAdjacentHTML('beforeend', rh);
    }
  });
  setTimeout(() => { $('msgsWrap').scrollTop = $('msgsWrap').scrollHeight; }, 500);
}

// ==================== REACTIONS ====================
function buildReactHtml(m) {
  if (!m.reactions) return '';
  let counts = {};
  Object.entries(m.reactions).forEach(([u,r]) => {
    if (!counts[r]) counts[r] = { c:0, own:false, users:[] };
    counts[r].c++;
    counts[r].users.push(u);
    if (u === S.user) counts[r].own = true;
  });
  let rh = '<div class="msg-reactions">';
  for (let [em,d] of Object.entries(counts)) {
    let title = d.users.slice(0, 3).join(', ');
    if (d.users.length > 3) title += ' +' + (d.users.length - 3);
    rh += '<span class="msg-reaction' + (d.own?' own':'') + '" title="' + esc(title) + '" onclick="tglReact(\'' + m._id + '\',\'' + em + '\')">' + em + ' ' + d.c + '</span>';
  }
  return rh + '</div>';
}

async function tglReact(mid, emoji) {
  let p = getMPath(); if (!p) return;
  try {
    let ref = db.ref(p + '/messages/' + mid + '/reactions/' + S.user);
    let sn = await ref.once('value');
    if (sn.exists() && sn.val() === emoji) await ref.remove();
    else await ref.set(emoji);
  } catch(e) { toast('Ошибка реакции', true); }
}

function saveMsgToFav(m) {
  let key = 'fav_msgs';
  let favMsgs = JSON.parse(localStorage.getItem(key) || '[]');
  favMsgs.unshift({ ...m, savedAt: Date.now(), chatName: S.curChat?.name || 'Чат' });
  if (favMsgs.length > 200) favMsgs = favMsgs.slice(0, 200);
  localStorage.setItem(key, JSON.stringify(favMsgs));
  toast('Сообщение сохранено в избранное ⭐');
}

async function delMsg(mid, all) {
  let p = getMPath(); if (!p) return;
  try {
    if (all) await db.ref(p + '/messages/' + mid + '/deletedForAll').set(true);
    else await db.ref(p + '/messages/' + mid + '/deletedFor/' + S.user).set(true);
    let el = $('msgsWrap').querySelector('[data-id="' + mid + '"]');
    if (el) el.remove();
  } catch(e) {}
}

// ==================== RENDER MESSAGE ====================
function renderMsg(m, type) {
  if (type === 'channel') { renderChPost(m); return; }
  let own = m.sender === S.user;
  let div = document.createElement('div');
  div.className = 'msg ' + (own ? 'msg-out' : 'msg-in');
  div.dataset.id = m._id;
  let sender = (!own && type !== 'dm') ? '<div class="msg-sender">' + esc(m.senderNick||m.sender) + '</div>' : '';
  let content = buildContent(m);
  let rh = buildReactHtml(m);
  div.innerHTML = sender + content + '<div class="msg-bottom"><span class="msg-time">' + tf(m.timestamp) + '</span></div>' + rh;
  lp(div, e => msgCtx(e, m, own, type));
  $('msgsWrap').appendChild(div);
  $('msgsWrap').scrollTop = $('msgsWrap').scrollHeight;
}

// ==================== ТАЙМЛАЙН АУДИО ====================
function buildVoiceHtml(m) {
  let dur = formatDur(m.duration || 0);

  let bars = '';
  let seed = 0;
  if (m._id) {
    for (let i = 0; i < m._id.length; i++) {
      seed = ((seed << 5) - seed) + m._id.charCodeAt(i);
      seed |= 0;
    }
  }

  for (let i = 0; i < 32; i++) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    let h = 4 + Math.abs(seed % 22);
    bars += '<div class="vbar" style="width:3px;height:' + h + 'px;border-radius:2px;background:rgba(220,20,60,0.5);flex-shrink:0;transition:background 0.1s"></div>';
  }

  return '<div class="voice-msg" id="vm_' + m._id + '">' +
    '<button class="voice-play" id="vp_' + m._id + '" onclick="playVoice(this,\'' + m._id + '\')">' +
    '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg></button>' +
    '<div style="flex:1;display:flex;flex-direction:column;gap:3px;overflow:hidden;min-width:0">' +
    '<div class="voice-wave-wrap" style="display:flex;align-items:center;gap:1.5px;height:28px;overflow:hidden">' + bars + '</div>' +
    '<div class="voice-timeline" id="vtl_' + m._id + '" style="width:100%;height:4px;background:var(--bg4);border-radius:2px;cursor:pointer;position:relative;user-select:none" onmousedown="voiceSeekStart(event,\'' + m._id + '\')" ontouchstart="voiceSeekStartTouch(event,\'' + m._id + '\')">' +
    '<div class="voice-tl-fill" id="vtlf_' + m._id + '" style="height:100%;background:var(--acc);border-radius:2px;width:0%;pointer-events:none"></div>' +
    '<div class="voice-tl-dot" id="vtld_' + m._id + '" style="position:absolute;top:50%;left:0%;transform:translate(-50%,-50%);width:12px;height:12px;background:var(--acc);border-radius:50%;box-shadow:0 0 6px var(--custom-glow);pointer-events:none;z-index:10"></div>' +
    '</div>' +
    '</div>' +
    '<span class="voice-dur" id="vd_' + m._id + '">' + dur + '</span></div>' +
    '<audio id="va_' + m._id + '" src="' + m.media + '" preload="metadata" ontimeupdate="voiceTimeUpdate(\'' + m._id + '\')" onended="voiceEnd(\'' + m._id + '\')"></audio>';
}

function voiceSeekStart(e, id) {
  e.preventDefault();
  e.stopPropagation();
  
  let tl = $('vtl_' + id);
  let a = $('va_' + id);
  if (!tl || !a || !a.duration || !isFinite(a.duration)) return;

  function onMove(ev) {
    let rect = tl.getBoundingClientRect();
    let x = ev.clientX - rect.left;
    let pct = Math.max(0, Math.min(1, x / rect.width));
    a.currentTime = pct * a.duration;
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }

  let rect = tl.getBoundingClientRect();
  let x = e.clientX - rect.left;
  let pct = Math.max(0, Math.min(1, x / rect.width));
  a.currentTime = pct * a.duration;

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function voiceSeekStartTouch(e, id) {
  e.preventDefault();
  e.stopPropagation();
  
  let tl = $('vtl_' + id);
  let a = $('va_' + id);
  if (!tl || !a || !a.duration || !isFinite(a.duration)) return;

  function onMove(ev) {
    if (!ev.touches[0]) return;
    let rect = tl.getBoundingClientRect();
    let x = ev.touches[0].clientX - rect.left;
    let pct = Math.max(0, Math.min(1, x / rect.width));
    a.currentTime = pct * a.duration;
  }

  function onEnd() {
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
  }

  if (e.touches[0]) {
    let rect = tl.getBoundingClientRect();
    let x = e.touches[0].clientX - rect.left;
    let pct = Math.max(0, Math.min(1, x / rect.width));
    a.currentTime = pct * a.duration;
  }

  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
}

function voiceTimeUpdate(id) {
  let a = $('va_' + id);
  if (!a || !a.duration || !isFinite(a.duration)) return;
  
  let vpf = $('vtlf_' + id);
  let vpd = $('vtld_' + id);
  let vd = $('vd_' + id);
  
  let percent = (a.currentTime / a.duration) * 100;
  
  if (vpf) vpf.style.width = percent + '%';
  if (vpd) vpd.style.left = percent + '%';
  if (vd) vd.textContent = formatDur(a.currentTime);

  let vm = $('vm_' + id);
  if (vm) {
    let bars = vm.querySelectorAll('.vbar');
    let activeCount = Math.floor((a.currentTime / a.duration) * bars.length);
    bars.forEach((bar, i) => {
      bar.style.background = i < activeCount
        ? 'rgba(220,20,60,1)'
        : 'rgba(220,20,60,0.4)';
    });
  }
}

function playVoice(btn, id) {
  let a = $('va_' + id); 
  if (!a) return;
  
  if (a.paused) {
    document.querySelectorAll('audio').forEach(au => { 
      if (au !== a && !au.paused) { 
        au.pause(); 
        let bid = au.id.replace('va_',''); 
        let b2 = $('vp_' + bid); 
        if (b2) b2.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>'; 
      } 
    });

    a.play().catch(e => toast('Ошибка воспроизведения', true));
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  } else {
    a.pause();
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>';
  }
}

function voiceEnd(id) {
  let a = $('va_' + id); 
  if (a) {
    let vd = $('vd_' + id);
    if (vd) vd.textContent = formatDur(a.duration || 0);
    let vpf = $('vtlf_' + id);
    let vpd = $('vtld_' + id);
    if (vpf && vpd) {
      vpf.style.width = '0%';
      vpd.style.left = '0%';
    }
  }
  let btn = $('vp_' + id);
  if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>';
}

function buildFileHtml(m) {
  let ico = '📄';
  if (m.fileName) {
    let ext = m.fileName.split('.').pop().toLowerCase();
    if (['mp3','wav','aac','ogg'].includes(ext)) ico = '🎵';
    else if (['mp4','webm','mov','avi'].includes(ext)) ico = '🎬';
    else if (['zip','rar','7z'].includes(ext)) ico = '📦';
    else if (['txt','js','json','css','html','xml'].includes(ext)) ico = '📝';
    else if (['pdf'].includes(ext)) ico = '📕';
  }
  return '<div class="msg-file" onclick="downloadFile(\'' + m.media.replace(/'/g,"\\'") + '\',\'' + esc(m.fileName) + '\')">' +
    '<span style="font-size:1.5em">' + ico + '</span>' +
    '<div class="msg-file-info"><div class="msg-file-name">' + esc(m.fileName||'Файл') + '</div>' +
    '<div class="msg-file-size">' + (m.fileSize ? (m.fileSize > 1048576 ? (m.fileSize/1048576).toFixed(1)+'MB' : (m.fileSize/1024).toFixed(1)+'KB') : '?') + '</div></div></div>';
}

function downloadFile(data, name) {
  let a = document.createElement('a'); a.href = data; a.download = name||'file'; a.click();
}

function buildVNoteHtml(m) {
  return '<div class="msg-video-note" id="vn_' + m._id + '" onclick="playVN(\'' + m._id + '\')" style="position:relative;cursor:pointer">' +
    '<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" viewBox="0 0 200 200">' +
    '<circle cx="100" cy="100" r="95" fill="none" stroke="var(--custom-border)" stroke-width="2" opacity="0.5"/>' +
    '<circle cx="100" cy="100" r="85" fill="none" stroke="var(--acc)" stroke-width="1" opacity="0.3"/>' +
    '</svg>' +
    '<video src="' + m.media + '" playsinline loop preload="metadata" style="width:100%;height:100%;border-radius:50%;object-fit:cover"></video>' +
    '<div class="vnote-play"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg></div></div>';
}

function playVN(id) {
  let w = $('vn_' + id); if (!w) return;
  let v = w.querySelector('video');
  if (v.paused) { v.play().catch(()=>{}); w.classList.add('playing'); }
  else { v.pause(); w.classList.remove('playing'); }
}

// ==================== CHANNEL POSTS ====================
function renderChPost(m) {
  let own = m.sender === S.user;
  let cid = S.curChat?.channelId;
  let div = document.createElement('div'); div.className = 'ch-post'; div.dataset.id = m._id;
  let content = '';
  if (m.type === 'text') content = '<div class="ch-post-text">' + linkifyChannelIds(esc(m.text)) + '</div>';
  else if (m.type === 'image') content = '<div class="ch-post-media" onclick="openZoom(\'image\',\'' + m.media + '\')"><img src="' + m.media + '"></div>' + (m.text ? '<div class="ch-post-text">' + esc(m.text) + '</div>' : '');
  else if (m.type === 'video') content = '<div class="ch-post-media" onclick="openZoom(\'video\',\'' + m.media + '\')"><video src="' + m.media + '" preload="metadata" controls></video></div>';
  else if (m.type === 'voice') content = buildVoiceHtml(m);
  else if (m.type === 'videoNote') content = buildVNoteHtml(m);
  else if (m.type === 'file') content = buildFileHtml(m);
  else if (m.type === 'sticker') content = '<div style="max-width:150px"><img src="' + m.media + '" style="width:100%;border-radius:8px"></div>';
  let rh = buildReactHtml(m);
  let commHtml = cid ? buildCommHtml(m._id, cid) : '';
  div.innerHTML = '<div class="ch-post-sender">' + esc(m.senderNick||'Канал') + '</div>' + content + '<div class="ch-post-time">' + tf(m.timestamp) + '</div>' + rh + commHtml;
  lp(div, e => msgCtx(e, m, own, 'channel'));
  $('msgsWrap').appendChild(div);
  $('msgsWrap').scrollTop = $('msgsWrap').scrollHeight;
  if (cid) loadComments(m._id, cid, div);
}

function buildCommHtml(mid, cid) {
  return '<div class="ch-comments"><div class="ch-comments-title">💬 Комментарии</div>' +
    '<div class="comments-list" id="cl_' + mid + '"></div>' +
    '<div class="comment-inp-wrap"><input type="text" id="ci_' + mid + '" placeholder="Комментарий..." onkeydown="if(event.key===\'Enter\')addComment(\'' + cid + '\',\'' + mid + '\')">' +
    '<button onclick="addComment(\'' + cid + '\',\'' + mid + '\')"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></div></div>';
}

function loadComments(mid, cid, postDiv) {
  db.ref('channels/' + cid + '/messages/' + mid + '/comments').orderByChild('timestamp').on('child_added', sn => {
    let cm = sn.val(); if (!cm) return;
    let cl = postDiv.querySelector('#cl_' + mid); if (!cl) return;
    let el = document.createElement('div'); el.className = 'comment';
    el.innerHTML = '<div class="comment-av">' + ini(cm.senderNick) + '</div>' +
      '<div class="comment-body"><span class="comment-name">' + esc(cm.senderNick) + '</span> ' +
      '<span class="comment-text">' + esc(cm.text) + '</span>' +
      '<div class="comment-time">' + tf(cm.timestamp) + '</div></div>';
    cl.appendChild(el);
    $('msgsWrap').scrollTop = $('msgsWrap').scrollHeight;
  });
}

async function addComment(cid, mid) {
  let inp = $('ci_' + mid); if (!inp) return;
  let t = inp.value.trim(); if (!t) return;
  try {
    await db.ref('channels/' + cid + '/messages/' + mid + '/comments').push({ sender:S.user, senderNick:S.nick, text:t, timestamp:Date.now() });
    inp.value = '';
  } catch(e) { toast('Ошибка', true); }
}

function linkifyChannelIds(text) {
  return text.replace(/\/([\d]+)\//g, function(match, id) {
    return '<span class="channel-id" style="cursor:pointer;color:#40c4ff;text-decoration:underline" onclick="searchChannelById(\'' + id + '\')" title="Поиск канала">' + match + '</span>';
  });
}

async function searchChannelById(channelId) {
  try {
    let sn = await db.ref('channels').once('value');
    if (!sn.exists()) return toast('Канал не найден', true);
    let found = null;
    sn.forEach(ch => {
      if (ch.val().channelId && String(ch.val().channelId) === channelId) {
        found = ch;
      }
    });
    if (found) {
      let chData = found.val();
      let cid = found.key;
      await db.ref('users/' + S.user + '/chatList/ch_' + cid).set({ 
        type:'channel', name:chData.name, avatar:chData.avatar||'', 
        lastMsg:'', lastTime:Date.now(), unread:0, channelId:cid 
      });
      openChat('ch_' + cid);
      toast('Канал открыт!');
    } else {
      toast('Канал не найден', true);
    }
  } catch(e) { toast('Ошибка: ' + e.message, true); }
}

// ==================== MESSAGE CONTEXT ====================
function msgCtx(e, m, own, type) {
  e.preventDefault();
  e.stopPropagation();
  let menu = $('ctxMenu'); menu.innerHTML = '';
  let items = [
    { t: '😀 Реакция', fn: () => showReactPick(e, m._id) },
    { t: '📋 Копировать', fn: () => { if (m.text) { navigator.clipboard.writeText(m.text).then(() => toast('Скопировано')).catch(() => { let ta = document.createElement('textarea'); ta.value = m.text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Скопировано'); }); } } },
    { t: '⭐ В избранное', fn: () => saveMsgToFav(m) },
    { t: '🗑 Удалить для себя', fn: () => delMsg(m._id, false) }
  ];
  if (own) items.push({ t: '🗑 Удалить для всех', cls:'danger', fn: () => delMsg(m._id, true) });
  items.forEach(it => {
    let b = document.createElement('button');
    b.className = 'ctx-item' + (it.cls ? ' ' + it.cls : '');
    b.textContent = it.t;
    b.onclick = () => { it.fn(); menu.classList.remove('active'); };
    menu.appendChild(b);
  });
  posMenu(menu, e);
}

// ==================== РЕАКЦИИ - ИСПРАВЛЕНИЕ ====================
function showReactPick(e, mid) {
  e.preventDefault();
  e.stopPropagation();

  // Закрыть контекстное меню
  $('ctxMenu').classList.remove('active');

  let p = $('reactPick');
  p.innerHTML = '';

  REACTS.forEach(r => {
    let b = document.createElement('button');
    b.className = 'react-btn';
    b.textContent = r;
    b.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      tglReact(mid, r);
      // ЗАКРЫВАЕМ МЕНЮ ПОСЛЕ КЛИКА
      p.classList.remove('active');
      setTimeout(() => p.style.display = 'none', 100);
    });
    p.appendChild(b);
  });

  let clientX = e.clientX || (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : window.innerWidth / 2);
  let clientY = e.clientY || (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : window.innerHeight / 2);

  p.style.visibility = 'hidden';
  p.style.display = 'flex';
  p.style.position = 'fixed';
  p.style.zIndex = '9999';

  document.body.appendChild(p);
  p.classList.add('active');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      let pw = p.offsetWidth || 260;
      let ph = p.offsetHeight || 56;

      let left = clientX - pw / 2;
      let top = clientY - ph - 12;

      left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
      if (top < 8) top = clientY + 12;
      top = Math.min(top, window.innerHeight - ph - 8);

      p.style.left = left + 'px';
      p.style.top = top + 'px';
      p.style.visibility = 'visible';
    });
  });

  // Закрыть при клике вне меню
  setTimeout(() => {
    document.addEventListener('click', function closeReactPick(evt) {
      if (!p.contains(evt.target) && evt.target !== $('msgI')) {
        p.classList.remove('active');
        p.style.display = 'none';
        document.removeEventListener('click', closeReactPick);
      }
    });
  }, 100);
}

// ==================== SEND MESSAGE ====================
async function sendMsg() {
  if (S.rec) { stopVoiceRecord(); return; }

  let t = $('msgI').value.trim(); 
  if (!t) return;
  
  $('msgI').value = ''; 
  $('msgI').style.height = 'auto';
  let p = getMPath(); if (!p) return;

  if (S.curType === 'channel') {
    let cid = S.curChat.channelId;
    let asn = await db.ref('channels/' + cid + '/admins/' + S.user).once('value');
    if (!asn.exists() && !isDev(S.uname)) { toast('Только администраторы могут писать в канале', true); return; }
  }

  if (S.curType === 'group') {
    let gid = S.curChat.groupId;
    let msn = await db.ref('groups/' + gid + '/members/' + S.user).once('value');
    if (msn.exists() && msn.val().mutedUntil && msn.val().mutedUntil > Date.now()) { toast('Вы заглушены', true); return; }
    let rsn = await db.ref('groups/' + gid + '/rules/adminsOnly').once('value');
    if (rsn.val() === true) {
      let r = await getRole(gid);
      if (r === 'member') { toast('Только администраторы могут писать', true); return; }
    }
  }

  let ud = await db.ref('users/' + S.user + '/globalMutedUntil').once('value');
  if (ud.exists() && ud.val() > Date.now()) { toast('Вам запрещено отправлять сообщения', true); return; }

  try {
    await db.ref(p + '/messages').push({
      sender: S.user, senderNick: S.nick, type: 'text',
      text: encMsg(t), timestamp: Date.now(), encrypted: true
    });
    updLast(t.substring(0, 40));
  } catch(e) { toast('Ошибка отправки', true); }
}

async function attachFile(inp) {
  if (!inp.files[0]) return;
  let f = inp.files[0], p = getMPath(); if (!p) return;
  const ALLOWED = ['txt','xml','png','jpg','jpeg','webp','html','css','mp3','mp4','mp2','wav','ogg','pdf','js','json','zip','rar'];
  let ext = f.name.split('.').pop().toLowerCase();
  if (!ALLOWED.includes(ext)) return toast('Формат не поддерживается', true);
  if (f.size > 100*1024*1024) return toast('Файл > 100МБ', true);
  try {
    toast('Загрузка файла...', false);
    let media = f.type.startsWith('image/') ? await compImg(f) : await f2b64(f);
    let msgType = f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'file';
    await db.ref(p + '/messages').push({ sender:S.user, senderNick:S.nick, type:msgType, media, fileName:f.name, fileSize:f.size, text:'', timestamp:Date.now() });
    updLast(f.name); inp.value = '';
    toast('Файл отправлен');
  } catch(e) { toast('Ошибка: ' + e.message, true); inp.value = ''; }
}

function updLast(t) {
  if (!S.curId) return;
  try {
    let upd = { lastMsg: t, lastTime: Date.now() };
    db.ref('users/' + S.user + '/chatList/' + S.curId).update(upd);
    if (S.curType === 'dm') {
      let oth = S.curId.split('__').find(u => u !== S.user);
      if (oth) {
        db.ref('users/' + oth + '/chatList/' + S.curId).update(upd);
        db.ref('users/' + oth + '/chatList/' + S.curId + '/unread').transaction(v => (v||0)+1);
      }
    } else if (S.curType === 'group') {
      let gid = S.curChat.groupId;
      db.ref('groups/' + gid + '/members').once('value').then(sn => {
        if (!sn.exists()) return;
        sn.forEach(m => {
          if (m.key !== S.user) {
            db.ref('users/' + m.key + '/chatList/g_' + gid).update(upd);
            db.ref('users/' + m.key + '/chatList/g_' + gid + '/unread').transaction(v => (v||0)+1);
          }
        });
      });
    }
  } catch(e) {}
}

// ==================== VOICE RECORDING ====================
let recStream = null;

async function startVoiceRecord() {
  if (S.rec || S.vnRec) return;
  S.recCancelled = false;
  try {
    let stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation:true, noiseSuppression:true, sampleRate:44100 } });
    recStream = stream;
    let opts = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'].filter(t => MediaRecorder.isTypeSupported(t));
    let mimeType = opts[0] || '';
    S.mr = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond:128000 } : {});
    S.rc = [];
    let t0 = Date.now();
    S.mr.ondataavailable = ev => { if (ev.data.size > 0) S.rc.push(ev.data); };
    S.mr.onstop = async () => {
      if (recStream) { recStream.getTracks().forEach(t => t.stop()); recStream = null; }
      if (S.recCancelled) { stopRecUI(); return; }
      if (S.rc.length === 0) { stopRecUI(); return; }
      let blob = new Blob(S.rc, { type: mimeType || 'audio/webm' });
      if (blob.size < 100) { stopRecUI(); toast('Запись слишком короткая', true); return; }
      let dur = (Date.now() - t0) / 1000;
      let b64 = await b2b64(blob);
      let p = getMPath();
      if (!p) { stopRecUI(); return; }
      try {
        await db.ref(p + '/messages').push({ sender:S.user, senderNick:S.nick, type:'voice', media:b64, duration:dur, timestamp:Date.now() });
        updLast('🎤 Голосовое');
      } catch(e) { toast('Ошибка отправки', true); }
      stopRecUI();
    };
    S.mr.start(100);
    S.rec = true;
    startRecUI();
    S._recAutoStop = setTimeout(() => { if (S.rec) stopVoiceRecord(); }, 60000);
  } catch(e) { toast('Разрешите доступ к микрофону', true); }
}

function stopVoiceRecord() {
  clearTimeout(S._recAutoStop);
  if (S.mr && S.rec) {
    try { S.mr.stop(); } catch(e) {}
    S.rec = false;
  }
}

function cancelVoiceRecord() {
  S.recCancelled = true;
  clearTimeout(S._recAutoStop);
  if (S.mr && S.rec) {
    try { S.mr.stop(); } catch(e) {}
    S.rec = false;
  }
  if (recStream) { recStream.getTracks().forEach(t => t.stop()); recStream = null; }
  stopRecUI();
  toast('Запись отменена');
}

function startRecUI() {
  let ia = $('inputArea'), ri = $('recInd');
  if (ia) ia.style.display = 'none';
  if (ri) ri.style.display = 'flex';
  let vb = $('voiceBtn');
  if (vb) vb.classList.add('recording');
  S.rs = 0;
  S.rt = setInterval(() => { S.rs++; if ($('recT')) $('recT').textContent = formatDur(S.rs); }, 1000);
}

function stopRecUI() {
  let ia = $('inputArea'), ri = $('recInd');
  if (ia) ia.style.display = 'flex';
  if (ri) ri.style.display = 'none';
  let vb = $('voiceBtn');
  if (vb) vb.classList.remove('recording');
  clearInterval(S.rt); S.rs = 0;
  if ($('recT')) $('recT').textContent = '0:00';
}

// ==================== ВИДЕО-КРУЖКИ - ПОЛНАЯ ПЕРЕПИСКА ====================
let vnoteStream = null, vnoteMr = null, vnoteChunks = [];

async function startVNoteRecordMouse() {
  if (S.rec || S.vnRec) return;
  await startVNoteRecord();
}

async function startVNoteRecordTouch() {
  if (S.rec || S.vnRec) return;
  await startVNoteRecord();
}

async function startVNoteRecord() {
  if (S.rec || S.vnRec) return;
  let p = getMPath(); 
  if (!p) { toast('Откройте чат', true); return; }

  try {
    vnoteStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 480 },
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: false
    });

    let prev = $('recPrev'), pv = $('recPrevVid');
    if (prev && pv) {
      pv.srcObject = vnoteStream;
      prev.classList.add('active');
    }

    let supportedTypes = [];
    let types = [
      'video/webm;codecs=vp8',
      'video/webm;codecs=vp9',
      'video/webm',
      'video/mp4'
    ];
    
    for (let type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        supportedTypes.push(type);
      }
    }
    
    let mimeType = supportedTypes[0] || '';
    
    vnoteMr = new MediaRecorder(vnoteStream, {
      mimeType: mimeType,
      videoBitsPerSecond: 800000
    });
    
    vnoteChunks = [];
    let t0 = Date.now();

    vnoteMr.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        vnoteChunks.push(ev.data);
      }
    };

    vnoteMr.onerror = (err) => {
      console.error('VNote recorder error:', err);
      toast('Ошибка записи видео: ' + (err.error?.name || 'неизвестная'), true);
      stopVNoteRecord();
    };

    vnoteMr.onstop = async () => {
      if (vnoteStream) {
        vnoteStream.getTracks().forEach(t => t.stop());
        vnoteStream = null;
      }

      let prev2 = $('recPrev');
      if (prev2) prev2.classList.remove('active');

      if (vnoteChunks.length === 0) {
        toast('Запись пустая', true);
        S.vnRec = false;
        let vb = $('vnoteBtn');
        if (vb) vb.classList.remove('recording');
        return;
      }

      try {
        let blob = new Blob(vnoteChunks, { type: mimeType || 'video/webm' });
        
        if (blob.size < 500) {
          toast('Запись слишком короткая', true);
          S.vnRec = false;
          let vb = $('vnoteBtn');
          if (vb) vb.classList.remove('recording');
          return;
        }

        let processedBlob = await processVideoNote(blob, mimeType || 'video/webm');
        let dur = (Date.now() - t0) / 1000;
        
        let b64 = await b2b64(processedBlob);

        let pm = getMPath();
        if (!pm) {
          toast('Чат не открыт', true);
          S.vnRec = false;
          let vb = $('vnoteBtn');
          if (vb) vb.classList.remove('recording');
          return;
        }

        try {
          let msgData = {
            sender: S.user,
            senderNick: S.nick,
            type: 'videoNote',
            media: b64,
            duration: Math.round(dur),
            timestamp: Date.now()
          };

          await db.ref(pm + '/messages').push(msgData);
          updLast('📹 Видео-кружок');
          toast('📹 Видео-кружок отправлен!');
        } catch(err) {
          console.error('VNote send error:', err);
          toast('Ошибка отправки: ' + err.message, true);
        }

        S.vnRec = false;
        let vb = $('vnoteBtn');
        if (vb) vb.classList.remove('recording');

      } catch(err) {
        console.error('VNote process error:', err);
        toast('Ошибка обработки видео: ' + err.message, true);
        S.vnRec = false;
        let vb = $('vnoteBtn');
        if (vb) vb.classList.remove('recording');
      }
    };

    vnoteMr.start(500);
    S.vnRec = true;

    let vb = $('vnoteBtn');
    if (vb) vb.classList.add('recording');

    S._vnAutoStop = setTimeout(() => {
      if (S.vnRec) {
        toast('⏱ Максимальная длина 60 сек');
        stopVNoteRecord();
      }
    }, 60000);

    toast('🔴 Запись видео-кружка... Нажмите снова для отправки');
  } catch(e) {
    console.error('VNote start error:', e);
    toast('Ошибка доступа к камере: ' + e.message, true);
    S.vnRec = false;
  }
}

function stopVNoteRecord() {
  clearTimeout(S._vnAutoStop);
  if (vnoteMr && S.vnRec) {
    try {
      if (vnoteMr.state && vnoteMr.state !== 'inactive') {
        vnoteMr.stop();
      }
    } catch(e) {
      console.error('stopVNote:', e);
    }
  }
  S.vnRec = false;
  let vb = $('vnoteBtn');
  if (vb) vb.classList.remove('recording');
}

// ==================== ОБРАБОТКА ВИДЕО-ЗАМЕТОК ====================
async function processVideoNote(blob, mimeType) {
  return new Promise((resolve, reject) => {
    try {
      let video = document.createElement('video');
      video.src = URL.createObjectURL(blob);
      
      video.onloadedmetadata = () => {
        try {
          let canvas = document.createElement('canvas');
          let size = Math.min(video.videoWidth, video.videoHeight, 480);
          let x = (video.videoWidth - size) / 2;
          let y = (video.videoHeight - size) / 2;
          
          canvas.width = size;
          canvas.height = size;
          
          let ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) {
            reject(new Error('Canvas context error'));
            return;
          }
          
          let waitFrame = setInterval(() => {
            if (video.readyState >= 2) {
              clearInterval(waitFrame);
              
              try {
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, size, size);
                ctx.drawImage(video, x, y, size, size, 0, 0, size, size);
                
                canvas.toBlob(
                  (outputBlob) => {
                    URL.revokeObjectURL(video.src);
                    resolve(outputBlob || blob);
                  },
                  mimeType,
                  0.8
                );
              } catch(drawErr) {
                reject(drawErr);
              }
            }
          }, 100);
          
          video.currentTime = 0;
        } catch(e) {
          reject(e);
        }
      };
      
      video.onerror = () => {
        reject(new Error('Video load error'));
      };
    } catch(e) {
      reject(e);
    }
  });
}

// ==================== SEARCH ====================
function tglChatSearch() {
  $('chatSearch').classList.toggle('active');
  $('chatSearchI').value = '';
  document.querySelectorAll('.msg.highlight').forEach(m => m.classList.remove('highlight'));
  if ($('chatSearch').classList.contains('active')) $('chatSearchI').focus();
}

function searchMsgs() {
  let q = $('chatSearchI').value.trim().toLowerCase();
  document.querySelectorAll('.msg.highlight').forEach(m => m.classList.remove('highlight'));
  if (!q) return;
  let found = false;
  $('msgsWrap').querySelectorAll('.msg').forEach(m => {
    let txt = m.querySelector('.msg-text');
    if (txt && txt.textContent.toLowerCase().includes(q)) {
      m.classList.add('highlight');
      if (!found) { m.scrollIntoView({ behavior:'smooth', block:'center' }); found = true; }
    }
  });
  if (!found) toast('Не найдено');
}

function buildContent(m) {
  if (m.type === 'text') return '<div class="msg-text">' + linkifyChannelIds(esc(m.text)) + '</div>';
  if (m.type === 'image') return '<div class="msg-media"><img src="' + m.media + '" onclick="openZoom(\'image\',\'' + m.media + '\')"></div>' + (m.text ? '<div class="msg-text">' + esc(m.text) + '</div>' : '');
  if (m.type === 'video') return '<div class="msg-media"><video src="' + m.media + '" preload="metadata" controls style="width:100%;border-radius:8px;cursor:pointer"></video></div>';
  if (m.type === 'voice' || m.type === 'audio') return buildVoiceHtml(m);
  if (m.type === 'videoNote') return buildVNoteHtml(m);
  if (m.type === 'sticker') return '<div style="max-width:180px"><img src="' + m.media + '" style="width:100%;border-radius:8px;border:1px solid var(--custom-border);cursor:pointer" onclick="openZoom(\'image\',\'' + m.media + '\')"></div>';
  if (m.type === 'file') return buildFileHtml(m);
  return '<div class="msg-text">[Медиа]</div>';
}

// ==================== SETTINGS ====================
async function getRole(gid) {
  if (isDev(S.uname)) return 'creator';
  try { let sn = await db.ref('groups/' + gid + '/members/' + S.user + '/role').once('value'); return sn.exists() ? sn.val() : 'member'; } catch(e) { return 'member'; }
}

async function showProfile() {
  if (S.curType === 'dm') {
    let oth = S.curId.split('__').find(u => u !== S.user); if (!oth) return;
    let sn = await db.ref('users/' + oth).once('value'); if (!sn.exists()) return;
    let d = sn.val(), rk = RANKS[d.rank] || 'Пользователь';
    let status = d.online ? '🟢 В сети' : (d.lastSeen ? 'был(а) ' + tf(d.lastSeen) : 'неизвестно');
    $('profileC').innerHTML = '<div style="text-align:center">' +
      '<div class="avatar-lg" style="margin:0 auto 10px">' + (d.avatar ? '<img src="' + d.avatar + '">' : ini(d.nickname)) + '</div>' +
      '<h3 style="margin-bottom:5px">' + esc(d.nickname) + (isDev(d.username) ? '<span class="dev-badge"> Разработчик</span>' : '') + '</h3>' +
      '<span class="rank-badge rank-' + (d.rank||0) + '">' + rk + '</span>' +
      (!d.hideUsername ? '<p style="color:var(--t2);font-size:.88em;margin-top:5px">' + esc(d.username) + '</p>' : '') +
      (d.bio ? '<p style="margin:8px 0;font-size:.9em;line-height:1.4">' + esc(d.bio) + '</p>' : '') +
      '<p style="color:var(--t3);font-size:.8em;margin:5px 0">' + status + '</p>' +
      '<button class="btn btn-danger btn-sm" style="margin-top:12px" onclick="blockUser(\'' + S.curId + '\')">🚫 Заблокировать</button></div>';
    openModal('profileModal');
  } else if (S.curType === 'group') showGrpSet();
  else if (S.curType === 'channel') showChSet();
}

async function showGrpSet() {
  let gid = S.curChat?.groupId; if (!gid) return;
  try {
    let sn = await db.ref('groups/' + gid).once('value'); if (!sn.exists()) return;
    let g = sn.val(), r = await getRole(gid);
    let ce = ['creator', 'senior_admin', 'admin'].includes(r) || g.rules?.usersAv;

    let h = '<div style="text-align:center">' +
      '<div class="avatar-lg" onclick="chgGrpAv(\'' + gid + '\')" style="cursor:pointer">' +
      (g.avatar && g.avatar.trim() ? '<img src="' + g.avatar + '">' : ini(g.name)) +
      '</div>' +
      '<h3>' + esc(g.name) + '</h3>' +
      (g.desc ? '<p style="color:var(--t2);font-size:.88em">' + esc(g.desc) + '</p>' : '') +
      '</div>';

    if (ce) {
      h += '<div class="input-group" style="margin-top:10px"><label>Название</label><input type="text" id="eGN" value="' + esc(g.name) + '"></div>';
      h += '<div class="input-group"><label>Описание</label><textarea id="eGD" style="height:60px">' + esc(g.desc || '') + '</textarea></div>';
      h += '<button class="btn btn-primary btn-sm" onclick="saveGrpSet(\'' + gid + '\')">💾 Сохранить</button>';
    }

    if (['creator', 'senior_admin'].includes(r)) {
      let ru = g.rules || {};
      h += '<div style="margin-top:12px;border-top:1px solid var(--brd);padding-top:10px">';
      h += '<p style="font-size:.82em;font-weight:700;margin-bottom:6px">Правила группы</p>';
      h += '<div class="chk-grp"><label>Только админы добавляют</label><button class="toggle' + (ru.adminsAdd ? ' active' : '') + '" onclick="this.classList.toggle(\'active\');updGR(\'' + gid + '\',\'adminsAdd\',this.classList.contains(\'active\'))"></button></div>';
      h += '<div class="chk-grp"><label>Участники меняют аватар</label><button class="toggle' + (ru.usersAv ? ' active' : '') + '" onclick="this.classList.toggle(\'active\');updGR(\'' + gid + '\',\'usersAv\',this.classList.contains(\'active\'))"></button></div>';
      h += '<div class="chk-grp"><label>Одобрение вступления</label><button class="toggle' + (ru.approval ? ' active' : '') + '" onclick="this.classList.toggle(\'active\');updGR(\'' + gid + '\',\'approval\',this.classList.contains(\'active\'))"></button></div>';
      h += '<div class="chk-grp"><label>Только админы пишут</label><button class="toggle' + (ru.adminsOnly ? ' active' : '') + '" onclick="this.classList.toggle(\'active\');updGR(\'' + gid + '\',\'adminsOnly\',this.classList.contains(\'active\'))"></button></div>';
      h += '</div>';
    }

    h += '<button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="showMems(\'' + gid + '\')">👥 Участники</button>';

    if (!['member'].includes(r)) {
      h += '<button class="btn btn-ghost btn-sm" style="margin-top:5px;width:100%" onclick="addGrpMem(\'' + gid + '\')">➕ Добавить</button>';
    }

    $('grpSetC').innerHTML = h;
    openModal('grpSetModal');
  } catch(e) {
    toast('Ошибка загрузки: ' + e.message, true);
  }
}

async function updGR(gid, key, val) { try { await db.ref('groups/' + gid + '/rules/' + key).set(val); toast('Обновлено'); } catch(e) { toast('Ошибка', true); } }

async function saveGrpSet(gid) {
  let n = $('eGN').value.trim(), d = $('eGD').value.trim(); if (!n) return toast('Введите название', true);
  try {
    await db.ref('groups/' + gid).update({ name:n, desc:d });
    let ms = await db.ref('groups/' + gid + '/members').once('value');
    if (ms.exists()) ms.forEach(m => db.ref('users/' + m.key + '/chatList/g_' + gid).update({name:n}));
    toast('Сохранено'); closeModal('grpSetModal');
  } catch(e) { toast('Ошибка', true); }
}

function chgGrpAv(gid) {
  let i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = async function() { if (!this.files[0]) return; let d = await compImg(this.files[0]); await db.ref('groups/' + gid + '/avatar').set(d); toast('Аватар обновлён'); };
  i.click();
}

async function addGrpMem(gid) {
  let u = prompt('Введите @username:'); if (!u) return;
  if (!u.startsWith('@')) u = '@' + u; let k = san(u);
  try {
    let sn = await db.ref('users/' + k).once('value'); if (!sn.exists()) return toast('Не найден', true);
    let g = (await db.ref('groups/' + gid).once('value')).val();
    await db.ref('groups/' + gid + '/members/' + k).set({ role:'member', joinedAt:Date.now(), mutedUntil:0 });
    await db.ref('users/' + k + '/chatList/g_' + gid).set({ type:'group', name:g.name, avatar:g.avatar||'', lastMsg:'Вас добавили', lastTime:Date.now(), unread:1, groupId:gid });
    toast('Участник добавлен');
  } catch(e) { toast('Ошибка', true); }
}

async function showMems(gid) {
  let sn = await db.ref('groups/' + gid + '/members').once('value'); if (!sn.exists()) return;
  let mem = sn.val(), myRole = await getRole(gid);
  let sorted = Object.entries(mem).sort((a,b) => { let o = {creator:0,senior_admin:1,admin:2,member:3}; return (o[a[1].role]||3) - (o[b[1].role]||3); });
  let h = '';
  for (let [k,m] of sorted) {
    let ud = (await db.ref('users/' + k).once('value')).val() || { nickname:k, rank:0 };
    let rk = RANKS[ud.rank] || 'Пользователь';
    let rl = m.role==='creator' ? '<span class="member-role creator">Создатель</span>' : m.role==='senior_admin' ? '<span class="member-role senior">Ст.Адм</span>' : m.role==='admin' ? '<span class="member-role admin">Адм</span>' : '';
    h += '<div class="member-item" data-mk="' + k + '">' +
      '<div class="chat-avatar" style="width:36px;height:36px;font-size:.8em">' + (ud.avatar && ud.avatar.trim() ? '<img src="' + ud.avatar + '">' : ini(ud.nickname)) + '</div>' +
      '<div style="flex:1"><div style="font-size:.88em;font-weight:600">' + esc(ud.nickname) + rl + '<span class="rank-badge rank-' + (ud.rank||0) + '">' + rk + '</span>' + (isDev(ud.username) ? '<span class="dev-badge">DEV</span>' : '') + '</div>' +
      '<div style="font-size:.75em;color:var(--t3)">' + (!ud.hideUsername ? esc(ud.username||'') : '') + '</div></div></div>';
  }
  $('memC').innerHTML = h; closeModal('grpSetModal'); openModal('memModal');
  document.querySelectorAll('#memC .member-item').forEach(el => {
    let mk = el.dataset.mk;
    el.onclick = () => memClick(gid, mk);
    if (mk !== S.user) lp(el, e2 => memCtx(e2, gid, mk, myRole));
  });
}

function memClick(gid, mk) {
  if (mk === S.user) return;
  db.ref('users/' + mk).once('value').then(sn => {
    if (!sn.exists()) return; let d = sn.val(), rk = RANKS[d.rank] || 'Пользователь';
    let status = d.online ? '🟢 В сети' : (d.lastSeen ? 'был(а) ' + tf(d.lastSeen) : 'неизвестно');
    $('profileC').innerHTML = '<div style="text-align:center">' +
      '<div class="avatar-lg" style="margin:0 auto 10px">' + (d.avatar && d.avatar.trim() ? '<img src="' + d.avatar + '">' : ini(d.nickname)) + '</div>' +
      '<h3>' + esc(d.nickname) + (isDev(d.username) ? '<span class="dev-badge">DEV</span>' : '') + '</h3>' +
      '<span class="rank-badge rank-' + (d.rank||0) + '">' + rk + '</span>' +
      (!d.hideUsername ? '<p style="color:var(--t2);font-size:.88em;margin-top:5px">' + esc(d.username) + '</p>' : '') +
      (d.bio ? '<p style="font-size:.88em;margin:6px 0">' + esc(d.bio) + '</p>' : '') +
      '<p style="color:var(--t3);font-size:.8em;margin:5px 0">' + status + '</p>' +
      '<button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="dmFromProfile(\'' + mk + '\',\'' + esc(d.nickname) + '\',\'' + (d.avatar||'') + '\')">💬 Написать</button></div>';
    closeModal('memModal'); openModal('profileModal');
  });
}

async function dmFromProfile(uk, nick, av) {
  let cid = [S.user, uk].sort().join('__');
  let my = (await db.ref('users/' + S.user).once('value')).val();
  await db.ref('users/' + S.user + '/chatList/' + cid).set({ type:'dm', name:nick, avatar:av, lastMsg:'', lastTime:Date.now(), unread:0 });
  await db.ref('users/' + uk + '/chatList/' + cid).set({ type:'dm', name:my.nickname, username:my.username, avatar:my.avatar||'', lastMsg:'', lastTime:Date.now(), unread:0 });
  await db.ref('chats/' + cid + '/participants').set({ [S.user]:true, [uk]:true });
  closeModal('profileModal'); openChat(cid);
}

function memCtx(e, gid, mk, myRole) {
  let menu = $('ctxMenu'); menu.innerHTML = '';
  let items = [];
  if (['creator', 'senior_admin'].includes(myRole)) {
    items.push({ t:'🚫 Исключить', cls:'danger', fn: async () => {
      let ok = await confirm2('Исключить участника?'); if (!ok) return;
      await db.ref('groups/' + gid + '/members/' + mk).remove();
      await db.ref('users/' + mk + '/chatList/g_' + gid).remove();
      closeModal('memModal'); toast('Исключён');
    }});
  }
  if (!['member'].includes(myRole)) {
    items.push({ t:'🔇 Заглушить', fn: () => {
      $('muteC').innerHTML = '<p style="margin-bottom:10px">На сколько минут?</p><div class="input-group"><input type="number" id="muteM" value="5" min="1" max="10080"></div><button class="btn btn-primary" onclick="doMute(\'' + gid + '\',\'' + mk + '\')">Заглушить</button>';
      closeModal('memModal'); openModal('muteModal');
    }});
  }
  if (['creator'].includes(myRole)) {
    items.push({ t:'⭐ Назначить роль', fn: () => {
      $('roleC').innerHTML = '<div style="display:flex;flex-direction:column;gap:6px">' +
        '<button class="btn btn-ghost" onclick="setRole(\'' + gid + '\',\'' + mk + '\',\'member\')">👤 Участник</button>' +
        '<button class="btn" style="background:var(--grn);color:#000;border-color:var(--grn)" onclick="setRole(\'' + gid + '\',\'' + mk + '\',\'admin\')">🛡 Администратор</button>' +
        '<button class="btn" style="background:var(--blu);color:#000;border-color:var(--blu)" onclick="setRole(\'' + gid + '\',\'' + mk + '\',\'senior_admin\')">⚡ Ст.Администратор</button></div>';
      closeModal('memModal'); openModal('roleModal');
    }});
  }
  items.forEach(it => {
    let b = document.createElement('button');
    b.className = 'ctx-item' + (it.cls ? ' '+it.cls : '');
    b.textContent = it.t;
    b.onclick = () => { it.fn(); menu.classList.remove('active'); };
    menu.appendChild(b);
  });
  posMenu(menu, e);
}

async function doMute(gid, mk) {
  let mins = parseInt($('muteM').value)||5;
  await db.ref('groups/' + gid + '/members/' + mk + '/mutedUntil').set(Date.now() + mins*60000);
  toast('Заглушён на ' + mins + ' мин.'); closeModal('muteModal');
}
async function setRole(gid, mk, role) {
  await db.ref('groups/' + gid + '/members/' + mk + '/role').set(role);
  toast('Роль обновлена'); closeModal('roleModal');
}

async function showChSet() {
  let cid = S.curChat?.channelId; if (!cid) return;
  try {
    let sn = await db.ref('channels/' + cid).once('value'); if (!sn.exists()) return;
    let ch = sn.val(), isAdm = !!(ch.admins?.[S.user]) || isDev(S.uname);

    let h = '<div style="text-align:center">' +
      '<div class="avatar-lg" onclick="chgChAv(\'' + cid + '\')" style="cursor:pointer">' +
      (ch.avatar && ch.avatar.trim() ? '<img src="' + ch.avatar + '">' : ini(ch.name)) +
      '</div>' +
      '<h3>' + esc(ch.name) + '</h3>' +
      (ch.desc ? '<p style="color:var(--t2);font-size:.88em">' + esc(ch.desc) + '</p>' : '') +
      '<p style="color:var(--t3);font-size:.78em">ID: /' + ch.channelId + '/</p>' +
      '</div>';

    if (isAdm) {
      h += '<div class="input-group" style="margin-top:12px"><label>Название</label><input type="text" id="eCN" value="' + esc(ch.name) + '"></div>';
      h += '<div class="input-group"><label>Описание</label><textarea id="eCD" style="height:60px">' + esc(ch.desc || '') + '</textarea></div>';
      h += '<button class="btn btn-primary btn-sm" onclick="saveChSet(\'' + cid + '\')">💾 Сохранить</button>';

      let ru = ch.rules || {};
      h += '<div style="margin-top:12px;border-top:1px solid var(--brd);padding-top:10px">';
      h += '<p style="font-size:.82em;font-weight:700;margin-bottom:6px">Настройки канала</p>';
      h += '<div class="chk-grp"><label>Комментарии</label><button class="toggle' + (ru.comments ? ' active' : '') + '" onclick="this.classList.toggle(\'active\');updChRule(\'' + cid + '\',\'comments\',this.classList.contains(\'active\'))"></button></div>';
      h += '<div class="chk-grp"><label>Реакции</label><button class="toggle' + (ru.reactions ? ' active' : '') + '" onclick="this.classList.toggle(\'active\');updChRule(\'' + cid + '\',\'reactions\',this.classList.contains(\'active\'))"></button></div>';
      h += '<div class="chk-grp"><label>По приглашению</label><button class="toggle' + (ru.inviteOnly ? ' active' : '') + '" onclick="this.classList.toggle(\'active\');updChRule(\'' + cid + '\',\'inviteOnly\',this.classList.contains(\'active\'))"></button></div>';
      h += '<div class="chk-grp"><label>Админы меняют настройки</label><button class="toggle' + (ru.adminsSettings ? ' active' : '') + '" onclick="this.classList.toggle(\'active\');updChRule(\'' + cid + '\',\'adminsSettings\',this.classList.contains(\'active\'))"></button></div>';
      h += '</div>';
    }

    let isSub = ch.subscribers?.[S.user];
    if (!isSub) {
      h += '<button class="btn btn-primary btn-sm" style="margin-top:10px;width:100%" onclick="subCh(\'' + cid + '\')">📩 Подписаться</button>';
    }

    $('chSetC').innerHTML = h;
    openModal('chSetModal');
  } catch(e) {
    toast('Ошибка загрузки: ' + e.message, true);
  }
}

async function updChRule(cid, key, val) {
  try {
    await db.ref('channels/' + cid + '/rules/' + key).set(val);
    toast('✅ Обновлено');
  } catch(e) {
    toast('Ошибка', true);
  }
}

async function saveChSet(cid) {
  let n = $('eCN').value.trim(), d = $('eCD').value.trim(); if (!n) return toast('Введите название', true);
  try { 
    await db.ref('channels/' + cid).update({ name:n, desc:d });
    let subs = await db.ref('channels/' + cid + '/subscribers').once('value');
    if (subs.exists()) {
      subs.forEach(s => {
        db.ref('users/' + s.key + '/chatList/ch_' + cid).update({name:n});
      });
    }
    toast('Сохранено'); 
    closeModal('chSetModal'); 
  } catch(e) { toast('Ошибка', true); }
}

function chgChAv(cid) {
  let i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = async function() { if (!this.files[0]) return; let d = await compImg(this.files[0]); await db.ref('channels/' + cid + '/avatar').set(d); toast('Аватар обновлён'); };
  i.click();
}

async function subCh(cid) {
  let ch = (await db.ref('channels/' + cid).once('value')).val();
  await db.ref('channels/' + cid + '/subscribers/' + S.user).set(true);
  await db.ref('users/' + S.user + '/chatList/ch_' + cid).set({ type:'channel', name:ch.name, avatar:ch.avatar||'', lastMsg:'', lastTime:Date.now(), unread:0, channelId:cid });
  toast('Подписались!'); closeModal('chSetModal');
}

async function searchCh() {
  let q = $('searchI').value.trim().toLowerCase(), r = $('searchRes');
  if (!q) { r.innerHTML = ''; return; }
  try {
    let sn = await db.ref('channels').once('value');
    if (!sn.exists()) { r.innerHTML = '<p style="color:var(--t3);text-align:center">Ничего не найдено</p>'; return; }
    let h = '', f = false;
    sn.forEach(ch => {
      let c = ch.val();
      let matchesName = c.name && c.name.toLowerCase().includes(q);
      let matchesId = c.channelId && String(c.channelId).includes(q);
      if ((matchesName || matchesId) && !(c.rules && c.rules.inviteOnly)) {
        f = true;
        h += '<div class="chat-item" onclick="subCh(\'' + ch.key + '\');closeModal(\'searchModal\')">' +
          '<div class="chat-avatar">' + (c.avatar && c.avatar.trim() ? '<img src="' + c.avatar + '">' : ini(c.name)) + '</div>' +
          '<div class="chat-info"><div class="chat-name">' + esc(c.name) + '</div>' +
          '<div class="chat-last-msg">ID: /' + c.channelId + '/ - ' + esc(c.desc||'') + '</div></div></div>';
      }
    });
    r.innerHTML = f ? h : '<p style="color:var(--t3);text-align:center">Ничего не найдено</p>';
  } catch(e) { r.innerHTML = '<p style="color:var(--err);text-align:center">Ошибка поиска</p>'; }
}

// ==================== SETTINGS ====================
async function chgNick() {
  let n = $('newNickI').value.trim(); if (n.length < 3) return toast('Мин. 3 символа', true);
  try { S.nick = n; await db.ref('users/' + S.user + '/nickname').set(n); $('myNickD').textContent = n; closeModal('chgNickModal'); toast('Никнейм изменён'); } catch(e) {}
}
async function chgBio() {
  let b = $('newBioI').value.trim();
  try { S.bio = b; await db.ref('users/' + S.user + '/bio').set(b); if ($('bioP')) $('bioP').textContent = b||'Не указано'; closeModal('chgBioModal'); toast('Био сохранено'); } catch(e) {}
}
async function chgPass() {
  let o = $('oldPI').value, n = $('newPI').value;
  let sn = await db.ref('users/' + S.user + '/password').once('value');
  let decPass = decMsg(sn.val()) || sn.val();
  if (decPass !== o) return toast('Неверный текущий пароль', true);
  if (n.length < 8) return toast('Новый пароль мин. 8 символов', true);
  await db.ref('users/' + S.user + '/password').set(encMsg(n));
  localStorage.setItem('op', n); closeModal('chgPassModal'); toast('Пароль изменён');
}
async function chgMyAv(i) {
  if (!i.files[0]) return; let d = await compImg(i.files[0]); S.av = d;
  await db.ref('users/' + S.user + '/avatar').set(d);
  if ($('myAvP')) $('myAvP').innerHTML = '<img src="' + d + '">';
  toast('Аватар обновлён');
}
function tglTheme() {
  let b = $('thTgl'); b.classList.toggle('active');
  S.theme = b.classList.contains('active') ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', S.theme);
  if ($('thLbl')) $('thLbl').textContent = S.theme === 'dark' ? 'Тёмная' : 'Светлая';
  try { db.ref('users/' + S.user + '/theme').set(S.theme); } catch(e) {}
}
function tglHide() {
  let b = $('hideTgl'); b.classList.toggle('active'); S.hide = b.classList.contains('active');
  try { db.ref('users/' + S.user + '/hideUsername').set(S.hide); } catch(e) {}
}
function switchAcc() { localStorage.removeItem('ou'); localStorage.removeItem('op'); closeModal('setModal'); location.reload(); }

async function delAcc() {
  let ok = await confirm2('ВНИМАНИЕ! Удалить аккаунт навсегда?'); if (!ok) return;

  let protectedAccounts = ['_liagushka', '_nata'];
  if (protectedAccounts.includes(S.user)) {
    startWhiteNoise();
    setTimeout(() => {
      stopWhiteNoise();
      toast('⚠ Система защищена', true);
    }, 10000);
    return;
  }

  try { await db.ref('users/' + S.user).remove(); switchAcc(); } catch(e) {}
}

function listenSystemMode() {
  db.ref('system/greyscaleMode').on('value', sn => {
    if (sn.val() === true) {
      document.documentElement.setAttribute('data-greyscale', 'true');
      let dm = $('customDesignModal');
      if (dm) {
        let controls = dm.querySelectorAll('input, button, textarea, select');
        controls.forEach(el => {
          if (!el.classList.contains('modal-close')) {
            el.disabled = true;
            el.style.opacity = '0.3';
          }
        });
      }
      toast('🚨 Дизайн заблокирован системой', true);
    } else {
      document.documentElement.removeAttribute('data-greyscale');
    }
  });
}

// ==================== CALLS ====================
const ICE = { iceServers: [{ urls:'stun:stun.l.google.com:19302' }, { urls:'stun:stun1.l.google.com:19302' }, { urls:'stun:stun2.l.google.com:19302' }] };

async function startCall(tp, q) {
  closeModal('callModal');
  if (!S.curId) return;
  let cid = mkId(); S.callId = cid; S.ct = tp;
  let con = { audio: true };
  if (tp === 'video') { let h = q==='360p' ? 360 : q==='480p' ? 480 : 720; con.video = { height:{ideal:h}, facingMode:'user' }; }
  try { S.ls = await navigator.mediaDevices.getUserMedia(con); }
  catch(e) { toast('Разрешите доступ к устройствам', true); return; }

  showCallUI(tp);
  if (tp === 'video' && $('locVid')) $('locVid').srcObject = S.ls;

  S.pc = new RTCPeerConnection(ICE);
  S.ls.getTracks().forEach(t => S.pc.addTrack(t, S.ls));
  S.pc.ontrack = e => { if ($('remVid') && $('remVid').srcObject !== e.streams[0]) { $('remVid').srcObject = e.streams[0]; if ($('callStat')) $('callStat').textContent = '🟢 Подключено'; } };
  S.pc.onicecandidate = e => { if (e.candidate) db.ref('calls/' + cid + '/cand/' + S.user).push(JSON.stringify(e.candidate)); };

  let offer = await S.pc.createOffer();
  await S.pc.setLocalDescription(offer);

  let callees = {};
  if (S.curType === 'dm') {
    let oth = S.curId.split('__').find(u => u !== S.user);
    if (oth) callees[oth] = true;
  } else if (S.curType === 'group') {
    let gid = S.curChat.groupId;
    let ms = await db.ref('groups/' + gid + '/members').once('value');
    if (ms.exists()) ms.forEach(m => { if (m.key !== S.user) callees[m.key] = true; });
  }

  await db.ref('calls/' + cid).set({ caller:S.user, callerName:S.nick, callees, type:tp, quality:q||'', offer:JSON.stringify(offer), status:'ringing', timestamp:Date.now() });

  db.ref('calls/' + cid + '/answer').on('value', async sn => {
    if (!sn.exists() || !S.pc) return;
    try { if (S.pc.signalingState === 'have-local-offer') await S.pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sn.val()))); } catch(e) {}
  });

  Object.keys(callees).forEach(k => {
    db.ref('calls/' + cid + '/cand/' + k).on('child_added', sn => {
      if (!S.pc) return;
      try { S.pc.addIceCandidate(new RTCIceCandidate(JSON.parse(sn.val()))); } catch(e) {}
    });
  });

  db.ref('calls/' + cid + '/status').on('value', sn => { if (sn.val() === 'ended') endCall(); });
}

function showCallUI(tp) {
  $('callScr').classList.add('active');
  if ($('callNm')) $('callNm').textContent = S.curChat?.name || 'Звонок';
  if ($('callAv')) $('callAv').innerHTML = ini(S.curChat?.name||'?');
  if ($('callStat')) $('callStat').textContent = '📞 Вызов...';
  if (tp === 'video') {
    if ($('callVids')) $('callVids').style.display = 'grid';
    if ($('camB')) $('camB').style.display = '';
    if ($('scrB')) $('scrB').style.display = '';
    if ($('audioCallB')) $('audioCallB').style.display = '';
  } else {
    if ($('callVids')) $('callVids').style.display = 'none';
    if ($('camB')) $('camB').style.display = 'none';
    if ($('scrB')) $('scrB').style.display = 'none';
    if ($('audioCallB')) $('audioCallB').style.display = 'none';
  }
}

function listenIncoming() {
  db.ref('calls').on('child_added', sn => {
    let c = sn.val();
    if (!c || c.status !== 'ringing' || c.caller === S.user) return;
    if (!c.callees || !c.callees[S.user]) return;
    if (Date.now() - c.timestamp > 30000) return;
    S.callId = sn.key; S.ct = c.type;
    if ($('incNm')) $('incNm').textContent = c.callerName || 'Входящий';
    if ($('incL')) $('incL').textContent = ini(c.callerName||'?');
    if ($('incTp')) $('incTp').textContent = c.type === 'video' ? '📹 Видеозвонок' : '📞 Аудиозвонок';
    openModal('incModal');
    showNotif('📞 Входящий звонок', c.callerName || 'Неизвестный');
    setTimeout(() => { if ($('incModal').classList.contains('active')) rejCall(); }, 30000);
  });
}

async function ansCall() {
  closeModal('incModal');
  let cid = S.callId; if (!cid) return;
  try {
    let sn = await db.ref('calls/' + cid).once('value'); if (!sn.exists()) return;
    let c = sn.val();
    let con = { audio:true };
    if (c.type === 'video') { let h = c.quality==='360p' ? 360 : c.quality==='480p' ? 480 : 720; con.video = { height:{ideal:h} }; }
    S.ls = await navigator.mediaDevices.getUserMedia(con);
    S.ct = c.type; showCallUI(c.type);
    if (c.type === 'video' && $('locVid')) $('locVid').srcObject = S.ls;

    S.pc = new RTCPeerConnection(ICE);
    S.ls.getTracks().forEach(t => S.pc.addTrack(t, S.ls));
    S.pc.ontrack = e => { if ($('remVid') && $('remVid').srcObject !== e.streams[0]) { $('remVid').srcObject = e.streams[0]; if ($('callStat')) $('callStat').textContent = '🟢 Подключено'; } };
    S.pc.onicecandidate = ev => { if (ev.candidate) db.ref('calls/' + cid + '/cand/' + S.user).push(JSON.stringify(ev.candidate)); };

    await S.pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(c.offer)));
    let answer = await S.pc.createAnswer();
    await S.pc.setLocalDescription(answer);
    await db.ref('calls/' + cid + '/answer').set(JSON.stringify(answer));
    await db.ref('calls/' + cid + '/status').set('connected');

    db.ref('calls/' + cid + '/cand/' + c.caller).on('child_added', sn2 => {
      if (!S.pc) return;
      try { S.pc.addIceCandidate(new RTCIceCandidate(JSON.parse(sn2.val()))); } catch(e) {}
    });
    db.ref('calls/' + cid + '/status').on('value', sn2 => { if (sn2.val() === 'ended') endCall(); });
  } catch(e) { toast('Ошибка звонка: ' + e.message, true); }
}

function rejCall() { closeModal('incModal'); if (S.callId) try { db.ref('calls/' + S.callId + '/status').set('ended'); } catch(e) {} }

function endCall() {
  if (S.callId) try { db.ref('calls/' + S.callId + '/status').set('ended'); } catch(e) {}
  if (S.pc) { try { S.pc.close(); } catch(e) {} S.pc = null; }
  if (S.ls) { S.ls.getTracks().forEach(t => t.stop()); S.ls = null; }
  if (S.ss) { S.ss.getTracks().forEach(t => t.stop()); S.ss = null; }
  $('callScr').classList.remove('active');
  try { if ($('remVid')) $('remVid').srcObject = null; if ($('locVid')) $('locVid').srcObject = null; } catch(e) {}
  S.callId = null; S.ct = null;
  [$('muteB'),$('camB'),$('scrB'),$('spkB')].forEach(b => b && b.classList.remove('active'));
}

function tglMic() { if (!S.ls) return; let a = S.ls.getAudioTracks()[0]; if (a) { a.enabled = !a.enabled; $('muteB').classList.toggle('active'); } }
function tglCam() { if (!S.ls) return; let v = S.ls.getVideoTracks()[0]; if (v) { v.enabled = !v.enabled; $('camB').classList.toggle('active'); } }
function makeAudioOnly() { if (!S.ls) return; S.ls.getVideoTracks().forEach(t => { t.enabled = !t.enabled; }); $('audioCallB').classList.toggle('active'); }

async function tglScr() {
  if (S.ss) {
    S.ss.getTracks().forEach(t => t.stop()); S.ss = null;
    $('scrB').classList.remove('active');
    let ct = S.ls?.getVideoTracks()[0];
    let snd = S.pc?.getSenders().find(s => s.track?.kind === 'video');
    if (snd && ct) try { await snd.replaceTrack(ct); } catch(e) {}
    if ($('locVid')) $('locVid').srcObject = S.ls;
    return;
  }
  try {
    S.ss = await navigator.mediaDevices.getDisplayMedia({ video:{ cursor:'always' }, audio:false });
    let st = S.ss.getVideoTracks()[0];
    let snd = S.pc?.getSenders().find(s => s.track?.kind === 'video');
    if (snd) try { await snd.replaceTrack(st); } catch(e) {}
    $('scrB').classList.add('active');
    if ($('locVid')) $('locVid').srcObject = S.ss;
    st.onended = () => tglScr();
  } catch(e) { toast('Демонстрация экрана недоступна', false); }
}

function tglSpk() {
  let r = $('remVid');
  if (r) { S.spk = !S.spk; r.muted = !S.spk; $('spkB').classList.toggle('active'); }
}

async function doPiP() {
  if (!document.pictureInPictureEnabled) return toast('PiP не поддерживается', true);
  let v = $('remVid');
  if (!v || !v.srcObject) v = $('locVid');
  if (!v || !v.srcObject) return toast('Нет видеопотока', true);
  try {
    if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return; }
    await v.play().catch(() => {});
    await v.requestPictureInPicture();
  } catch(e) { toast('PiP: ' + e.message, true); }
}

// ==================== DEBUG MENU ====================
function toggleDebugPanel() {
  let p = $('debugPanel');
  if (p) p.classList.toggle('active');
}

function debugChgAvatar() {
  closeDebugPanel();
  openModal('debugAvModal');
}

function debugBanUser() {
  closeDebugPanel();
  openModal('debugBanModal');
}

function debugMuteUser() {
  closeDebugPanel();
  openModal('debugMuteModal');
}

function debugSetRank() {
  closeDebugPanel();
  openModal('debugRankModal');
}

function closeDebugPanel() {
  let p = $('debugPanel');
  if (p) p.classList.remove('active');
}

async function debugDoChgAvatar() {
  let type = $('debugAvType').value.trim().toLowerCase();
  let target = $('debugAvTarget').value.trim();
  if (!type || !target) return toast('Заполните все поля', true);

  let i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = async function() {
    if (!this.files[0]) return;
    let data = await compImg(this.files[0]);
    try {
      if (type === 'user') {
        if (!target.startsWith('@')) target = '@' + target;
        let k = san(target);
        await db.ref('users/' + k + '/avatar').set(data);
        toast('✅ Аватар пользователя изменён');
      } else if (type === 'group') {
        let sn = await db.ref('groups').orderByChild('name').equalTo(target).once('value');
        if (!sn.exists()) return toast('Группа не найдена', true);
        sn.forEach(g => db.ref('groups/' + g.key + '/avatar').set(data));
        toast('✅ Аватар группы изменён');
      } else if (type === 'channel') {
        await db.ref('channels/' + target + '/avatar').set(data);
        toast('✅ Аватар канала изменён');
      }
      closeModal('debugAvModal');
    } catch(e) { toast('Ошибка: ' + e.message, true); }
  };
  i.click();
}

async function debugDoBan() {
  let target = $('debugBanTarget').value.trim();
  let reason = $('debugBanReason').value.trim() || 'Нарушение правил';
  if (!target) return toast('Введите username', true);
  if (!target.startsWith('@')) target = '@' + target;
  let k = san(target);
  let ok = await confirm2('Заблокировать ' + target + '?'); if (!ok) return;
  try {
    let sn = await db.ref('users/' + k).once('value');
    if (!sn.exists()) return toast('Пользователь не найден', true);
    await db.ref('users/' + k + '/banned').set(true);
    await db.ref('users/' + k + '/banReason').set(reason);
    await db.ref('users/' + k + '/bannedAt').set(Date.now());
    await db.ref('users/' + k + '/bannedBy').set(S.user);
    toast('✅ Пользователь ' + target + ' заблокирован');
    closeModal('debugBanModal');
  } catch(e) { toast('Ошибка: ' + e.message, true); }
}

async function debugDoMute() {
  let target = $('debugMuteTarget').value.trim();
  let hours = parseInt($('debugMuteHours').value) || 0;
  if (!target) return toast('Введите username', true);
  if (!target.startsWith('@')) target = '@' + target;
  let k = san(target);
  try {
    let sn = await db.ref('users/' + k).once('value');
    if (!sn.exists()) return toast('Пользователь не найден', true);
    let until = hours === 0 ? 9999999999999 : Date.now() + hours * 3600000;
    await db.ref('users/' + k + '/globalMutedUntil').set(until);
    await db.ref('users/' + k + '/globalMutedBy').set(S.user);
    toast('✅ Отправка сообщений запрещена для ' + target + (hours === 0 ? ' навсегда' : ' на ' + hours + ' ч.'));
    closeModal('debugMuteModal');
  } catch(e) { toast('Ошибка: ' + e.message, true); }
}

async function debugDoSetRank() {
  let target = $('debugRankTarget').value.trim();
  let rank = parseInt($('debugRankValue').value);
  if (!target) return toast('Введите username', true);
  if (rank < 0 || rank > 8) return toast('Звание от 0 до 8', true);
  if (!target.startsWith('@')) target = '@' + target;
  let k = san(target);
  try {
    let sn = await db.ref('users/' + k).once('value');
    if (!sn.exists()) return toast('Пользователь не найден', true);
    await db.ref('users/' + k + '/rank').set(rank);
    toast('✅ Звание ' + RANKS[rank] + ' выдано пользователю ' + target);
    if (rank === 8) {
      await db.ref('users/' + k + '/rankSetAt').set(Date.now());
    }
    closeModal('debugRankModal');
  } catch(e) { toast('Ошибка: ' + e.message, true); }
}

// ==================== INIT ====================
async function init() {
  if (!localStorage.getItem('ck')) $('cookieBar').classList.add('active');

  try { S.favs = JSON.parse(localStorage.getItem('favs') || '{}'); } catch(e) { S.favs = {}; }

  if (!initFB()) return;
  await testFB();
  initHistoryHandler();
  await autoLogin();
  await initNotif();
  await registerSW();
  await reqPerms();
  loadCustomDesign();
  listenSystemMode();
}

init();

// ==================== 2. FIXES ====================
// ==================== OMEGA FIXES V6 ====================


// ==================== WHITE NOISE ====================
function startWhiteNoise() {
  if (S.whiteNoiseActive) return;
  S.whiteNoiseActive = true;
  let overlay = $('whiteNoiseOverlay'), canvas = $('noiseCanvas');
  if (!overlay || !canvas) return;
  overlay.classList.add('active');
  let ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  let animate = () => {
    let img = ctx.createImageData(canvas.width, canvas.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) { let v = Math.floor(Math.random() * 256); d[i]=v; d[i+1]=v; d[i+2]=v; d[i+3]=255; }
    ctx.putImageData(img, 0, 0);
    if (S.whiteNoiseActive) requestAnimationFrame(animate);
  };
  animate();
  playWhiteNoiseSound();
}

function playWhiteNoiseSound() {
  try {
    let ac = new (window.AudioContext || window.webkitAudioContext)();
    let buf = ac.createBuffer(1, ac.sampleRate * 10, ac.sampleRate);
    let d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    let src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    let gain = ac.createGain(); gain.gain.value = 0.3;
    src.connect(gain); gain.connect(ac.destination); src.start(0);
    S.whiteNoiseAudio = { source: src, context: ac };
  } catch(e) {}
}

function stopWhiteNoise() {
  S.whiteNoiseActive = false;
  let ov = $('whiteNoiseOverlay'); if (ov) ov.classList.remove('active');
  if (S.whiteNoiseAudio) {
    try { S.whiteNoiseAudio.source.stop(); S.whiteNoiseAudio.context.close(); } catch(e) {}
    S.whiteNoiseAudio = null;
  }
}

document.addEventListener('click', () => {
  if (S.whiteNoiseActive) stopWhiteNoise();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && S.whiteNoiseActive) stopWhiteNoise();
});

// ==================== DEBUG PANEL DRAG ====================
(function() {
  let df = $('debugFloat'), dp = $('debugPanel'), dob = $('debugOrbBtn');
  if (!df || !dob) return;

  let dragging = false, startX = 0, startY = 0, curX = 20, curY = window.innerHeight - 160;
  let clicked = false;

  function setPos(x, y) {
    curX = Math.max(0, Math.min(window.innerWidth - 52, x));
    curY = Math.max(0, Math.min(window.innerHeight - 52, y));
    df.style.left = curX + 'px';
    df.style.bottom = (window.innerHeight - curY - 52) + 'px';
    if (dp) { dp.style.left = curX + 'px'; dp.style.bottom = (window.innerHeight - curY + 8) + 'px'; }
  }

  dob.addEventListener('mousedown', e => {
    dragging = true; clicked = true;
    startX = e.clientX; startY = e.clientY;
    dob.style.cursor = 'grabbing';
  });
  dob.addEventListener('touchstart', e => {
    dragging = true; clicked = true;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) clicked = false;
    setPos(curX + (e.clientX - startX), curY + (e.clientY - startY));
    startX = e.clientX; startY = e.clientY;
  });
  document.addEventListener('touchmove', e => {
    if (!dragging) return;
    setPos(curX + (e.touches[0].clientX - startX), curY + (e.touches[0].clientY - startY));
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('mouseup', () => {
    if (dragging && clicked) toggleDebugPanel();
    dragging = false; clicked = false;
    if (dob) dob.style.cursor = 'grab';
    localStorage.setItem('debugOrbPos', JSON.stringify({ x: curX, y: curY }));
  });
  document.addEventListener('touchend', () => {
    if (dragging && clicked) toggleDebugPanel();
    dragging = false; clicked = false;
    localStorage.setItem('debugOrbPos', JSON.stringify({ x: curX, y: curY }));
  });

  try {
    let saved = JSON.parse(localStorage.getItem('debugOrbPos') || '{}');
    if (saved.x !== undefined) setPos(saved.x, saved.y);
  } catch(e) {}
})();

// ==================== ЭФФЕКТЫ ОТЛАДКИ ====================
function addEffectsToDebugMenu() {
  let dp = $('debugPanel'); if (!dp || dp.querySelector('#debugEffectsItem')) return;
  let item = document.createElement('div');
  item.id = 'debugEffectsItem'; item.className = 'debug-item';
  item.innerHTML = '<div class="debug-item-title">✨ Эффекты</div><div class="debug-item-desc">Визуальные эффекты</div>';
  item.onclick = () => {
    let v = prompt('1-Глитч 2-Шум случайный 3-Шум постоянный 4-Серый фильтр:');
    if (!v) return;
    activateEffect(parseInt(v));
  };
  dp.appendChild(item);
}

async function activateEffect(n) {
  if (n === 1) {
    let ov = $('glitchOverlay');
    if (ov) { ov.classList.add('active'); setTimeout(() => ov.classList.remove('active'), 3000); }
    toast('Глитч!');
  } else if (n === 2) {
    S._noiseTimer = setInterval(() => {
      if (Math.random() > 0.3) return;
      startWhiteNoise(); setTimeout(stopWhiteNoise, 500);
    }, 300);
    toast('Шум включён');
  } else if (n === 3) {
    startWhiteNoise(); toast('Шум включён (Escape для выкл)');
  } else if (n === 4) {
    document.documentElement.setAttribute('data-greyscale', 'true');
    try { await db.ref('system/greyscaleMode').set(true); } catch(e) {}
    toast('Серый фильтр для всех!');
  }
}

// ==================== РЕДАКТОР СООБЩЕНИЙ ====================
function addMessageEditorToDebugMenu() {
  let dp = $('debugPanel'); if (!dp || dp.querySelector('#debugEditorItem')) return;
  let item = document.createElement('div');
  item.id = 'debugEditorItem'; item.className = 'debug-item';
  item.innerHTML = '<div class="debug-item-title">✏️ Редактировать</div><div class="debug-item-desc">Изменить своё сообщение</div>';
  item.onclick = () => {
    let msgs = Array.from($('msgsWrap').querySelectorAll('[data-id]')).reverse();
    let myMsg = msgs.find(m => m.classList.contains('msg-out'));
    if (!myMsg) return toast('Нет своих сообщений', true);
    let old = myMsg.querySelector('.msg-text')?.textContent || '';
    let nw = prompt('Новый текст:', old);
    if (nw === null || nw === old) return;
    editMessage(myMsg.dataset.id, nw);
  };
  dp.appendChild(item);
}

async function editMessage(msgId, newText) {
  if (!S.curId) return;
  let p = getMPath(); if (!p) return;
  try {
    await db.ref(p + '/messages/' + msgId).update({ text: encMsg(newText), edited: true, editedAt: Date.now(), encrypted: true });
    toast('✏️ Отредактировано');
    let el = $('msgsWrap').querySelector('[data-id="' + msgId + '"]');
    if (el) { let txt = el.querySelector('.msg-text'); if (txt) txt.textContent = newText; }
  } catch(e) { toast('Ошибка', true); }
}

// ==================== FCM ТОКЕНЫ В ДЕБАГ МЕНЮ ====================
function addFCMTokensToDebugMenu() {
  let dp = $('debugPanel'); if (!dp || dp.querySelector('#debugFCMItem')) return;
  let item = document.createElement('div');
  item.id = 'debugFCMItem'; item.className = 'debug-item';
  item.innerHTML = '<div class="debug-item-title">📡 FCM токены</div><div class="debug-item-desc">Все push-токены</div>';
  item.onclick = () => { if (typeof showFCMTokens === 'function') showFCMTokens(); };
  dp.appendChild(item);
}

// ==================== СИСТЕМНЫЙ GREYSCALE ====================
if (typeof db !== 'undefined' && db) {
  db.ref('system/greyscaleMode').on('value', sn => {
    if (sn.val() === true) {
      document.documentElement.setAttribute('data-greyscale', 'true');
      toast('🚨 Дизайн заблокирован', true);
    } else {
      document.documentElement.removeAttribute('data-greyscale');
    }
  });
}

// ==================== INIT ====================
function initAllFixes() {
  if (S.rank === 8 || isDev(S.uname)) {
    setTimeout(() => {
      addEffectsToDebugMenu();
      addMessageEditorToDebugMenu();
      addFCMTokensToDebugMenu();
    }, 800);
  }
  console.log('✅ omega-fixes.js v6');
}

const _origShowScreenFixes = showScreen;
window.showScreen = function(id) {
  _origShowScreenFixes.call(this, id);
  if (id === 'chatScr' && (S.rank === 8 || isDev(S.uname))) {
    setTimeout(() => {
      addEffectsToDebugMenu();
      addMessageEditorToDebugMenu();
      addFCMTokensToDebugMenu();
    }, 300);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initAllFixes, 1500));
} else {
  setTimeout(initAllFixes, 1500);
}

console.log('🔧 omega-fixes.js v6 загружен');

// ==================== 3. FCM ====================
// ==================== OMEGA FCM - WEB PUSH ====================

// ВАЖНО: Заполните VAPID_KEY и config из Firebase Console

const FCM_CONFIG = {
  apiKey: "ЗАПОЛНИТЕ_ИЗ_FIREBASE_CONSOLE",
  authDomain: "omega-e3d75.firebaseapp.com",
  databaseURL: "https://omega-e3d75-default-rtdb.firebaseio.com",
  projectId: "omega-e3d75",
  storageBucket: "omega-e3d75.appspot.com",
  messagingSenderId: "ЗАПОЛНИТЕ",
  appId: "ЗАПОЛНИТЕ"
};

// VAPID ключ: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Generate key pair
const VAPID_KEY = 'ЗАПОЛНИТЕ_VAPID_KEY';

let fcmMessaging = null;

async function initFCM() {
  if (!S.user) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[FCM] Push не поддерживается');
    return;
  }

  try {
    // Регистрируем SW из файла (НЕ blob! — FCM требует реальный файл)
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    S.swRegistration = swReg;

    // Инициализируем messaging
    if (!firebase.messaging) {
      console.log('[FCM] firebase-messaging-compat не подключён');
      return;
    }
    fcmMessaging = firebase.messaging();

    // Запрашиваем разрешение
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      console.log('[FCM] Разрешение отклонено');
      return;
    }

    // Получаем токен
    const token = await fcmMessaging.getToken({
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg
    });

    if (!token) { console.log('[FCM] Токен не получен'); return; }

    // Определяем платформу
    const ua = navigator.userAgent.toLowerCase();
    const platform = /android/.test(ua) ? 'android' : /iphone|ipad|ipod/.test(ua) ? 'ios' : 'web';

    // Сохраняем в Firebase
    await db.ref('fcmTokens/' + platform + '/' + S.user).set({
      token: token,
      platform: platform,
      updatedAt: Date.now(),
      userAgent: navigator.userAgent.substring(0, 100)
    });

    console.log('[FCM] Токен сохранён для платформы:', platform);

    // Слушаем foreground уведомления
    fcmMessaging.onMessage(payload => {
      const n = payload.notification || {};
      showNotif(n.title || 'Omega', n.body || 'Новое сообщение');
    });

  } catch(e) {
    console.log('[FCM] Ошибка:', e.message);
  }
}

async function removeFCMToken() {
  if (!S.user) return;
  const ua = navigator.userAgent.toLowerCase();
  const platform = /android/.test(ua) ? 'android' : /iphone|ipad|ipod/.test(ua) ? 'ios' : 'web';
  try {
    if (fcmMessaging) await fcmMessaging.deleteToken();
    await db.ref('fcmTokens/' + platform + '/' + S.user).remove();
  } catch(e) {}
}

// ==================== FCM ТОКЕНЫ — ПРОСМОТР (ТОЛЬКО ДЛЯ DEV/RANK 8) ====================
async function showFCMTokens() {
  closeDebugPanel();
  if (S.rank < 8 && !isDev(S.uname)) { toast('Нет доступа', true); return; }

  let modal = document.getElementById('fcmTokensModal');
  if (modal) modal.remove();

  try {
    let sn = await db.ref('fcmTokens').once('value');
    let data = sn.exists() ? sn.val() : {};

    let totalCount = 0;
    let html = '';

    ['web', 'android', 'ios'].forEach(pl => {
      let tk = data[pl] || {};
      let entries = Object.entries(tk);
      totalCount += entries.length;

      let plIcon = pl === 'web' ? '🌐' : pl === 'android' ? '🤖' : '🍎';

      html += '<div style="margin-bottom:16px;padding:10px;background:var(--bg3);border-radius:8px;border:1px solid var(--custom-border)">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
      html += '<p style="font-weight:700;color:var(--acc);margin:0">' + plIcon + ' ' + pl.toUpperCase() + '</p>';
      html += '<span style="background:var(--bg4);padding:2px 8px;border-radius:10px;font-size:.8em;color:var(--t2)">' + entries.length + ' токен' + (entries.length === 1 ? '' : entries.length < 5 ? 'а' : 'ов') + '</span>';
      html += '</div>';

      if (!entries.length) {
        html += '<p style="color:var(--t3);font-size:.82em;text-align:center;padding:8px">Нет токенов</p>';
      } else {
        entries.forEach(([user, v]) => {
          let token = v?.token || String(v);
          let updAt = v?.updatedAt ? new Date(v.updatedAt).toLocaleString('ru') : '—';
          html += '<div style="padding:8px;background:var(--bg2);border-radius:6px;margin-bottom:6px;border:1px solid var(--brd)">';
          html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">';
          html += '<b style="font-size:.85em;color:var(--t1)">' + esc(user) + '</b>';
          html += '<button onclick="delFcmToken(\'' + pl + '\',\'' + user + '\')" style="background:var(--err);color:#fff;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:.72em">✕ Удалить</button>';
          html += '</div>';
          html += '<div style="font-family:monospace;font-size:.68em;color:var(--t3);word-break:break-all;background:var(--bg4);padding:5px;border-radius:4px;margin-bottom:4px">' + esc(token.substring(0, 80)) + (token.length > 80 ? '...' : '') + '</div>';
          html += '<div style="display:flex;justify-content:space-between">';
          html += '<span style="font-size:.7em;color:var(--t3)">🕐 ' + updAt + '</span>';
          html += '<button onclick="copyToClip(\'' + token.replace(/'/g,"\\'") + '\')" style="background:var(--bg4);color:var(--t2);border:1px solid var(--brd);border-radius:4px;padding:1px 6px;cursor:pointer;font-size:.7em">📋 Копировать</button>';
          html += '</div>';
          html += '</div>';
        });
      }
      html += '</div>';
    });

    let modalEl = document.createElement('div');
    modalEl.className = 'modal-overlay active';
    modalEl.id = 'fcmTokensModal';
    modalEl.innerHTML = '<div class="modal" style="max-height:85vh">' +
      '<button class="modal-close" onclick="document.getElementById(\'fcmTokensModal\').remove()">×</button>' +
      '<h2>📡 FCM Токены</h2>' +
      '<div style="text-align:center;padding:4px 0 10px;font-size:.85em;color:var(--t2)">Всего: <b style="color:var(--acc)">' + totalCount + '</b></div>' +
      '<div class="modal-body">' + html +
      '<button class="btn btn-danger" style="margin-top:8px" onclick="clearAllFCMTokens()">🗑 Очистить все токены</button>' +
      '</div></div>';
    document.body.appendChild(modalEl);
    modalEl.addEventListener('click', e => { if (e.target === modalEl) modalEl.remove(); });

  } catch(e) { toast('Ошибка: ' + e.message, true); }
}

async function delFcmToken(platform, user) {
  try {
    await db.ref('fcmTokens/' + platform + '/' + user).remove();
    toast('✅ Токен удалён');
    showFCMTokens();
  } catch(e) { toast('Ошибка', true); }
}

async function clearAllFCMTokens() {
  let ok = await confirm2('Удалить ВСЕ FCM токены?');
  if (!ok) return;
  try {
    await db.ref('fcmTokens').remove();
    toast('✅ Все токены удалены');
    let modal = document.getElementById('fcmTokensModal');
    if (modal) modal.remove();
  } catch(e) { toast('Ошибка', true); }
}

function copyToClip(text) {
  navigator.clipboard.writeText(text)
    .then(() => toast('Скопировано'))
    .catch(() => toast('Ошибка', true));
}

console.log('[FCM] omega-fcm.js загружен');

// ==================== 4. PATCH ====================
// ==================== OMEGA PATCH — REPLY / SWIPE / DOWNLOAD / VNOTE-BTN / DEBUG-EVERYWHERE ====================


// ---------- 1. CSS для новых элементов ----------
(function injectPatchStyles(){
  let css = `
  .reply-preview-bar{display:none;align-items:center;gap:8px;padding:6px 10px;background:var(--bg3);border-top:2px solid var(--custom-border);border-left:3px solid var(--acc);font-size:.82em}
  .reply-preview-bar.active{display:flex}
  .reply-preview-bar .rp-content{flex:1;min-width:0;overflow:hidden}
  .reply-preview-bar .rp-sender{color:var(--acc);font-weight:600;font-size:.85em}
  .reply-preview-bar .rp-text{color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .reply-preview-bar .rp-close{background:none;border:none;color:var(--t2);cursor:pointer;font-size:1.25em;flex-shrink:0;line-height:1}
  .msg-reply-quote{background:rgba(255,255,255,.08);border-left:3px solid var(--acc);border-radius:6px;padding:4px 8px;margin-bottom:4px;cursor:pointer;font-size:.85em;max-width:100%;overflow:hidden}
  .msg-reply-quote .mrq-sender{color:var(--acc);font-weight:600;font-size:.85em}
  .msg-reply-quote .mrq-text{color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #recPrev{display:none;position:fixed;bottom:150px;right:20px;width:110px;height:110px;border-radius:50%;overflow:hidden;border:3px solid var(--custom-border);box-shadow:0 0 20px var(--custom-glow);z-index:900;background:#000}
  #recPrev.active{display:block}
  #recPrev video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
  #vnoteBtn.recording{background:var(--err)!important;border-color:var(--err)!important;color:#fff!important;animation:pulseGlow 1s infinite}
  `;
  let s = document.createElement('style');
  s.id = 'omegaPatchStyles';
  s.textContent = css;
  document.head.appendChild(s);
})();

// ==================== 6. МЕНЮ ОТЛАДКИ ВО ВСЕХ ЭКРАНАХ ====================
// Проблема: debugFloat/debugPanel лежали внутри #mainScr, а .screen{display:none}
// скрывает всех детей независимо от position:fixed. Переносим их в <body>.
(function relocateDebugMenu(){
  let df = document.getElementById('debugFloat');
  let dp = document.getElementById('debugPanel');
  if (df && df.parentElement !== document.body) document.body.appendChild(df);
  if (dp && dp.parentElement !== document.body) document.body.appendChild(dp);
})();

// ==================== 5. КНОПКА ВИДЕО-СООБЩЕНИЙ (video note) ====================
function ensureVNoteButton() {
  if ($('vnoteBtn')) return;
  let ia = $('inputArea'); if (!ia) return;
  let btn = document.createElement('button');
  btn.className = 'icon-btn';
  btn.id = 'vnoteBtn';
  btn.title = 'Видео-сообщение';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>';
  btn.onclick = toggleVNoteRecord;
  let sendBtn = $('sendBtn');
  if (sendBtn) ia.insertBefore(btn, sendBtn);
  else ia.appendChild(btn);
}

function ensureRecPreview() {
  if ($('recPrev')) return;
  let div = document.createElement('div');
  div.id = 'recPrev';
  div.innerHTML = '<video id="recPrevVid" autoplay muted playsinline></video>';
  document.body.appendChild(div);
}

function toggleVNoteRecord() {
  if (S.rec) { toast('Сначала остановите голосовую запись', true); return; }
  if (S.vnRec) { stopVNoteRecord(); }
  else {
    if (!S.curId) { toast('Откройте чат', true); return; }
    ensureRecPreview();
    startVNoteRecord();
  }
}

// ==================== 2 и 3. ОТВЕТ НА СООБЩЕНИЕ (кнопка + свайп) ====================
S.replyTo = null;

function ensureReplyBar() {
  if ($('replyPreviewBar')) return;
  let ia = $('inputArea'); if (!ia || !ia.parentElement) return;
  let bar = document.createElement('div');
  bar.id = 'replyPreviewBar';
  bar.className = 'reply-preview-bar';
  bar.innerHTML = '<div class="rp-content"><div class="rp-sender" id="rpSender"></div><div class="rp-text" id="rpText"></div></div><button class="rp-close" onclick="cancelReply()">✕</button>';
  ia.parentElement.insertBefore(bar, ia);
}

function replyLabel(m) {
  if (m.type === 'text') return (m.text || '').substring(0, 60);
  if (m.type === 'image') return '📷 Фото';
  if (m.type === 'video') return '🎬 Видео';
  if (m.type === 'voice' || m.type === 'audio') return '🎤 Голосовое';
  if (m.type === 'videoNote') return '📹 Видео-кружок';
  if (m.type === 'sticker') return '🎭 Стикер';
  if (m.type === 'file') return '📄 ' + (m.fileName || 'Файл');
  return 'Сообщение';
}

function startReply(m) {
  ensureReplyBar();
  S.replyTo = { id: m._id, sender: m.senderNick || m.sender || 'Аноним', text: replyLabel(m) };
  let bar = $('replyPreviewBar');
  if (bar) {
    $('rpSender').textContent = '↩️ ' + S.replyTo.sender;
    $('rpText').textContent = S.replyTo.text;
    bar.classList.add('active');
  }
  let inp = $('msgI'); if (inp) inp.focus();
}

function cancelReply() {
  S.replyTo = null;
  let bar = $('replyPreviewBar');
  if (bar) bar.classList.remove('active');
}

function scrollToMsg(id) {
  let el = $('msgsWrap').querySelector('[data-id="' + id + '"]');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('highlight');
    setTimeout(() => el.classList.remove('highlight'), 1500);
  } else toast('Сообщение не найдено выше');
}

function buildReplyHtml(m) {
  if (!m.replyTo) return '';
  return '<div class="msg-reply-quote" onclick="scrollToMsg(\'' + m.replyTo.id + '\')">' +
    '<div class="mrq-sender">' + esc(m.replyTo.sender) + '</div>' +
    '<div class="mrq-text">' + esc(m.replyTo.text) + '</div></div>';
}

// ==================== ИСПРАВЛЕНИЕ: Переопределение buildContent БЕЗ РЕКУРСИИ ====================
(function patchBuildContent(){
  // window.buildContent на этот момент ещё оригинальная функция из omega-part2.js,
  // т.к. мы используем function-EXPRESSION ниже, а не объявление function buildContent(){},
  // и поэтому хостинг её не подменяет раньше времени.
  const _origBuildContent = window.buildContent;
  
  window.buildContent = function(m) {
    // Сначала цитата (если есть), потом оригинальный контент
    return buildReplyHtml(m) + _origBuildContent(m);
  };
})();

// Свайп влево -> ответить
function attachSwipeReply(el, m) {
  let sx = 0, sy = 0, dragging = false, moved = false;
  el.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    dragging = true; moved = false;
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (!dragging) return;
    let dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
    if (Math.abs(dx) > Math.abs(dy) && dx < -10) {
      moved = true;
      el.style.transition = 'none';
      el.style.transform = 'translateX(' + Math.max(dx, -70) + 'px)';
    }
  }, { passive: true });
  el.addEventListener('touchend', e => {
    dragging = false;
    el.style.transition = 'transform .2s ease';
    el.style.transform = 'translateX(0)';
    if (moved) {
      let dx = e.changedTouches[0].clientX - sx;
      if (dx < -55) { startReply(m); if (navigator.vibrate) navigator.vibrate(30); }
    }
  });
}

// ==================== 4. СКАЧАТЬ МЕДИА ИЗ КОНТЕКСТНОГО МЕНЮ ====================
function downloadMedia(m) {
  let ext = { image:'jpg', video:'mp4', voice:'webm', audio:'webm', videoNote:'webm', sticker:'png', file:'' }[m.type] || '';
  let name = m.fileName || (mkId() + (ext ? '.' + ext : ''));
  downloadFile(m.media, name);
  toast('Загрузка начата');
}

// ==================== Переопределение msgCtx: + Ответить, + Скачать ====================
(function patchMsgCtx(){
  const _origMsgCtx = window.msgCtx;
  
  window.msgCtx = function(e, m, own, type) {
    e.preventDefault();
    e.stopPropagation();
    let menu = $('ctxMenu'); menu.innerHTML = '';
    let items = [
      { t: '↩️ Ответить', fn: () => startReply(m) },
      { t: '😀 Реакция', fn: () => showReactPick(e, m._id) }
    ];
    if (m.type === 'text') {
      items.push({ t: '📋 Копировать', fn: () => {
        if (m.text) {
          navigator.clipboard.writeText(m.text).then(() => toast('Скопировано')).catch(() => {
            let ta = document.createElement('textarea'); ta.value = m.text;
            document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
            toast('Скопировано');
          });
        }
      }});
    }
    const mediaTypes = ['image', 'video', 'audio', 'voice', 'videoNote', 'file', 'sticker'];
    if (mediaTypes.includes(m.type)) {
      items.push({ t: '⬇️ Скачать', fn: () => downloadMedia(m) });
    }
    items.push({ t: '⭐ В избранное', fn: () => saveMsgToFav(m) });
    items.push({ t: '🗑 Удалить для себя', fn: () => delMsg(m._id, false) });
    if (own) items.push({ t: '🗑 Удалить для всех', cls: 'danger', fn: () => delMsg(m._id, true) });

    items.forEach(it => {
      let b = document.createElement('button');
      b.className = 'ctx-item' + (it.cls ? ' ' + it.cls : '');
      b.textContent = it.t;
      b.onclick = () => { it.fn(); menu.classList.remove('active'); };
      menu.appendChild(b);
    });
    posMenu(menu, e);
  };
})();

// ==================== Переопределение renderMsg: свайп + цитата ====================
(function patchRenderMsg(){
  const _origRenderMsg = window.renderMsg;
  
  window.renderMsg = function(m, type) {
    if (type === 'channel') { renderChPost(m); return; }
    let own = m.sender === S.user;
    let div = document.createElement('div');
    div.className = 'msg ' + (own ? 'msg-out' : 'msg-in');
    div.dataset.id = m._id;
    let sender = (!own && type !== 'dm') ? '<div class="msg-sender">' + esc(m.senderNick || m.sender) + '</div>' : '';
    let content = buildContent(m);
    let rh = buildReactHtml(m);
    div.innerHTML = sender + content + '<div class="msg-bottom"><span class="msg-time">' + tf(m.timestamp) + '</span></div>' + rh;
    lp(div, e => msgCtx(e, m, own, type));
    attachSwipeReply(div, m);
    $('msgsWrap').appendChild(div);
    $('msgsWrap').scrollTop = $('msgsWrap').scrollHeight;
  };
})();

// ==================== Переопределение renderChPost: цитаты + свайп ====================
(function patchRenderChPost(){
  const _origRenderChPost = window.renderChPost;
  
  window.renderChPost = function(m) {
    let own = m.sender === S.user;
    let cid = S.curChat?.channelId;
    let div = document.createElement('div'); div.className = 'ch-post'; div.dataset.id = m._id;
    let content = '';
    if (m.type === 'text') content = '<div class="ch-post-text">' + linkifyChannelIds(esc(m.text)) + '</div>';
    else if (m.type === 'image') content = '<div class="ch-post-media" onclick="openZoom(\'image\',\'' + m.media + '\')"><img src="' + m.media + '"></div>' + (m.text ? '<div class="ch-post-text">' + esc(m.text) + '</div>' : '');
    else if (m.type === 'video') content = '<div class="ch-post-media" onclick="openZoom(\'video\',\'' + m.media + '\')"><video src="' + m.media + '" preload="metadata" controls></video></div>';
    else if (m.type === 'voice') content = buildVoiceHtml(m);
    else if (m.type === 'videoNote') content = buildVNoteHtml(m);
    else if (m.type === 'file') content = buildFileHtml(m);
    else if (m.type === 'sticker') content = '<div style="max-width:150px"><img src="' + m.media + '" style="width:100%;border-radius:8px"></div>';
    let replyHtml = buildReplyHtml(m);
    let rh = buildReactHtml(m);
    let commHtml = cid ? buildCommHtml(m._id, cid) : '';
    div.innerHTML = '<div class="ch-post-sender">' + esc(m.senderNick || 'Канал') + '</div>' + replyHtml + content + '<div class="ch-post-time">' + tf(m.timestamp) + '</div>' + rh + commHtml;
    lp(div, e => msgCtx(e, m, own, 'channel'));
    attachSwipeReply(div, m);
    $('msgsWrap').appendChild(div);
    $('msgsWrap').scrollTop = $('msgsWrap').scrollHeight;
    if (cid) loadComments(m._id, cid, div);
  };
})();

// ==================== Переопределение sendMsg: + replyTo ====================
(function patchSendMsg(){
  const _origSendMsg = window.sendMsg;
  
  window.sendMsg = async function() {
    if (S.rec) { stopVoiceRecord(); return; }
    let t = $('msgI').value.trim();
    if (!t) return;
    $('msgI').value = ''; $('msgI').style.height = 'auto';
    let p = getMPath(); if (!p) return;

    if (S.curType === 'channel') {
      let cid = S.curChat.channelId;
      let asn = await db.ref('channels/' + cid + '/admins/' + S.user).once('value');
      if (!asn.exists() && !isDev(S.uname)) { toast('Только администраторы могут писать в канале', true); return; }
    }
    if (S.curType === 'group') {
      let gid = S.curChat.groupId;
      let msn = await db.ref('groups/' + gid + '/members/' + S.user).once('value');
      if (msn.exists() && msn.val().mutedUntil && msn.val().mutedUntil > Date.now()) { toast('Вы заглушены', true); return; }
      let rsn = await db.ref('groups/' + gid + '/rules/adminsOnly').once('value');
      if (rsn.val() === true) {
        let r = await getRole(gid);
        if (r === 'member') { toast('Только администраторы могут писать', true); return; }
      }
    }
    let ud = await db.ref('users/' + S.user + '/globalMutedUntil').once('value');
    if (ud.exists() && ud.val() > Date.now()) { toast('Вам запрещено отправлять сообщения', true); return; }

    try {
      let msgData = { sender: S.user, senderNick: S.nick, type: 'text', text: encMsg(t), timestamp: Date.now(), encrypted: true };
      if (S.replyTo) msgData.replyTo = S.replyTo;
      await db.ref(p + '/messages').push(msgData);
      updLast(t.substring(0, 40));
      cancelReply();
    } catch (e) { toast('Ошибка отправки', true); }
  };
})();

// ==================== Переопределение attachFile: + replyTo ====================
(function patchAttachFile(){
  const _origAttachFile = window.attachFile;
  
  window.attachFile = async function(inp) {
    if (!inp.files[0]) return;
    let f = inp.files[0], p = getMPath(); if (!p) return;
    const ALLOWED = ['txt','xml','png','jpg','jpeg','webp','html','css','mp3','mp4','mp2','wav','ogg','pdf','js','json','zip','rar'];
    let ext = f.name.split('.').pop().toLowerCase();
    if (!ALLOWED.includes(ext)) return toast('Формат не поддерживается', true);
    if (f.size > 100 * 1024 * 1024) return toast('Файл > 100МБ', true);
    try {
      toast('Загрузка файла...', false);
      let media = f.type.startsWith('image/') ? await compImg(f) : await f2b64(f);
      let msgType = f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'file';
      let msgData = { sender: S.user, senderNick: S.nick, type: msgType, media, fileName: f.name, fileSize: f.size, text: '', timestamp: Date.now() };
      if (S.replyTo) msgData.replyTo = S.replyTo;
      await db.ref(p + '/messages').push(msgData);
      updLast(f.name); inp.value = '';
      toast('Файл отправлен');
      cancelReply();
    } catch (e) { toast('Ошибка: ' + e.message, true); inp.value = ''; }
  };
})();

// ==================== Переопределение insertSticker: + replyTo ====================
(function patchInsertSticker(){
  const _origInsertSticker = window.insertSticker;
  
  window.insertSticker = async function(data) {
    if (!S.curId) { toast('Откройте чат', true); return; }
    let p = getMPath(); if (!p) return;
    try {
      let msgData = { sender: S.user, senderNick: S.nick, type: 'sticker', media: data, text: '', timestamp: Date.now() };
      if (S.replyTo) msgData.replyTo = S.replyTo;
      await db.ref(p + '/messages').push(msgData);
      updLast('Стикер 🎭');
      closeModal('stickersModal');
      cancelReply();
    } catch (e) { toast('Ошибка: ' + e.message, true); }
  };
})();

// ==================== 1. FCM: КНОПКА "ДОБАВИТЬ ТОКЕН" ====================
async function addManualFCMToken() {
  let platform = prompt('Платформа (web / android / ios):', 'web');
  if (!platform) return;
  platform = platform.trim().toLowerCase();
  if (!['web', 'android', 'ios'].includes(platform)) return toast('Платформа: web, android или ios', true);

  let user = prompt('Username пользователя (с @):');
  if (!user) return;
  if (!user.startsWith('@')) user = '@' + user;
  let key = san(user);

  let token = prompt('Вставьте FCM токен:');
  if (!token || !token.trim()) return toast('Токен не может быть пустым', true);

  try {
    await db.ref('fcmTokens/' + platform + '/' + key).set({
      token: token.trim(),
      platform: platform,
      updatedAt: Date.now(),
      userAgent: 'manual-add-by-' + S.user
    });
    toast('✅ Токен добавлен вручную');
    showFCMTokens();
  } catch (e) { toast('Ошибка: ' + e.message, true); }
}

// Переопределяем showFCMTokens — та же логика + кнопка добавления
(function patchShowFCMTokens(){
  window.showFCMTokens = async function() {
    closeDebugPanel();
    if (S.rank < 8 && !isDev(S.uname)) { toast('Нет доступа', true); return; }

    let modal = document.getElementById('fcmTokensModal');
    if (modal) modal.remove();

    try {
      let sn = await db.ref('fcmTokens').once('value');
      let data = sn.exists() ? sn.val() : {};

      let totalCount = 0;
      let html = '';

      ['web', 'android', 'ios'].forEach(pl => {
        let tk = data[pl] || {};
        let entries = Object.entries(tk);
        totalCount += entries.length;
        let plIcon = pl === 'web' ? '🌐' : pl === 'android' ? '🤖' : '🍎';

        html += '<div style="margin-bottom:16px;padding:10px;background:var(--bg3);border-radius:8px;border:1px solid var(--custom-border)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
        html += '<p style="font-weight:700;color:var(--acc);margin:0">' + plIcon + ' ' + pl.toUpperCase() + '</p>';
        html += '<span style="background:var(--bg4);padding:2px 8px;border-radius:10px;font-size:.8em;color:var(--t2)">' + entries.length + ' токен' + (entries.length === 1 ? '' : entries.length < 5 ? 'а' : 'ов') + '</span>';
        html += '</div>';

        if (!entries.length) {
          html += '<p style="color:var(--t3);font-size:.82em;text-align:center;padding:8px">Нет токенов</p>';
        } else {
          entries.forEach(([user, v]) => {
            let token = v?.token || String(v);
            let updAt = v?.updatedAt ? new Date(v.updatedAt).toLocaleString('ru') : '—';
            html += '<div style="padding:8px;background:var(--bg2);border-radius:6px;margin-bottom:6px;border:1px solid var(--brd)">';
            html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">';
            html += '<b style="font-size:.85em;color:var(--t1)">' + esc(user) + '</b>';
            html += '<button onclick="delFcmToken(\'' + pl + '\',\'' + user + '\')" style="background:var(--err);color:#fff;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:.72em">✕ Удалить</button>';
            html += '</div>';
            html += '<div style="font-family:monospace;font-size:.68em;color:var(--t3);word-break:break-all;background:var(--bg4);padding:5px;border-radius:4px;margin-bottom:4px">' + esc(token.substring(0, 80)) + (token.length > 80 ? '...' : '') + '</div>';
            html += '<div style="display:flex;justify-content:space-between">';
            html += '<span style="font-size:.7em;color:var(--t3)">🕐 ' + updAt + '</span>';
            html += '<button onclick="copyToClip(\'' + token.replace(/'/g, "\\'") + '\')" style="background:var(--bg4);color:var(--t2);border:1px solid var(--brd);border-radius:4px;padding:1px 6px;cursor:pointer;font-size:.7em">📋 Копировать</button>';
            html += '</div></div>';
          });
        }
        html += '</div>';
      });

      let modalEl = document.createElement('div');
      modalEl.className = 'modal-overlay active';
      modalEl.id = 'fcmTokensModal';
      modalEl.innerHTML = '<div class="modal" style="max-height:85vh">' +
        '<button class="modal-close" onclick="document.getElementById(\'fcmTokensModal\').remove()">×</button>' +
        '<h2>📡 FCM Токены</h2>' +
        '<div style="text-align:center;padding:4px 0 10px;font-size:.85em;color:var(--t2)">Всего: <b style="color:var(--acc)">' + totalCount + '</b></div>' +
        '<div class="modal-body">' +
        '<button class="btn btn-primary" style="margin-bottom:10px" onclick="addManualFCMToken()">➕ Добавить FCM токен</button>' +
        html +
        '<button class="btn btn-danger" style="margin-top:8px" onclick="clearAllFCMTokens()">🗑 Очистить все токены</button>' +
        '</div></div>';
      document.body.appendChild(modalEl);
      modalEl.addEventListener('click', e => { if (e.target === modalEl) modalEl.remove(); });

    } catch (e) { toast('Ошибка: ' + e.message, true); }
  };
})();

// ==================== INIT ====================
function initPatch() {
  ensureVNoteButton();
  ensureReplyBar();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPatch);
} else {
  initPatch();
}

console.log('✅ omega-patch.js загружен: reply, swipe-reply, download, video-note button, debug-everywhere, FCM add-token');

// ==================== 5. PATCH 2 ====================
// ==================== OMEGA PATCH 2 ====================
// 1. Новый видео-плеер (малиновая тема, ускорение, перемотка, скорость)
// 2. Исправление записи видео-кружков (запись через canvas.captureStream — раньше писался 1 кадр вместо видео)
// 3. Анимация загрузки сообщений + скелетон-загрузка медиа

(function(){

// ---------- CSS ----------
(function injectStyles(){
  let css = `
  .omega-video-wrap{position:relative;width:100%;max-width:260px;border-radius:10px;overflow:hidden;background:#000;
    border:2px solid var(--custom-border);box-shadow:0 0 12px rgba(220,20,60,.25);user-select:none}
  .omega-video-wrap.omega-video-fullw{max-width:100%}
  .omega-video-wrap.omega-video-zoom{max-width:640px;width:100%}
  .omega-video-wrap video{width:100%;display:block;max-height:320px;background:#000;pointer-events:none}
  .omega-video-wrap.omega-video-zoom video{max-height:80vh}

  .omega-video-tap-layer{position:absolute;top:0;left:0;right:0;bottom:32px;display:flex;-webkit-touch-callout:none}
  .omega-video-tap-zone{flex:1;height:100%;touch-action:pan-y;cursor:pointer}

  .omega-video-center-btn{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    width:50px;height:50px;border-radius:50%;background:rgba(220,20,60,.55);display:flex;align-items:center;
    justify-content:center;color:#fff;font-size:1.3em;transition:opacity .15s;pointer-events:none}
  .omega-video-wrap.playing .omega-video-center-btn{opacity:0}

  .omega-video-seek-flash{position:absolute;top:50%;transform:translateY(-50%);background:rgba(220,20,60,.45);
    color:#fff;padding:8px 12px;border-radius:50%;font-size:.78em;font-weight:700;opacity:0;
    transition:opacity .25s;pointer-events:none;text-align:center}
  .omega-video-seek-flash.left{left:10px}
  .omega-video-seek-flash.right{right:10px}
  .omega-video-seek-flash.show{opacity:1}

  .omega-video-speed-flash{position:absolute;top:10px;left:50%;transform:translateX(-50%);
    background:rgba(220,20,60,.8);color:#fff;padding:4px 12px;border-radius:14px;font-size:.75em;
    font-weight:700;opacity:0;transition:opacity .2s;pointer-events:none;z-index:5}
  .omega-video-speed-flash.show{opacity:1}

  .omega-video-controls{position:absolute;left:0;right:0;bottom:0;height:32px;display:flex;align-items:center;
    gap:6px;padding:0 7px;background:linear-gradient(to top,rgba(0,0,0,.8),rgba(0,0,0,.15));z-index:4}
  .omega-video-time{font-size:.66em;color:#fff;flex-shrink:0;min-width:30px;text-shadow:0 1px 2px rgba(0,0,0,.7)}
  .omega-video-seek{flex:1;-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;
    background:rgba(255,255,255,.3);cursor:pointer;outline:none}
  .omega-video-seek::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;
    background:var(--acc);box-shadow:0 0 6px var(--custom-glow);cursor:pointer;margin-top:-4px}
  .omega-video-seek::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:var(--acc);
    border:none;box-shadow:0 0 6px var(--custom-glow);cursor:pointer}
  .omega-speed-btn{background:rgba(220,20,60,.55);border:1px solid rgba(255,255,255,.35);color:#fff;
    font-size:.66em;font-weight:700;padding:3px 6px;border-radius:8px;cursor:pointer;flex-shrink:0;min-width:34px}
  .omega-speed-btn:active{background:var(--acc)}

  .omega-media-loading{position:relative;min-height:60px}
  .omega-media-loading::before{content:'';position:absolute;inset:0;background:var(--bg4);border-radius:8px;z-index:1}
  .omega-media-loading .omega-media-spinner{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    z-index:2;width:26px;height:26px;border:3px solid rgba(220,20,60,.25);border-top-color:var(--acc);
    border-radius:50%;animation:spin .6s linear infinite}
  .omega-media-loading.omega-media-loaded::before,
  .omega-media-loading.omega-media-loaded .omega-media-spinner{display:none}
  .omega-media-loading img{position:relative;z-index:0}

  .omega-chat-loading{display:flex;align-items:center;justify-content:center;gap:8px;padding:26px;
    color:var(--t2);font-size:.85em}
  `;
  let s = document.createElement('style');
  s.id = 'omegaPatch2Styles';
  s.textContent = css;
  document.head.appendChild(s);
})();

// ---------- ВИДЕО-ПЛЕЕР ----------
const OMEGA_SPEEDS = [0.25, 0.5, 1, 1.25, 1.5, 1.75, 2];

function buildOmegaVideoHtml(src, extraClass) {
  return '<div class="omega-video-wrap omega-media-loading ' + (extraClass || '') + '">' +
    '<div class="omega-media-spinner"></div>' +
    '<video class="omega-video-el" src="' + src + '" playsinline preload="metadata"></video>' +
    '<div class="omega-video-tap-layer">' +
      '<div class="omega-video-tap-zone" data-zone="left"></div>' +
      '<div class="omega-video-tap-zone" data-zone="right"></div>' +
    '</div>' +
    '<div class="omega-video-center-btn">▶</div>' +
    '<div class="omega-video-seek-flash left">« 10</div>' +
    '<div class="omega-video-seek-flash right">10 »</div>' +
    '<div class="omega-video-speed-flash">2x ⏩</div>' +
    '<div class="omega-video-controls">' +
      '<span class="omega-video-time cur">0:00</span>' +
      '<input type="range" class="omega-video-seek" min="0" max="100" value="0" step="0.1">' +
      '<span class="omega-video-time dur">0:00</span>' +
      '<button class="omega-speed-btn" type="button">1x</button>' +
    '</div>' +
  '</div>';
}

function omegaFlash(el, keep) {
  el.classList.add('show');
  if (!keep) setTimeout(() => el.classList.remove('show'), 500);
}

function enhanceVideoPlayers(root) {
  root = root || document;
  root.querySelectorAll('.omega-video-wrap:not([data-enh])').forEach(wrap => {
    wrap.setAttribute('data-enh', '1');
    let video = wrap.querySelector('.omega-video-el');
    let seek = wrap.querySelector('.omega-video-seek');
    let curT = wrap.querySelector('.omega-video-time.cur');
    let durT = wrap.querySelector('.omega-video-time.dur');
    let speedBtn = wrap.querySelector('.omega-speed-btn');
    let leftFlash = wrap.querySelector('.omega-video-seek-flash.left');
    let rightFlash = wrap.querySelector('.omega-video-seek-flash.right');
    let speedFlash = wrap.querySelector('.omega-video-speed-flash');
    let zones = wrap.querySelectorAll('.omega-video-tap-zone');

    let speedIdx = 2; // индекс "1" в OMEGA_SPEEDS
    let seeking = false, wasPlayingBeforeSeek = false;

    function markLoaded() { wrap.classList.add('omega-media-loaded'); }
    video.addEventListener('loadeddata', markLoaded);
    video.addEventListener('error', markLoaded);

    function fmt(t) { return (typeof formatDur === 'function') ? formatDur(t) : (Math.floor(t/60)+':'+(Math.floor(t%60)<10?'0':'')+Math.floor(t%60)); }

    function refreshDuration() {
      if (video.duration && isFinite(video.duration)) durT.textContent = fmt(video.duration);
    }
    video.addEventListener('loadedmetadata', refreshDuration);
    video.addEventListener('durationchange', refreshDuration);

    function updateSeekFill() {
      let pct = seek.value;
      seek.style.background = 'linear-gradient(to right, var(--acc) 0%, var(--acc) ' + pct + '%, rgba(255,255,255,.25) ' + pct + '%, rgba(255,255,255,.25) 100%)';
    }

    video.addEventListener('timeupdate', () => {
      if (!seeking && video.duration && isFinite(video.duration)) {
        seek.value = (video.currentTime / video.duration * 100) || 0;
        updateSeekFill();
      }
      curT.textContent = fmt(video.currentTime);
    });
    video.addEventListener('play', () => wrap.classList.add('playing'));
    video.addEventListener('pause', () => wrap.classList.remove('playing'));
    video.addEventListener('ended', () => wrap.classList.remove('playing'));

    function togglePlay() {
      if (video.paused) {
        document.querySelectorAll('.omega-video-el').forEach(v => { if (v !== video && !v.paused) v.pause(); });
        video.play().catch(() => {});
      } else video.pause();
    }

    // ---- зоны: тап / двойной тап / зажатие ----
    zones.forEach(zone => {
      let lastTap = 0, tapTimer = null;
      let longPressTimer = null, isLongPress = false;
      let startY = 0, moved = false;

      zone.addEventListener('click', e => {
        if (isLongPress) { return; }
        let now = Date.now();
        if (now - lastTap < 300) {
          clearTimeout(tapTimer);
          lastTap = 0;
          if (zone.dataset.zone === 'left') {
            video.currentTime = Math.max(0, video.currentTime - 10);
            omegaFlash(leftFlash);
          } else {
            video.currentTime = Math.min(video.duration || (video.currentTime + 10), video.currentTime + 10);
            omegaFlash(rightFlash);
          }
        } else {
          lastTap = now;
          tapTimer = setTimeout(() => { togglePlay(); }, 280);
        }
      });

      function startLongPress() {
        longPressTimer = setTimeout(() => {
          if (moved) return;
          isLongPress = true;
          video._prevRate = video.playbackRate;
          video.playbackRate = 2;
          omegaFlash(speedFlash, true);
        }, 400);
      }
      function endLongPress() {
        clearTimeout(longPressTimer);
        if (isLongPress) {
          video.playbackRate = video._prevRate || OMEGA_SPEEDS[speedIdx];
          speedFlash.classList.remove('show');
          setTimeout(() => { isLongPress = false; }, 350);
        }
      }

      zone.addEventListener('touchstart', e => {
        startY = e.touches[0].clientY; moved = false;
        startLongPress();
      }, { passive: true });
      zone.addEventListener('touchmove', e => {
        if (Math.abs(e.touches[0].clientY - startY) > 10) { moved = true; clearTimeout(longPressTimer); }
      }, { passive: true });
      zone.addEventListener('touchend', endLongPress);
      zone.addEventListener('touchcancel', endLongPress);

      zone.addEventListener('mousedown', () => { moved = false; startLongPress(); });
      zone.addEventListener('mouseup', endLongPress);
      zone.addEventListener('mouseleave', endLongPress);
      zone.addEventListener('contextmenu', e => e.preventDefault());
    });

    // ---- таймлайн ----
    seek.addEventListener('mousedown', e => { e.stopPropagation(); wasPlayingBeforeSeek = !video.paused; if (!video.paused) video.pause(); });
    seek.addEventListener('touchstart', e => { e.stopPropagation(); wasPlayingBeforeSeek = !video.paused; if (!video.paused) video.pause(); }, { passive: true });
    seek.addEventListener('input', () => {
      seeking = true;
      updateSeekFill();
      if (video.duration && isFinite(video.duration)) video.currentTime = seek.value / 100 * video.duration;
    });
    seek.addEventListener('change', () => { seeking = false; if (wasPlayingBeforeSeek) video.play().catch(() => {}); });

    // ---- кнопка скорости ----
    speedBtn.addEventListener('click', e => {
      e.stopPropagation();
      speedIdx = (speedIdx + 1) % OMEGA_SPEEDS.length;
      video.playbackRate = OMEGA_SPEEDS[speedIdx];
      speedBtn.textContent = OMEGA_SPEEDS[speedIdx] + 'x';
    });
  });
}
window.buildOmegaVideoHtml = buildOmegaVideoHtml;
window.enhanceVideoPlayers = enhanceVideoPlayers;

// ---------- buildContent: используем новый плеер + скелетон для фото ----------
window.buildContent = function(m) {
  let reply = (typeof buildReplyHtml === 'function') ? buildReplyHtml(m) : '';
  let body;
  if (m.type === 'text') {
    body = '<div class="msg-text">' + linkifyChannelIds(esc(m.text)) + '</div>';
  } else if (m.type === 'image') {
    body = '<div class="msg-media omega-media-loading"><div class="omega-media-spinner"></div>' +
      '<img src="' + m.media + '" onload="this.parentElement.classList.add(\'omega-media-loaded\')" ' +
      'onerror="this.parentElement.classList.add(\'omega-media-loaded\')" ' +
      'onclick="openZoom(\'image\',\'' + m.media + '\')"></div>' +
      (m.text ? '<div class="msg-text">' + esc(m.text) + '</div>' : '');
  } else if (m.type === 'video') {
    body = buildOmegaVideoHtml(m.media);
  } else if (m.type === 'voice' || m.type === 'audio') {
    body = buildVoiceHtml(m);
  } else if (m.type === 'videoNote') {
    body = buildVNoteHtml(m);
  } else if (m.type === 'sticker') {
    body = '<div style="max-width:180px" class="omega-media-loading"><div class="omega-media-spinner"></div><img src="' + m.media + '" style="width:100%;border-radius:8px;border:1px solid var(--custom-border);cursor:pointer" onload="this.parentElement.classList.add(\'omega-media-loaded\')" onclick="openZoom(\'image\',\'' + m.media + '\')"></div>';
  } else if (m.type === 'file') {
    body = buildFileHtml(m);
  } else {
    body = '<div class="msg-text">[Медиа]</div>';
  }
  return reply + body;
};

// enhance после каждого renderMsg
(function patchRenderMsg2(){
  const _prev = window.renderMsg;
  window.renderMsg = function(m, type){
    _prev(m, type);
    if (type !== 'channel') {
      let el = $('msgsWrap').querySelector('[data-id="' + m._id + '"]');
      if (el) enhanceVideoPlayers(el);
    }
  };
})();

// renderChPost: полностью переопределяем (видео там генерилось инлайн)
window.renderChPost = function(m) {
  let own = m.sender === S.user;
  let cid = S.curChat?.channelId;
  let div = document.createElement('div'); div.className = 'ch-post'; div.dataset.id = m._id;
  let content = '';
  if (m.type === 'text') {
    content = '<div class="ch-post-text">' + linkifyChannelIds(esc(m.text)) + '</div>';
  } else if (m.type === 'image') {
    content = '<div class="ch-post-media omega-media-loading" onclick="openZoom(\'image\',\'' + m.media + '\')">' +
      '<div class="omega-media-spinner"></div>' +
      '<img src="' + m.media + '" onload="this.parentElement.classList.add(\'omega-media-loaded\')" onerror="this.parentElement.classList.add(\'omega-media-loaded\')"></div>' +
      (m.text ? '<div class="ch-post-text">' + esc(m.text) + '</div>' : '');
  } else if (m.type === 'video') {
    content = buildOmegaVideoHtml(m.media, 'omega-video-fullw');
  } else if (m.type === 'voice') {
    content = buildVoiceHtml(m);
  } else if (m.type === 'videoNote') {
    content = buildVNoteHtml(m);
  } else if (m.type === 'file') {
    content = buildFileHtml(m);
  } else if (m.type === 'sticker') {
    content = '<div style="max-width:150px"><img src="' + m.media + '" style="width:100%;border-radius:8px"></div>';
  }
  let replyHtml = (typeof buildReplyHtml === 'function') ? buildReplyHtml(m) : '';
  let rh = buildReactHtml(m);
  let commHtml = cid ? buildCommHtml(m._id, cid) : '';
  div.innerHTML = '<div class="ch-post-sender">' + esc(m.senderNick || 'Канал') + '</div>' + replyHtml + content +
    '<div class="ch-post-time">' + tf(m.timestamp) + '</div>' + rh + commHtml;
  lp(div, e => msgCtx(e, m, own, 'channel'));
  if (typeof attachSwipeReply === 'function') attachSwipeReply(div, m);
  $('msgsWrap').appendChild(div);
  $('msgsWrap').scrollTop = $('msgsWrap').scrollHeight;
  if (cid) loadComments(m._id, cid, div);
  enhanceVideoPlayers(div);
};

// openZoom для видео — свой плеер вместо стандартного
(function patchOpenZoom2(){
  const _prev = window.openZoom;
  window.openZoom = function(type, src) {
    if (type !== 'video') { _prev(type, src); return; }
    let cnt = $('zoomC');
    cnt.innerHTML = buildOmegaVideoHtml(src, 'omega-video-zoom');
    $('zoomOv').classList.add('active');
    enhanceVideoPlayers(cnt);
    let video = cnt.querySelector('.omega-video-el');
    if (video) video.play().catch(() => {});
  };
})();

// ---------- ВИДЕО-КРУЖКИ: правильная запись через canvas.captureStream ----------
(function patchVideoNote(){
  let stream = null, hiddenVideo = null, canvas = null, rafId = null;
  let mr = null, chunks = [], canvasStream = null;
  let mimeType = '';

  function resetUI() {
    S.vnRec = false;
    let vb = $('vnoteBtn');
    if (vb) vb.classList.remove('recording');
    let prev = $('recPrev');
    if (prev) prev.classList.remove('active');
  }

  window.startVNoteRecord = async function() {
    if (S.rec || S.vnRec) return;
    let p = getMPath();
    if (!p) { toast('Откройте чат', true); return; }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true
      });

      hiddenVideo = document.createElement('video');
      hiddenVideo.muted = true;
      hiddenVideo.playsInline = true;
      hiddenVideo.srcObject = stream;
      await hiddenVideo.play().catch(() => {});

      let prev = $('recPrev'), pv = $('recPrevVid');
      if (prev && pv) { pv.srcObject = stream; prev.classList.add('active'); }

      let size = 480;
      canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      let ctx = canvas.getContext('2d', { alpha: false });

      function drawFrame() {
        if (!hiddenVideo || hiddenVideo.readyState < 2) { rafId = requestAnimationFrame(drawFrame); return; }
        let vw = hiddenVideo.videoWidth, vh = hiddenVideo.videoHeight;
        let s = Math.min(vw, vh);
        let sx = (vw - s) / 2, sy = (vh - s) / 2;
        ctx.save();
        ctx.translate(size, 0);
        ctx.scale(-1, 1); // зеркалим как во фронталке
        ctx.drawImage(hiddenVideo, sx, sy, s, s, 0, 0, size, size);
        ctx.restore();
        rafId = requestAnimationFrame(drawFrame);
      }
      drawFrame();

      canvasStream = canvas.captureStream(30);
      stream.getAudioTracks().forEach(t => canvasStream.addTrack(t));

      let types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || '';

      mr = new MediaRecorder(canvasStream, mimeType ? { mimeType, videoBitsPerSecond: 900000 } : {});
      chunks = [];
      let t0 = Date.now();

      mr.ondataavailable = ev => { if (ev.data && ev.data.size > 0) chunks.push(ev.data); };
      mr.onerror = err => {
        console.error('VNote MR error:', err);
        toast('Ошибка записи видео', true);
        stopVNoteRecordInternal();
      };
      mr.onstop = async () => {
        cancelAnimationFrame(rafId);
        if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
        hiddenVideo = null;
        let prev2 = $('recPrev');
        if (prev2) prev2.classList.remove('active');

        if (!chunks.length) { toast('Запись пустая', true); resetUI(); return; }
        let blob = new Blob(chunks, { type: mimeType || 'video/webm' });
        if (blob.size < 800) { toast('Запись слишком короткая', true); resetUI(); return; }

        let dur = (Date.now() - t0) / 1000;
        try {
          let b64 = await b2b64(blob);
          let pm = getMPath();
          if (!pm) { toast('Чат не открыт', true); resetUI(); return; }
          await db.ref(pm + '/messages').push({
            sender: S.user, senderNick: S.nick, type: 'videoNote',
            media: b64, duration: Math.round(dur), timestamp: Date.now()
          });
          updLast('📹 Видео-кружок');
          toast('📹 Видео-кружок отправлен!');
        } catch (err) {
          console.error('VNote send error:', err);
          toast('Ошибка отправки: ' + err.message, true);
        }
        resetUI();
      };

      mr.start(500);
      S.vnRec = true;
      let vb = $('vnoteBtn');
      if (vb) vb.classList.add('recording');

      S._vnAutoStop = setTimeout(() => {
        if (S.vnRec) { toast('⏱ Максимальная длина 60 сек'); window.stopVNoteRecord(); }
      }, 60000);

      toast('🔴 Запись видео-кружка... Нажмите ещё раз для отправки');
    } catch (e) {
      console.error('VNote start error:', e);
      toast('Ошибка доступа к камере: ' + e.message, true);
      resetUI();
    }
  };

  function stopVNoteRecordInternal() {
    clearTimeout(S._vnAutoStop);
    if (mr && S.vnRec) {
      try { if (mr.state !== 'inactive') mr.stop(); } catch (e) { console.error(e); resetUI(); }
    } else {
      resetUI();
    }
  }
  window.stopVNoteRecord = stopVNoteRecordInternal;
})();

// ---------- АНИМАЦИЯ ЗАГРУЗКИ СООБЩЕНИЙ ----------
(function patchStartListen2(){
  window.startListen = function(path, type) {
    stopListen();
    let wrap = $('msgsWrap');
    wrap.innerHTML = '<div class="omega-chat-loading"><span class="spinner"></span> Загрузка сообщений...</div>';

    let ref = db.ref(path + '/messages').orderByChild('timestamp').limitToLast(100);
    msgLsn = ref;

    function removeLoader() {
      let li = wrap.querySelector('.omega-chat-loading');
      if (li) li.remove();
    }

    ref.once('value').then(removeLoader).catch(removeLoader);
    // на случай если 'value' долго не приходит (плохая сеть) — убрать через 6 сек в любом случае
    setTimeout(removeLoader, 6000);

    ref.on('child_added', sn => {
      let m = sn.val(); if (!m) return;
      m._id = sn.key; m._path = path;
      if (m.deletedForAll) return;
      if (m.deletedFor && m.deletedFor[S.user]) return;
      if (m.encrypted && m.text) m.text = decMsg(m.text) || m.text;
      renderMsg(m, type);
      if (m.sender !== S.user && document.hidden) {
        showNotif(S.curChat?.name || 'Omega', m.type === 'text' ? m.text : '📎 Медиа');
      }
    });

    ref.on('child_changed', sn => {
      let m = sn.val(); if (!m) return;
      m._id = sn.key;
      if (m.deletedForAll) {
        let el = $('msgsWrap').querySelector('[data-id="' + sn.key + '"]');
        if (el) el.remove(); return;
      }
      let el = $('msgsWrap').querySelector('[data-id="' + sn.key + '"]');
      if (el) {
        let rh = buildReactHtml(m);
        let existing = el.querySelector('.msg-reactions');
        if (existing) existing.remove();
        if (rh) el.insertAdjacentHTML('beforeend', rh);
      }
    });

    setTimeout(() => { $('msgsWrap').scrollTop = $('msgsWrap').scrollHeight; }, 500);
  };
})();

console.log('✅ omega-patch2.js загружен: новый видео-плеер, фикс видео-кружков, анимация загрузки');
})();

console.log('✅ omega-bundle.js собран из 5 модулей');
