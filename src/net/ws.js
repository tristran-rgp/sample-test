// src/net/ws.js — extracted from main.js
import { accessToken, intentionalWsClose, online, onlineBalance, pendingSpinData, pendingSpinResolve, pingSeq, pingTimer, reconnectTimer, sessionAgencyId, sessionUserId, sessionUsername, setOnlineBalance, setPendingSpinData, setPendingSpinResolve, setPingSeq, setPingTimer, setReconnectTimer, setSessionAgencyId, setSessionUserId, setSessionUsername, setWs, setWsSessionId, state, ws, wsSessionId } from '../core/state.js';
import { fmt, sleepRaw } from '../core/utils.js';
import { CORE_HACK, REELS, REEL_STRIPS, SYMBOLS, SYM_MAP, WIN_CAP } from '../game/config.js';
import { beginFx, settleAfterSpinPresentation } from '../game/flow.js';
import { continueAfterSpin, stopAutoSpin, updateAutoUI } from '../game/fsAuto.js';
import { createEmptyGrid } from '../game/grid.js';
import { onJackpotAutoPayPush, onJackpotWinPush, playJackpot, resumeActiveClaim } from '../game/jackpot.js';
import { captureLastFeatureReplay, renderLastSpinFeatureMeter, screenToForcedResults } from '../game/replay.js';
import { FEATURE_PRESENT, applyCellMultipliers, applyOnlineBalance, applyOnlineFreeSpinFlow, applyServerScreen, handleForceLogout, mapServerFeatureName, parseOnlineRound, presentOnlineFeatureSequence, resolvePendingCmd, restoreOnlineSessionFromPayload, returnToLogin } from './session.js';
import { closeModal, openModal, showToast } from '../ui/feedback.js';
import { animateReelSpin } from '../ui/reels.js';
import { captureBalanceBefore, renderFeatureMeter, renderGrid, setInfoBar, syncPerfMode, updateUI } from '../ui/render.js';
import { celebrateWinPro, clearMeterStepActive, clearVfxStage, hideVfxBanner, showVfxBanner, vfxMs } from '../ui/vfx/core.js';
import { presentFeatureSteps } from '../ui/vfx/steps.js';
import { animateWinWays, buildWinExplainFromLastInSpin, captureLastInSpin } from '../ui/winExplain.js';
import { playWinEffect, tickerWin } from '../ui/winfx.js';
import { logWsTraffic } from '../ui/wsTrafficDock.js';

export function setConnState(state, msg) {
  const bar = document.getElementById('connBar');
  const dot = document.getElementById('connDot');
  const txt = document.getElementById('connText');
  if (!bar) return;
  if (state === 'connected') {
    bar.style.display = 'flex';
    dot.style.background = 'var(--green)';
    dot.style.boxShadow = '0 0 6px var(--green)';
    txt.textContent = msg || 'Connected';
    txt.style.color = 'var(--green)';
  } else if (state === 'connecting') {
    bar.style.display = 'flex';
    dot.style.background = 'var(--orange)';
    dot.style.boxShadow = '0 0 6px var(--orange)';
    txt.textContent = msg || 'Connecting...';
    txt.style.color = 'var(--orange)';
  } else {
    bar.style.display = 'flex';
    dot.style.background = 'var(--red)';
    dot.style.boxShadow = '0 0 6px var(--red)';
    txt.textContent = msg || 'Disconnected';
    txt.style.color = 'var(--red)';
  }
}

export function sendWS(data) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showToast('Not connected', '#ff3355');
    try { logWsTraffic('err', data, 'send-failed: not connected'); } catch (_) {}
    return false;
  }
  try {
    ws.send(JSON.stringify(data));
    try { logWsTraffic('out', data); } catch (_) {}
    return true;
  } catch (err) {
    try { logWsTraffic('err', data, String(err?.message || err)); } catch (_) {}
    return false;
  }
}

export function wsInit() {
  const agentId = resolveSessionAgencyId();
  return sendWS([1, "MiniGame", "", "", { agentId, accessToken, reconnect: false }]);
}

/** Prefer stored session → input → hostname from srvUrl (agency001.xxx → agency001). */
export function resolveSessionAgencyId() {
  const fromInput = document.getElementById('cheatAgencyId')?.value?.trim();
  if (sessionAgencyId) return sessionAgencyId;
  if (fromInput) return fromInput;
  return deriveAgencyFromSrvUrl() || 'AGENCY_001';
}

export function resolveSessionUserId() {
  const fromInput = document.getElementById('cheatUserId')?.value?.trim();
  if (sessionUserId) return sessionUserId;
  if (fromInput) return fromInput;
  if (sessionUsername) return sessionUsername;
  return document.getElementById('loginUser')?.value?.trim() || '';
}

export function deriveAgencyFromSrvUrl() {
  try {
    const raw = document.getElementById('srvUrl')?.value || '';
    const host = new URL(raw).hostname || '';
    // agency001.relaxwmestu.xyz → agency001
    const sub = host.split('.')[0] || '';
    if (!sub || sub === 'localhost' || /^\d+$/.test(sub)) return '';
    return sub;
  } catch (_) {
    return '';
  }
}

/**
 * Capture agency/user from login / play-game / any game payload.
 * Does not overwrite non-empty session* unless force.
 */
export function captureSessionIdentity(src, { force = false } = {}) {
  if (!src || typeof src !== 'object') return;
  const agency =
    src.agencyId ||
    src.agency_id ||
    src.agentId ||
    src.agent_id ||
    src.agency ||
    src.operatorId ||
    src.agent ||
    src.data?.agencyId ||
    src.data?.agency_id ||
    src.data?.agentId ||
    null;
  const userId =
    src.userId ||
    src.user_id ||
    src.uid ||
    src.memberId ||
    src.member_id ||
    src.data?.userId ||
    src.data?.user_id ||
    null;
  const username =
    src.username ||
    src.userName ||
    src.user_name ||
    src.displayName ||
    src.display_name ||
    null;
  if (agency && (force || !sessionAgencyId)) setSessionAgencyId(String(agency));
  if (userId && (force || !sessionUserId)) setSessionUserId(String(userId));
  if (username && (force || !sessionUsername)) setSessionUsername(String(username));
}

export function syncCheatSessionFields() {
  const agencyEl = document.getElementById('cheatAgencyId');
  const userEl = document.getElementById('cheatUserId');
  const badge = document.getElementById('cheatSessionBadge');
  const agency = resolveSessionAgencyId();
  const userId = resolveSessionUserId();
  if (agencyEl && (!agencyEl.value.trim() || agencyEl.dataset.auto !== '0')) {
    agencyEl.value = agency;
    agencyEl.dataset.auto = agencyEl.dataset.auto || '1';
  }
  if (userEl && (!userEl.value.trim() || userEl.dataset.auto !== '0')) {
    userEl.value = userId;
    userEl.dataset.auto = userEl.dataset.auto || '1';
  }
  if (badge) {
    badge.innerHTML =
      `<strong>agency</strong>=${agency || '—'} · ` +
      `<strong>userId</strong>=${userId || '—'} · ` +
      `<strong>user</strong>=${sessionUsername || document.getElementById('loginUser')?.value || '—'} · ` +
      `<strong>session</strong>=${wsSessionId || '—'}`;
  }
}

export function wsJoin() {
  const gid = document.getElementById('gameId').value;
  return sendWS([6, "MiniGame", gid, { cmd: "1005" }]);
}

export function wsSpin(bet) {
  const gid = document.getElementById('gameId').value;
  return sendWS([6, "MiniGame", gid, { cmd: "1500", bet: bet.toString() }]);
}

export function wsGetBalance() {
  const gid = document.getElementById('gameId').value;
  return sendWS([6, "MiniGame", gid, { cmd: "1503" }]);
}

/** LAST_SESSION (1502) — same shape as init; backup resume after JOIN */
export function wsLastSession() {
  const gid = document.getElementById('gameId').value;
  return sendWS([6, 'MiniGame', gid, { cmd: '1502' }]);
}

/**
 * BUY_FEATURE (cmd 1501) — be-zero-day PluginCommand.BUY_FEATURE
 * feature: FS1–FS4 | scatterBooster | 3Features | 12Features
 * Response = full spin result (type result).
 */
export function wsBuyFeature(feature, bet) {
  const gid = document.getElementById('gameId').value;
  return sendWS([6, "MiniGame", gid, {
    cmd: "1501",
    bet: String(bet),
    feature: String(feature),
  }]);
}

export function connectWS() {
  if (ws) { ws.close(); setWs(null); }
  if (reconnectTimer) { clearTimeout(reconnectTimer); setReconnectTimer(null); }

  const url = document.getElementById('wsUrl').value;
  setConnState('connecting', 'Connecting...');

  setWs(new WebSocket(url));

  ws.onopen = () => {
    setConnState('connected', 'Authenticating...');
    wsInit();
    if (pingTimer) clearInterval(pingTimer);
    setPingSeq(0);
    setPingTimer(setInterval(() => {
      const next = pingSeq + 1;
      setPingSeq(next);
      sendWS(["7", "MiniGame", "1", next]);
    }, 15000));
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      try { logWsTraffic('in', msg); } catch (_) {}
      // Bắt IN SPIN sớm (frame [5,{cmd:1500|1501,...}]) cho win explain
      try {
        if (Array.isArray(msg) && (msg[0] === 5 || msg[0] === '5') && msg[1] && typeof msg[1] === 'object') {
          const c = String(msg[1].cmd ?? '');
          if (c === '1500' || c === '1501') captureLastInSpin(msg, msg[1]);
        } else if (msg && typeof msg === 'object' && (String(msg.cmd) === '1500' || String(msg.cmd) === '1501')) {
          captureLastInSpin(msg, msg);
        }
      } catch (_) { /* ignore */ }
      handleWSMessage(msg);
    } catch (_) {
      // binary / non-JSON
      try { logWsTraffic('in', e.data, 'non-json'); } catch (__) {}
    }
  };

  ws.onclose = () => {
    if (pingTimer) { clearInterval(pingTimer); setPingTimer(null); }
    setWs(null);
    if (pendingSpinResolve) {
      pendingSpinResolve(false);
      setPendingSpinResolve(null);
    }
    // Already handled by returnToLogin / intentional close
    if (intentionalWsClose || !online) {
      setConnState('disconnected', 'Disconnected');
      const sessionLabel = document.getElementById('sessionLabel');
      if (sessionLabel) sessionLabel.textContent = '';
      return;
    }
    // Unexpected drop while still "online" — kick back to login so user re-auths
    returnToLogin({
      message: 'Connection lost. Please log in again.',
      color: '#ff8800',
    });
  };

  ws.onerror = () => {
    if (!intentionalWsClose) {
      setConnState('disconnected', 'Connection error');
    }
  };
}

export function handleWSMessage(msg) {
  if (!Array.isArray(msg) || msg.length < 2) return;

  const type = msg[0];

  // Auth response: [1, true, 0, sessionId, zone, null]
  if (type === 1 && msg[1] === true) {
    setWsSessionId(msg[3] || '');
    document.getElementById('sessionLabel').textContent = 'Session: ' + wsSessionId;
    setConnState('connected', 'Connected');
    showToast('Auth OK — joining game', '#00ff88');
    wsJoin();
    return;
  }

  // Error: [0, { errorMessage, ... }]
  if (type === 0 && msg[1]?.errorMessage) {
    showToast('WS Error: ' + msg[1].errorMessage, '#ff3355');
    return;
  }

  // Gateway ping response: [6, 1, seq]
  if (type === 6 && msg[1] === 1) return;

  // Game response: [5, payload]
  if (type === 5 && msg[1]) {
    const payload = msg[1];
    const cmd = String(payload.cmd ?? '');

    // FORCE_LOGOUT / session takeover — clear session & back to login (before c-check)
    // e.g. [5, { reason:"session_takeover", c:0, cmd:1006, message:"You have logged in from another device." }]
    if (cmd === '1006' || payload.reason === 'session_takeover') {
      handleForceLogout(payload);
      return;
    }

    const c = payload.c;

    if (c !== undefined && c !== null && c != 0) {
      showToast('Server error: ' + (payload.msg || payload.message || 'code ' + c), '#ff3355');
      if (pendingSpinResolve) { pendingSpinResolve(false); setPendingSpinResolve(null); }
      // Fail any waiting cmd (history/detail/etc.)
      if (cmd) resolvePendingCmd(cmd, null);
      // Gate: a pending Core Hack claim blocks SPIN/BUY — reopen the claim UI.
      if (c === 1362) resumeActiveClaim();
      return;
    }

    switch (cmd) {
      case '1005': { // JOIN — init screen + balance + mid-FS restore
        showToast('Game joined — ready to spin!', '#00ff88');
        document.getElementById('btnSpin').disabled = false;
        captureSessionIdentity(payload);
        captureSessionIdentity(payload?.data || {});
        captureSessionIdentity(payload?.data?.control || {});
        syncCheatSessionFields();
        restoreOnlineSessionFromPayload(payload, { autoContinueFs: true });
        resumePendingJackpot(payload);
        // Backup LAST_SESSION nếu JOIN thiếu freeSpins nhưng server có state
        setTimeout(() => {
          if (online && ws?.readyState === WebSocket.OPEN && !state.inFreeSpins) {
            wsLastSession();
          }
        }, 400);
        break;
      }

      case '1500': // SPIN
        handleSpinResponse(payload);
        break;

      case '1503': // GET_BALANCE
        applyOnlineBalance(payload, { syncBefore: !state.spinning });
        break;

      case '1501': // BUY_FEATURE — FS / scatter / 3 / 12 → full spin result
        handleSpinResponse(payload);
        break;

      case '1502': // LAST_SESSION — same init shape as JOIN
        restoreOnlineSessionFromPayload(payload, { autoContinueFs: !state.spinning });
        resumePendingJackpot(payload);
        resolvePendingCmd('1502', payload);
        break;

      case '1504': // GET_SPIN_LIST
        resolvePendingCmd('1504', payload);
        break;

      case '1505': // GET_SESSION_ROUNDS
        resolvePendingCmd('1505', payload);
        break;

      case '1506': // GET_SPIN_DETAIL
        resolvePendingCmd('1506', payload);
        break;

      case '1507': // JACKPOT_HISTORY
        resolvePendingCmd('1507', payload);
        break;

      case '1998': // GET_ACTIVE_SESSIONS — active session list for cheat targeting
        resolvePendingCmd('1998', payload);
        break;

      case '1999': // CHEAT (dev/staging)
        resolvePendingCmd('1999', payload);
        break;

      case '1509': // JACKPOT_REVEAL response — or unsolicited TTL auto-pay Match-3 push
        if (!resolvePendingCmd('1509', payload)) {
          onJackpotAutoPayPush(payload);
        }
        break;

      case '9000': // JACKPOT_WIN real-time push — resolves an active claim modal
        onJackpotWinPush(payload);
        break;

      case '1531': // BALANCE_UPDATED push
        applyOnlineBalance(payload, { syncBefore: !state.spinning });
        break;
    }
  }
}

/**
 * Reconnect resume: if the joined/last-session payload still carries a live Core Hack
 * claim (2-phase pending), reopen the pick-and-click UI with already-opened cells
 * (`opened:[{index,tier}]` from BE — tiers required so a new tab can redraw icons).
 * Expired claims are not delivered here, so nothing is opened for them.
 */
export function resumePendingJackpot(payload) {
  try {
    const pjp = parseOnlineRound(payload).progressiveJackpot;
    if (pjp && pjp.pending && pjp.winId) {
      playJackpot(pjp); // routes to 2-phase playCoreHack (idempotent per winId)
    }
  } catch (_) {
    /* ignore parse errors */
  }
}

export function handleSpinResponse(payload) {
  const parsed = parseOnlineRound(payload);
  if (!parsed.screen || !Array.isArray(parsed.screen) || parsed.screen.length !== REELS) {
    if (pendingSpinResolve) { pendingSpinResolve(false); setPendingSpinResolve(null); }
    return;
  }

  // Lưu IN SPIN làm nguồn authoritative cho panel giải thích win
  captureLastInSpin(payload, payload);

  // Không sync BEFORE — giữ snapshot lúc bấm spin (trước kết quả)
  applyOnlineBalance(payload, { syncBefore: false });
  setPendingSpinData({ payload, ...parsed });

  if (pendingSpinResolve) {
    pendingSpinResolve(true);
    setPendingSpinResolve(null);
  }
}

/**
 * Online spin / buy feature.
 * @param {{ buyFeature?: string, buyCostHint?: number }} opts
 *   buyFeature: FS1–FS4 | scatterBooster | 3Features | 12Features → cmd 1501
 */
export async function doOnlineSpin(opts = {}) {
  if (state.spinning || state.fxPlaying) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    showToast('Not connected to server', '#ff3355');
    stopAutoSpin('Disconnected — autospin stopped');
    return;
  }

  const buyFeature = opts.buyFeature || null;
  const isBuy = !!buyFeature;
  const bet = state.bet;
  const wasInFS = state.inFreeSpins;

  if (isBuy && (wasInFS || state.inFreeSpins)) {
    showToast('Cannot buy during Free Spins', '#ff8800');
    return;
  }

  state.spinning = true;
  syncPerfMode();
  state.lastWin = 0;
  state.globalMultiplier = 1;
  state.bypassProtocol = false;
  state.triggeredFeatures = [];
  document.getElementById('multDisplay').textContent = '01';
  document.getElementById('btnSpin').disabled = true;
  setInfoBar(
    'idle',
    isBuy
      ? `BUY_FEATURE ${buyFeature}...`
      : (state.inFreeSpins ? `Free Spin — ${state.fsRemaining} left` : 'Spinning...')
  );

  // Base spin: trừ bet local (server cũng trừ). Free Spins: không trừ.
  // Buy (1501): server trừ phí — optimistic buyCostHint + rollback nếu fail
  if (isBuy) {
    const hint = Number(opts.buyCostHint) || 0;
    if (hint > 0 && state.balance < hint) {
      showToast('Insufficient balance!', '#ff3355');
      state.spinning = false;
      document.getElementById('btnSpin').disabled = false;
      return;
    }
    if (hint > 0) {
      state.balance -= hint;
    }
    showToast(`BUY_FEATURE ${buyFeature} — ${hint ? fmt(hint) : 'server cost'}`, '#aa44ff');
  } else if (!state.inFreeSpins) {
    const cost = bet;
    if (state.balance < cost) {
      showToast('Insufficient balance!', '#ff3355');
      stopAutoSpin('Autospin stopped — insufficient balance');
      state.spinning = false;
      document.getElementById('btnSpin').disabled = false;
      return;
    }
    state.balance -= cost;
  }

  // Snapshot sau trừ bet/phí — BEFORE = số dư khi đang chờ kết quả win/lose
  captureBalanceBefore();
  updateUI();

  setPendingSpinData(null);
  if (isBuy) {
    wsBuyFeature(buyFeature, bet);
  } else {
    wsSpin(bet);
  }

  const ok = await new Promise(resolve => {
    setPendingSpinResolve(resolve);
    setTimeout(() => {
      if (pendingSpinResolve) {
        pendingSpinResolve(false);
        setPendingSpinResolve(null);
        showToast(isBuy ? 'Buy feature timeout' : 'Spin timeout', '#ff3355');
      }
    }, 20000);
  });

  if (!ok || !pendingSpinData?.screen) {
    // Rollback optimistic deduct
    if (isBuy && opts.buyCostHint) {
      state.balance += Number(opts.buyCostHint) || 0;
      updateUI();
    } else if (!wasInFS && !isBuy) {
      state.balance += bet;
      updateUI();
    }
    state.spinning = false;
    document.getElementById('btnSpin').disabled = false;
    if (!isBuy) stopAutoSpin('Autospin stopped — spin failed');
    else showToast(`Buy feature failed (${buyFeature})`, '#ff3355');
    return;
  }

  const parsed = pendingSpinData;
  const {
    screen, baseScreen, featureSteps, splitCounts, featObjs, wins, totalWin,
    maxWinReached, control, payload, cellMultipliers, activeIds,
    progressiveJackpot, roundId, spinId, thisMode,
  } = parsed;

  // Feature meter: Core Hack #1 (if JP) + FS persistent + spin features
  state.triggeredFeatures = featObjs;
  const jp = progressiveJackpot;
  const jpOn = !!(jp && (jp.isTriggered === true || jp.isTriggered === 'true' || jp.tier));
  state.lastJackpotActive = jpOn;
  const meterIds = [
    ...(jpOn ? [CORE_HACK.id] : []),
    ...((state.persistentFeatures || []).map(f => f.id)),
    ...featObjs.map(f => f.id),
    ...(activeIds || []),
  ].filter((id, i, arr) => arr.indexOf(id) === i);
  renderFeatureMeter(meterIds);

  // ── Full semantic VFX (FE_SPIN_VFX_GUIDE) ───────────────────
  // 1) Land reels on baseScreen (pre-feature). Fallback: final screen.
  // 2) Full presenters per featureSteps (GDD order).
  // 3) Snap authority: stages[0].screen + splitCounts + cellMultipliers.
  // 4) Jackpot pick + win ways (LTR/RTL) — wins đã settle server-side.

  const landScreen = baseScreen || screen;
  const hasStepTrace = Array.isArray(featureSteps) && featureSteps.length > 0;

  // Cleanup residual VFX chrome
  hideVfxBanner();
  clearMeterStepActive();
  document.getElementById('vfxBypassArrows')?.classList.remove('show');
  document.getElementById('vfxBwBar')?.classList.remove('show');

  // 1) Firewall announce during reel spin (timing=spin)
  let firewallAnnounced = false;
  if (hasStepTrace) {
    const fw = featureSteps.find(s => mapServerFeatureName(s?.name) === 'firewall');
    if (fw) {
      const lows = Array.isArray(fw.bannedLows)
        ? fw.bannedLows.map(id => SYMBOLS[SYM_MAP[id]]?.name || id).join(', ')
        : '';
      showVfxBanner(lows ? `Firewall active — ban ${lows}` : 'Firewall Block', 'firewall');
      showToast(
        lows ? `🔥 Firewall Block: ${lows} blocked` : FEATURE_PRESENT.firewall.msg,
        FEATURE_PRESENT.firewall.color
      );
      firewallAnnounced = true;
    }
  } else {
    for (const f of featObjs.filter(x => x.timing === 'spin')) {
      const p = FEATURE_PRESENT[f.id];
      if (p) {
        showVfxBanner(f.name, f.id);
        showToast(p.msg, p.color);
      }
    }
  }

  // 2) Animate reels → land on base (or final if no baseScreen)
  const forcedResults = screenToForcedResults(landScreen);
  createEmptyGrid();
  await animateReelSpin(REEL_STRIPS.map(s => s), forcedResults);
  hideVfxBanner();

  // 3) Show landing grid (split/mult come from steps / final snap)
  applyServerScreen(landScreen, null);
  renderGrid();
  if (hasStepTrace || featObjs.length) {
    showVfxBanner('Features resolving…', '');
    await sleepRaw(vfxMs(220, 70));
    hideVfxBanner();
  }

  // 4) Feature VFX + Win — giữ spinning=true đến khi settle xong
  beginFx();
  try {
    if (hasStepTrace) {
      await presentFeatureSteps(featureSteps, { firewallAnnounced });
    } else if (featObjs.length) {
      await presentOnlineFeatureSequence(featObjs, 'post');
      await presentOnlineFeatureSequence(featObjs, 'win');
    }

    // 5) Authority snap — final grid always from stages[0].screen
    applyServerScreen(screen, splitCounts);
    applyCellMultipliers(cellMultipliers);
    if (hasStepTrace) {
      captureLastFeatureReplay({
        featureSteps,
        featObjs,
        baseScreen: landScreen,
        finalScreen: screen,
        splitCounts,
        cellMultipliers,
        finalGlobalMult: state.globalMultiplier,
        finalBypass: state.bypassProtocol,
      });
    } else {
      state.lastFeatureReplay = null;
    }
    // Bandwidth mult display if step set it; ensure UI matches
    if (state.globalMultiplier > 1) {
      const box = document.getElementById('multDisplay');
      if (box) box.textContent = String(state.globalMultiplier).padStart(2, '0');
    }
    renderGrid();

    // 5b) Core Hack jackpot — pick-and-click VFX (win đã nằm trong totalWin).
    // Capture the paid amount so the post-spin balance section knows not to
    // overwrite the paid balance (control.balance is pre-JP-pay).
    let jpAmount = 0;
    if (jpOn) {
      jpAmount = await playJackpot(jp);
    }

    // Balance từ server
    if (jpAmount > 0) {
      // Balance đã mirror bởi applyOnlineBalance trong revealCell — không overwrite.
    } else if (control?.balance != null && control.balance !== '') {
      setOnlineBalance(parseFloat(control.balance));
      state.balance = onlineBalance;
    } else if (payload) {
      applyOnlineBalance(payload);
    }

    state.lastWin = totalWin;

    // Breakdown win: chỉ từ IN payload (đã capture ở handleWSMessage / handleSpinResponse)
    if (payload) captureLastInSpin(payload, payload);
    else buildWinExplainFromLastInSpin();

    // Không set headerWin = total trước ticker — để cộng tiền nhìn thấy
    document.getElementById('headerWin').textContent = totalWin > 0 ? '0.00' : '0.00';

    if (spinId || roundId) {
      setInfoBar(
        'idle',
        `spinId ${spinId || '—'} · roundId ${roundId || '—'}${isBuy ? ` · buy ${buyFeature}` : ''}`
      );
    }

    if (totalWin > 0) {
      if (wins.length > 0) {
        await animateWinWays(wins, totalWin);
      } else {
        await tickerWin(0, totalWin);
      }
      // Big/Mega/Legendary: ticker lại nhanh trên overlay (header đã = total)
      await playWinEffect(totalWin);
      await celebrateWinPro(totalWin);
      document.getElementById('headerWin').textContent = totalWin.toFixed(2);
    } else {
      renderGrid();
      if (!state.inFreeSpins && !wasInFS) {
        setInfoBar('idle', 'Win up to 19,693× Bet &nbsp;•&nbsp; 3 Scatters trigger Deep Web Infiltration &nbsp;•&nbsp; Good luck, hacker');
      }
    }
  } finally {
    /* settle endFx */
  }

  // 8) Max win cap
  if (maxWinReached) {
    const cap = state.bet * WIN_CAP;
    document.getElementById('maxWinMsg').textContent =
      `Maximum Win Cap reached. Only ${fmt(Math.min(totalWin, cap))} has been awarded for this spin.`;
    openModal('modalMaxWin');
    await new Promise(r => {
      document.getElementById('closeMaxWin').onclick = () => { closeModal('modalMaxWin'); r(); };
    });
    if (state.inFreeSpins || wasInFS) state.fsRemaining = 0;
  }

  // 9) Free Spins state machine (server-driven) — modal START cũng await
  await applyOnlineFreeSpinFlow(parsed, wasInFS, totalWin);

  // 10) Đợi UI diễn HẾT FX trước khi gửi spin kế (auto/FS)
  await settleAfterSpinPresentation({
    hadWin: totalWin > 0,
    hadFeatures: (featObjs && featObjs.length > 0) || hasStepTrace,
    totalWin,
  });

  hideVfxBanner();
  clearMeterStepActive();
  clearVfxStage();

  state.spinning = false;
  state.lastJackpotActive = false;
  document.getElementById('btnSpin').disabled = false;
  updateUI();
  updateAutoUI();
  renderLastSpinFeatureMeter();

  // 11) Continue FS / Autospin — chỉ sau settle (wsSpin kế tiếp nằm trong doOnlineSpin)
  await continueAfterSpin();
}
