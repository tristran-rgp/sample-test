// src/game/jackpot.js — Core Hack (Jackpot) 2-phase reveal UI
//
// Backend contract (be-zero-day, JackpotServiceImpl / JackpotRevealHandler):
//  - Trigger (inside SPIN 1500 / BUY 1501 response): features.progressiveJackpot =
//      { isTriggered:true, pending:true, winId, expiresAt?, opened?:[{index,tier}] }
//    NO prize tier / amount / full nodes — the 15-node grid stays server-side.
//  - REVEAL cmd 1509: send { cmd:"1509", win_id, index } → response:
//      { winId, index, tier, paid, matched, opened:[{index,tier}], expiresAt?, expired? }
//      when paid=true also: tier(prize), amount, balance.
//  - opened[] always carries tier for already-opened cells so a NEW TAB can redraw
//    icons without relying on in-session FE cache (index→tier).
//  - JACKPOT_WIN push 9000: { event:"JACKPOT_WIN", winner, jackpotType, totalWin }
//  - One PENDING claim per user blocks SPIN/BUY (BE error 1362) until paid.
//  - Reconnect (JOIN 1005 / LAST_SESSION 1502): progressiveJackpot carries winId +
//    opened:[{index,tier}] only — never the full grid.
import { state } from '../core/state.js';
import { fmt, sleepRaw } from '../core/utils.js';
import {
  CORE_HACK,
  JACKPOT_CMD,
  JACKPOT_CORE_IMG,
  JACKPOT_TIERS,
  JACKPOT_TTL_SECONDS,
} from './config.js';
import { applyOnlineBalance, requestGameCmd } from '../net/session.js';
import { sfx } from '../sfx/sfx.js';
import { setImgSrc } from '../ui/assets.js';
import { closeModal, openModal, showToast } from '../ui/feedback.js';
import { renderFeatureMeter } from '../ui/render.js';
import { playJackpotClimax } from '../ui/vfx/core.js';

// Active claim controller (module-level so the 9000 push can resolve it).
let activeClaim = null;

export function jackpotEmoji(tierName) {
  return JACKPOT_TIERS.find(t => t.name === tierName)?.emoji || '◆';
}

export function jackpotTierSvg(tierName) {
  const t = String(tierName || 'USER').toUpperCase();
  if (t === 'GHOST') {
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8c-11 0-20 8-20 20v26c0 2 2.4 2.2 3.2.4L20 46l5 7c.8 1.1 2.6.4 2.6-1V48l4.4 8c.7 1.2 2.5 1.2 3.2 0L40 48v4c0 1.4 1.8 2.1 2.6 1l5-7 4.8 8.4c.8 1.8 3.2 1.6 3.2-.4V28C52 16 43 8 32 8zm-8 22a3.5 3.5 0 110-7 3.5 3.5 0 010 7zm16 0a3.5 3.5 0 110-7 3.5 3.5 0 010 7z"/></svg>';
  }
  if (t === 'ELITE') {
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8l6.4 13.6L54 24.2 43 34.6l2.8 16.2L32 43.2 18.2 50.8 21 34.6 10 24.2l15.6-2.6z"/></svg>';
  }
  if (t === 'GOD') {
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6l4 12 12-5-3 13 13 3-13 4 5 12-12-6-4 14-4-14-12 6 5-12-13-4 13-3-3-13 12 5z"/></svg>';
  }
  return '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="20" r="11"/><path d="M12 56c2-14 10-20 20-20s18 6 20 20z"/></svg>';
}

/**
 * 15 nodes: winning tier ≥3; every other tier ≤2 so match-3 chỉ đúng prize BE.
 * Giữ index server nếu đủ 15; slot trống / decoy thừa → winning tier.
 */
export function constrainJackpotNodes(rawTiers, winTier) {
  const win = String(winTier || 'USER').toUpperCase();
  const names = JACKPOT_TIERS.map(t => t.name);
  const src = Array.isArray(rawTiers) ? rawTiers.map(t => String(t || '').toUpperCase()) : [];
  const decoyUsed = {};
  names.forEach(t => { if (t !== win) decoyUsed[t] = 0; });
  const out = new Array(15);

  for (let i = 0; i < 15; i++) {
    const t = src[i];
    if (t === win) {
      out[i] = win;
    } else if (t && names.includes(t) && decoyUsed[t] < 2) {
      decoyUsed[t] += 1;
      out[i] = t;
    }
  }

  let winCount = out.filter(t => t === win).length;
  for (let i = 0; i < 15 && winCount < 3; i++) {
    if (out[i] !== win) {
      if (out[i] && decoyUsed[out[i]] != null) decoyUsed[out[i]] -= 1;
      out[i] = win;
      winCount += 1;
    }
  }

  for (let i = 0; i < 15; i++) {
    if (out[i]) continue;
    const avail = names.filter(t => t !== win && decoyUsed[t] < 2);
    if (avail.length && Math.random() < 0.5) {
      const t = avail[Math.floor(Math.random() * avail.length)];
      decoyUsed[t] += 1;
      out[i] = t;
    } else {
      out[i] = win;
    }
  }
  return out;
}

export function revealJackpotNode(node, tierName, idx) {
  const name = String(tierName || 'USER').toUpperCase();
  const num = String((idx | 0) + 1).padStart(2, '0');
  node.classList.remove('jp-resumed');
  node.classList.add('opened', 'jp-' + name);
  node.innerHTML =
    '<div class="jp-hex-wrap"><div class="jp-hex-inner">' +
    '<span class="jp-num">' + num + '</span>' +
    '<span class="jp-ico">' + jackpotTierSvg(name) + '</span>' +
    '<span class="jp-name">' + name + '</span>' +
    '</div></div>';
}

/** Legacy/index-only opened cell — known opened but tier unknown (should be rare after BE fix). */
function markResumedUnknown(node, idx) {
  const num = String((idx | 0) + 1).padStart(2, '0');
  node.classList.add('opened', 'jp-resumed');
  node.innerHTML =
    '<div class="jp-hex-wrap"><div class="jp-hex-inner">' +
    '<span class="jp-num">' + num + '</span>' +
    '<span class="jp-ico">◇</span>' +
    '<span class="jp-name">OPEN</span>' +
    '</div></div>';
}

/** Apply server opened[] into state + DOM. Prefers BE tier; falls back to session cache. */
function applyOpenedFromServer(openedList, nodeEls) {
  const list = Array.isArray(openedList) ? openedList : [];
  list.forEach(o => {
    const idx = Number(o?.index);
    if (!Number.isFinite(idx) || idx < 0 || idx > 14) return;
    const tierRaw = o?.tier || state.jackpotOpened?.[idx];
    const tier = tierRaw ? String(tierRaw).toUpperCase() : '';
    const node = nodeEls?.[idx];
    if (!node) {
      if (tier) state.jackpotOpened[idx] = tier;
      return;
    }
    if (tier) {
      state.jackpotOpened[idx] = tier;
      if (!node.classList.contains('opened') || !node.classList.contains('jp-' + tier)) {
        revealJackpotNode(node, tier, idx);
      }
    } else if (!node.classList.contains('opened')) {
      markResumedUnknown(node, idx);
    }
  });
}

/** Resume an interrupted claim from a stored/known winId (used on 1362 gate). */
export function resumeActiveClaim() {
  if (activeClaim) return Promise.resolve(false);
  const winId = state.jackpotWinId;
  const opened = state.jackpotOpened || {};
  if (!winId) return Promise.resolve(false);
  return playCoreHack({ winId, expiresAt: null, opened: Object.entries(opened).map(([i, t]) => ({ index: Number(i), tier: t })), _resumeOnly: true });
}

/**
 * Handle a JACKPOT_WIN (9000) push. Resolves the active claim modal if one is open.
 * @returns true if the push was consumed by an active claim.
 */
export function onJackpotWinPush(payload) {
  if (!activeClaim || activeClaim.finished) return false;
  const tier = payload?.jackpotType || activeClaim.targetTier || 'USER';
  const amount = Number(payload?.totalWin || activeClaim.lastAmount || 0);
  const resolve = activeClaim.done;
  activeClaim.finished = true;
  if (activeClaim.timer) clearInterval(activeClaim.timer);
  activeClaim = null;
  state.lastJackpotActive = false;
  sfx('jackpot', { gain: 1 });
  closeModal('modalJackpot');
  showToast(`🏆 JACKPOT WIN: ${fmt(amount)}!`, '#ff3355');
  if (amount > 0) {
    (async () => {
      try {
        if (typeof playJackpotClimax === 'function') await playJackpotClimax(tier, amount);
        else await sleepRaw(700);
      } catch (_) { await sleepRaw(500); }
    })();
  }
  state.jackpotWinId = null;
  state.jackpotOpened = {};
  if (resolve) resolve(amount);
  return true;
}

/**
 * Open the Core Hack pick-and-click UI for a 2-phase claim.
 * @param {{winId:string, expiresAt?:string, opened?:Array<{index:number,tier?:string}>, _resumeOnly?:boolean}} claim
 * @returns {Promise<number>} resolves with the paid amount (0 if closed without pay)
 */
export async function playCoreHack(claim) {
  const winId = claim?.winId;
  if (!winId) return 0;
    // Idempotent: never run two modals for the same winId.
    if (activeClaim && activeClaim.winId === winId) return 0;
    if (activeClaim) return 0;

  state.jackpotWinId = winId;
  // Server opened[] is source of truth for a fresh/resume claim; keep local cache only when
  // resuming from gate (1362) without a full server opened payload.
  if (!claim._resumeOnly) {
    state.jackpotOpened = {};
  } else {
    state.jackpotOpened = state.jackpotOpened || {};
  }

  sfx('charge', { gain: 0.8 });
  state.lastJackpotActive = true;
  renderFeatureMeter([
    CORE_HACK.id,
    ...((state.persistentFeatures || []).map(f => f.id)),
    ...((state.triggeredFeatures || []).map(f => f.id)),
  ].filter((id, i, a) => a.indexOf(id) === i));

  return new Promise(resolve => {
    const controller = {
      winId,
      targetTier: null,
      lastAmount: 0,
      finished: false,
      done: resolve,
      timer: null,
      expiresAt: claim.expiresAt ? new Date(claim.expiresAt).getTime() : null,
    };
    activeClaim = controller;

    const grid = document.getElementById('jackpotGrid');
    grid.innerHTML = '';
    const picksEl = document.getElementById('jackpotPicks');
    const timerEl = document.getElementById('jackpotTimer');
    if (timerEl) timerEl.textContent = '';
    picksEl.textContent = 'Decrypting Core Hack — open nodes to reveal fragments';
    openModal('modalJackpot');

    const nodeEls = [];

    const setBanner = (extra = '') => {
      const counts = {};
      Object.values(state.jackpotOpened).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
      const parts = Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(' | ');
      picksEl.textContent = (extra ? extra + ' — ' : '') + (parts || 'No fragments yet');
    };

    const buildNode = (idx) => {
      const node = document.createElement('div');
      node.className = 'jackpot-node';
      const coreImg = document.createElement('img');
      setImgSrc(coreImg, JACKPOT_CORE_IMG);
      coreImg.alt = 'Encrypted Node';
      node.appendChild(coreImg);
      node.addEventListener('click', () => onClickNode(idx, node));
      nodeEls[idx] = node;
      grid.appendChild(node);
      return node;
    };

    // Build all 15 hidden nodes first.
    for (let i = 0; i < 15; i++) buildNode(i);

    // Restore already-opened cells (reconnect / JOIN / LAST_SESSION). Prefer BE tier.
    const resumed = Array.isArray(claim.opened) ? claim.opened : [];
    applyOpenedFromServer(resumed, nodeEls);
    setBanner();
    if (resumed.length) showToast('Core Hack resumed — continue opening nodes', '#00e8ff');

    const finish = (tierName, amount, opts = {}) => {
      if (controller.finished) return;
      controller.finished = true;
      if (controller.timer) clearInterval(controller.timer);
      activeClaim = null;
      state.lastJackpotActive = false;
      sfx('jackpot', { gain: 1 });
      closeModal('modalJackpot');
      const label = opts.fromPush ? 'JACKPOT WIN' : `${tierName} JACKPOT`;
      showToast(`🏆 ${label}: ${fmt(amount)}!`, '#ff3355');
      if (amount > 0) {
        (async () => {
          try {
            if (typeof playJackpotClimax === 'function') {
              await playJackpotClimax(tierName, amount);
            } else {
              await sleepRaw(700);
            }
          } catch (_) {
            await sleepRaw(500);
          }
        })();
      }
      state.jackpotWinId = null;
      state.jackpotOpened = {};
      resolve(amount);
    };

    const onClickNode = async (idx, node) => {
      if (controller.finished) return;
      if (node.classList.contains('opened')) return;
      await revealCell(idx, node);
    };

    const revealCell = async (idx, node) => {
      sfx('tick', { gain: 0.5 });
      const resp = await sendReveal(winId, idx);
      if (!resp) {
        // No response (timeout/disconnect) — leave node clickable, let user retry.
        showToast('Reveal failed — try again', '#ff8800');
        return;
      }
      // Sync full opened[] from BE (index+tier) so DOM/state stay consistent across tabs.
      if (Array.isArray(resp.opened) && resp.opened.length) {
        applyOpenedFromServer(resp.opened, nodeEls);
      }
      const tier = String(resp.tier || state.jackpotOpened[idx] || 'USER').toUpperCase();
      state.jackpotOpened[idx] = tier;
      revealJackpotNode(node, tier, idx);
      if (resp.matched) node.classList.add('jp-matched');
      setBanner();

      if (resp.paid) {
        // Wallet credited server-side — mirror the new balance into the UI.
        if (resp.balance != null) {
          try { applyOnlineBalance({ control: { balance: String(resp.balance) } }); } catch (_) {}
        }
        controller.lastAmount = Number(resp.amount || 0);
        controller.targetTier = resp.tier || tier;
        finish(resp.tier || tier, Number(resp.amount || 0), { expired: resp.expired });
        return;
      }
      // Still open — refresh countdown if server sent a fresh expiresAt.
      if (resp.expiresAt) controller.expiresAt = new Date(resp.expiresAt).getTime();
    };

    // Countdown (TTL). On expiry, force a final reveal to let BE auto-pay.
    const tickCountdown = () => {
      if (!controller.expiresAt) {
        if (timerEl) timerEl.textContent = '⏳ no timer';
        return;
      }
      const remainMs = controller.expiresAt - Date.now();
      if (remainMs <= 0) {
        if (timerEl) timerEl.textContent = '⏰ expired';
        if (!controller.finished) {
          // Force settlement: reveal a still-closed node (BE auto-pays on expired).
          const next = nodeEls.find((n, i) => n && !n.classList.contains('opened'));
          const idx = next ? nodeEls.indexOf(next) : 0;
          revealCell(idx, next || nodeEls[0]).catch(() => {});
        }
        return;
      }
      const s = Math.ceil(remainMs / 1000);
      if (timerEl) timerEl.textContent = `⏳ ${s}s`;
    };
    tickCountdown();
    controller.timer = setInterval(tickCountdown, 500);

    // If no timer from server, allow manual expiry fallback.
    if (!controller.expiresAt) {
      controller.expiresAt = Date.now() + JACKPOT_TTL_SECONDS * 1000;
    }
  });
}

async function sendReveal(winId, index) {
  const extra = {
    win_id: winId,
    index,
    agency_id: state.sessionAgencyId || '',
    user_id: state.sessionUserId || '',
  };
  try {
    return await requestGameCmd(JACKPOT_CMD.REVEAL, extra, 15000);
  } catch (_) {
    return null;
  }
}

/**
 * Pick-and-click Core Hack entry. For 2-phase online the claim carries winId only.
 * Offline (no arg) keeps the legacy random behaviour.
 * @param {object|null} serverJp - online: progressiveJackpot {winId, expiresAt?, opened?}
 */
export async function playJackpot(serverJp = null) {
  // 2-phase online: backend only sends winId + pending (no tier/amount/nodes).
  if (serverJp && serverJp.winId) {
    return await playCoreHack(serverJp);
  }

  // Legacy offline: random grid, win = tier.mult × bet (no server).
  sfx('charge', { gain: 0.8 });
  state.lastJackpotActive = true;
  renderFeatureMeter([
    CORE_HACK.id,
    ...((state.persistentFeatures || []).map(f => f.id)),
    ...((state.triggeredFeatures || []).map(f => f.id)),
  ].filter((id, i, a) => a.indexOf(id) === i));
  return new Promise(resolve => {
    const picks = {};
    const grid = document.getElementById('jackpotGrid');
    grid.innerHTML = '';
    document.getElementById('jackpotPicks').textContent = 'Pick a node to decrypt...';
    openModal('modalJackpot');

    let finished = false;
    const finish = (tierName, amount) => {
      if (finished) return;
      finished = true;
      sfx('jackpot', { gain: 1 });
      (async () => {
        closeModal('modalJackpot');
        showToast(`🏆 ${tierName} JACKPOT: ${fmt(amount)}!`, '#ff3355');
        try {
          if (typeof playJackpotClimax === 'function') {
            await playJackpotClimax(tierName, amount);
          } else {
            await sleepRaw(700);
          }
        } catch (_) {
          await sleepRaw(500);
        }
        resolve(amount);
      })();
    };

    const pick = JACKPOT_TIERS[Math.floor(Math.random() * JACKPOT_TIERS.length)];
    const targetTier = pick.name;
    const nodeTiers = constrainJackpotNodes([], targetTier);

    nodeTiers.forEach((tierName, idx) => {
      const node = document.createElement('div');
      node.className = 'jackpot-node';
      const coreImg = document.createElement('img');
      setImgSrc(coreImg, JACKPOT_CORE_IMG);
      coreImg.alt = 'Encrypted Node';
      node.appendChild(coreImg);
      node.addEventListener('click', () => {
        if (finished || node.classList.contains('opened')) return;
        sfx('tick', { gain: 0.5 });
        revealJackpotNode(node, tierName, idx);
        picks[tierName] = (picks[tierName] || 0) + 1;
        document.getElementById('jackpotPicks').textContent =
          Object.entries(picks).map(([k, v]) => `${k}: ${v}`).join(' | ');
        if (picks[tierName] >= 3) {
          const tier = JACKPOT_TIERS.find(t => t.name === tierName);
          finish(tierName, (tier?.mult || 15) * state.bet);
        }
      });
      grid.appendChild(node);
    });
  });
}
