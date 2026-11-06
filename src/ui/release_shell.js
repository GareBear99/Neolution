// Neolution — release shell (Steam vertical slice front end).
// ---------------------------------------------------------------------
// This is the file release/Neolution_SteamVerticalSlice.html loads.
// It turns the prototype into a menu-driven product: profile save,
// song select, settings, achievements, results, and the AdSense break
// after every 3rd run. The game itself lives in the iframe
// (../index.html?shell=1) and talks to this shell via postMessage;
// the shell never reaches into the game's DOM.
//
// ADSENSE: keep ADSENSE_PUBLISHER_ID / ADSENSE_AD_SLOT in sync with
// CONFIG in index.html. Leave both '' while AdSense is in admission:
// no ad script loads and the break shows a support panel instead.
// ---------------------------------------------------------------------
(() => {
  'use strict';

  const ADSENSE_PUBLISHER_ID = '';
  const ADSENSE_AD_SLOT = '';
  const RUNS_BETWEEN_ADS = 3; // must match CONFIG.RUNS_BETWEEN_ADS in index.html
  const SUPPORT_LINKS = {
    kofi: 'https://ko-fi.com/luciferai',
    coffee: 'https://buymeacoffee.com/garebear99',
    sponsors: 'https://github.com/sponsors/GareBear99'
  };

  const $ = (id) => document.getElementById(id);
  const frame = $('gameFrame');

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('neolution.' + key); return v === null ? fallback : JSON.parse(v); }
      catch (_) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('neolution.' + key, JSON.stringify(value)); } catch (_) {}
    }
  };

  const ACHIEVEMENTS = {
    'first-clear':   { name: 'First Clear',   desc: 'Finish a song.' },
    'combo-50':      { name: 'Warming Up',    desc: 'Reach a 50 combo.' },
    'combo-100':     { name: 'On Fire',       desc: 'Reach a 100 combo.' },
    'rank-s':        { name: 'S Rank',        desc: 'Earn an S rank on any run.' },
    'full-combo':    { name: 'Full Combo',    desc: 'Clear a song with zero misses.' },
    'seed-explorer': { name: 'Seed Explorer', desc: 'Play 3 different seed codes.' },
    'custom-track':  { name: 'Your Track',    desc: 'Play a song you uploaded yourself.' },
    'accuracy-95':   { name: 'Pinpoint',      desc: 'Finish a run at 95% accuracy or better.' }
  };

  const EMBEDDED_SONGS = [
    { id: 'neolution-theme', title: 'Neolution Theme', file: 'Neolution-Theme.mp3', artist: 'Neo-VECTR', lengthLabel: '2:00 • 128 BPM', description: 'Built-in original track, synthesized for this game.', status: 'playable' }
  ];
  let songs = EMBEDDED_SONGS.slice();
  let selectedSong = 'Neolution-Theme.mp3';
  let selectedDifficulty = 1;
  let selectedOffset = 0;
  let gameReady = false;

  // --- toast ---
  let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  // --- screens ---
  const overlays = ['menuOverlay', 'songOverlay', 'settingsOverlay', 'achievementsOverlay', 'resultsOverlay'];
  function showScreen(id) {
    for (const o of overlays) $(o).classList.add('hidden');
    if (id) $(id).classList.remove('hidden');
  }
  function showMenu() {
    refreshMenuStats();
    showScreen('menuOverlay');
    $('runtimeBadge').textContent = 'MODE // MENU';
    $('hudMenuBtn').classList.add('hidden');
    $('hudRetryBtn').classList.add('hidden');
    frame.classList.remove('live');
  }
  function showGame() {
    showScreen(null);
    $('runtimeBadge').textContent = 'MODE // PLAYING';
    $('hudMenuBtn').classList.remove('hidden');
    $('hudRetryBtn').classList.remove('hidden');
    frame.classList.add('live');
  }

  // --- profile / stats ---
  function refreshMenuStats() {
    const profile = store.get('profile.v1', {});
    const bests = store.get('bests.v1', {});
    const stats = store.get('stats.v1', { runs: 0, perfectHits: 0, tracksCleared: 0 });
    const ach = store.get('achievements.v1', {});
    $('profileBadge').textContent = 'PROFILE // ' + (profile.name || 'LOCAL PILOT').toUpperCase();
    let bestScore = 0, bestRank = '--';
    const rankOrder = { S: 5, A: 4, B: 3, C: 2, D: 1 };
    for (const k of Object.keys(bests)) {
      const b = bests[k];
      if (b.score > bestScore) bestScore = b.score;
      if (b.rank && (bestRank === '--' || (rankOrder[b.rank] || 0) > (rankOrder[bestRank] || 0))) bestRank = b.rank;
    }
    $('bestRank').textContent = bestRank;
    $('bestScore').textContent = bestScore.toLocaleString();
    $('tracksCleared').textContent = String(stats.tracksCleared || 0);
    $('perfectHits').textContent = String(stats.perfectHits || 0);
    $('achCount').textContent = Object.keys(ach).length + ' / ' + Object.keys(ACHIEVEMENTS).length;
    $('offsetReadout').textContent = (selectedOffset >= 0 ? '+' : '') + selectedOffset + ' ms';
  }

  // --- song select ---
  function renderSongGrid() {
    const grid = $('songGrid');
    grid.innerHTML = '';
    for (const s of songs) {
      if (s.status && s.status !== 'playable') continue;
      const card = document.createElement('div');
      card.className = 'songCard' + (s.file === selectedSong ? ' active' : '');
      card.innerHTML = '<h3 style="margin:0 0 4px"></h3><div class="songMeta"></div><div style="margin-top:8px;color:var(--muted);font-size:13px"></div>';
      card.querySelector('h3').textContent = s.title;
      card.querySelector('.songMeta').textContent = (s.artist || '') + ' • ' + (s.lengthLabel || '');
      card.querySelectorAll('div')[1].textContent = s.description || '';
      card.addEventListener('click', () => {
        selectedSong = s.file;
        renderSongGrid();
      });
      grid.appendChild(card);
    }
    // custom song card
    const custom = document.createElement('div');
    custom.className = 'songCard';
    custom.innerHTML = '<h3 style="margin:0 0 4px">Your Own Song</h3><div class="songMeta">MP3 / WAV / OGG — from your device</div><div style="margin-top:8px;color:var(--muted);font-size:13px">Pick any audio file. It plays instantly and gets its own chart — and a seed code you can share.</div>';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.style.display = 'none';
    custom.appendChild(fileInput);
    custom.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      showGame();
      postToGame({ type: 'neolution:customSong', file: f });
      toast('Loading your song: ' + f.name);
    });
    grid.appendChild(custom);
  }

  async function loadSongRegistry() {
    try {
      const res = await fetch('../assets/data/official_songs.json');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length && data[0].file) {
        songs = data.filter(s => s.status === 'playable');
        if (!songs.some(s => s.file === selectedSong)) selectedSong = songs[0].file;
        renderSongGrid();
      }
    } catch (_) { /* file:// or offline: embedded list stays */ }
  }

  // --- game bridge ---
  function postToGame(msg) {
    try {
      if (frame && frame.contentWindow) {
        const target = (location.protocol === 'http:' || location.protocol === 'https:') ? location.origin : '*';
        frame.contentWindow.postMessage(msg, target);
      }
    } catch (_) {}
  }
  function isTrustedOrigin(e) {
    if (location.protocol === 'file:') return e.origin === 'null' || e.origin === 'file://';
    return e.origin === location.origin;
  }
  window.addEventListener('message', (e) => {
    if (!isTrustedOrigin(e)) return;
    const msg = e.data || {};
    if (msg.type === 'neolution:ready') {
      gameReady = true;
    } else if (msg.type === 'neolution:results') {
      $('resultRank').textContent = msg.rank || '--';
      $('resultScore').textContent = (msg.score || 0).toLocaleString();
      $('resultAccuracy').textContent = ((msg.accuracy || 0) * 100).toFixed(1) + '%';
      $('resultCombo').textContent = 'x' + (msg.maxCombo || 0);
      $('resultTrack').textContent = msg.song || '--';
      $('resultDifficulty').textContent = msg.difficulty || '--';
      $('resultSession').textContent = msg.runSeconds ? (Math.round(msg.runSeconds) + 's') : '--';
      $('runtimeBadge').textContent = 'MODE // RESULTS';
      showScreen('resultsOverlay');
      refreshMenuStats();
      if (msg.adDue) setTimeout(showAdBreak, 350);
    } else if (msg.type === 'neolution:achievement') {
      refreshMenuStats();
      if (ACHIEVEMENTS[msg.id]) toast('🏆 Achievement: ' + ACHIEVEMENTS[msg.id].name);
    }
  });

  // --- AdSense break (shell side; mirrors the game's break) ---
  let adsenseScriptState = 'idle';
  function loadAdsenseScript() {
    return new Promise((resolve) => {
      if (!ADSENSE_PUBLISHER_ID) { resolve(false); return; }
      if (adsenseScriptState === 'ready') { resolve(true); return; }
      if (adsenseScriptState === 'failed') { resolve(false); return; }
      adsenseScriptState = 'loading';
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(ADSENSE_PUBLISHER_ID);
      s.crossOrigin = 'anonymous';
      s.onload = () => { adsenseScriptState = 'ready'; resolve(true); };
      s.onerror = () => { adsenseScriptState = 'failed'; resolve(false); };
      document.head.appendChild(s);
    });
  }
  function showSupportFallback() {
    $('adBoxShell').innerHTML =
      '<div class="support" style="text-align:center;padding:20px;color:var(--muted);line-height:1.6">' +
      '<b style="color:var(--text)">Neolution is free — and it stays free because players chip in.</b><br/>' +
      '<a style="color:var(--accent)" href="' + SUPPORT_LINKS.kofi + '" target="_blank" rel="noopener">Ko-fi</a> &nbsp;•&nbsp; ' +
      '<a style="color:var(--accent)" href="' + SUPPORT_LINKS.coffee + '" target="_blank" rel="noopener">Buy Me a Coffee</a> &nbsp;•&nbsp; ' +
      '<a style="color:var(--accent)" href="' + SUPPORT_LINKS.sponsors + '" target="_blank" rel="noopener">GitHub Sponsors</a><br/>' +
      '<span style="font-size:13px">Ads will appear here once AdSense is connected.</span>' +
      '</div>';
  }
  async function showAdBreak() {
    const box = $('adBoxShell');
    box.innerHTML = '';
    $('adOverlay').classList.remove('hidden');
    const ok = await loadAdsenseScript();
    if (!ok || !ADSENSE_AD_SLOT) { showSupportFallback(); return; }
    try {
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', ADSENSE_PUBLISHER_ID);
      ins.setAttribute('data-ad-slot', ADSENSE_AD_SLOT);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      box.appendChild(ins);
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      setTimeout(() => {
        if (!$('adOverlay').classList.contains('hidden') && !ins.querySelector('iframe') && ins.getAttribute('data-ad-status') !== 'filled') {
          showSupportFallback();
        }
      }, 2500);
    } catch (_) {
      showSupportFallback();
    }
  }

  // --- achievements screen ---
  function renderAchievements() {
    const ach = store.get('achievements.v1', {});
    const list = $('achievementList');
    list.innerHTML = '';
    for (const id of Object.keys(ACHIEVEMENTS)) {
      const a = ACHIEVEMENTS[id];
      const unlocked = !!ach[id];
      const card = document.createElement('div');
      card.className = 'card';
      card.style.opacity = unlocked ? '1' : '0.55';
      card.innerHTML = '<h3></h3><div style="font-size:13px;color:var(--muted)"></div><div style="margin-top:8px;font-weight:800"></div>';
      card.querySelector('h3').textContent = (unlocked ? '🏆 ' : '🔒 ') + a.name;
      card.querySelectorAll('div')[0].textContent = a.desc;
      card.querySelectorAll('div')[1].textContent = unlocked ? 'Unlocked' : 'Locked';
      list.appendChild(card);
    }
  }

  // --- settings ---
  function loadSettingsIntoForm() {
    const profile = store.get('profile.v1', {});
    const settings = store.get('settings.v1', {});
    $('playerName').value = profile.name || '';
    $('releaseHud').value = profile.hudMode || 'full';
    $('autoSave').value = String(profile.autoSave !== false);
    $('settingsOffset').value = String(settings.offset ?? 0);
    selectedOffset = settings.offset ?? 0;
    $('offsetBadge').textContent = (selectedOffset >= 0 ? '+' : '') + selectedOffset + ' ms';
  }
  function saveSettingsFromForm() {
    const profile = store.get('profile.v1', {});
    profile.name = $('playerName').value.trim().slice(0, 24);
    profile.hudMode = $('releaseHud').value;
    profile.autoSave = $('autoSave').value === 'true';
    store.set('profile.v1', profile);
    const settings = store.get('settings.v1', {});
    settings.offset = parseInt($('settingsOffset').value, 10) || 0;
    store.set('settings.v1', settings);
    selectedOffset = settings.offset;
    postToGame({ type: 'neolution:setHud', mode: profile.hudMode === 'minimal' ? 'minimal' : 'full' });
    refreshMenuStats();
    toast('Settings saved');
  }

  // --- wiring ---
  $('playBtn').addEventListener('click', () => {
    showGame();
    postToGame({ type: 'neolution:launch', song: selectedSong, difficulty: selectedDifficulty, offset: selectedOffset });
  });
  $('songSelectBtn').addEventListener('click', () => { renderSongGrid(); showScreen('songOverlay'); });
  $('settingsBtn').addEventListener('click', () => { loadSettingsIntoForm(); showScreen('settingsOverlay'); });
  $('achievementsBtn').addEventListener('click', () => { renderAchievements(); showScreen('achievementsOverlay'); });
  $('launchSongBtn').addEventListener('click', () => {
    selectedDifficulty = parseInt($('difficultySelect').value, 10) || 1;
    selectedOffset = parseInt($('offsetRange').value, 10) || 0;
    showGame();
    postToGame({ type: 'neolution:launch', song: selectedSong, difficulty: selectedDifficulty, offset: selectedOffset });
  });
  $('difficultySelect').addEventListener('change', () => { selectedDifficulty = parseInt($('difficultySelect').value, 10) || 1; });
  $('offsetRange').addEventListener('input', () => {
    selectedOffset = parseInt($('offsetRange').value, 10) || 0;
    $('offsetBadge').textContent = (selectedOffset >= 0 ? '+' : '') + selectedOffset + ' ms';
  });
  $('saveSettingsBtn').addEventListener('click', saveSettingsFromForm);
  $('hudMenuBtn').addEventListener('click', () => {
    postToGame({ type: 'neolution:command', command: 'menu' });
    showMenu();
  });
  $('hudRetryBtn').addEventListener('click', () => {
    postToGame({ type: 'neolution:command', command: 'retry' });
  });
  $('resultsRetryBtn').addEventListener('click', () => {
    showGame();
    postToGame({ type: 'neolution:command', command: 'retry' });
  });
  $('resultsMenuBtn').addEventListener('click', () => {
    postToGame({ type: 'neolution:command', command: 'menu' });
    showMenu();
  });
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', showMenu));
  $('btnAdContinueShell').addEventListener('click', () => $('adOverlay').classList.add('hidden'));

  // --- init ---
  const settings = store.get('settings.v1', {});
  selectedDifficulty = settings.difficulty ?? 1;
  selectedOffset = settings.offset ?? 0;
  $('difficultySelect').value = String(selectedDifficulty);
  $('offsetRange').value = String(selectedOffset);
  $('offsetBadge').textContent = (selectedOffset >= 0 ? '+' : '') + selectedOffset + ' ms';
  renderSongGrid();
  loadSongRegistry();
  refreshMenuStats();
  showMenu();
})();
