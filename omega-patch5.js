// ==================== OMEGA PATCH 5 ====================
// Полная переработка: голосовые/видео-сообщения с нуля + надёжный Push
// ============================================================
(function(){

// ============================================================
// CSS
// ============================================================
(function css(){
  let s = document.createElement('style');
  s.textContent = `
  .ov-voice{display:flex;align-items:center;gap:8px;padding:6px 10px;min-width:190px;max-width:260px;
    background:var(--custom-fill);border-radius:14px;border:1px solid var(--custom-border)}
  .ov-voice-play{width:34px;height:34px;border-radius:50%;background:var(--acc);border:none;color:#fff;
    cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.85em;
    box-shadow:0 0 10px var(--custom-glow)}
  .ov-voice-mid{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
  .ov-voice-bars{display:flex;align-items:center;gap:2px;height:22px;overflow:hidden}
  .ov-bar{width:3px;border-radius:2px;background:rgba(255,255,255,.35);flex-shrink:0;transition:background .1s}
  .ov-bar.played{background:var(--acc)}
  .ov-voice-range{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:2px;
    background:rgba(255,255,255,.25);cursor:pointer;outline:none;margin:0}
  .ov-voice-range::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;border-radius:50%;
    background:var(--acc);cursor:pointer;box-shadow:0 0 6px var(--custom-glow);margin-top:-3.5px}
  .ov-voice-range::-moz-range-thumb{width:11px;height:11px;border-radius:50%;background:var(--acc);
    border:none;cursor:pointer}
  .ov-voice-time{font-size:.68em;color:#fff;opacity:.8;flex-shrink:0;min-width:30px;text-align:right}

  .ov-vnote-wrap{display:flex;flex-direction:column;align-items:center;gap:2px;width:170px}
  .ov-vnote-circle{width:170px;height:170px;border-radius:50%;overflow:hidden;position:relative;
    background:#000;border:2px solid var(--custom-border);cursor:pointer;box-shadow:0 0 10px rgba(220,20,60,.2)}
  .ov-vnote-circle video{width:100%;height:100%;object-fit:cover;display:none}
  .ov-vnote-ring{position:absolute;inset:0;border-radius:50%;pointer-events:none;
    background:conic-gradient(var(--acc) 0%, transparent 0%);mix-blend-mode:screen;opacity:.6}
  .ov-vnote-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:42px;height:42px;
    border-radius:50%;background:rgba(220,20,60,.55);color:#fff;display:none;align-items:center;
    justify-content:center;font-size:1.05em}
  .ov-vnote-wrap.playing .ov-vnote-play{opacity:0}
  .ov-vnote-spin{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:26px;height:26px;
    border:3px solid rgba(220,20,60,.25);border-top-color:var(--acc);border-radius:50%;
    animation:spin .6s linear infinite}
  .ov-vnote-err{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;
    justify-content:center;background:rgba(0,0,0,.6);color:#fff;font-size:.72em;gap:2px;cursor:pointer}
  .ov-vnote-dur{font-size:.72em;color:var(--t2)}

  .ov-video-wrap{position:relative;width:100%;max-width:260px;border-radius:10px;overflow:hidden;
    background:#000;border:2px solid var(--custom-border);box-shadow:0 0 10px rgba(220,20,60,.2)}
  .ov-video-wrap.ov-fullw{max-width:100%}
  .ov-video-wrap video{width:100%;display:block;max-height:320px;background:#000}
  .ov-video-tap{position:absolute;inset:0;bottom:30px;cursor:pointer}
  .ov-video-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:46px;height:46px;
    border-radius:50%;background:rgba(220,20,60,.55);color:#fff;display:flex;align-items:center;
    justify-content:center;font-size:1.2em;pointer-events:none;transition:opacity .15s}
  .ov-video-wrap.playing .ov-video-center{opacity:0}
  .ov-video-spin{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:28px;height:28px;
    border:3px solid rgba(220,20,60,.25);border-top-color:var(--acc);border-radius:50%;
    animation:spin .6s linear infinite}
  .ov-video-controls{position:absolute;left:0;right:0;bottom:0;height:30px;display:flex;align-items:center;
    gap:5px;padding:0 6px;background:linear-gradient(to top,rgba(0,0,0,.8),rgba(0,0,0,.1))}
  .ov-video-time{font-size:.62em;color:#fff;min-width:28px;flex-shrink:0}
  .ov-video-seek{flex:1;-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;
    background:rgba(255,255,255,.3);cursor:pointer;outline:none}
  .ov-video-seek::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;border-radius:50%;
    background:var(--acc);cursor:pointer;margin-top:-3.5px}
  .ov-video-btn{background:rgba(220,20,60,.5);border:1px solid rgba(255,255,255,.3);color:#fff;
    font-size:.62em;padding:2px 6px;border-radius:6px;cursor:pointer;flex-shrink:0}

  .ov-rec-overlay{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:950;
    display:none;flex-direction:column;align-items:center;gap:10px}
  .ov-rec-overlay.active{display:flex}
  .ov-rec-circle{width:150px;height:150px;border-radius:50%;overflow:hidden;position:relative;
    background:#000;border:3px solid var(--custom-border);box-shadow:0 0 25px var(--custom-glow)}
  .ov-rec-circle video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
  .ov-rec-dot{position:absolute;top:10px;left:10px;width:10px;height:10px;border-radius:50%;
    background:var(--err);animation:blink 1s infinite}
  .ov-rec-timer{background:rgba(0,0,0,.6);color:#fff;padding:3px 10px;border-radius:12px;font-size:.82em;font-weight:600}
  .ov-rec-btns{display:flex;gap:16px}
  .ov-rec-btn{width:46px;height:46px;border-radius:50%;border:2px solid var(--custom-border);
    display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;font-size:1.1em}
  .ov-rec-btn.cancel{background:var(--bg4)}
  .ov-rec-btn.send{background:var(--acc);box-shadow:0 0 15px var(--custom-glow)}

  #vnoteBtn.recording, #voiceBtn.recording{background:var(--err)!important;border-color:var(--err)!important;
    color:#fff!important;animation:pulseGlow 1s infinite}
  `;
  document.head.appendChild(s);
})();

// ============================================================
// ОБЩИЙ ХЕЛПЕР: data:URI -> Blob URL (через fetch — самый надёжный способ)
// ============================================================
window._omM = window._omM || {}; // кэш: id -> { url, status }

async function omBlobify(dataUri, fallbackMime) {
  try {
    let res = await fetch(dataUri);
    let blob = await res.blob();
    if (blob && blob.size > 0) return blob;
  } catch(e) { console.warn('[Media] fetch->blob failed:', e.message); }
  try {
    let ci = dataUri.indexOf(',');
    let header = dataUri.substring(0, ci);
    let b64 = dataUri.substring(ci + 1);
    let mm = header.match(/data:(.*?);base64/);
    let mime = mm ? mm[1] : (fallbackMime || 'application/octet-stream');
    let bin = atob(b64);
    let bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch(e2) { console.error('[Media] manual decode failed:', e2.message); return null; }
}

async function omLoadMedia(id, mediaSrc, mimeHint) {
  let c = window._omM[id];
  if (c && c.status === 'ready') return c.url;
  if (c && c.status === 'error') return null;
  window._omM[id] = { url: null, status: 'loading' };

  if (!mediaSrc) { window._omM[id] = { status: 'error' }; return null; }
  if (!mediaSrc.startsWith('data:')) { window._omM[id] = { url: mediaSrc, status: 'ready' }; return mediaSrc; }

  let blob = await omBlobify(mediaSrc, mimeHint);
  if (!blob) { window._omM[id] = { status: 'error' }; return null; }
  let url = URL.createObjectURL(blob);
  window._omM[id] = { url, status: 'ready' };
  return url;
}

function omRevoke(id) {
  let c = window._omM[id];
  if (c && c.url && c.url.startsWith('blob:')) { try { URL.revokeObjectURL(c.url); } catch(e) {} }
  delete window._omM[id];
}

function omFixInfDuration(mediaEl) {
  // Классический баг Chrome: у распознанных MediaRecorder-блобов duration = Infinity.
  // Фикс — искусственный сик в конец и обратно, после чего duration считается верно.
  mediaEl.addEventListener('durationchange', function onDC() {
    if (mediaEl.duration === Infinity || isNaN(mediaEl.duration)) {
      mediaEl.currentTime = 1e101;
      mediaEl.addEventListener('timeupdate', function onTU() {
        mediaEl.removeEventListener('timeupdate', onTU);
        mediaEl.currentTime = 0;
      }, { once: true });
    } else {
      mediaEl.removeEventListener('durationchange', onDC);
    }
  });
}

function omFmt(s) {
  s = Math.max(0, Math.round(s || 0));
  return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
}

function omBars(seedStr, count) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) { seed = ((seed << 5) - seed) + seedStr.charCodeAt(i); seed |= 0; }
  let html = '';
  for (let i = 0; i < count; i++) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    let h = 4 + Math.abs(seed % 18);
    html += '<span class="ov-bar" style="height:' + h + 'px"></span>';
  }
  return html;
}

// ============================================================
// 1. ГОЛОСОВЫЕ СООБЩЕНИЯ — С НУЛЯ
// ============================================================

// ---- Рендер ----
window.buildVoiceHtml = function(m) {
  let id = m._id;
  let dur = m.duration || 0;
  let bars = omBars(id, 26);
  setTimeout(() => omVoiceInit(m), 10);
  return '<div class="ov-voice" id="ovv_' + id + '" data-dur="' + dur + '">' +
    '<button class="ov-voice-play" id="ovvp_' + id + '" onclick="omVoiceToggle(\'' + id + '\')">▶</button>' +
    '<div class="ov-voice-mid">' +
      '<div class="ov-voice-bars" id="ovvb_' + id + '">' + bars + '</div>' +
      '<input type="range" class="ov-voice-range" id="ovvr_' + id + '" min="0" max="1000" value="0" ' +
        'oninput="omVoiceSeek(\'' + id + '\',this.value)">' +
    '</div>' +
    '<span class="ov-voice-time" id="ovvt_' + id + '">' + omFmt(dur) + '</span>' +
    '<audio id="ovva_' + id + '" preload="none" style="display:none"></audio>' +
  '</div>';
};

async function omVoiceInit(m) {
  let id = m._id;
  let a = $('ovva_' + id);
  if (!a) return;
  let url = await omLoadMedia(id, m.media, m.mimeType || 'audio/webm');
  if (!url) {
    let btn = $('ovvp_' + id);
    if (btn) { btn.textContent = '⚠️'; btn.title = 'Не удалось загрузить'; }
    return;
  }
  a.src = url;
  omFixInfDuration(a);

  a.addEventListener('timeupdate', () => {
    let dur = parseFloat($('ovv_' + id)?.dataset.dur) || a.duration || 0;
    if (!dur) return;
    let pct = Math.min(100, (a.currentTime / dur) * 100);
    let range = $('ovvr_' + id);
    if (range && !range._dragging) range.value = pct * 10;
    let t = $('ovvt_' + id);
    if (t) t.textContent = omFmt(a.currentTime);
    let bars = $('ovvb_' + id);
    if (bars) {
      let children = bars.children;
      let activeCount = Math.floor((pct / 100) * children.length);
      for (let i = 0; i < children.length; i++) {
        children[i].classList.toggle('played', i < activeCount);
      }
    }
  });
  a.addEventListener('ended', () => {
    let btn = $('ovvp_' + id);
    if (btn) btn.innerHTML = '▶';
    let dur = parseFloat($('ovv_' + id)?.dataset.dur) || 0;
    let t = $('ovvt_' + id);
    if (t) t.textContent = omFmt(dur);
    let range = $('ovvr_' + id);
    if (range) range.value = 0;
    let bars = $('ovvb_' + id);
    if (bars) Array.from(bars.children).forEach(c => c.classList.remove('played'));
  });
}

window.omVoiceToggle = function(id) {
  let a = $('ovva_' + id);
  let btn = $('ovvp_' + id);
  if (!a || !a.src) { toast('Аудио загружается...'); return; }
  if (a.paused) {
    document.querySelectorAll('.ov-voice audio').forEach(oa => {
      if (oa !== a && !oa.paused) {
        oa.pause();
        let oid = oa.id.replace('ovva_', '');
        let ob = $('ovvp_' + oid);
        if (ob) ob.innerHTML = '▶';
      }
    });
    a.play().catch(() => toast('Ошибка воспроизведения', true));
    if (btn) btn.innerHTML = '❚❚';
  } else {
    a.pause();
    if (btn) btn.innerHTML = '▶';
  }
};

window.omVoiceSeek = function(id, val) {
  let a = $('ovva_' + id);
  let range = $('ovvr_' + id);
  let dur = parseFloat($('ovv_' + id)?.dataset.dur) || (a && a.duration) || 0;
  if (!a || !dur) return;
  range._dragging = true;
  a.currentTime = (val / 1000) * dur;
  clearTimeout(range._dragTimer);
  range._dragTimer = setTimeout(() => { range._dragging = false; }, 300);
};

// ---- Запись голосового ----
let ovRecStream = null, ovRecMr = null, ovRecChunks = [], ovRecMime = '', ovRecT0 = 0, ovRecCancelled = false;

window.startVoiceRecord = async function() {
  if (S.rec || S.vnRec) return;
  ovRecCancelled = false;
  try {
    ovRecStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
    });
  } catch(e) { toast('Разрешите доступ к микрофону', true); return; }

  let types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  ovRecMime = types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';

  try {
    ovRecMr = new MediaRecorder(ovRecStream, ovRecMime ? { mimeType: ovRecMime, audioBitsPerSecond: 128000 } : {});
  } catch(e) {
    toast('Запись аудио не поддерживается: ' + e.message, true);
    if (ovRecStream) { ovRecStream.getTracks().forEach(t => t.stop()); ovRecStream = null; }
    return;
  }

  ovRecChunks = [];
  ovRecT0 = Date.now();
  ovRecMr.ondataavailable = ev => { if (ev.data && ev.data.size > 0) ovRecChunks.push(ev.data); };

  ovRecMr.onerror = err => {
    console.error('[Voice] MediaRecorder error:', err);
    toast('Ошибка записи', true);
    omStopRecUIVoice();
  };

  ovRecMr.onstop = async () => {
    if (ovRecStream) { ovRecStream.getTracks().forEach(t => t.stop()); ovRecStream = null; }
    if (ovRecCancelled) { omStopRecUIVoice(); return; }
    if (!ovRecChunks.length) { omStopRecUIVoice(); return; }

    let realMime = ovRecMr.mimeType || ovRecMime || 'audio/webm';
    let blob = new Blob(ovRecChunks, { type: realMime });
    if (blob.size < 200) { omStopRecUIVoice(); toast('Запись слишком короткая', true); return; }

    let dur = (Date.now() - ovRecT0) / 1000;
    let p = getMPath();
    if (!p) { omStopRecUIVoice(); return; }
    try {
      let b64 = await b2b64(blob);
      let msgData = { sender: S.user, senderNick: S.nick, type: 'voice', media: b64, mimeType: realMime, duration: dur, timestamp: Date.now() };
      if (S.replyTo) { msgData.replyTo = S.replyTo; cancelReply(); }
      await db.ref(p + '/messages').push(msgData);
      updLast('🎤 Голосовое');
    } catch(e) { toast('Ошибка отправки: ' + e.message, true); }
    omStopRecUIVoice();
  };

  ovRecMr.start(100);
  S.rec = true;
  omStartRecUIVoice();
  S._recAutoStop = setTimeout(() => { if (S.rec) window.stopVoiceRecord(); }, 60000);
};

window.stopVoiceRecord = function() {
  clearTimeout(S._recAutoStop);
  if (ovRecMr && S.rec) { ovRecCancelled = false; try { ovRecMr.stop(); } catch(e) {} S.rec = false; }
};

window.cancelVoiceRecord = function() {
  clearTimeout(S._recAutoStop);
  if (ovRecMr && S.rec) { ovRecCancelled = true; try { ovRecMr.stop(); } catch(e) {} S.rec = false; }
  else omStopRecUIVoice();
  toast('Запись отменена');
};

function omStartRecUIVoice() {
  let ia = $('inputArea'), ri = $('recInd');
  if (ia) ia.style.display = 'none';
  if (ri) ri.style.display = 'flex';
  let vb = $('voiceBtn'); if (vb) vb.classList.add('recording');
  S.rs = 0;
  S.rt = setInterval(() => { S.rs++; if ($('recT')) $('recT').textContent = omFmt(S.rs); }, 1000);
}
function omStopRecUIVoice() {
  let ia = $('inputArea'), ri = $('recInd');
  if (ia) ia.style.display = 'flex';
  if (ri) ri.style.display = 'none';
  let vb = $('voiceBtn'); if (vb) vb.classList.remove('recording');
  clearInterval(S.rt); S.rs = 0;
  if ($('recT')) $('recT').textContent = '0:00';
}

// ============================================================
// 2. ВИДЕО-КРУЖКИ — С НУЛЯ
// ============================================================

window.buildVNoteHtml = function(m) {
  let id = m._id;
  let dur = m.duration || 0;
  setTimeout(() => omVNoteInit(m), 10);
  return '<div class="ov-vnote-wrap" id="ovn_' + id + '" data-dur="' + dur + '">' +
    '<div class="ov-vnote-circle" id="ovnc_' + id + '" onclick="omVNoteClick(\'' + id + '\')">' +
      '<div class="ov-vnote-spin" id="ovnspin_' + id + '"></div>' +
      '<video id="ovnv_' + id + '" playsinline preload="none"></video>' +
      '<div class="ov-vnote-ring" id="ovnring_' + id + '"></div>' +
      '<div class="ov-vnote-play" id="ovnplay_' + id + '">▶</div>' +
      '<div class="ov-vnote-err" id="ovnerr_' + id + '">⚠️<span style="font-size:.85em">Скачать</span></div>' +
    '</div>' +
    '<div class="ov-vnote-dur" id="ovndur_' + id + '">' + omFmt(dur) + '</div>' +
  '</div>';
};

async function omVNoteInit(m) {
  let id = m._id;
  let v = $('ovnv_' + id);
  if (!v) return;
  let url = await omLoadMedia(id, m.media, m.mimeType || 'video/webm');
  let spin = $('ovnspin_' + id), playBtn = $('ovnplay_' + id), errEl = $('ovnerr_' + id), circle = $('ovnc_' + id);

  if (!url) { if (spin) spin.style.display = 'none'; if (errEl) errEl.style.display = 'flex'; if (circle) circle.classList.add('omega-vn-error'); return; }

  v.src = url;
  omFixInfDuration(v);
  v.load();

  v.addEventListener('loadeddata', () => {
    if (spin) spin.style.display = 'none';
    v.style.display = 'block';
    if (playBtn) playBtn.style.display = 'flex';
  }, { once: true });

  v.addEventListener('error', () => {
    if (spin) spin.style.display = 'none';
    if (errEl) errEl.style.display = 'flex';
  }, { once: true });

  setTimeout(() => { if (v.readyState === 0 && spin && spin.style.display !== 'none') {
    if (spin) spin.style.display = 'none';
    if (errEl) errEl.style.display = 'flex';
  }}, 8000);

  v.addEventListener('timeupdate', () => {
    let dur = parseFloat($('ovn_' + id)?.dataset.dur) || v.duration || 0;
    if (!dur) return;
    let pct = Math.min(100, (v.currentTime / dur) * 100);
    let ring = $('ovnring_' + id);
    if (ring) ring.style.background = 'conic-gradient(var(--acc) ' + pct + '%, transparent ' + pct + '%)';
    let d = $('ovndur_' + id);
    if (d) d.textContent = omFmt(v.currentTime);
  });
  v.addEventListener('ended', () => {
    let wrap = $('ovn_' + id);
    if (wrap) wrap.classList.remove('playing');
    let dur = parseFloat(wrap?.dataset.dur) || 0;
    let d = $('ovndur_' + id);
    if (d) d.textContent = omFmt(dur);
    let ring = $('ovnring_' + id);
    if (ring) ring.style.background = 'conic-gradient(var(--acc) 0%, transparent 0%)';
  });
}

window.omVNoteClick = function(id) {
  let circle = $('ovnc_' + id);
  if (circle && circle.classList.contains('omega-vn-error')) {
    let c = window._omM[id];
    if (c && c.url) { let a = document.createElement('a'); a.href = c.url; a.download = 'video_' + id + '.webm'; a.click(); }
    else toast('Видео недоступно', true);
    return;
  }
  let v = $('ovnv_' + id), wrap = $('ovn_' + id);
  if (!v || !v.src) { toast('Видео загружается...'); return; }
  if (v.paused) {
    document.querySelectorAll('.ov-vnote-circle video').forEach(ov => {
      if (ov !== v && !ov.paused) { ov.pause(); let ob = ov.closest('.ov-vnote-wrap'); if (ob) ob.classList.remove('playing'); }
    });
    v.play().catch(() => toast('Ошибка воспроизведения', true));
    if (wrap) wrap.classList.add('playing');
  } else {
    v.pause();
    if (wrap) wrap.classList.remove('playing');
  }
};

// ---- Запись видео-кружка ----
let ovnStream = null, ovnMr = null, ovnChunks = [], ovnMime = '', ovnTimer = null, ovnSeconds = 0, ovnCancelled = false, ovnT0 = 0;

function ovnEnsureOverlay() {
  if ($('ovRecOverlay')) return;
  let div = document.createElement('div');
  div.id = 'ovRecOverlay';
  div.className = 'ov-rec-overlay';
  div.innerHTML =
    '<div class="ov-rec-circle"><video id="ovRecPreview" autoplay muted playsinline></video><div class="ov-rec-dot"></div></div>' +
    '<div class="ov-rec-timer" id="ovRecTimer">0:00</div>' +
    '<div class="ov-rec-btns">' +
      '<button class="ov-rec-btn cancel" id="ovRecCancelBtn">✕</button>' +
      '<button class="ov-rec-btn send" id="ovRecSendBtn">➤</button>' +
    '</div>';
  document.body.appendChild(div);
  $('ovRecCancelBtn').onclick = () => window.cancelVNoteRecord();
  $('ovRecSendBtn').onclick = () => window.stopVNoteRecord();
}

function ovnCleanup() {
  if (ovnStream) { ovnStream.getTracks().forEach(t => t.stop()); ovnStream = null; }
  clearInterval(ovnTimer); ovnTimer = null; ovnSeconds = 0;
  let ov = $('ovRecOverlay'); if (ov) ov.classList.remove('active');
  let vb = $('vnoteBtn'); if (vb) vb.classList.remove('recording');
  S.vnRec = false;
}

window.startVNoteRecord = async function() {
  if (S.rec || S.vnRec) return;
  let p = getMPath();
  if (!p) { toast('Откройте чат', true); return; }

  try {
    ovnStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 480 }, height: { ideal: 480 }, aspectRatio: 1, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true }
    });
  } catch(e) { toast('Нет доступа к камере/микрофону: ' + e.message, true); return; }

  ovnEnsureOverlay();
  let pv = $('ovRecPreview'); if (pv) pv.srcObject = ovnStream;
  $('ovRecOverlay').classList.add('active');

  let types = ['video/mp4;codecs=h264,aac', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'];
  ovnMime = types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';

  try {
    ovnMr = new MediaRecorder(ovnStream, ovnMime ? { mimeType: ovnMime, videoBitsPerSecond: 900000 } : {});
  } catch(e) { toast('Запись видео не поддерживается: ' + e.message, true); ovnCleanup(); return; }

  ovnChunks = [];
  ovnCancelled = false;
  ovnT0 = Date.now();

  ovnMr.ondataavailable = ev => { if (ev.data && ev.data.size > 0) ovnChunks.push(ev.data); };
  ovnMr.onerror = err => { console.error('[VNote] MR error:', err); toast('Ошибка записи видео', true); ovnCleanup(); };

  ovnMr.onstop = async () => {
    ovnCleanup();
    if (ovnCancelled) { ovnChunks = []; return; }
    if (!ovnChunks.length) { toast('Запись пустая', true); return; }

    let realMime = ovnMr.mimeType || ovnMime || 'video/webm';
    let blob = new Blob(ovnChunks, { type: realMime });
    if (blob.size < 500) { toast('Запись слишком короткая', true); return; }

    let dur = (Date.now() - ovnT0) / 1000;
    try {
      let b64 = await b2b64(blob);
      let pm = getMPath();
      if (!pm) { toast('Чат не открыт', true); return; }
      let msgData = { sender: S.user, senderNick: S.nick, type: 'videoNote', media: b64, mimeType: realMime, duration: Math.round(dur), timestamp: Date.now() };
      if (S.replyTo) { msgData.replyTo = S.replyTo; cancelReply(); }
      await db.ref(pm + '/messages').push(msgData);
      updLast('📹 Видео-кружок');
      toast('📹 Видео-кружок отправлен!');
    } catch(e) { toast('Ошибка отправки: ' + e.message, true); }
  };

  ovnMr.start(250);
  S.vnRec = true;
  let vb = $('vnoteBtn'); if (vb) vb.classList.add('recording');

  ovnSeconds = 0;
  ovnTimer = setInterval(() => {
    ovnSeconds++;
    let t = $('ovRecTimer'); if (t) t.textContent = omFmt(ovnSeconds);
    if (ovnSeconds >= 60) { toast('⏱ Максимум 60 сек'); window.stopVNoteRecord(); }
  }, 1000);
};

window.stopVNoteRecord = function() {
  if (!ovnMr || !S.vnRec) return;
  ovnCancelled = false;
  try { if (ovnMr.state !== 'inactive') ovnMr.stop(); } catch(e) { ovnCleanup(); }
};
window.cancelVNoteRecord = function() {
  if (!ovnMr || !S.vnRec) { ovnCleanup(); return; }
  ovnCancelled = true;
  try { if (ovnMr.state !== 'inactive') ovnMr.stop(); } catch(e) { ovnCleanup(); }
  toast('Запись отменена');
};
window.toggleVNoteRecord = function() {
  if (S.rec) { toast('Сначала остановите голосовую запись', true); return; }
  if (S.vnRec) window.stopVNoteRecord(); else window.startVNoteRecord();
};

setTimeout(() => { let vb = $('vnoteBtn'); if (vb) vb.onclick = window.toggleVNoteRecord; }, 2000);

(function patchGoBackMedia(){
  const _prev = window.goBack;
  window.goBack = function() {
    if (S.vnRec) window.cancelVNoteRecord();
    if (S.rec) window.cancelVoiceRecord();
    Object.keys(window._omM).forEach(id => omRevoke(id));
    if (_prev) _prev();
  };
})();
(function patchDelMsgMedia(){
  const _prev = window.delMsg;
  window.delMsg = async function(mid, all) {
    omRevoke(mid);
    if (_prev) await _prev(mid, all);
  };
})();

// ============================================================
// 3. ОБЫЧНЫЕ ВИДЕО-ФАЙЛЫ (attachFile) — тоже через blobify
// ============================================================
window.buildOmegaVideoHtml = function(src, extraClass, msgId) {
  let id = msgId || ('genv_' + Math.random().toString(36).slice(2));
  setTimeout(() => omGenVideoInit(id, src), 10);
  return '<div class="ov-video-wrap ' + (extraClass || '') + '" id="ovw_' + id + '">' +
    '<div class="ov-video-spin" id="ovwspin_' + id + '"></div>' +
    '<video class="ov-video-el" id="ovwv_' + id + '" playsinline preload="none"></video>' +
    '<div class="ov-video-tap" onclick="omGenVideoToggle(\'' + id + '\')"></div>' +
    '<div class="ov-video-center">▶</div>' +
    '<div class="ov-video-controls" style="display:none" id="ovwctrl_' + id + '">' +
      '<span class="ov-video-time" id="ovwcur_' + id + '">0:00</span>' +
      '<input type="range" class="ov-video-seek" id="ovwseek_' + id + '" min="0" max="1000" value="0" oninput="omGenVideoSeek(\'' + id + '\',this.value)">' +
      '<span class="ov-video-time" id="ovwdur_' + id + '">0:00</span>' +
      '<button class="ov-video-btn" onclick="event.stopPropagation();omGenVideoFs(\'' + id + '\')">⛶</button>' +
    '</div>' +
  '</div>';
};

async function omGenVideoInit(id, src) {
  let v = $('ovwv_' + id);
  if (!v) return;
  let url = await omLoadMedia(id, src, 'video/mp4');
  let spin = $('ovwspin_' + id);
  if (!url) { if (spin) spin.style.display = 'none'; toast('Видео не удалось загрузить', true); return; }
  v.src = url;
  omFixInfDuration(v);
  v.addEventListener('loadeddata', () => {
    if (spin) spin.style.display = 'none';
    let ctrl = $('ovwctrl_' + id); if (ctrl) ctrl.style.display = 'flex';
  }, { once: true });
  v.addEventListener('loadedmetadata', () => {
    let d = $('ovwdur_' + id); if (d && isFinite(v.duration)) d.textContent = omFmt(v.duration);
  });
  v.addEventListener('timeupdate', () => {
    if (!v.duration || !isFinite(v.duration)) return;
    let seek = $('ovwseek_' + id);
    if (seek && !seek._dragging) seek.value = (v.currentTime / v.duration) * 1000;
    let c = $('ovwcur_' + id); if (c) c.textContent = omFmt(v.currentTime);
  });
  v.addEventListener('play', () => $('ovw_' + id)?.classList.add('playing'));
  v.addEventListener('pause', () => $('ovw_' + id)?.classList.remove('playing'));
  v.addEventListener('ended', () => $('ovw_' + id)?.classList.remove('playing'));
}

window.omGenVideoToggle = function(id) {
  let v = $('ovwv_' + id);
  if (!v || !v.src) return;
  if (v.paused) {
    document.querySelectorAll('.ov-video-el').forEach(ov => { if (ov !== v && !ov.paused) ov.pause(); });
    v.play().catch(() => {});
  } else v.pause();
};
window.omGenVideoSeek = function(id, val) {
  let v = $('ovwv_' + id);
  let seek = $('ovwseek_' + id);
  if (!v || !v.duration || !isFinite(v.duration)) return;
  seek._dragging = true;
  v.currentTime = (val / 1000) * v.duration;
  clearTimeout(seek._dt);
  seek._dt = setTimeout(() => { seek._dragging = false; }, 300);
};
window.omGenVideoFs = function(id) {
  let wrap = $('ovw_' + id);
  if (!wrap) return;
  if (!document.fullscreenElement) wrap.requestFullscreen?.().catch(() => toast('Полный экран недоступен', true));
  else document.exitFullscreen?.();
};

// buildContent / openZoom / renderChPost — переключаем на новый видеоплеер
(function patchBuildContentFinal(){
  window.buildContent = function(m) {
    let reply = (typeof buildReplyHtml === 'function') ? buildReplyHtml(m) : '';
    let body;
    if (m.type === 'text') body = '<div class="msg-text">' + linkifyChannelIds(esc(m.text)) + '</div>';
    else if (m.type === 'image') body = '<div class="msg-media omega-media-loading"><div class="omega-media-spinner"></div><img src="' + m.media + '" onload="this.parentElement.classList.add(\'omega-media-loaded\')" onerror="this.parentElement.classList.add(\'omega-media-loaded\')" onclick="openZoom(\'image\',\'' + m.media + '\')"></div>' + (m.text ? '<div class="msg-text">' + esc(m.text) + '</div>' : '');
    else if (m.type === 'video') body = buildOmegaVideoHtml(m.media, '', m._id);
    else if (m.type === 'voice' || m.type === 'audio') body = buildVoiceHtml(m);
    else if (m.type === 'videoNote') body = buildVNoteHtml(m);
    else if (m.type === 'sticker') body = '<div style="max-width:180px" class="omega-media-loading"><div class="omega-media-spinner"></div><img src="' + m.media + '" style="width:100%;border-radius:8px;border:1px solid var(--custom-border);cursor:pointer" onload="this.parentElement.classList.add(\'omega-media-loaded\')" onclick="openZoom(\'image\',\'' + m.media + '\')"></div>';
    else if (m.type === 'file') body = buildFileHtml(m);
    else body = '<div class="msg-text">[Медиа]</div>';
    return reply + body;
  };
})();

(function patchOpenZoomFinal(){
  window.openZoom = function(type, src) {
    if (type !== 'video') {
      let cnt = $('zoomC');
      cnt.innerHTML = '<img id="zEl" src="' + src + '" draggable="false">';
      $('zoomOv').classList.add('active');
      return;
    }
    let cnt = $('zoomC');
    let id = 'zoomv_' + Date.now();
    cnt.innerHTML = buildOmegaVideoHtml(src, 'ov-fullw', id);
    $('zoomOv').classList.add('active');
    setTimeout(() => { let v = $('ovwv_' + id); if (v) v.play?.().catch(() => {}); }, 500);
  };
})();

(function patchRenderChPostFinal(){
  window.renderChPost = function(m) {
    let own = m.sender === S.user;
    let cid = S.curChat?.channelId;
    let div = document.createElement('div'); div.className = 'ch-post'; div.dataset.id = m._id;
    let content = '';
    if (m.type === 'text') content = '<div class="ch-post-text">' + linkifyChannelIds(esc(m.text)) + '</div>';
    else if (m.type === 'image') content = '<div class="ch-post-media omega-media-loading" onclick="openZoom(\'image\',\'' + m.media + '\')"><div class="omega-media-spinner"></div><img src="' + m.media + '" onload="this.parentElement.classList.add(\'omega-media-loaded\')" onerror="this.parentElement.classList.add(\'omega-media-loaded\')"></div>' + (m.text ? '<div class="ch-post-text">' + esc(m.text) + '</div>' : '');
    else if (m.type === 'video') content = buildOmegaVideoHtml(m.media, 'ov-fullw', m._id);
    else if (m.type === 'voice') content = buildVoiceHtml(m);
    else if (m.type === 'videoNote') content = buildVNoteHtml(m);
    else if (m.type === 'file') content = buildFileHtml(m);
    else if (m.type === 'sticker') content = '<div style="max-width:150px"><img src="' + m.media + '" style="width:100%;border-radius:8px"></div>';
    let replyHtml = (typeof buildReplyHtml === 'function') ? buildReplyHtml(m) : '';
    let rh = buildReactHtml(m);
    let commHtml = cid ? buildCommHtml(m._id, cid) : '';
    div.innerHTML = '<div class="ch-post-sender">' + esc(m.senderNick || 'Канал') + '</div>' + replyHtml + content + '<div class="ch-post-time">' + tf(m.timestamp) + '</div>' + rh + commHtml;
    lp(div, e => msgCtx(e, m, own, 'channel'));
    if (typeof attachSwipeReply === 'function') attachSwipeReply(div, m);
    $('msgsWrap').appendChild(div);
    $('msgsWrap').scrollTop = $('msgsWrap').scrollHeight;
    if (cid) loadComments(m._id, cid, div);
  };
})();

console.log('✅ Аудио/видео-сообщения переписаны с нуля');

// ============================================================
// 4. НАДЁЖНЫЙ WEB PUSH
// ============================================================
const OMEGA_VAPID_KEY = 'BPPp0QQDY6qcEGUF_RXrqTALFDNKg9A8wwU2x9zz4RDkHeERGpVrScUftIuSAICnyOAIluflE77tJ0RYpAabaDU';

function urlB64ToU8(base64String) {
  let padding = '='.repeat((4 - base64String.length % 4) % 4);
  let base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  let raw = atob(base64);
  let arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream; }
function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }

let _omSwPromise = null;
async function omRegisterSW() {
  if (_omSwPromise) return _omSwPromise;
  if (!('serviceWorker' in navigator)) return null;

  _omSwPromise = (async () => {
    // Зачистка чужих/blob-регистраций — главная причина нестабильности пушей
    try {
      let regs = await navigator.serviceWorker.getRegistrations();
      for (let r of regs) {
        let url = (r.active && r.active.scriptURL) || (r.installing && r.installing.scriptURL) || (r.waiting && r.waiting.scriptURL) || '';
        if (url.startsWith('blob:') || !url.endsWith('/service-worker.js')) {
          try { await r.unregister(); console.log('[Push] Удалён конфликтующий SW:', url); } catch(e) {}
        }
      }
    } catch(e) { console.warn('[Push] cleanup error:', e.message); }

    try {
      let reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/', updateViaCache: 'none' });
      await navigator.serviceWorker.ready;
      reg.update().catch(() => {});
      return reg;
    } catch(e) {
      console.error('[Push] Не удалось зарегистрировать /service-worker.js:', e.message);
      return null;
    }
  })();
  return _omSwPromise;
}
// Перехватываем ЛЮБОЙ старый вызов registerSW() из bundle.js — теперь всегда наш код
window.registerSW = omRegisterSW;

async function omGetSubscription(swReg, attempt) {
  attempt = attempt || 1;
  try {
    let existing = await swReg.pushManager.getSubscription();
    if (existing) return existing;
    return await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToU8(OMEGA_VAPID_KEY) });
  } catch(e) {
    let msg = String(e && e.message || '');
    console.warn('[Push] subscribe attempt ' + attempt + ' failed:', msg);
    if (msg.includes('applicationServerKey') || e.name === 'InvalidStateError') {
      try { let ex = await swReg.pushManager.getSubscription(); if (ex) await ex.unsubscribe(); } catch(e2) {}
    }
    if (attempt < 4) { await sleep(500 * attempt); return omGetSubscription(swReg, attempt + 1); }
    return null;
  }
}

async function omSaveSubscription(sub) {
  if (!S.user || !sub) return false;
  let ua = navigator.userAgent.toLowerCase();
  let platform = /android/.test(ua) ? 'android' : /iphone|ipad|ipod/.test(ua) ? 'ios' : 'web';
  try {
    let j = sub.toJSON();
    await db.ref('pushSubscriptions/' + platform + '/' + S.user).set({
      endpoint: j.endpoint, keys: j.keys, platform, updatedAt: Date.now(),
      userAgent: navigator.userAgent.substring(0, 120)
    });
    return true;
  } catch(e) { console.warn('[Push] save failed:', e.message); return false; }
}

async function omInitPush(silent) {
  if (!S.user) return;
  if (isIOS() && !isStandalone()) {
    if (!silent) showIOSInstallHint();
    return;
  }
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (!silent) toast('Push не поддерживается этим браузером', true);
    return;
  }
  let perm = Notification.permission;
  if (perm === 'denied') { if (!silent) toast('Уведомления заблокированы в настройках браузера', true); return; }
  if (perm === 'default') {
    if (silent) return; // без явного жеста пользователя не спрашиваем
    try { perm = await Notification.requestPermission(); } catch(e) { return; }
  }
  if (perm !== 'granted') return;

  try {
    let swReg = await omRegisterSW();
    if (!swReg) { if (!silent) toast('Ошибка регистрации Service Worker', true); return; }
    S.swRegistration = swReg;
    let sub = await omGetSubscription(swReg);
    if (!sub) { if (!silent) toast('Не удалось подписаться на уведомления', true); return; }
    let ok = await omSaveSubscription(sub);
    if (ok && !silent) toast('🔔 Уведомления включены!');
    updatePushToggleUI(true);
  } catch(e) {
    console.error('[Push] init error:', e);
    if (!silent) toast('Ошибка: ' + e.message, true);
  }
}
window.omEnablePush = () => omInitPush(false);

async function omDisablePush() {
  try {
    let reg = await navigator.serviceWorker.getRegistration('/');
    if (reg) { let sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); }
    let ua = navigator.userAgent.toLowerCase();
    let platform = /android/.test(ua) ? 'android' : /iphone|ipad|ipod/.test(ua) ? 'ios' : 'web';
    await db.ref('pushSubscriptions/' + platform + '/' + S.user).remove();
    toast('Уведомления отключены');
    updatePushToggleUI(false);
  } catch(e) { toast('Ошибка', true); }
}
window.omDisablePush = omDisablePush;

function showIOSInstallHint() {
  let modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.innerHTML = '<div class="modal"><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">×</button>' +
    '<h2>📱 Уведомления на iPhone</h2><div class="modal-body" style="text-align:center;line-height:1.6">' +
    '<p>Чтобы получать push-уведомления на iPhone/iPad:</p>' +
    '<p style="margin-top:10px">1. Нажмите кнопку «Поделиться» <b>⬆️</b> внизу Safari</p>' +
    '<p>2. Выберите «На экран «Домой»»</p>' +
    '<p>3. Откройте Omega с главного экрана и включите уведомления</p></div></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ---- UI: переключатель в настройках ----
function ensurePushToggleUI() {
  let setModal = $('setModal');
  if (!setModal || setModal.querySelector('#pushToggleItem')) return;
  let anchor = setModal.querySelector('.settings-item[onclick*="delAcc"]') ||
               setModal.querySelector('.settings-item[onclick*="switchAcc"]');
  if (!anchor) return;
  let item = document.createElement('div');
  item.className = 'settings-item';
  item.id = 'pushToggleItem';
  item.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>' +
    '<div class="settings-item-text"><div class="settings-item-title">Push-уведомления</div><div class="settings-item-sub" id="pushToggleSub">Выключены</div></div>' +
    '<button class="toggle" id="pushToggleBtn"></button>';
  anchor.parentElement.insertBefore(item, anchor);
  $('pushToggleBtn').onclick = async (e) => {
    e.stopPropagation();
    let btn = $('pushToggleBtn');
    if (btn.classList.contains('active')) await omDisablePush();
    else await omInitPush(false);
  };
  refreshPushToggleState();
}

async function refreshPushToggleState() {
  let btn = $('pushToggleBtn'), sub = $('pushToggleSub');
  if (!btn) return;
  let active = Notification.permission === 'granted';
  if (active && 'serviceWorker' in navigator) {
    try {
      let reg = await navigator.serviceWorker.getRegistration('/');
      let s = reg ? await reg.pushManager.getSubscription() : null;
      active = !!s;
    } catch(e) { active = false; }
  }
  updatePushToggleUI(active);
}
function updatePushToggleUI(active) {
  let btn = $('pushToggleBtn'), sub = $('pushToggleSub');
  if (btn) btn.classList.toggle('active', active);
  if (sub) sub.textContent = active ? 'Включены' : 'Выключены';
}

// ---- Debug: список подписок ----
async function showPushSubscriptions() {
  if (S.rank < 8 && !isDev(S.uname)) { toast('Нет доступа', true); return; }
  closeDebugPanel();
  try {
    let sn = await db.ref('pushSubscriptions').once('value');
    let data = sn.exists() ? sn.val() : {};
    let total = 0, html = '';
    ['web', 'android', 'ios'].forEach(pl => {
      let entries = Object.entries(data[pl] || {});
      total += entries.length;
      let icon = pl === 'web' ? '🌐' : pl === 'android' ? '🤖' : '🍎';
      html += '<div style="margin-bottom:12px;padding:10px;background:var(--bg3);border-radius:8px;border:1px solid var(--custom-border)">' +
        '<b style="color:var(--acc)">' + icon + ' ' + pl.toUpperCase() + ' (' + entries.length + ')</b>';
      if (!entries.length) html += '<p style="color:var(--t3);font-size:.82em;margin:6px 0">Нет подписчиков</p>';
      else entries.forEach(([user, v]) => {
        let upd = v.updatedAt ? new Date(v.updatedAt).toLocaleString('ru') : '—';
        html += '<div style="padding:6px 0;border-top:1px solid var(--brd);font-size:.82em"><b>' + esc(user) + '</b> <span style="color:var(--t3)">' + upd + '</span>' +
          '<button onclick="delPushSub(\'' + pl + '\',\'' + user + '\')" style="margin-left:8px;background:var(--err);color:#fff;border:none;border-radius:4px;padding:1px 6px;cursor:pointer;font-size:.72em">✕</button></div>';
      });
      html += '</div>';
    });
    let modal = document.createElement('div');
    modal.className = 'modal-overlay active'; modal.id = 'pushSubsModal';
    modal.innerHTML = '<div class="modal" style="max-height:85vh"><button class="modal-close" onclick="document.getElementById(\'pushSubsModal\').remove()">×</button>' +
      '<h2>📡 Push подписки</h2><div style="text-align:center;padding:4px 0 10px;font-size:.85em;color:var(--t2)">Всего: <b style="color:var(--acc)">' + total + '</b></div>' +
      '<div class="modal-body">' + html + '<button class="btn btn-danger" onclick="clearAllPushSubs()">🗑 Очистить все</button></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  } catch(e) { toast('Ошибка: ' + e.message, true); }
}
window.showPushSubscriptions = showPushSubscriptions;
window.delPushSub = async function(pl, user) { await db.ref('pushSubscriptions/' + pl + '/' + user).remove(); toast('Удалено'); showPushSubscriptions(); };
window.clearAllPushSubs = async function() { let ok = await confirm2('Удалить все подписки?'); if (!ok) return; await db.ref('pushSubscriptions').remove(); toast('Очищено'); document.getElementById('pushSubsModal')?.remove(); };

function addPushDebugItem() {
  let dp = $('debugPanel');
  if (!dp || dp.querySelector('#debugPushItem')) return;
  let item = document.createElement('div');
  item.id = 'debugPushItem'; item.className = 'debug-item';
  item.innerHTML = '<div class="debug-item-title">📡 Push подписки</div><div class="debug-item-desc">Просмотр Web Push подписок</div>';
  item.onclick = showPushSubscriptions;
  dp.appendChild(item);
}

// ---- Инициализация ----
(function patchAfterLoginPushFinal(){
  const _prev = window.afterLogin;
  window.afterLogin = async function() {
    await _prev();
    setTimeout(() => { ensurePushToggleUI(); omInitPush(true); }, 1200); // silent — только если разрешение уже есть
    setTimeout(addPushDebugItem, 1800);
  };
})();
if (S && S.user) {
  setTimeout(() => { ensurePushToggleUI(); omInitPush(true); }, 500);
  setTimeout(addPushDebugItem, 1000);
}

// Периодическая самопроверка подписки (раз в 20 минут, без запроса разрешения)
setInterval(() => { if (S.user && Notification.permission === 'granted') omInitPush(true); }, 20 * 60 * 1000);

console.log('✅ omega-patch5.js: медиа переписаны с нуля + единая надёжная регистрация Push SW');
})();
