// ==================== OMEGA PATCH 4 ====================
// 1) Надёжное воспроизведение видео-кружков (fetch-based Blob)
// 2) Реальный вызов initFCM() + очередь push-уведомлений
// ============================================================

(function(){

console.log('🔧 omega-patch4.js: инициализация...');

// ============================================================
// БЛОК 1: ВИДЕО-КРУЖКИ
// ============================================================

window._omegaBlobCache = window._omegaBlobCache || {};
window._omegaBlobPending = window._omegaBlobPending || {};

// fetch() декодирует data:-URI нативно (в отличие от ручного atob),
// не падает на очень длинных base64-строках.
async function omegaDataUriToBlobUrl(dataUri, id) {
  if (window._omegaBlobCache[id]) return window._omegaBlobCache[id];
  if (!dataUri || !dataUri.startsWith('data:')) return dataUri;
  try {
    let resp = await fetch(dataUri);
    let blob = await resp.blob();
    let url = URL.createObjectURL(blob);
    window._omegaBlobCache[id] = url;
    return url;
  } catch(e) {
    console.error('[VNote] Ошибка конвертации в Blob:', e);
    return null;
  }
}

// Рендерим кружок сразу (плейсхолдер), видео подгружаем асинхронно
window.buildVNoteHtml = function(m) {
  let dur = (typeof formatDur === 'function') ? formatDur(m.duration || 0) : '0:00';
  let id = m._id;

  if (m.media && !window._omegaBlobCache[id] && !window._omegaBlobPending[id]) {
    window._omegaBlobPending[id] = true;
    omegaDataUriToBlobUrl(m.media, id).then(url => {
      delete window._omegaBlobPending[id];
      let v = document.getElementById('vnv_' + id);
      if (v && url) {
        v.src = url;
        v.load();
      } else if (!url) {
        let bubble = document.getElementById('vn_' + id);
        if (bubble) bubble.innerHTML =
          '<div style="padding:10px;color:var(--err);font-size:.75em;text-align:center;width:170px">⚠️ Не удалось загрузить видео</div>';
      }
    });
  }

  return '<div class="vnote-bubble" id="vn_' + id + '">' +
    '<div class="vnote-circle" onclick="toggleVNPlay(\'' + id + '\')">' +
      '<video id="vnv_' + id + '" playsinline preload="metadata"></video>' +
      '<div class="vnote-ring" id="vnring_' + id + '"></div>' +
      '<div class="vnote-playbtn" id="vnplay_' + id + '">▶</div>' +
    '</div>' +
    '<div class="vnote-dur" id="vndur_' + id + '">' + dur + '</div>' +
  '</div>';
};

// Защита от клика по ещё не загруженному видео
(function patchToggleVNPlay(){
  const _prev = window.toggleVNPlay;
  window.toggleVNPlay = function(id) {
    let v = $('vnv_' + id);
    if (v && !v.src) { toast('Видео ещё загружается...'); return; }
    _prev(id);
  };
})();

// Чистим Blob-URL при удалении сообщения (чтобы не утекала память)
(function patchDelMsgCleanup(){
  const _prevDelMsg = window.delMsg;
  window.delMsg = async function(mid, all) {
    await _prevDelMsg(mid, all);
    if (window._omegaBlobCache[mid]) {
      try { URL.revokeObjectURL(window._omegaBlobCache[mid]); } catch(e) {}
      delete window._omegaBlobCache[mid];
    }
  };
})();

// Предупреждение при слишком большом файле (лимит Firebase RTDB ~10МБ на значение)
(function patchB2b64Size(){
  const _origB2b64 = window.b2b64;
  window.b2b64 = function(blob) {
    if (blob && blob.size > 8 * 1024 * 1024) {
      toast('⚠️ Файл большой (' + (blob.size/1024/1024).toFixed(1) + 'МБ), возможна ошибка загрузки', true);
    }
    return _origB2b64(blob);
  };
})();

console.log('✅ Патч видео-кружков применён (buildVNoteHtml переопределён через fetch+Blob)');

// ============================================================
// БЛОК 2: FCM — см. пояснение ниже в ответе
// ============================================================

(function patchAfterLoginFCM(){
  const _origAfterLogin = window.afterLogin;
  window.afterLogin = async function() {
    await _origAfterLogin();
    if (typeof initFCM === 'function') {
      initFCM().then(() => console.log('✅ initFCM выполнен'))
               .catch(e => console.error('❌ initFCM ошибка:', e));
    } else {
      console.warn('⚠️ initFCM не найден — проверьте порядок подключения скриптов');
    }
  };
})();

(function patchNotifQueue(){
  async function pushNotifJob(recipients, title, body) {
    if (!recipients || !recipients.length) return;
    try {
      await db.ref('notifQueue').push({ to: recipients, title, body, timestamp: Date.now() });
    } catch(e) { console.error('notifQueue push error:', e); }
  }

  const _origUpdLast = window.updLast;
  window.updLast = function(t) {
    _origUpdLast(t);
    if (!S.curId) return;
    if (S.curType === 'dm') {
      let oth = S.curId.split('__').find(u => u !== S.user);
      if (oth) pushNotifJob([oth], S.nick, t);
    } else if (S.curType === 'group') {
      let gid = S.curChat.groupId;
      db.ref('groups/' + gid + '/members').once('value').then(sn => {
        if (!sn.exists()) return;
        let rec = [];
        sn.forEach(m => { if (m.key !== S.user) rec.push(m.key); });
        pushNotifJob(rec, S.nick, t);
      });
    }
  };
})();

console.log('✅ omega-patch4.js полностью загружен');
})();
