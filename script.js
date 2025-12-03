// script.js — merged: music, countdown, album (3x3), lightbox, firebase helpers (expects window._firebase)
document.addEventListener('DOMContentLoaded', () => {
  /* ===== CONFIG ===== */
  const playlist = [
    'assets/Beautiful In White.mp3',
    'assets/Lễ Đường.mp3',
    'assets/Nơi Này Có Anh.mp3',
    'assets/Ta Là Của Nhau.mp3',
    'assets/Ngày Đầu Tiên.mp3'.trim(), 
  ].map(s => s.replace(/\s+/g,' ')); // small normalize
  const defaultVolume = 0.75;
  const bgAudio = document.getElementById('bgMusic');
  const musicToggle = document.getElementById('musicToggle');
  const musicIcon = document.getElementById('musicIcon');
  const tapOverlay = document.getElementById('tapToPlay');
  const tapBtn = document.getElementById('tapPlayBtn');
  const STORAGE_KEY = 'wedding_music_allowed';

  /* ===== state ===== */
  let currentTrack = Math.floor(Math.random() * Math.max(1, playlist.length));
  let playing = false;
  let userInteracted = false;

  /* ===== helpers (music) ===== */
  const setAllowed = v => { try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch(e){} };
  const updateToggleUI = isPlaying => {
    if(!musicToggle || !musicIcon) return;
    musicToggle.setAttribute('aria-pressed', String(Boolean(isPlaying)));
    musicIcon.textContent = isPlaying ? '♫' : '♪';
    musicToggle.title = isPlaying ? 'Tắt nhạc' : 'Bật nhạc';
  };

  function loadTrack(index){
    if(!bgAudio) return;
    currentTrack = (index + playlist.length) % playlist.length;
    bgAudio.src = playlist[currentTrack];
    bgAudio.load();
    bgAudio.volume = defaultVolume;
    bgAudio.muted = false;
  }

  async function tryPlayUnmuted(){
    if(!bgAudio) return false;
    try { await bgAudio.play(); playing = true; updateToggleUI(true); return true; }
    catch(e){ return false; }
  }
  async function tryPlayMutedFallback(){
    if(!bgAudio) return false;
    try {
      bgAudio.muted = true;
      await bgAudio.play();
      playing = true; updateToggleUI(true);
      return true;
    } catch(e){
      bgAudio.muted = false;
      return false;
    }
  }
  function pauseAudio(){
    if(!bgAudio) return;
    bgAudio.pause(); playing = false; updateToggleUI(false);
  }

  if(bgAudio){
    bgAudio.addEventListener('ended', () => {
      currentTrack = (currentTrack + 1) % playlist.length;
      loadTrack(currentTrack);
      tryPlayUnmuted().catch(()=>{});
    });
  }

  function showOverlay(){ if(tapOverlay){ tapOverlay.style.display = 'flex'; tapOverlay.setAttribute('aria-hidden','false'); } }
  function hideOverlay(){ if(tapOverlay){ tapOverlay.style.display = 'none'; tapOverlay.setAttribute('aria-hidden','true'); } }

  loadTrack(currentTrack);
  (async function autoPlayFlow(){
    let ok = await tryPlayUnmuted();
    if(ok){ setAllowed(true); return; }
    ok = await tryPlayMutedFallback();
    if(ok){ showOverlay(); return; }
    showOverlay();
  })();

  async function onUserGesture(){
    userInteracted = true; setAllowed(true); hideOverlay();
    // randomize on explicit gesture
    currentTrack = Math.floor(Math.random() * Math.max(1, playlist.length));
    loadTrack(currentTrack);
    try {
      bgAudio.muted = false; bgAudio.volume = defaultVolume;
      await bgAudio.play();
      playing = true; updateToggleUI(true);
    } catch(err){
      playing = false; updateToggleUI(false);
      console.warn('Play after gesture failed', err);
    }
  }
  if(tapBtn) tapBtn.addEventListener('click', e => { e.preventDefault(); onUserGesture(); });
  const onFirstInteraction = async () => { if(userInteracted) return; userInteracted = true; hideOverlay(); setAllowed(true); if(!bgAudio.src) loadTrack(currentTrack); try{ bgAudio.muted=false; bgAudio.volume=defaultVolume; await bgAudio.play(); playing=true; updateToggleUI(true);}catch(e){} finally{ window.removeEventListener('pointerdown', onFirstInteraction); }};
  window.addEventListener('pointerdown', onFirstInteraction, {once:true});

  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible' && userInteracted && !playing){
      tryPlayUnmuted().catch(()=>{});
    }
  });

  if(musicToggle){
    musicToggle.addEventListener('click', async (e) => {
      e.preventDefault();
      userInteracted = true;
      if(playing){ pauseAudio(); }
      else {
        currentTrack = Math.floor(Math.random() * Math.max(1, playlist.length));
        loadTrack(currentTrack);
        bgAudio.muted = false; bgAudio.volume = defaultVolume;
        const ok = await tryPlayUnmuted();
        if(!ok) showOverlay(); else setAllowed(true);
      }
    });
  }

  /* ===== reveal via IntersectionObserver ===== */
  const reveals = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window && reveals.length){
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if(entry.isIntersecting){ entry.target.classList.add('show'); io.unobserve(entry.target); } });
    }, {threshold: 0.12});
    reveals.forEach(r => io.observe(r));
  } else { reveals.forEach(r => r.classList.add('show')); }

  /* ===== Countdown (kept) ===== */
  (function initWeddingCountdown(){
    const targetISO = '2025-12-29T10:00:00+07:00';
    const target = new Date(targetISO).getTime();
    if (isNaN(target)) return;
    const elDays = document.getElementById('cd-days');
    const elHours = document.getElementById('cd-hours');
    const elMins = document.getElementById('cd-mins');
    const elSecs = document.getElementById('cd-secs');
    const elNote = document.getElementById('cd-note');
    function pad(n){ return String(n).padStart(2,'0'); }
    function update(){
      const now = Date.now();
      let diff = Math.floor((target - now) / 1000);
      if (diff <= 0){
        if (elDays) elDays.textContent = '0';
        if (elHours) elHours.textContent = '00';
        if (elMins) elMins.textContent = '00';
        if (elSecs) elSecs.textContent = '00';
        if (elNote){ elNote.style.display = 'block'; elNote.textContent = 'Ngày trọng đại đã tới — Hẹn gặp bạn ở ngày vui 🎉'; elNote.setAttribute('aria-hidden','false'); }
        clearInterval(timerId);
        return;
      }
      const days = Math.floor(diff / 86400); diff -= days * 86400;
      const hours = Math.floor(diff / 3600); diff -= hours * 3600;
      const mins = Math.floor(diff / 60); const secs = diff - mins * 60;
      if (elDays) elDays.textContent = String(days);
      if (elHours) elHours.textContent = pad(hours);
      if (elMins) elMins.textContent = pad(mins);
      if (elSecs) elSecs.textContent = pad(secs);
    }
    update();
    const timerId = setInterval(update, 1000);
  })();

  /* ===== ALBUM (pool, render, bind clicks) ===== */
  const folder = "assets/album/";
  let totalImages = 9;   // adjust to actual # of files
  const showCount = 9;   // 3x3
  const container = document.getElementById('fixedAlbumGrid');
  const openAllBtn = document.getElementById('openAllBtn');

  // build pool
  const pool = [];
  for(let i=1;i<=totalImages;i++) pool.push(`${folder}${i}.jpg`);

  // render function (creates .album-item and sets data-pool-index)
  function renderGridFromPool(){
    if(!container) return;
    container.innerHTML = '';
    // choose showCount random
    const p = pool.slice();
    for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    const selected = p.slice(0, Math.min(showCount, p.length));
    selected.forEach((src, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'album-item';
      const img = document.createElement('img');
      img.src = src;
      img.loading = 'lazy';
      img.alt = `Ảnh cưới ${idx+1}`;
      // set dataset to index within pool (so navigation is full-pool aware)
      img.dataset.poolIndex = String(pool.indexOf(src));
      wrap.appendChild(img);
      container.appendChild(wrap);
    });
    bindAlbumClicks();
  }
  renderGridFromPool();

  // bind clicks
  function bindAlbumClicks(){
    if(!container) return;
    const imgs = Array.from(container.querySelectorAll('img'));
    imgs.forEach(img => {
      img.style.cursor = 'zoom-in';
      img.removeEventListener('click', onAlbumImageClick);
      img.addEventListener('click', onAlbumImageClick);
    });
  }
  function onAlbumImageClick(e){
    const idx = Number(e.currentTarget.dataset.poolIndex || 0);
    showLightboxAt(idx);
  }

  // open all button
  if(openAllBtn){
    openAllBtn.setAttribute('type','button');
    openAllBtn.addEventListener('click', (e)=>{
      e.preventDefault();
      // open from first image in pool (index 0)
      showLightboxAt(0);
    });
  }

  /* ===== album auto-rotate (keeps pool) ===== */
  (function albumAutoRotate(){
    if(!container) return;
    const rotateMs = 15000;
    let isPaused = false;
    async function rotateOnce(){
      if(isPaused) return;
      // pick next set
      const copy = pool.slice();
      for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
      const next = copy.slice(0, Math.min(showCount, copy.length));
      // preload
      await Promise.all(next.map(s => new Promise(r => {
        const im = new Image(); im.onload = () => r(true); im.onerror = () => r(false); im.src = s;
      })));
      container.classList.add('fading');
      await new Promise(r => setTimeout(r, 520));
      container.innerHTML = '';
      next.forEach(src => {
        const wrap = document.createElement('div'); wrap.className='album-item';
        const img = document.createElement('img'); img.src=src; img.loading='lazy'; img.alt='Ảnh cưới'; img.dataset.poolIndex = String(pool.indexOf(src));
        wrap.appendChild(img); container.appendChild(wrap);
      });
      container.classList.remove('fading');
      bindAlbumClicks();
    }
    let timer = setInterval(()=> rotateOnce().catch(()=>{}), rotateMs);
    container.addEventListener('mouseenter', ()=>{ isPaused = true; });
    container.addEventListener('mouseleave', ()=>{ isPaused = false; });
    // initial rotate (delayed)
    setTimeout(()=>{ rotateOnce().catch(()=>{}); }, 1200);
  })();


  // Robust binding cho nút Invite (scroll + focus)
  (function bindInviteButton(){
    const inviteBtn = document.getElementById('inviteBtn');
    const target = document.getElementById('invite');
    if(!inviteBtn){
      console.warn('inviteBtn not found');
      return;
    }
    // ensure type button so it won't submit forms accidentally
    inviteBtn.setAttribute('type', 'button');

    // remove previous to avoid duplicate
    if(inviteBtn._boundHandler) inviteBtn.removeEventListener('click', inviteBtn._boundHandler);

    const handler = (e) => {
      e.preventDefault();
      // if overlay is visible, hide it first (tapOverlay defined earlier in script)
      try {
        if(window.tapOverlay && (window.tapOverlay.style.display !== 'none')) {
          // use hideOverlay if available, else directly hide
          if(typeof hideOverlay === 'function') hideOverlay();
          else { window.tapOverlay.style.display = 'none'; window.tapOverlay.setAttribute('aria-hidden','true'); window.tapOverlay.style.pointerEvents = 'none'; }
        }
      } catch(err){ /* ignore */ }

      // small click animation
      inviteBtn.classList.add('clicked');
      setTimeout(()=> inviteBtn.classList.remove('clicked'), 350);

      if(target){
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // temporary tabindex for focusing without scroll jump
        target.setAttribute('tabindex','-1');
        setTimeout(()=> {
          try { target.focus({ preventScroll: true }); } catch(e){ /* ignore */ }
          setTimeout(()=> target.removeAttribute('tabindex'), 1200);
        }, 300);
      } else {
        console.warn('invite target not found (#invite)');
      }
    };

    inviteBtn.addEventListener('click', handler);
    // store ref so we can remove later if needed
    inviteBtn._boundHandler = handler;
  })();




  /* ===== LIGHTBOX IMPLEMENTATION (uses pool array) ===== */
  const lb = document.getElementById('lightbox');
  const lbImg = lb ? lb.querySelector('.lb-img') : null;
  const lbCaption = lb ? lb.querySelector('.lb-caption') : null;
  const lbClose = lb ? lb.querySelector('.lb-close') : null;
  const lbPrev = lb ? lb.querySelector('.lb-prev') : null;
  const lbNext = lb ? lb.querySelector('.lb-next') : null;
  let lbVisible = false;
  let currentLbIndex = 0;

  function showLightboxAt(index){
    if(!lb || !lbImg) return;
    currentLbIndex = ((index % pool.length) + pool.length) % pool.length;
    lbImg.src = pool[currentLbIndex];
    lbImg.alt = `Ảnh ${currentLbIndex+1}`;
    if(lbCaption) lbCaption.textContent = `Ảnh ${currentLbIndex+1} / ${pool.length}`;
    lb.classList.add('show');
    lb.setAttribute('aria-hidden','false');
    lbVisible = true;
    lb.setAttribute('tabindex','-1'); lb.focus();
    document.body.style.overflow = 'hidden';
  }

  function hideLightbox(){
    if(!lb) return;
    lb.classList.remove('show');
    lb.setAttribute('aria-hidden','true');
    lbVisible = false;
    document.body.style.overflow = '';
  }

  function nextLightbox(){ showLightboxAt(currentLbIndex + 1); }
  function prevLightbox(){ showLightboxAt(currentLbIndex - 1); }

  if(lbClose) lbClose.addEventListener('click', hideLightbox);
  if(lbPrev) lbPrev.addEventListener('click', (e)=>{ e.stopPropagation(); prevLightbox(); });
  if(lbNext) lbNext.addEventListener('click', (e)=>{ e.stopPropagation(); nextLightbox(); });
  if(lb) lb.addEventListener('click', (e)=> { if(e.target === lb) hideLightbox(); });
  document.addEventListener('keydown', (e)=>{ if(!lbVisible) return; if(e.key==='Escape') hideLightbox(); if(e.key==='ArrowLeft') prevLightbox(); if(e.key==='ArrowRight') nextLightbox(); });

  // ==== Click nửa trái / nửa phải màn để chuyển ảnh (lightbox) ====
  (function enableLightboxSideClick() {
    if(!lb) return;
    lb.addEventListener('click', (ev) => {
      // Nếu click trúng các nút UI thì không xử lý ở đây
      const t = ev.target;
      if (t.classList && (t.classList.contains('lb-close') || t.classList.contains('lb-prev') || t.classList.contains('lb-next') )) {
        return;
      }

      // Nếu click chính xác lên overlay nền (lb) thì ignore (đã có logic đóng)
      if (ev.target === lb) {
        // giữ hành vi đóng (đã xử lý trước đó)
        return;
      }

      // Lấy bounding của lightbox để tính nửa trái/nửa phải
      const rect = lb.getBoundingClientRect();
      const clickX = ev.clientX - rect.left;
      const half = rect.width / 2;

      if (clickX < half) {
        // click nửa trái -> ảnh trước
        try { prevLightbox(); } catch(e){ /* noop */ }
      } else {
        // click nửa phải -> ảnh sau
        try { nextLightbox(); } catch(e){ /* noop */ }
      }
    }, { passive: true });
  })();



  // ==== Swipe gesture for lightbox (mobile) ====
  (function enableLightboxSwipe() {
    if(!lb) return;
    let startX = 0, startY = 0, isMoving = false;

    lb.addEventListener('touchstart', (ev) => {
      if(!ev.touches || ev.touches.length === 0) return;
      const t = ev.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      isMoving = true;
    }, { passive: true });

    lb.addEventListener('touchmove', (ev) => {
      // we don't prevent default — allow scroll in nested elements if needed
      if(!isMoving) return;
      // optional: you could track movement for UI feedback
    }, { passive: true });

    lb.addEventListener('touchend', (ev) => {
      if(!isMoving) return;
      isMoving = false;
      // determine end position from changedTouches if present
      const t = (ev.changedTouches && ev.changedTouches[0]) || null;
      if(!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // thresholds: horizontal swipe must be sufficiently horizontal and long enough
      const MIN_SWIPE_DISTANCE = 40;   // px
      const MAX_VERTICAL_DELTA = 120;  // px

      if (absDx > MIN_SWIPE_DISTANCE && absDy < MAX_VERTICAL_DELTA) {
        if (dx > 0) {
          // swipe right -> previous image
          try { prevLightbox(); } catch(e){ /* noop */ }
        } else {
          // swipe left -> next image
          try { nextLightbox(); } catch(e){ /* noop */ }
        }
      }
    }, { passive: true });

  })();




  // expose helpers for debugging
  try {
    window.showLightboxAt = showLightboxAt;
    window.hideLightbox = hideLightbox;
    window.nextLightbox = nextLightbox;
    window.prevLightbox = prevLightbox;
    window._albumPool = pool;
    window._renderAlbumGrid = renderGridFromPool;
  } catch(e){ /* ignore */ }
  

  /* ===== WISHES (fallback to localStorage if Firebase not present) ===== */
  (function initWishes(){
    const form = document.getElementById('wishForm');
    const nameInput = document.getElementById('wishName');
    const msgInput = document.getElementById('wishMsg');
    const feedback = document.getElementById('wishFeedback');
    const listEl = document.getElementById('wishesList');
    const clearBtn = document.getElementById('clearWishesBtn');
    function showFeedback(txt, ok=true){
      if(!feedback) return;
      feedback.style.display='block'; feedback.textContent = txt; feedback.style.color = ok ? '#0b8a3b' : '#b02c63';
      setTimeout(()=>{ if(feedback) feedback.style.display='none'; }, 3000);
    }
    const fb = window._firebase || null;
    if(!fb || !fb.db){
      // load local
      try {
        const saved = JSON.parse(localStorage.getItem('wishes_local_v1') || '[]');
        renderWishes(saved);
      } catch(e){}
      form && form.addEventListener('submit', (ev)=>{
        ev.preventDefault();
        const name = (nameInput.value||'').trim() || 'Bạn ẩn danh';
        const msg = (msgInput.value||'').trim();
        if(!msg){ showFeedback('Vui lòng viết lời chúc trước khi gửi.', false); return; }
        const item = { name, message: msg, createdAt: new Date().toISOString() };
        const arr = JSON.parse(localStorage.getItem('wishes_local_v1')||'[]'); arr.unshift(item); localStorage.setItem('wishes_local_v1', JSON.stringify(arr.slice(0,200)));
        renderWishes(arr);
        nameInput.value=''; msgInput.value=''; showFeedback('Gửi lời chúc thành công (lưu tạm).');
      });
      if(clearBtn) clearBtn.addEventListener('click', ()=>{ localStorage.removeItem('wishes_local_v1'); renderWishes([]); showFeedback('Đã xóa (local).'); });
      return;
    }
    // if firebase present, the original code (kept minimal) will be used by window._firebase in index.html
    const { db, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs } = fb;
    const wishesColRef = collection(db, 'wishes');
    try {
      const q = query(wishesColRef, orderBy('createdAt', 'desc'));
      onSnapshot(q, (snap) => {
        const out = []; snap.forEach(doc => { const d = doc.data(); out.push({ id: doc.id, name: d.name||'Bạn ẩn danh', message: d.message||'', createdAt: d.createdAt ? (d.createdAt.toDate ? d.createdAt.toDate().toISOString() : d.createdAt) : null }); });
        renderWishes(out);
      });
    } catch(e){
      (async ()=>{
        try {
          const s = await getDocs(wishesColRef);
          const out = []; s.forEach(doc => { const d = doc.data(); out.push({ id: doc.id, name: d.name, message: d.message, createdAt: d.createdAt ? d.createdAt.toDate().toISOString() : null }); });
          renderWishes(out);
        } catch(err){ console.warn('Firebase read failed', err); }
      })();
    }
    form && form.addEventListener('submit', async (ev)=>{
      ev.preventDefault();
      const name = (nameInput.value||'').trim() || 'Bạn ẩn danh';
      const msg = (msgInput.value||'').trim();
      if(!msg){ showFeedback('Vui lòng viết lời chúc trước khi gửi.', false); return; }
      try { await addDoc(wishesColRef, { name, message: msg, createdAt: serverTimestamp() }); nameInput.value=''; msgInput.value=''; showFeedback('Gửi lời chúc thành công — cảm ơn bạn! 🎉'); } catch(err){ console.error(err); showFeedback('Gửi thất bại — thử lại sau.', false); }
    });
    if(clearBtn) clearBtn.addEventListener('click', ()=>{ renderWishes([]); showFeedback('Đã xóa hiển thị (không xóa trên Firebase).'); });

    function renderWishes(list){
      if(!listEl) return;
      if(!list || list.length === 0){ listEl.innerHTML = '<div class=\"wish-empty\">Chưa có lời chúc nào — bạn hãy là người đầu tiên gửi lời chúc! 💌</div>'; return; }
      listEl.innerHTML = '';
      list.forEach(it => {
        const item = document.createElement('div'); item.className='wish-item';
        const avatar = document.createElement('div'); avatar.className='wish-avatar'; avatar.textContent = (it.name||'Bạn').split(' ').map(s=>s[0]||'').slice(0,2).join('').toUpperCase();
        const body = document.createElement('div'); body.className='wish-body';
        const meta = document.createElement('div'); meta.className='wish-meta';
        const nameEl = document.createElement('strong'); nameEl.textContent = it.name || 'Bạn ẩn danh';
        const timeEl = document.createElement('span'); timeEl.textContent = it.createdAt ? (new Date(it.createdAt)).toLocaleString() : '';
        meta.appendChild(nameEl); meta.appendChild(timeEl);
        const text = document.createElement('div'); text.className='wish-text'; text.textContent = it.message || '';
        body.appendChild(meta); body.appendChild(text); item.appendChild(avatar); item.appendChild(body); listEl.appendChild(item);
      });
    }
  })();

  // ===== Gift (Mừng cưới) popup logic =====
(function initGiftPopup(){
  const giftBtn = document.getElementById('giftBtn');
  const giftPopup = document.getElementById('giftPopup');
  const giftClose = giftPopup ? giftPopup.querySelector('.gift-close') : null;
  const giftCloseBtn = document.getElementById('giftCloseBtn');
  const giftDownload = document.getElementById('giftDownload');
  const giftQrImg = document.getElementById('giftQrImg');

  if(!giftBtn || !giftPopup) return;

  function openGift(){
    giftPopup.setAttribute('aria-hidden','false');
    giftBtn.setAttribute('aria-expanded','true');
    document.body.style.overflow = 'hidden';
    // focus vào close btn để keyboard users dễ đóng
    setTimeout(()=> { try { giftClose && giftClose.focus(); } catch(e){} }, 50);
  }

  function closeGift(){
    giftPopup.setAttribute('aria-hidden','true');
    giftBtn.setAttribute('aria-expanded','false');
    document.body.style.overflow = '';
    try { giftBtn.focus(); } catch(e){}
  }

  giftBtn.addEventListener('click', (e) => {
    e.preventDefault();
    // mở popup; random effect nhỏ (scale)
    openGift();
  });

  // close handlers
  giftClose && giftClose.addEventListener('click', closeGift);
  giftCloseBtn && giftCloseBtn.addEventListener('click', closeGift);

  // click outside panel để đóng
  giftPopup.addEventListener('click', (e) => {
    if(e.target === giftPopup) closeGift();
  });

  // ESC để đóng
  document.addEventListener('keydown', (e) => {
    if(giftPopup.getAttribute('aria-hidden') === 'false' && e.key === 'Escape') closeGift();
  });


})();

/* ===== Global hearts glyph overlay (uses ❤) ===== */
(function initGlyphHearts(){
  // create overlay container once
  let overlay = document.querySelector('.hearts-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.className = 'hearts-overlay';
    document.body.appendChild(overlay);
  }

  const MAX_HEARTS = 60;
  const SPAWN_INTERVAL = 900; // ms between auto spawns
  const MOBILE_DISABLE_WIDTH = 420; // disable auto under this width

  const rnd = (min, max) => Math.random() * (max - min) + min;

  function makeGlyphHeartAt(clientX, clientY) {
    const h = document.createElement('div');
    h.className = 'glyph-heart';
    // choose size class
    const r = Math.random();
    if (r < 0.35) h.classList.add('small');
    else if (r < 0.8) h.classList.add('med');
    else h.classList.add('large');

    // glyph content
    h.textContent = '❤';

    // drift horizontal and small rotate
    const drift = (Math.random() * 160 - 80).toFixed(1) + 'px';
    const rot = (Math.random() * 18 - 9).toFixed(1) + 'deg';
    h.style.setProperty('--drift', drift);
    h.style.setProperty('--rot', rot);

    // clamp position inside viewport
    const left = Math.max(8, Math.min(window.innerWidth - 28, clientX));
    const top  = Math.max(8, Math.min(window.innerHeight - 28, clientY));

    h.style.left = left + 'px';
    h.style.top  = top  + 'px';

    // random duration + delay
    const dur = (rnd(1.4, 2.6)).toFixed(2) + 's';
    const delay = (rnd(0, 0.18)).toFixed(2) + 's';
    h.style.animation = `glyphHeartFloat ${dur} linear ${delay} forwards`;

    overlay.appendChild(h);

    // cleanup later
    const life = (parseFloat(dur) + parseFloat(delay)) * 1000 + 400;
    setTimeout(() => h.remove(), life);

    // cap number of hearts
    const existing = overlay.querySelectorAll('.glyph-heart');
    if (existing.length > MAX_HEARTS) {
      existing[0] && existing[0].remove();
    }
  }

  // auto spawn lower-center area
  let autoTimer = null;
  function startAuto(){
    if(window.innerWidth <= MOBILE_DISABLE_WIDTH) return;
    if(autoTimer) return;
    autoTimer = setInterval(() => {
      const cx = window.innerWidth * (0.25 + Math.random()*0.5);
      const cy = window.innerHeight * (0.65 + Math.random()*0.25);
      makeGlyphHeartAt(cx, cy);
    }, SPAWN_INTERVAL);
  }
  function stopAuto(){ if(autoTimer){ clearInterval(autoTimer); autoTimer = null; } }

  // initial start
  startAuto();

  // burst on click/tap anywhere (nice interactive touch)
  document.addEventListener('click', (e) => {
    const cx = e.clientX;
    const cy = e.clientY;
    for(let i=0;i<5;i++){
      setTimeout(()=> {
        const dx = cx + rnd(-28,28);
        const dy = cy + rnd(-20,20);
        makeGlyphHeartAt(dx, dy);
      }, i * 45);
    }
  }, {passive:true});

  // responsive: stop auto on small widths, pause when page hidden
  window.addEventListener('resize', () => {
    if(window.innerWidth <= MOBILE_DISABLE_WIDTH) stopAuto();
    else startAuto();
  });
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'hidden') stopAuto();
    else startAuto();
  });
})();



}); // DOMContentLoaded end
