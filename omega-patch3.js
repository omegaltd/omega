// ==================== OMEGA PATCH 3 ====================
// 1) Fullscreen для видео-плеера
// 2) Фикс воспроизведения видео-кружков (Blob URL вместо огромного data: URI)
// 3) Кнопка "Редактировать" в контекстном меню сообщения
// 4) Debug-инструмент "Кадры сообщения" (зацикленная смена текста для всех)
// ============================================================

(function(){

// ---------- CSS ----------
(function injectStyles(){
  let css = `
  .omega-fs-btn{background:rgba(220,20,60,.55);border:1px solid rgba(255,255,255,.35);color:#fff;
    font-size:.85em;padding:3px 8px;border-radius:8px;cursor:pointer;flex-shrink:0}
  .omega-fs-btn:active{background:var(--acc)}

  .omega-video-wrap:fullscreen{width:100%;height:100%;max-width:100%!important;
    display:flex;align-items:center;justify-content:center;background:#000;
    border:none!important;box-shadow:none!important}
  .omega-video-wrap:fullscreen video{width:100%;height:100%;object-fit:contain}
  .omega-video-wrap:-webkit-full-screen{width:100%;height:100%}
  .omega-video-wrap:-webkit-full-screen video{height:100%;width:100%;object-fit:contain}
  .omega-video-wrap:-moz-full-screen{width:100%;height:100%}
  .omega-video-wrap.omega-fs-active{width:100%!important;height:100%!important}

  .msg-edited-mark{font-size:.65em;color:var(--t3);margin-right:3px;font-style:italic}

  body.omega-frame-select-mode #msgsWrap{cursor:crosshair}
  body.omega-frame-select-mode #msgsWrap .msg,
  body.omega-frame-select-mode #msgsWrap .ch-post{
    outline:2px dashed var(--acc);outline-offset:2px;cursor:pointer;
    animation:pulseGlow 1.1s infinite}

  .frame-row{display:flex;gap:6px;align-items:center;margin-bottom:6px}
  .frame-row input.frame-text-i{flex:1;padding:8px 10px;font-size:.85em;
    background:var(--bg4);border:1.5px solid var(--custom-border);border-radius:8px;color:var(--font-color)}
  .frame-row input.frame-dur-i{width:64px;padding:8px 4px;font-size:.85em;text-align:center;
    background:var(--bg4);border:1.5px solid var(--custom-border);border-radius:8px;color:var(--font-color)}
  .frame-row .frame-remove-btn{background:var(--err);color:#fff;border:none;border-radius:6px;
    width:30px;height:34px;cursor:pointer;flex-shrink:0}
  `;
  let s = document.createElement('style');
  s.id = 'omegaPatch3Styles';
  s.textContent = css;
  document.head.appendChild(s);
})();

// ============================================================
// 1. FULLSCREEN ДЛЯ ВИДЕО-ПЛЕЕРА
// ============================================================
function toggleFsVideo(wrap, video) {
  let isFs = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
  if (!isFs) {
    if (wrap.requestFullscreen) wrap.requestFullscreen().catch(()=>{});
    else if (wrap.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
    else if (wrap.mozRequestFullScreen) wrap.mozRequestFullScreen();
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); // iOS Safari fallback
    else toast('Полноэкранный режим не поддерживается', true);
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
  }
}

(function patchEnhanceVideoPlayersFS(){
  const _origEnhance = window.enhanceVideoPlayers;
  window.enhanceVideoPlayers = function(root){
    _origEnhance(root);
    root = root || document;
    root.querySelectorAll('.omega-video-wrap[data-enh]:not([data-fs-enh])').forEach(wrap => {
      wrap.setAttribute('data-fs-enh', '1');
      let controls = wrap.querySelector('.omega-video-controls');
      let video = wrap.querySelector('.omega-video-el');
      if (!controls || !video) return;

      let fsBtn = document.createElement('button');
      fsBtn.type = 'button';
      fsBtn.className = 'omega-fs-btn';
      fsBtn.title = 'Полный экран';
      fsBtn.textContent = '⛶';
      controls.appendChild(fsBtn);

      fsBtn.addEventListener('click', e => {
        e.stopPropagation();
        toggleFsVideo(wrap, video);
      });

      function onFsChange() {
        let el = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
        let isFs = el === wrap;
        wrap.classList.toggle('omega-fs-active', isFs);
        fsBtn.textContent = isFs ? '✕' : '⛶';
      }
      document.addEventListener('fullscreenchange', onFsChange);
      document.addEventListener('webkitfullscreenchange', onFsChange);
      document.addEventListener('mozfullscreenchange', onFsChange);
    });
  };
})();

// ============================================================
// 2. ФИКС ВИДЕО-КРУЖКОВ: base64 -> Blob URL
// ============================================================
// Проблема: огромная data:-строка (несколько МБ) в атрибуте <video src="">,
// вставленная через innerHTML, во многих браузерах не декодируется/не проигрывается.
// Решение: конвертируем base64 в Blob и используем URL.createObjectURL().
window._omegaBlobCache = window._omegaBlobCache || {};

function omegaMediaToPlayableURL(media, id, mimeFallback) {
  if (!media) return media;
  if (!media.startsWith('data:')) return media; // уже обычная ссылка
  if (window._omegaBlobCache[id]) return window._omegaBlobCache[id];
  try {
    let commaIdx = media.indexOf(',');
    let header = media.substring(0, commaIdx);
    let base64 = media.substring(commaIdx + 1);
    let mimeMatch = header.match(/data:(.*?);base64/);
    let mime = mimeMatch ? mimeMatch[1] : (mimeFallback || 'video/webm');
    let binary = atob(base64);
    let len = binary.length;
    let bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    let blob = new Blob([bytes], { type: mime });
    let url = URL.createObjectURL(blob);
    window._omegaBlobCache[id] = url;
    return url;
  } catch(e) {
    console.error('omegaMediaToPlayableURL error:', e);
    return media; // fallback на старое поведение
  }
}

// Переопределяем buildVNoteHtml (после vnote2.js) с безопасным src
window.buildVNoteHtml = function(m) {
  let dur = formatDur(m.duration || 0);
  let src = omegaMediaToPlayableURL(m.media, m._id, 'video/webm');
  return '<div class="vnote-bubble" id="vn_' + m._id + '">' +
    '<div class="vnote-circle" onclick="toggleVNPlay(\'' + m._id + '\')">' +
      '<video id="vnv_' + m._id + '" src="' + src + '" playsinline preload="metadata"></video>' +
      '<div class="vnote-ring" id="vnring_' + m._id + '"></div>' +
      '<div class="vnote-playbtn" id="vnplay_' + m._id + '">▶</div>' +
    '</div>' +
    '<div class="vnote-dur" id="vndur_' + m._id + '">' + dur + '</div>' +
  '</div>';
};

// Чистим Blob URL при удалении сообщения (чтобы не текла память)
(function patchDelMsgCleanup(){
  const _prevDelMsg = window.delMsg;
  window.delMsg = async function(mid, all) {
    await _prevDelMsg(mid, all);
    if (window._omegaBlobCache[mid]) {
      try { URL.revokeObjectURL(window._omegaBlobCache[mid]); } catch(e) {}
      delete window._omegaBlobCache[mid];
    }
    stopFrameRotation(mid);
  };
})();

// ============================================================
// 3. КНОПКА "РЕДАКТИРОВАТЬ" В КОНТЕКСТНОМ МЕНЮ
// ============================================================
function openEditMsgModal(m) {
  let old = document.getElementById('editMsgModal');
  if (old) old.remove();
  let modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.id = 'editMsgModal';
  modal.innerHTML =
    '<div class="modal">' +
      '<button class="modal-close" onclick="document.getElementById(\'editMsgModal\').remove()">×</button>' +
      '<h2>✏️ Редактировать сообщение</h2>' +
      '<div class="modal-body">' +
        '<div class="input-group"><textarea id="editMsgTa" rows="4">' + esc(m.text || '') + '</textarea></div>' +
        '<button class="btn btn-primary" id="editMsgSaveBtn">💾 Сохранить</button>' +
        '<button class="btn btn-ghost" onclick="document.getElementById(\'editMsgModal\').remove()">Отмена</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('editMsgSaveBtn').onclick = async () => {
    let nt = document.getElementById('editMsgTa').value.trim();
    if (!nt) { toast('Введите текст', true); return; }
    await editMessage(m._id, nt);
    modal.remove();
  };
}

// Переопределяем editMessage: сброс "кадров" при ручном редактировании + пометка "ред."
window.editMessage = async function(msgId, newText) {
  if (!S.curId) return;
  let p = getMPath(); if (!p) return;
  try {
    await db.ref(p + '/messages/' + msgId).update({
      text: encMsg(newText), edited: true, editedAt: Date.now(), encrypted: true,
      frames: null, framesStartedAt: null
    });
    stopFrameRotation(msgId);
    toast('✏️ Отредактировано');
    let el = $('msgsWrap').querySelector('[data-id="' + msgId + '"]');
    if (el) {
      let txt = el.querySelector('.msg-text') || el.querySelector('.ch-post-text');
      if (txt) txt.innerHTML = linkifyChannelIds(esc(newText));
      let timeEl = el.querySelector('.msg-time') || el.querySelector('.ch-post-time');
      if (timeEl && !timeEl.dataset.editedMarked) {
        timeEl.insertAdjacentHTML('beforebegin', '<span class="msg-edited-mark" title="Сообщение отредактировано">ред. </span>');
        timeEl.dataset.editedMarked = '1';
      }
    }
  } catch(e) { toast('Ошибка', true); }
};

// Полностью переопределяем msgCtx: добавляем "Редактировать"
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
  if (own && m.type === 'text' && !m.deletedForAll) {
    items.push({ t: '✏️ Редактировать', fn: () => openEditMsgModal(m) });
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

// ============================================================
// 4. DEBUG: "КАДРЫ СООБЩЕНИЯ" — зацикленная смена текста для всех
// ============================================================
window._omegaFrameTimers = window._omegaFrameTimers || {};

function stopFrameRotation(id) {
  if (window._omegaFrameTimers[id]) {
    clearTimeout(window._omegaFrameTimers[id]);
    delete window._omegaFrameTimers[id];
  }
}

function startFrameRotation(m) {
  if (!m.frames || !m.frames.length) return;
  stopFrameRotation(m._id);
  let el = document.querySelector('[data-id="' + m._id + '"]');
  if (!el) return;
  let textEl = el.querySelector('.msg-text') || el.querySelector('.ch-post-text');
  if (!textEl) return;

  let frames = m.frames;
  let total = frames.reduce((s, f) => s + (f.duration || 2000), 0);
  if (total <= 0) return;
  let startedAt = m.framesStartedAt || m.timestamp || Date.now();

  function tick() {
    let elEl = document.querySelector('[data-id="' + m._id + '"]');
    if (!elEl) { stopFrameRotation(m._id); return; } // сообщение убрано из DOM
    let curTextEl = elEl.querySelector('.msg-text') || elEl.querySelector('.ch-post-text');
    if (!curTextEl) { stopFrameRotation(m._id); return; }

    let elapsed = (Date.now() - startedAt) % total;
    let acc = 0, idx = 0, remaining = total;
    for (let i = 0; i < frames.length; i++) {
      acc += (frames[i].duration || 2000);
      if (elapsed < acc) { idx = i; remaining = acc - elapsed; break; }
    }
    curTextEl.textContent = frames[idx].text;
    window._omegaFrameTimers[m._id] = setTimeout(tick, Math.max(80, remaining));
  }
  tick();
}

// Реагируем на изменения frames в реальном времени
(function patchStartListenFrames(){
  const _prevStartListen = window.startListen;
  window.startListen = function(path, type) {
    _prevStartListen(path, type);
    let ref2 = db.ref(path + '/messages').orderByChild('timestamp').limitToLast(100);
    ref2.on('child_changed', sn => {
      let m = sn.val(); if (!m) return;
      m._id = sn.key;
      if (m.frames && m.frames.length) startFrameRotation(m);
      else stopFrameRotation(sn.key);
    });
  };
})();

// Запуск ротации кадров + пометка "ред." при первом рендере
(function patchRenderMsgFrames(){
  const _prev = window.renderMsg;
  window.renderMsg = function(m, type) {
    _prev(m, type);
    if (type === 'channel') return;
    let el = $('msgsWrap').querySelector('[data-id="' + m._id + '"]');
    if (!el) return;
    if (m.edited) {
      let timeEl = el.querySelector('.msg-time');
      if (timeEl && !timeEl.dataset.editedMarked) {
        timeEl.insertAdjacentHTML('beforebegin', '<span class="msg-edited-mark" title="Сообщение отредактировано">ред. </span>');
        timeEl.dataset.editedMarked = '1';
      }
    }
    if (m.frames && m.frames.length) startFrameRotation(m);
  };
})();

(function patchRenderChPostFrames(){
  const _prev = window.renderChPost;
  window.renderChPost = function(m) {
    _prev(m);
    let el = $('msgsWrap').querySelector('[data-id="' + m._id + '"]');
    if (!el) return;
    if (m.edited) {
      let timeEl = el.querySelector('.ch-post-time');
      if (timeEl && !timeEl.dataset.editedMarked) {
        timeEl.insertAdjacentHTML('beforebegin', '<span class="msg-edited-mark" title="Сообщение отредактировано">ред. </span>');
        timeEl.dataset.editedMarked = '1';
      }
    }
    if (m.frames && m.frames.length) startFrameRotation(m);
  };
})();

// Останавливаем все таймеры при выходе из чата
(function patchGoBackFrames(){
  const _prevGoBack = window.goBack;
  window.goBack = function() {
    Object.keys(window._omegaFrameTimers).forEach(id => stopFrameRotation(id));
    _prevGoBack();
  };
})();

// ---------- Режим выбора сообщения ----------
function enterFrameSelectMode() {
  if (!S.curId) { toast('Откройте чат сначала', true); return; }
  toast('🎯 Выберите сообщение для редактирования кадров (тап по нему). Esc — отмена');
  document.body.classList.add('omega-frame-select-mode');
  let wrap = $('msgsWrap');

  function cleanup() {
    wrap.removeEventListener('click', handler, true);
    document.removeEventListener('keydown', escHandler);
    document.body.classList.remove('omega-frame-select-mode');
  }
  function handler(e) {
    let msgEl = e.target.closest('.msg, .ch-post');
    if (!msgEl) return;
    e.preventDefault(); e.stopPropagation();
    cleanup();
    openFrameEditorForId(msgEl.dataset.id);
  }
  function escHandler(ev) {
    if (ev.key === 'Escape') { cleanup(); toast('Отменено'); }
  }
  wrap.addEventListener('click', handler, true);
  document.addEventListener('keydown', escHandler);
}

async function openFrameEditorForId(msgId) {
  let p = getMPath(); if (!p) return;
  try {
    let sn = await db.ref(p + '/messages/' + msgId).once('value');
    if (!sn.exists()) return toast('Сообщение не найдено', true);
    let m = sn.val(); m._id = msgId;
    if (m.type !== 'text') return toast('Кадры применимы только к текстовым сообщениям', true);
    let displayText = m.text;
    if (m.encrypted && m.text) displayText = decMsg(m.text) || m.text;
    openFrameEditorModal(m, displayText, p);
  } catch(e) { toast('Ошибка: ' + e.message, true); }
}

// ---------- Модалка редактора кадров ----------
let _frameEditorState = { msgId: null, path: null };

function openFrameEditorModal(m, displayText, path) {
  let old = document.getElementById('frameEditorModal');
  if (old) old.remove();
  _frameEditorState.msgId = m._id;
  _frameEditorState.path = path;

  let modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.id = 'frameEditorModal';
  modal.innerHTML =
    '<div class="modal" style="max-height:90vh">' +
      '<button class="modal-close" onclick="closeFrameEditor()">×</button>' +
      '<h2>🎞 Кадры сообщения</h2>' +
      '<div class="modal-body">' +
        '<p style="font-size:.8em;color:var(--t2);margin-bottom:4px">Оригинальное сообщение (' + esc(m.senderNick || m.sender || '?') + '):</p>' +
        '<div style="padding:8px 10px;background:var(--bg3);border-radius:8px;border:1px solid var(--custom-border);margin-bottom:12px;font-size:.88em;word-break:break-word">' +
          esc(displayText || '[медиа]') +
        '</div>' +
        '<p style="font-size:.82em;font-weight:700;color:var(--acc);margin-bottom:6px">🎞 КАДРЫ (зациклены, видны всем)</p>' +
        '<div id="frameList"></div>' +
        '<button class="btn btn-secondary btn-sm" type="button" onclick="addFrameRow()">+ Добавить кадр</button>' +
        '<div class="confirm-btns" style="margin-top:14px">' +
          '<button class="btn btn-ghost" onclick="closeFrameEditor()">Отмена</button>' +
          '<button class="btn btn-primary" onclick="applyFrameEditor()">Изменить</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) closeFrameEditor(); });

  let frames = (m.frames && m.frames.length) ? m.frames : [{ text: displayText || '', duration: 2000 }];
  frames.forEach(f => addFrameRow(f.text, (f.duration || 2000) / 1000));
}

window.addFrameRow = function(text, durSec) {
  let list = $('frameList'); if (!list) return;
  let row = document.createElement('div');
  row.className = 'frame-row';
  row.innerHTML =
    '<input type="text" class="frame-text-i" placeholder="Текст кадра" value="' + esc(text || '') + '">' +
    '<input type="number" class="frame-dur-i" min="0.3" step="0.1" value="' + (durSec != null ? durSec : 2) + '">' +
    '<span style="font-size:.68em;color:var(--t2)">сек</span>' +
    '<button type="button" class="frame-remove-btn" onclick="this.parentElement.remove()">✕</button>';
  list.appendChild(row);
};

window.closeFrameEditor = function() {
  let m = document.getElementById('frameEditorModal');
  if (m) m.remove();
  _frameEditorState = { msgId: null, path: null };
};

window.applyFrameEditor = async function() {
  let rows = document.querySelectorAll('#frameList .frame-row');
  if (!rows.length) return toast('Добавьте хотя бы один кадр', true);
  let frames = [];
  rows.forEach(r => {
    let text = r.querySelector('.frame-text-i').value.trim();
    let dur = parseFloat(r.querySelector('.frame-dur-i').value) || 2;
    if (text) frames.push({ text, duration: Math.round(dur * 1000) });
  });
  if (!frames.length) return toast('Заполните текст кадров', true);

  let { msgId, path } = _frameEditorState;
  if (!msgId || !path) return toast('Ошибка состояния', true);

  try {
    await db.ref(path + '/messages/' + msgId).update({
      frames: frames,
      framesStartedAt: Date.now(),
      text: encMsg(frames[0].text), // для клиентов без поддержки кадров
      encrypted: true,
      edited: true,
      editedAt: Date.now()
    });
    toast('🎞 Кадры применены! (' + frames.length + ')');
    closeFrameEditor();
  } catch(e) { toast('Ошибка: ' + e.message, true); }
};

// ---------- Переопределяем пункт debug-меню ----------
window.addMessageEditorToDebugMenu = function() {
  let dp = $('debugPanel'); if (!dp) return;
  let old = dp.querySelector('#debugEditorItem');
  if (old) old.remove();
  let item = document.createElement('div');
  item.id = 'debugEditorItem'; item.className = 'debug-item';
  item.innerHTML = '<div class="debug-item-title">🎞 Кадры сообщения</div><div class="debug-item-desc">Зациклить смену текста для всех</div>';
  item.onclick = () => { closeDebugPanel(); enterFrameSelectMode(); };
  dp.appendChild(item);
};

console.log('✅ omega-patch3.js загружен: fullscreen video, fix video-note playback, edit button, message frames tool');
})();
