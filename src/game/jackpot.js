// src/game/jackpot.js — extracted from main.js
import { state } from '../core/state.js';
import { fmt, sleepRaw } from '../core/utils.js';
import { CORE_HACK, JACKPOT_CORE_IMG, JACKPOT_TIERS } from './config.js';
import { sfx } from '../sfx/sfx.js';
import { setImgSrc } from '../ui/assets.js';
import { closeModal, openModal, showToast } from '../ui/feedback.js';
import { renderFeatureMeter } from '../ui/render.js';
import { playJackpotClimax } from '../ui/vfx/core.js';

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
  node.classList.add('opened', 'jp-' + name);
  node.innerHTML =
    '<div class="jp-hex-wrap"><div class="jp-hex-inner">' +
    '<span class="jp-num">' + num + '</span>' +
    '<span class="jp-ico">' + jackpotTierSvg(name) + '</span>' +
    '<span class="jp-name">' + name + '</span>' +
    '</div></div>';
}

/**
 * Pick-and-click Core Hack.
 * @param {object|null} serverJp - online: { tier, win, isTriggered, nodes?[{index,tier}] }
 *   Online win đã credit trong totalWin — modal chỉ presentation; resolve win amount server.
 *   Offline: nodes random; win = tier.mult × bet.
 */
export async function playJackpot(serverJp = null) {
  sfx('charge', { gain: 0.8 });
  state.lastJackpotActive = true;
  renderFeatureMeter([
    CORE_HACK.id,
    ...((state.persistentFeatures || []).map(f => f.id)),
    ...((state.triggeredFeatures || []).map(f => f.id)),
  ].filter((id, i, a) => a.indexOf(id) === i));
  return new Promise(resolve => {
    let nodeTiers = []; // string tier names length 15
    let winAmount = 0;
    let targetTier = null;
    let online = !!serverJp;

    if (serverJp) {
      targetTier = String(serverJp.tier || '').toUpperCase();
      winAmount = parseFloat(serverJp.win) || 0;
      const nodes = Array.isArray(serverJp.nodes) ? [...serverJp.nodes] : [];
      nodes.sort((a, b) => Number(a.index) - Number(b.index));
      if (nodes.length >= 15) {
        nodeTiers = nodes.slice(0, 15).map(n => String(n.tier || '').toUpperCase());
      } else if (nodes.length > 0) {
        nodeTiers = nodes.map(n => String(n.tier || '').toUpperCase());
      }
      nodeTiers = constrainJackpotNodes(nodeTiers, targetTier);
    } else {
      const pick = JACKPOT_TIERS[Math.floor(Math.random() * JACKPOT_TIERS.length)];
      targetTier = pick.name;
      winAmount = pick.mult * state.bet;
      nodeTiers = constrainJackpotNodes([], targetTier);
    }

    const picks = {};
    const grid = document.getElementById('jackpotGrid');
    grid.innerHTML = '';
    document.getElementById('jackpotPicks').textContent = online
      ? `Core Hack: find 3× ${targetTier || '???'} — prize ${fmt(winAmount)}`
      : 'Pick a node to decrypt...';
    openModal('modalJackpot');

    let finished = false;
    const finish = (tierName, amount) => {
      if (finished) return;
      finished = true;
      sfx('jackpot', { gain: 1 });
      // Close pick UI first, then cinematic climax on reels canvas
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

        if (online) {
          // Server đã settle win — chỉ cần match 3 của tier thắng (hoặc 3 bất kỳ nếu không có target)
          const hit = targetTier
            ? (picks[targetTier] || 0) >= 3
            : Object.values(picks).some(v => v >= 3);
          if (hit) finish(targetTier || tierName, winAmount);
        } else if (picks[tierName] >= 3) {
          const tier = JACKPOT_TIERS.find(t => t.name === tierName);
          finish(tierName, (tier?.mult || 15) * state.bet);
        }
      });
      grid.appendChild(node);
    });
  });
}
