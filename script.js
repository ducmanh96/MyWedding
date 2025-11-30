// script.js — cleaned & modular
document.addEventListener('DOMContentLoaded', () => {
  /* ===== CONFIG ===== */
  const playlist = [
    'assets/Beautiful In White.mp3',
    'assets/Lễ Đường.mp3',
    'assets/Ngày Đầu Tiên.mp3'
  ];
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

  /* ===== helpers ===== */
  const setAllowed = v => { try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch(e){} };
//   const getAllowed = () => { try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch(e){ return false; } };
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

  /* ===== playlist: auto-next ===== */
  if(bgAudio){
    bgAudio.addEventListener('ended', () => {
      currentTrack = (currentTrack + 1) % playlist.length;
      loadTrack(currentTrack);
      tryPlayUnmuted().catch(()=>{});
    });
  }

  /* ===== overlay show/hide ===== */
  function showOverlay(){ if(tapOverlay){ tapOverlay.style.display = 'flex'; tapOverlay.setAttribute('aria-hidden','false'); } }
  function hideOverlay(){ if(tapOverlay){ tapOverlay.style.display = 'none'; tapOverlay.setAttribute('aria-hidden','true'); } }

  /* ===== autoplay strategy ===== */
  loadTrack(currentTrack);
  (async function autoPlayFlow(){
    let ok = await tryPlayUnmuted();
    if(ok){ setAllowed(true); return; }
    ok = await tryPlayMutedFallback();
    if(ok){ showOverlay(); return; }
    showOverlay();
  })();

  /* ===== user gesture handlers ===== */
  async function onUserGesture(){
    userInteracted = true; setAllowed(true); hideOverlay();
    if(!bgAudio.src) loadTrack(currentTrack);
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

  /* ===== music toggle button ===== */
  if(musicToggle){
    musicToggle.addEventListener('click', async (e) => {
      e.preventDefault();
      userInteracted = true;
      if(playing){ pauseAudio(); }
      else {
        if(!bgAudio.src) loadTrack(currentTrack);
        bgAudio.muted = false; bgAudio.volume = defaultVolume;
        const ok = await tryPlayUnmuted();
        if(!ok) showOverlay(); else setAllowed(true);
      }
    });
  }

  /* ===== smooth scroll for Invite button ===== */
  (function setupInvite(){
    const inviteBtn = document.getElementById('inviteBtn');
    const target = document.getElementById('invite');
    if(!inviteBtn || !target) return;
    inviteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      inviteBtn.classList.add('clicked');
      setTimeout(()=> inviteBtn.classList.remove('clicked'), 350);
      target.scrollIntoView({behavior:'smooth', block:'start'});
      target.setAttribute('tabindex','-1');
      target.focus({preventScroll:true});
      setTimeout(()=> target.removeAttribute('tabindex'), 1200);
    });
  })();

  /* ===== simple slider & reveal ===== */
  // Reveal via IntersectionObserver
  const reveals = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window && reveals.length){
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if(entry.isIntersecting){ entry.target.classList.add('show'); io.unobserve(entry.target); } });
    }, {threshold: 0.12});
    reveals.forEach(r => io.observe(r));
  } else { reveals.forEach(r => r.classList.add('show')); }

  
  /* ===== optional: music-toggle scroll motion (subtle) ===== */
  (function musicScrollMotion(){
    const el = document.getElementById('musicToggle');
    if(!el) return;
    const maxMove = 20;
    const ease = 0.12;
    let target = 0, current = 0, rafId = null;
    function computePct(){
      const docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      const viewH = window.innerHeight || document.documentElement.clientHeight;
      const scrollable = Math.max(1, docH - viewH);
      const y = window.scrollY || window.pageYOffset || 0;
      return Math.max(0, Math.min(1, y / scrollable));
    }
    function updateTarget(){
      const pct = computePct();
      const mapped = (pct - 0.5) * 2;
      target = Math.max(-maxMove, Math.min(maxMove, mapped * (maxMove * 0.6)));
    }
    function lerp(a,b,t){ return a + (b-a)*t; }
    function loop(){
      current = lerp(current, target, ease);
      el.style.setProperty('--music-translate', `${current.toFixed(2)}px`);
      if(Math.abs(current - target) > 0.1) rafId = requestAnimationFrame(loop); else rafId = null;
    }
    window.addEventListener('scroll', () => { updateTarget(); if(!rafId) rafId = requestAnimationFrame(loop); }, {passive:true});
    updateTarget(); rafId = requestAnimationFrame(loop);
  })();


  // ===== Countdown to wedding (Asia/Bangkok timezone) =====
(function initWeddingCountdown(){
  // target: 2025-12-29 10:00 Asia/Bangkok (UTC+07:00)
  // Use ISO with offset to avoid timezone ambiguity:
  const targetISO = '2025-12-29T10:00:00+07:00';
  const target = new Date(targetISO).getTime();
  if (isNaN(target)) return; // safety

  const elDays = document.getElementById('cd-days');
  const elHours = document.getElementById('cd-hours');
  const elMins = document.getElementById('cd-mins');
  const elSecs = document.getElementById('cd-secs');
  const elNote = document.getElementById('cd-note');

  function pad(n){ return String(n).padStart(2,'0'); }

  function update(){
    const now = Date.now();
    let diff = Math.floor((target - now) / 1000); // seconds
    if (diff <= 0){
      // reached
      if (elDays) elDays.textContent = '0';
      if (elHours) elHours.textContent = '00';
      if (elMins) elMins.textContent = '00';
      if (elSecs) elSecs.textContent = '00';
      if (elNote){
        elNote.style.display = 'block';
        elNote.textContent = 'Ngày trọng đại đã tới — Hẹn gặp bạn ở ngày vui 🎉';
        elNote.setAttribute('aria-hidden','false');
      }
      clearInterval(timerId);
      return;
    }
    const days = Math.floor(diff / 86400);
    diff -= days * 86400;
    const hours = Math.floor(diff / 3600);
    diff -= hours * 3600;
    const mins = Math.floor(diff / 60);
    const secs = diff - mins * 60;

    if (elDays) elDays.textContent = String(days);
    if (elHours) elHours.textContent = pad(hours);
    if (elMins) elMins.textContent = pad(mins);
    if (elSecs) elSecs.textContent = pad(secs);
  }

  update(); // initial render
  const timerId = setInterval(update, 1000);
})();



// ===== Fixed Album (3 rows × 3 columns, random images) =====
const folder = "assets/album/";
const totalImages = 9;              // số ảnh bạn có trong thư mục
const showCount = 9;                 // 3 hàng × 3 ảnh = 9 ảnh
const container = document.getElementById("fixedAlbumGrid");

if(container){
  // Tạo danh sách ảnh
  const images = [];
  for (let i = 1; i <= totalImages; i++) {
    images.push(`${folder}${i}.jpg`);
  }

  // Random
  const shuffled = images.sort(() => Math.random() - 0.5);

  // Chọn 9 ảnh đầu tiên
  const selected = shuffled.slice(0, showCount);

  // Gắn vào HTML
  selected.forEach(src => {
    const img = document.createElement("img");
    img.src = src;
    img.loading = "lazy";
    container.appendChild(img);
  });
}
// ===== Auto-rotate album: fade out -> replace -> fade in =====
(function albumAutoRotate(){
  const container = document.getElementById('fixedAlbumGrid');
  if(!container) return;

  const folder = "assets/album/";
  const totalImages = 9;   // bạn đã set = số ảnh thực tế trong folder
  const showCount = 9;     // giữ 9 ảnh hiển thị
  const rotateMs = 10000;  // thay đổi mỗi 10s (tùy bạn)
  let rotateTimer = null;
  let isPaused = false;

  // build pool of filenames
  const pool = [];
  for(let i=1;i<=totalImages;i++) pool.push(`${folder}${i}.jpg`);

  // helper: pick N random distinct items from pool
  function pickRandom(n){
    const copy = pool.slice();
    for(let i = copy.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  }

  // preload images returns Promise that resolves when all loaded
  function preload(srcList){
    return Promise.all(srcList.map(src => new Promise((res) => {
      const img = new Image();
      img.onload = () => res({src, ok:true});
      img.onerror = () => res({src, ok:false});
      img.src = src;
    })));
  }

  // replace images in DOM with animation
  async function rotateOnce(){
    if(isPaused) return;
    const next = pickRandom(showCount);
    // preload
    const results = await preload(next);
    const valid = results.filter(r=>r.ok).map(r=>r.src);

    // if none valid, skip
    if(valid.length === 0) return;

    // fade out
    container.classList.add('fading');

    // wait for fade duration
    await new Promise(r => setTimeout(r, 600));

    // clear and append new imgs
    container.innerHTML = '';
    valid.forEach(src => {
      const img = document.createElement('img');
      img.src = src;
      img.loading = 'lazy';
      img.width = 360; img.height = 240;
      img.style.width = '360px'; img.style.height = '240px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '12px';
      container.appendChild(img);
    });

    // fade in
    requestAnimationFrame(() => {
      container.classList.remove('fading');
    });
  }

  // start interval
  function start(){
    if(rotateTimer) clearInterval(rotateTimer);
    rotateTimer = setInterval(() => { rotateOnce().catch(()=>{}); }, rotateMs);
  }

  // pause on hover (optional)
  container.addEventListener('mouseenter', () => { isPaused = true; });
  container.addEventListener('mouseleave', () => { isPaused = false; });

  // initial kick (delay small to allow initial layout)
  setTimeout(() => {
    rotateOnce().catch(()=>{});
    start();
  }, 1200);

})();


});
