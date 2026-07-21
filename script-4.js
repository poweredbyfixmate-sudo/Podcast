/* =========================================================
   UNKNOWN FILES — Podcast Studio Lite
   Vanilla JS. No frameworks. Everything lives in LocalStorage.
   ========================================================= */

(() => {
  'use strict';

  /* ---------------------------------------------------------
     STORAGE LAYER
     Kept behind a small "DB" object so a Firebase / backend
     API could be swapped in later without touching the UI code.
     --------------------------------------------------------- */
  const DB_KEY = 'uf_episodes_v1';
  const FAV_KEY = 'uf_favorites_v1';
  const THEME_KEY = 'uf_theme_v1';
  const DRAFT_KEY = 'uf_draft_inprogress_v1';

  const DB = {
    all() {
      try { return JSON.parse(localStorage.getItem(DB_KEY)) || []; }
      catch (e) { return []; }
    },
    save(list) {
      try {
        localStorage.setItem(DB_KEY, JSON.stringify(list));
        return true;
      } catch (e) {
        toast('Storage is full — try a smaller audio/cover file.', 'error');
        return false;
      }
    },
    get(id) { return DB.all().find(e => e.id === id); },
    upsert(episode) {
      const list = DB.all();
      const idx = list.findIndex(e => e.id === episode.id);
      if (idx > -1) list[idx] = episode; else list.unshift(episode);
      DB.save(list);
      return episode;
    },
    remove(id) {
      DB.save(DB.all().filter(e => e.id !== id));
    }
  };

  const Favorites = {
    all() { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch (e) { return []; } },
    has(id) { return Favorites.all().includes(id); },
    toggle(id) {
      let list = Favorites.all();
      if (list.includes(id)) list = list.filter(x => x !== id);
      else list.push(id);
      localStorage.setItem(FAV_KEY, JSON.stringify(list));
      return list.includes(id);
    }
  };

  const uid = () => 'ep_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------------------------------------------------------
     TOAST
     --------------------------------------------------------- */
  let toastTimer;
  function toast(msg, kind = 'ok') {
    const el = document.getElementById('toast');
    el.innerHTML = `<i class="fa-solid ${kind === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> ${msg}`;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------------------------------------------------------
     THEME
     --------------------------------------------------------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    const isLight = theme === 'light';
    document.querySelectorAll('#themeToggle i, #themeToggleDesktop i, #tabThemeToggle i').forEach(i => {
      i.className = 'fa-solid ' + (isLight ? 'fa-moon' : 'fa-sun');
    });
    const label = document.querySelector('#themeToggleDesktop span');
    if (label) label.textContent = isLight ? 'Dark mode' : 'Light mode';
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(cur);
  }
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

  /* ---------------------------------------------------------
     ROUTING (hash based, single page shell)
     --------------------------------------------------------- */
  const routes = ['dashboard', 'create', 'library', 'favorites', 'player'];
  let currentEpisodeId = null;

  function navigate(route, opts = {}) {
    if (!routes.includes(route)) route = 'dashboard';
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + route).classList.add('active');

    document.querySelectorAll('[data-route]').forEach(el => {
      el.classList.toggle('active', el.dataset.route === route);
    });

    closeSidenav();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

    if (route === 'dashboard') renderDashboard();
    if (route === 'library') renderLibrary();
    if (route === 'favorites') renderFavorites();
    if (route === 'create' && !opts.editing) resetForm();
    if (route === 'player' && opts.episodeId) loadPlayer(opts.episodeId);
  }

  window.addEventListener('hashchange', () => {
    const route = location.hash.replace('#', '') || 'dashboard';
    navigate(route);
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-route]');
    if (link && link.tagName !== 'BUTTON' && !link.dataset.editing) {
      // let hashchange handle standard nav links
    }
  });

  /* ---------------------------------------------------------
     SIDENAV / MOBILE MENU
     --------------------------------------------------------- */
  const sidenav = document.getElementById('sidenav');
  const navBackdrop = document.getElementById('navBackdrop');
  function openSidenav() { sidenav.classList.add('open'); navBackdrop.classList.add('show'); }
  function closeSidenav() { sidenav.classList.remove('open'); navBackdrop.classList.remove('show'); }
  document.getElementById('menuToggle').addEventListener('click', openSidenav);
  navBackdrop.addEventListener('click', closeSidenav);

  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('themeToggleDesktop').addEventListener('click', toggleTheme);
  document.getElementById('tabThemeToggle').addEventListener('click', toggleTheme);

  /* ---------------------------------------------------------
     UTILS
     --------------------------------------------------------- */
  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  function escapeHTML(str = '') {
    return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
  const PLACEHOLDER_COVER = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
      <rect width="400" height="400" fill="#181818"/>
      <text x="50%" y="50%" font-family="monospace" font-size="20" fill="#e50914" text-anchor="middle" dy=".3em">UNKNOWN FILE</text>
    </svg>`);

  /* ---------------------------------------------------------
     DASHBOARD
     --------------------------------------------------------- */
  function renderDashboard() {
    const list = DB.all();
    document.getElementById('statTotal').textContent = list.length;
    document.getElementById('statPublished').textContent = list.filter(e => e.status === 'published').length;
    document.getElementById('statDrafts').textContent = list.filter(e => e.status === 'draft').length;
    const totalSec = list.reduce((acc, e) => acc + (e.durationSec || 0), 0);
    document.getElementById('statDuration').textContent = Math.round(totalSec / 60) + 'm';

    const recent = [...list].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
    document.getElementById('recentEpisodes').innerHTML = recent.map(cardTemplate).join('');
    document.getElementById('dashboardEmpty').hidden = list.length > 0;
    document.getElementById('recentEpisodes').hidden = list.length === 0;
    bindCardActions(document.getElementById('recentEpisodes'));
  }

  document.getElementById('dashboardSearch').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const list = DB.all().filter(ep =>
      ep.title.toLowerCase().includes(q) ||
      ep.number.toLowerCase().includes(q) ||
      (ep.tags || []).some(t => t.toLowerCase().includes(q))
    );
    document.getElementById('recentEpisodes').innerHTML = list.slice(0, 12).map(cardTemplate).join('');
    document.getElementById('dashboardEmpty').hidden = list.length > 0 || q === '';
    bindCardActions(document.getElementById('recentEpisodes'));
  });

  /* ---------------------------------------------------------
     CARD TEMPLATE (shared by dashboard / library / favorites / related)
     --------------------------------------------------------- */
  function cardTemplate(ep) {
    const fav = Favorites.has(ep.id);
    return `
    <article class="ep-card" data-id="${ep.id}">
      <div class="ep-cover-wrap">
        <img src="${ep.cover || PLACEHOLDER_COVER}" alt="${escapeHTML(ep.title)} cover art" loading="lazy">
        <span class="ep-case-stamp">${escapeHTML(ep.number)}</span>
        <span class="ep-status-dot ${ep.status}"></span>
        <div class="ep-play-overlay"><button class="act-play" aria-label="Play"><i class="fa-solid fa-play"></i></button></div>
      </div>
      <div class="ep-body">
        <div class="ep-cat">${escapeHTML(ep.category)}</div>
        <div class="ep-title">${escapeHTML(ep.title)}</div>
        <div class="ep-meta-row"><span>${ep.duration || '--:--'}</span><span>${fmtDate(ep.publishDate || ep.createdAt)}</span></div>
        <div class="ep-actions">
          <button class="act-play" title="Play"><i class="fa-solid fa-play"></i></button>
          <button class="act-edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="act-fav ${fav ? 'is-fav' : ''}" title="Favorite"><i class="fa-${fav ? 'solid' : 'regular'} fa-bookmark"></i></button>
          <button class="act-share" title="Share"><i class="fa-solid fa-share-nodes"></i></button>
          <button class="act-delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </article>`;
  }

  function bindCardActions(container) {
    container.querySelectorAll('.ep-card').forEach(card => {
      const id = card.dataset.id;
      card.querySelectorAll('.act-play').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); goToPlayer(id); }));
      const editBtn = card.querySelector('.act-edit');
      if (editBtn) editBtn.addEventListener('click', (e) => { e.stopPropagation(); editEpisode(id); });
      const favBtn = card.querySelector('.act-fav');
      if (favBtn) favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isFav = Favorites.toggle(id);
        toast(isFav ? 'Added to favorites' : 'Removed from favorites');
        favBtn.classList.toggle('is-fav', isFav);
        favBtn.querySelector('i').className = `fa-${isFav ? 'solid' : 'regular'} fa-bookmark`;
        if (location.hash === '#favorites') renderFavorites();
      });
      const shareBtn = card.querySelector('.act-share');
      if (shareBtn) shareBtn.addEventListener('click', (e) => { e.stopPropagation(); openShareModal(id); });
      const delBtn = card.querySelector('.act-delete');
      if (delBtn) delBtn.addEventListener('click', (e) => { e.stopPropagation(); confirmDelete(id); });
      card.addEventListener('click', () => goToPlayer(id));
    });
  }

  function goToPlayer(id) { location.hash = '#player'; navigate('player', { episodeId: id }); }
  function editEpisode(id) { location.hash = '#create'; navigate('create', { editing: true }); fillForm(DB.get(id)); }

  /* ---------------------------------------------------------
     LIBRARY
     --------------------------------------------------------- */
  let activeCategory = 'all';
  function renderLibrary() {
    const q = document.getElementById('librarySearch').value.trim().toLowerCase();
    let list = DB.all();
    if (activeCategory !== 'all') list = list.filter(e => e.category === activeCategory);
    if (q) list = list.filter(ep =>
      ep.title.toLowerCase().includes(q) ||
      ep.number.toLowerCase().includes(q) ||
      (ep.tags || []).some(t => t.toLowerCase().includes(q))
    );
    list.sort((a, b) => b.createdAt - a.createdAt);
    const grid = document.getElementById('libraryGrid');
    grid.innerHTML = list.map(cardTemplate).join('');
    document.getElementById('libraryEmpty').hidden = list.length > 0;
    bindCardActions(grid);
  }
  document.getElementById('librarySearch').addEventListener('input', renderLibrary);
  document.getElementById('categoryFilters').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('#categoryFilters .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeCategory = chip.dataset.cat;
    renderLibrary();
  });

  /* ---------------------------------------------------------
     FAVORITES
     --------------------------------------------------------- */
  function renderFavorites() {
    const favIds = Favorites.all();
    const list = DB.all().filter(e => favIds.includes(e.id));
    const grid = document.getElementById('favoritesGrid');
    grid.innerHTML = list.map(cardTemplate).join('');
    document.getElementById('favoritesEmpty').hidden = list.length > 0;
    bindCardActions(grid);
  }

  /* ---------------------------------------------------------
     DELETE CONFIRM
     --------------------------------------------------------- */
  let pendingDeleteId = null;
  function confirmDelete(id) {
    pendingDeleteId = id;
    document.getElementById('confirmBackdrop').hidden = false;
  }
  document.getElementById('confirmCancel').addEventListener('click', () => { document.getElementById('confirmBackdrop').hidden = true; });
  document.getElementById('confirmDelete').addEventListener('click', () => {
    if (pendingDeleteId) {
      DB.remove(pendingDeleteId);
      toast('Case file deleted');
      pendingDeleteId = null;
    }
    document.getElementById('confirmBackdrop').hidden = true;
    renderDashboard(); renderLibrary(); renderFavorites();
  });

  /* ---------------------------------------------------------
     CREATE / EDIT FORM
     --------------------------------------------------------- */
  const form = document.getElementById('episodeForm');
  const els = {
    id: document.getElementById('episodeId'),
    number: document.getElementById('episodeNumber'),
    title: document.getElementById('episodeTitle'),
    category: document.getElementById('episodeCategory'),
    duration: document.getElementById('episodeDuration'),
    tags: document.getElementById('episodeTags'),
    description: document.getElementById('episodeDescription'),
    transcript: document.getElementById('episodeTranscript'),
  };
  let coverData = null;
  let audioData = null;
  let durationSec = 0;
  let currentStatus = 'draft';

  function resetForm() {
    form.reset();
    els.id.value = '';
    coverData = null; audioData = null; durationSec = 0; currentStatus = 'draft';
    document.getElementById('coverPreview').hidden = true;
    document.getElementById('coverPreview').src = '';
    document.getElementById('coverEmpty').hidden = false;
    document.getElementById('audioFilled').hidden = true;
    document.getElementById('audioEmpty').hidden = false;
    document.querySelectorAll('.status-pill').forEach(p => p.classList.toggle('active', p.dataset.status === 'draft'));
    document.getElementById('createHeading').innerHTML = '<i class="fa-solid fa-file-circle-plus"></i> Open new case file';
    localStorage.removeItem(DRAFT_KEY);
    els.duration.value = '';
  }

  function fillForm(ep) {
    if (!ep) return;
    els.id.value = ep.id;
    els.number.value = ep.number;
    els.title.value = ep.title;
    els.category.value = ep.category;
    els.tags.value = (ep.tags || []).join(', ');
    els.description.value = ep.description || '';
    els.transcript.value = ep.transcript || '';
    els.duration.value = ep.duration || '';
    durationSec = ep.durationSec || 0;
    coverData = ep.cover || null;
    audioData = ep.audio || null;
    currentStatus = ep.status || 'draft';

    if (coverData) {
      document.getElementById('coverPreview').src = coverData;
      document.getElementById('coverPreview').hidden = false;
      document.getElementById('coverEmpty').hidden = true;
    }
    if (audioData) {
      document.getElementById('audioFilled').hidden = false;
      document.getElementById('audioEmpty').hidden = true;
      document.getElementById('audioFileName').textContent = ep.audioName || 'Uploaded audio';
      document.getElementById('audioFileDuration').textContent = ep.duration || '';
    }
    document.querySelectorAll('.status-pill').forEach(p => p.classList.toggle('active', p.dataset.status === currentStatus));
    document.getElementById('createHeading').innerHTML = '<i class="fa-solid fa-pen"></i> Editing ' + escapeHTML(ep.number);
  }

  // cover upload
  document.getElementById('coverInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    coverData = await fileToDataURL(file);
    document.getElementById('coverPreview').src = coverData;
    document.getElementById('coverPreview').hidden = false;
    document.getElementById('coverEmpty').hidden = true;
    autosaveDraft();
  });

  // audio upload + duration detection
  document.getElementById('audioInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    audioData = await fileToDataURL(file);
    document.getElementById('audioFilled').hidden = false;
    document.getElementById('audioEmpty').hidden = true;
    document.getElementById('audioFileName').textContent = file.name;
    document.getElementById('audioFileDuration').textContent = 'Detecting duration…';

    const probe = document.getElementById('audioProbe');
    probe.src = audioData;
    probe.onloadedmetadata = () => {
      durationSec = probe.duration || 0;
      els.duration.value = fmtTime(durationSec);
      document.getElementById('audioFileDuration').textContent = fmtTime(durationSec) + ' runtime';
      autosaveDraft();
    };
  });

  document.getElementById('statusPillRow').addEventListener('click', (e) => {
    const pill = e.target.closest('.status-pill');
    if (!pill) return;
    currentStatus = pill.dataset.status;
    document.querySelectorAll('.status-pill').forEach(p => p.classList.toggle('active', p === pill));
  });

  function buildEpisodeFromForm(status) {
    const tags = els.tags.value.split(',').map(t => t.trim()).filter(Boolean);
    const existing = els.id.value ? DB.get(els.id.value) : null;
    return {
      id: els.id.value || uid(),
      number: els.number.value.trim() || 'EP-000',
      title: els.title.value.trim() || 'Untitled episode',
      category: els.category.value,
      cover: coverData,
      audio: audioData,
      audioName: existing?.audioName || (document.getElementById('audioFileName').textContent !== '—' ? document.getElementById('audioFileName').textContent : ''),
      duration: els.duration.value || fmtTime(durationSec),
      durationSec,
      description: els.description.value.trim(),
      transcript: els.transcript.value.trim(),
      tags,
      status,
      publishDate: status === 'published' ? (existing?.publishDate || new Date().toISOString()) : (existing?.publishDate || null),
      createdAt: existing?.createdAt || Date.now(),
    };
  }

  let autosaveT;
  function autosaveDraft() {
    clearTimeout(autosaveT);
    const note = document.getElementById('autosaveNote');
    note.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
    autosaveT = setTimeout(() => {
      if (!els.title.value.trim() && !els.number.value.trim()) return;
      const ep = buildEpisodeFromForm(currentStatus === 'published' ? 'published' : 'draft');
      DB.upsert(ep);
      els.id.value = ep.id;
      note.innerHTML = '<i class="fa-solid fa-check"></i> All changes saved';
    }, 600);
  }
  form.addEventListener('input', autosaveDraft);

  document.getElementById('saveDraftBtn').addEventListener('click', () => {
    const ep = buildEpisodeFromForm('draft');
    DB.upsert(ep);
    els.id.value = ep.id;
    toast('Draft saved to archive');
    renderDashboard();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!els.title.value.trim() || !els.number.value.trim()) {
      toast('Episode number and title are required', 'error');
      return;
    }
    const ep = buildEpisodeFromForm('published');
    DB.upsert(ep);
    toast('Episode published to the archive');
    resetForm();
    location.hash = '#library';
    navigate('library');
  });

  /* ---------------------------------------------------------
     PLAYER
     --------------------------------------------------------- */
  const audioEl = document.getElementById('mainAudio');
  const seekBar = document.getElementById('seekBar');
  const playPauseBtn = document.getElementById('playPause');
  const miniPlayer = document.getElementById('miniPlayer');
  const miniPlayPause = document.getElementById('miniPlayPause');

  function loadPlayer(id) {
    const ep = DB.get(id);
    if (!ep) { toast('Episode not found', 'error'); location.hash = '#library'; return; }
    currentEpisodeId = id;

    document.getElementById('playerCover').src = ep.cover || PLACEHOLDER_COVER;
    document.getElementById('playerCase').textContent = ep.number;
    document.getElementById('playerTitle').textContent = ep.title;
    document.getElementById('playerCategory').textContent = ep.category;
    document.getElementById('playerDate').textContent = fmtDate(ep.publishDate || ep.createdAt);
    document.getElementById('playerDescription').textContent = ep.description || 'No description provided.';
    document.getElementById('playerTranscript').textContent = ep.transcript || 'No transcript provided.';
    document.getElementById('playerTags').innerHTML = (ep.tags || []).map(t => `<span>#${escapeHTML(t)}</span>`).join('') || '<span>No tags</span>';

    const favBtn = document.getElementById('favBtn');
    const isFav = Favorites.has(ep.id);
    favBtn.querySelector('i').className = `fa-${isFav ? 'solid' : 'regular'} fa-bookmark`;

    audioEl.src = ep.audio || '';
    audioEl.playbackRate = 1;
    document.querySelectorAll('.speed-options button').forEach(b => b.classList.toggle('active', b.dataset.speed === '1'));
    playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';

    document.getElementById('miniCover').src = ep.cover || PLACEHOLDER_COVER;
    document.getElementById('miniTitle').textContent = ep.title;
    document.getElementById('miniSub').textContent = ep.number;
    miniPlayer.hidden = !ep.audio;

    // related episodes: same category, excluding current
    const related = DB.all().filter(e => e.category === ep.category && e.id !== ep.id).slice(0, 8);
    document.getElementById('relatedEpisodes').innerHTML = related.map(cardTemplate).join('');
    bindCardActions(document.getElementById('relatedEpisodes'));

    document.querySelectorAll('.ptab').forEach((t, i) => t.classList.toggle('active', i === 0));
    document.querySelectorAll('.ptab-panel').forEach((p, i) => p.hidden = i !== 0);
  }

  document.getElementById('playerBack').addEventListener('click', () => history.back());

  audioEl.addEventListener('loadedmetadata', () => {
    seekBar.max = audioEl.duration || 0;
    document.getElementById('totalTime').textContent = fmtTime(audioEl.duration);
  });
  audioEl.addEventListener('timeupdate', () => {
    seekBar.value = audioEl.currentTime;
    document.getElementById('curTime').textContent = fmtTime(audioEl.currentTime);
  });
  audioEl.addEventListener('play', () => {
    playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    miniPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
  });
  audioEl.addEventListener('pause', () => {
    playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    miniPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
  });
  audioEl.addEventListener('ended', () => { playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; });

  function togglePlay() {
    if (!audioEl.src) { toast('No audio uploaded for this episode', 'error'); return; }
    if (audioEl.paused) audioEl.play(); else audioEl.pause();
  }
  playPauseBtn.addEventListener('click', togglePlay);
  miniPlayPause.addEventListener('click', togglePlay);
  document.getElementById('miniExpand').addEventListener('click', () => goToPlayer(currentEpisodeId));

  seekBar.addEventListener('input', () => { audioEl.currentTime = seekBar.value; });
  document.getElementById('skipBack').addEventListener('click', () => { audioEl.currentTime = Math.max(0, audioEl.currentTime - 10); });
  document.getElementById('skipFwd').addEventListener('click', () => { audioEl.currentTime = Math.min(audioEl.duration || 0, audioEl.currentTime + 10); });

  document.getElementById('speedOptions').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    audioEl.playbackRate = parseFloat(btn.dataset.speed);
    document.querySelectorAll('.speed-options button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  document.getElementById('volumeBar').addEventListener('input', (e) => { audioEl.volume = parseFloat(e.target.value); });

  document.getElementById('favBtn').addEventListener('click', () => {
    if (!currentEpisodeId) return;
    const isFav = Favorites.toggle(currentEpisodeId);
    document.getElementById('favBtn').querySelector('i').className = `fa-${isFav ? 'solid' : 'regular'} fa-bookmark`;
    toast(isFav ? 'Added to favorites' : 'Removed from favorites');
  });

  document.getElementById('downloadBtn').addEventListener('click', () => {
    const ep = DB.get(currentEpisodeId);
    if (!ep || !ep.audio) { toast('No audio file to download', 'error'); return; }
    const a = document.createElement('a');
    a.href = ep.audio;
    a.download = `${ep.number}-${ep.title}`.replace(/[^a-z0-9-_]+/gi, '_') + '.mp3';
    a.click();
  });

  document.querySelectorAll('.ptab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.ptab-panel').forEach(p => p.hidden = true);
      document.getElementById('panel-' + tab.dataset.tab).hidden = false;
    });
  });

  /* ---------------------------------------------------------
     SHARE + QR MODAL
     --------------------------------------------------------- */
  const modalBackdrop = document.getElementById('modalBackdrop');
  document.getElementById('modalClose').addEventListener('click', () => modalBackdrop.hidden = true);
  modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) modalBackdrop.hidden = true; });

  function shareUrlFor(ep) {
    // Deep-linkable reference within this single-page app.
    return `${location.origin}${location.pathname}#player?ep=${encodeURIComponent(ep.id)}`;
  }

  function openShareModal(id) {
    const ep = DB.get(id);
    if (!ep) return;
    const url = shareUrlFor(ep);
    document.getElementById('modalTitle').innerHTML = '<i class="fa-solid fa-share-nodes"></i> Share episode';
    document.getElementById('modalBody').innerHTML = `
      <div class="share-link-row">
        <input type="text" readonly value="${escapeHTML(url)}" id="shareUrlInput">
        <button class="btn btn-ghost" id="copyLinkBtn"><i class="fa-solid fa-copy"></i></button>
      </div>
      <div class="share-social">
        <a href="https://wa.me/?text=${encodeURIComponent(ep.title + ' — ' + url)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i>WhatsApp</a>
        <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(ep.title)}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener"><i class="fa-brands fa-x-twitter"></i>X</a>
        <a href="mailto:?subject=${encodeURIComponent(ep.title)}&body=${encodeURIComponent(url)}"><i class="fa-solid fa-envelope"></i>Email</a>
        <a href="#" id="nativeShareBtn"><i class="fa-solid fa-arrow-up-from-bracket"></i>More</a>
      </div>`;
    modalBackdrop.hidden = false;
    document.getElementById('copyLinkBtn').addEventListener('click', () => {
      navigator.clipboard?.writeText(url).then(() => toast('Link copied')).catch(() => toast('Could not copy link', 'error'));
    });
    document.getElementById('nativeShareBtn').addEventListener('click', (e) => {
      e.preventDefault();
      if (navigator.share) navigator.share({ title: ep.title, url }).catch(() => {});
      else toast('Native share not supported on this browser', 'error');
    });
  }

  document.getElementById('shareBtn').addEventListener('click', () => openShareModal(currentEpisodeId));

  document.getElementById('qrBtn').addEventListener('click', () => {
    const ep = DB.get(currentEpisodeId);
    if (!ep) return;
    const url = shareUrlFor(ep);
    const qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;
    document.getElementById('modalTitle').innerHTML = '<i class="fa-solid fa-qrcode"></i> QR code';
    document.getElementById('modalBody').innerHTML = `
      <div id="qrCanvasWrap"><img src="${qrImgSrc}" width="200" height="200" alt="QR code linking to ${escapeHTML(ep.title)}"></div>
      <p style="text-align:center;font-size:.75rem;">Scan to open <strong>${escapeHTML(ep.number)}</strong> on another device. Requires an internet connection to generate.</p>`;
    modalBackdrop.hidden = false;
  });

  /* ---------------------------------------------------------
     EXPORT / IMPORT
     --------------------------------------------------------- */
  document.getElementById('exportBtn').addEventListener('click', () => {
    const data = { episodes: DB.all(), favorites: Favorites.all(), exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `unknown-files-export-${Date.now()}.json`;
    a.click();
    toast('Archive exported as JSON');
  });

  document.getElementById('importInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const incoming = Array.isArray(data) ? data : (data.episodes || []);
      if (!Array.isArray(incoming)) throw new Error('bad format');
      const existing = DB.all();
      const existingIds = new Set(existing.map(e => e.id));
      const merged = existing.concat(incoming.filter(e => e && e.id && !existingIds.has(e.id)));
      DB.save(merged);
      if (data.favorites) localStorage.setItem(FAV_KEY, JSON.stringify(data.favorites));
      toast(`Imported ${incoming.length} episode(s)`);
      renderDashboard(); renderLibrary(); renderFavorites();
    } catch (err) {
      toast('Import failed — file is not a valid export', 'error');
    }
    e.target.value = '';
  });

  /* ---------------------------------------------------------
     BOOT
     --------------------------------------------------------- */
  window.addEventListener('load', () => {
    setTimeout(() => document.getElementById('bootScreen')?.remove(), 1700);
  });

  // deep link support: #player?ep=ep_xxx
  function parseHash() {
    const raw = location.hash.replace('#', '');
    const [route, query] = raw.split('?');
    let episodeId = null;
    if (query) {
      const params = new URLSearchParams(query);
      episodeId = params.get('ep');
    }
    return { route: route || 'dashboard', episodeId };
  }
  const initial = parseHash();
  navigate(initial.route, { episodeId: initial.episodeId });

  // register service worker for offline shell caching
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

})();
