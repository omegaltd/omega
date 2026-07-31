// ==================== OMEGA VIDEO NOTE — REWRITE FROM SCRATCH ====================
(function(){

// ---------- CSS ----------
(function injectStyles(){
  let css = `
  .vnote-rec-overlay{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);
    z-index:950;display:none;flex-direction:column;align-items:center;gap:10px}
  .vnote-rec-overlay.active{display:flex}
  .vnote-rec-circle{width:150px;height:150px;border-radius:50%;overflow:hidden;position:relative;
    background:#000;border:3px solid var(--custom-border);box-shadow:0 0 25px var(--custom-glow)}
  .vnote-rec-circle video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
  .vnote-rec-dot{position:absolute;top:10px;left:10px;width:10px;height:10px;border-radius:50%;
    background:var(--err);animation:blink 1s infinite;box-shadow:0 0 8px var(--err)}
  .vnote-rec-timer{background:rgba(0,0,0,.6);color:#fff;padding:3px 10px;border-radius:12px;font-size:.82em;font-weight:600}
  .vnote-rec-btns{display:flex;gap:16px}
  .vnote-rec-btn{width:46px;height:46px;border-radius:50%;border:2px solid var(--custom-border);
    display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;font-size:1.1em}
  .vnote-rec-btn.cancel{background:var(--bg4)}
  .vnote-rec-btn.send{background:var(--acc);box-shadow:0 0 15px var(--custom-glow)}

  .vnote-bubble{display:flex;flex-direction:column;align-items:center;gap:2px;width:170px}
  .vnote-circle{width:170px;height:170px;border-radius:50%;overflow:hidden;position:relative;
    background:#000;border:2px solid var(--custom-border);cursor:pointer;box-shadow:0 0 10px rgba(220,20,60,.2)}
  .vnote-circle video{width:100%;height:100%;object-fit:cover;display:block}
  .vnote-ring{position:absolute;inset:0;border-radius:50%;pointer-events:none;
    background:conic-gradient(var(--acc) 0%, transparent 0%);mix-blend-mode:screen;opacity:.55}
  .vnote-playbtn{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    width:44px;height:44px;border-radius:50%;background:rgba(220,20,60,.55);color:#fff;
    display:flex;align-items:center;justify-content:center;font-size:1.1em;transition:opacity .15s}
  .vnote-bubble.playing .vnote-playbtn{opacity:0}
  .vnote-dur{font-size:.72em;color:var(--t2)}
  `;
  let s = document.createElement('style');
  s.id = 'omegaVNoteStyles';
  s.textContent = css;
  document.head.appendChild(s);
})();

// ---------- ОВЕРЛЕЙ ЗАПИСИ ----------
function ensureOverlay() {
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

// ---------- СОСТОЯНИЕ ----------
let vnStream = null, vnMr = null, vnChunks = [], vnMime = '', vnTimer = null, vnSeconds = 0, vnCancelled = false;

function fmtDur(s) {
  s = Math.round(s || 0);
  return Math.floor(s/60) + ':' + (s%60 < 10 ? '0' : '') + (s%60);
}

function cleanupStream() {
  if (vnStream) { vnStream.getTracks().forEach(t => t.stop()); vnStream = null; }
  clearInterval(vnTimer); vnTimer = null; vnSeconds = 0;
  let ov = $('vnoteRecOverlay'); if (ov) ov.classList.remove('active');
  let vb = $('vnoteBtn'); if (vb) vb.classList.remove('recording');
  S.vnRec = false;
}

// ---------- СТАРТ ЗАПИСИ ----------
window.startVNoteRecord = async function() {
  if (S.rec || S.vnRec) return;
  let p = getMPath();
  if (!p) { toast('Откройте чат', true); return; }

  try {
    vnStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 480 }, height: { ideal: 480 }, aspectRatio: 1, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true }
    });
  } catch(e) {
    toast('Нет доступа к камере/микрофону: ' + e.message, true);
    return;
  }

  ensureOverlay();
  let prevVid = $('vnoteRecPreview');
  if (prevVid) prevVid.srcObject = vnStream;
  $('vnoteRecOverlay').classList.add('active');

  let types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4'
  ];
  vnMime = types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';

  try {
    vnMr = new MediaRecorder(vnStream, vnMime ? { mimeType: vnMime, videoBitsPerSecond: 1000000 } : {});
  } catch(e) {
    toast('MediaRecorder не поддерживается: ' + e.message, true);
    cleanupStream();
    return;
  }

  vnChunks = [];
  vnCancelled = false;
  let t0 = Date.now();

  vnMr.ondataavailable = ev => { if (ev.data && ev.data.size > 0) vnChunks.push(ev.data); };

  vnMr.onerror = err => {
    console.error('VNote MediaRecorder error:', err);
    toast('Ошибка записи видео', true);
    cleanupStream();
  };

  vnMr.onstop = async () => {
    cleanupStream();
    if (vnCancelled) { vnChunks = []; return; }
    if (!vnChunks.length) { toast('Запись пустая', true); return; }

    let blob = new Blob(vnChunks, { type: vnMime || 'video/webm' });
    if (blob.size < 500) { toast('Запись слишком короткая', true); return; }

    let dur = (Date.now() - t0) / 1000;
    try {
      let b64 = await b2b64(blob);
      let pm = getMPath();
      if (!pm) { toast('Чат не открыт', true); return; }
      let msgData = {
        sender: S.user, senderNick: S.nick, type: 'videoNote',
        media: b64, duration: Math.round(dur), timestamp: Date.now()
      };
      if (S.replyTo) { msgData.replyTo = S.replyTo; cancelReply(); }
      await db.ref(pm + '/messages').push(msgData);
      updLast('📹 Видео-кружок');
      toast('📹 Видео-кружок отправлен!');
    } catch(e) {
      console.error('VNote send error:', e);
      toast('Ошибка отправки: ' + e.message, true);
    }
  };

  vnMr.start(250);
  S.vnRec = true;
  let vb = $('vnoteBtn'); if (vb) vb.classList.add('recording');

  vnSeconds = 0;
  vnTimer = setInterval(() => {
    vnSeconds++;
    let t = $('vnoteRecTimer'); if (t) t.textContent = fmtDur(vnSeconds);
    if (vnSeconds >= 60) { toast('⏱ Максимум 60 сек'); window.stopVNoteRecord(); }
  }, 1000);
};

// ---------- СТОП + ОТПРАВКА ----------
window.stopVNoteRecord = function() {
  if (!vnMr || !S.vnRec) return;
  vnCancelled = false;
  try { if (vnMr.state !== 'inactive') vnMr.stop(); } catch(e) { cleanupStream(); }
};

// ---------- ОТМЕНА БЕЗ ОТПРАВКИ ----------
window.cancelVNoteRecord = function() {
  if (!vnMr || !S.vnRec) { cleanupStream(); return; }
  vnCancelled = true;
  try { if (vnMr.state !== 'inactive') vnMr.stop(); } catch(e) { cleanupStream(); }
  toast('Запись отменена');
};

// ---------- КНОПКА (тап = старт, повторный тап = отправить) ----------
window.toggleVNoteRecord = function() {
  if (S.rec) { toast('Сначала остановите голосовую запись', true); return; }
  if (S.vnRec) window.stopVNoteRecord();
  else window.startVNoteRecord();
};

// переустановим обработчик на существующую кнопку (patch.js её создаёт)
document.addEventListener('DOMContentLoaded', () => {
  let vb = document.getElementById('vnoteBtn');
  if (vb) vb.onclick = window.toggleVNoteRecord;
});
setTimeout(() => {
  let vb = document.getElementById('vnoteBtn');
  if (vb) vb.onclick = window.toggleVNoteRecord;
}, 1000);

// ---------- НЕ ТЕРЯЕМ ЗАПИСЬ ПРИ ВЫХОДЕ ИЗ ЧАТА (отменяем, а не отправляем) ----------
(function patchGoBackForVNote(){
  const _origGoBack = window.goBack;
  window.goBack = function() {
    if (S.vnRec) window.cancelVNoteRecord();
    _origGoBack();
  };
})();

// ---------- ВОСПРОИЗВЕДЕНИЕ ----------
window.buildVNoteHtml = function(m) {
  let dur = fmtDur(m.duration || 0);
  return '<div class="vnote-bubble" id="vn_' + m._id + '">' +
    '<div class="vnote-circle" onclick="toggleVNPlay(\'' + m._id + '\')">' +
      '<video id="vnv_' + m._id + '" src="' + m.media + '" playsinline preload="metadata"></video>' +
      '<div class="vnote-ring" id="vnring_' + m._id + '"></div>' +
      '<div class="vnote-playbtn" id="vnplay_' + m._id + '">▶</div>' +
    '</div>' +
    '<div class="vnote-dur" id="vndur_' + m._id + '">' + dur + '</div>' +
  '</div>';
};

window.toggleVNPlay = function(id) {
  let v = $('vnv_' + id);
  let bubble = $('vn_' + id);
  if (!v || !bubble) return;

  if (v.paused) {
    document.querySelectorAll('.vnote-circle video').forEach(ov => {
      if (ov !== v && !ov.paused) {
        ov.pause();
        let ob = ov.closest('.vnote-bubble');
        if (ob) ob.classList.remove('playing');
      }
    });
    v.play().catch(() => toast('Ошибка воспроизведения', true));
    bubble.classList.add('playing');
  } else {
    v.pause();
    bubble.classList.remove('playing');
  }
};

document.addEventListener('timeupdate', e => {
  if (!e.target.matches('.vnote-circle video')) return;
  let v = e.target;
  if (!v.duration || !isFinite(v.duration)) return;
  let id = v.id.replace('vnv_', '');
  let ring = $('vnring_' + id);
  let durEl = $('vndur_' + id);
  let pct = (v.currentTime / v.duration) * 100;
  if (ring) ring.style.background = 'conic-gradient(var(--acc) ' + pct + '%, transparent ' + pct + '%)';
  if (durEl) durEl.textContent = fmtDur(v.currentTime);
}, true);

document.addEventListener('ended', e => {
  if (!e.target.matches('.vnote-circle video')) return;
  let v = e.target;
  let id = v.id.replace('vnv_', '');
  let bubble = $('vn_' + id);
  let durEl = $('vndur_' + id);
  if (bubble) bubble.classList.remove('playing');
  if (durEl) durEl.textContent = fmtDur(v.duration || 0);
}, true);

console.log('✅ omega-vnote2.js — видео-кружки переписаны с нуля (без canvas, прямая запись потока)');
})();
