// src/ui/vfx/core.js — extracted from main.js
import { _explainContinueResolve, _vfxAnimCancel, _vfxSkipAll, set_explainContinueResolve, set_vfxAnimCancel, set_vfxSkipAll, state } from '../../core/state.js';
import { sleepRaw } from '../../core/utils.js';
import { FEATURES, FEATURE_EXPLAIN_VI, REELS, REF_BET, ROWS, SYMBOLS, SYM_MAP } from '../../game/config.js';
import { FEATURE_PRESENT } from '../../net/session.js';
import { sfx } from '../../sfx/sfx.js';
import { setImgSrc } from '../assets.js';
import { showToast } from '../feedback.js';
import { idleAuraFx, setCellSymbolFx, setSymbolFx } from '../sprites.js';
import { VFX_PARTICLE_SCALE, drawRadialWash, drawRgbSplit, drawScanlines, drawShockwave, hitStop, screenPunch, vfxParticleN } from './cinematic.js';

// ─── Live VFX pipeline (baseScreen + featureSteps) ────────────
// Full semantic presentation — contract: docs/FE_SPIN_VFX_GUIDE.md
// pos wire = [col, row]; cellMultipliers key = "row,col"
// Money/final grid: always snap stages[0].screen after steps (authority).

export function vfxMs(normal, turbo) {
  if (_vfxSkipAll) return 0;
  return state.fastSpin ? (turbo ?? Math.round(normal * 0.4)) : normal;
}

export function isVfxSkip() {
  return !!_vfxSkipAll;
}

export function resetVfxSkip() {
  set_vfxSkipAll(false);
}

export function setSkipBarVisible(on) {
  document.getElementById('vfxSkipBar')?.classList.toggle('show', !!on);
}

export function requestSkipAllVfx() {
  set_vfxSkipAll(true);
  if (_vfxAnimCancel) {
    try { _vfxAnimCancel(); } catch (_) {}
    set_vfxAnimCancel(null);
  }
  if (_explainContinueResolve) {
    const r = _explainContinueResolve;
    set_explainContinueResolve(null);
    r();
  }
  hideFeatureExplain(true);
  hideFeatureIntro(true);
  setSkipBarVisible(false);
  showToast('⏭ Đã bỏ qua hiệu ứng còn lại', '#00f0ff');
}

/** Interruptible wait — thoát sớm nếu Skip VFX */
export async function vfxWait(ms) {
  if (isVfxSkip() || ms <= 0) return;
  let left = ms;
  while (left > 0 && !isVfxSkip()) {
    const d = Math.min(40, left);
    await sleepRaw(d);
    left -= d;
  }
}

export function stepPos(pos) {
  if (!Array.isArray(pos) || pos.length < 2) return null;
  const c = Number(pos[0]);
  const r = Number(pos[1]);
  if (!Number.isFinite(c) || !Number.isFinite(r)) return null;
  if (c < 0 || c >= REELS || r < 0 || r >= ROWS) return null;
  return { c, r };
}

export function posKeys(list) {
  if (!Array.isArray(list)) return [];
  return list.map(pos => {
    const p = stepPos(pos);
    return p ? `${p.c},${p.r}` : null;
  }).filter(Boolean);
}

export function setCellSymbol(c, r, symIdOrKey) {
  if (!state.grid?.[c]) return;
  const key = typeof symIdOrKey === 'number' || (typeof symIdOrKey === 'string' && /^\d+$/.test(symIdOrKey))
    ? (SYM_MAP[Number(symIdOrKey)] || state.grid[c][r])
    : symIdOrKey;
  state.grid[c][r] = key || state.grid[c][r];
  // Class Upgrade is on the pay-symbol instance. Wild overlay drops the badge (AFK).
  if (state.grid[c][r] === 'W' && state.cellMeta?.[c]?.[r]) {
    state.cellMeta[c][r].multiplier = 1;
  }
}

export function setCellSplit(c, r, splitCount) {
  if (!state.cellMeta?.[c]?.[r]) return;
  const n = Number(splitCount);
  state.cellMeta[c][r].split = !n || n <= 1 ? 1 : n >= 4 ? 4 : 2;
}

export function setCellMystery(c, r, on) {
  if (!state.cellMeta?.[c]?.[r]) return;
  state.cellMeta[c][r].mystery = !!on;
  if (on) state.grid[c][r] = 'M';
}

export function setCellMultiplier(c, r, mult) {
  if (!state.cellMeta?.[c]?.[r]) return;
  state.cellMeta[c][r].multiplier = Number(mult) || 1;
}

/** Mọi mystery ô phải reveal — server bỏ change khi from === revealTo. */
export function revealTrojanStep(step) {
  if (!step) return;
  const mysteryPos = Array.isArray(step.mysteryPositions) ? step.mysteryPositions : [];
  const changePos = Array.isArray(step.changes) ? step.changes.map(ch => ch.pos) : [];
  const positions = mysteryPos.length ? mysteryPos : changePos;
  if (Array.isArray(step.changes) && step.changes.length) applyStepChanges(step.changes);
  if (step.revealTo != null) {
    for (const pos of positions) {
      const p = stepPos(pos);
      if (!p) continue;
      setCellSymbol(p.c, p.r, step.revealTo);
      setCellMystery(p.c, p.r, false);
    }
    return;
  }
  for (const pos of positions) {
    const p = stepPos(pos);
    if (p) setCellMystery(p.c, p.r, false);
  }
}

export function applyStepChanges(changes) {
  if (!Array.isArray(changes)) return [];
  const hit = [];
  for (const ch of changes) {
    const p = stepPos(ch?.pos);
    if (!p) continue;
    if (ch.to != null) setCellSymbol(p.c, p.r, ch.to);
    setCellMystery(p.c, p.r, false);
    hit.push(`${p.c},${p.r}`);
  }
  return hit;
}

export function applyStepSplitChanges(splitChanges) {
  if (!Array.isArray(splitChanges)) return [];
  const hit = [];
  for (const ch of splitChanges) {
    const p = stepPos(ch?.pos);
    if (!p) continue;
    setCellSplit(p.c, p.r, ch.to != null ? ch.to : 2);
    hit.push(`${p.c},${p.r}`);
  }
  return hit;
}

export function cellEl(c, r) {
  return document.querySelector(`#reelsGrid .cell[data-reel="${c}"][data-row="${r}"]`);
}

/** Map cell VFX class → symbol color/scale FX preset */
export const VFX_CLS_SYM_FX = {
  'vfx-decrypt': 'decrypt',
  'vfx-surge': 'surge',
  'vfx-mult': 'overclock',
  'vfx-firewall': 'hot',
  'vfx-wild-glow': 'wild',
  'vfx-morph': 'pulse',
  'vfx-hit': 'win',
  'vfx-glitch': 'glitch',
  'vfx-split': 'pulse',
  scrub: 'hot',
};

export function restoreIdleSymbolFx(img) {
  if (!img) return;
  const sym = img.dataset.sym;
  const aura = idleAuraFx(sym);
  if (aura) {
    setSymbolFx(img, aura);
    img.dataset.symFx = 'idle';
    img.classList.add('fx-aura-breathe');
  } else {
    setSymbolFx(img, null);
    img.classList.remove('fx-aura-breathe');
  }
}

export function clearCellClasses(clsList) {
  const sels = (clsList || []).map(c => `.cell.${c}`).join(',');
  if (!sels) return;
  document.querySelectorAll(`#reelsGrid ${sels}`).forEach(el => {
    clsList.forEach(c => el.classList.remove(c));
    // Reset temporary VFX tint; keep idle accents for W / M
    el.querySelectorAll('.sym-img').forEach(restoreIdleSymbolFx);
  });
}

export function highlightCells(keys, cls, ms) {
  if (!keys?.length) return Promise.resolve();
  const set = new Set(keys);
  const symFx = VFX_CLS_SYM_FX[cls] || null;
  document.querySelectorAll('#reelsGrid .cell').forEach(el => {
    const k = `${el.dataset.reel},${el.dataset.row}`;
    if (set.has(k)) {
      el.classList.add(cls);
      if (symFx) setCellSymbolFx(el, symFx);
    }
  });
  return sleepRaw(ms).then(() => {
    document.querySelectorAll(`#reelsGrid .cell.${cls}`).forEach(el => {
      el.classList.remove(cls);
      if (symFx) el.querySelectorAll('.sym-img').forEach(restoreIdleSymbolFx);
    });
  });
}

export async function highlightCellsKeep(keys, cls, ms) {
  if (!keys?.length) {
    await sleepRaw(ms);
    return;
  }
  const set = new Set(keys);
  const symFx = VFX_CLS_SYM_FX[cls] || null;
  document.querySelectorAll('#reelsGrid .cell').forEach(el => {
    const k = `${el.dataset.reel},${el.dataset.row}`;
    if (set.has(k)) {
      el.classList.add(cls);
      if (symFx) setCellSymbolFx(el, symFx);
    }
  });
  await sleepRaw(ms);
}

export function highlightReels(cols, cls, ms) {
  const list = (cols || []).map(Number).filter(c => c >= 0 && c < REELS);
  list.forEach(c => document.getElementById(`reel-${c}`)?.classList.add(cls));
  // strip reels may not exist after renderGrid — mark cells in column
  list.forEach(c => {
    for (let r = 0; r < ROWS; r++) cellEl(c, r)?.closest('.reel')?.classList.add(cls);
    document.querySelectorAll(`#reelsGrid .cell[data-reel="${c}"]`).forEach(el => {
      el.parentElement?.classList.add(cls);
    });
  });
  return sleepRaw(ms).then(() => {
    document.querySelectorAll(`.${cls}`).forEach(el => el.classList.remove(cls));
  });
}

export function showVfxBanner(text, featId) {
  const el = document.getElementById('vfxBanner');
  if (!el) return;
  el.className = 'vfx-banner show' + (featId ? ` ${featId}` : '');
  el.textContent = text || '';
}

export function hideVfxBanner() {
  const el = document.getElementById('vfxBanner');
  if (!el) return;
  el.classList.remove('show');
  el.textContent = '';
}

export async function vfxFlash(colorCls, ms) {
  const el = document.getElementById('vfxFlash');
  if (!el) {
    await sleepRaw(ms);
    return;
  }
  el.classList.remove('show', 'red', 'orange', 'purple', 'green', 'yellow');
  el.classList.add('show');
  if (colorCls) el.classList.add(colorCls);
  await sleepRaw(ms);
  el.classList.remove('show', 'red', 'orange', 'purple', 'green', 'yellow');
}

export function setMeterStepActive(featId) {
  document.querySelectorAll('#featureMeter .feat-badge').forEach(b => {
    b.classList.toggle('vfx-active', b.dataset.featureId === featId);
  });
}

export function clearMeterStepActive() {
  document.querySelectorAll('#featureMeter .feat-badge.vfx-active')
    .forEach(b => b.classList.remove('vfx-active'));
}

export function symNameFromId(id) {
  return SYMBOLS[SYM_MAP[id]]?.name || String(id);
}

/** PowerSurge / AlgorithmicScan emit cell `positions` (no `convertedTypes`). Derive names from `changes` → 11. */
export function wildChangeNames(step) {
  const names = [];
  const seen = new Set();
  for (const ch of step.changes || []) {
    if (ch.from != null && Number(ch.to) === 11 && !seen.has(ch.from)) {
      seen.add(ch.from);
      names.push(symNameFromId(ch.from));
    }
  }
  return names;
}

/** Label for cell→Wild steps: source symbols, else cell count. */
export function cellWildStepLabel(step) {
  const names = wildChangeNames(step);
  if (names.length) return names.join(', ');
  const n = Array.isArray(step.positions) && step.positions.length
    ? step.positions.length
    : (Array.isArray(step.changes) ? step.changes.length : 0);
  if (n) return `${n} ô`;
  return 'targets';
}

/** @deprecated alias — PowerSurge callers */
export function surgeStepLabel(step) {
  return cellWildStepLabel(step);
}

export function featureStepToast(step, featId) {
  const p = FEATURE_PRESENT[featId];
  if (featId === 'firewall' && Array.isArray(step.bannedLows) && step.bannedLows.length) {
    const lows = step.bannedLows.map(symNameFromId).join(', ');
    showToast(`🔥 Firewall Block: ${lows} blocked`, p?.color || '#ff3355');
    return;
  }
  if (featId === 'trojan' && step.revealTo != null) {
    showToast(`🐴 Trojan Horse → ${symNameFromId(step.revealTo)}`, p?.color || '#aa44ff');
    return;
  }
  if (featId === 'overclock' && step.multiplier != null) {
    const sym = step.targetSymbol != null ? symNameFromId(step.targetSymbol) : '?';
    showToast(`🔥 System Overclock: ${sym} ×${step.multiplier}`, p?.color || '#ff8800');
    return;
  }
  if (featId === 'bandwidth' && step.multiplier != null) {
    showToast(`📶 Bandwidth Multiplier: ×${step.multiplier}`, p?.color || '#ff8800');
    return;
  }
  if (featId === 'overload' && Array.isArray(step.columns)) {
    showToast(`⚡ Data Overload: columns ${step.columns.map(c => Number(c) + 1).join(', ')}`, p?.color || '#ff8800');
    return;
  }
  if (featId === 'root' && Array.isArray(step.reels)) {
    showToast(`🌧️ Root Access: Reels ${step.reels.map(c => Number(c) + 1).join(', ')} split`, p?.color || '#00ff88');
    return;
  }
  if (featId === 'decrypt' && Array.isArray(step.changes) && step.changes.length) {
    showToast(`🔵 Data Decrypt: ${step.changes.length} cell(s) upgraded`, p?.color || '#00f0ff');
    return;
  }
  if (featId === 'cloning' && step.targetSymbol != null) {
    showToast(`🧬 Data Cloning: ${symNameFromId(step.targetSymbol)} split ×2`, p?.color || '#00ff88');
    return;
  }
  if (featId === 'surge') {
    showToast(`⚡ Power Surge: ${surgeStepLabel(step)} → Wild`, p?.color || '#ffff00');
    return;
  }
  if (featId === 'scan') {
    showToast(`🎯 Algorithmic Scan: ${cellWildStepLabel(step)} → Wild`, p?.color || '#00f0ff');
    return;
  }
  if (p) showToast(p.msg, p.color);
  else showToast(String(step?.name || featId), 'var(--cyan)');
}

// ─── Cinematic VFX engine (canvas + stage DOM) + PRO polish ──

/** Per-feature beat timing (ms normal; turbo via vfxMs) */
export const VFX_BEAT = {
  firewall:  { intro: 420, anticipate: 120, settle: 140 },
  decrypt:   { intro: 380, anticipate: 80,  settle: 100 },
  trojan:    { intro: 450, anticipate: 160, settle: 160 },
  overload:  { intro: 400, anticipate: 100, settle: 120 },
  overclock: { intro: 420, anticipate: 140, settle: 150 },
  cloning:   { intro: 360, anticipate: 90,  settle: 110 },
  root:      { intro: 400, anticipate: 100, settle: 130 },
  surge:     { intro: 440, anticipate: 150, settle: 160 },
  glitch:    { intro: 360, anticipate: 60,  settle: 100 },
  scan:      { intro: 420, anticipate: 120, settle: 140 },
  bandwidth: { intro: 380, anticipate: 80,  settle: 120 },
  bypass:    { intro: 400, anticipate: 100, settle: 130 },
};

export const VFX_BLOOM_COLOR = {
  firewall: 'red', decrypt: 'cyan', trojan: 'purple', overload: 'orange',
  overclock: 'orange', cloning: 'green', root: 'green', surge: 'yellow',
  glitch: 'purple', scan: 'cyan', bandwidth: 'orange', bypass: 'cyan',
};

export function vfxStage() {
  return document.getElementById('vfxStage');
}

export function clearVfxStage() {
  const st = vfxStage();
  if (st) st.innerHTML = '';
  const cv = document.getElementById('vfxCanvas');
  if (cv) {
    const ctx = cv.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
  }
  if (_vfxAnimCancel) {
    _vfxAnimCancel();
    set_vfxAnimCancel(null);
  }
  document.getElementById('vfxCpuBadge')?.classList.remove('show');
  document.getElementById('vfxBwBar')?.classList.remove('show');
  document.getElementById('vfxBwLabel')?.classList.remove('show');
  document.getElementById('vfxBypassArrows')?.classList.remove('show');
  document.getElementById('vfxBloom')?.classList.remove('show', 'cyan', 'red', 'orange', 'purple', 'green', 'yellow');
  document.getElementById('vfxVignette')?.classList.remove('show');
  hideFeatureIntro(true);
  hideFeatureExplain(true);
  document.getElementById('reelsWrapper')?.classList.remove('vfx-hit-shake', 'vfx-hit-shake-sm');
}

export function setVfxBloom(colorCls, on = true) {
  const el = document.getElementById('vfxBloom');
  if (!el) return;
  el.classList.remove('show', 'cyan', 'red', 'orange', 'purple', 'green', 'yellow');
  if (on) {
    el.classList.add('show');
    if (colorCls) el.classList.add(colorCls);
  }
}

export function setVfxVignette(on) {
  document.getElementById('vfxVignette')?.classList.toggle('show', !!on);
}

export async function vfxHitImpact(strength = 'full', bloomColor = 'cyan') {
  if (isVfxSkip()) return;
  sfx(strength === 'full' ? 'hit' : 'tick', { gain: strength === 'full' ? 1 : 0.6 });
  const wrap = document.getElementById('reelsWrapper');
  const flash = document.getElementById('vfxWhiteFlash');
  wrap?.classList.remove('vfx-hit-shake', 'vfx-hit-shake-sm', 'vfx-hit-zoom', 'vfx-chroma');
  void wrap?.offsetWidth;
  wrap?.classList.add(strength === 'sm' ? 'vfx-hit-shake-sm' : 'vfx-hit-shake');
  if (strength === 'full') {
    wrap?.classList.add('vfx-hit-zoom', 'vfx-chroma');
    if (flash) {
      flash.classList.remove('show');
      void flash.offsetWidth;
      flash.classList.add('show');
    }
  }
  setVfxBloom(bloomColor, true);
  await vfxWait(vfxMs(strength === 'sm' ? 120 : 200, 55));
  setVfxBloom(null, false);
  wrap?.classList.remove('vfx-hit-zoom', 'vfx-chroma');
  flash?.classList.remove('show');
}

/** Icon bay từ feature meter → giữa reels */
export async function flyFeatureIconFromMeter(featId) {
  if (isVfxSkip()) return;
  const feat = FEATURES.find(f => f.id === featId);
  const badge = document.querySelector(`#featureMeter .feat-badge[data-feature-id="${featId}"]`);
  const fly = document.getElementById('vfxFlyIcon');
  const wrap = document.getElementById('reelsWrapper');
  if (!feat?.img || !badge || !fly || !wrap) return;

  sfx('whoosh', { gain: 0.85 });
  const br = badge.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  const startX = br.left + br.width / 2 - 24;
  const startY = br.top + br.height / 2 - 24;
  const endX = wr.left + wr.width / 2 - 24;
  const endY = wr.top + wr.height / 2 - 36;

  setImgSrc(fly, feat.img);
  fly.classList.remove('fly');
  fly.style.display = 'block';
  fly.style.opacity = '1';
  fly.style.left = startX + 'px';
  fly.style.top = startY + 'px';
  fly.style.transform = 'scale(0.7)';
  void fly.offsetWidth;
  fly.classList.add('fly');
  fly.style.left = endX + 'px';
  fly.style.top = endY + 'px';
  fly.style.transform = 'scale(1.35)';
  setVfxVignette(true);
  await vfxWait(vfxMs(480, 180));
  fly.style.opacity = '0';
  await vfxWait(vfxMs(120, 40));
  fly.classList.remove('fly');
  fly.style.display = 'none';
}

/** Confetti + pulse balance/win header — desktop cinematic climax */
export async function celebrateWinPro(totalWin) {
  if (!totalWin || totalWin <= 0 || isVfxSkip()) return;
  const ref = state.bet / REF_BET;
  const mega = totalWin >= 40 * ref;
  const big = totalWin >= 20 * ref;
  const scale = mega ? 2.1 : big ? 1.65 : 1.25;
  sfx(mega ? 'jackpot' : big ? 'bigwin' : 'win', { gain: mega ? 1.15 : big ? 1.1 : 1.0, force: true });
  const bal = document.getElementById('balanceDisplay');
  const hw = document.getElementById('headerWin');
  bal?.classList.remove('win-pulse');
  hw?.classList.remove('win-pulse');
  void bal?.offsetWidth;
  bal?.classList.add('win-pulse');
  hw?.classList.add('win-pulse');

  setVfxBloom(mega ? 'yellow' : 'green', true);
  setVfxVignette(true);
  screenPunch(mega ? 'god' : big ? 'full' : 'sm');
  await hitStop(mega ? 80 : big ? 50 : 0);

  const canvas = prepVfxCanvas();
  if (!canvas) {
    await vfxWait(vfxMs(400, 150));
    bal?.classList.remove('win-pulse');
    hw?.classList.remove('win-pulse');
    setVfxBloom(null, false);
    setVfxVignette(false);
    return;
  }
  let parts = [];
  const colors = ['#00f0ff', '#00ff88', '#ffd000', '#ff8800', '#aa44ff', '#fff'];
  const rain = Math.round(48 * scale);
  for (let i = 0; i < rain; i++) {
    const x = Math.random() * canvas.w;
    parts = parts.concat(burstParticles(canvas.ctx, x, -10, colors[i % colors.length], vfxParticleN(3), 'star'));
    parts = parts.concat(burstParticles(canvas.ctx, x, 0, colors[(i + 2) % colors.length], vfxParticleN(2), 'ember'));
  }
  const cx = canvas.w / 2;
  const cy = canvas.h * 0.45;
  parts = parts.concat(proBurst(canvas.ctx, cx, cy, {
    core: '#fff', mid: mega ? '#ffd000' : '#00ff88', smoke: 'rgba(0,40,20,0.25)',
  }, 1.3 * scale));
  parts = parts.concat(burstParticles(canvas.ctx, cx, cy, '#ffffff', vfxParticleN(20 * scale), 'star'));

  const dur = mega ? 1400 : big ? 1100 : 900;
  await runAnimFrame(vfxMs(dur, Math.round(dur * 0.35)), (t) => {
    if (isVfxSkip()) return;
    canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
    const g = canvas.ctx.createRadialGradient(cx, cy, 8, cx, cy, canvas.w * (0.45 + t * 0.15));
    g.addColorStop(0, mega ? `rgba(255,208,0,${0.18 + (1 - t) * 0.1})` : `rgba(0,255,136,${0.14 + (1 - t) * 0.08})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    canvas.ctx.fillStyle = g;
    canvas.ctx.fillRect(0, 0, canvas.w, canvas.h);
    drawShockwave(canvas.ctx, cx, cy, Math.min(1, t * 1.15), mega ? [255, 208, 0] : [0, 255, 136], 140 * scale);
    if (mega) {
      drawRgbSplit(canvas.ctx, canvas.w, canvas.h, t * 0.35, 3 * (1 - t));
      drawScanlines(canvas.ctx, canvas.w, canvas.h, t, 0.08 * (1 - t));
    }
    // secondary sky bursts
    if (t < 0.55 && Math.random() < 0.25) {
      const bx = Math.random() * canvas.w;
      parts = parts.concat(burstParticles(canvas.ctx, bx, canvas.h * 0.2, colors[Math.floor(Math.random() * colors.length)], vfxParticleN(4), 'star'));
    }
    parts = drawParts(canvas.ctx, parts, 1 / 55);
  });
  canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
  bal?.classList.remove('win-pulse');
  hw?.classList.remove('win-pulse');
  setVfxBloom(null, false);
  setVfxVignette(false);
}

/**
 * Full-screen jackpot win climax after Core Hack pick (tier-scaled).
 * GOD/ELITE = heavy; GHOST/USER = lighter.
 */
export async function playJackpotClimax(tierName, amount) {
  const tier = String(tierName || 'USER').toUpperCase();
  const isGod = tier === 'GOD';
  const isElite = tier === 'ELITE';
  const heavy = isGod || isElite;
  sfx('jackpot', { gain: 1 });
  setVfxBloom(isGod ? 'yellow' : isElite ? 'orange' : 'red', true);
  setVfxVignette(true);
  screenPunch(isGod ? 'god' : heavy ? 'full' : 'sm');
  await hitStop(isGod ? 100 : heavy ? 70 : 40);

  const canvas = prepVfxCanvas();
  if (!canvas) {
    await vfxWait(vfxMs(600, 220));
    setVfxBloom(null, false);
    setVfxVignette(false);
    return;
  }
  let parts = [];
  const cx = canvas.w / 2;
  const cy = canvas.h * 0.42;
  const palette = isGod
    ? { core: '#fff', mid: '#ffd000', smoke: 'rgba(80,40,0,0.35)' }
    : isElite
      ? { core: '#fff', mid: '#ff8800', smoke: 'rgba(60,20,0,0.3)' }
      : { core: '#fff', mid: '#ff3355', smoke: 'rgba(60,0,10,0.3)' };
  const rgb = isGod ? [255, 208, 0] : isElite ? [255, 120, 0] : [255, 50, 80];
  const scale = isGod ? 2.4 : isElite ? 1.9 : 1.35;
  parts = parts.concat(proBurst(canvas.ctx, cx, cy, palette, scale));
  parts = parts.concat(burstParticles(canvas.ctx, cx, cy, '#fff', vfxParticleN(28 * scale), 'star'));
  parts = parts.concat(burstParticles(canvas.ctx, cx, cy, palette.mid, vfxParticleN(20 * scale), 'ember'));
  for (let i = 0; i < Math.round(30 * scale); i++) {
    parts = parts.concat(burstParticles(
      canvas.ctx, Math.random() * canvas.w, -8,
      i % 2 ? palette.mid : '#fff', vfxParticleN(2), 'star'
    ));
  }

  const dur = isGod ? 1600 : heavy ? 1200 : 900;
  await runAnimFrame(vfxMs(dur, Math.round(dur * 0.35)), (t) => {
    if (isVfxSkip()) return;
    canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
    drawRadialWash(canvas.ctx, cx, cy, canvas.w * 0.55, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.22 * (1 - t * 0.5)})`);
    drawShockwave(canvas.ctx, cx, cy, Math.min(1, t * 1.1), rgb, 160 * scale * 0.55);
    if (heavy) {
      drawScanlines(canvas.ctx, canvas.w, canvas.h, t, 0.1 * (1 - t * 0.6));
      if (isGod) drawRgbSplit(canvas.ctx, canvas.w, canvas.h, t * 0.4, 4 * (1 - t));
    }
    // rotating “core” rings
    canvas.ctx.save();
    canvas.ctx.translate(cx, cy);
    canvas.ctx.rotate(t * Math.PI * 2);
    canvas.ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.55 * (1 - t)})`;
    canvas.ctx.lineWidth = 2;
    canvas.ctx.shadowColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.9)`;
    canvas.ctx.shadowBlur = 16;
    canvas.ctx.beginPath();
    canvas.ctx.arc(0, 0, 30 + t * 70, 0, Math.PI * 1.4);
    canvas.ctx.stroke();
    canvas.ctx.rotate(-t * Math.PI * 3.2);
    canvas.ctx.beginPath();
    canvas.ctx.arc(0, 0, 18 + t * 50, 0, Math.PI * 1.2);
    canvas.ctx.stroke();
    canvas.ctx.restore();
    if (t < 0.6 && Math.random() < 0.3) {
      parts = parts.concat(burstParticles(
        canvas.ctx, cx + (Math.random() - 0.5) * 80, cy + (Math.random() - 0.5) * 40,
        '#fff', vfxParticleN(5), 'star'
      ));
    }
    parts = drawParts(canvas.ctx, parts, 1 / 55);
  });
  canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
  setVfxBloom(null, false);
  setVfxVignette(false);
  // amount already toasted by caller; optional second pulse
  void amount;
}

export function hideFeatureIntro(instant = false) {
  const el = document.getElementById('vfxFeatureIntro');
  if (!el) return;
  if (instant) {
    el.classList.remove('show', 'hide');
    el.style.display = 'none';
    return;
  }
  el.classList.remove('show');
  el.classList.add('hide');
  setTimeout(() => {
    el.classList.remove('hide');
    el.style.display = 'none';
  }, state.fastSpin ? 120 : 280);
}

/**
 * Pro feature intro: asset icon + ring + meter charge.
 * Beat: anticipate → icon slam → hold briefly.
 */
export async function playFeatureIntro(featId) {
  if (isVfxSkip()) return;
  const feat = FEATURES.find(f => f.id === featId);
  const beat = VFX_BEAT[featId] || { intro: 400, anticipate: 100, settle: 120 };
  const bloom = VFX_BLOOM_COLOR[featId] || 'cyan';

  sfx('charge', { gain: 0.7, pitch: 1.05 });
  // Meter charge
  const badge = document.querySelector(`#featureMeter .feat-badge[data-feature-id="${featId}"]`);
  if (badge) {
    badge.classList.remove('vfx-charge', 'vfx-active');
    void badge.offsetWidth;
    badge.classList.add('vfx-active', 'vfx-charge');
  }

  setVfxVignette(true);
  await vfxWait(vfxMs(beat.anticipate, Math.round(beat.anticipate * 0.35)));

  const intro = document.getElementById('vfxFeatureIntro');
  const img = document.getElementById('vfxIntroImg');
  const name = document.getElementById('vfxIntroName');
  if (intro && img && name && feat) {
    setImgSrc(img, feat.img || '');
    img.alt = feat.name;
    name.textContent = feat.name;
    name.style.borderColor = feat.color || 'var(--cyan)';
    name.style.color = feat.color || '#e8f0ff';
    intro.style.display = 'flex';
    intro.classList.remove('hide');
    void intro.offsetWidth;
    intro.classList.add('show');
  }

  setVfxBloom(bloom, true);
  await vfxFlash(bloom === 'cyan' ? '' : bloom, vfxMs(120, 40));
  sfx('blip', { gain: 0.55 });
  await vfxWait(vfxMs(beat.intro, Math.round(beat.intro * 0.38)));
  hideFeatureIntro(false);
  setVfxBloom(null, false);
  await vfxWait(vfxMs(80, 30));
}

export function hideFeatureExplain(instant = false) {
  const el = document.getElementById('vfxExplainCard');
  if (!el) return;
  if (instant) {
    el.classList.remove('show', 'hide');
    el.style.display = 'none';
    return;
  }
  el.classList.remove('show');
  el.classList.add('hide');
  setTimeout(() => {
    el.classList.remove('hide');
    el.style.display = 'none';
  }, state.fastSpin ? 140 : 280);
}

/** Dòng “lần này cụ thể” từ featureSteps server — tiếng Việt dễ hiểu */
export function buildFeatureExplainTip(featId, step) {
  if (!step) return '';
  try {
    if (featId === 'firewall' && Array.isArray(step.bannedLows) && step.bannedLows.length) {
      const names = step.bannedLows.map(symNameFromId).join(', ');
      return `Lần này chặn loại: ${names}.`;
    }
    if (featId === 'trojan' && step.revealTo != null) {
      return `Các hộp bí ẩn sẽ mở ra thành: ${symNameFromId(step.revealTo)}.`;
    }
    if (featId === 'overclock' && step.multiplier != null) {
      const sym = step.targetSymbol != null ? symNameFromId(step.targetSymbol) : 'biểu tượng được chọn';
      return `Lần này dán ×${step.multiplier} lên: ${sym}.`;
    }
    if (featId === 'bandwidth' && step.multiplier != null) {
      return `Toàn bộ tiền thắng spin này sẽ ×${step.multiplier}.`;
    }
    if (featId === 'overload' && Array.isArray(step.columns) && step.columns.length) {
      return `Các cột biến full Wild: cột ${step.columns.map(c => Number(c) + 1).join(', ')}.`;
    }
    if (featId === 'root' && Array.isArray(step.reels) && step.reels.length) {
      return `Các cột bị tách đôi (Split): cột ${step.reels.map(c => Number(c) + 1).join(', ')}.`;
    }
    if (featId === 'cloning' && step.targetSymbol != null) {
      return `Biểu tượng bị tách đôi: ${symNameFromId(step.targetSymbol)}.`;
    }
    if (featId === 'surge') {
      return `Đổi thành Wild: ${surgeStepLabel(step)} (ô kề bên có thể bị Split).`;
    }
    if (featId === 'scan') {
      return `Khóa và đổi thành Wild: ${cellWildStepLabel(step)}.`;
    }
    if (featId === 'decrypt' && Array.isArray(step.changes) && step.changes.length) {
      return `Lần này nâng cấp ${step.changes.length} ô từ thấp → cao.`;
    }
    if (featId === 'glitch' && Array.isArray(step.changes) && step.changes.length) {
      return `Đang xáo ${step.changes.length} ô không nằm trong chuỗi thắng.`;
    }
    if (featId === 'bypass') {
      return 'Spin này tính tiền cả hai chiều: Trái→Phải và Phải→Trái.';
    }
  } catch (_) { /* ignore */ }
  return '';
}

/**
 * Nhịp giải thích (toggle 📖): card tiếng Việt rõ ràng trước khi chạy VFX.
 */
export async function playFeatureExplainBeat(featId, step = null) {
  if (!state.featureExplain) return;
  const feat = FEATURES.find(f => f.id === featId);
  if (!feat) return;
  const vi = FEATURE_EXPLAIN_VI[featId] || {};

  const card = document.getElementById('vfxExplainCard');
  const img = document.getElementById('vfxExplainImg');
  const nameEl = document.getElementById('vfxExplainName');
  const bodyEl = document.getElementById('vfxExplainBody');
  const howEl = document.getElementById('vfxExplainHow');
  const tipEl = document.getElementById('vfxExplainTip');
  if (!card || !bodyEl) return;

  hideFeatureIntro(true);

  if (img) {
    setImgSrc(img, feat.img || '');
    img.alt = vi.nameVi || feat.name;
  }
  if (nameEl) {
    nameEl.textContent = vi.nameVi || feat.name;
    nameEl.style.color = feat.color || '#fff';
  }

  // 2 đoạn dễ hiểu: sẽ làm gì + ảnh hưởng thế nào
  bodyEl.textContent = vi.what || feat.desc || feat.name;
  if (howEl) {
    howEl.textContent = vi.how || feat.vfx || '';
    howEl.style.display = vi.how ? 'block' : 'none';
  }
  const labelHow = document.getElementById('vfxExplainLabelHow');
  if (labelHow) labelHow.style.display = vi.how ? 'block' : 'none';

  const tip = buildFeatureExplainTip(featId, step);
  if (tipEl) {
    if (tip) {
      tipEl.textContent = 'Lần này: ' + tip;
      tipEl.classList.add('show');
    } else {
      tipEl.textContent = '';
      tipEl.classList.remove('show');
    }
  }

  setVfxVignette(true);
  setVfxBloom(VFX_BLOOM_COLOR[featId] || 'cyan', true);
  sfx('charge', { gain: 0.55 });
  card.style.display = 'block';
  card.classList.remove('hide');
  void card.offsetWidth;
  card.classList.add('show');

  const badge = document.querySelector(`#featureMeter .feat-badge[data-feature-id="${featId}"]`);
  badge?.classList.add('vfx-active', 'vfx-charge');

  // Chờ: bấm «Tiếp tục» HOẶC hết giờ HOẶC Skip VFX
  const hold = state.fastSpin ? 1600 : 3200;
  const btnCont = document.getElementById('vfxExplainContinue');
  await new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      set_explainContinueResolve(null);
      if (btnCont) btnCont.onclick = null;
      clearTimeout(timer);
      resolve();
    };
    set_explainContinueResolve(finish);
    if (btnCont) {
      btnCont.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        sfx('blip', { gain: 0.5 });
        finish();
      };
    }
    const timer = setTimeout(finish, hold);
    // poll skip
    const poll = setInterval(() => {
      if (isVfxSkip() || done) {
        clearInterval(poll);
        finish();
      }
    }, 40);
  });

  hideFeatureExplain(false);
  setVfxBloom(null, false);
  await vfxWait(state.fastSpin ? 100 : 180);
}

export function prepVfxCanvas() {
  const wrap = document.getElementById('reelsWrapper');
  const cv = document.getElementById('vfxCanvas');
  if (!wrap || !cv) return null;
  const r = wrap.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, r.width);
  const h = Math.max(1, r.height);
  cv.width = Math.floor(w * dpr);
  cv.height = Math.floor(h * dpr);
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  const ctx = cv.getContext('2d') ?? noopCanvasCtx();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h, wrap };
}

/** Swallow-all 2D context for environments without canvas (keeps anim loops alive). */
function noopCanvasCtx() {
  const noop = () => {};
  return new Proxy({}, {
    get: (_, prop) => (prop in {} ? undefined : noop),
    set: () => true,
  });
}

export function cellRectInWrap(c, r) {
  const el = cellEl(c, r);
  const wrap = document.getElementById('reelsWrapper');
  if (!el || !wrap) return null;
  const er = el.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  return {
    x: er.left - wr.left + er.width / 2,
    y: er.top - wr.top + er.height / 2,
    left: er.left - wr.left,
    top: er.top - wr.top,
    w: er.width,
    h: er.height,
  };
}

export function reelRectInWrap(col) {
  const reel = document.getElementById(`reel-${col}`) ||
    document.querySelector(`#reelsGrid .cell[data-reel="${col}"]`)?.parentElement;
  const wrap = document.getElementById('reelsWrapper');
  if (!reel || !wrap) return null;
  const er = reel.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  return {
    left: er.left - wr.left,
    top: er.top - wr.top,
    w: er.width,
    h: er.height,
    x: er.left - wr.left + er.width / 2,
    y: er.top - wr.top + er.height / 2,
  };
}

export function runAnimFrame(duration, onFrame) {
  if (isVfxSkip() || duration <= 0) {
    try { onFrame(1, duration || 0); } catch (_) {}
    return Promise.resolve();
  }
  return new Promise(resolve => {
    let cancelled = false;
    set_vfxAnimCancel(() => { cancelled = true; });
    const t0 = performance.now();
    const tick = (now) => {
      if (cancelled || isVfxSkip()) {
        set_vfxAnimCancel(null);
        resolve();
        return;
      }
      const t = Math.min(1, (now - t0) / Math.max(1, duration));
      try { onFrame(t, now - t0); } catch (_) {}
      if (t < 1) requestAnimationFrame(tick);
      else {
        set_vfxAnimCancel(null);
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Particle 2.0 — modes: 'spark' | 'ember' | 'smoke' | 'code' | 'star'
 */
export function burstParticles(ctx, x, y, color, n = 18, mode = 'spark') {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.55;
    let sp, size, vy0, drag, lifeDecay, kind = mode;
    if (mode === 'ember') {
      sp = 30 + Math.random() * 90;
      size = 1.2 + Math.random() * 2.8;
      vy0 = -40 - Math.random() * 80;
      drag = 0.98;
      lifeDecay = 1.1 + Math.random() * 0.4;
    } else if (mode === 'smoke') {
      sp = 10 + Math.random() * 40;
      size = 4 + Math.random() * 10;
      vy0 = -20 - Math.random() * 40;
      drag = 0.99;
      lifeDecay = 0.7;
    } else if (mode === 'code') {
      sp = 50 + Math.random() * 140;
      size = 8 + Math.random() * 6;
      vy0 = Math.sin(a) * sp - 20;
      drag = 0.97;
      lifeDecay = 1.4;
      kind = 'code';
    } else if (mode === 'star') {
      sp = 60 + Math.random() * 160;
      size = 1 + Math.random() * 2;
      vy0 = Math.sin(a) * sp;
      drag = 0.96;
      lifeDecay = 1.8;
    } else {
      sp = 40 + Math.random() * 130;
      size = 1.5 + Math.random() * 2.8;
      vy0 = Math.sin(a) * sp - 30;
      drag = 0.985;
      lifeDecay = 1.5 + Math.random() * 0.4;
    }
    parts.push({
      x, y,
      vx: Math.cos(a) * sp * (mode === 'ember' ? 0.55 : 1),
      vy: mode === 'ember' || mode === 'smoke' ? vy0 : vy0,
      life: 1,
      color,
      size,
      drag,
      lifeDecay,
      kind,
      char: mode === 'code' ? '01アイウ#$%*+ '[Math.floor(Math.random() * 12)] : null,
      grav: mode === 'smoke' ? -20 : mode === 'ember' ? 40 : 180,
    });
  }
  return parts;
}

export function drawParts(ctx, parts, dt) {
  for (const p of parts) {
    p.vx *= p.drag ?? 0.99;
    p.vy *= p.drag ?? 0.99;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.grav ?? 180) * dt;
    p.life -= dt * (p.lifeDecay ?? 1.6);
    if (p.life <= 0) continue;
    ctx.globalAlpha = Math.max(0, p.life);
    if (p.kind === 'code') {
      ctx.fillStyle = p.color;
      ctx.font = `${Math.round(p.size)}px monospace`;
      ctx.fillText(p.char || '*', p.x, p.y);
    } else if (p.kind === 'smoke') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.2 - p.life * 0.4), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  ctx.globalAlpha = 1;
  return parts.filter(p => p.life > 0);
}

/** Dense multi-layer burst at point */
export function proBurst(ctx, x, y, palette, scale = 1) {
  let parts = [];
  const s = scale * (typeof VFX_PARTICLE_SCALE !== 'undefined' ? VFX_PARTICLE_SCALE : 1);
  parts = parts.concat(burstParticles(ctx, x, y, palette.core || '#fff', Math.round(14 * s), 'spark'));
  parts = parts.concat(burstParticles(ctx, x, y, palette.mid || '#ffaa44', Math.round(18 * s), 'ember'));
  parts = parts.concat(burstParticles(ctx, x, y, palette.smoke || 'rgba(80,40,20,0.35)', Math.round(8 * s), 'smoke'));
  return parts;
}
