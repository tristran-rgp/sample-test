// src/ui/sprites.js — extracted from main.js
import { SYMBOLS } from '../game/config.js';
import { ASSET, assetUrl, setImgSrc } from './assets.js';
import { getSymbolPackId } from './symbolPack.js';

export const SYM_AURA = {
  A: { glow: '#ff4d6d', glow2: 'rgba(255,60,100,.35)',  hue: 0,   sat: 1.12, bright: 1.06 }, // Master Hacker — đỏ hồng
  B: { glow: '#00e5ff', glow2: 'rgba(0,220,255,.35)',   hue: 0,   sat: 1.1,  bright: 1.05 }, // AI Core — cyan
  C: { glow: '#b388ff', glow2: 'rgba(160,100,255,.35)', hue: 0,   sat: 1.12, bright: 1.05 }, // VR — tím
  D: { glow: '#69f0ae', glow2: 'rgba(80,240,160,.32)',  hue: 0,   sat: 1.08, bright: 1.04 }, // Drone — mint
  E: { glow: '#ffab40', glow2: 'rgba(255,160,40,.35)',  hue: 0,   sat: 1.12, bright: 1.05 }, // EMP — cam
  F: { glow: '#ffd54f', glow2: 'rgba(255,200,50,.32)',  hue: 0,   sat: 1.1,  bright: 1.04 }, // Bitcoin — vàng
  G: { glow: '#64ffda', glow2: 'rgba(80,255,200,.3)',   hue: 0,   sat: 1.08, bright: 1.03 }, // Terminal — teal
  H: { glow: '#40c4ff', glow2: 'rgba(50,180,255,.32)',  hue: 0,   sat: 1.08, bright: 1.03 }, // Code — sky
  I: { glow: '#ea80fc', glow2: 'rgba(220,100,255,.32)', hue: 0,   sat: 1.1,  bright: 1.04 }, // ETH — magenta
  K: { glow: '#00ff9c', glow2: 'rgba(0,255,140,.32)',   hue: 0,   sat: 1.1,  bright: 1.04 }, // Microchip — matrix green
  W: { glow: '#76ff03', glow2: 'rgba(100,255,40,.4)',   hue: 8,   sat: 1.18, bright: 1.08 }, // Wild — lime
  S: { glow: '#ff1744', glow2: 'rgba(255,30,70,.42)',   hue: 0,   sat: 1.15, bright: 1.06 }, // Scatter — đỏ
  M: { glow: '#d500f9', glow2: 'rgba(200,0,255,.4)',    hue: 0,   sat: 1.2,  bright: 1.06 }, // Mystery — purple
};

export function idleAuraFx(sym) {
  const a = SYM_AURA[sym];
  if (!a) return null;
  return {
    scale: 1,
    hue: a.hue ?? 0,
    sat: a.sat ?? 1.08,
    bright: a.bright ?? 1.04,
    contrast: 1,
    glow: a.glow,
    glowSize: 11,
    glow2: a.glow2 || 'transparent',
    glow2Size: 18,
  };
}

/**
 * Symbol visual FX presets (PNG art kept; look driven by CSS vars / classes).
 * Use setSymbolFx(imgEl, 'surge') or setSymbolFx(imgEl, { hue: 90, scale: 1.2, glow: '#f0f' }).
 */
export const SYM_FX = {
  none:      { scale: 1, hue: 0, sat: 1, bright: 1, contrast: 1, glow: 'transparent', glowSize: 0, glow2: 'transparent', glow2Size: 0 },
  wild:      { scale: 1.03, hue: 8, sat: 1.2, bright: 1.08, glow: '#76ff03', glowSize: 12, glow2: 'rgba(100,255,40,.4)', glow2Size: 20 },
  scatter:   { scale: 1.04, hue: 0, sat: 1.15, bright: 1.05, glow: '#ff1744', glowSize: 12, glow2: 'rgba(255,30,70,.4)', glow2Size: 20 },
  mystery:   { scale: 1, hue: 0, sat: 1.2, bright: 1.05, glow: '#d500f9', glowSize: 12, glow2: 'rgba(200,0,255,.4)', glow2Size: 20 },
  win:       { scale: 1.06, hue: 0, sat: 1.2, bright: 1.1, glow: '#00ff88', glowSize: 14 },
  decrypt:   { scale: 1.05, hue: 175, sat: 1.45, bright: 1.2, glow: '#00f0ff', glowSize: 14 },
  surge:     { scale: 1.08, hue: 45, sat: 1.5, bright: 1.25, glow: '#ffff00', glowSize: 16 },
  overclock: { scale: 1.05, hue: -25, sat: 1.35, bright: 1.15, glow: '#ff8800', glowSize: 12 },
  glitch:    { scale: 1, hue: 275, sat: 1.55, bright: 1.1, glow: '#aa44ff', glowSize: 10 },
  dim:       { scale: 0.94, hue: 0, sat: 0.45, bright: 0.62, glow: 'transparent', glowSize: 0 },
  hot:       { scale: 1.08, hue: -18, sat: 1.4, bright: 1.18, glow: '#ff4400', glowSize: 14 },
  ice:       { scale: 1, hue: 185, sat: 0.95, bright: 1.15, glow: '#88eeff', glowSize: 12 },
  pulse:     { scale: 1, hue: 0, sat: 1.1, bright: 1.05, glow: '#00ff9c', glowSize: 8 },
};

export const SYM_FX_CLASS = {
  wild: 'fx-wild', decrypt: 'fx-decrypt', surge: 'fx-surge', overclock: 'fx-overclock',
  glitch: 'fx-glitch', dim: 'fx-dim', hot: 'fx-hot', ice: 'fx-ice', pulse: 'fx-pulse',
};

export function resolveSymFx(fx) {
  if (!fx || fx === 'none') return { ...SYM_FX.none };
  if (typeof fx === 'string') return { ...SYM_FX.none, ...(SYM_FX[fx] || {}) };
  return { ...SYM_FX.none, ...fx };
}

/** Apply FX to a .sym-img element. Pass null/'none' to reset. */
export function setSymbolFx(el, fx) {
  if (!el) return;
  // strip named fx classes
  Object.values(SYM_FX_CLASS).forEach(c => el.classList.remove(c));
  el.classList.remove('fx-aura-breathe', 'fx-pulse');
  if (!fx || fx === 'none') {
    ['--sym-scale', '--sym-hue', '--sym-sat', '--sym-bright', '--sym-contrast',
      '--sym-glow', '--sym-glow-size', '--sym-glow2', '--sym-glow2-size'].forEach(k => el.style.removeProperty(k));
    delete el.dataset.symFx;
    el.style.animation = '';
    el.style.animationDelay = '';
    return;
  }
  const p = resolveSymFx(fx);
  el.style.setProperty('--sym-scale', String(p.scale ?? 1));
  el.style.setProperty('--sym-hue', `${p.hue ?? 0}deg`);
  el.style.setProperty('--sym-sat', String(p.sat ?? 1));
  el.style.setProperty('--sym-bright', String(p.bright ?? 1));
  el.style.setProperty('--sym-contrast', String(p.contrast ?? 1));
  el.style.setProperty('--sym-glow', p.glow || 'transparent');
  el.style.setProperty('--sym-glow-size', `${p.glowSize ?? 0}px`);
  el.style.setProperty('--sym-glow2', p.glow2 || 'transparent');
  el.style.setProperty('--sym-glow2-size', `${p.glow2Size ?? 0}px`);
  const name = typeof fx === 'string' ? fx : 'custom';
  el.dataset.symFx = name;
  if (typeof fx === 'string' && SYM_FX_CLASS[fx]) {
    el.classList.add(SYM_FX_CLASS[fx]);
  }
  if (name === 'pulse' || p.pulse) {
    el.classList.add('fx-pulse');
  }
}

/** Apply same FX to all .sym-img inside a cell / container. */
export function setCellSymbolFx(cellOrSel, fx) {
  const root = typeof cellOrSel === 'string' ? document.querySelector(cellOrSel) : cellOrSel;
  if (!root) return;
  root.querySelectorAll('.sym-img').forEach(img => setSymbolFx(img, fx));
}

/**
 * Animation-pack sprite sheets (Art New only).
 * Source: assert/art-new/animation-pack/ — optimized *-sprite.png (6×6).
 */
export const SPRITE_PACK_BASE = ASSET + 'art-new/animation-pack/';
export const SYM_SPRITES = {
  W: { file: 'wild-sprite.webp', cols: 6, rows: 6, frames: 36, idleFps: 10, winFps: 18 },
  A: { file: 'A-sprite.webp',    cols: 6, rows: 6, frames: 36, idleFps: 8,  winFps: 14 },
  D: { file: 'D-sprite.webp',    cols: 6, rows: 6, frames: 36, idleFps: 10, winFps: 16 },
  E: { file: 'E-sprite.webp',    cols: 6, rows: 6, frames: 36, idleFps: 10, winFps: 16 },
  S: { file: 'S-sprite.webp',    cols: 6, rows: 6, frames: 36, idleFps: 9,  winFps: 16 },
  M: { file: 'M-sprite.webp',    cols: 6, rows: 6, frames: 36, idleFps: 8,  winFps: 14 },
};
// Compat alias
export const WILD_SPRITE = SYM_SPRITES.W;

export const _spriteState = {}; // sym → { frame, lastTs }
export let _spriteRaf = 0;
export let _spriteBoostUntil = 0;

export function useSpritePackAnim() {
  return getSymbolPackId() === 'artNew';
}
/** @deprecated use useSpritePackAnim */
export function useWildSpriteAnim() {
  return useSpritePackAnim();
}

export function spriteFrameToPos(cfg, frame) {
  const f = ((frame % cfg.frames) + cfg.frames) % cfg.frames;
  const c = f % cfg.cols;
  const r = Math.floor(f / cfg.cols) % cfg.rows;
  const x = cfg.cols <= 1 ? 0 : (c / (cfg.cols - 1)) * 100;
  const y = cfg.rows <= 1 ? 0 : (r / (cfg.rows - 1)) * 100;
  return { x, y, f };
}

export function setSpriteCssFrame(sym, frame) {
  const cfg = SYM_SPRITES[sym];
  if (!cfg) return;
  const { x, y } = spriteFrameToPos(cfg, frame);
  const root = document.documentElement;
  root.style.setProperty(`--sp-${sym}-fx`, `${x}%`);
  root.style.setProperty(`--sp-${sym}-fy`, `${y}%`);
  // compat for old --wild-* vars
  if (sym === 'W') {
    root.style.setProperty('--wild-fx', `${x}%`);
    root.style.setProperty('--wild-fy', `${y}%`);
  }
}

export function spriteShouldBoost(sym) {
  if (performance.now() < _spriteBoostUntil) return true;
  const sel =
    `.cell.win .sym-sprite-${sym},` +
    `.cell.scatter-win .sym-sprite-${sym},` +
    `.cell.mystery .sym-sprite-${sym},` +
    `.cell.vfx-wild-glow .sym-sprite-${sym},` +
    `.reel.vfx-wild-col .sym-sprite-${sym},` +
    `.cell.vfx-surge .sym-sprite-${sym},` +
    `.cell.vfx-hit .sym-sprite-${sym}`;
  // also old wild class
  if (sym === 'W') {
    return !!document.querySelector(
      sel + ',.cell.win .sym-wild-sprite,.cell.vfx-wild-glow .sym-wild-sprite,.reel.vfx-wild-col .sym-wild-sprite'
    );
  }
  return !!document.querySelector(sel);
}

export let _spriteScanTs = 0;
export const _spritePresent = {};
export const _spriteBoosting = {};

export function refreshSpritePresence(now) {
  if (now - _spriteScanTs < 180) return;
  _spriteScanTs = now;
  for (const sym of Object.keys(SYM_SPRITES)) {
    const present =
      !!document.querySelector(`.sym-sprite-${sym}`) ||
      (sym === 'W' && !!document.querySelector('.sym-wild-sprite'));
    _spritePresent[sym] = present;
    _spriteBoosting[sym] = present && spriteShouldBoost(sym);
  }
}

export function spritePackTick(now) {
  if (document.hidden) {
    _spriteRaf = 0;
    return;
  }
  _spriteRaf = requestAnimationFrame(spritePackTick);
  if (!useSpritePackAnim()) return;
  refreshSpritePresence(now);

  for (const sym of Object.keys(SYM_SPRITES)) {
    if (!_spritePresent[sym]) continue;
    const cfg = SYM_SPRITES[sym];

    if (!_spriteState[sym]) {
      const phase = (sym.charCodeAt(0) * 7) % cfg.frames;
      _spriteState[sym] = { frame: phase, lastTs: now };
      setSpriteCssFrame(sym, phase);
      continue;
    }
    const st = _spriteState[sym];
    const fps = (performance.now() < _spriteBoostUntil || _spriteBoosting[sym])
      ? cfg.winFps
      : cfg.idleFps;
    const interval = 1000 / fps;
    if (now - st.lastTs < interval) continue;
    st.lastTs += interval;
    if (now - st.lastTs > interval * 3) st.lastTs = now;
    st.frame = (st.frame + 1) % cfg.frames;
    setSpriteCssFrame(sym, st.frame);
  }
}

export function ensureSpritePackTicker() {
  if (document.hidden) return;
  if (_spriteRaf) return;
  for (const sym of Object.keys(SYM_SPRITES)) setSpriteCssFrame(sym, 0);
  _spriteRaf = requestAnimationFrame(spritePackTick);
}
/** @deprecated */
export function ensureWildSpriteTicker() {
  ensureSpritePackTicker();
}

/** Tăng FPS sprite tạm thời (win / feature / expand). */
export function boostSpritePack(ms = 1400) {
  _spriteBoostUntil = performance.now() + ms;
  ensureSpritePackTicker();
}
/** @deprecated */
export function boostWildSprite(ms = 1400) {
  boostSpritePack(ms);
}

export function preloadSpritePack() {
  for (const cfg of Object.values(SYM_SPRITES)) {
    try {
      const pre = new Image();
      pre.src = assetUrl(SPRITE_PACK_BASE + cfg.file);
    } catch (_) { /* ignore */ }
  }
  // Win celebration sequence (mọi win > 0)
  try {
    const winSeq = new Image();
    winSeq.src = assetUrl(SPRITE_PACK_BASE + 'animation-sequence.webp');
  } catch (_) { /* ignore */ }
}

/** Create a symbol visual (.sym-img img or sprite div) with optional FX preset. */
export function createSymbolEl(sym, { fx, className, splitSide, breathe = true } = {}) {
  const s = SYMBOLS[sym];

  // Art New + animation-pack sheet available → animated sprite
  if (useSpritePackAnim() && SYM_SPRITES[sym]) {
    const el = document.createElement('div');
    const extra = sym === 'W' ? 'sym-wild-sprite' : '';
    el.className = ['sym-img', 'sym-sprite', `sym-sprite-${sym}`, extra, splitSide, className]
      .filter(Boolean).join(' ');
    el.dataset.sym = sym;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', s?.name || sym);
    el.draggable = false;
    ensureSpritePackTicker();
    if (fx) setSymbolFx(el, fx);
    else {
      const aura = idleAuraFx(sym);
      if (aura) {
        setSymbolFx(el, aura);
        el.dataset.symFx = 'idle';
      }
    }
    // Frame animation thay breathe — glow tĩnh
    return el;
  }

  const img = document.createElement('img');
  img.className = ['sym-img', splitSide, className].filter(Boolean).join(' ');
  img.decoding = 'async';
  img.draggable = false;
  if (s?.img) setImgSrc(img, s.img);
  img.alt = s?.name || sym;
  img.dataset.sym = sym;
  // Mỗi symbol idle tỏa 1 màu aura riêng
  if (fx) setSymbolFx(img, fx);
  else {
    const aura = idleAuraFx(sym);
    if (aura) {
      setSymbolFx(img, aura);
      img.dataset.symFx = 'idle';
    }
  }
  if (breathe && img.dataset.symFx === 'idle') {
    img.classList.add('fx-aura-breathe');
    // lệch phase theo symbol để glow không nhịp cùng lúc
    const phase = ((String(sym).charCodeAt(0) || 0) % 7) * 0.18;
    img.style.animationDelay = `-${phase}s`;
  }
  return img;
}

/** Map feature id → symbol FX (for feature VFX hooks). */
export function featureSymbolFx(featureId) {
  const map = {
    decrypt: 'decrypt',
    surge: 'surge',
    overclock: 'overclock',
    glitch: 'glitch',
    scan: 'ice',
    trojan: 'mystery',
    cloning: 'pulse',
    root: 'pulse',
    firewall: 'hot',
    overload: 'wild',
    bandwidth: 'hot',
    bypass: 'ice',
  };
  return map[featureId] || null;
}

// ── cross-module setters (mutable shared state) ──
export function set_spriteRaf(v) { _spriteRaf = v; }
