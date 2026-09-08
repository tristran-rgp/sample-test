// ═══════════════════════════════════════════════════════════════
// ZERO DAY — Slot Game Engine (entry point)
// Wires online-mode spin override, login/disconnect handlers and boot.
// Game/net/ui/sfx logic lives in the modules under src/.
// ═══════════════════════════════════════════════════════════════
import { online, sessionAgencyId, sessionUserId, setAccessToken, setOnline, setSessionAgencyId, setSessionUserId, setSessionUsername, state } from './core/state.js';
import { doSpin, setDoSpin } from './game/spin.js';
import { returnToLogin } from './net/session.js';
import { captureSessionIdentity, connectWS, deriveAgencyFromSrvUrl, doOnlineSpin, setConnState, syncCheatSessionFields } from './net/ws.js';
import { sfx, unlockAudio } from './sfx/sfx.js';
import { bindCheatPanelEvents } from './ui/cheat/events.js';
import { initCheatPanel } from './ui/cheat/panel.js';
import { bindHotkeys } from './ui/hotkeys.js';
import { initUI } from './ui/initUI.js';
import { startAssetPreload } from './ui/preload.js';
import { updateUI } from './ui/render.js';
import { splash } from './ui/splash.js';

// ═══════════════════════════════════════════════════════════════
// ZERO DAY — Slot Game Engine
// ═══════════════════════════════════════════════════════════════


// ─── Utilities ───────────────────────────────────────────────

const LOGIN_PREF_FIELDS = [
  ['srvUrl', 'zd_srvUrl'],
  ['loginUser', 'zd_loginUser'],
  ['wsUrl', 'zd_wsUrl'],
  ['gameId', 'zd_gameId'],
];

function restoreLoginPrefs() {
  for (const [id, key] of LOGIN_PREF_FIELDS) {
    try {
      const saved = localStorage.getItem(key);
      if (saved == null) continue;
      const el = document.getElementById(id);
      if (el) el.value = saved;
    } catch (_) { /* private mode / denied */ }
  }
}

function saveLoginPrefs() {
  for (const [id, key] of LOGIN_PREF_FIELDS) {
    try {
      const el = document.getElementById(id);
      if (!el) continue;
      localStorage.setItem(key, el.value || '');
    } catch (_) { /* private mode / denied */ }
  }
}

function bindLoginPrefPersistence() {
  for (const [id] of LOGIN_PREF_FIELDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener('change', saveLoginPrefs);
    el.addEventListener('blur', saveLoginPrefs);
  }
}

restoreLoginPrefs();
bindLoginPrefPersistence();

// ═══════════════════════════════════════════════════════════════
// ONLINE MODE — WebSocket Integration
// ═══════════════════════════════════════════════════════════════

// ─── Override doSpin for online mode ──────────────────────────
const origDoSpin = doSpin;
setDoSpin(async function(forcedScatters = 0) {
  if (online) return await doOnlineSpin();
  return await origDoSpin.apply(this, arguments);
});

// ─── Login handlers ───────────────────────────────────────────
// Flow mỗi lần Play Online:
// 1) POST /api/v1/user/login → user JWT
// 2) POST /api/v1/play-game (Bearer user JWT) → game accessToken
// 3) WebSocket auth bằng accessToken đó
document.getElementById('btnPlayOnline').addEventListener('click', async () => {
  unlockAudio();
  const srv = document.getElementById('srvUrl').value.replace(/\/$/, '');
  const username = document.getElementById('loginUser').value;
  const password = document.getElementById('loginPass').value;
  const gameId = document.getElementById('gameId').value;
  const status = document.getElementById('loginStatus');
  status.style.color = 'var(--dim)';
  status.textContent = 'Logging in...';
  document.getElementById('btnPlayOnline').disabled = true;
  try {
    // 1) Login → user JWT
    const loginRes = await fetch(srv + '/api/v1/user/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.token) {
      status.textContent = 'Login failed: ' + (loginData.message || JSON.stringify(loginData));
      status.style.color = 'var(--red)';
      document.getElementById('btnPlayOnline').disabled = false;
      return;
    }
    const userToken = loginData.token;
    setSessionUsername(username);
    captureSessionIdentity(loginData, { force: true });
    captureSessionIdentity(loginData.user || loginData.data || {}, { force: false });
    if (!sessionUserId) setSessionUserId(String(loginData.userId || loginData.uid || username || ''));
    if (!sessionAgencyId) setSessionAgencyId(deriveAgencyFromSrvUrl());

    // 2) play-game → access token cho WebSocket
    status.textContent = 'Login OK — requesting play token...';
    const playRes = await fetch(srv + '/api/v1/play-game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + userToken,
      },
      body: JSON.stringify({ gameId }),
    });
    const playData = await playRes.json();
    if (!playRes.ok || !playData.token) {
      status.textContent = 'Play-game failed: ' + (playData.message || JSON.stringify(playData));
      status.style.color = 'var(--red)';
      document.getElementById('btnPlayOnline').disabled = false;
      return;
    }
    setAccessToken(playData.token);
    captureSessionIdentity(playData, { force: false });
    captureSessionIdentity(playData.data || {}, { force: false });
    if (!sessionAgencyId) setSessionAgencyId(deriveAgencyFromSrvUrl());
    syncCheatSessionFields();

    // Persist non-secret connection prefs (never password)
    saveLoginPrefs();

    // 3) Start UI + connect WebSocket với accessToken
    setOnline(true);
    status.textContent = 'Play token OK — connecting WS...';
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('connBar').style.display = 'flex';
    setConnState('connecting', 'Connecting...');
    document.getElementById('game').classList.add('visible');
    initUI();
    state.balance = 0;
    updateUI();
    splash();
    connectWS();
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
    status.style.color = 'var(--red)';
    document.getElementById('btnPlayOnline').disabled = false;
  }
});

document.getElementById('btnPlayOffline').addEventListener('click', () => {
  unlockAudio();
  setOnline(false);
  document.getElementById('loginOverlay').style.display = 'none';
  document.getElementById('connBar').style.display = 'none';
  document.getElementById('game').classList.add('visible');
  initUI();
  splash();
  sfx('blip', { gain: 0.45 });
});

document.getElementById('btnDisconnect').addEventListener('click', () => {
  returnToLogin({ message: 'Disconnected. Log in again to play online.', color: 'var(--dim)' });
});

// ─── Boot — preload while login is visible ───────────────────
// Hotkeys (Enter/Space) + cheat panel (C) — bound once, before Play
bindHotkeys();
bindCheatPanelEvents();
initCheatPanel();
startAssetPreload();

// Service worker: cache assets → lần mở sau gần như instant
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
