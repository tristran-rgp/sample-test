// src/ui/cheat/panel.js — extracted from main.js
import { online, sessionAgencyId, sessionUserId, sessionUsername, setSessionAgencyId, setSessionUserId, ws } from '../../core/state.js';
import { deriveAgencyFromSrvUrl, resolveSessionAgencyId, resolveSessionUserId, syncCheatSessionFields } from '../../net/ws.js';
import { buildCheatFeaturePicker, buildCheatGridEditor, onCheatCodeChanged, setCheatPresetActive } from './editor.js';
import { isEditFsGridOn, setEditFsGridEnabled } from './fsEditor.js';
import { loadActiveSessions } from './transport.js';
import { openModal } from '../feedback.js';

// ═══════════════════════════════════════════════════════════════
// CHEAT / DEBUG PANEL — WS cmd 1999 + REST /debug/cheat
// ═══════════════════════════════════════════════════════════════

export const CHEAT_CODES = [
  'FORCE_FREE_SPIN',
  'FORCE_FREE_SPIN_4',
  'FORCE_FREE_SPIN_5',
  'FORCE_JACKPOT',
  'FORCE_JACKPOT_TRIGGER',
  'FORCE_GOD_JACKPOT',
  'FORCE_ELITE_JACKPOT',
  'FORCE_GHOST_JACKPOT',
  'FORCE_USER_JACKPOT',
  'FORCE_NORMAL_WIN',
  'FORCE_LOSS',
  'FORCE_WIN_MULTIPLIER',
  'FORCE_WIN_CAP',
  'FORCE_FS_MAX_LINE_WIN',
  'FORCE_GRID',
  'FORCE_FEATURES',
  'FORCE_3_FEATURES',
  'FORCE_12_FEATURES',
  'FORCE_FIREWALL_BLOCK',
  'FORCE_DATA_DECRYPT',
  'FORCE_TROJAN_HORSE',
  'FORCE_DATA_OVERLOAD',
  'FORCE_SYSTEM_OVERCLOCK',
  'FORCE_DATA_CLONING',
  'FORCE_ROOT_ACCESS',
  'FORCE_POWER_SURGE',
  'FORCE_SYSTEM_GLITCH',
  'FORCE_ALGORITHMIC_SCAN',
  'FORCE_BANDWIDTH_MULTIPLIER',
  'FORCE_BYPASS_PROTOCOL',
  'SET_JACKPOT_POOL',
  'SET_AGENT_JACKPOT_POOL',
  'RESET_JACKPOT_POOL',
  'SET_FREE_SPIN_COUNT',
  'FORCE_LAST_FREE_SPIN',
  'SET_GAME_MODE',
  'SET_ACCUMULATED_WIN',
  'RESET_SESSION',
  'CLEAR_AGENT_STATE',
];

/** Immediate cheats — Send & Spin will still send but skip auto-spin. */
export const CHEAT_IMMEDIATE = new Set([
  'SET_JACKPOT_POOL',
  'SET_AGENT_JACKPOT_POOL',
  'RESET_JACKPOT_POOL',
  'SET_FREE_SPIN_COUNT',
  'FORCE_LAST_FREE_SPIN',
  'SET_GAME_MODE',
  'SET_ACCUMULATED_WIN',
  'RESET_SESSION',
  'CLEAR_AGENT_STATE',
]);

export const CHEAT_SYM_OPTS = [
  { id: 1, label: '1 A' },
  { id: 2, label: '2 B' },
  { id: 3, label: '3 C' },
  { id: 4, label: '4 D' },
  { id: 5, label: '5 E' },
  { id: 6, label: '6 F' },
  { id: 7, label: '7 G' },
  { id: 8, label: '8 H' },
  { id: 9, label: '9 I' },
  { id: 10, label: '10 K' },
  { id: 11, label: '11 W' },
  { id: 12, label: '12 S' },
];

export const CHEAT_FEATURE_NAMES = [
  'FirewallBlock',
  'DataDecrypt',
  'TrojanHorse',
  'DataOverload',
  'SystemOverclock',
  'DataCloning',
  'RootAccess',
  'PowerSurge',
  'SystemGlitch',
  'AlgorithmicScan',
  'BypassProtocol',
  'BandwidthMultiplier',
];

/** Quick presets. `group` drives sidebar sections (2-col for Features). */
export const CHEAT_PRESETS = [
  { group: 'Spin', code: 'FORCE_FREE_SPIN', label: 'FS · 3 scatters', value: {} },
  { group: 'Spin', code: 'FORCE_FREE_SPIN_4', label: 'FS · 4 scatters', value: {} },
  { group: 'Spin', code: 'FORCE_FREE_SPIN_5', label: 'FS · 5 scatters', value: {} },
  { group: 'Spin', code: 'FORCE_LOSS', label: 'Force loss', value: {} },
  { group: 'Spin', code: 'FORCE_WIN_CAP', label: 'Max win grid', value: {} },
  { group: 'Spin', code: 'FORCE_WIN_MULTIPLIER', label: 'Win ×500', value: { multiplier: 500 } },
  {
    group: 'Spin',
    code: 'FORCE_GRID',
    label: 'Custom grid',
    value: { grid: [[1, 2, 3, 4, 5], [8, 8, 8, 8, 8], [6, 7, 9, 10, 1]] },
  },
  { group: 'Spin', code: 'FORCE_FS_MAX_LINE_WIN', label: 'FS max line', value: {} },
  { group: 'Jackpot', code: 'FORCE_JACKPOT', label: 'JP random', value: {} },
  { group: 'Jackpot', code: 'FORCE_GOD_JACKPOT', label: 'JP GOD', value: {} },
  { group: 'Jackpot', code: 'FORCE_ELITE_JACKPOT', label: 'JP ELITE', value: {} },
  { group: 'Jackpot', code: 'FORCE_USER_JACKPOT', label: 'JP USER', value: {} },
  { group: 'Features', code: 'FORCE_3_FEATURES', label: '3 random', value: {} },
  { group: 'Features', code: 'FORCE_12_FEATURES', label: 'All 12', value: {} },
  {
    group: 'Features',
    code: 'FORCE_FEATURES',
    label: 'Bypass+BW',
    value: { features: ['BypassProtocol', 'BandwidthMultiplier'] },
  },
  { group: 'Features', code: 'FORCE_FIREWALL_BLOCK', label: 'Firewall', value: { bannedLows: [8, 10] } },
  { group: 'Features', code: 'FORCE_DATA_DECRYPT', label: 'Decrypt', value: { count: 2, toSymbol: 1 } },
  {
    group: 'Features',
    code: 'FORCE_TROJAN_HORSE',
    label: 'Trojan',
    value: { revealTo: 8, positions: [[0, 0], [1, 0], [2, 1], [3, 2]] },
  },
  { group: 'Features', code: 'FORCE_DATA_OVERLOAD', label: 'Overload', value: { columns: [0, 4] } },
  { group: 'Features', code: 'FORCE_SYSTEM_OVERCLOCK', label: 'Overclock', value: { targetSymbol: 1, multiplier: 8 } },
  { group: 'Features', code: 'FORCE_DATA_CLONING', label: 'Cloning', value: { targetSymbol: 8 } },
  { group: 'Features', code: 'FORCE_ROOT_ACCESS', label: 'Root', value: { reels: [2] } },
  { group: 'Features', code: 'FORCE_POWER_SURGE', label: 'Surge', value: { positions: [[1, 1]] } },
  { group: 'Features', code: 'FORCE_SYSTEM_GLITCH', label: 'Glitch', value: { protectWinning: true } },
  { group: 'Features', code: 'FORCE_ALGORITHMIC_SCAN', label: 'Scan', value: { positions: [[0, 2], [2, 1]] } },
  { group: 'Features', code: 'FORCE_BANDWIDTH_MULTIPLIER', label: 'Bandwidth', value: { multiplier: 10 } },
  { group: 'Features', code: 'FORCE_BYPASS_PROTOCOL', label: 'Bypass', value: {} },
  { group: 'Session', code: 'FORCE_LAST_FREE_SPIN', label: 'Last FS = 1', value: { game_id: 'yama_01023' } },
  { group: 'Session', code: 'SET_GAME_MODE', label: 'Enter free', value: { mode: 'free', bet: 1, game_id: 'yama_01023' } },
  { group: 'Session', code: 'RESET_SESSION', label: 'Reset session', value: { game_id: 'yama_01023' } },
  { group: 'Session', code: 'CLEAR_AGENT_STATE', label: 'Clear state', value: { game_id: 'yama_01023' } },
];

export const CHEAT_CODE_GROUP = {
  FORCE_FREE_SPIN: 'Spin',
  FORCE_FREE_SPIN_4: 'Spin',
  FORCE_FREE_SPIN_5: 'Spin',
  FORCE_LOSS: 'Spin',
  FORCE_NORMAL_WIN: 'Spin',
  FORCE_WIN_CAP: 'Spin',
  FORCE_WIN_MULTIPLIER: 'Spin',
  FORCE_GRID: 'Spin',
  FORCE_FS_MAX_LINE_WIN: 'Spin',
  FORCE_JACKPOT: 'Jackpot',
  FORCE_JACKPOT_TRIGGER: 'Jackpot',
  FORCE_GOD_JACKPOT: 'Jackpot',
  FORCE_ELITE_JACKPOT: 'Jackpot',
  FORCE_GHOST_JACKPOT: 'Jackpot',
  FORCE_USER_JACKPOT: 'Jackpot',
  FORCE_FEATURES: 'Features',
  FORCE_3_FEATURES: 'Features',
  FORCE_12_FEATURES: 'Features',
  FORCE_FIREWALL_BLOCK: 'Features',
  FORCE_DATA_DECRYPT: 'Features',
  FORCE_TROJAN_HORSE: 'Features',
  FORCE_DATA_OVERLOAD: 'Features',
  FORCE_SYSTEM_OVERCLOCK: 'Features',
  FORCE_DATA_CLONING: 'Features',
  FORCE_ROOT_ACCESS: 'Features',
  FORCE_POWER_SURGE: 'Features',
  FORCE_SYSTEM_GLITCH: 'Features',
  FORCE_ALGORITHMIC_SCAN: 'Features',
  FORCE_BANDWIDTH_MULTIPLIER: 'Features',
  FORCE_BYPASS_PROTOCOL: 'Features',
  SET_JACKPOT_POOL: 'Session',
  SET_AGENT_JACKPOT_POOL: 'Session',
  RESET_JACKPOT_POOL: 'Session',
  SET_FREE_SPIN_COUNT: 'Session',
  FORCE_LAST_FREE_SPIN: 'Session',
  SET_GAME_MODE: 'Session',
  SET_ACCUMULATED_WIN: 'Session',
  RESET_SESSION: 'Session',
  CLEAR_AGENT_STATE: 'Session',
};

export let cheatPanelBuilt = false;

export function initCheatPanel() {
  const sel = document.getElementById('cheatCode');
  const presets = document.getElementById('cheatPresets');
  if (!sel || !presets) return;

  if (!cheatPanelBuilt) {
    const groupOrder = ['Spin', 'Jackpot', 'Features', 'Session'];
    const groupedCodes = {};
    for (const c of CHEAT_CODES) {
      const g = CHEAT_CODE_GROUP[c] || 'More';
      if (!groupedCodes[g]) groupedCodes[g] = [];
      groupedCodes[g].push(c);
    }
    sel.innerHTML = [...groupOrder, 'More']
      .filter(g => groupedCodes[g]?.length)
      .map(g => {
        const opts = groupedCodes[g].map(c => `<option value="${c}">${c}</option>`).join('');
        return `<optgroup label="${g}">${opts}</optgroup>`;
      })
      .join('');

    const groupedPresets = {};
    CHEAT_PRESETS.forEach((p, i) => {
      const g = p.group || 'More';
      if (!groupedPresets[g]) groupedPresets[g] = [];
      groupedPresets[g].push({ ...p, i });
    });
    presets.innerHTML = groupOrder
      .filter(g => groupedPresets[g]?.length)
      .map(g => {
        const cols = g === 'Features' || g === 'Jackpot' || g === 'Session' ? ' cols-2' : '';
        const btns = groupedPresets[g]
          .map(
            p =>
              `<button type="button" data-preset="${p.i}" title="${p.code}">${p.label}</button>`
          )
          .join('');
        const gClass = { Spin: 'g-spin', Jackpot: 'g-jp', Features: 'g-feat', Session: 'g-sess' }[g] || '';
        return `<div class="cheat-side-group ${gClass}"><div class="cheat-side-label">${g}</div>` +
          `<div class="cheat-presets${cols}">${btns}</div></div>`;
      })
      .join('');

    presets.querySelectorAll('button[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = CHEAT_PRESETS[Number(btn.dataset.preset)];
        if (!p) return;
        sel.value = p.code;
        document.getElementById('cheatValue').value = JSON.stringify(p.value ?? {}, null, 2);
        setCheatPresetActive(p.code);
        onCheatCodeChanged({ fromPreset: true });
        setCheatLog(`Preset: ${p.code}\n${JSON.stringify(p.value ?? {})}`, '');
      });
    });

    buildCheatGridEditor();
    buildCheatFeaturePicker();
    cheatPanelBuilt = true;
  }

  // Restore REST prefs once fields empty / first open
  try {
    const saved = JSON.parse(localStorage.getItem('zd_cheat_prefs') || '{}');
    if (saved.debugBase) document.getElementById('cheatDebugBase').value = saved.debugBase;
    if (saved.token) document.getElementById('cheatDebugToken').value = saved.token;
    if (saved.transport) document.getElementById('cheatTransport').value = saved.transport;
    if (saved.editFsGrid) setEditFsGridEnabled(true, { persist: false });
    // Manual overrides only if user previously saved non-empty (don't clobber session pull)
    if (saved.agencyId && document.getElementById('cheatAgencyId')?.dataset.auto === '0') {
      document.getElementById('cheatAgencyId').value = saved.agencyId;
    }
    if (saved.userId && document.getElementById('cheatUserId')?.dataset.auto === '0') {
      document.getElementById('cheatUserId').value = saved.userId;
    }
  } catch (_) { /* ignore */ }

  document.getElementById('btnCheatFab')?.classList.add('visible');
}

export function openCheatPanel() {
  initCheatPanel();
  if (!sessionAgencyId) setSessionAgencyId(deriveAgencyFromSrvUrl());
  if (!sessionUserId) {
    setSessionUserId(sessionUsername || document.getElementById('loginUser')?.value || '');
  }
  syncCheatSessionFields();
  const gid = document.getElementById('gameId')?.value || 'yama_01023';
  openModal('modalCheat');
  onCheatCodeChanged();
  setCheatLog(
    (online && ws?.readyState === WebSocket.OPEN
      ? `Online — WS 1999 (session agency/user inject).\n`
      : `Offline / no WS — REST debug.\n`) +
      `agency=${resolveSessionAgencyId()} userId=${resolveSessionUserId()}\ngame=${gid}`,
    ''
  );
  // Auto-refresh active-session targets when connected (quiet — keep the log above).
  if (online && ws?.readyState === WebSocket.OPEN) {
    loadActiveSessions().catch(() => {});
  }
}

export function setCheatLog(text, kind) {
  const el = document.getElementById('cheatLog');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('ok', 'err');
  if (kind === 'ok') el.classList.add('ok');
  if (kind === 'err') el.classList.add('err');
}

export function saveCheatPrefs() {
  try {
    localStorage.setItem(
      'zd_cheat_prefs',
      JSON.stringify({
        debugBase: document.getElementById('cheatDebugBase')?.value || '',
        token: document.getElementById('cheatDebugToken')?.value || '',
        agencyId: document.getElementById('cheatAgencyId')?.value || '',
        userId: document.getElementById('cheatUserId')?.value || '',
        transport: document.getElementById('cheatTransport')?.value || 'auto',
        editFsGrid: isEditFsGridOn(),
      })
    );
  } catch (_) { /* ignore */ }
}

// ── Per-FS grid editor (FORCE_GRID before each 1500) ──────────
