// src/net/session.js — extracted from main.js
import { _explainContinueResolve, _vfxAnimCancel, pendingCmdWaiters, pendingSpinResolve, pingTimer, reconnectTimer, setAccessToken, setIntentionalWsClose, setOnline, setOnlineBalance, setPendingSpinData, setPendingSpinResolve, setPingTimer, setReconnectTimer, setSessionAgencyId, setSessionUserId, setSpinQueue, setWs, setWsSessionId, set_explainContinueResolve, set_vfxSkipAll, state, ws } from '../core/state.js';
import { sleepRaw } from '../core/utils.js';
import { FEATURES, REELS, ROWS, SYM_MAP } from '../game/config.js';
import { continueAfterSpin, endFreeSpins, stopAutoSpin, triggerFreeSpins, updateAutoUI, updateFSBanner } from '../game/fsAuto.js';
import { createEmptyGrid, splitCountOf } from '../game/grid.js';
import { sendWS } from './ws.js';
import { showToast } from '../ui/feedback.js';
import { renderFeatureMeter, renderGrid, updateUI } from '../ui/render.js';
import { clearMeterStepActive, hideVfxBanner, setMeterStepActive, showVfxBanner, vfxMs } from '../ui/vfx/core.js';

export function clearAllPendingNetwork() {
  if (pendingSpinResolve) {
    pendingSpinResolve(false);
    setPendingSpinResolve(null);
  }
  setPendingSpinData(null);
  setSpinQueue([]);
  for (const key of Object.keys(pendingCmdWaiters)) {
    resolvePendingCmd(key, null);
  }
}

/**
 * Clear online session and return to login overlay.
 * Used by FORCE_LOGOUT (1006) session takeover and manual disconnect.
 * @param {{ message?: string, color?: string, keepLoginFields?: boolean }} opts
 */
export function returnToLogin(opts = {}) {
  const message = opts.message || 'Session ended. Please log in again.';
  const toastColor = opts.color || '#ff3355';

  setIntentionalWsClose(true);
  setOnline(false);

  // Stop ongoing play loops / FX
  try { stopAutoSpin(); } catch (_) {}
  state.autoSpins = 0;
  state.spinning = false;
  state.fxPlaying = false;
  state.inFreeSpins = false;
  state.fsRemaining = 0;
  state.fsTotal = 0;
  state.fsActiveFeatures = [];
  state.fsSessionWin = 0;
  state.sessionWin = 0;
  state.lastWin = 0;
  state.triggeredFeatures = [];
  state.persistentFeatures = [];
  state.scatterBooster = false;
  state.buy3Features = false;
  state.buy12Features = false;
  state.extraFee = 0;
  state.globalMultiplier = 1;
  state.bypassProtocol = false;
  document.body.classList.remove('fs-active');
  document.getElementById('fsBanner')?.classList.remove('visible');
  document.getElementById('multDisplay') && (document.getElementById('multDisplay').textContent = '01');
  set_vfxSkipAll(true);
  if (_explainContinueResolve) {
    try { _explainContinueResolve(); } catch (_) {}
    set_explainContinueResolve(null);
  }
  if (typeof _vfxAnimCancel === 'function') {
    try { _vfxAnimCancel(); } catch (_) {}
  }

  clearAllPendingNetwork();

  if (pingTimer) { clearInterval(pingTimer); setPingTimer(null); }
  if (reconnectTimer) { clearTimeout(reconnectTimer); setReconnectTimer(null); }

  if (ws) {
    try { ws.onclose = null; ws.onerror = null; ws.onmessage = null; ws.close(); } catch (_) {}
    setWs(null);
  }

  setAccessToken('');
  setWsSessionId('');
  setSessionAgencyId('');
  setSessionUserId('');
  // keep sessionUsername / form fields so user can re-login quickly
  setOnlineBalance(0);

  // Close any open modals (bet, buy, history, cheat…)
  document.querySelectorAll('.modal-overlay.open').forEach((el) => {
    if (el.id === 'loginOverlay') return;
    el.classList.remove('open');
  });

  document.getElementById('game')?.classList.remove('visible');
  const connBar = document.getElementById('connBar');
  if (connBar) connBar.style.display = 'none';
  const sessionLabel = document.getElementById('sessionLabel');
  if (sessionLabel) sessionLabel.textContent = '';

  const overlay = document.getElementById('loginOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.style.zIndex = '10000';
  }
  const status = document.getElementById('loginStatus');
  if (status) {
    status.textContent = message;
    status.style.color = 'var(--red)';
  }
  const btnOnline = document.getElementById('btnPlayOnline');
  if (btnOnline) btnOnline.disabled = false;

  showToast(message, toastColor);
  try { updateAutoUI(); } catch (_) {}
  setIntentionalWsClose(false);
}

/**
 * FORCE_LOGOUT (cmd 1006) — another device took the session.
 */
export function handleForceLogout(payload) {
  const msg =
    (payload && (payload.message || payload.msg)) ||
    'You have logged in from another device.';
  returnToLogin({ message: String(msg), color: '#ff3355' });
}

/**
 * Gửi cmd game và chờ response type [5, payload] cùng cmd.
 * @returns {Promise<object|null>} payload or null on timeout
 */
export function requestGameCmd(cmd, extra = {}, timeoutMs = 15000) {
  const key = String(cmd);
  return new Promise(resolve => {
    if (pendingCmdWaiters[key]?.timer) clearTimeout(pendingCmdWaiters[key].timer);
    const timer = setTimeout(() => {
      if (pendingCmdWaiters[key]?.resolve === resolve) {
        delete pendingCmdWaiters[key];
        resolve(null);
      }
    }, timeoutMs);
    pendingCmdWaiters[key] = { resolve, timer };
    const gid = document.getElementById('gameId')?.value || 'yama_01023';
    const ok = sendWS([6, 'MiniGame', gid, { cmd: key, ...extra }]);
    if (!ok) {
      clearTimeout(timer);
      delete pendingCmdWaiters[key];
      resolve(null);
    }
  });
}

export function resolvePendingCmd(cmd, payload) {
  const key = String(cmd);
  const w = pendingCmdWaiters[key];
  if (!w) return false;
  clearTimeout(w.timer);
  delete pendingCmdWaiters[key];
  w.resolve(payload);
  return true;
}

/** Lấy ma trận screen 5×3 (số symbol server) từ payload 1005/1500 */
export function extractServerScreen(payload) {
  if (!payload) return null;
  if (Array.isArray(payload.screen) && payload.screen.length === REELS) return payload.screen;
  const stage0 = payload.stages?.[0];
  if (Array.isArray(stage0?.screen) && stage0.screen.length === REELS) return stage0.screen;
  const data = payload.data || {};
  const round = data.round || data;
  const result = round.result || round;
  const st = result.stages?.[0];
  if (Array.isArray(st?.screen) && st.screen.length === REELS) return st.screen;
  if (Array.isArray(data.screen) && data.screen.length === REELS) return data.screen;
  return null;
}

/** Map screen server → state.grid + render UI */
export function applyServerScreen(screen, splitCounts) {
  if (!Array.isArray(screen) || screen.length !== REELS) return false;
  if (!state.grid?.length) createEmptyGrid();
  for (let c = 0; c < REELS; c++) {
    const col = screen[c];
    if (!Array.isArray(col) || col.length < ROWS) return false;
    for (let r = 0; r < ROWS; r++) {
      state.grid[c][r] = SYM_MAP[col[r]] || 'A';
      state.cellMeta[c][r] = { split: 1, multiplier: 1, mystery: false };
    }
  }
  // Áp splitCounts nếu server gửi (1 = không tách, 2 / 4 = số mảnh)
  if (Array.isArray(splitCounts) && splitCounts.length === REELS) {
    for (let c = 0; c < REELS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const n = splitCounts[c]?.[r];
        if (n != null) state.cellMeta[c][r].split = splitCountOf({ split: n });
      }
    }
  }
  renderGrid();
  return true;
}

export function applyOnlineBalance(payload, { syncBefore = false } = {}) {
  const raw =
    payload?.data?.control?.balance ??
    payload?.control?.balance ??
    payload?.balance;
  if (raw === undefined || raw === null || raw === '') return false;
  const bal = parseFloat(raw);
  if (Number.isNaN(bal)) return false;
  setOnlineBalance(bal);
  state.balance = bal;
  // JOIN / last-session: BEFORE = balance hiện tại (chưa có spin pending)
  if (syncBefore) state.balanceBefore = bal;
  updateUI();
  return true;
}

/** Map tên feature server (PascalCase) → id client */
export const SERVER_FEATURE_MAP = {
  FirewallBlock: 'firewall',
  DataDecrypt: 'decrypt',
  TrojanHorse: 'trojan',
  DataOverload: 'overload',
  SystemOverclock: 'overclock',
  DataCloning: 'cloning',
  RootAccess: 'root',
  PowerSurge: 'surge',
  SystemGlitch: 'glitch',
  AlgorithmicScan: 'scan',
  BandwidthMultiplier: 'bandwidth',
  BypassProtocol: 'bypass',
};

export const FEATURE_PRESENT = {
  firewall:  { msg: '🔥 Firewall Block: low symbols blocked', color: '#ff3355' },
  decrypt:   { msg: '🔵 Data Decrypt: Low → High', color: '#00f0ff' },
  trojan:    { msg: '🐴 Trojan Horse: Mystery revealed', color: '#aa44ff' },
  overload:  { msg: '⚡ Data Overload: Wild columns expanded', color: '#ff8800' },
  overclock: { msg: '🔥 System Overclock: symbol multipliers', color: '#ff8800' },
  cloning:   { msg: '🧬 Data Cloning: symbols split ×2', color: '#00ff88' },
  root:      { msg: '🌧️ Root Access: reels split', color: '#00ff88' },
  surge:     { msg: '⚡ Power Surge: symbols → Wild + shockwave', color: '#ffff00' },
  glitch:    { msg: '📺 System Glitch: non-wins shuffled', color: '#aa44ff' },
  scan:      { msg: '🎯 Algorithmic Scan: targets → Wild', color: '#00f0ff' },
  bandwidth: { msg: '📶 Bandwidth Multiplier active', color: '#ff8800' },
  bypass:    { msg: '↔️ Bypass Protocol: L→R + R→L pays', color: '#00f0ff' },
};

export function mapServerFeatureName(name) {
  if (!name) return null;
  if (SERVER_FEATURE_MAP[name]) return SERVER_FEATURE_MAP[name];
  const lower = String(name).toLowerCase();
  const hit = FEATURES.find(f => f.id === lower || f.name.toLowerCase().replace(/\s+/g, '') === lower);
  return hit?.id || null;
}

export function mapFeatureNameList(names) {
  if (!Array.isArray(names)) return [];
  const ids = [];
  for (const n of names) {
    const id = mapServerFeatureName(n);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return FEATURES.map(f => f.id).filter(id => ids.includes(id));
}

/** cellMultipliers server: key "row,reel" → multiplier */
export function applyCellMultipliers(map) {
  if (!map || typeof map !== 'object') return;
  for (const [k, mult] of Object.entries(map)) {
    const parts = String(k).split(',').map(Number);
    if (parts.length < 2 || parts.some(Number.isNaN)) continue;
    const [a, b] = parts;
    let reel = -1, row = -1;
    // Ưu tiên row,reel (đã verify từ payload SystemOverclock)
    if (a >= 0 && a < ROWS && b >= 0 && b < REELS) {
      row = a; reel = b;
    } else if (a >= 0 && a < REELS && b >= 0 && b < ROWS) {
      reel = a; row = b;
    }
    if (reel >= 0 && row >= 0 && state.cellMeta?.[reel]?.[row]) {
      // Wild overlay drops Class Upgrade — never stamp M onto a Wild cell.
      if (state.grid?.[reel]?.[row] === 'W') continue;
      state.cellMeta[reel][row].multiplier = Number(mult) || 1;
    }
  }
}

/**
 * Parse full spin/join payload → cấu trúc dùng cho VFX online.
 * Contract VFX (live 1500): features.baseScreen + features.featureSteps
 * — docs/FE_SPIN_VFX_GUIDE.md · REAL_RESPONSES.md §5.1
 */
export function parseOnlineRound(payload) {
  const data = payload?.data || {};
  const round = data.round || data;
  const result = round.result || round;
  const stage = result.stages?.[0] || payload?.stages?.[0] || {};
  const featuresObj = result.features || payload?.features || {};
  // Final grid (payout) — stages[0].screen
  const screen = extractServerScreen(payload) || stage.screen || null;
  const splitCounts = featuresObj.splitCounts || null;

  // Pre-feature landing grid (omit khi không có mini-feature)
  const baseScreen = Array.isArray(featuresObj.baseScreen) && featuresObj.baseScreen.length === REELS
    ? featuresObj.baseScreen
    : null;
  // One entry / executed feature, GDD execution order
  const featureSteps = Array.isArray(featuresObj.featureSteps) ? featuresObj.featureSteps : [];

  // Ưu tiên spinFeatures; fallback map từ featureSteps[].name (cùng order server)
  const spinNames = featuresObj.spinFeatures || featuresObj.features
    || (featureSteps.length ? featureSteps.map(s => s?.name).filter(Boolean) : []);
  const spinIds = mapFeatureNameList(spinNames);
  const activeIds = mapFeatureNameList(featuresObj.activeFeatures || []);
  // Meter: active (persistent FS) ∪ spin features — giữ GDD order từ FEATURES list
  const orderedIds = FEATURES.map(f => f.id).filter(id => spinIds.includes(id) || activeIds.includes(id));
  const featObjs = orderedIds.map(id => FEATURES.find(f => f.id === id)).filter(Boolean);
  const activeFeatObjs = activeIds.map(id => FEATURES.find(f => f.id === id)).filter(Boolean);

  const rawWins = stage.wins || [];
  const wins = rawWins.map(w => ({
    sym: SYM_MAP[w.symbol] || 'A',
    length: Number(w.occurs) || 3,
    win: parseFloat(w.win) || 0,
    direction: String(w.type || '').includes('rtl') ? 'rtl' : 'ltr',
    positions: Array.isArray(w.positions) ? w.positions : null,
    reelPositions: [1, 1, 1],
  }));

  // totalWin của spin hiện tại (không lấy superRound — đó là session FS)
  // Bandwidth đã nhân sẵn trong wins / totalWin
  const totalWin = parseFloat(round.totalWin ?? stage.totalWin ?? payload?.totalWin ?? 0) || 0;
  const superRoundTotalWin = parseFloat(result.superRound?.totalWin ?? round.superRound?.totalWin ?? NaN);

  const freeSpins = featuresObj.freeSpins || featuresObj.freeSpin || null;
  const thisMode = String(result.thisMode || round.thisMode || '').toLowerCase();
  const nextMode = String(result.nextMode || round.nextMode || '').toLowerCase();
  const roundType = String(round.type || result.thisMode || '').toLowerCase();
  const endsSuperround = !!(round.endsSuperround ?? result.superRound?.ends);
  const maxWinReached = !!(featuresObj.maxWinReached || result.maxWinReached);
  // Final matrix mult; key "row,col" (khác pos [col,row])
  const cellMultipliers = featuresObj.cellMultipliers || null;

  // Core Hack — only present when won this spin (REAL_RESPONSES §5)
  const progressiveJackpot =
    featuresObj.progressiveJackpot ||
    result.progressiveJackpot ||
    payload?.progressiveJackpot ||
    null;

  const roundId = String(round.roundId || payload?.roundId || result.roundId || '');
  const spinId = String(
    round.spinId ||
      round.transactionId?.spinId ||
      payload?.spinId ||
      ''
  );

  return {
    screen,
    baseScreen,
    featureSteps,
    stage,
    round,
    result,
    control: data.control || {},
    splitCounts,
    featObjs,
    orderedIds,
    activeIds,
    activeFeatObjs,
    wins,
    totalWin,
    superRoundTotalWin: Number.isFinite(superRoundTotalWin) ? superRoundTotalWin : null,
    freeSpins,
    thisMode,
    nextMode,
    roundType,
    endsSuperround,
    maxWinReached,
    cellMultipliers,
    progressiveJackpot,
    roundId,
    spinId,
  };
}

/**
 * Restore grid / balance / mid-FS từ JOIN(1005) hoặc LAST_SESSION(1502).
 * Không mở modal trigger FS — silent resume.
 */
export function restoreOnlineSessionFromPayload(payload, { autoContinueFs = false } = {}) {
  if (!payload) return;
  applyOnlineBalance(payload, { syncBefore: true });
  const parsed = parseOnlineRound(payload);
  if (parsed.screen) {
    applyServerScreen(parsed.screen, parsed.splitCounts);
    applyCellMultipliers(parsed.cellMultipliers);
  }
  const tb = parseFloat(
    payload.totalBet ||
      payload.data?.round?.totalBet ||
      parsed.round?.totalBet ||
      ''
  );
  if (!Number.isNaN(tb) && tb > 0) {
    state.bet = tb;
    updateUI();
  }

  const remain =
    parsed.freeSpins != null
      ? Number(parsed.freeSpins.remain ?? parsed.freeSpins.remaining ?? NaN)
      : NaN;
  const total =
    parsed.freeSpins != null
      ? Number(parsed.freeSpins.total ?? parsed.freeSpins.count ?? remain)
      : NaN;
  const midFs =
    parsed.nextMode === 'free' ||
    parsed.thisMode === 'free' ||
    (Number.isFinite(remain) && remain > 0);

  if (midFs) {
    state.inFreeSpins = true;
    state.fsRemaining = Number.isFinite(remain) ? remain : 0;
    state.fsTotal = Number.isFinite(total) ? total : state.fsRemaining;
    if (parsed.activeFeatObjs?.length) {
      state.persistentFeatures = parsed.activeFeatObjs;
      state.fsActiveFeatures = parsed.activeFeatObjs;
    }
    if (parsed.superRoundTotalWin != null) {
      state.fsSessionWin = parsed.superRoundTotalWin;
    }
    document.getElementById('fsBanner')?.classList.add('visible');
    updateFSBanner();
    renderFeatureMeter([
      ...(state.persistentFeatures || []).map(f => f.id),
    ]);
    showToast(
      `Resumed Free Spins — ${state.fsRemaining} left` +
        (parsed.activeFeatObjs?.length
          ? ` · ${parsed.activeFeatObjs.map(f => f.name).join(', ')}`
          : ''),
      '#aa44ff'
    );
    if (autoContinueFs && state.fsRemaining > 0 && !state.spinning) {
      setTimeout(() => {
        if (state.inFreeSpins && state.fsRemaining > 0 && !state.spinning) {
          continueAfterSpin();
        }
      }, 600);
    }
  } else {
    state.inFreeSpins = false;
    state.fsRemaining = 0;
    state.persistentFeatures = [];
    document.getElementById('fsBanner')?.classList.remove('visible');
    renderFeatureMeter([]);
  }
}

/**
 * Cập nhật state Free Spins từ response server.
 * Protocol:
 *  - Trigger: thisMode=base, nextMode=free, freeSpins:{total,remain}
 *  - During: thisMode=free, nextMode=free, freeSpins.remain
 *  - End: thisMode=free, nextMode=base, endsSuperround=true (freeSpins có thể null)
 */
export async function applyOnlineFreeSpinFlow(parsed, wasInFS, spinWin) {
  const {
    freeSpins, thisMode, nextMode, endsSuperround,
    activeFeatObjs, superRoundTotalWin, featObjs,
  } = parsed;

  const remain = freeSpins != null ? Number(freeSpins.remain ?? freeSpins.remaining ?? 0) : null;
  const total = freeSpins != null ? Number(freeSpins.total ?? freeSpins.count ?? remain ?? 0) : null;
  const entering = !wasInFS && (nextMode === 'free' || (remain != null && remain > 0 && nextMode !== 'base'));
  const inFreeNow = wasInFS || thisMode === 'free' || nextMode === 'free' || entering;

  if (entering) {
    const features = activeFeatObjs.length ? activeFeatObjs : featObjs;
    await triggerFreeSpins(0, {
      features,
      remain: remain != null ? remain : 7,
      total: total != null ? total : 7,
      sessionWin: spinWin || 0,
    });
    return 'entered';
  }

  if (!inFreeNow && !wasInFS) return 'none';

  // Đang trong FS
  if (activeFeatObjs.length) {
    state.persistentFeatures = activeFeatObjs;
  }
  if (remain != null) {
    state.fsRemaining = remain;
    if (total != null) state.fsTotal = total;
  }
  if (superRoundTotalWin != null) {
    state.fsSessionWin = superRoundTotalWin;
  } else {
    state.fsSessionWin = (state.fsSessionWin || 0) + (spinWin || 0);
  }
  state.inFreeSpins = true;
  document.getElementById('fsBanner').classList.add('visible');
  updateFSBanner();

  // Kết thúc FS: server báo nextMode=base (thường kèm endsSuperround)
  // remain có thể null ở spin cuối
  const ending =
    (wasInFS || thisMode === 'free') &&
    (nextMode === 'base' || (remain != null && remain <= 0 && nextMode !== 'free'));

  if (ending) {
    state.fsRemaining = 0;
    if (superRoundTotalWin != null) state.fsSessionWin = superRoundTotalWin;
    await endFreeSpins();
    return 'ended';
  }

  // remain=0 nhưng nextMode vẫn free → chờ spin kế (hiếm); không auto-loop
  if (remain != null && remain <= 0) {
    state.fsRemaining = 0;
  }

  return 'continue';
}

export async function presentOnlineFeature(feat) {
  if (!feat) return;
  const p = FEATURE_PRESENT[feat.id] || { msg: feat.name, color: feat.color || 'var(--cyan)' };
  showToast(p.msg, p.color);
  renderFeatureMeter((state.triggeredFeatures || []).map(f => f.id));
  await sleepRaw(state.fastSpin ? 380 : 750);
}

export async function presentOnlineFeatureSequence(featObjs, phase) {
  // Fallback khi server không gửi featureSteps — vẫn banner + meter pulse
  for (const f of featObjs) {
    if (f.timing !== phase) continue;
    setMeterStepActive(f.id);
    showVfxBanner(f.name, f.id);
    await presentOnlineFeature(f);
    if (f.id === 'bypass') {
      state.bypassProtocol = true;
      document.getElementById('vfxBypassArrows')?.classList.add('show');
      await sleepRaw(vfxMs(500, 180));
      document.getElementById('vfxBypassArrows')?.classList.remove('show');
    }
    if (f.id === 'bandwidth') {
      const box = document.getElementById('multDisplay');
      if (box) {
        box.parentElement?.classList.remove('bump');
        void box.parentElement?.offsetWidth;
        box.parentElement?.classList.add('bump');
      }
    }
    hideVfxBanner();
  }
  clearMeterStepActive();
}
