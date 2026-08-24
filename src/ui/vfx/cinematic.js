// src/ui/vfx/cinematic.js — extracted from main.js
import { state } from '../../core/state.js';
import { sleepRaw } from '../../core/utils.js';
import { renderGrid } from '../render.js';
import { setCellSymbolFx } from '../sprites.js';
import { VFX_CLS_SYM_FX, applyStepSplitChanges, burstParticles, cellEl, cellRectInWrap, clearCellClasses, drawParts, isVfxSkip, prepVfxCanvas, runAnimFrame, setCellMystery, setCellSymbol, stepPos, vfxMs, vfxWait } from './core.js';
import { shakeScreen } from '../winfx.js';

// ─── VFX primitives (desktop cinematic — laptop macOS only) ──
/** Density scale for canvas particles (no mobile branch). */
export const VFX_PARTICLE_SCALE = 1.4;

export function vfxParticleN(base) {
  return Math.max(1, Math.round(base * VFX_PARTICLE_SCALE * (state.fastSpin ? 0.9 : 1)));
}

/** Brief freeze before impact — skip-aware. */
export async function hitStop(ms) {
  if (isVfxSkip() || !(ms > 0)) return;
  await vfxWait(vfxMs(ms, Math.max(20, Math.round(ms * 0.35))));
}

/** Camera punch on reels wrapper (reuses existing CSS classes). */
export function screenPunch(strength = 'full') {
  if (isVfxSkip()) return;
  const wrap = document.getElementById('reelsWrapper');
  if (!wrap) return;
  wrap.classList.remove('vfx-hit-shake', 'vfx-hit-shake-sm', 'vfx-hit-zoom', 'vfx-chroma');
  void wrap.offsetWidth;
  if (strength === 'god') {
    wrap.classList.add('vfx-hit-shake', 'vfx-hit-zoom', 'vfx-chroma');
    try { shakeScreen(); } catch (_) {}
  } else if (strength === 'full') {
    wrap.classList.add('vfx-hit-shake', 'vfx-hit-zoom');
  } else {
    wrap.classList.add('vfx-hit-shake-sm');
  }
}

export function drawShockwave(ctx, x, y, t, rgb = [0, 240, 255], maxR = 110) {
  if (!ctx || t <= 0) return;
  const a = Math.max(0, 1 - t);
  const r = 6 + t * maxR;
  const [cr, cg, cb] = rgb;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = `rgba(${cr},${cg},${cb},${0.95 * a})`;
  ctx.lineWidth = 2.5 + (1 - t) * 5;
  ctx.shadowColor = `rgba(${cr},${cg},${cb},0.95)`;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = a * 0.55;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawScanlines(ctx, w, h, t = 0, strength = 0.14) {
  if (!ctx) return;
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.fillStyle = '#000';
  const gap = 3;
  const off = (t * 48) % gap;
  for (let y = off; y < h; y += gap) ctx.fillRect(0, y, w, 1);
  const by = ((t * h * 1.35) % (h + 50)) - 25;
  const g = ctx.createLinearGradient(0, by, 0, by + 32);
  g.addColorStop(0, 'rgba(0,240,255,0)');
  g.addColorStop(0.5, 'rgba(170,80,255,0.2)');
  g.addColorStop(1, 'rgba(0,240,255,0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.fillRect(0, by, w, 32);
  ctx.restore();
}

/** Fake chromatic aberration + tear bars (no WebGL). */
export function drawRgbSplit(ctx, w, h, t, strength = 7) {
  if (!ctx) return;
  const ox = Math.sin(t * Math.PI * 10) * strength;
  const oy = Math.cos(t * Math.PI * 6) * strength * 0.45;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = `rgba(255,40,90,${0.09 + 0.07 * Math.sin(t * 22)})`;
  ctx.fillRect(ox, oy, w, h);
  ctx.fillStyle = `rgba(40,210,255,${0.09 + 0.07 * Math.cos(t * 19)})`;
  ctx.fillRect(-ox, -oy, w, h);
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 7; i++) {
    const y = ((t * 997 + i * 137) % 1) * h;
    const hh = 2 + ((t * 50 + i) % 1) * 12;
    const shift = (Math.sin(t * 40 + i) * 0.5) * strength * 5;
    ctx.fillStyle = `rgba(255,255,255,${0.035 + (i % 3) * 0.02})`;
    ctx.fillRect(shift, y, w, hh);
  }
  ctx.restore();
}

/** Zigzag lightning between two points. seed drives jitter. */
export function drawElectricArc(ctx, x1, y1, x2, y2, seed = 0, color = '#ffff88') {
  if (!ctx) return;
  const segs = 12;
  const jitter = (i, k) => {
    const v = Math.sin(seed * 12.9898 + i * 78.233 + k * 45.164) * 43758.5453;
    return v - Math.floor(v);
  };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const strokeOnce = (width, col, blur, alpha) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = col;
    ctx.lineWidth = width;
    ctx.shadowColor = col;
    ctx.shadowBlur = blur;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i < segs; i++) {
      const tt = i / segs;
      const nx = x1 + (x2 - x1) * tt;
      const ny = y1 + (y2 - y1) * tt;
      const amp = 20 * (1 - Math.abs(tt - 0.5) * 1.35);
      ctx.lineTo(
        nx + (jitter(i, 1) - 0.5) * amp * 2.2,
        ny + (jitter(i, 2) - 0.5) * amp * 2.2
      );
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  strokeOnce(4.5, color, 18, 0.55);
  strokeOnce(2.2, color, 10, 0.95);
  strokeOnce(1, '#ffffff', 4, 0.9);
  ctx.restore();
}

/** Soft radial wash under particles. */
export function drawRadialWash(ctx, x, y, r, rgba = 'rgba(170,68,255,0.25)') {
  if (!ctx) return;
  const g = ctx.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, rgba);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export async function morphChangesSequential(changes, cellCls, opts = {}) {
  if (!Array.isArray(changes) || !changes.length) return [];
  const hit = [];
  const delay = vfxMs(140, 45);
  const canvas = opts.canvas || prepVfxCanvas();
  const rgb = opts.rgb || [0, 240, 255];
  const color = opts.partColor || '#00f0ff';
  let parts = [];
  for (let ci = 0; ci < changes.length; ci++) {
    const ch = changes[ci];
    if (isVfxSkip()) {
      // apply remaining data without FX
      for (let j = ci; j < changes.length; j++) {
        const rch = changes[j];
        const rp = stepPos(rch?.pos);
        if (!rp) continue;
        if (rch.to != null) setCellSymbol(rp.c, rp.r, rch.to);
        setCellMystery(rp.c, rp.r, false);
        hit.push(`${rp.c},${rp.r}`);
      }
      break;
    }
    const p = stepPos(ch?.pos);
    if (!p) continue;
    if (ch.to != null) setCellSymbol(p.c, p.r, ch.to);
    setCellMystery(p.c, p.r, false);
    hit.push(`${p.c},${p.r}`);
    renderGrid();
    const el = cellEl(p.c, p.r);
    if (el) {
      el.classList.add(cellCls || 'vfx-morph', 'vfx-hit');
      if (cellCls === 'vfx-decrypt') el.classList.add('vfx-decrypt');
      const fxName = VFX_CLS_SYM_FX[cellCls] || VFX_CLS_SYM_FX['vfx-morph'] || 'pulse';
      setCellSymbolFx(el, fxName);
    }
    const rc = cellRectInWrap(p.c, p.r);
    if (canvas && rc) {
      parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, color, vfxParticleN(8), 'star'));
      await runAnimFrame(vfxMs(110, 40), (t) => {
        canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
        drawShockwave(canvas.ctx, rc.x, rc.y, t, rgb, 42);
        drawRadialWash(canvas.ctx, rc.x, rc.y, 36, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.2)`);
        parts = drawParts(canvas.ctx, parts, 1 / 55);
      });
    } else {
      await sleepRaw(delay);
    }
  }
  if (canvas && parts.length && !isVfxSkip()) {
    await runAnimFrame(vfxMs(220, 80), () => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  }
  clearCellClasses(['vfx-morph', 'vfx-hit', 'vfx-decrypt']);
  return hit;
}

export async function applySplitsAnimated(splitChanges) {
  if (!Array.isArray(splitChanges) || !splitChanges.length) return [];
  const hit = applyStepSplitChanges(splitChanges);
  // Stagger: re-render dual symbols then pop each cell + shockwave
  renderGrid();
  const ordered = [...hit];
  const canvas = prepVfxCanvas();
  let parts = [];
  for (const k of ordered) {
    if (isVfxSkip()) break;
    const [c, r] = k.split(',').map(Number);
    const el = cellEl(c, r);
    el?.classList.add('vfx-split');
    const rc = cellRectInWrap(c, r);
    if (canvas && rc) {
      parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#00ff88', vfxParticleN(6), 'star'));
      await runAnimFrame(vfxMs(150, 55), (t) => {
        canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
        // xSplit divider: bright line slices the cell, then fades
        const lw = Math.max(2, rc.w * 0.035);
        const grow = Math.min(1, t * 2.2);
        const lh = rc.h * 0.92 * grow;
        canvas.ctx.save();
        canvas.ctx.globalAlpha = grow >= 1 ? Math.max(0, 1 - (t - 0.45) / 0.55) : 1;
        canvas.ctx.fillStyle = '#eafff4';
        canvas.ctx.shadowColor = '#00ff88';
        canvas.ctx.shadowBlur = 14;
        canvas.ctx.fillRect(rc.x - lw / 2, rc.y - lh / 2, lw, lh);
        canvas.ctx.restore();
        drawShockwave(canvas.ctx, rc.x, rc.y, Math.max(0, t * 1.4 - 0.3), [0, 255, 136], 40);
        parts = drawParts(canvas.ctx, parts, 1 / 55);
      });
    } else {
      await sleepRaw(vfxMs(55, 18));
    }
  }
  if (canvas && parts.length && !isVfxSkip()) {
    await runAnimFrame(vfxMs(280, 100), () => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  } else {
    await sleepRaw(vfxMs(200, 70));
  }
  clearCellClasses(['vfx-split']);
  return hit;
}
