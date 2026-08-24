// src/ui/cheat/fsEditor.js — extracted from main.js
import { online, state, ws } from '../../core/state.js';
import { sleepRaw } from '../../core/utils.js';
import { FEATURES, SYM_MAP } from '../../game/config.js';
import { continueAfterSpin } from '../../game/fsAuto.js';
import { doSpin } from '../../game/spin.js';
import { SERVER_FEATURE_MAP } from '../../net/session.js';
import { CHEAT_FEATURE_NAMES, CHEAT_SYM_OPTS, saveCheatPrefs } from './panel.js';
import { sendCheatViaRest, sendCheatViaWs } from './transport.js';
import { closeModal, openModal, showToast } from '../feedback.js';
import { renderGrid, setInfoBar } from '../render.js';

export let editFsGridEnabled = false;
export let fsGridBusy = false;
export let pendingLocalForceGrid = null;
export let pendingLocalForceFeatures = null;

export function isEditFsGridOn() {
  return !!editFsGridEnabled;
}

export function isFsGridEditorOpen() {
  return !!document.getElementById('modalFsGrid')?.classList.contains('open');
}

export function setEditFsGridEnabled(on, opts = {}) {
  editFsGridEnabled = !!on;
  const cb = document.getElementById('cheatEditFsGrid');
  if (cb) cb.checked = editFsGridEnabled;
  syncEditFsGridChip();
  if (opts.persist !== false) saveCheatPrefs();
  if (!editFsGridEnabled && isFsGridEditorOpen()) {
    closeFsGridEditor();
    if (state.inFreeSpins && state.fsRemaining > 0 && !state.spinning && !state.fxPlaying) {
      continueAfterSpin();
    }
  }
}

export function syncEditFsGridChip() {
  document.getElementById('btnFsEditGrid')?.classList.toggle('is-on', isEditFsGridOn());
}

export function buildFsOverlayEditor() {
  const body = document.getElementById('fsGridBody');
  if (body && body.dataset.built !== '1') {
    const opts = CHEAT_SYM_OPTS.map(o => `<option value="${o.id}">${o.label}</option>`).join('');
    let html = '';
    for (let r = 0; r < 3; r++) {
      html += `<tr><th style="font-size:.6rem;color:var(--dim)">row${r}</th>`;
      for (let c = 0; c < 5; c++) {
        html += `<td><select data-r="${r}" data-c="${c}" class="fs-cell">${opts}</select></td>`;
      }
      html += '</tr>';
    }
    body.innerHTML = html;
    body.dataset.built = '1';
  }
  const featRoot = document.getElementById('fsFeatureList');
  if (featRoot && featRoot.dataset.built !== '1') {
    const short = {
      FirewallBlock: 'Firewall',
      DataDecrypt: 'Decrypt',
      TrojanHorse: 'Trojan',
      DataOverload: 'Overload',
      SystemOverclock: 'Overclock',
      DataCloning: 'Cloning',
      RootAccess: 'Root',
      PowerSurge: 'Surge',
      SystemGlitch: 'Glitch',
      AlgorithmicScan: 'Scan',
      BandwidthMultiplier: 'Bandwidth',
      BypassProtocol: 'Bypass',
    };
    featRoot.innerHTML = CHEAT_FEATURE_NAMES.map(
      name =>
        `<label class="cheat-feature-item" data-feature="${name}" title="${name}">` +
        `<input type="checkbox" value="${name}" /><span>${short[name] || name}</span></label>`
    ).join('');
    featRoot.dataset.built = '1';
    featRoot.addEventListener('change', e => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;
      input.closest('.cheat-feature-item')?.classList.toggle('is-on', input.checked);
    });
  }
}

export function readFsOverlayGrid() {
  const grid = [[], [], []];
  document.querySelectorAll('#fsGridBody select.fs-cell').forEach(sel => {
    const r = Number(sel.dataset.r);
    const c = Number(sel.dataset.c);
    grid[r][c] = Number(sel.value) || 1;
  });
  return grid;
}

export function applyGridToFsOverlay(grid) {
  if (!Array.isArray(grid) || grid.length !== 3) return;
  document.querySelectorAll('#fsGridBody select.fs-cell').forEach(sel => {
    const r = Number(sel.dataset.r);
    const c = Number(sel.dataset.c);
    const v = grid[r]?.[c];
    if (v != null) sel.value = String(v);
  });
}

export function fillFsOverlayGrid(symId) {
  document.querySelectorAll('#fsGridBody select.fs-cell').forEach(sel => {
    sel.value = String(symId);
  });
}

export function readFsOverlayFeatures() {
  return [...document.querySelectorAll('#fsFeatureList input[type="checkbox"]:checked')]
    .map(el => el.value)
    .filter(name => CHEAT_FEATURE_NAMES.includes(name));
}

export function applyFeaturesToFsOverlay(features) {
  const selected = new Set(Array.isArray(features) ? features : []);
  document.querySelectorAll('#fsFeatureList .cheat-feature-item').forEach(label => {
    const on = selected.has(label.dataset.feature);
    const input = label.querySelector('input');
    if (input) input.checked = on;
    label.classList.toggle('is-on', on);
  });
}

export function currentScreenAsRowMajor() {
  if (!state.grid || state.grid.length !== 5) return null;
  const inv = {};
  Object.entries(SYM_MAP).forEach(([id, key]) => {
    inv[key] = Number(id);
  });
  const grid = [[], [], []];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      grid[r][c] = inv[state.grid[c][r]] || 1;
    }
  }
  return grid;
}

export function loadFsOverlayFromScreen() {
  const grid = currentScreenAsRowMajor();
  if (!grid) {
    showToast('Chưa có screen trên reels', '#ff8800');
    return;
  }
  applyGridToFsOverlay(grid);
}

export function mergePendingLocalForceFeatures(features) {
  const names = pendingLocalForceFeatures;
  pendingLocalForceFeatures = null;
  if (!Array.isArray(names) || !names.length || !Array.isArray(features)) return;
  for (const name of names) {
    const id = SERVER_FEATURE_MAP[name];
    if (!id) continue;
    if (features.find(f => f.id === id)) continue;
    const feat = FEATURES.find(f => f.id === id);
    if (feat) features.push(feat);
  }
}

export function applyPendingLocalForceGrid() {
  const rows = pendingLocalForceGrid;
  pendingLocalForceGrid = null;
  if (!Array.isArray(rows) || rows.length !== 3) return;
  for (let r = 0; r < 3; r++) {
    if (!Array.isArray(rows[r]) || rows[r].length !== 5) return;
  }
  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < 3; r++) {
      const id = Number(rows[r][c]);
      state.grid[c][r] = SYM_MAP[id] || 'A';
    }
  }
  renderGrid();
}

export function closeFsGridEditor() {
  closeModal('modalFsGrid');
}

export function openFsGridEditor() {
  if (!state.inFreeSpins || state.fsRemaining <= 0 || state.spinning) return;
  buildFsOverlayEditor();
  const hint = document.getElementById('fsGridHint');
  if (hint) {
    hint.textContent =
      `FS còn ${state.fsRemaining}/${state.fsTotal || state.fsRemaining} — sửa 5×3 rồi Apply & Spin. ` +
      `Online: FORCE_GRID (1999) rồi 1500 (debit 0, bet session). Offline: ghi đè grid local.`;
  }
  const fromScreen = currentScreenAsRowMajor();
  if (fromScreen) applyGridToFsOverlay(fromScreen);
  setInfoBar('idle', `Sửa grid FS — ${state.fsRemaining} left`);
  openModal('modalFsGrid');
}

export async function sendCheatCode(code, value) {
  const transport = document.getElementById('cheatTransport')?.value || 'auto';
  if (transport === 'ws') return sendCheatViaWs(code, value);
  if (transport === 'rest') return sendCheatViaRest(code, value);
  if (online && ws?.readyState === WebSocket.OPEN) {
    try {
      return await sendCheatViaWs(code, value);
    } catch (_) {
      return sendCheatViaRest(code, value);
    }
  }
  return sendCheatViaRest(code, value);
}

export async function skipFsGridAndSpin() {
  if (fsGridBusy || state.spinning) return;
  closeFsGridEditor();
  pendingLocalForceGrid = null;
  pendingLocalForceFeatures = null;
  showToast('FS RNG — không force grid', '#ff8800');
  await doSpin();
}

export async function applyFsGridAndSpin() {
  if (fsGridBusy || state.spinning) return;
  if (!state.inFreeSpins || state.fsRemaining <= 0) {
    closeFsGridEditor();
    return;
  }
  const grid = readFsOverlayGrid();
  fsGridBusy = true;
  const btn = document.getElementById('fsGridApply');
  if (btn) btn.disabled = true;
  try {
    const features = readFsOverlayFeatures();
    const value = features.length ? { grid, features } : { grid };
    if (online) {
      await sendCheatCode('FORCE_GRID', value);
      showToast(
        features.length
          ? `FORCE_GRID + ${features.length} feature — quay FS`
          : 'FORCE_GRID đã set — quay FS',
        '#00ff88'
      );
      await sleepRaw(80);
    } else {
      pendingLocalForceGrid = grid;
      pendingLocalForceFeatures = features;
      showToast('Offline: force grid/feature local', '#ff8800');
    }
    closeFsGridEditor();
    await doSpin();
  } catch (e) {
    showToast('FORCE_GRID thất bại: ' + e.message, '#ff3355');
  } finally {
    fsGridBusy = false;
    if (btn) btn.disabled = false;
  }
}

// ── FORCE_GRID editor ─────────────────────────────────────────
