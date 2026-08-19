// ═══════════════════════════════════════════════════════════════
// ZERO DAY — Slot Game Engine
// ═══════════════════════════════════════════════════════════════

const ASSET = 'assert/';

/** All assets are WebP-only (PNG files removed). Canonical paths may still say .png. */
function toPngPath(path) {
  return String(path || '').replace(/\.png(\?|#|$)/i, '.webp$1');
}
function assetUrl(path) {
  const p = toPngPath(path);
  if (!p) return p;
  const v = typeof __ZD_ASSET_VERSION__ !== 'undefined' ? __ZD_ASSET_VERSION__ : '';
  return v && !/[?#]/.test(p) ? p + '?v=' + v : p;
}
function setImgSrc(el, path) {
  if (!el) return;
  el.src = assetUrl(path);
}
function imgTag(path, extra = '') {
  return `<img src="${assetUrl(path)}"${extra ? ' ' + extra : ''}>`;
}

/** Letter symbols shared by both art packs (A–K, W, S). Mystery uses pack file name. */
const LETTER_SYMS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'W', 'S'];
const MYSTERY_FILE = 'trojan-horse-mystery.webp';
const SYMBOL_PACKS = {
  classic: { id: 'classic', label: 'Classic', base: ASSET },
  artNew:  { id: 'artNew',  label: 'Art New', base: ASSET + 'art-new/' },
};
const DEFAULT_SYMBOL_PACK = 'artNew';

const SYMBOLS = {
  A: { img: ASSET + 'A.webp', name: 'Master Hacker', type: 'high', pays: [0,0,0.75,1.00,1.50] },
  B: { img: ASSET + 'B.webp', name: 'AI Core', type: 'high', pays: [0,0,0.50,0.75,1.00] },
  C: { img: ASSET + 'C.webp', name: 'VR Headset', type: 'high', pays: [0,0,0.50,0.75,1.00] },
  D: { img: ASSET + 'D.webp', name: 'Recon Drone', type: 'high', pays: [0,0,0.25,0.50,0.75] },
  E: { img: ASSET + 'E.webp', name: 'EMP Gun', type: 'high', pays: [0,0,0.25,0.50,0.75] },
  F: { img: ASSET + 'F.webp', name: 'Bitcoin', type: 'low', pays: [0,0,0.20,0.40,0.60] },
  G: { img: ASSET + 'G.webp', name: 'Terminal', type: 'low', pays: [0,0,0.20,0.40,0.60] },
  H: { img: ASSET + 'H.webp', name: 'Code', type: 'low', pays: [0,0,0.15,0.30,0.50] },
  I: { img: ASSET + 'I.webp', name: 'Ethereum', type: 'low', pays: [0,0,0.10,0.20,0.50] },
  K: { img: ASSET + 'K.webp', name: 'Microchip', type: 'low', pays: [0,0,0.10,0.20,0.50] },
  W: { img: ASSET + 'W.webp', name: 'Wild', type: 'wild', pays: [0,0,0,0,0] },
  S: { img: ASSET + 'S.webp', name: 'Scatter', type: 'scatter', pays: [0,0,0,0,0] },
  M: { img: ASSET + MYSTERY_FILE, name: 'Mystery', type: 'mystery', pays: [0,0,0,0,0] },
};

function getSymbolPackId() {
  return state?.symbolPack && SYMBOL_PACKS[state.symbolPack]
    ? state.symbolPack
    : DEFAULT_SYMBOL_PACK;
}

function symbolPackLabel(packId = getSymbolPackId()) {
  return SYMBOL_PACKS[packId]?.label || SYMBOL_PACKS.classic.label;
}

/** Apply art pack paths onto SYMBOLS; re-render grid/paytable when UI ready. */
function applySymbolPack(packId, { persist = true, toast = false, rerender = true } = {}) {
  const pack = SYMBOL_PACKS[packId] || SYMBOL_PACKS.classic;
  if (state) state.symbolPack = pack.id;
  for (const k of LETTER_SYMS) {
    if (SYMBOLS[k]) SYMBOLS[k].img = assetUrl(pack.base + k + '.webp');
  }
  if (SYMBOLS.M) SYMBOLS.M.img = assetUrl(pack.base + MYSTERY_FILE);
  if (persist) {
    try { localStorage.setItem('zd_symbol_pack', pack.id); } catch (_) { /* ignore */ }
  }
  const menuBtn = document.getElementById('menuSymbolPack');
  if (menuBtn) menuBtn.textContent = `🎨 Symbols: ${pack.label}`;
  // Theme playfield to match art pack (classic = blue chrome, artNew = matrix green)
  document.body.classList.toggle('pack-art-new', pack.id === 'artNew');
  document.body.classList.toggle('pack-classic', pack.id === 'classic');
  if (pack.id === 'artNew') {
    ensureSpritePackTicker();
    preloadSpritePack();
  }
  if (rerender) {
    if (typeof renderPaytable === 'function') renderPaytable();
    if (typeof renderGrid === 'function' && state?.grid?.length) renderGrid();
  }
  if (toast && typeof showToast === 'function') {
    showToast(
      pack.id === 'artNew'
        ? '🎨 Art New + matrix stage'
        : '🎨 Classic + blue chrome',
      pack.id === 'artNew' ? '#00ff9c' : '#00f0ff'
    );
  }
  return pack.id;
}

function cycleSymbolPack() {
  if (state.spinning || state.fxPlaying) {
    showToast('Đợi hết spin / VFX rồi đổi symbol', '#ff8800');
    return;
  }
  const order = Object.keys(SYMBOL_PACKS);
  const cur = getSymbolPackId();
  const next = order[(order.indexOf(cur) + 1) % order.length];
  applySymbolPack(next, { toast: true });
}

/**
 * Per-symbol aura — mỗi loại tỏa 1 màu riêng (idle trên reels).
 * high = ấm/rực · low = lạnh/neon · special = đậm đặc trưng
 */
const SYM_AURA = {
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

function idleAuraFx(sym) {
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
const SYM_FX = {
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

const SYM_FX_CLASS = {
  wild: 'fx-wild', decrypt: 'fx-decrypt', surge: 'fx-surge', overclock: 'fx-overclock',
  glitch: 'fx-glitch', dim: 'fx-dim', hot: 'fx-hot', ice: 'fx-ice', pulse: 'fx-pulse',
};

function resolveSymFx(fx) {
  if (!fx || fx === 'none') return { ...SYM_FX.none };
  if (typeof fx === 'string') return { ...SYM_FX.none, ...(SYM_FX[fx] || {}) };
  return { ...SYM_FX.none, ...fx };
}

/** Apply FX to a .sym-img element. Pass null/'none' to reset. */
function setSymbolFx(el, fx) {
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
function setCellSymbolFx(cellOrSel, fx) {
  const root = typeof cellOrSel === 'string' ? document.querySelector(cellOrSel) : cellOrSel;
  if (!root) return;
  root.querySelectorAll('.sym-img').forEach(img => setSymbolFx(img, fx));
}

/**
 * Animation-pack sprite sheets (Art New only).
 * Source: assert/art-new/animation-pack/ — optimized *-sprite.png (6×6).
 */
const SPRITE_PACK_BASE = ASSET + 'art-new/animation-pack/';
const SYM_SPRITES = {
  W: { file: 'wild-sprite.webp', cols: 6, rows: 6, frames: 36, idleFps: 10, winFps: 18 },
  A: { file: 'A-sprite.webp',    cols: 6, rows: 6, frames: 36, idleFps: 8,  winFps: 14 },
  D: { file: 'D-sprite.webp',    cols: 6, rows: 6, frames: 36, idleFps: 10, winFps: 16 },
  E: { file: 'E-sprite.webp',    cols: 6, rows: 6, frames: 36, idleFps: 10, winFps: 16 },
  S: { file: 'S-sprite.webp',    cols: 6, rows: 6, frames: 36, idleFps: 9,  winFps: 16 },
  M: { file: 'M-sprite.webp',    cols: 6, rows: 6, frames: 36, idleFps: 8,  winFps: 14 },
};
// Compat alias
const WILD_SPRITE = SYM_SPRITES.W;

const _spriteState = {}; // sym → { frame, lastTs }
let _spriteRaf = 0;
let _spriteBoostUntil = 0;

function useSpritePackAnim() {
  return getSymbolPackId() === 'artNew';
}
/** @deprecated use useSpritePackAnim */
function useWildSpriteAnim() {
  return useSpritePackAnim();
}

function spriteFrameToPos(cfg, frame) {
  const f = ((frame % cfg.frames) + cfg.frames) % cfg.frames;
  const c = f % cfg.cols;
  const r = Math.floor(f / cfg.cols) % cfg.rows;
  const x = cfg.cols <= 1 ? 0 : (c / (cfg.cols - 1)) * 100;
  const y = cfg.rows <= 1 ? 0 : (r / (cfg.rows - 1)) * 100;
  return { x, y, f };
}

function setSpriteCssFrame(sym, frame) {
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

function spriteShouldBoost(sym) {
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

let _spriteScanTs = 0;
const _spritePresent = {};
const _spriteBoosting = {};

function refreshSpritePresence(now) {
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

function spritePackTick(now) {
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

function ensureSpritePackTicker() {
  if (document.hidden) return;
  if (_spriteRaf) return;
  for (const sym of Object.keys(SYM_SPRITES)) setSpriteCssFrame(sym, 0);
  _spriteRaf = requestAnimationFrame(spritePackTick);
}
/** @deprecated */
function ensureWildSpriteTicker() {
  ensureSpritePackTicker();
}

/** Tăng FPS sprite tạm thời (win / feature / expand). */
function boostSpritePack(ms = 1400) {
  _spriteBoostUntil = performance.now() + ms;
  ensureSpritePackTicker();
}
/** @deprecated */
function boostWildSprite(ms = 1400) {
  boostSpritePack(ms);
}

function preloadSpritePack() {
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
function createSymbolEl(sym, { fx, className, splitSide, breathe = true } = {}) {
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
function featureSymbolFx(featureId) {
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

const PAYING = ['A','B','C','D','E','F','G','H','I','K'];
const LOWS = ['F','G','H','I','K'];
const HIGHS = ['A','B','C','D','E'];
const REELS = 5, ROWS = 3;
const WIN_CAP = 19693;
const REF_BET = 1;

const BET_LEVELS = {
  low: [0.20,0.40,0.60,0.80,1.00,1.20,1.60],
  med: [2.00,2.40,2.80,3.20,3.60,4.00,5.00,6.00,8.00,10.00,14.00,18.00,24.00,32.00],
  high: [40.00,60.00,80.00,100.00],
};
const ALL_BETS = [...BET_LEVELS.low, ...BET_LEVELS.med, ...BET_LEVELS.high];

/**
 * Giải thích tiếng Việt — ngắn, dễ hiểu (dùng cho mode 📖 Feature Explain).
 * nameVi: tên gọi dễ nhớ · what: feature sẽ làm gì · how: cách ảnh hưởng tiền/grid.
 */
const FEATURE_EXPLAIN_VI = {
  corehack: {
    nameVi: 'Lõi lượng tử (Core Hack)',
    what: 'Jackpot cố định 4 tier: USER 15×, GHOST 50×, ELITE 500×, GOD 19693× Total Bet.',
    how: 'RNG trước khi spin xong. Trúng thì tắt 12 mini-feature. Pick 15 node, match-3 để nhận giải.',
    see: 'Quantum Core phát sáng, kết nối Mainframe, rồi mở lưới 15 Encrypted Nodes.',
  },
  firewall: {
    nameVi: 'Tường lửa (Firewall Block)',
    what: 'Chặn 1–2 loại biểu tượng thấp (low) ra khỏi vòng quay lần này.',
    how: 'Các biểu tượng đó khó (hoặc không) xuất hiện trên lưới → lưới “sạch” low hơn, dễ ra biểu tượng cao hơn.',
    see: 'Tường lửa đỏ bốc từ dưới lưới, “đốt” các biểu tượng thấp.',
  },
  decrypt: {
    nameVi: 'Giải mã dữ liệu (Data Decrypt)',
    what: 'Chọn 1–2 ô đang là biểu tượng thấp và đổi thành biểu tượng cao.',
    how: 'Sau khi quay dừng, low → high trên lưới → có thể tạo thêm cách thắng (ways).',
    see: 'Lưới laser xanh quét qua, ô low biến thành high.',
  },
  trojan: {
    nameVi: 'Ngựa Trojan (Trojan Horse)',
    what: 'Thả 3–6 “hộp bí ẩn” (Mystery) xuống các ô ngẫu nhiên, rồi cùng lúc mở ra cùng một biểu tượng.',
    how: 'Nhiều ô biến thành cùng 1 symbol → dễ ăn ways dài / nhiều ô trùng.',
    see: 'Hộp/ngựa rơi xuống ô → nổ ra cùng một biểu tượng.',
  },
  overload: {
    nameVi: 'Quá tải dữ liệu (Data Overload)',
    what: 'Nếu cột nào có Wild, cả cột đó biến thành full Wild.',
    how: 'Wild thay thế hầu hết symbol khi tính ways → cột full Wild rất mạnh cho chuỗi thắng.',
    see: 'Tia điện từ Wild lan cả cột, cột sáng full Wild.',
  },
  overclock: {
    nameVi: 'Ép xung hệ thống (System Overclock)',
    what: 'Chọn 1 loại biểu tượng đang trả thưởng và dán cùng một hệ số ×3 / ×5 / ×8 / ×10 lên các ô đó.',
    how: 'Tiền ways của symbol đó được nhân thêm (một lần theo luật game, không nhân dồn theo từng ô).',
    see: 'Nhãn ×3/×5/×8/×10 đóng dấu cam lên các ô được chọn.',
  },
  cloning: {
    nameVi: 'Nhân bản dữ liệu (Data Cloning)',
    what: 'Chọn 1 loại biểu tượng và “tách đôi” (Split ×2) mọi ô cùng loại đó.',
    how: 'Mỗi ô split đếm như 2 symbol khi tính 243-ways → số ways / win tăng.',
    see: 'Biểu tượng rung, nhiễu bóng rồi tách đôi (hiện ×2).',
  },
  root: {
    nameVi: 'Quyền root (Root Access)',
    what: 'Chọn 1–3 cột (reel) và tách đôi (Split) gần như mọi ô trên các cột đó (trừ Scatter).',
    how: 'Nhiều ô ×2 trên cả cột → ways mạnh hơn rõ rệt.',
    see: 'Mưa code xanh (Matrix) đổ xuống 1–3 cột, ô bị tách đôi.',
  },
  surge: {
    nameVi: 'Xung điện (Power Surge)',
    what: 'Biến 1–2 loại biểu tượng thành Wild, rồi lan sóng làm các ô kế bên bị Split (tách đôi).',
    how: 'Vừa có thêm Wild, vừa có thêm split quanh đó → lưới “nổ” theo hướng thắng.',
    see: 'Sét giáng xuống → Wild, sóng xung kích tách các ô kề.',
  },
  glitch: {
    nameVi: 'Lỗi hệ thống (System Glitch)',
    what: 'Xáo trộn chỗ các biểu tượng không nằm trong chuỗi thắng (Scatter giữ nguyên).',
    how: 'Có thể “ghép lại” lưới sau khi đã biết win — chỉ đổi chỗ rác, không xóa win đã có trên logic server.',
    see: 'Lưới giật lag, sọc nhiễu; xong thì các ô “rác” đã đổi chỗ.',
  },
  scan: {
    nameVi: 'Quét thuật toán (Algorithmic Scan)',
    what: 'Khóa 1–3 loại biểu tượng và biến tất cả ô cùng loại đó thành Wild.',
    how: 'Nhiều Wild cùng lúc → ways dễ nối dài và trúng nhiều hơn.',
    see: 'Radar/hồng tâm khóa mục tiêu rồi ô đó thành Wild.',
  },
  bandwidth: {
    nameVi: 'Nhân băng thông (Bandwidth Multiplier)',
    what: 'Gán một hệ số nhân toàn cục ×3 / ×5 / ×8 / ×10 cho tổng tiền thắng của spin này.',
    how: 'Sau khi tính ways xong, toàn bộ win của spin được nhân thêm (server đã nhân sẵn trên số tiền trả).',
    see: 'Thanh loading băng thông giữa màn, kéo tới mức ×3/×5/×8/×10.',
  },
  bypass: {
    nameVi: 'Bypass hai chiều (Bypass Protocol)',
    what: 'Bật tính tiền cả hai hướng: Trái→Phải và Phải→Trái.',
    how: 'Ngoài ways bình thường (L→R), còn cộng thêm ways ngược (R→L) → tổng win có thể gấp phần hai chiều.',
    see: 'Mũi tên luồng dữ liệu chạy hai chiều Trái↔Phải.',
  },
};

/** Feature Meter slot #1 (GDD §8.2). Not in FEATURES — never RNG-picked with the 12 minis. */
const CORE_HACK = {
  id: 'corehack',
  name: 'Core Hack',
  color: '#00ff88',
  timing: 'pre',
  img: ASSET + 'quantum-core.webp',
  timingLabel: 'Before reels settle',
  desc: 'Fixed jackpot: USER 15× / GHOST 50× / ELITE 500× / GOD 19693× Total Bet. Disables the 12 mini-features on the same spin.',
  vfx: 'Quantum Core glows and connects to the Mainframe, then 15 Encrypted Nodes appear.',
};

const FEATURES = [
  {
    id: 'firewall', name: 'Firewall Block', color: '#ff3355', timing: 'spin', img: ASSET + 'firewall-block.webp',
    timingLabel: 'During spin',
    desc: 'Blocks 1–2 random low-paying symbols so they cannot land on the reels this spin.',
    vfx: 'Red firewall rises from below the grid and burns low symbols off the screen.',
  },
  {
    id: 'decrypt', name: 'Data Decrypt', color: '#00f0ff', timing: 'post', img: ASSET + 'data-decrypt.webp',
    timingLabel: 'After reels stop',
    desc: 'Picks 1–2 low-paying types present on the grid (F/G/H/I/K). Every cell of a chosen type becomes the same high symbol.',
    vfx: 'Cyan laser scan decrypts each chosen low type into one high symbol.',
  },
  {
    id: 'trojan', name: 'Trojan Horse', color: '#aa44ff', timing: 'post', img: ASSET + 'trojan-horse.webp',
    timingLabel: 'After reels stop',
    desc: 'Places 3–6 Mystery symbols. After the spin they all reveal as the same paying symbol.',
    vfx: 'Encrypted packages drop onto cells, then explode into matching symbols.',
  },
  {
    id: 'overload', name: 'Data Overload', color: '#ff8800', timing: 'post', img: ASSET + 'data-everload.webp',
    timingLabel: 'After reels stop',
    desc: 'Any reel that contains a Wild expands so the entire reel becomes Wild. No effect if no Wild is present.',
    vfx: 'Electric surge spreads from Wild and lights the full column.',
  },
  {
    id: 'overclock', name: 'System Overclock', color: '#ff8800', timing: 'post', img: ASSET + 'system-overclock.webp',
    timingLabel: 'After reels stop',
    desc: 'Chooses one paying symbol type and applies the same random multiplier (×3 / ×5 / ×8 / ×10) to all of them on the grid.',
    vfx: 'Orange overclock labels stamp ×N onto the chosen symbols.',
  },
  {
    id: 'cloning', name: 'Data Cloning', color: '#00ff88', timing: 'post', img: ASSET + 'data-cloning.webp',
    timingLabel: 'After reels stop',
    desc: 'Chooses one paying symbol type and splits every matching cell into a Split Symbol (counts as 2 in ways).',
    vfx: 'Symbols glitch and divide like digital mitosis.',
  },
  {
    id: 'root', name: 'Root Access', color: '#00ff88', timing: 'post', img: ASSET + 'root-access.webp',
    timingLabel: 'After reels stop',
    desc: 'Selects 1–3 reels and splits every symbol on those reels (except Scatters).',
    vfx: 'Green matrix rain floods the chosen reels and splits symbols.',
  },
  {
    id: 'surge', name: 'Power Surge', color: '#ffff00', timing: 'post', img: ASSET + 'power-surge.webp',
    timingLabel: 'After reels stop',
    desc: 'Picks 1–2 paying types present on the grid and converts every matching cell into Wild. All 8 adjacent cells (including diagonals, except Scatters) become Split Symbols.',
    vfx: 'Lightning strikes symbols into Wilds; shockwave splits the 8 neighboring cells.',
  },
  {
    id: 'glitch', name: 'System Glitch', color: '#aa44ff', timing: 'post', img: ASSET + 'system-glitch.webp',
    timingLabel: 'After reels stop',
    desc: 'Shuffles all non-winning symbols on the grid (Scatters stay). Multipliers and symbol size are kept.',
    vfx: 'Grid glitch/noise, then non-win symbols swap places.',
  },
  {
    id: 'scan', name: 'Algorithmic Scan', color: '#00f0ff', timing: 'post', img: ASSET + 'algorithmic-scan.webp',
    timingLabel: 'After reels stop',
    desc: 'Locks onto 1–3 paying symbol types and turns all of them into Wilds.',
    vfx: 'Radar target lock paints symbols, then they become Wild.',
  },
  {
    id: 'bypass', name: 'Bypass Protocol', color: '#00f0ff', timing: 'win', img: ASSET + 'bypass-protocal.webp',
    timingLabel: 'Win phase',
    desc: 'Unlocks Right-to-Left pays in addition to Left-to-Right. Total win is the sum of both directions.',
    vfx: 'Data-flow arrows show both L→R and R→L evaluation.',
  },
  {
    id: 'bandwidth', name: 'Bandwidth Multiplier', color: '#ff8800', timing: 'win', img: ASSET + 'bandwidth-multiplier%20.webp',
    timingLabel: 'Win phase',
    desc: 'Applies a random global win multiplier (×3 / ×5 / ×8 / ×10) to all wins of this spin.',
    vfx: 'Bandwidth loading bar ramps to the chosen multiplier.',
  },
];

const JACKPOT_TIERS = [
  { name: 'USER', mult: 15, emoji: '👤' },
  { name: 'GHOST', mult: 50, emoji: '👻' },
  { name: 'ELITE', mult: 500, emoji: '⭐' },
  { name: 'GOD', mult: 19693, emoji: '🔱' },
];
const JACKPOT_CORE_IMG = ASSET + 'quantum-core-jackpot.webp';

let _preloadPromise = null;
let _preloadDone = 0;
let _preloadTotal = 0;

function listPreloadUrls() {
  const urls = new Set();
  const add = (p) => { if (p) urls.add(assetUrl(p)); };
  for (const k of LETTER_SYMS) {
    add(ASSET + k + '.webp');
    add(ASSET + 'art-new/' + k + '.webp');
  }
  add(ASSET + MYSTERY_FILE);
  add(ASSET + 'art-new/' + MYSTERY_FILE);
  for (const cfg of Object.values(SYM_SPRITES)) add(SPRITE_PACK_BASE + cfg.file);
  add(ASSET + 'spin.webp');
  add(ASSET + 'auto-spin.webp');
  add(ASSET + 'buy-free-spin.webp');
  return [...urls];
}

/** Heavy/rarely-shown assets — load in background after critical set. */
function listDeferredUrls() {
  const urls = new Set();
  const add = (p) => { if (p) urls.add(assetUrl(p)); };
  add(SPRITE_PACK_BASE + 'animation-sequence.webp');
  add(CORE_HACK.img);
  for (const f of FEATURES) add(f.img);
  add(JACKPOT_CORE_IMG);
  return [...urls];
}

function preloadOne(url) {
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => resolve();
    img.onload = done;
    img.onerror = done;
    img.src = url;
  });
}

function updateLoginLoadUi() {
  const label = document.getElementById('loginLoadStatus');
  const fill = document.getElementById('loginLoadFill');
  const splashFill = document.getElementById('splashFill');
  const pct = _preloadTotal ? Math.round((_preloadDone / _preloadTotal) * 100) : 0;
  if (label) {
    label.textContent = (_preloadTotal && _preloadDone >= _preloadTotal)
      ? `Assets ready (${_preloadTotal})`
      : `Loading assets ${_preloadDone}/${_preloadTotal || '…'} (${pct}%)`;
    label.style.color = (_preloadTotal && _preloadDone >= _preloadTotal) ? 'var(--green)' : 'var(--dim)';
  }
  if (fill) fill.style.width = pct + '%';
  if (splashFill) splashFill.style.width = pct + '%';
}

function startAssetPreload() {
  if (_preloadPromise) return _preloadPromise;
  const urls = listPreloadUrls();
  _preloadTotal = urls.length;
  _preloadDone = 0;
  updateLoginLoadUi();
  const conc = 8;
  let i = 0;
  const worker = async () => {
    while (i < urls.length) {
      const url = urls[i++];
      await preloadOne(url);
      _preloadDone++;
      updateLoginLoadUi();
    }
  };
  _preloadPromise = Promise.all(Array.from({ length: conc }, worker));
  // Non-critical assets: load quietly in background, 2 at a time
  _preloadPromise.then(() => {
    const deferred = listDeferredUrls();
    let j = 0;
    const bg = async () => {
      while (j < deferred.length) {
        const url = deferred[j++];
        await preloadOne(url);
      }
    };
    return Promise.all(Array.from({ length: 2 }, bg));
  });
  return _preloadPromise;
}

function assetsReady() {
  return _preloadTotal > 0 && _preloadDone >= _preloadTotal;
}

function symImgHtml(sym, alt = '') {
  const s = SYMBOLS[sym];
  if (!s?.img) return alt || '?';
  return imgTag(s.img, `class="sym-img" alt="${s.name}" draggable="false"`);
}

// Reel strips (weighted)
const REEL_STRIPS = [
  ['F','G','H','I','K','A','B','F','G','S','H','C','D','F','G','I','K','E','F','G','H','W','I','K','B','F','G','H','A','C'],
  ['F','G','H','I','K','B','C','F','G','H','D','I','K','E','F','G','S','H','I','K','A','F','G','W','H','I','K','C','D','F'],
  ['F','G','H','I','K','C','D','F','G','H','E','I','K','A','F','G','S','H','I','K','B','F','G','W','H','I','K','D','E','F'],
  ['F','G','H','I','K','D','E','F','G','H','A','I','K','B','F','G','S','H','I','K','C','F','G','W','H','I','K','A','B','F'],
  ['F','G','H','I','K','E','A','F','G','H','B','I','K','C','F','G','S','H','I','K','D','F','G','W','H','I','K','E','A','F'],
];

// ─── State ───────────────────────────────────────────────────
const state = {
  balance: 10000,
  /** Số dư chụp lúc bắt đầu spin (trước debit/win) — giữ đến spin kế */
  balanceBefore: 10000,
  bet: 1.00,
  betIdx: 4,
  spinning: false,
  fxPlaying: false, // true khi đang diễn FX — chặn spin kế (auto/FS)
  fastSpin: false,
  /** Khi bật: mỗi feature pause 1 nhịp hiện chữ giải thích sẽ làm gì */
  featureExplain: false,
  autoSpins: 0,
  sound: true,
  music: true,
  /** Art pack id: classic | artNew — paths live on SYMBOLS[k].img */
  symbolPack: DEFAULT_SYMBOL_PACK,
  grid: [],
  cellMeta: [],
  lastWin: 0,
  /** Breakdown win spin vừa rồi (panel giải thích) */
  lastSpinExplain: null,
  /**
   * Frame WS IN gần nhất cho SPIN/BUY (cmd 1500/1501).
   * Panel giải thích win **bắt buộc** parse từ đây — không suy từ UI local.
   * Shape: { t, cmd, frame, payload, balanceBefore }
   */
  lastInSpin: null,
  sessionWin: 0,
  // Free spins
  inFreeSpins: false,
  fsRemaining: 0,
  fsTotal: 0,
  fsActiveFeatures: [],
  fsSessionWin: 0,
    fsBet: 0,
  // Buy features
  scatterBooster: false,
  buy3Features: false,
  buy12Features: false,
  extraFee: 0,
  // History
  history: [],
  txnId: null,
  // Active features this spin
  triggeredFeatures: [],
  /** Spin vừa rồi — bấm badge để replay VFX từng feature */
  lastFeatureReplay: null,
  lastJackpotActive: false,
  blockedSymbols: [],
  globalMultiplier: 1,
  bypassProtocol: false,
  persistentFeatures: [],
};

/** Runtime VFX control (skip remaining feature animations) */
let _vfxSkipAll = false;
let _vfxAnimCancel = null;
let _explainContinueResolve = null;

// ─── Utilities ───────────────────────────────────────────────
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function fmt(n) { return '$' + Number(n || 0).toFixed(2); }
function fmtBalance(n) {
  // Định dạng VND: dấu phẩy hàng nghìn, giữ 2 số thập phân + ký hiệu ₫
  const fixed = Number(n || 0).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const sign = intPart.startsWith('-') ? '-' : '';
  const digits = sign ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + grouped + '.' + decPart + ' ₫';
}
/**
 * Pay mult theo of-a-kind (3/4/5).
 * Client SYMBOLS[k].pays = [0, 0, p3, p4, p5]  → index = length - 1
 * (tooltip cũng slice(2) map thành "3:","4:","5:").
 * Không dùng pays[length] — với length=5 sẽ ra undefined.
 */
function getSymbolPayMult(sym, length) {
  const pays = SYMBOLS[sym]?.pays;
  if (!pays || length < 3) return 0;
  const v = pays[length - 1];
  return Number(v) || 0;
}
function sleep(ms) { return new Promise(r => setTimeout(r, state.fastSpin ? ms * 0.3 : ms)); }
function sleepRaw(ms) { return new Promise(r => setTimeout(r, ms)); }
function genTxnId() { return 'TXN' + Date.now().toString(36).toUpperCase() + randInt(100,999); }

// ─── SFX — WebAudio synth (không cần file MP3) ────────────────
// Tôn trọng state.sound. Spin ticks luôn phát; VFX skip chỉ chặn feature SFX.
const SFX_VOL = 1.45; // master loudness (1 = baseline)
let _audioCtx = null;
let _lastSpinTickAt = 0;

function getAudioCtx() {
  if (!state.sound) return null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!_audioCtx) _audioCtx = new AC();
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => {});
    }
    return _audioCtx;
  } catch (_) {
    return null;
  }
}

/** Đảm bảo browser cho phép audio sau gesture (click spin / sound) */
function unlockAudio() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start(0);
  } catch (_) { /* ignore */ }
}

/**
 * @param {string} type
 * @param {{gain?: number, pitch?: number, force?: boolean}} [opts]
 * force=true: vẫn phát khi đang skip VFX (dùng cho spin tick/land)
 */
function sfx(type, opts = {}) {
  if (!state.sound) return;
  if (!opts.force && typeof isVfxSkip === 'function' && isVfxSkip()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const gMul = (opts.gain != null ? opts.gain : 1) * SFX_VOL;
  const pitch = opts.pitch != null ? opts.pitch : 1;

  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(ctx.destination);

  const tone = (freq, typeOsc, t0, dur, peak, end = 0.0001) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = typeOsc;
    o.frequency.setValueAtTime(freq * pitch, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * gMul), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(end, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  };

  const noiseBurst = (t0, dur, peak, hpFreq = 800, lpFreq = 0) => {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = hpFreq;
    let node = hp;
    src.connect(hp);
    if (lpFreq > 0) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lpFreq;
      hp.connect(lp);
      node = lp;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * gMul), t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  };

  let hold = 0.9;
  switch (type) {
    case 'whoosh':
      noiseBurst(now, 0.22, 0.18, 400);
      tone(420, 'triangle', now, 0.2, 0.06);
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(680 * pitch, now);
        o.frequency.exponentialRampToValueAtTime(180 * pitch, now + 0.2);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.07 * gMul, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        o.connect(g);
        g.connect(master);
        o.start(now);
        o.stop(now + 0.25);
      } catch (_) {}
      hold = 0.35;
      break;
    case 'hit':
      noiseBurst(now, 0.08, 0.22, 600);
      tone(180, 'square', now, 0.09, 0.1);
      tone(90, 'sine', now, 0.12, 0.12);
      hold = 0.25;
      break;
    case 'charge':
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(120 * pitch, now);
        o.frequency.exponentialRampToValueAtTime(520 * pitch, now + 0.38);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.05 * gMul, now + 0.08);
        g.gain.linearRampToValueAtTime(0.08 * gMul, now + 0.3);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(400, now);
        f.frequency.exponentialRampToValueAtTime(2400, now + 0.38);
        o.connect(f);
        f.connect(g);
        g.connect(master);
        o.start(now);
        o.stop(now + 0.45);
      } catch (_) {
        tone(200, 'sawtooth', now, 0.35, 0.06);
      }
      hold = 0.5;
      break;
    case 'blip':
      tone(880, 'sine', now, 0.06, 0.07);
      tone(1320, 'sine', now + 0.04, 0.05, 0.04);
      hold = 0.15;
      break;
    case 'tick':
      // Tạch ngắn — mechanical reel click
      noiseBurst(now, 0.018, 0.14, 1200, 6000);
      tone(1800 + Math.random() * 400, 'square', now, 0.018, 0.045);
      tone(900, 'triangle', now, 0.022, 0.025);
      hold = 0.06;
      break;
    case 'land':
      // Thud khi reel dừng
      noiseBurst(now, 0.05, 0.16, 200, 1800);
      tone(140 * pitch, 'sine', now, 0.07, 0.1);
      tone(70 * pitch, 'triangle', now, 0.09, 0.08);
      tone(220 * pitch, 'square', now, 0.035, 0.04);
      hold = 0.15;
      break;
    case 'spinStart':
      noiseBurst(now, 0.12, 0.12, 500);
      tone(300, 'sawtooth', now, 0.1, 0.04);
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(200 * pitch, now);
        o.frequency.exponentialRampToValueAtTime(480 * pitch, now + 0.14);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.06 * gMul, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        o.connect(g);
        g.connect(master);
        o.start(now);
        o.stop(now + 0.18);
      } catch (_) {}
      hold = 0.25;
      break;
    case 'coin':
      // Tiền / way win nhỏ
      tone(1200 * pitch, 'sine', now, 0.05, 0.06);
      tone(1600 * pitch, 'sine', now + 0.04, 0.07, 0.05);
      tone(2000 * pitch, 'triangle', now + 0.08, 0.08, 0.035);
      hold = 0.2;
      break;
    case 'win':
      tone(523.25, 'sine', now, 0.12, 0.1);
      tone(659.25, 'sine', now + 0.08, 0.12, 0.09);
      tone(783.99, 'sine', now + 0.16, 0.18, 0.11);
      tone(1046.5, 'sine', now + 0.28, 0.28, 0.09);
      noiseBurst(now + 0.05, 0.08, 0.06, 400);
      hold = 0.7;
      break;
    case 'bigwin':
      tone(392, 'triangle', now, 0.12, 0.1);
      tone(523, 'triangle', now + 0.1, 0.14, 0.1);
      tone(659, 'sine', now + 0.22, 0.16, 0.11);
      tone(784, 'sine', now + 0.36, 0.2, 0.1);
      tone(1046, 'sine', now + 0.5, 0.28, 0.09);
      noiseBurst(now + 0.12, 0.12, 0.1, 300);
      hold = 1.0;
      break;
    case 'jackpot':
      tone(392, 'triangle', now, 0.15, 0.12);
      tone(523, 'triangle', now + 0.1, 0.15, 0.11);
      tone(659, 'triangle', now + 0.2, 0.2, 0.13);
      tone(784, 'sine', now + 0.35, 0.35, 0.11);
      tone(1175, 'sine', now + 0.5, 0.4, 0.08);
      noiseBurst(now + 0.1, 0.18, 0.14, 300);
      hold = 1.1;
      break;
    case 'laser':
      // Decrypt / scan
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(1400 * pitch, now);
        o.frequency.exponentialRampToValueAtTime(280 * pitch, now + 0.22);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.07 * gMul, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1200;
        f.Q.value = 4;
        o.connect(f);
        f.connect(g);
        g.connect(master);
        o.start(now);
        o.stop(now + 0.26);
      } catch (_) {
        tone(900, 'sawtooth', now, 0.2, 0.06);
      }
      noiseBurst(now, 0.1, 0.08, 900);
      hold = 0.3;
      break;
    case 'zap':
      // Surge / power
      noiseBurst(now, 0.06, 0.2, 800);
      tone(80, 'sawtooth', now, 0.08, 0.1);
      tone(400, 'square', now, 0.05, 0.07);
      tone(1200, 'square', now + 0.03, 0.04, 0.05);
      hold = 0.2;
      break;
    case 'fire':
      // Firewall
      noiseBurst(now, 0.18, 0.16, 200, 2400);
      tone(90, 'sawtooth', now, 0.15, 0.07);
      tone(160, 'triangle', now + 0.04, 0.12, 0.05);
      hold = 0.3;
      break;
    case 'glitch':
      noiseBurst(now, 0.05, 0.14, 1000);
      tone(300 + Math.random() * 800, 'square', now, 0.04, 0.07);
      tone(200 + Math.random() * 600, 'sawtooth', now + 0.03, 0.05, 0.05);
      tone(900, 'square', now + 0.06, 0.03, 0.04);
      hold = 0.18;
      break;
    case 'reveal':
      // Trojan mystery open
      tone(300, 'sine', now, 0.08, 0.06);
      tone(450, 'sine', now + 0.06, 0.08, 0.07);
      tone(600, 'triangle', now + 0.12, 0.12, 0.08);
      tone(900, 'sine', now + 0.2, 0.15, 0.06);
      noiseBurst(now + 0.1, 0.08, 0.08, 500);
      hold = 0.45;
      break;
    case 'matrix':
      // Root / cloning
      for (let i = 0; i < 5; i++) {
        tone(600 + i * 180, 'square', now + i * 0.035, 0.04, 0.035);
      }
      noiseBurst(now, 0.12, 0.06, 1500);
      hold = 0.3;
      break;
    case 'radar':
      // Algorithmic scan
      tone(440, 'sine', now, 0.06, 0.05);
      tone(660, 'sine', now + 0.08, 0.06, 0.05);
      tone(880, 'sine', now + 0.16, 0.08, 0.06);
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(200 * pitch, now);
        o.frequency.linearRampToValueAtTime(900 * pitch, now + 0.28);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.04 * gMul, now + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        o.connect(g);
        g.connect(master);
        o.start(now);
        o.stop(now + 0.32);
      } catch (_) {}
      hold = 0.4;
      break;
    case 'flow':
      // Bypass both-ways
      tone(330, 'triangle', now, 0.1, 0.05);
      tone(440, 'triangle', now + 0.05, 0.1, 0.05);
      tone(550, 'sine', now + 0.12, 0.14, 0.06);
      tone(440, 'triangle', now + 0.18, 0.1, 0.04);
      tone(330, 'triangle', now + 0.24, 0.12, 0.04);
      hold = 0.45;
      break;
    case 'boost':
      // Bandwidth / overclock
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(100 * pitch, now);
        o.frequency.exponentialRampToValueAtTime(800 * pitch, now + 0.32);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.07 * gMul, now + 0.1);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(300, now);
        f.frequency.exponentialRampToValueAtTime(3200, now + 0.32);
        o.connect(f);
        f.connect(g);
        g.connect(master);
        o.start(now);
        o.stop(now + 0.4);
      } catch (_) {
        tone(200, 'sawtooth', now, 0.3, 0.06);
      }
      hold = 0.45;
      break;
    case 'expand':
      // Overload wild expand
      tone(180, 'sine', now, 0.1, 0.07);
      tone(240, 'triangle', now + 0.06, 0.12, 0.07);
      tone(360, 'sine', now + 0.14, 0.16, 0.08);
      noiseBurst(now + 0.08, 0.1, 0.08, 400);
      hold = 0.4;
      break;
    default:
      tone(440, 'sine', now, 0.08, 0.05);
      hold = 0.15;
  }

  master.gain.setValueAtTime(1, now);
  master.gain.setValueAtTime(1, now + Math.max(0.05, hold * 0.7));
  master.gain.exponentialRampToValueAtTime(0.0001, now + hold + 0.05);
}

/** Tick tạch-tạch khi reel đang quay (throttle theo ms). */
function sfxSpinTick(elapsedMs, fast) {
  if (!state.sound) return;
  const interval = fast ? 48 : 68;
  if (elapsedMs - _lastSpinTickAt < interval) return;
  _lastSpinTickAt = elapsedMs;
  // pitch hơi lệch mỗi tick → sống động
  const p = 0.88 + Math.random() * 0.28;
  sfx('tick', { gain: fast ? 0.42 : 0.5, pitch: p, force: true });
}

function sfxReelLand(reelIndex = 0) {
  sfx('land', {
    gain: 0.78,
    pitch: 0.92 + reelIndex * 0.06,
    force: true,
  });
}

/** Map feature → SFX khi bắt đầu scene */
function sfxForFeatureStart(featId) {
  const map = {
    firewall: 'fire',
    decrypt: 'laser',
    trojan: 'reveal',
    overload: 'expand',
    overclock: 'boost',
    cloning: 'matrix',
    root: 'matrix',
    surge: 'zap',
    glitch: 'glitch',
    scan: 'radar',
    bandwidth: 'boost',
    bypass: 'flow',
  };
  sfx(map[featId] || 'charge', { gain: 1.15, force: true });
}

/** Map feature → SFX khi kết scene / hit */
function sfxForFeatureHit(featId) {
  const map = {
    firewall: 'hit',
    decrypt: 'blip',
    trojan: 'hit',
    overload: 'hit',
    overclock: 'coin',
    cloning: 'blip',
    root: 'hit',
    surge: 'zap',
    glitch: 'glitch',
    scan: 'hit',
    bandwidth: 'coin',
    bypass: 'blip',
  };
  sfx(map[featId] || 'hit', { gain: 1.1, force: true });
}

// ─── Presentation gate: auto/FS chỉ spin tiếp khi FX xong ────
function beginFx() { state.fxPlaying = true; syncPerfMode(); }
function endFx() { state.fxPlaying = false; syncPerfMode(); }

/**
 * Chờ toàn bộ hiệu ứng UI của spin hiện tại kết thúc
 * (float CSS, overlay, dim-win, toast) trước khi gửi spin kế.
 */
async function settleAfterSpinPresentation({
  hadWin = false,
  hadFeatures = false,
  totalWin = 0,
} = {}) {
  beginFx();
  try {
    // Win float/ticker đã xong trong animateWinWays — nghỉ ngắn trước spin kế
    if (hadWin) {
      await sleepRaw(state.fastSpin ? 120 : 280);
    } else if (hadFeatures) {
      await sleepRaw(state.fastSpin ? 220 : 450);
    } else {
      // Nhịp nghỉ tối thiểu giữa 2 spin (auto/FS no-win)
      await sleepRaw(state.fastSpin ? 160 : 320);
    }

    // Dọn class/animation còn sót — tránh spin sau cắt ngang
    document.getElementById('winOverlay')?.classList.remove('show');
    clearWinFxPosition();
    const wrap = document.getElementById('reelsWrapper');
    wrap?.classList.remove('dim-win', 'tease-dim');
    document.querySelectorAll('.win-float').forEach(el => el.remove());
    document.querySelectorAll('.reel').forEach(el => {
      el.classList.remove('spinning-reel', 'landing', 'tease', 'stopping');
    });

    // Beat cuối trước khi cho phép lệnh spin tiếp theo
    const big = totalWin >= (20 * (state.bet / REF_BET));
    await sleepRaw(state.fastSpin ? (big ? 200 : 120) : (big ? 450 : 280));
  } finally {
    endFx();
  }
}

async function waitFxIdle() {
  let guard = 0;
  while (state.fxPlaying && guard < 400) {
    await sleepRaw(50);
    guard++;
  }
}

function showToast(msg, color = 'var(--cyan)') {
  const el = document.getElementById('featToast');
  el.textContent = msg;
  el.style.borderColor = color;
  el.style.color = color;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ─── Grid helpers ────────────────────────────────────────────
function createEmptyGrid() {
  state.grid = Array.from({ length: REELS }, () => Array(ROWS).fill('F'));
  state.cellMeta = Array.from({ length: REELS }, () =>
    Array.from({ length: ROWS }, () => ({ split: false, multiplier: 1, mystery: false }))
  );
}

function getEffectiveSymbols(reel, row) {
  const sym = state.grid[reel][row];
  const meta = state.cellMeta[reel][row];
  if (meta.mystery) return ['M'];
  const count = meta.split ? 2 : 1;
  return Array(count).fill(sym);
}

function getReelSymbols(reel) {
  const syms = [];
  for (let r = 0; r < ROWS; r++) syms.push(...getEffectiveSymbols(reel, r));
  return syms;
}

function spinReel(strip, blocked = []) {
  const avail = strip.filter(s => !blocked.includes(s));
  const use = avail.length ? avail : strip;
  const start = Math.floor(Math.random() * use.length);
  return [0,1,2].map(i => use[(start + i) % use.length]);
}

// ─── 243 Ways Calculator ─────────────────────────────────────
function calcWays(direction = 'ltr') {
  const wins = [];
  const reels = direction === 'ltr' ? [...Array(REELS).keys()] : [...Array(REELS).keys()].reverse();
  const startReel = reels[0];

  for (const sym of PAYING) {
    let length = 0;
    const counts = [];

    for (const ri of reels) {
      const reelSyms = getReelSymbols(ri);
      let n = 0;
      for (const s of reelSyms) {
        if (s === sym || s === 'W') n++;
      }
      if (n > 0) { length++; counts.push(n); }
      else break;
    }

    if (length >= 3) {
      const winCount = counts.reduce((a, b) => a * b, 1);
      const cx = getSymbolPayMult(sym, length);
      let win = winCount * cx * state.bet;

      // Per-symbol multipliers from overclock
      let symMult = 1;
      for (let ri = 0; ri < length; ri++) {
        const realReel = reels[ri];
        for (let r = 0; r < ROWS; r++) {
          if (state.grid[realReel][r] === sym || state.grid[realReel][r] === 'W') {
            symMult = Math.max(symMult, state.cellMeta[realReel][r].multiplier);
          }
        }
      }
      win *= symMult;
      wins.push({ sym, length, winCount, cx, win, direction, reelPositions: counts });
    }
  }
  return wins;
}

function calcTotalWin() {
  let wins = calcWays('ltr');
  if (state.bypassProtocol) {
    wins = [...wins, ...calcWays('rtl')];
  }
  let total = wins.reduce((s, w) => s + w.win, 0);
  total *= state.globalMultiplier;
  const cap = WIN_CAP * state.bet;
  const capped = total > cap;
  return { total: Math.min(total, cap), wins, capped, cap };
}

function countScatters() {
  let n = 0;
  for (let c = 0; c < REELS; c++)
    for (let r = 0; r < ROWS; r++)
      if (state.grid[c][r] === 'S') n++;
  return n;
}

// ─── Feature Engine ──────────────────────────────────────────
function selectRandomFeatures(count) {
  const pool = [...FEATURES];
  const selected = [];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    selected.push(pool.splice(idx, 1)[0]);
  }
  return selected.sort((a, b) => FEATURES.indexOf(a) - FEATURES.indexOf(b));
}

function maybeTriggerFeatures() {
  if (state.buy12Features) return [...FEATURES];
  if (state.buy3Features) return selectRandomFeatures(3);
  if (state.inFreeSpins && state.persistentFeatures.length) {
    const extra = Math.random() < 0.15 ? selectRandomFeatures(1) : [];
    const combined = [...state.persistentFeatures];
    extra.forEach(f => { if (!combined.find(c => c.id === f.id)) combined.push(f); });
    return combined.sort((a, b) => FEATURES.indexOf(a) - FEATURES.indexOf(b));
  }
  if (Math.random() < 0.25) return selectRandomFeatures(randInt(1, 2));
  return [];
}

async function applyFirewallBlock() {
  const n = randInt(1, 2);
  state.blockedSymbols = shuffle(LOWS).slice(0, n);
  showToast(`🔥 Firewall Block: ${state.blockedSymbols.map(s => SYMBOLS[s].name).join(', ')} blocked`, '#ff3355');
  await sleep(600);
}

async function applyDataDecrypt() {
  const present = [];
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const sym = state.grid[c][r];
      if (LOWS.includes(sym) && !present.includes(sym)) present.push(sym);
    }
  }
  if (!present.length) {
    showToast('🔵 Data Decrypt: no low types on grid', '#00f0ff');
    await sleep(400);
    return;
  }
  const n = randInt(1, Math.min(2, present.length));
  const targets = shuffle(present).slice(0, n);
  const map = {};
  for (const t of targets) map[t] = rand(HIGHS);
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const next = map[state.grid[c][r]];
      if (next) state.grid[c][r] = next;
    }
  }
  const summary = targets.map(t => `${SYMBOLS[t].name}→${SYMBOLS[map[t]].name}`).join(', ');
  showToast(`🔵 Data Decrypt: ${summary}`, '#00f0ff');
  await sleep(700);
}

async function applyTrojanHorse() {
  const n = randInt(3, 6);
  const reveal = rand(PAYING);
  const positions = [];
  while (positions.length < n) {
    const c = randInt(0, REELS - 1), r = randInt(0, ROWS - 1);
    if (!positions.find(p => p.c === c && p.r === r)) {
      positions.push({ c, r });
      state.grid[c][r] = 'M';
      state.cellMeta[c][r].mystery = true;
    }
  }
  await sleep(800);
  for (const { c, r } of positions) {
    state.grid[c][r] = reveal;
    state.cellMeta[c][r].mystery = false;
  }
  showToast(`🐴 Trojan Horse → ${SYMBOLS[reveal].name}`, '#aa44ff');
  await sleep(500);
}

async function applyDataOverload() {
  let hasWild = false;
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (state.grid[c][r] === 'W') {
        hasWild = true;
        for (let rr = 0; rr < ROWS; rr++) state.grid[c][rr] = 'W';
      }
    }
  }
  if (hasWild) { showToast('⚡ Data Overload: Wild columns expanded!', '#ff8800'); await sleep(700); }
}

async function applySystemOverclock() {
  const sym = rand(PAYING);
  const mult = rand([3, 5, 8, 10]);
  for (let c = 0; c < REELS; c++)
    for (let r = 0; r < ROWS; r++)
      if (state.grid[c][r] === sym) state.cellMeta[c][r].multiplier = mult;
  showToast(`🔥 System Overclock: ${SYMBOLS[sym].name} ×${mult}`, '#ff8800');
  await sleep(600);
}

async function applyDataCloning() {
  const sym = rand(PAYING);
  const keys = [];
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (state.grid[c][r] === sym) {
        state.cellMeta[c][r].split = true;
        keys.push(`${c},${r}`);
      }
    }
  }
  showToast(`🧬 Data Cloning: ${SYMBOLS[sym].name} tách đôi ×2`, '#00ff88');
  renderGrid();
  await highlightCells(keys, 'vfx-split', state.fastSpin ? 280 : 600);
}

async function applyRootAccess() {
  const n = randInt(1, 3);
  const reels = shuffle([...Array(REELS).keys()]).slice(0, n);
  const keys = [];
  for (const c of reels) {
    document.getElementById(`reel-${c}`)?.classList.add('vfx-col-root');
    for (let r = 0; r < ROWS; r++) {
      if (state.grid[c][r] !== 'S') {
        state.cellMeta[c][r].split = true;
        keys.push(`${c},${r}`);
      }
    }
  }
  showToast(
    `🌧️ Root Access: tách đôi reel ${reels.map(r => r + 1).join(', ')}`,
    '#00ff88'
  );
  renderGrid();
  await highlightCells(keys, 'vfx-split', state.fastSpin ? 280 : 650);
  document.querySelectorAll('.vfx-col-root').forEach(el => el.classList.remove('vfx-col-root'));
}

async function applyPowerSurge() {
  const present = [];
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const sym = state.grid[c][r];
      if (PAYING.includes(sym) && !present.includes(sym)) present.push(sym);
    }
  }
  if (!present.length) {
    showToast('⚡ Power Surge: no pay types on grid', '#ffff00');
    await sleep(400);
    return;
  }
  const counts = {};
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const sym = state.grid[c][r];
      if (present.includes(sym)) counts[sym] = (counts[sym] || 0) + 1;
    }
  }
  const n = present.length >= 2 && Math.random() < 0.1 ? 2 : 1;
  let min = Infinity;
  let second = Infinity;
  for (const s of present) {
    const cells = counts[s] || 1;
    if (cells < min) { second = min; min = cells; }
    else if (cells > min && cells < second) second = cells;
  }
  const pool = present.filter(s => {
    const cells = counts[s] || 1;
    return cells === min || cells === second;
  });
  const targets = [];
  for (let i = 0; i < n && pool.length; i++) {
    let total = 0;
    const weights = pool.map(s => {
      const w = Math.max(1, Math.floor(16 / Math.max(1, counts[s] || 1)));
      total += w;
      return w;
    });
    let roll = Math.floor(Math.random() * total);
    let idx = 0;
    for (let j = 0; j < weights.length; j++) {
      roll -= weights[j];
      if (roll < 0) { idx = j; break; }
    }
    targets.push(pool.splice(idx, 1)[0]);
  }
  const wildPositions = [];
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (targets.includes(state.grid[c][r])) {
        state.grid[c][r] = 'W';
        wildPositions.push({ c, r });
      }
    }
  }
  const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  for (const { c, r } of wildPositions) {
    for (const [dc, dr] of dirs) {
      const nc = c + dc, nr = r + dr;
      if (nc >= 0 && nc < REELS && nr >= 0 && nr < ROWS && state.grid[nc][nr] !== 'S') {
        state.cellMeta[nc][nr].split = true;
      }
    }
  }
  showToast(`⚡ Power Surge: ${targets.map(s => SYMBOLS[s].name).join(', ')} → Wild`, '#ffff00');
  await sleep(700);
}

async function applySystemGlitch() {
  const { wins } = calcTotalWin();
  const winningCells = new Set();
  // Simple: mark cells that are part of any win
  for (const w of wins) {
    for (let i = 0; i < w.length; i++) {
      for (let r = 0; r < ROWS; r++) {
        if (state.grid[i][r] === w.sym || state.grid[i][r] === 'W') winningCells.add(`${i},${r}`);
      }
    }
  }
  const nonWinning = [];
  for (let c = 0; c < REELS; c++)
    for (let r = 0; r < ROWS; r++)
      if (!winningCells.has(`${c},${r}`) && state.grid[c][r] !== 'S')
        nonWinning.push({ c, r, sym: state.grid[c][r], meta: { ...state.cellMeta[c][r] } });

  if (nonWinning.length < 2) return;
  const syms = shuffle(nonWinning.map(p => p.sym));
  const metas = shuffle(nonWinning.map(p => p.meta));
  nonWinning.forEach((p, i) => {
    state.grid[p.c][p.r] = syms[i];
    state.cellMeta[p.c][p.r] = { ...metas[i] };
  });
  showToast('📺 System Glitch: Non-winning symbols shuffled', '#aa44ff');
  await sleep(700);
}

async function applyAlgorithmicScan() {
  const n = randInt(1, 3);
  const targets = shuffle(PAYING).slice(0, n);
  for (let c = 0; c < REELS; c++)
    for (let r = 0; r < ROWS; r++)
      if (targets.includes(state.grid[c][r])) state.grid[c][r] = 'W';
  showToast(`🎯 Algorithmic Scan: ${targets.map(s => SYMBOLS[s].name).join(', ')} → Wild`, '#00f0ff');
  await sleep(600);
}

function applyBandwidthMultiplier() {
  state.globalMultiplier = rand([3, 5, 8, 10]);
  const box = document.getElementById('multDisplay');
  if (box) {
    box.textContent = String(state.globalMultiplier).padStart(2, '0');
    box.parentElement?.classList.remove('bump');
    void box.parentElement?.offsetWidth;
    box.parentElement?.classList.add('bump');
  }
  showToast(`📶 Bandwidth Multiplier: ×${state.globalMultiplier}`, '#ff8800');
}

function applyBypassProtocol() {
  state.bypassProtocol = true;
  showToast('↔️ Bypass Protocol: Both-way payouts active!', '#00f0ff');
}

const FEATURE_HANDLERS = {
  firewall: applyFirewallBlock,
  decrypt: applyDataDecrypt,
  trojan: applyTrojanHorse,
  overload: applyDataOverload,
  overclock: applySystemOverclock,
  cloning: applyDataCloning,
  root: applyRootAccess,
  surge: applyPowerSurge,
  glitch: applySystemGlitch,
  scan: applyAlgorithmicScan,
  bypass: applyBypassProtocol,
  bandwidth: applyBandwidthMultiplier,
};

// ─── Render ──────────────────────────────────────────────────
/** Build symbol node(s). Split cells show TWO icons side-by-side (GDD Split Symbol). */
function appendSymbolVisual(cell, sym, isSplit, fx) {
  const s = SYMBOLS[sym];
  if (!s?.img) {
    cell.textContent = '?';
    return;
  }
  if (isSplit) {
    const pair = document.createElement('div');
    pair.className = 'split-pair';
    for (const side of ['split-a', 'split-b']) {
      const img = createSymbolEl(sym, { fx, splitSide: side });
      img.alt = `${s.name} ×2`;
      pair.appendChild(img);
    }
    cell.appendChild(pair);
    const badge = document.createElement('span');
    badge.className = 'split-badge';
    badge.textContent = '×2';
    cell.appendChild(badge);
  } else {
    cell.appendChild(createSymbolEl(sym, { fx }));
  }
}

function bindGridClicksOnce() {
  const grid = document.getElementById('reelsGrid');
  if (!grid || grid.dataset.clickBound === '1') return;
  grid.dataset.clickBound = '1';
  grid.addEventListener('click', e => {
    const cell = e.target.closest('.cell');
    if (!cell || !grid.contains(cell)) return;
    const c = Number(cell.dataset.reel);
    const r = Number(cell.dataset.row);
    const sym = state.grid?.[c]?.[r];
    if (sym) showSymTooltip(sym, cell);
  });
}

function paintCell(cell, c, r, highlightSet) {
  const sym = state.grid[c][r];
  const meta = state.cellMeta[c][r] || { split: false, multiplier: 1, mystery: false };
  const split = !!meta.split && sym !== 'S';
  const win = highlightSet.has(`${c},${r}`);
  const key = `${sym}|${split ? 1 : 0}|${meta.multiplier || 1}|${win ? 1 : 0}|${meta.mystery || sym === 'M' ? 1 : 0}`;
  if (cell.dataset.rk === key) return;
  cell.dataset.rk = key;
  cell.dataset.reel = String(c);
  cell.dataset.row = String(r);
  cell.className = 'cell';
  if (win) cell.classList.add('win');
  if (sym === 'S') cell.classList.add('scatter-win');
  if (meta.mystery || sym === 'M') cell.classList.add('mystery');
  if (meta.split) cell.classList.add('split');
  cell.replaceChildren();
  if (meta.multiplier > 1) {
    const tag = document.createElement('span');
    tag.className = 'mult-tag';
    tag.textContent = `×${meta.multiplier}`;
    cell.appendChild(tag);
  }
  appendSymbolVisual(cell, sym, split);
}

function renderGrid(highlight = []) {
  const grid = document.getElementById('reelsGrid');
  if (!grid || !state.grid?.length) return;
  bindGridClicksOnce();
  const winSet = new Set(highlight);
  const canPatch =
    grid.children.length === REELS &&
    Array.from(grid.children).every(reel => reel.children.length === ROWS);

  if (!canPatch) {
    grid.replaceChildren();
    for (let c = 0; c < REELS; c++) {
      const reel = document.createElement('div');
      reel.className = 'reel';
      reel.id = `reel-${c}`;
      for (let r = 0; r < ROWS; r++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        paintCell(cell, c, r, winSet);
        reel.appendChild(cell);
      }
      grid.appendChild(reel);
    }
    return;
  }

  for (let c = 0; c < REELS; c++) {
    const reel = grid.children[c];
    reel.id = `reel-${c}`;
    for (let r = 0; r < ROWS; r++) {
      paintCell(reel.children[r], c, r, winSet);
    }
  }
}

function meterItems() {
  return [CORE_HACK, ...FEATURES];
}

function findMeterFeature(featureId) {
  return meterItems().find(x => x.id === featureId);
}

function showFeatureDetail(featureId) {
  const f = findMeterFeature(featureId);
  if (!f) return;
  const vi = FEATURE_EXPLAIN_VI[f.id] || {};
  const replayable = findReplayStepIndex(f.id) >= 0;
  const active = f.id === CORE_HACK.id
    ? !!state.lastJackpotActive
    : !!(state.triggeredFeatures || []).find(x => x.id === f.id)
      || !!(state.persistentFeatures || []).find(x => x.id === f.id)
      || replayable;

  const img = document.getElementById('featDetailImg');
  const title = document.getElementById('featDetailTitle');
  const timing = document.getElementById('featDetailTiming');
  const desc = document.getElementById('featDetailDesc');
  const how = document.getElementById('featDetailHow');
  const vfx = document.getElementById('featDetailVfx');
  const status = document.getElementById('featDetailStatus');
  const replayBtn = document.getElementById('btnReplayFeature');
  if (!img || !title) return;
  if (replayBtn) {
    replayBtn.style.display = replayable ? '' : 'none';
    replayBtn.dataset.featureId = f.id;
  }

  const order = meterItems().findIndex(x => x.id === f.id) + 1;
  const whenVi =
    f.timing === 'spin' ? 'Lúc quay' :
    f.timing === 'win' ? 'Giai đoạn tính tiền thắng' :
    'Sau khi hàng dừng';

  setImgSrc(img, f.img || '');
  img.alt = vi.nameVi || f.name;
  title.textContent = vi.nameVi || f.name;
  title.style.color = f.color || 'var(--cyan)';
  timing.textContent = `${whenVi} · thứ tự #${order}` + (f.name ? ` · ${f.name}` : '');

  // Tiếng Việt dễ hiểu
  if (desc) desc.textContent = vi.what || f.desc || '';
  if (how) {
    how.textContent = vi.how || '';
    how.style.display = vi.how ? 'block' : 'none';
  }
  if (vfx) vfx.textContent = vi.see || f.vfx || '';

  if (status) {
    if (replayable) {
      status.style.display = 'block';
      status.textContent = '● Có trên spin vừa rồi — bấm Replay để diễn lại VFX';
      status.style.color = f.color || 'var(--green)';
      status.style.background = 'rgba(0,255,136,.08)';
      status.style.border = '1px solid ' + (f.color || 'var(--green)');
    } else if (active) {
      status.style.display = 'block';
      status.textContent = '● ĐANG BẬT trên spin này / Free Spins';
      status.style.color = f.color || 'var(--green)';
      status.style.background = 'rgba(0,255,136,.08)';
      status.style.border = '1px solid ' + (f.color || 'var(--green)');
    } else {
      status.style.display = 'none';
      status.textContent = '';
    }
  }
  openModal('modalFeatureDetail');
}

function renderFeatureMeter(activeIds = []) {
  const meter = document.getElementById('featureMeter');
  if (!meter) return;
  const ids = Array.isArray(activeIds) ? activeIds.filter(Boolean) : [];
  meter.innerHTML = '';
  // has-active → CSS dim các badge không trúng, phóng to badge trúng
  meter.classList.toggle('has-active', ids.length > 0);
  meterItems().forEach(f => {
    const badge = document.createElement('span');
    const on = ids.includes(f.id);
    badge.className = 'feat-badge'
      + (f.id === CORE_HACK.id ? ' core-hack' : '')
      + (on ? ' active' : '');
    const viName = (FEATURE_EXPLAIN_VI[f.id] && FEATURE_EXPLAIN_VI[f.id].nameVi) || f.name;
    const replayable = canReplayFeature(f.id);
    if (replayable) badge.classList.add('replayable');
    badge.title = replayable
      ? viName + ' — bấm để replay feature này (Shift+bấm xem giải thích)'
      : viName + ' — bấm để xem giải thích' + (on ? ' (đang bật)' : '');
    badge.style.color = f.color;
    badge.dataset.featureId = f.id;
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.setAttribute('aria-label', replayable ? ('Replay ' + viName) : ('Chi tiết ' + viName));
    if (on) badge.setAttribute('aria-current', 'true');
    if (f.img) {
      const img = document.createElement('img');
      setImgSrc(img, f.img);
      img.alt = viName;
      img.draggable = false;
      badge.appendChild(img);
    }
    const open = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (canReplayFeature(f.id) && !e.shiftKey && !e.altKey) {
        replayLastFeature(f.id);
        return;
      }
      showFeatureDetail(f.id);
    };
    badge.addEventListener('click', open);
    badge.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') open(e);
    });
    meter.appendChild(badge);
  });
}

function syncPerfMode() {
  const busy = !!(state.spinning || state.fxPlaying);
  document.body.classList.toggle('spin-busy', busy);
}

function updateUI() {
  const beforeEl = document.getElementById('balanceBeforeDisplay');
  if (beforeEl) beforeEl.textContent = fmtBalance(state.balanceBefore);
  document.getElementById('balanceDisplay').textContent = fmtBalance(state.balance);
  document.getElementById('betAmount').textContent = fmt(state.bet);
  document.getElementById('headerWin').textContent = state.lastWin.toFixed(2);
  const mult = Math.max(1, state.globalMultiplier || 1);
  document.getElementById('multDisplay').textContent = String(mult).padStart(2, '0');
  syncPerfMode();
}

/** Chụp số dư sau trừ bet/phí, trước khi credit win (spin đang chờ kết quả). */
function captureBalanceBefore() {
  state.balanceBefore = Number(state.balance) || 0;
}

function setInfoBar(mode, text) {
  const bar = document.getElementById('infoBar');
  if (mode === 'win') {
    bar.className = 'info-bar win-result';
    bar.innerHTML = text;
  } else {
    bar.className = 'info-bar';
    bar.innerHTML = `<div class="marquee" id="infoMarquee">${text}</div>`;
  }
}

function showSymTooltip(sym, el) {
  if (state.spinning) return;
  const s = SYMBOLS[sym];
  if (!s) return;
  const tip = document.getElementById('symTooltip');
  // GDD paytable = multipliers of totalBet (not cash). Show raw Cx like 0.75 / 1.00 / 1.50.
  const pays = s.pays.slice(2).map((p, i) => `${i + 3}: ${Number(p).toFixed(2)}x`).join(' | ');
  tip.innerHTML = `<div style="display:flex;align-items:center;gap:8px">${imgTag(s.img, 'style="width:40px;height:40px;object-fit:contain" alt=""')}<strong>${s.name}</strong></div><br>${pays || 'Special symbol'}`;
  const rect = el.getBoundingClientRect();
  tip.style.left = Math.min(rect.right + 8, window.innerWidth - 200) + 'px';
  tip.style.top = rect.top + 'px';
  tip.style.display = 'block';
  setTimeout(() => tip.style.display = 'none', 3000);
}

// ─── Win effects ─────────────────────────────────────────────
function shakeScreen() {
  document.body.classList.remove('shake');
  void document.body.offsetWidth;
  document.body.classList.add('shake');
  setTimeout(() => document.body.classList.remove('shake'), 500);
}

/**
 * Ticker cộng tiền 0→total (header WIN + optional overlay amount).
 * Nhanh: ~0.25–0.45s (turbo ~0.12–0.2s) — ease-out để cảm giác “đếm xong dứt”.
 */
async function runMoneyTicker(from, to, {
  onTick,
  durationMs,
} = {}) {
  const start = Number(from) || 0;
  const end = Number(to) || 0;
  if (!Number.isFinite(end) || end === start) {
    onTick?.(end, 1);
    return end;
  }
  const dur = durationMs != null
    ? durationMs
    : (state.fastSpin
        ? (Math.abs(end - start) >= 50 * state.bet ? 200 : 120)
        : (Math.abs(end - start) >= 50 * state.bet ? 420 : 280));
  const t0 = performance.now();
  await new Promise(resolve => {
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / Math.max(1, dur));
      // ease-out cubic — tăng nhanh đầu, chạm đích gọn
      const e = 1 - Math.pow(1 - t, 3);
      const val = start + (end - start) * e;
      onTick?.(val, t);
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  onTick?.(end, 1);
  return end;
}

/**
 * Win celebration overlay — mọi spin win > 0.
 * animation-sequence.png (6×6) + chữ WIN + số tiền $0.00 → total (đếm nhanh, lấp lánh).
 * Big/Mega/Legendary: giữ class màu (GDD threshold), label luôn "WIN".
 * Vị trí: neo đúng giữa khung symbol grid (#reelsWrapper), không căn viewport.
 */
const WIN_SEQ = {
  cols: 6,
  rows: 6,
  frames: 36,
  fps: 14,
  file: 'animation-sequence.webp',
};

/** Pin .win-fx-stage lên bounding box reels (grid symbol). */
function positionWinFxToReels() {
  const stage = document.querySelector('#winOverlay .win-fx-stage');
  const target =
    document.getElementById('reelsWrapper') ||
    document.getElementById('reelsGrid');
  if (!stage || !target) return;
  const r = target.getBoundingClientRect();
  if (!r.width || !r.height) return;
  stage.style.left = `${r.left}px`;
  stage.style.top = `${r.top}px`;
  stage.style.width = `${r.width}px`;
  stage.style.height = `${r.height}px`;
  stage.style.transform = 'none';
  stage.style.maxWidth = 'none';
  stage.style.maxHeight = 'none';
}

function clearWinFxPosition() {
  const stage = document.querySelector('#winOverlay .win-fx-stage');
  if (!stage) return;
  stage.style.left = '';
  stage.style.top = '';
  stage.style.width = '';
  stage.style.height = '';
  stage.style.transform = '';
  stage.style.maxWidth = '';
  stage.style.maxHeight = '';
}

function setWinSeqFrame(el, frame) {
  if (!el) return;
  const f = ((frame % WIN_SEQ.frames) + WIN_SEQ.frames) % WIN_SEQ.frames;
  const c = f % WIN_SEQ.cols;
  const r = Math.floor(f / WIN_SEQ.cols) % WIN_SEQ.rows;
  const x = WIN_SEQ.cols <= 1 ? 0 : (c / (WIN_SEQ.cols - 1)) * 100;
  const y = WIN_SEQ.rows <= 1 ? 0 : (r / (WIN_SEQ.rows - 1)) * 100;
  el.style.backgroundPosition = `${x}% ${y}%`;
}

/** Play win sequence once (or until skip). Returns when sheet finishes. */
function playWinSequenceOnce(el, { fps, onFrame } = {}) {
  const rate = fps || (state.fastSpin ? 22 : WIN_SEQ.fps);
  const interval = 1000 / rate;
  return new Promise(resolve => {
    let frame = 0;
    let last = performance.now();
    setWinSeqFrame(el, 0);
    onFrame?.(0);
    const tick = (now) => {
      if (isVfxSkip && isVfxSkip()) {
        setWinSeqFrame(el, WIN_SEQ.frames - 1);
        resolve();
        return;
      }
      if (now - last >= interval) {
        const steps = Math.max(1, Math.floor((now - last) / interval));
        last += steps * interval;
        frame += steps;
        if (frame >= WIN_SEQ.frames) {
          setWinSeqFrame(el, WIN_SEQ.frames - 1);
          onFrame?.(WIN_SEQ.frames - 1);
          resolve();
          return;
        }
        setWinSeqFrame(el, frame);
        onFrame?.(frame);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function playWinEffect(total) {
  const amount = Number(total) || 0;
  if (amount <= 0) return false;

  const threshold = (base) => base * (state.bet / REF_BET);
  const tierCls =
    amount >= threshold(100) ? 'win-legendary'
      : amount >= threshold(40) ? 'win-mega'
        : amount >= threshold(20) ? 'win-big'
          : '';

  if (tierCls === 'win-legendary' || tierCls === 'win-mega') {
    sfx('jackpot', { gain: 1.15, force: true });
  } else if (tierCls === 'win-big') {
    sfx('bigwin', { gain: 1.1, force: true });
  } else {
    sfx('win', { gain: 1.05, force: true });
  }

  const overlay = document.getElementById('winOverlay');
  const text = document.getElementById('winText');
  const amountEl = document.getElementById('winAmountFx');
  const seqEl = document.getElementById('winSeqSprite');
  if (!overlay || !text || !amountEl) return false;

  text.className = 'win-text' + (tierCls ? ' ' + tierCls : '');
  text.textContent = 'WIN';
  amountEl.className = 'win-amount-fx' + (tierCls ? ' ' + tierCls : '');
  amountEl.textContent = fmt(0);
  setWinSeqFrame(seqEl, 0);

  // Neo đúng khung symbol grid trước khi show
  positionWinFxToReels();
  overlay.classList.add('show');
  // layout pass — re-measure sau show (scroll/reflow)
  requestAnimationFrame(() => positionWinFxToReels());
  const onWinFxResize = () => positionWinFxToReels();
  window.addEventListener('resize', onWinFxResize);
  shakeScreen();

  // Header giữ total (đã ticker ở animateWinWays); overlay đếm lại 0 → total
  document.getElementById('headerWin').textContent = amount.toFixed(2);

  // Đếm tiền 0→total (hơi chậm hơn để dễ đọc; vẫn song song animation sequence)
  const tickDur = state.fastSpin ? 380 : 820;
  try {
    const animP = playWinSequenceOnce(seqEl, {
      fps: state.fastSpin ? 24 : WIN_SEQ.fps,
    });
    const moneyP = runMoneyTicker(0, amount, {
      durationMs: tickDur,
      onTick: (val) => {
        amountEl.textContent = fmt(val);
      },
    }).then(() => {
      amountEl.textContent = fmt(amount);
      amountEl.classList.add('sparkle-done');
    });

    await Promise.all([animP, moneyP]);

    // Giữ một nhịp ngắn sau khi đếm/anim xong
    await sleepRaw(state.fastSpin ? 140 : 320);
  } finally {
    window.removeEventListener('resize', onWinFxResize);
    overlay.classList.remove('show');
    clearWinFxPosition();
    text.textContent = 'WIN';
    text.className = 'win-text';
    amountEl.textContent = '';
    amountEl.className = 'win-amount-fx';
    setWinSeqFrame(seqEl, 0);
  }
  await sleepRaw(state.fastSpin ? 60 : 100);
  return true;
}

async function tickerWin(from, to) {
  await runMoneyTicker(from, to, {
    durationMs: state.fastSpin ? 140 : 320,
    onTick: (val) => {
      setInfoBar('win', `WIN ${fmt(val)}`);
      document.getElementById('headerWin').textContent = val.toFixed(2);
    },
  });
  setInfoBar('win', `WIN ${fmt(to)}`);
  document.getElementById('headerWin').textContent = Number(to).toFixed(2);
}

/** Lấy danh sách cell "c,r" cho một way win (ưu tiên positions từ server) */
function cellsForWin(w) {
  if (Array.isArray(w.positions) && w.positions.length) {
    return w.positions.map(p => {
      const c = Array.isArray(p) ? p[0] : p.c;
      const r = Array.isArray(p) ? p[1] : p.r;
      return `${c},${r}`;
    });
  }
  const cells = [];
  const reels = w.direction === 'rtl'
    ? [...Array(w.length).keys()].map(i => REELS - 1 - i)
    : [...Array(w.length).keys()];
  reels.forEach(c => {
    for (let r = 0; r < ROWS; r++) {
      if (state.grid[c][r] === w.sym || state.grid[c][r] === 'W') cells.push(`${c},${r}`);
    }
  });
  return cells;
}

// ─── Win explain (breakdown spin vừa rồi) ─────────────────────
let _wxZoom = 1;

function countsPerReelFromPositions(positions, length, direction) {
  const counts = Array(REELS).fill(0);
  if (!Array.isArray(positions)) return counts;
  for (const p of positions) {
    const c = Array.isArray(p) ? Number(p[0]) : Number(p.c);
    if (c >= 0 && c < REELS) counts[c] += 1;
  }
  // Chuỗi LTR: reel 0..length-1; RTL: (REELS-1) xuống
  const chain = [];
  for (let i = 0; i < length; i++) {
    const c = direction === 'rtl' ? (REELS - 1 - i) : i;
    chain.push(Math.max(1, counts[c] || 0));
  }
  return chain;
}

function waysProduct(chainCounts) {
  return (chainCounts || []).reduce((a, b) => a * Math.max(0, b), 1) || 0;
}

/**
 * Lưu frame IN SPIN/BUY gần nhất (cmd 1500 / 1501).
 * @param {any} frame full WS message (thường [5, { cmd, c, data }])
 * @param {object} [payload] game payload nếu đã bóc
 */
function captureLastInSpin(frame, payload) {
  let pl = payload;
  let cmd = '';
  if (!pl && Array.isArray(frame) && (frame[0] === 5 || frame[0] === '5') && frame[1] && typeof frame[1] === 'object') {
    pl = frame[1];
  }
  if (!pl && frame && typeof frame === 'object' && !Array.isArray(frame) && frame.data) {
    pl = frame;
  }
  if (!pl || typeof pl !== 'object') return false;
  cmd = String(pl.cmd ?? '');
  if (cmd !== '1500' && cmd !== '1501') return false;
  // Deep clone để panel không bị mutate sau này
  let frameCopy = null;
  let payloadCopy = null;
  try {
    frameCopy = JSON.parse(JSON.stringify(frame));
    payloadCopy = JSON.parse(JSON.stringify(pl));
  } catch (_) {
    payloadCopy = pl;
    frameCopy = frame;
  }
  state.lastInSpin = {
    t: Date.now(),
    cmd,
    frame: frameCopy,
    payload: payloadCopy,
    // BEFORE đã trừ bet (snapshot lúc bấm spin) — không có trong IN, gắn kèm FE
    balanceBefore: Number(state.balanceBefore) || 0,
  };
  // Build explain ngay từ IN
  buildWinExplainFromLastInSpin();
  return true;
}

/**
 * Tìm IN SPIN mới nhất trong WS traffic log (cmd 1500/1501).
 */
function findLatestInSpinFromTraffic() {
  const items = typeof wsTrafficState !== 'undefined' ? wsTrafficState.items : null;
  if (!Array.isArray(items) || !items.length) return null;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.dir !== 'in') continue;
    if (it.cmd !== '1500' && it.cmd !== '1501') continue;
    if (it.data != null) return it.data;
    // Fallback: parse text JSON
    if (typeof it.text === 'string') {
      try { return JSON.parse(it.text); } catch (_) { /* ignore */ }
    }
  }
  return null;
}

/**
 * Parse payload IN → breakdown win. Nguồn duy nhất cho online = stages[0].wins + totalWin.
 */
function buildWinExplainFromInPayload(payload, meta = {}) {
  if (!payload || typeof payload !== 'object') return null;
  const parsed = parseOnlineRound(payload);
  const round = parsed.round || payload?.data?.round || {};
  const stage = parsed.stage || {};
  const bet = parseFloat(round.totalBet ?? payload?.data?.round?.totalBet ?? state.bet) || 0;
  const totalWin = Number(parsed.totalWin) || 0;
  const balAfter = parseFloat(
    parsed.control?.balance ??
      payload?.data?.control?.balance ??
      state.balance
  );
  const rawWins = Array.isArray(stage.wins) ? stage.wins : [];
  // Ưu tiên raw server wins (symbol id, occurs, positions, win string)
  const winsIn = rawWins.length
    ? rawWins.map(w => ({
        sym: SYM_MAP[w.symbol] || String(w.symbol),
        symbolId: w.symbol,
        length: Number(w.occurs) || 3,
        win: parseFloat(w.win) || 0,
        direction: String(w.type || '').includes('rtl') ? 'rtl' : 'ltr',
        type: w.type || 'way',
        positions: Array.isArray(w.positions) ? w.positions : null,
        payline: w.payline,
      }))
    : (parsed.wins || []);

  const screen = parsed.screen;
  let gridSnap = null;
  if (Array.isArray(screen) && screen.length === REELS) {
    gridSnap = screen.map(col => (Array.isArray(col) ? col.map(id => SYM_MAP[id] || id) : []));
  }

  const featuresObj = parsed.result?.features || payload?.data?.round?.result?.features || {};
  const featureNames = []
    .concat(featuresObj.spinFeatures || [])
    .concat((parsed.featObjs || []).map(f => f.name || f.id));
  // unique
  const featUnique = [...new Set(featureNames.filter(Boolean))];

  // Bandwidth: nếu có trong featureSteps
  let bandwidthMult = 1;
  const steps = parsed.featureSteps || [];
  for (const st of steps) {
    const n = String(st?.name || '');
    if (/bandwidth/i.test(n) && st.multiplier != null) {
      bandwidthMult = Math.max(bandwidthMult, Number(st.multiplier) || 1);
    }
  }
  if (state.globalMultiplier > 1) {
    bandwidthMult = Math.max(bandwidthMult, state.globalMultiplier);
  }

  const lines = winsIn.map((w, idx) => {
    const sym = w.sym || SYM_MAP[w.symbolId] || 'A';
    const length = Number(w.length) || 3;
    const dir = w.direction === 'rtl' ? 'rtl' : 'ltr';
    const payMult = getSymbolPayMult(sym, length);
    const chainCounts = countsPerReelFromPositions(w.positions, length, dir);
    const ways = waysProduct(chainCounts);
    const rawServerWin = Number(w.win) || 0;
    const baseLine = ways * payMult * bet;
    const positions = Array.isArray(w.positions)
      ? w.positions.map(p => (Array.isArray(p) ? [Number(p[0]), Number(p[1])] : [p.c, p.r]))
      : [];

    return {
      idx: idx + 1,
      sym,
      symbolId: w.symbolId != null ? w.symbolId : null,
      name: SYMBOLS[sym]?.name || sym,
      img: SYMBOLS[sym]?.img || '',
      length,
      direction: dir,
      type: w.type || 'way',
      chainCounts,
      ways,
      payMult,
      bet,
      cellMult: 1,
      baseLine,
      win: rawServerWin,
      positions,
      payline: w.payline,
      raw: w,
    };
  });

  const sumLines = lines.reduce((s, L) => s + (L.win || 0), 0);
  const jp = parsed.progressiveJackpot || null;
  const jpWin = jp && (jp.isTriggered === true || jp.isTriggered === 'true' || jp.tier)
    ? (parseFloat(jp.win) || 0)
    : 0;

  // Stage totalWin string from IN
  const stageTotalWin = parseFloat(stage.totalWin) || totalWin;

  return {
    at: meta.t || Date.now(),
    source: meta.source || `IN ${meta.cmd || payload.cmd || 'SPIN'}`,
    cmd: String(meta.cmd || payload.cmd || ''),
    bet,
    totalWin,
    stageTotalWin,
    balanceBefore: Number(meta.balanceBefore ?? state.balanceBefore) || 0,
    balanceAfter: Number.isFinite(balAfter) ? balAfter : Number(state.balance) || 0,
    thisMode: parsed.thisMode || 'base',
    nextMode: parsed.nextMode || '',
    globalMult: bandwidthMult,
    featureNames: featUnique,
    maxWinReached: !!parsed.maxWinReached,
    spinId: parsed.spinId || '',
    roundId: parsed.roundId || '',
    gridSnap,
    lines,
    sumLines,
    jpWin,
    jpTier: jp?.tier || jp?.tierName || '',
    note: meta.note || '',
    // Giữ raw để panel trích đoạn JSON
    rawWins,
    rawTotalWin: round.totalWin ?? stage.totalWin,
    rawTotalBet: round.totalBet,
    rawScreen: screen,
    rawFeatures: {
      spinFeatures: featuresObj.spinFeatures || null,
      activeFeatures: featuresObj.activeFeatures || null,
      maxWinReached: featuresObj.maxWinReached || false,
      progressiveJackpot: jp,
    },
  };
}

/** Build/update state.lastSpinExplain từ state.lastInSpin (IN SPIN gần nhất). */
function buildWinExplainFromLastInSpin() {
  // Fallback: lấy từ traffic nếu capture lúc message miss
  if (!state.lastInSpin?.payload) {
    const fromTraffic = findLatestInSpinFromTraffic();
    if (fromTraffic) {
      captureLastInSpin(fromTraffic);
    }
  }
  const rec = state.lastInSpin;
  if (!rec?.payload) {
    state.lastSpinExplain = null;
    return null;
  }
  const ex = buildWinExplainFromInPayload(rec.payload, {
    t: rec.t,
    cmd: rec.cmd,
    source: `IN SPIN cmd ${rec.cmd}`,
    balanceBefore: rec.balanceBefore,
  });
  state.lastSpinExplain = ex;
  const btn = document.getElementById('btnWinExplain');
  if (btn) btn.style.opacity = ex && ex.totalWin > 0 ? '1' : '0.55';
  return ex;
}

/**
 * Fallback local (offline demo) — chỉ khi không có IN SPIN.
 * @param {object} opts
 */
function recordSpinWinExplainLocal(opts = {}) {
  if (state.lastInSpin?.payload) {
    // Online đã có IN — không ghi đè bằng local estimate
    return buildWinExplainFromLastInSpin();
  }
  const bet = Number(opts.bet ?? state.bet) || 0;
  const totalWin = Number(opts.totalWin ?? state.lastWin) || 0;
  const winsIn = Array.isArray(opts.wins) ? opts.wins : [];
  const screen = opts.screen || null;
  let gridSnap = null;
  if (Array.isArray(screen) && screen.length === REELS) {
    gridSnap = screen.map(col => (Array.isArray(col) ? col.map(id => SYM_MAP[id] || id) : []));
  } else if (state.grid?.length) {
    gridSnap = state.grid.map(col => col.map(s => s));
  }
  const lines = winsIn.map((w, idx) => {
    const sym = w.sym || 'A';
    const length = Number(w.length) || 3;
    const dir = w.direction === 'rtl' ? 'rtl' : 'ltr';
    const payMult = getSymbolPayMult(sym, length);
    let chainCounts = Array.isArray(w.reelPositions) && w.reelPositions.length
      ? w.reelPositions.map(Number)
      : countsPerReelFromPositions(w.positions, length, dir);
    let ways = Number(w.winCount);
    if (!Number.isFinite(ways) || ways <= 0) ways = waysProduct(chainCounts);
    const rawServerWin = Number(w.win) || 0;
    const baseLine = ways * payMult * bet;
    const positions = Array.isArray(w.positions)
      ? w.positions.map(p => (Array.isArray(p) ? [p[0], p[1]] : [p.c, p.r]))
      : cellsForWin(w).map(k => k.split(',').map(Number));
    return {
      idx: idx + 1, sym, name: SYMBOLS[sym]?.name || sym, img: SYMBOLS[sym]?.img || '',
      length, direction: dir, chainCounts, ways, payMult, bet, cellMult: 1,
      baseLine, win: rawServerWin, positions,
    };
  });
  state.lastSpinExplain = {
    at: Date.now(),
    source: 'local (no IN SPIN)',
    cmd: '',
    bet,
    totalWin,
    stageTotalWin: totalWin,
    balanceBefore: Number(opts.balanceBefore ?? state.balanceBefore) || 0,
    balanceAfter: Number(opts.balanceAfter ?? state.balance) || 0,
    thisMode: opts.thisMode || 'base',
    globalMult: Math.max(1, Number(opts.globalMultiplier) || 1),
    featureNames: opts.featureNames || [],
    maxWinReached: !!opts.maxWinReached,
    spinId: '',
    roundId: '',
    gridSnap,
    lines,
    sumLines: lines.reduce((s, L) => s + L.win, 0),
    jpWin: 0,
    jpTier: '',
    note: 'Offline/demo — không có frame IN',
    rawWins: [],
    rawTotalWin: totalWin,
    rawTotalBet: bet,
  };
  return state.lastSpinExplain;
}

function setWinExplainZoom(z) {
  _wxZoom = Math.min(1.8, Math.max(0.7, z));
  const stage = document.getElementById('wxZoomStage');
  const lab = document.getElementById('wxZoomLabel');
  if (stage) stage.style.transform = `scale(${_wxZoom})`;
  if (lab) lab.textContent = `${Math.round(_wxZoom * 100)}%`;
}

function renderWinExplainBody() {
  const body = document.getElementById('winExplainBody');
  if (!body) return;
  // Luôn rebuild từ IN SPIN gần nhất trước khi vẽ
  buildWinExplainFromLastInSpin();
  const ex = state.lastSpinExplain;
  if (!ex) {
    body.className = 'wx-empty';
    body.innerHTML = 'Chưa có <strong>IN SPIN</strong> (cmd 1500/1501).<br>Connect &amp; spin — panel này đọc thắng từ frame nhận về, không tự tính local.';
    return;
  }
  body.className = '';

  const modeLabel = ex.thisMode === 'free' ? 'Free Spin' : 'Base';
  const srcBadge = String(ex.source || '').startsWith('IN')
    ? `<span style="color:#00ff88">● ${ex.source}</span>`
    : `<span style="color:#ff8800">○ ${ex.source}</span>`;
  const cards = `
    <div class="wx-summary">
      <div class="wx-card"><span class="k">NGUỒN</span><span class="v" style="font-size:.75rem">${srcBadge}</span></div>
      <div class="wx-card"><span class="k">BET (IN totalBet)</span><span class="v">${fmtBalance(ex.bet)}</span></div>
      <div class="wx-card"><span class="k">TOTAL WIN (IN)</span><span class="v green">${fmtBalance(ex.totalWin)}</span></div>
      <div class="wx-card"><span class="k">BALANCE BEFORE</span><span class="v">${fmtBalance(ex.balanceBefore)}</span></div>
      <div class="wx-card"><span class="k">BALANCE AFTER (IN)</span><span class="v">${fmtBalance(ex.balanceAfter)}</span></div>
      <div class="wx-card"><span class="k">MODE</span><span class="v">${modeLabel}</span></div>
      <div class="wx-card"><span class="k">stages[0].wins</span><span class="v">${ex.lines.length}</span></div>
    </div>`;

  let formulaTop = `Nguồn: ${ex.source}\n`;
  formulaTop += `round.totalBet (IN) = ${ex.rawTotalBet ?? ex.bet}\n`;
  formulaTop += `round.totalWin (IN) = ${ex.rawTotalWin ?? ex.totalWin}\n`;
  formulaTop += `Σ stages[0].wins[].win = ${fmtBalance(ex.sumLines)}\n`;
  formulaTop += `stages[0].totalWin = ${fmtBalance(ex.stageTotalWin ?? ex.totalWin)}`;
  if (ex.globalMult > 1) {
    formulaTop += `\nBandwidth / mult (từ featureSteps hoặc UI) ×${ex.globalMult} — win IN thường đã nhân sẵn`;
  }
  if (ex.jpWin > 0) {
    formulaTop += `\n+ progressiveJackpot.win = ${fmtBalance(ex.jpWin)} (tier ${ex.jpTier || '?'})`;
  }
  if (ex.maxWinReached) formulaTop += `\n⚠ features.maxWinReached = true`;

  // Mini grid 5×3 (row-major visual: row r, col c)
  let mini = '';
  if (ex.gridSnap) {
    const hit = new Set();
    const hitRtl = new Set();
    for (const L of ex.lines) {
      for (const [c, r] of L.positions || []) {
        (L.direction === 'rtl' ? hitRtl : hit).add(`${c},${r}`);
      }
    }
    mini = `<div class="wx-section-title">LƯỚI PAYOUT (cột →)</div><div class="wx-mini-grid">`;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < REELS; c++) {
        const key = `${c},${r}`;
        const sym = ex.gridSnap[c]?.[r] || '';
        const img = SYMBOLS[sym]?.img || '';
        const cls = hitRtl.has(key) ? 'wx-mini-cell hit-rtl' : (hit.has(key) ? 'wx-mini-cell hit' : 'wx-mini-cell');
        mini += `<div class="${cls}" title="col ${c}, row ${r}: ${sym}">${
          img ? imgTag(img, `alt="${sym}"`) : `<span style="font-size:.65rem;color:#666">${sym || '·'}</span>`
        }</div>`;
      }
    }
    mini += `</div>
      <div class="wx-note">Viền xanh = ô tham gia way LTR · viền cyan = RTL (Bypass). Mỗi ô đếm 1 lần trên reel → nhân ways.</div>`;
  }

  let feats = '';
  if (ex.featureNames?.length) {
    feats = `<div class="wx-section-title">MINI-FEATURES SPIN NÀY</div>
      <div style="font-size:.8rem;color:#bcd;margin-bottom:8px">${ex.featureNames.map(n => `• ${n}`).join('<br>')}</div>`;
  }

  let linesHtml = `<div class="wx-section-title">TỪNG WAY — stages[0].wins (từ IN)</div>`;
  if (!ex.lines.length) {
    linesHtml += `<div class="wx-empty" style="padding:12px">IN không có stages[0].wins (totalWin có thể từ jackpot / không trúng ways).</div>`;
  } else {
    linesHtml += ex.lines.map(L => {
      const dirLabel = L.direction === 'rtl' ? 'RTL' : 'LTR';
      const dirCls = L.direction === 'rtl' ? 'dir-rtl' : 'dir-ltr';
      const sid = L.symbolId != null ? L.symbolId : '—';
      const p3 = getSymbolPayMult(L.sym, 3);
      const p4 = getSymbolPayMult(L.sym, 4);
      const p5 = getSymbolPayMult(L.sym, 5);
      const matched = Math.abs(L.baseLine - L.win) <= 0.02 * Math.max(1, L.bet);
      const chain = L.chainCounts || [];
      const reelChips = chain.map((n, i) => {
        const reel = L.direction === 'rtl' ? (REELS - 1 - i) : i;
        return `<div class="wx-reel-chip"><span class="rk">Reel ${reel}</span><span class="rv">${n}</span></div>`;
      }).join('<span class="wx-op">×</span>');
      const posChips = (L.positions || []).map(([c, r]) =>
        `<span class="wx-pos">[${c},${r}]</span>`
      ).join('');
      return `<div class="wx-way">
        <div class="wx-way-head">
          ${L.img ? imgTag(L.img, 'alt=""') : ''}
          <div class="wx-way-title">
            <strong>#${L.idx} · ${L.name}</strong>
            <span class="sub">Symbol ${L.sym} · id ${sid} · type ${L.type || 'way'}</span>
          </div>
          <span class="wx-pill ${dirCls}">${dirLabel}</span>
          <span class="wx-pill oak">${L.length}-of-a-kind</span>
          <span class="wx-way-amount">${fmtBalance(L.win)}</span>
        </div>
        <div class="wx-way-body">
          <div class="wx-steps">
            <div class="wx-step">
              <div class="wx-step-num">1</div>
              <div class="wx-step-body">
                <div class="wx-step-label">Ô thắng (IN positions)</div>
                <div class="wx-step-text">Tọa độ <code>[cột, hàng]</code> server gửi:</div>
                <div class="wx-pos-list">${posChips || '<span class="wx-note">—</span>'}</div>
              </div>
            </div>
            <div class="wx-step">
              <div class="wx-step-num">2</div>
              <div class="wx-step-body">
                <div class="wx-step-label">Đếm ô mỗi reel → số ways</div>
                <div class="wx-step-text">Mỗi reel nhân số ô khớp symbol / wild:</div>
                <div class="wx-reel-row">
                  ${reelChips}
                  <span class="wx-op">=</span>
                  <span class="wx-ways-result">${L.ways} ways</span>
                </div>
              </div>
            </div>
            <div class="wx-step">
              <div class="wx-step-num">3</div>
              <div class="wx-step-body">
                <div class="wx-step-label">Paytable symbol ${L.sym} (${L.name})</div>
                <div class="wx-pay-row">
                  <span class="wx-pay-chip${L.length === 3 ? ' active' : ''}">3-oak ×${p3}</span>
                  <span class="wx-pay-chip${L.length === 4 ? ' active' : ''}">4-oak ×${p4}</span>
                  <span class="wx-pay-chip${L.length === 5 ? ' active' : ''}">5-oak ×${p5}</span>
                </div>
                <div class="wx-step-text" style="margin-top:6px">Đang dùng: <strong style="color:#ffc850">${L.length}-oak = ${L.payMult}× totalBet</strong></div>
              </div>
            </div>
            <div class="wx-step">
              <div class="wx-step-num">4</div>
              <div class="wx-step-body">
                <div class="wx-step-label">Công thức tiền</div>
                <div class="wx-eq">
                  <span class="dim">ways × pay × totalBet</span><br>
                  = <span class="hl">${L.ways}</span> × <span class="hl">${L.payMult}</span> × <span class="hl">${L.bet}</span><br>
                  = <span class="hl">${fmtBalance(L.baseLine)}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="wx-match ${matched ? 'ok' : 'bad'}">
            ${matched
              ? `✓ Khớp IN · wins[].win = ${fmtBalance(L.win)}`
              : `△ Chênh IN · tính ${fmtBalance(L.baseLine)} vs wins[].win ${fmtBalance(L.win)} (Δ ${fmtBalance(L.win - L.baseLine)}) — Bandwidth / mult / cap`}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  let rawJson = '';
  if (ex.rawWins && ex.rawWins.length) {
    try {
      rawJson = `<div class="wx-section-title">RAW stages[0].wins (IN)</div>
        <pre class="wx-formula" style="max-height:180px;overflow:auto;font-size:.68rem">${
          escapeHtmlWx(JSON.stringify(ex.rawWins, null, 2))
        }</pre>`;
    } catch (_) { /* ignore */ }
  }

  const meta = `<div class="wx-note">spinId: ${ex.spinId || '—'} · roundId: ${ex.roundId || '—'} · ${ex.source}
${state.lastInSpin?.t ? `· IN @ ${new Date(state.lastInSpin.t).toLocaleTimeString()}` : ''}</div>`;

  body.innerHTML = cards
    + `<div class="wx-formula">${formulaTop}</div>`
    + mini
    + feats
    + linesHtml
    + rawJson
    + meta
    + `<div class="wx-note">Giải thích bám <strong>IN SPIN</strong> (WS frame nhận). Công thức ways chỉ để hiểu <em>vì sao</em> server trả wins[].win — số tiền authoritative là field trong IN.</div>`;
}

function escapeHtmlWx(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function openWinExplain() {
  // Ưu tiên IN SPIN; nếu miss capture thì quét traffic
  if (!state.lastInSpin?.payload) {
    const frame = findLatestInSpinFromTraffic();
    if (frame) captureLastInSpin(frame);
  }
  buildWinExplainFromLastInSpin();
  renderWinExplainBody();
  setWinExplainZoom(_wxZoom || 1);
  openModal('modalWinExplain');
}

function highlightExplainOnMainGrid() {
  const ex = state.lastSpinExplain;
  if (!ex?.lines?.length) {
    showToast('Không có ô win để highlight', '#ff8800');
    return;
  }
  const all = [];
  for (const L of ex.lines) {
    for (const [c, r] of L.positions || []) {
      const k = `${c},${r}`;
      if (!all.includes(k)) all.push(k);
    }
  }
  closeModal('modalWinExplain');
  renderGrid(all);
  document.querySelectorAll('#reelsGrid .cell').forEach(el => {
    const k = `${el.dataset.reel},${el.dataset.row}`;
    el.classList.toggle('win', all.includes(k));
    el.classList.toggle('win-ltr', all.includes(k));
  });
  showToast(`Highlight ${all.length} ô thắng`, '#00ff88');
  setTimeout(() => {
    document.querySelectorAll('#reelsGrid .cell').forEach(el => {
      el.classList.remove('win', 'win-ltr', 'win-rtl');
    });
    renderGrid();
  }, 4500);
}

async function animateWinWays(wins, total) {
  const wrap = document.getElementById('reelsWrapper');
  wrap?.classList.add('dim-win');

  if (!wins.length) {
    await sleepRaw(state.fastSpin ? 200 : 400);
    wrap?.classList.remove('dim-win');
    return;
  }

  const markWinDir = (cells, dir) => {
    const cls = dir === 'rtl' ? 'win-rtl' : 'win-ltr';
    const set = new Set(cells);
    document.querySelectorAll('#reelsGrid .cell').forEach(el => {
      const k = `${el.dataset.reel},${el.dataset.row}`;
      el.classList.remove('win-rtl', 'win-ltr');
      if (set.has(k)) el.classList.add(cls, 'win');
    });
  };

  // Show all winning cells together first
  const allCells = [];
  for (const w of wins) {
    for (const key of cellsForWin(w)) {
      if (!allCells.includes(key)) allCells.push(key);
    }
  }
  renderGrid(allCells);
  markWinDir(allCells, 'ltr');
  // Âm thanh win mở đầu (scale theo mức thắng)
  {
    const ref = state.bet / REF_BET || 1;
    if (total >= 40 * ref) sfx('jackpot', { gain: 1.15, force: true });
    else if (total >= 20 * ref) sfx('bigwin', { gain: 1.1, force: true });
    else sfx('win', { gain: 1.0, force: true });
  }
  // Symbol có sprite trên lưới thắng → chạy nhanh
  if (useSpritePackAnim()) boostSpritePack(1600);
  if (state.bypassProtocol || wins.some(w => w.direction === 'rtl')) {
    showVfxBanner('Ways win — LTR + RTL', 'bypass');
  } else {
    showVfxBanner(`${wins.length} way(s) · ${fmt(total)}`, '');
  }
  // Bắt đầu từ 0 để ticker cộng tiền nhìn thấy
  document.getElementById('headerWin').textContent = '0.00';
  await sleepRaw(state.fastSpin ? 120 : 280);

  // LTR ways then RTL ways (Bypass semantic) — rút gọn, cộng dồn header WIN
  const ltr = wins.filter(w => w.direction !== 'rtl');
  const rtl = wins.filter(w => w.direction === 'rtl');
  const ordered = [...ltr, ...rtl];
  const showWays = ordered.slice(0, Math.min(5, ordered.length));
  const wayHold = state.fastSpin ? 160 : 320;
  let running = 0;
  for (const w of showWays) {
    const cells = cellsForWin(w);
    renderGrid(cells);
    markWinDir(cells, w.direction === 'rtl' ? 'rtl' : 'ltr');
    sfx('coin', { gain: 0.75, pitch: 0.95 + Math.min(0.25, running / Math.max(total, 1)), force: true });
    if (w.direction === 'rtl') {
      showVfxBanner(`RTL way · ${SYMBOLS[w.sym]?.name || w.sym} · ${fmt(w.win)}`, 'bypass');
    } else {
      showVfxBanner(`LTR way · ${SYMBOLS[w.sym]?.name || w.sym} · ${fmt(w.win)}`, '');
    }
    const mid = cells[Math.floor(cells.length / 2)];
    if (mid) {
      const [c, r] = mid.split(',').map(Number);
      const el = document.querySelector(`.cell[data-reel="${c}"][data-row="${r}"]`);
      if (el) {
        const float = document.createElement('div');
        float.className = 'win-float';
        float.textContent = fmt(w.win);
        el.appendChild(float);
      }
    }
    // Cộng dồn nhanh theo từng way (phần còn lại tickerWin bù về total)
    const next = running + (Number(w.win) || 0);
    await runMoneyTicker(running, next, {
      durationMs: state.fastSpin ? 80 : 140,
      onTick: (val) => {
        document.getElementById('headerWin').textContent = val.toFixed(2);
      },
    });
    running = next;
    await sleepRaw(wayHold);
  }

  renderGrid(allCells);
  markWinDir(allCells, 'ltr');
  hideVfxBanner();
  // Snap/ticker phần còn lại tới total (nếu chưa đủ ways hiển thị)
  if (running < total - 0.001) {
    await runMoneyTicker(running, total, {
      durationMs: state.fastSpin ? 100 : 200,
      onTick: (val) => {
        setInfoBar('win', `WIN ${fmt(val)}`);
        document.getElementById('headerWin').textContent = val.toFixed(2);
      },
    });
  } else {
    document.getElementById('headerWin').textContent = Number(total).toFixed(2);
    setInfoBar('win', `WIN ${fmt(total)}`);
  }
  await sleepRaw(state.fastSpin ? 80 : 160);
  wrap?.classList.remove('dim-win');
  document.querySelectorAll('.win-float').forEach(el => el.remove());
  document.querySelectorAll('#reelsGrid .cell').forEach(el => {
    el.classList.remove('win-rtl', 'win-ltr');
  });
}

function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5);
}

function buildSpinStripSymbols(strip, result3, count) {
  const pool = strip.filter(s => !state.blockedSymbols.includes(s));
  const use = pool.length ? pool : strip;
  // Results first, then filler — spin scrolls DOWN (y increases toward 0)
  const symbols = [result3[0], result3[1], result3[2]];
  for (let i = 3; i < count; i++) symbols.push(use[Math.floor(Math.random() * use.length)]);
  return symbols;
}

function createStripReel(reelIndex, symbols, cellH) {
  const reel = document.createElement('div');
  reel.className = 'reel spinning-reel';
  reel.id = `reel-${reelIndex}`;

  const mask = document.createElement('div');
  mask.className = 'reel-mask';

  const stripEl = document.createElement('div');
  stripEl.className = 'reel-strip';

  symbols.forEach(sym => {
    const cell = document.createElement('div');
    cell.className = 'strip-cell';
    cell.style.height = `${cellH}px`;
    if (SYMBOLS[sym]?.img) {
      cell.appendChild(createSymbolEl(sym));
    } else {
      cell.textContent = sym;
    }
    stripEl.appendChild(cell);
  });

  mask.appendChild(stripEl);
  reel.appendChild(mask);
  return { reel, stripEl, symbols };
}

async function animateReelSpin(strips, forcedResults = null) {
  const results = forcedResults || strips.map(s => spinReel(s, state.blockedSymbols));
  const grid = document.getElementById('reelsGrid');
  const wrap = document.getElementById('reelsWrapper');

  const gridRect = grid.getBoundingClientRect();
  let cellH = Math.max(48, (gridRect.height || wrap?.clientHeight || 270) / ROWS);

  unlockAudio();
  _lastSpinTickAt = 0;
  sfx('spinStart', { gain: 0.75, pitch: 0.95, force: true });
  sfx('whoosh', { gain: 0.5, pitch: 0.85, force: true });
  const speed = state.fastSpin ? 3000 : 2400;
  const baseSpin = state.fastSpin ? 0.32 : 0.62;
  const stagger = state.fastSpin ? 0.14 : 0.32;
  const decelDur = state.fastSpin ? 0.32 : 0.62;
  const teaseExtra = state.fastSpin ? 0.4 : 0.85;
  const maxSpinTime = baseSpin + (REELS - 1) * stagger + teaseExtra + decelDur;
  const STRIP_LEN = Math.ceil((speed * maxSpinTime) / cellH) + ROWS + 8;

  grid.innerHTML = '';
  const reelData = [];

  for (let c = 0; c < REELS; c++) {
    const symbols = buildSpinStripSymbols(strips[c], results[c], STRIP_LEN);
    const { reel, stripEl } = createStripReel(c, symbols, cellH);
    grid.appendChild(reel);
    // Results are at TOP of strip → finalY = 0
    // Start near bottom of strip → scroll DOWN (y increases toward 0)
    const startY = -((STRIP_LEN - ROWS) * cellH);
    reelData.push({
      reel,
      stripEl,
      cellH,
      startY,
      finalY: 0,
      y: startY,
      yAtDecel: startY,
      decelTarget: 0,
      captured: false,
      done: false,
      stopAt: baseSpin + c * stagger,
      decelEnd: baseSpin + c * stagger + decelDur,
      teased: false,
    });
    stripEl.style.transform = `translate3d(0, ${startY}px, 0)`;
  }

  await sleepRaw(20);
  for (let c = 0; c < REELS; c++) {
    const h = reelData[c].reel.getBoundingClientRect().height;
    if (h > 40) {
      const ch = h / ROWS;
      reelData[c].cellH = ch;
      reelData[c].startY = -((STRIP_LEN - ROWS) * ch);
      reelData[c].finalY = 0;
      reelData[c].decelTarget = 0;
      reelData[c].y = reelData[c].startY;
      reelData[c].stripEl.querySelectorAll('.strip-cell').forEach(el => {
        el.style.height = `${ch}px`;
      });
      reelData[c].stripEl.style.transform = `translate3d(0, ${reelData[c].startY}px, 0)`;
    }
  }

  let teaseActive = false;

  await new Promise(resolve => {
    const t0 = performance.now();
    let last = t0;

    const tick = (now) => {
      const elapsed = (now - t0) / 1000;
      const dt = Math.min(0.048, (now - last) / 1000);
      last = now;
      let anySpinning = false;

      if (!teaseActive && reelData[1]?.done) {
        let s01 = 0;
        for (let pc = 0; pc < 2; pc++)
          for (let r = 0; r < ROWS; r++) if (results[pc][r] === 'S') s01++;
        if (s01 >= 2) {
          teaseActive = true;
          wrap?.classList.add('tease-dim');
          sfx('charge', { gain: 0.45, pitch: 1.15, force: true });
          for (let c = 2; c < REELS; c++) {
            if (!reelData[c].done && !reelData[c].captured) {
              reelData[c].stopAt += teaseExtra;
              reelData[c].decelEnd += teaseExtra;
              reelData[c].reel.classList.add('tease');
              reelData[c].teased = true;
            }
          }
        }
      }

      for (let c = 0; c < REELS; c++) {
        const r = reelData[c];
        if (r.done) continue;

        if (elapsed < r.stopAt) {
          anySpinning = true;
          const spd = speed * (r.teased ? 0.5 : 1);
          // Scroll DOWN: strip moves down (y increases toward 0)
          r.y += spd * dt;
          // Keep headroom before landing on results (y=0)
          const limit = r.finalY - r.cellH * 3;
          if (r.y > limit) r.y = limit;
          r.reel.classList.add('spinning-reel');
          r.reel.classList.remove('stopping');
        } else {
          if (!r.captured) {
            r.captured = true;
            const minTravel = r.cellH * (state.fastSpin ? 2 : 3.5);
            r.yAtDecel = r.y;
            r.decelTarget = r.finalY; // 0
            if (r.decelTarget - r.yAtDecel < minTravel) {
              r.yAtDecel = r.decelTarget - minTravel;
              r.y = r.yAtDecel;
            }
            r.reel.classList.remove('spinning-reel');
            r.reel.classList.add('stopping');
          }

          const dur = Math.max(0.08, r.decelEnd - r.stopAt);
          const t = Math.min(1, (elapsed - r.stopAt) / dur);
          const e = easeOutQuint(t);
          r.y = r.yAtDecel + (r.decelTarget - r.yAtDecel) * e;
          if (t < 1) anySpinning = true;

          if (t >= 1) {
            r.y = r.finalY;
            r.done = true;
            r.reel.classList.remove('stopping', 'spinning-reel', 'tease');
            r.reel.style.setProperty('--land-y', `${r.finalY}px`);
            r.stripEl.style.transform = `translate3d(0, ${r.finalY}px, 0)`;
            r.reel.classList.add('landing');
            sfxReelLand(c);
            setTimeout(() => r.reel.classList.remove('landing'), 340);
            continue;
          }
        }

        r.stripEl.style.transform = `translate3d(0, ${r.y}px, 0)`;
      }

      if (anySpinning) sfxSpinTick(now - t0, !!state.fastSpin);

      if (reelData.every(x => x.done)) {
        wrap?.classList.remove('tease-dim');
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });

  await sleepRaw(state.fastSpin ? 70 : 140);

  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) state.grid[c][r] = results[c][r];
  }
  wrap?.classList.remove('tease-dim');
  renderGrid();
}

// ─── Jackpot ─────────────────────────────────────────────────
function jackpotEmoji(tierName) {
  return JACKPOT_TIERS.find(t => t.name === tierName)?.emoji || '◆';
}

function jackpotTierSvg(tierName) {
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
function constrainJackpotNodes(rawTiers, winTier) {
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

function revealJackpotNode(node, tierName, idx) {
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
async function playJackpot(serverJp = null) {
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

// ─── Free Spins ──────────────────────────────────────────────
function getFSFeatures(scatterCount) {
  const n = scatterCount >= 5 ? 3 : scatterCount >= 4 ? 2 : 1;
  return selectRandomFeatures(n);
}

// ─── Auto-spin control ───────────────────────────────────────
function updateAutoUI() {
  const btn = document.getElementById('btnAuto');
  if (!btn) return;
  const n = state.autoSpins || 0;
  btn.classList.toggle('active', n > 0);
  btn.title = n > 0 ? `Autospin: ${n} left — click to stop` : 'Autospin';
  // Optional badge text via aria
  btn.dataset.remaining = String(n);
}

function stopAutoSpin(reason) {
  if ((state.autoSpins || 0) <= 0) return;
  state.autoSpins = 0;
  updateAutoUI();
  if (reason) showToast(reason, '#ff8800');
}

function startAutoSpin(n) {
  const count = Math.max(0, Number(n) || 0);
  if (count <= 0) return;
  if (state.spinning || state.inFreeSpins) {
    showToast(state.inFreeSpins ? 'Wait for free spins to finish' : 'Wait for current spin', '#ff8800');
    return;
  }
  state.autoSpins = count;
  updateAutoUI();
  closeModal('modalAuto');
  showToast(`Autospin ×${count}`, '#00f0ff');
  doSpin();
}

/**
 * Sau mỗi spin: ưu tiên Free Spins, rồi Autospin.
 * CHỈ gọi sau khi settleAfterSpinPresentation() xong — đảm bảo UI diễn hết FX.
 * Lệnh spin kế (ws/offline) chỉ được gửi từ đây.
 */
async function continueAfterSpin() {
  // An toàn: nếu FX vẫn chạy thì chờ
  await waitFxIdle();
  if (state.spinning || state.fxPlaying) return;

  // Free spins: remain = số lượt còn lại cần quay
  if (state.inFreeSpins && state.fsRemaining > 0) {
    if (isEditFsGridOn()) {
      openFsGridEditor();
      return;
    }
    // Nhịp ngắn giữa 2 FS — FX đã settle xong
    await sleepRaw(state.fastSpin ? 180 : 400);
    if (state.inFreeSpins && state.fsRemaining > 0 && !state.spinning && !state.fxPlaying) {
      await doSpin();
    }
    return;
  }

  // Autospin (tạm dừng khi đang FS — chỉ resume sau khi FS kết thúc)
  if ((state.autoSpins || 0) > 0 && !state.inFreeSpins) {
    state.autoSpins--;
    updateAutoUI();
    if (state.autoSpins > 0) {
      await sleepRaw(state.fastSpin ? 180 : 400);
      if (state.autoSpins > 0 && !state.spinning && !state.fxPlaying && !state.inFreeSpins) {
        await doSpin();
      }
    } else {
      showToast('Autospin complete', '#00ff88');
    }
  }
}

async function triggerFreeSpins(scatterCount, opts = {}) {
  const features = opts.features || getFSFeatures(scatterCount);
  const remain = opts.remain ?? 7;
  const total = opts.total ?? remain;
  const sessionWin = opts.sessionWin ?? 0;

  state.inFreeSpins = true;
  state.fsRemaining = remain;
  state.fsTotal = total;
  state.fsActiveFeatures = features;
  state.persistentFeatures = [...features];
  state.fsSessionWin = sessionWin;
  state.fsBet = state.bet;

  document.getElementById('fsTriggerInfo').textContent =
    `${remain} Free Spins` +
    (features.length ? ` with ${features.length} feature(s): ${features.map(f => f.name).join(', ')}` : '') +
    (scatterCount ? ` • ${scatterCount} Scatters` : '');
  openModal('modalFS');

  return new Promise(resolve => {
    document.getElementById('startFS').onclick = () => {
      closeModal('modalFS');
      document.getElementById('fsBanner').classList.add('visible');
      updateFSBanner();
      renderFeatureMeter(features.map(f => f.id));
      resolve();
    };
  });
}

function updateFSBanner() {
  const el = document.getElementById('fsCount');
  if (el) el.textContent = Math.max(0, state.fsRemaining || 0);
  syncEditFsGridChip();
}

async function endFreeSpins() {
  state.inFreeSpins = false;
  state.fsRemaining = 0;
  state.persistentFeatures = [];
  state.fsActiveFeatures = [];
  closeFsGridEditor();
  document.getElementById('fsBanner').classList.remove('visible');
  renderFeatureMeter([]);
  document.getElementById('fsTotalWin').textContent = fmt(state.fsSessionWin || 0);
  openModal('modalFSSummary');
  return new Promise(resolve => {
    document.getElementById('closeFSSummary').onclick = () => {
      closeModal('modalFSSummary');
      setInfoBar('idle', 'Win up to 19,693× Bet &nbsp;•&nbsp; 3 Scatters trigger Deep Web Infiltration &nbsp;•&nbsp; Good luck, hacker');
      resolve();
    };
  });
}

// ─── Main Spin ───────────────────────────────────────────────
async function doSpin(forcedScatters = 0) {
  if (state.spinning || state.fxPlaying) return;
  if (!state.inFreeSpins) {
    const cost = state.bet + state.extraFee;
    if (state.balance < cost) {
      showToast('Insufficient balance!', '#ff3355');
      stopAutoSpin('Autospin stopped — insufficient balance');
      return;
    }
    state.balance -= cost;
    state.txnId = genTxnId();
  }
  // Snapshot sau trừ bet — BEFORE = số dư khi spin đang chờ kết quả win/lose
  captureBalanceBefore();

  state.spinning = true;
  syncPerfMode();
  state.lastWin = 0;
  state.blockedSymbols = [];
  state.globalMultiplier = 1;
  state.bypassProtocol = false;
  state.triggeredFeatures = [];
  createEmptyGrid();
  document.getElementById('multDisplay').textContent = '01';

  document.getElementById('btnSpin').disabled = true;
  setInfoBar('idle', 'Spinning...');
  updateUI();

  // Select features
  let features = maybeTriggerFeatures();
  if (state.inFreeSpins) {
    features = [...state.persistentFeatures];
    const newFeat = maybeTriggerFeatures().filter(f => !features.find(p => p.id === f.id));
    if (newFeat.length && Math.random() < 0.2) {
      features.push(newFeat[0]);
      state.persistentFeatures.push(newFeat[0]);
      state.fsRemaining++;
      state.fsTotal++;
      showToast(`+1 Free Spin! New feature: ${newFeat[0].name}`, '#aa44ff');
    }
    mergePendingLocalForceFeatures(features);
  }

  state.triggeredFeatures = features;
  const activeIds = features.map(f => f.id);
  renderFeatureMeter(activeIds);

  // Firewall block (during spin)
  if (features.find(f => f.id === 'firewall')) await applyFirewallBlock();

  // Spin animation (Nolimit-style cascade stop + tease)
  const strips = REEL_STRIPS.map(s => s);
  if (state.scatterBooster) {
    strips[1] = [...strips[1], ...Array(5).fill('S')];
  }
  await animateReelSpin(strips);
  applyPendingLocalForceGrid();

  // Force scatters for buy free spin (before feature transforms)
  if (forcedScatters > 0) {
    placeScatters(forcedScatters);
    renderGrid();
  }

  const landScreen = gridToServerScreen(state.grid);
  const offlineSteps = [];
  if (features.find(f => f.id === 'firewall')) {
    offlineSteps.push({
      name: 'FirewallBlock',
      bannedLows: (state.blockedSymbols || []).map(s => SYM_TO_ID[s]).filter(n => n != null),
      changes: [],
    });
  }

  // Post-stop features
  for (const feat of features) {
    if (feat.timing === 'post' || feat.timing === 'spin') {
      if (feat.timing === 'post' && FEATURE_HANDLERS[feat.id]) {
        const before = snapshotBoard();
        if (state.featureExplain) await playFeatureExplainBeat(feat.id, null);
        await FEATURE_HANDLERS[feat.id]();
        renderGrid();
        offlineSteps.push(diffBoardsToStep(feat, before, snapshotBoard()));
      }
    }
  }

  // Win-time features
  for (const feat of features) {
    if (feat.timing === 'win' && FEATURE_HANDLERS[feat.id]) {
      const before = snapshotBoard();
      if (state.featureExplain) await playFeatureExplainBeat(feat.id, null);
      FEATURE_HANDLERS[feat.id]();
      offlineSteps.push(diffBoardsToStep(feat, before, snapshotBoard()));
    }
  }

  captureLastFeatureReplay({
    featureSteps: offlineSteps,
    featObjs: features,
    baseScreen: landScreen,
    finalScreen: gridToServerScreen(state.grid),
    splitCounts: cellMetaToSplitCounts(state.cellMeta),
    cellMultipliers: cellMetaToMultMap(state.cellMeta),
    finalGlobalMult: state.globalMultiplier,
    finalBypass: state.bypassProtocol,
  });

  // Jackpot check (rare)
  let jackpotWin = 0;
  if (!state.inFreeSpins && Math.random() < 0.005) {
    renderGrid();
    jackpotWin = await playJackpot();
  } else {
    state.lastJackpotActive = false;
  }

  // Calculate wins
  const { total, wins, capped, cap } = calcTotalWin();
  const finalWin = total + jackpotWin;
  state.lastWin = finalWin;
  state.balance += finalWin;

  // Offline only — online dùng captureLastInSpin từ frame IN
  recordSpinWinExplainLocal({
    bet: state.bet,
    totalWin: finalWin,
    wins,
    balanceBefore: state.balanceBefore,
    balanceAfter: state.balance,
    thisMode: state.inFreeSpins ? 'free' : 'base',
    globalMultiplier: state.globalMultiplier,
    maxWinReached: capped,
    featureNames: (features || []).map(f => f.name || f.id),
  });

  if (state.inFreeSpins) {
    state.fsSessionWin += finalWin;
    state.fsRemaining--;
    updateFSBanner();
  }

  // Highlight wins + FX — giữ spinning=true suốt FX
  beginFx();
  try {
    if (finalWin > 0) {
      await animateWinWays(wins, finalWin);
      await playWinEffect(finalWin);
      await celebrateWinPro(finalWin);
    } else {
      renderGrid();
      if (!state.inFreeSpins) setInfoBar('idle', 'Win up to 19,693× Bet &nbsp;•&nbsp; 3 Scatters trigger Deep Web Infiltration &nbsp;•&nbsp; Good luck, hacker');
    }
  } finally {
    /* settle phía dưới sẽ endFx */
  }

  // Max win cap
  if (capped) {
    document.getElementById('maxWinMsg').textContent =
      `Maximum Win Cap reached. Only ${fmt(cap)} has been awarded for this spin.`;
    openModal('modalMaxWin');
    await new Promise(r => { document.getElementById('closeMaxWin').onclick = () => { closeModal('modalMaxWin'); r(); }; });
    if (state.inFreeSpins) { state.fsRemaining = 0; }
  }

  // Free spins trigger (base → FS)
  const scatters = countScatters();
  const wasInFS = state.inFreeSpins;
  if (!wasInFS && scatters >= 3) {
    // Trigger spin không trừ fsRemaining; remain = 7 lượt FS sắp tới
    await triggerFreeSpins(scatters, { sessionWin: finalWin });
  } else if (wasInFS && state.fsRemaining <= 0) {
    await endFreeSpins();
  }

  // History — type dựa trên wasInFS (trước khi enter FS trên spin trigger)
  const betUsed = wasInFS ? 0 : state.bet + state.extraFee;
  state.history.unshift({
    txnId: state.txnId,
    time: new Date().toLocaleString(),
    bet: betUsed || state.fsBet || state.bet,
    win: finalWin,
    profit: finalWin - betUsed,
    type: wasInFS ? 'Free Spin' : (jackpotWin ? 'Jackpot' : (scatters >= 3 ? 'FS Trigger' : 'Normal')),
    features: features.map(f => f.name),
    scatters,
  });
  if (state.history.length > 100) state.history.pop();

  // Đợi UI diễn HẾT hiệu ứng trước khi nhả spinning / gửi spin kế
  await settleAfterSpinPresentation({
    hadWin: finalWin > 0,
    hadFeatures: features.length > 0,
    totalWin: finalWin,
  });

  state.spinning = false;
  state.lastJackpotActive = false;
  document.getElementById('btnSpin').disabled = false;
  updateUI();
  updateAutoUI();
  renderLastSpinFeatureMeter();

  // FS continue / Autospin — chỉ sau settle
  await continueAfterSpin();
}

function countScattersInPartial(upToReel) {
  let n = 0;
  for (let c = 0; c <= upToReel; c++)
    for (let r = 0; r < ROWS; r++)
      if (state.grid[c][r] === 'S') n++;
  return n;
}

function placeScatters(n) {
  const positions = [];
  for (let c = 0; c < REELS && positions.length < n; c++) {
    const r = randInt(0, ROWS - 1);
    state.grid[c][r] = 'S';
    positions.push({ c, r });
  }
}

// ─── Buy Features ────────────────────────────────────────────
let selectedBuyFeature = null;
let selectedBuyFS = null;

function initBuyModals() {
  const featOpts = [
    { id: 'scatter', name: 'Scatter Booster', cost: 1.4, desc: 'Scatter rate ×1.6 on reel 2' },
    { id: 'buy3', name: 'Buy 3 Features', cost: 12, desc: 'Guarantee 3 random features per spin' },
    { id: 'buy12', name: 'Buy 12 Features', cost: 4500, desc: 'All 12 features every spin' },
  ];
  document.getElementById('buyFeatureOptions').innerHTML = featOpts.map(o => `
    <div class="option-row" data-id="${o.id}">
      <div><div class="option-name">${o.name}</div><div class="option-desc">${o.desc}</div></div>
      <div class="option-cost">${o.cost}× Bet</div>
    </div>`).join('');

  document.querySelectorAll('#buyFeatureOptions .option-row').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#buyFeatureOptions .option-row').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      selectedBuyFeature = el.dataset.id;
    });
  });

  // GDD §6 + be-zero-day BUY_FEATURE (cmd 1501) feature aliases
  const fsOpts = [
    { id: 'fs1', feature: 'FS1', name: 'Terminal Breach (FS1)', cost: 80, scatters: 3, desc: 'Feature spin → ≥3 Scatters → 7 FS + 1 sticky feature' },
    { id: 'fs2', feature: 'FS2', name: 'Server Hijack (FS2)', cost: 240, scatters: 4, desc: 'Feature spin → ≥4 Scatters → 7 FS + 2 sticky features' },
    { id: 'fs3', feature: 'FS3', name: 'Mainframe Meltdown (FS3)', cost: 500, scatters: 5, desc: 'Feature spin → ≥5 Scatters → 7 FS + 3 sticky features' },
    { id: 'fs4', feature: 'FS4', name: 'Lucky Draw (FS4)', cost: 212, scatters: 0, desc: 'Random FS1 / FS2 / FS3 outcome' },
  ];
  document.getElementById('buyFSOptions').innerHTML = fsOpts.map(o => `
    <div class="option-row" data-id="${o.id}" data-feature="${o.feature}" data-scatters="${o.scatters}" data-cost="${o.cost}">
      <div>
        <div class="option-name">${o.name}</div>
        <div class="option-desc">${o.desc}</div>
        <div class="option-desc" style="margin-top:2px;color:var(--cyan)">Cost: ${fmt(o.cost * state.bet)} (${o.cost}× bet)</div>
      </div>
      <div class="option-cost">${o.cost}×</div>
    </div>`).join('');

  document.querySelectorAll('#buyFSOptions .option-row').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#buyFSOptions .option-row').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      selectedBuyFS = el.dataset.id;
    });
  });
}

function fmtCx(n) {
  return Number(n || 0).toFixed(2);
}

/** id + name từ be-zero-day .../games/zero_day.json `symbols`. */
const PAYTABLE_ROWS = [
  { id: 1,  name: 'A',       key: 'A' },
  { id: 2,  name: 'B',       key: 'B' },
  { id: 3,  name: 'C',       key: 'C' },
  { id: 4,  name: 'D',       key: 'D' },
  { id: 5,  name: 'E',       key: 'E' },
  { id: 6,  name: 'F',       key: 'F' },
  { id: 7,  name: 'G',       key: 'G' },
  { id: 8,  name: 'H',       key: 'H' },
  { id: 9,  name: 'I',       key: 'I' },
  { id: 10, name: 'K',       key: 'K' },
  { id: 11, name: 'WILD',    key: 'W' },
  { id: 12, name: 'SCATTER', key: 'S' },
];

const PAYTABLE_SPECIAL = {
  W: 'Wild · substitutes',
  S: 'Scatter · 3+ FS',
};

function renderPaytable() {
  const ptGrid = document.getElementById('paytableGrid');
  if (ptGrid) {
    ptGrid.innerHTML = PAYTABLE_ROWS.map(row => {
      const sym = SYMBOLS[row.key];
      const note = PAYTABLE_SPECIAL[row.key];
      const pays = note || (sym?.pays || []).slice(2).map((p, i) => `${i + 3}×: ${fmtCx(p)}`).join(' | ');
      return `<div class="pay-sym">${symImgHtml(row.key)}<div class="name">#${row.id} ${row.name}</div><div class="pays">${pays}</div></div>`;
    }).join('');
  }

  const side = document.getElementById('sidePaytableBody');
  if (!side) return;
  side.innerHTML = PAYTABLE_ROWS.map(row => {
    const sym = SYMBOLS[row.key];
    const note = PAYTABLE_SPECIAL[row.key];
    const idCell = `<span class="side-pt-id"><span class="sid">${row.id}</span><span class="sname">${row.name}</span></span>`;
    if (note) {
      return `<div class="side-pt-row special" data-sym="${row.key}" data-id="${row.id}">
        <span class="side-pt-icon">${symImgHtml(row.key)}</span>
        ${idCell}
        <span class="side-pt-note">${note}</span>
      </div>`;
    }
    const [p3, p4, p5] = (sym?.pays || []).slice(2);
    return `<div class="side-pt-row" data-sym="${row.key}" data-id="${row.id}" data-type="${sym?.type || ''}">
      <span class="side-pt-icon">${symImgHtml(row.key)}</span>
      ${idCell}
      <span>${fmtCx(p3)}</span><span>${fmtCx(p4)}</span><span>${fmtCx(p5)}</span>
    </div>`;
  }).join('');
}

// ─── Init UI ─────────────────────────────────────────────────
function initUI() {
  // Restore art pack before first paint of symbols
  let savedPack = DEFAULT_SYMBOL_PACK;
  try {
    const raw = localStorage.getItem('zd_symbol_pack');
    if (raw && SYMBOL_PACKS[raw]) savedPack = raw;
  } catch (_) { /* ignore */ }
  applySymbolPack(savedPack, { persist: false, toast: false, rerender: false });

  createEmptyGrid();
  renderGrid();
  renderFeatureMeter();
  updateUI();
  renderPaytable();

  // Bet options
  const betOpts = document.getElementById('betOptions');
  ['low', 'med', 'high'].forEach(tier => {
    const label = document.createElement('div');
    label.style.cssText = 'font-size:.7rem;color:var(--dim);margin:10px 0 4px;letter-spacing:1px;text-transform:uppercase';
    label.textContent = tier;
    betOpts.appendChild(label);
    BET_LEVELS[tier].forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.cssText = 'margin:3px;width:calc(25% - 6px)';
      btn.textContent = fmt(b);
      btn.addEventListener('click', () => {
        state.bet = b;
        state.betIdx = ALL_BETS.indexOf(b);
        updateUI();
        closeModal('modalBet');
      });
      betOpts.appendChild(btn);
    });
  });

  // Auto options
  const autoOpts = document.getElementById('autoOptions');
  autoOpts.innerHTML = '';
  [10, 25, 50, 100, 250, 1000].forEach(n => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.cssText = 'margin:4px;width:calc(33% - 8px)';
    btn.textContent = n + ' spins';
    btn.addEventListener('click', () => startAutoSpin(n));
    autoOpts.appendChild(btn);
  });
  // Stop option trong modal
  const stopBtn = document.createElement('button');
  stopBtn.className = 'btn';
  stopBtn.style.cssText = 'margin:8px 4px 4px;width:calc(100% - 8px);border-color:var(--red);color:var(--red)';
  stopBtn.textContent = 'Stop Autospin';
  stopBtn.addEventListener('click', () => {
    stopAutoSpin('Autospin stopped');
    closeModal('modalAuto');
  });
  autoOpts.appendChild(stopBtn);

  initBuyModals();
  updateAutoUI();

  // Event listeners
  document.getElementById('btnSpin').addEventListener('click', () => {
    unlockAudio();
    if (state.autoSpins > 0) {
      stopAutoSpin('Autospin stopped');
      return;
    }
    if (state.spinning) return;
    if (isFsGridEditorOpen()) {
      applyFsGridAndSpin();
      return;
    }
    sfx('tick', { gain: 0.45 });
    doSpin();
  });
  document.getElementById('betDisplay').addEventListener('click', () => {
    if (state.spinning || state.inFreeSpins) return;
    openModal('modalBet');
  });
  document.getElementById('closeBet').addEventListener('click', () => closeModal('modalBet'));
  document.getElementById('btnWinExplain')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openWinExplain();
  });
  document.querySelector('.bottom-bar .win-block')?.addEventListener('click', () => openWinExplain());
  document.getElementById('closeWinExplain')?.addEventListener('click', () => closeModal('modalWinExplain'));
  document.getElementById('modalWinExplain')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalWinExplain') closeModal('modalWinExplain');
  });
  document.getElementById('wxZoomIn')?.addEventListener('click', () => setWinExplainZoom(_wxZoom + 0.1));
  document.getElementById('wxZoomOut')?.addEventListener('click', () => setWinExplainZoom(_wxZoom - 0.1));
  document.getElementById('wxZoomReset')?.addEventListener('click', () => setWinExplainZoom(1));
  document.getElementById('wxHighlightGrid')?.addEventListener('click', () => highlightExplainOnMainGrid());
  document.getElementById('btnMenu').addEventListener('click', () => openModal('modalMenu'));
  document.getElementById('closeMenu').addEventListener('click', () => closeModal('modalMenu'));
  document.getElementById('menuPaytable').addEventListener('click', () => { closeModal('modalMenu'); openModal('modalPaytable'); });
  document.getElementById('closePaytable').addEventListener('click', () => closeModal('modalPaytable'));
  document.getElementById('menuSymbolPack')?.addEventListener('click', () => {
    cycleSymbolPack();
  });
  document.getElementById('menuRules').addEventListener('click', () => { closeModal('modalMenu'); openModal('modalRules'); });
  document.getElementById('closeRules').addEventListener('click', () => closeModal('modalRules'));
  document.getElementById('closeFeatureDetail')?.addEventListener('click', () => closeModal('modalFeatureDetail'));
  document.getElementById('btnReplayFeature')?.addEventListener('click', () => {
    const id = document.getElementById('btnReplayFeature')?.dataset.featureId;
    if (id) replayLastFeature(id);
  });
  document.getElementById('modalFeatureDetail')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalFeatureDetail') closeModal('modalFeatureDetail');
  });
  document.getElementById('menuHistory').addEventListener('click', async () => {
    closeModal('modalMenu');
    openModal('modalHistory');
    if (online) await renderHistoryOnline();
    else renderHistory();
  });
  document.getElementById('closeHistory').addEventListener('click', () => closeModal('modalHistory'));
  ['modalHistory', 'modalSpinDetail', 'modalJackpotHistory'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('click', e => { if (e.target === el) closeModal(id); });
  });
  document.getElementById('closeSpinDetail')?.addEventListener('click', () => closeModal('modalSpinDetail'));
  document.getElementById('menuJackpotHistory')?.addEventListener('click', async () => {
    closeModal('modalMenu');
    openModal('modalJackpotHistory');
    if (online) await renderJackpotHistoryOnline();
    else {
      document.getElementById('jackpotHistoryList').innerHTML =
        '<p style="color:var(--dim);text-align:center;padding:20px">Jackpot history chỉ có online</p>';
    }
  });
  document.getElementById('closeJackpotHistory')?.addEventListener('click', () => closeModal('modalJackpotHistory'));
  document.getElementById('menuCheat')?.addEventListener('click', () => {
    closeModal('modalMenu');
    openCheatPanel();
  });
  document.getElementById('btnCheatFab')?.addEventListener('click', () => openCheatPanel());
  // Cheat panel listeners are bound once in bindCheatPanelEvents() (before Play)
  document.getElementById('btnAuto').addEventListener('click', () => {
    if (state.autoSpins > 0) {
      stopAutoSpin('Autospin stopped');
      return;
    }
    if (state.spinning) {
      showToast('Wait for current spin', '#ff8800');
      return;
    }
    if (state.inFreeSpins) {
      showToast('Cannot start autospin during Free Spins', '#ff8800');
      return;
    }
    openModal('modalAuto');
  });
  document.getElementById('closeAuto').addEventListener('click', () => closeModal('modalAuto'));
  document.getElementById('btnFast').addEventListener('click', () => {
    state.fastSpin = !state.fastSpin;
    document.getElementById('btnFast').classList.toggle('active', state.fastSpin);
  });
  document.getElementById('btnExplainFeat')?.addEventListener('click', () => {
    state.featureExplain = !state.featureExplain;
    document.getElementById('btnExplainFeat')?.classList.toggle('active', state.featureExplain);
    showToast(
      state.featureExplain
        ? '📖 Bật giải thích: mỗi feature sẽ dừng và hiện chữ tiếng Việt'
        : 'Tắt giải thích feature',
      state.featureExplain ? '#00f0ff' : 'var(--dim)'
    );
  });
  document.getElementById('btnSkipVfx')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    requestSkipAllVfx();
  });
  document.getElementById('btnSound').addEventListener('click', () => {
    state.sound = !state.sound;
    document.getElementById('btnSound').textContent = state.sound ? '🔊' : '🔇';
    document.getElementById('btnSound').classList.toggle('active', !state.sound);
    document.getElementById('menuSound').textContent = `🔊 Sound: ${state.sound ? 'ON' : 'OFF'}`;
    if (state.sound) {
      unlockAudio();
      sfx('blip', { gain: 0.5 });
    }
  });
  document.getElementById('menuSound').addEventListener('click', () => {
    state.sound = !state.sound;
    document.getElementById('menuSound').textContent = `🔊 Sound: ${state.sound ? 'ON' : 'OFF'}`;
    document.getElementById('btnSound').textContent = state.sound ? '🔊' : '🔇';
    if (state.sound) {
      unlockAudio();
      sfx('blip', { gain: 0.5 });
    }
  });
  document.getElementById('menuMusic').addEventListener('click', () => {
    state.music = !state.music;
    document.getElementById('menuMusic').textContent = `🎵 Music: ${state.music ? 'ON' : 'OFF'}`;
  });
  document.getElementById('btnBuyFeature').addEventListener('click', () => {
    if (state.spinning || state.fxPlaying) {
      showToast('Wait for current spin', '#ff8800');
      return;
    }
    if (state.inFreeSpins) {
      showToast('Cannot buy features during Free Spins', '#ff8800');
      return;
    }
    if (online && (!ws || ws.readyState !== WebSocket.OPEN)) {
      showToast('Not connected — cannot buy online', '#ff3355');
      return;
    }
    initBuyModals();
    openModal('modalBuyFeature');
  });
  document.getElementById('cancelBuyFeature').addEventListener('click', () => closeModal('modalBuyFeature'));
  document.getElementById('confirmBuyFeature').addEventListener('click', async () => {
    if (!selectedBuyFeature) {
      showToast('Select a feature package', '#ff8800');
      return;
    }
    if (state.spinning || state.fxPlaying || state.inFreeSpins) {
      showToast('Cannot buy features right now', '#ff8800');
      return;
    }
    const costs = { scatter: 1.4, buy3: 12, buy12: 4500 };
    const featureMap = {
      scatter: 'scatterBooster',
      buy3: '3Features',
      buy12: '12Features',
    };
    const optId = selectedBuyFeature;
    const costMult = costs[optId];
    const feature = featureMap[optId];
    selectedBuyFeature = null;
    closeModal('modalBuyFeature');
    stopAutoSpin();

    if (online) {
      // BE: cmd 1501 + feature → debit cost×bet + run 1 spin with boost/force features
      const cost = costMult * state.bet;
      if (state.balance < cost) {
        showToast('Insufficient balance!', '#ff3355');
        return;
      }
      await doOnlineSpin({ buyFeature: feature, buyCostHint: cost });
      return;
    }

    // Offline only: sticky flags for subsequent spins
    state.extraFee = (costMult - 1) * state.bet;
    state.scatterBooster = optId === 'scatter';
    state.buy3Features = optId === 'buy3';
    state.buy12Features = optId === 'buy12';
    showToast(`Script active: ${feature}`, '#aa44ff');
  });
  document.getElementById('btnBuyFS').addEventListener('click', () => {
    if (state.spinning || state.fxPlaying) {
      showToast('Wait for current spin', '#ff8800');
      return;
    }
    if (state.inFreeSpins) {
      showToast('Cannot buy Free Spins during Free Spins', '#ff8800');
      return;
    }
    if (online && (!ws || ws.readyState !== WebSocket.OPEN)) {
      showToast('Not connected — cannot buy online', '#ff3355');
      return;
    }
    // Refresh cost labels theo bet hiện tại
    initBuyModals();
    openModal('modalBuyFS');
  });
  document.getElementById('cancelBuyFS').addEventListener('click', () => closeModal('modalBuyFS'));
  document.getElementById('confirmBuyFS').addEventListener('click', async () => {
    if (!selectedBuyFS) {
      showToast('Select a Free Spin package', '#ff8800');
      return;
    }
    if (state.spinning || state.fxPlaying || state.inFreeSpins) {
      showToast('Cannot buy Free Spins right now', '#ff8800');
      return;
    }

    const costs = { fs1: 80, fs2: 240, fs3: 500, fs4: 212 };
    const featureMap = { fs1: 'FS1', fs2: 'FS2', fs3: 'FS3', fs4: 'FS4' };
    const costMult = costs[selectedBuyFS];
    const feature = featureMap[selectedBuyFS];
    const cost = costMult * state.bet;
    const optId = selectedBuyFS;
    selectedBuyFS = null;
    closeModal('modalBuyFS');
    stopAutoSpin();

    if (online) {
      // Online: server trừ phí qua BUY_FEATURE 1501 — client không trừ trước
      if (state.balance < cost) {
        showToast('Insufficient balance!', '#ff3355');
        return;
      }
      await doOnlineSpin({ buyFeature: feature, buyCostHint: cost });
      return;
    }

    // Offline: trừ local + force scatters
    if (state.balance < cost) {
      showToast('Insufficient balance!', '#ff3355');
      return;
    }
    state.balance -= cost;
    updateUI();
    const scatterMap = { fs1: 3, fs2: 4, fs3: 5, fs4: [3, 4, 5][randInt(0, 2)] };
    await doSpin(scatterMap[optId]);
  });
}

function renderHistory() {
  const sub = document.getElementById('historySubtitle');
  if (sub) sub.textContent = '(local offline)';
  const list = document.getElementById('historyList');
  if (!state.history.length) { list.innerHTML = '<p style="color:var(--dim);text-align:center;padding:20px">No spins yet</p>'; return; }
  list.innerHTML = state.history.slice(0, 30).map(h => `
    <div class="history-item">
      <div style="display:flex;justify-content:space-between">
        <span>${h.type} — ${h.time}</span>
        <span class="${h.profit >= 0 ? 'history-profit-pos' : 'history-profit-neg'}">${h.profit >= 0 ? '+' : ''}${fmt(h.profit)}</span>
      </div>
      <div style="color:var(--dim);font-size:.7rem;margin-top:2px">
        Bet: ${fmt(h.bet)} | Win: ${fmt(h.win)} | ${h.features?.join(', ') || 'No features'}
      </div>
    </div>`).join('');
}

/** Online history row click → 1506 detail */
let lastDetailSpinId = null;
let lastDetailRoundId = null;

async function renderHistoryOnline() {
  const sub = document.getElementById('historySubtitle');
  if (sub) sub.textContent = '(server · cmd 1504)';
  const list = document.getElementById('historyList');
  list.innerHTML = '<p style="color:var(--dim);text-align:center;padding:20px">Loading…</p>';
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    list.innerHTML = '<p style="color:var(--red);text-align:center;padding:20px">Not connected</p>';
    return;
  }
  const payload = await requestGameCmd('1504', { limit: 30, offset: 0 });
  const spins = payload?.spins || payload?.data?.spins || [];
  if (!Array.isArray(spins) || !spins.length) {
    list.innerHTML = '<p style="color:var(--dim);text-align:center;padding:20px">No server history yet</p>';
    return;
  }
  list.innerHTML = spins.map((h, idx) => {
    const bet = Number(h.betAmount ?? h.totalBet ?? 0);
    const win = Number(h.totalWin ?? h.win ?? 0);
    const profit = Number(h.profit != null ? h.profit : win - bet);
    const mode = h.mode || h.thisMode || 'base';
    const ts = h.timestamp ? String(h.timestamp).replace('T', ' ').slice(0, 19) : '';
    const spinId = h.spinId || '';
    const roundId = h.roundId || '';
    return `
    <div class="history-item" data-spin-id="${spinId}" data-round-id="${roundId}" style="cursor:pointer" title="Open detail">
      <div style="display:flex;justify-content:space-between">
        <span>${mode} · #${h.spinIndex || idx + 1}${h.buyFeatureTrigger ? ' · buy' : ''}${h.maxWinReached ? ' · CAP' : ''}</span>
        <span class="${profit >= 0 ? 'history-profit-pos' : 'history-profit-neg'}">${profit >= 0 ? '+' : ''}${fmt(profit)}</span>
      </div>
      <div style="color:var(--dim);font-size:.7rem;margin-top:2px">
        Bet: ${fmt(bet)} | Win: ${fmt(win)}${ts ? ` | ${ts}` : ''}
      </div>
      <div style="color:var(--dim);font-size:.65rem;margin-top:2px;word-break:break-all">
        spinId: ${spinId || '—'} · roundId: ${roundId || '—'}
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.history-item[data-spin-id]').forEach(el => {
    el.addEventListener('click', () => openSpinDetailOnline(el.dataset.spinId, el.dataset.roundId));
  });
}

async function openSpinDetailOnline(spinId, roundId) {
  if (!spinId) return;
  lastDetailSpinId = spinId;
  lastDetailRoundId = roundId || spinId;
  const body = document.getElementById('spinDetailBody');
  const btnRounds = document.getElementById('btnSessionRounds');
  body.innerHTML = '<p>Loading detail…</p>';
  if (btnRounds) btnRounds.style.display = 'none';
  openModal('modalSpinDetail');
  const payload = await requestGameCmd('1506', { spinId, roundId: roundId || spinId });
  if (!payload) {
    body.innerHTML = '<p style="color:var(--red)">Detail timeout / not found</p>';
    return;
  }
  const d = payload.detail || payload;
  const wins = Array.isArray(d.wins) ? d.wins : [];
  const bet = Number(d.betAmount ?? d.totalBet ?? 0);
  const win = Number(d.totalWin ?? d.win ?? 0);
  const profit = Number(d.profit != null ? d.profit : win - bet);
  const ts = d.timestamp ? String(d.timestamp).replace('T', ' ').slice(0, 19) : '—';
  const mode = String(d.thisMode || 'base').toLowerCase();
  const spinType = (d.jackpotWonTier || d.jackpotWonAmount > 0) ? 'JACKPOT'
    : mode.includes('free') || mode === 'fs' ? 'FREE SPIN' : 'NORMAL SPIN';

  // Grid — support row-major (3×5) hoặc column-major (5×3)
  let matrix = null;
  if (Array.isArray(d.screen) && Array.isArray(d.screen[0])) {
    matrix = d.screen.length === ROWS ? d.screen
      : d.screen[0].length === ROWS ? d.screen[0].map((_, r) => d.screen.map(col => col[r]))
      : d.screen;
  }
  const symTag = key => {
    const s = SYMBOLS[key];
    return s?.img ? imgTag(s.img, 'style="width:100%;height:100%;object-fit:contain;display:block" draggable="false"') : (key || '?');
  };
  let gridHtml = '';
  if (matrix) {
    const rows = matrix.length, cols = matrix[0].length;
    gridHtml = `<div id="sdGrid" style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:5px;margin:12px 0">`
      + matrix.map((row, r) => row.map((id, c) => {
        const highlight = wins.some(w => (w.positions || []).some(p => p[0] === c && p[1] === r));
        const dim = !wins.length || highlight ? '' : 'opacity:.4;filter:brightness(.65) grayscale(.35) saturate(.7);';
        return `<div data-r="${r}" data-c="${c}" style="aspect-ratio:1/1;background:rgba(0,0,0,.35);border:1px solid ${highlight ? 'var(--cyan)' : '#1e3a5f'};${highlight ? 'box-shadow:0 0 10px rgba(0,240,255,.5);' : ''}border-radius:6px;display:flex;align-items:center;justify-content:center;padding:3px"><div data-dimmed="1" style="${dim}display:flex;width:100%;height:100%;align-items:center;justify-content:center;transition:opacity .2s,filter .2s;pointer-events:none">${symTag(SYM_MAP[id])}</div></div>`;
      }).join('')).join('') + '</div>';
  }

  // Way wins — pager 6/page (GDD 9.3)
  const PAGE = 6;
  const totalPages = Math.max(1, Math.ceil(wins.length / PAGE));
  let winPage = 0;
  const winRowHtml = (w, idx) => {
    const key = SYM_MAP[w.symbolId] || '?';
    const posTxt = (w.positions || []).map(p => `R${p[0] + 1}·h${p[1] + 1}`).join(', ');
    return `<div data-win="${idx}" class="history-item" style="display:flex;align-items:center;gap:10px;cursor:pointer">
      <div style="width:44px;height:44px;flex:0 0 44px;background:rgba(0,0,0,.35);border-radius:6px;padding:3px;display:flex;align-items:center;justify-content:center">${symTag(key)}</div>
      <div style="flex:1;min-width:0">
        <div style="color:var(--text);font-size:.8rem">#${idx + 1} · ${SYMBOLS[key]?.name || key} ×${w.count}${w.type ? ` · ${w.type}` : ''}${w.lineId != null ? ` · line ${w.lineId}` : ''}</div>
        <div style="color:var(--dim);font-size:.7rem;margin-top:2px">${posTxt || '—'}</div>
      </div>
      <div class="history-profit-pos" style="flex:0 0 auto">${fmt(w.amount)}</div>
    </div>`;
  };
  const winsPageHtml = () => `<div id="sdWins">${wins.slice(winPage * PAGE, winPage * PAGE + PAGE).map((w, i) => winRowHtml(w, winPage * PAGE + i)).join('')}</div>`;
  const pagerHtml = () => (totalPages > 1 ? `
    <div id="sdPager" style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px">
      <button class="btn" id="sdPrev" style="padding:6px 14px;font-size:.75rem" ${winPage === 0 ? 'disabled' : ''}>‹ Prev</button>
      <span style="color:var(--dim);font-size:.75rem">${winPage + 1} / ${totalPages}</span>
      <button class="btn" id="sdNext" style="padding:6px 14px;font-size:.75rem" ${winPage >= totalPages - 1 ? 'disabled' : ''}>Next ›</button>
    </div>` : '');

  const modeBadge = `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
      <span style="padding:3px 10px;border-radius:20px;border:1px solid var(--frame-hi);font-size:.65rem;letter-spacing:1px;color:var(--cyan)">${spinType}</span>
      ${d.buyFeatureTrigger ? '<span style="padding:3px 10px;border-radius:20px;border:1px solid var(--orange);font-size:.65rem;color:var(--orange)">BUY FEATURE</span>' : ''}
      ${d.maxWinReached ? '<span style="padding:3px 10px;border-radius:20px;border:1px solid var(--red);font-size:.65rem;color:var(--red)">WIN CAP</span>' : ''}
    </div>
    ${d.maxWinReached ? '<p style="color:var(--red);font-size:.75rem;margin:-4px 0 8px">Maximum Win Cap reached. Only ' + fmt(Math.min(win, 19693 * bet)) + ' has been awarded for this spin.</p>' : ''}`;

  body.innerHTML = `
    ${modeBadge}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">
      <div style="background:rgba(0,0,0,.35);border:1px solid #1e3a5f;border-radius:8px;padding:8px;text-align:center"><div style="font-size:.65rem;color:var(--dim)">BET</div><div style="color:var(--text)">${fmt(bet)}</div></div>
      <div style="background:rgba(0,0,0,.35);border:1px solid #1e3a5f;border-radius:8px;padding:8px;text-align:center"><div style="font-size:.65rem;color:var(--dim)">WIN</div><div style="color:var(--green)">${fmt(win)}</div></div>
      <div style="background:rgba(0,0,0,.35);border:1px solid #1e3a5f;border-radius:8px;padding:8px;text-align:center"><div style="font-size:.65rem;color:var(--dim)">PROFIT</div><div class="${profit >= 0 ? 'history-profit-pos' : 'history-profit-neg'}">${profit >= 0 ? '+' : ''}${fmt(profit)}</div></div>
    </div>
    ${gridHtml}
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <strong style="color:var(--text);font-size:.85rem;letter-spacing:1px">WAY WINS (${wins.length})</strong>
      <span style="font-size:.7rem;color:var(--dim)">${ts}</span>
    </div>
    ${wins.length ? winsPageHtml() + pagerHtml() : '<p style="color:var(--dim);padding:10px;text-align:center">No wins this spin</p>'}
    <div style="border-top:1px solid #1e3a5f;margin-top:12px;padding-top:10px;font-size:.7rem;color:var(--dim);display:grid;gap:3px">
      <div>mode: ${d.thisMode || '—'} → ${d.nextMode || '—'} · jackpot: ${d.jackpotWonTier ? d.jackpotWonTier + ' ' : ''}${fmt(d.jackpotWonAmount ?? 0)} · contribution: ${fmt(d.jackpotContribution ?? 0)}</div>
      <div style="word-break:break-all">spinId: ${d.spinId || payload.spinId || spinId}</div>
      <div style="word-break:break-all">roundId: ${d.roundId || payload.roundId || roundId || '—'} · session: ${d.sessionId || payload.sessionId || '—'} · game: ${d.gameId || '—'}</div>
    </div>
  `;

  // Highlight winning positions khi click vào way win
  const hlCells = w => {
    const posSet = new Set((w?.positions || []).map(p => p[0] + ',' + p[1]));
    const hasSel = posSet.size > 0;
    body.querySelectorAll('#sdGrid > div[data-r]').forEach(el => {
      const on = posSet.has(el.dataset.c + ',' + el.dataset.r);
      el.style.border = on ? '1px solid var(--cyan)' : '1px solid #1e3a5f';
      el.style.boxShadow = on ? '0 0 10px rgba(0,240,255,.5)' : 'none';
      const inner = el.firstElementChild;
      const symEl = inner?.dataset?.dimmed === '1' ? inner : null;
      if (symEl) {
        if (hasSel && !on) { symEl.style.opacity = '.4'; symEl.style.filter = 'brightness(.65) grayscale(.35) saturate(.7)'; }
        else { symEl.style.opacity = '1'; symEl.style.filter = 'none'; }
      }
    });
  };
  const bindWins = () => {
    body.querySelectorAll('#sdWins .history-item[data-win]').forEach(el =>
      el.addEventListener('click', () => hlCells(wins[Number(el.dataset.win)])));
    if (wins.length) hlCells(wins[0]);
  };
  const bindPager = () => {
    body.querySelector('#sdPrev')?.addEventListener('click', () => { winPage--; reWins(); });
    body.querySelector('#sdNext')?.addEventListener('click', () => { winPage++; reWins(); });
  };
  const reWins = () => {
    const winsEl = body.querySelector('#sdWins');
    if (winsEl) winsEl.outerHTML = winsPageHtml();
    const pager = body.querySelector('#sdPager');
    const parsed = new DOMParser().parseFromString(pagerHtml(), 'text/html').body.firstElementChild;
    if (pager) {
      if (parsed) pager.replaceWith(parsed);
      else pager.remove();
      body.querySelector('#sdPrev')?.addEventListener('click', () => { winPage--; reWins(); });
      body.querySelector('#sdNext')?.addEventListener('click', () => { winPage++; reWins(); });
    }
    bindWins();
  };
  bindWins(); bindPager();
  if (btnRounds) {
    btnRounds.style.display = 'inline-block';
    btnRounds.onclick = () => openSessionRoundsOnline(lastDetailRoundId || lastDetailSpinId);
  }
}

async function openSessionRoundsOnline(roundOrSpinId) {
  if (!roundOrSpinId) return;
  const body = document.getElementById('spinDetailBody');
  body.innerHTML = '<p>Loading package rounds…</p>';
  openModal('modalSpinDetail');
  const payload = await requestGameCmd('1505', {
    roundId: roundOrSpinId,
    transactionId: roundOrSpinId,
    spinId: roundOrSpinId,
  });
  if (!payload) {
    body.innerHTML = '<p style="color:var(--red)">Session rounds timeout</p>';
    return;
  }
  const items = payload.items || [];
  body.innerHTML = `
    <div><strong style="color:var(--text)">package roundId</strong>: ${payload.roundId || roundOrSpinId}</div>
    <div><strong style="color:var(--text)">totalItems</strong>: ${payload.totalItems ?? items.length} · maxWin: ${payload.maxWinReached ? 'YES' : 'no'}</div>
    <div style="margin-top:10px">${(items.length ? items : []).map(it => `
      <div class="history-item" style="margin-bottom:6px">
        <div style="display:flex;justify-content:space-between">
          <span>#${it.roundIndex} ${it.thisMode || ''} → ${it.nextMode || ''}</span>
          <span class="history-profit-pos">${fmt(it.totalWin ?? it.win)}</span>
        </div>
        <div style="font-size:.65rem;word-break:break-all">${it.spinId || ''}</div>
      </div>`).join('') || '<p style="color:var(--dim)">Empty package</p>'}
    </div>`;
}

async function renderJackpotHistoryOnline() {
  const list = document.getElementById('jackpotHistoryList');
  list.innerHTML = '<p style="color:var(--dim);text-align:center;padding:20px">Loading…</p>';
  const payload = await requestGameCmd('1507', { limit: 30 });
  const rows = payload?.history || payload?.data?.history || [];
  if (!Array.isArray(rows) || !rows.length) {
    list.innerHTML = '<p style="color:var(--dim);text-align:center;padding:20px">No jackpot history</p>';
    return;
  }
  list.innerHTML = rows.map(r => `
    <div class="history-item">
      <div style="display:flex;justify-content:space-between">
        <span>${r.jackpotType || r.tier || 'JP'} · ${r.username || r.userId || ''}</span>
        <span class="history-profit-pos">${fmt(r.amount)}</span>
      </div>
      <div style="color:var(--dim);font-size:.7rem;margin-top:2px">${r.winId || r.id || ''}</div>
    </div>`).join('');
}

// ─── Splash ──────────────────────────────────────────────────
async function splash() {
  const fill = document.getElementById('splashFill');
  const pending = startAssetPreload();
  if (!assetsReady()) {
    updateLoginLoadUi();
    while (!assetsReady()) {
      await Promise.race([pending, sleep(80)]);
    }
  }
  if (fill) fill.style.width = '100%';
  await pending;
  await sleep(assetsReady() ? 180 : 80);
  document.getElementById('splash').classList.add('hidden');
  document.getElementById('game').classList.add('visible');
}

// ═══════════════════════════════════════════════════════════════
// ONLINE MODE — WebSocket Integration
// ═══════════════════════════════════════════════════════════════

/** Server symbol id → client key. 13 = MYSTERY (TrojanHorse intermediate only). */
const SYM_MAP = { 1:'A',2:'B',3:'C',4:'D',5:'E',6:'F',7:'G',8:'H',9:'I',10:'K',11:'W',12:'S',13:'M' };
const SYM_TO_ID = Object.fromEntries(Object.entries(SYM_MAP).map(([id, k]) => [k, Number(id)]));

let ws = null;
let accessToken = '';
let online = false;
let wsSessionId = '';
/** Session identity for REST cheat / wsInit — filled from login, host, or server payloads */
let sessionAgencyId = '';
let sessionUserId = '';
let sessionUsername = '';
let pendingSpinResolve = null;
let pendingSpinData = null;
/** cmd string → { resolve, timer } for non-spin request/response (1502/1504–1507) */
let pendingCmdWaiters = {};
let onlineBalance = 0;
let spinQueue = [];
let pingSeq = 0;
let pingTimer = null;
let reconnectTimer = null;
/** true while closing WS on purpose (force logout / disconnect) — avoid treating as error */
let intentionalWsClose = false;

/**
 * Fail any in-flight spin / cmd waiters so promises do not hang after logout.
 */
function clearAllPendingNetwork() {
  if (pendingSpinResolve) {
    pendingSpinResolve(false);
    pendingSpinResolve = null;
  }
  pendingSpinData = null;
  spinQueue = [];
  for (const key of Object.keys(pendingCmdWaiters)) {
    resolvePendingCmd(key, null);
  }
}

/**
 * Clear online session and return to login overlay.
 * Used by FORCE_LOGOUT (1006) session takeover and manual disconnect.
 * @param {{ message?: string, color?: string, keepLoginFields?: boolean }} opts
 */
function returnToLogin(opts = {}) {
  const message = opts.message || 'Session ended. Please log in again.';
  const toastColor = opts.color || '#ff3355';

  intentionalWsClose = true;
  online = false;

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
  document.getElementById('fsBanner')?.classList.remove('visible');
  document.getElementById('multDisplay') && (document.getElementById('multDisplay').textContent = '01');
  _vfxSkipAll = true;
  if (_explainContinueResolve) {
    try { _explainContinueResolve(); } catch (_) {}
    _explainContinueResolve = null;
  }
  if (typeof _vfxAnimCancel === 'function') {
    try { _vfxAnimCancel(); } catch (_) {}
  }

  clearAllPendingNetwork();

  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  if (ws) {
    try { ws.onclose = null; ws.onerror = null; ws.onmessage = null; ws.close(); } catch (_) {}
    ws = null;
  }

  accessToken = '';
  wsSessionId = '';
  sessionAgencyId = '';
  sessionUserId = '';
  // keep sessionUsername / form fields so user can re-login quickly
  onlineBalance = 0;

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
  intentionalWsClose = false;
}

/**
 * FORCE_LOGOUT (cmd 1006) — another device took the session.
 */
function handleForceLogout(payload) {
  const msg =
    (payload && (payload.message || payload.msg)) ||
    'You have logged in from another device.';
  returnToLogin({ message: String(msg), color: '#ff3355' });
}

/**
 * Gửi cmd game và chờ response type [5, payload] cùng cmd.
 * @returns {Promise<object|null>} payload or null on timeout
 */
function requestGameCmd(cmd, extra = {}, timeoutMs = 15000) {
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

function resolvePendingCmd(cmd, payload) {
  const key = String(cmd);
  const w = pendingCmdWaiters[key];
  if (!w) return false;
  clearTimeout(w.timer);
  delete pendingCmdWaiters[key];
  w.resolve(payload);
  return true;
}

/** Lấy ma trận screen 5×3 (số symbol server) từ payload 1005/1500 */
function extractServerScreen(payload) {
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
function applyServerScreen(screen, splitCounts) {
  if (!Array.isArray(screen) || screen.length !== REELS) return false;
  if (!state.grid?.length) createEmptyGrid();
  for (let c = 0; c < REELS; c++) {
    const col = screen[c];
    if (!Array.isArray(col) || col.length < ROWS) return false;
    for (let r = 0; r < ROWS; r++) {
      state.grid[c][r] = SYM_MAP[col[r]] || 'A';
      state.cellMeta[c][r] = { split: false, multiplier: 1, mystery: false };
    }
  }
  // Áp splitCounts nếu server gửi (init thường toàn 1)
  if (Array.isArray(splitCounts) && splitCounts.length === REELS) {
    for (let c = 0; c < REELS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const n = splitCounts[c]?.[r];
        if (n != null && Number(n) > 1) state.cellMeta[c][r].split = true;
      }
    }
  }
  renderGrid();
  return true;
}

function applyOnlineBalance(payload, { syncBefore = false } = {}) {
  const raw =
    payload?.data?.control?.balance ??
    payload?.control?.balance ??
    payload?.balance;
  if (raw === undefined || raw === null || raw === '') return false;
  const bal = parseFloat(raw);
  if (Number.isNaN(bal)) return false;
  onlineBalance = bal;
  state.balance = bal;
  // JOIN / last-session: BEFORE = balance hiện tại (chưa có spin pending)
  if (syncBefore) state.balanceBefore = bal;
  updateUI();
  return true;
}

/** Map tên feature server (PascalCase) → id client */
const SERVER_FEATURE_MAP = {
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

const FEATURE_PRESENT = {
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

function mapServerFeatureName(name) {
  if (!name) return null;
  if (SERVER_FEATURE_MAP[name]) return SERVER_FEATURE_MAP[name];
  const lower = String(name).toLowerCase();
  const hit = FEATURES.find(f => f.id === lower || f.name.toLowerCase().replace(/\s+/g, '') === lower);
  return hit?.id || null;
}

function mapFeatureNameList(names) {
  if (!Array.isArray(names)) return [];
  const ids = [];
  for (const n of names) {
    const id = mapServerFeatureName(n);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return FEATURES.map(f => f.id).filter(id => ids.includes(id));
}

/** cellMultipliers server: key "row,reel" → multiplier */
function applyCellMultipliers(map) {
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
      state.cellMeta[reel][row].multiplier = Number(mult) || 1;
    }
  }
}

/**
 * Parse full spin/join payload → cấu trúc dùng cho VFX online.
 * Contract VFX (live 1500): features.baseScreen + features.featureSteps
 * — docs/FE_SPIN_VFX_GUIDE.md · REAL_RESPONSES.md §5.1
 */
function parseOnlineRound(payload) {
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
function restoreOnlineSessionFromPayload(payload, { autoContinueFs = false } = {}) {
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
async function applyOnlineFreeSpinFlow(parsed, wasInFS, spinWin) {
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

async function presentOnlineFeature(feat) {
  if (!feat) return;
  const p = FEATURE_PRESENT[feat.id] || { msg: feat.name, color: feat.color || 'var(--cyan)' };
  showToast(p.msg, p.color);
  renderFeatureMeter((state.triggeredFeatures || []).map(f => f.id));
  await sleepRaw(state.fastSpin ? 380 : 750);
}

async function presentOnlineFeatureSequence(featObjs, phase) {
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

// ─── Live VFX pipeline (baseScreen + featureSteps) ────────────
// Full semantic presentation — contract: docs/FE_SPIN_VFX_GUIDE.md
// pos wire = [col, row]; cellMultipliers key = "row,col"
// Money/final grid: always snap stages[0].screen after steps (authority).

function vfxMs(normal, turbo) {
  if (_vfxSkipAll) return 0;
  return state.fastSpin ? (turbo ?? Math.round(normal * 0.4)) : normal;
}

function isVfxSkip() {
  return !!_vfxSkipAll;
}

function resetVfxSkip() {
  _vfxSkipAll = false;
}

function setSkipBarVisible(on) {
  document.getElementById('vfxSkipBar')?.classList.toggle('show', !!on);
}

function requestSkipAllVfx() {
  _vfxSkipAll = true;
  if (_vfxAnimCancel) {
    try { _vfxAnimCancel(); } catch (_) {}
    _vfxAnimCancel = null;
  }
  if (_explainContinueResolve) {
    const r = _explainContinueResolve;
    _explainContinueResolve = null;
    r();
  }
  hideFeatureExplain(true);
  hideFeatureIntro(true);
  setSkipBarVisible(false);
  showToast('⏭ Đã bỏ qua hiệu ứng còn lại', '#00f0ff');
}

/** Interruptible wait — thoát sớm nếu Skip VFX */
async function vfxWait(ms) {
  if (isVfxSkip() || ms <= 0) return;
  let left = ms;
  while (left > 0 && !isVfxSkip()) {
    const d = Math.min(40, left);
    await sleepRaw(d);
    left -= d;
  }
}

function stepPos(pos) {
  if (!Array.isArray(pos) || pos.length < 2) return null;
  const c = Number(pos[0]);
  const r = Number(pos[1]);
  if (!Number.isFinite(c) || !Number.isFinite(r)) return null;
  if (c < 0 || c >= REELS || r < 0 || r >= ROWS) return null;
  return { c, r };
}

function posKeys(list) {
  if (!Array.isArray(list)) return [];
  return list.map(pos => {
    const p = stepPos(pos);
    return p ? `${p.c},${p.r}` : null;
  }).filter(Boolean);
}

function setCellSymbol(c, r, symIdOrKey) {
  if (!state.grid?.[c]) return;
  const key = typeof symIdOrKey === 'number' || (typeof symIdOrKey === 'string' && /^\d+$/.test(symIdOrKey))
    ? (SYM_MAP[Number(symIdOrKey)] || state.grid[c][r])
    : symIdOrKey;
  state.grid[c][r] = key || state.grid[c][r];
}

function setCellSplit(c, r, splitCount) {
  if (!state.cellMeta?.[c]?.[r]) return;
  state.cellMeta[c][r].split = Number(splitCount) > 1;
}

function setCellMystery(c, r, on) {
  if (!state.cellMeta?.[c]?.[r]) return;
  state.cellMeta[c][r].mystery = !!on;
  if (on) state.grid[c][r] = 'M';
}

function setCellMultiplier(c, r, mult) {
  if (!state.cellMeta?.[c]?.[r]) return;
  state.cellMeta[c][r].multiplier = Number(mult) || 1;
}

function applyStepChanges(changes) {
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

function applyStepSplitChanges(splitChanges) {
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

function cellEl(c, r) {
  return document.querySelector(`#reelsGrid .cell[data-reel="${c}"][data-row="${r}"]`);
}

/** Map cell VFX class → symbol color/scale FX preset */
const VFX_CLS_SYM_FX = {
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

function restoreIdleSymbolFx(img) {
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

function clearCellClasses(clsList) {
  const sels = (clsList || []).map(c => `.cell.${c}`).join(',');
  if (!sels) return;
  document.querySelectorAll(`#reelsGrid ${sels}`).forEach(el => {
    clsList.forEach(c => el.classList.remove(c));
    // Reset temporary VFX tint; keep idle accents for W / M
    el.querySelectorAll('.sym-img').forEach(restoreIdleSymbolFx);
  });
}

function highlightCells(keys, cls, ms) {
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

async function highlightCellsKeep(keys, cls, ms) {
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

function highlightReels(cols, cls, ms) {
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

function showVfxBanner(text, featId) {
  const el = document.getElementById('vfxBanner');
  if (!el) return;
  el.className = 'vfx-banner show' + (featId ? ` ${featId}` : '');
  el.textContent = text || '';
}

function hideVfxBanner() {
  const el = document.getElementById('vfxBanner');
  if (!el) return;
  el.classList.remove('show');
  el.textContent = '';
}

async function vfxFlash(colorCls, ms) {
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

function setMeterStepActive(featId) {
  document.querySelectorAll('#featureMeter .feat-badge').forEach(b => {
    b.classList.toggle('vfx-active', b.dataset.featureId === featId);
  });
}

function clearMeterStepActive() {
  document.querySelectorAll('#featureMeter .feat-badge.vfx-active')
    .forEach(b => b.classList.remove('vfx-active'));
}

function symNameFromId(id) {
  return SYMBOLS[SYM_MAP[id]]?.name || String(id);
}

function featureStepToast(step, featId) {
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
  if (featId === 'surge' && Array.isArray(step.convertedTypes)) {
    showToast(`⚡ Power Surge: ${step.convertedTypes.map(symNameFromId).join(', ')} → Wild`, p?.color || '#ffff00');
    return;
  }
  if (featId === 'scan' && Array.isArray(step.convertedTypes)) {
    showToast(`🎯 Algorithmic Scan: ${step.convertedTypes.map(symNameFromId).join(', ')} → Wild`, p?.color || '#00f0ff');
    return;
  }
  if (p) showToast(p.msg, p.color);
  else showToast(String(step?.name || featId), 'var(--cyan)');
}

// ─── Cinematic VFX engine (canvas + stage DOM) + PRO polish ──

/** Per-feature beat timing (ms normal; turbo via vfxMs) */
const VFX_BEAT = {
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

const VFX_BLOOM_COLOR = {
  firewall: 'red', decrypt: 'cyan', trojan: 'purple', overload: 'orange',
  overclock: 'orange', cloning: 'green', root: 'green', surge: 'yellow',
  glitch: 'purple', scan: 'cyan', bandwidth: 'orange', bypass: 'cyan',
};

function vfxStage() {
  return document.getElementById('vfxStage');
}

function clearVfxStage() {
  const st = vfxStage();
  if (st) st.innerHTML = '';
  const cv = document.getElementById('vfxCanvas');
  if (cv) {
    const ctx = cv.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
  }
  if (_vfxAnimCancel) {
    _vfxAnimCancel();
    _vfxAnimCancel = null;
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

function setVfxBloom(colorCls, on = true) {
  const el = document.getElementById('vfxBloom');
  if (!el) return;
  el.classList.remove('show', 'cyan', 'red', 'orange', 'purple', 'green', 'yellow');
  if (on) {
    el.classList.add('show');
    if (colorCls) el.classList.add(colorCls);
  }
}

function setVfxVignette(on) {
  document.getElementById('vfxVignette')?.classList.toggle('show', !!on);
}

async function vfxHitImpact(strength = 'full', bloomColor = 'cyan') {
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
async function flyFeatureIconFromMeter(featId) {
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
async function celebrateWinPro(totalWin) {
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
async function playJackpotClimax(tierName, amount) {
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

function hideFeatureIntro(instant = false) {
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
async function playFeatureIntro(featId) {
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

function hideFeatureExplain(instant = false) {
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
function buildFeatureExplainTip(featId, step) {
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
    if (featId === 'surge' && Array.isArray(step.convertedTypes) && step.convertedTypes.length) {
      return `Đổi thành Wild: ${step.convertedTypes.map(symNameFromId).join(', ')} (ô kề bên có thể bị Split).`;
    }
    if (featId === 'scan' && Array.isArray(step.convertedTypes) && step.convertedTypes.length) {
      return `Khóa và đổi thành Wild: ${step.convertedTypes.map(symNameFromId).join(', ')}.`;
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
async function playFeatureExplainBeat(featId, step = null) {
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
      _explainContinueResolve = null;
      if (btnCont) btnCont.onclick = null;
      clearTimeout(timer);
      resolve();
    };
    _explainContinueResolve = finish;
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

function prepVfxCanvas() {
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
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h, wrap };
}

function cellRectInWrap(c, r) {
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

function reelRectInWrap(col) {
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

function runAnimFrame(duration, onFrame) {
  if (isVfxSkip() || duration <= 0) {
    try { onFrame(1, duration || 0); } catch (_) {}
    return Promise.resolve();
  }
  return new Promise(resolve => {
    let cancelled = false;
    _vfxAnimCancel = () => { cancelled = true; };
    const t0 = performance.now();
    const tick = (now) => {
      if (cancelled || isVfxSkip()) {
        _vfxAnimCancel = null;
        resolve();
        return;
      }
      const t = Math.min(1, (now - t0) / Math.max(1, duration));
      try { onFrame(t, now - t0); } catch (_) {}
      if (t < 1) requestAnimationFrame(tick);
      else {
        _vfxAnimCancel = null;
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Particle 2.0 — modes: 'spark' | 'ember' | 'smoke' | 'code' | 'star'
 */
function burstParticles(ctx, x, y, color, n = 18, mode = 'spark') {
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

function drawParts(ctx, parts, dt) {
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
function proBurst(ctx, x, y, palette, scale = 1) {
  let parts = [];
  const s = scale * (typeof VFX_PARTICLE_SCALE !== 'undefined' ? VFX_PARTICLE_SCALE : 1);
  parts = parts.concat(burstParticles(ctx, x, y, palette.core || '#fff', Math.round(14 * s), 'spark'));
  parts = parts.concat(burstParticles(ctx, x, y, palette.mid || '#ffaa44', Math.round(18 * s), 'ember'));
  parts = parts.concat(burstParticles(ctx, x, y, palette.smoke || 'rgba(80,40,20,0.35)', Math.round(8 * s), 'smoke'));
  return parts;
}

// ─── VFX primitives (desktop cinematic — laptop macOS only) ──
/** Density scale for canvas particles (no mobile branch). */
const VFX_PARTICLE_SCALE = 1.4;

function vfxParticleN(base) {
  return Math.max(1, Math.round(base * VFX_PARTICLE_SCALE * (state.fastSpin ? 0.9 : 1)));
}

/** Brief freeze before impact — skip-aware. */
async function hitStop(ms) {
  if (isVfxSkip() || !(ms > 0)) return;
  await vfxWait(vfxMs(ms, Math.max(20, Math.round(ms * 0.35))));
}

/** Camera punch on reels wrapper (reuses existing CSS classes). */
function screenPunch(strength = 'full') {
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

function drawShockwave(ctx, x, y, t, rgb = [0, 240, 255], maxR = 110) {
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

function drawScanlines(ctx, w, h, t = 0, strength = 0.14) {
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
function drawRgbSplit(ctx, w, h, t, strength = 7) {
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
function drawElectricArc(ctx, x1, y1, x2, y2, seed = 0, color = '#ffff88') {
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
function drawRadialWash(ctx, x, y, r, rgba = 'rgba(170,68,255,0.25)') {
  if (!ctx) return;
  const g = ctx.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, rgba);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

async function morphChangesSequential(changes, cellCls, opts = {}) {
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

async function applySplitsAnimated(splitChanges) {
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
      await runAnimFrame(vfxMs(90, 32), (t) => {
        canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
        drawShockwave(canvas.ctx, rc.x, rc.y, t, [0, 255, 136], 40);
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

// ─── 12 cinematic presenters (GDD art brief) ─────────────────

async function presentVfxFirewall(step, featId, opts) {
  const lows = Array.isArray(step.bannedLows) ? step.bannedLows.map(symNameFromId) : [];
  showVfxBanner(lows.length ? `Firewall — incinerate ${lows.join(', ')}` : 'Firewall Block', 'firewall');
  if (!opts.firewallAnnounced) featureStepToast(step, featId);
  clearVfxStage();
  const st = vfxStage();
  const wall = document.createElement('div');
  wall.className = 'vfx-fire-wall';
  st?.appendChild(wall);
  await sleepRaw(30);
  wall.classList.add('up');
  setVfxBloom('red', true);
  setVfxVignette(true);
  screenPunch('sm');
  await vfxFlash('red', vfxMs(180, 60));

  const canvas = prepVfxCanvas();
  let parts = [];
  const burnKeys = [];
  const burnCells = [];
  if (Array.isArray(step.changes)) {
    for (const ch of step.changes) {
      const p = stepPos(ch?.pos);
      if (!p) continue;
      burnKeys.push(`${p.c},${p.r}`);
      const rc = cellRectInWrap(p.c, p.r);
      if (rc) burnCells.push(rc);
      if (rc && canvas) {
        parts = parts.concat(proBurst(canvas.ctx, rc.x, rc.y, {
          core: '#fff0a0', mid: '#ff5522', smoke: 'rgba(40,10,0,0.4)',
        }, 1.45));
        parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#ffcc44', vfxParticleN(10), 'ember'));
      }
      cellEl(p.c, p.r)?.classList.add('vfx-firewall', 'scrub');
    }
  } else {
    const banned = new Set((step.bannedLows || []).map(id => SYM_MAP[id]).filter(Boolean));
    for (let c = 0; c < REELS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (banned.has(state.grid[c][r])) {
          burnKeys.push(`${c},${r}`);
          cellEl(c, r)?.classList.add('vfx-firewall');
          const rc = cellRectInWrap(c, r);
          if (rc) burnCells.push(rc);
        }
      }
    }
  }

  if (canvas) {
    await runAnimFrame(vfxMs(900, 320), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      // rising heat + ember rain
      const g = canvas.ctx.createLinearGradient(0, canvas.h * (1 - t * 1.05), 0, canvas.h);
      g.addColorStop(0, 'rgba(255,80,0,0)');
      g.addColorStop(0.45, 'rgba(255,50,0,0.28)');
      g.addColorStop(1, 'rgba(255,200,40,0.48)');
      canvas.ctx.fillStyle = g;
      canvas.ctx.fillRect(0, 0, canvas.w, canvas.h);
      // heat shimmer on burn cells + delayed shockwave
      for (let i = 0; i < burnCells.length; i++) {
        const rc = burnCells[i];
        const localT = Math.max(0, Math.min(1, (t - i * 0.06) * 1.4));
        if (localT > 0) {
          drawShockwave(canvas.ctx, rc.x, rc.y, localT, [255, 80, 20], 70);
          drawRadialWash(canvas.ctx, rc.x, rc.y, 40 + localT * 20, `rgba(255,100,0,${0.25 * (1 - localT * 0.5)})`);
        }
      }
      if (Math.random() < 0.55) {
        parts = parts.concat(burstParticles(
          canvas.ctx,
          Math.random() * canvas.w,
          canvas.h * (0.85 + Math.random() * 0.15),
          Math.random() > 0.5 ? '#ff6622' : '#ffcc44',
          vfxParticleN(4),
          'ember'
        ));
      }
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  } else {
    await sleepRaw(vfxMs(700, 260));
  }

  await hitStop(55);
  screenPunch('full');
  if (step.changes?.length) applyStepChanges(step.changes);
  renderGrid();
  await highlightCells(burnKeys, 'vfx-hit', vfxMs(280, 95));
  clearCellClasses(['vfx-firewall', 'scrub']);
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

async function presentVfxDecrypt(step, featId) {
  showVfxBanner('Data Decrypt — laser grid scan', 'decrypt');
  featureStepToast(step, featId);
  clearVfxStage();
  setVfxBloom('cyan', true);
  setVfxVignette(true);
  const st = vfxStage();
  const gridFx = document.createElement('div');
  gridFx.className = 'vfx-laser-grid';
  const beam = document.createElement('div');
  beam.className = 'vfx-laser-beam';
  st?.appendChild(gridFx);
  st?.appendChild(beam);
  await sleepRaw(20);
  gridFx.classList.add('on');
  beam.style.opacity = '1';

  const wrap = document.getElementById('reelsWrapper');
  const h = wrap?.clientHeight || 200;
  const canvas = prepVfxCanvas();
  let parts = [];
  // Pre-mark upgrade targets for beam "lock" sparks
  const targets = [];
  for (const ch of (step.changes || [])) {
    const p = stepPos(ch?.pos);
    if (!p) continue;
    const rc = cellRectInWrap(p.c, p.r);
    if (rc) targets.push(rc);
  }

  await runAnimFrame(vfxMs(820, 300), (t) => {
    beam.style.top = `${t * (h - 4)}px`;
    beam.style.opacity = String(0.45 + 0.55 * Math.sin(t * Math.PI));
    if (canvas) {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      drawScanlines(canvas.ctx, canvas.w, canvas.h, t, 0.08);
      const y = t * canvas.h;
      const g = canvas.ctx.createLinearGradient(0, y - 36, 0, y + 14);
      g.addColorStop(0, 'rgba(0,240,255,0)');
      g.addColorStop(0.7, 'rgba(0,240,255,0.18)');
      g.addColorStop(1, 'rgba(180,255,255,0.35)');
      canvas.ctx.fillStyle = g;
      canvas.ctx.fillRect(0, Math.max(0, y - 36), canvas.w, 50);
      // horizontal laser core
      canvas.ctx.fillStyle = `rgba(0,240,255,${0.55 + 0.35 * Math.sin(t * Math.PI)})`;
      canvas.ctx.shadowColor = '#00f0ff';
      canvas.ctx.shadowBlur = 14;
      canvas.ctx.fillRect(0, y - 1.5, canvas.w, 3);
      canvas.ctx.shadowBlur = 0;
      // spark when beam crosses target cells
      for (const rc of targets) {
        if (Math.abs(rc.y - y) < 14) {
          parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#00f0ff', vfxParticleN(3), 'star'));
          drawRadialWash(canvas.ctx, rc.x, rc.y, 28, 'rgba(0,240,255,0.25)');
        }
      }
      if (Math.random() < 0.4) {
        parts = parts.concat(burstParticles(canvas.ctx, Math.random() * canvas.w, y, '#00f0ff', vfxParticleN(3), 'star'));
      }
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    }
  });

  await hitStop(40);
  screenPunch('sm');
  if (Array.isArray(step.changes) && step.changes.length) {
    await morphChangesSequential(step.changes, 'vfx-decrypt', {
      canvas, rgb: [0, 240, 255], partColor: '#7dffff',
    });
  }
  beam.style.opacity = '0';
  gridFx.classList.remove('on');
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

async function presentVfxTrojan(step, featId) {
  const mysteryPos = Array.isArray(step.mysteryPositions) ? step.mysteryPositions : [];
  const changePos = Array.isArray(step.changes) ? step.changes.map(ch => ch.pos) : [];
  const positions = mysteryPos.length ? mysteryPos : changePos;
  const keys = posKeys(positions);
  const revName = step.revealTo != null ? symNameFromId(step.revealTo) : '?';

  showVfxBanner('Trojan Horse — packages dropping', 'trojan');
  featureStepToast(step, featId);
  clearVfxStage();
  const st = vfxStage();
  const pkgs = [];
  const targets = [];

  // 1) Drop encrypted packages onto cells
  for (const pos of positions) {
    if (isVfxSkip()) break;
    const p = stepPos(pos);
    if (!p) continue;
    const rc = cellRectInWrap(p.c, p.r);
    if (!rc) continue;
    const pkg = document.createElement('div');
    pkg.className = 'vfx-drop-pkg';
    pkg.style.left = rc.x + 'px';
    pkg.style.top = rc.y + 'px';
    pkg.textContent = '🐴';
    pkg.title = 'Encrypted';
    st?.appendChild(pkg);
    pkgs.push({ pkg, p, rc });
    targets.push({ p, rc });
    setCellMystery(p.c, p.r, true);
  }
  renderGrid();
  setVfxVignette(true);
  setVfxBloom('purple', true);
  await vfxWait(vfxMs(520, 200));

  // 2) Charge: purple code rain + pulse on mystery cells
  const canvas = prepVfxCanvas();
  let parts = [];
  if (canvas && targets.length && !isVfxSkip()) {
    await runAnimFrame(vfxMs(720, 260), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      for (const { rc } of targets) {
        drawRadialWash(canvas.ctx, rc.x, rc.y, 48 + t * 20, `rgba(170,68,255,${0.18 + t * 0.2})`);
        if (Math.random() < 0.55) {
          parts = parts.concat(burstParticles(
            canvas.ctx, rc.x + (Math.random() - 0.5) * rc.w * 0.6,
            rc.y - rc.h * 0.35, '#c080ff', vfxParticleN(2), 'code'
          ));
        }
      }
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  } else {
    await vfxWait(vfxMs(400, 140));
  }

  // 3) Crack: staggered shockwaves
  showVfxBanner(`Trojan Horse — decrypting…`, 'trojan');
  sfx('charge', { gain: 0.75 });
  for (let i = 0; i < pkgs.length; i++) {
    if (isVfxSkip()) break;
    const { pkg, rc } = pkgs[i];
    pkg.classList.add('boom');
    screenPunch('sm');
    if (canvas && rc) {
      await runAnimFrame(vfxMs(220, 80), (t) => {
        canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
        // keep lingering particles from prior cracks
        parts = drawParts(canvas.ctx, parts, 1 / 55);
        for (let j = 0; j <= i; j++) {
          const rrc = pkgs[j].rc;
          if (!rrc) continue;
          drawShockwave(canvas.ctx, rrc.x, rrc.y, t, [200, 80, 255], 70 + j * 8);
        }
        drawRadialWash(canvas.ctx, rc.x, rc.y, 60, 'rgba(255,255,255,0.12)');
      });
      parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#e0a0ff', vfxParticleN(8), 'code'));
    }
    await vfxWait(vfxMs(55, 20));
  }

  // 4) Hit-stop → mass reveal
  await hitStop(70);
  showVfxBanner(`Trojan Horse — reveal ${revName}`, 'trojan');
  sfx('hit', { gain: 1 });
  screenPunch('full');
  setVfxBloom('purple', true);

  if (canvas) {
    for (const { rc } of targets) {
      if (!rc) continue;
      parts = parts.concat(proBurst(canvas.ctx, rc.x, rc.y, {
        core: '#fff', mid: '#cc66ff', smoke: 'rgba(60,20,90,0.45)',
      }, 1.65));
      parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#e0a0ff', vfxParticleN(28), 'code'));
      parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#ffffff', vfxParticleN(14), 'star'));
    }
  }

  if (Array.isArray(step.changes) && step.changes.length) applyStepChanges(step.changes);
  else if (step.revealTo != null) {
    for (const pos of positions) {
      const p = stepPos(pos);
      if (p) {
        setCellSymbol(p.c, p.r, step.revealTo);
        setCellMystery(p.c, p.r, false);
      }
    }
  }
  for (const pos of positions) {
    const p = stepPos(pos);
    if (p) setCellMystery(p.c, p.r, false);
  }
  renderGrid();

  if (canvas) {
    await runAnimFrame(vfxMs(680, 240), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      for (const { rc } of targets) {
        if (rc) drawShockwave(canvas.ctx, rc.x, rc.y, Math.min(1, t * 1.2), [220, 120, 255], 100);
      }
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  }
  await highlightCells(keys, 'vfx-morph', vfxMs(320, 110));
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

async function presentVfxOverload(step, featId) {
  const cols = Array.isArray(step.columns) ? step.columns.map(Number) : [];
  showVfxBanner(
    cols.length ? `Data Overload — wild surge col ${cols.map(c => c + 1).join(', ')}` : 'Data Overload',
    'overload'
  );
  featureStepToast(step, featId);
  clearVfxStage();
  const canvas = prepVfxCanvas();
  setVfxBloom('orange', true);
  setVfxVignette(true);

  // Spark from existing wilds first
  let parts = [];
  if (canvas) {
    for (let c = 0; c < REELS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (state.grid[c][r] === 'W') {
          const rc = cellRectInWrap(c, r);
          if (rc) {
            cellEl(c, r)?.classList.add('vfx-wild-glow');
            boostWildSprite(1200);
            parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#ffcc44', vfxParticleN(14), 'spark'));
          }
        }
      }
    }
    await runAnimFrame(vfxMs(420, 150), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      for (const col of cols) {
        const rr = reelRectInWrap(col);
        if (!rr) continue;
        // column wash
        const g = canvas.ctx.createLinearGradient(rr.left, rr.top, rr.left + rr.w, rr.top);
        g.addColorStop(0, 'rgba(255,140,0,0)');
        g.addColorStop(0.5, `rgba(255,180,40,${0.18 + t * 0.15})`);
        g.addColorStop(1, 'rgba(255,140,0,0)');
        canvas.ctx.fillStyle = g;
        canvas.ctx.fillRect(rr.left, rr.top, rr.w, rr.h);
        drawElectricArc(canvas.ctx, rr.x, rr.top, rr.x, rr.top + rr.h, t * 6 + col, '#ffcc44');
        drawElectricArc(canvas.ctx, rr.x - 10, rr.top + 8, rr.x + 8, rr.top + rr.h - 6, t * 5 + col + 1, '#ff8800');
      }
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  }

  for (const col of cols) {
    document.getElementById(`reel-${col}`)?.classList.add('vfx-wild-col');
  }
  boostWildSprite(1800);

  if (Array.isArray(step.changes) && step.changes.length) {
    const byCol = new Map();
    for (const ch of step.changes) {
      const p = stepPos(ch?.pos);
      if (!p) continue;
      if (!byCol.has(p.c)) byCol.set(p.c, []);
      byCol.get(p.c).push(ch);
    }
    for (const [col, chs] of byCol) {
      if (isVfxSkip()) {
        applyStepChanges(chs);
        continue;
      }
      await hitStop(35);
      screenPunch('sm');
      applyStepChanges(chs);
      renderGrid();
      for (const ch of chs) {
        const p = stepPos(ch.pos);
        if (!p) continue;
        cellEl(p.c, p.r)?.classList.add('vfx-wild-glow');
        const rc = cellRectInWrap(p.c, p.r);
        if (canvas && rc) {
          parts = parts.concat(proBurst(canvas.ctx, rc.x, rc.y, {
            core: '#fff', mid: '#ffcc44', smoke: 'rgba(60,30,0,0.3)',
          }, 1.2));
        }
      }
      if (canvas) {
        const rr = reelRectInWrap(col);
        await runAnimFrame(vfxMs(280, 100), (t) => {
          canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
          if (rr) {
            drawShockwave(canvas.ctx, rr.x, rr.y, t, [255, 180, 40], 90);
            drawRadialWash(canvas.ctx, rr.x, rr.y, 70, `rgba(255,160,0,${0.2 * (1 - t)})`);
          }
          parts = drawParts(canvas.ctx, parts, 1 / 55);
        });
      } else {
        await sleepRaw(vfxMs(220, 80));
      }
    }
  } else {
    await sleepRaw(vfxMs(400, 140));
  }

  document.querySelectorAll('.vfx-wild-col').forEach(el => el.classList.remove('vfx-wild-col'));
  clearCellClasses(['vfx-wild-glow']);
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

async function presentVfxOverclock(step, featId) {
  const mult = Number(step.multiplier) || 1;
  const sym = step.targetSymbol != null ? symNameFromId(step.targetSymbol) : '?';
  showVfxBanner(`System Overclock — ${sym} ×${mult}`, 'overclock');
  featureStepToast(step, featId);
  clearVfxStage();

  const badge = document.getElementById('vfxCpuBadge');
  if (badge) {
    badge.textContent = `⚡ CPU ×${mult}`;
    badge.classList.add('show');
  }
  setVfxBloom('orange', true);
  setVfxVignette(true);
  await vfxFlash('orange', vfxMs(160, 55));
  // CPU heat charge
  const canvasCharge = prepVfxCanvas();
  if (canvasCharge && !isVfxSkip()) {
    await runAnimFrame(vfxMs(320, 110), (t) => {
      canvasCharge.ctx.clearRect(0, 0, canvasCharge.w, canvasCharge.h);
      drawRadialWash(
        canvasCharge.ctx, canvasCharge.w / 2, canvasCharge.h / 2,
        40 + t * 90, `rgba(255,120,0,${0.12 + t * 0.15})`
      );
      drawScanlines(canvasCharge.ctx, canvasCharge.w, canvasCharge.h, t, 0.06);
    });
  } else {
    await sleepRaw(vfxMs(200, 70));
  }

  const hit = [];
  const positions = Array.isArray(step.positions) ? step.positions : [];
  for (const pos of positions) {
    const p = stepPos(pos);
    if (!p) continue;
    setCellMultiplier(p.c, p.r, mult);
    hit.push(`${p.c},${p.r}`);
  }
  if (!hit.length && step.targetSymbol != null) {
    const key = SYM_MAP[step.targetSymbol];
    for (let c = 0; c < REELS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (state.grid[c][r] === key) {
          setCellMultiplier(c, r, mult);
          hit.push(`${c},${r}`);
        }
      }
    }
  }
  renderGrid();

  const st = vfxStage();
  const canvas = prepVfxCanvas();
  let parts = [];
  for (let i = 0; i < hit.length; i++) {
    if (isVfxSkip()) break;
    const k = hit[i];
    const [c, r] = k.split(',').map(Number);
    const rc = cellRectInWrap(c, r);
    if (!rc) continue;
    const stamp = document.createElement('div');
    stamp.className = 'vfx-stamp';
    stamp.textContent = `×${mult}`;
    stamp.style.left = rc.x - 18 + 'px';
    stamp.style.top = rc.y - 14 + 'px';
    st?.appendChild(stamp);
    cellEl(c, r)?.classList.add('vfx-mult', 'vfx-hit');
    screenPunch(i === 0 ? 'sm' : 'sm');
    if (canvas) {
      parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#ffaa44', vfxParticleN(14), 'star'));
      parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#ff8800', vfxParticleN(10), 'ember'));
      await runAnimFrame(vfxMs(140, 50), (t) => {
        canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
        drawShockwave(canvas.ctx, rc.x, rc.y, t, [255, 140, 0], 50);
        drawRadialWash(canvas.ctx, rc.x, rc.y, 36, `rgba(255,160,40,${0.3 * (1 - t)})`);
        // floating ×N ghost
        canvas.ctx.save();
        canvas.ctx.globalAlpha = 0.85 * (1 - t * 0.4);
        canvas.ctx.fillStyle = '#ffcc66';
        canvas.ctx.font = `bold ${18 + t * 10}px system-ui,sans-serif`;
        canvas.ctx.textAlign = 'center';
        canvas.ctx.shadowColor = '#ff8800';
        canvas.ctx.shadowBlur = 12;
        canvas.ctx.fillText(`×${mult}`, rc.x, rc.y - 10 - t * 24);
        canvas.ctx.restore();
        parts = drawParts(canvas.ctx, parts, 1 / 55);
      });
    } else {
      await sleepRaw(vfxMs(100, 35));
    }
  }
  if (canvas && parts.length) {
    await runAnimFrame(vfxMs(360, 120), () => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  } else {
    await sleepRaw(vfxMs(280, 100));
  }
  clearCellClasses(['vfx-mult', 'vfx-hit']);
  badge?.classList.remove('show');
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

async function presentVfxCloning(step, featId) {
  const sym = step.targetSymbol != null ? symNameFromId(step.targetSymbol) : 'symbols';
  showVfxBanner(`Data Cloning — ${sym} mitosis`, 'cloning');
  featureStepToast(step, featId);
  clearVfxStage();
  const st = vfxStage();
  const canvas = prepVfxCanvas();
  setVfxBloom('green', true);
  let parts = [];

  let keys = posKeys(step.positions);
  if (!keys.length && step.splitChanges) keys = posKeys(step.splitChanges.map(ch => ch.pos));

  for (const k of keys) {
    if (isVfxSkip()) break;
    const [c, r] = k.split(',').map(Number);
    const el = cellEl(c, r);
    el?.classList.add('vfx-shake');
    const rc = cellRectInWrap(c, r);
    if (rc && el) {
      const ghost = el.cloneNode(true);
      ghost.className = 'vfx-clone-ghost';
      ghost.style.left = rc.left + 'px';
      ghost.style.top = rc.top + 'px';
      ghost.style.width = rc.w + 'px';
      ghost.style.height = rc.h + 'px';
      st?.appendChild(ghost);
      if (canvas) {
        parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#00ff88', vfxParticleN(8), 'star'));
        await runAnimFrame(vfxMs(100, 35), (t) => {
          canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
          // dual ghost offsets
          drawRadialWash(canvas.ctx, rc.x - 12 * t, rc.y, 28, 'rgba(0,255,136,0.2)');
          drawRadialWash(canvas.ctx, rc.x + 12 * t, rc.y, 28, 'rgba(0,255,200,0.2)');
          drawShockwave(canvas.ctx, rc.x, rc.y, t * 0.7, [0, 255, 160], 36);
          parts = drawParts(canvas.ctx, parts, 1 / 55);
        });
      }
    }
    await vfxWait(vfxMs(40, 15));
  }
  await hitStop(45);
  screenPunch('sm');

  if (Array.isArray(step.splitChanges) && step.splitChanges.length) {
    await applySplitsAnimated(step.splitChanges);
  } else {
    for (const k of keys) {
      const [c, r] = k.split(',').map(Number);
      setCellSplit(c, r, 2);
    }
    renderGrid();
    await highlightCells(keys, 'vfx-split', vfxMs(420, 150));
  }
  clearCellClasses(['vfx-shake']);
  setVfxBloom(null, false);
  clearVfxStage();
  hideVfxBanner();
}

async function presentVfxRoot(step, featId) {
  let reels = Array.isArray(step.reels) ? step.reels.map(Number).filter(c => c >= 0 && c < REELS) : [];
  // Fallback: suy reel từ positions / splitChanges nếu server không gửi reels
  if (!reels.length) {
    const fromPos = new Set();
    for (const pos of (step.positions || [])) {
      const p = stepPos(pos);
      if (p) fromPos.add(p.c);
    }
    for (const ch of (step.splitChanges || [])) {
      const p = stepPos(ch?.pos);
      if (p) fromPos.add(p.c);
    }
    reels = [...fromPos];
  }
  const reelLabel = reels.length
    ? `reel ${reels.map(c => c + 1).join(', ')}`
    : 'reels';
  showVfxBanner(`Root Access — tách đôi ${reelLabel}`, 'root');
  featureStepToast(step, featId);
  clearVfxStage();
  const canvas = prepVfxCanvas();
  sfxForFeatureStart(featId);
  setVfxBloom('green', true);
  setVfxVignette(true);

  // Highlight target reels
  for (const col of reels) {
    document.getElementById(`reel-${col}`)?.classList.add('vfx-col-root');
  }

  // Matrix rain on target reels + column wash
  const drops = [];
  if (canvas && reels.length) {
    for (const col of reels) {
      const rr = reelRectInWrap(col);
      if (!rr) continue;
      for (let i = 0; i < 22; i++) {
        drops.push({
          x: rr.left + Math.random() * rr.w,
          y: rr.top - Math.random() * rr.h,
          speed: 100 + Math.random() * 200,
          chars: '01ROOTACCESS#$%'.split(''),
          maxY: rr.top + rr.h,
        });
      }
    }
    await runAnimFrame(vfxMs(820, 280), (t, ms) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      for (const col of reels) {
        const rr = reelRectInWrap(col);
        if (!rr) continue;
        const g = canvas.ctx.createLinearGradient(rr.left, rr.top, rr.left + rr.w, rr.top);
        g.addColorStop(0, 'rgba(0,255,136,0)');
        g.addColorStop(0.5, `rgba(0,255,136,${0.1 + t * 0.12})`);
        g.addColorStop(1, 'rgba(0,255,136,0)');
        canvas.ctx.fillStyle = g;
        canvas.ctx.fillRect(rr.left, rr.top, rr.w, rr.h);
      }
      canvas.ctx.font = 'bold 12px monospace';
      for (const d of drops) {
        d.y += d.speed * (1 / 55);
        if (d.y > d.maxY + 20) d.y = d.maxY - 120 - Math.random() * 40;
        for (let k = 0; k < 10; k++) {
          const yy = d.y - k * 12;
          canvas.ctx.fillStyle = k === 0
            ? 'rgba(200,255,230,0.98)'
            : `rgba(0,255,136,${Math.max(0.08, 0.65 - k * 0.06)})`;
          canvas.ctx.fillText(d.chars[(k + Math.floor(ms / 35)) % d.chars.length], d.x, yy);
        }
      }
    });
  } else {
    await sleepRaw(vfxMs(450, 160));
  }

  await hitStop(50);
  screenPunch('full');

  // Apply split → dual-symbol pop on each cell
  let keys = [];
  if (Array.isArray(step.splitChanges) && step.splitChanges.length) {
    keys = await applySplitsAnimated(step.splitChanges);
  } else if (Array.isArray(step.positions) && step.positions.length) {
    keys = posKeys(step.positions);
    for (const k of keys) {
      const [c, r] = k.split(',').map(Number);
      setCellSplit(c, r, 2);
    }
    renderGrid();
    // reuse animated split feel
    const fake = keys.map(k => {
      const [c, r] = k.split(',').map(Number);
      return { pos: [c, r], to: 2 };
    });
    await applySplitsAnimated(fake);
  } else if (reels.length) {
    // Last resort: split non-scatter cells on announced reels
    for (const c of reels) {
      for (let r = 0; r < ROWS; r++) {
        if (state.grid[c]?.[r] !== 'S') {
          setCellSplit(c, r, 2);
          keys.push(`${c},${r}`);
        }
      }
    }
    renderGrid();
    await highlightCells(keys, 'vfx-split', vfxMs(500, 180));
  }

  if (keys.length) sfxForFeatureHit(featId);
  showToast(
    `🌧️ Root Access: ${keys.length || '—'} ô tách đôi (×2 ways)`,
    '#00ff88'
  );

  document.querySelectorAll('.vfx-col-root').forEach(el => el.classList.remove('vfx-col-root'));
  if (canvas) canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

async function presentVfxSurge(step, featId) {
  const types = Array.isArray(step.convertedTypes)
    ? step.convertedTypes.map(symNameFromId).join(', ')
    : 'targets';
  showVfxBanner(`Power Surge — lightning · ${types}`, 'surge');
  featureStepToast(step, featId);
  clearVfxStage();
  const canvas = prepVfxCanvas();
  const st = vfxStage();
  let parts = [];
  setVfxBloom('yellow', true);
  setVfxVignette(true);

  const wildTargets = [];
  if (Array.isArray(step.changes)) {
    for (const ch of step.changes) {
      const p = stepPos(ch?.pos);
      if (p) wildTargets.push(p);
    }
  } else {
    for (const pos of step.positions || []) {
      const p = stepPos(pos);
      if (p) wildTargets.push(p);
    }
  }

  // Pre-charge sky flash
  if (canvas && !isVfxSkip()) {
    await runAnimFrame(vfxMs(280, 100), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      const g = canvas.ctx.createLinearGradient(0, 0, 0, canvas.h * 0.5);
      g.addColorStop(0, `rgba(255,255,180,${0.12 * t})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      canvas.ctx.fillStyle = g;
      canvas.ctx.fillRect(0, 0, canvas.w, canvas.h);
    });
  }

  // Lightning → convert each target
  for (let ti = 0; ti < wildTargets.length; ti++) {
    if (isVfxSkip()) break;
    const p = wildTargets[ti];
    const rc = cellRectInWrap(p.c, p.r);
    if (canvas && rc) {
      const seed = performance.now() * 0.001 + ti;
      await runAnimFrame(vfxMs(240, 85), (t) => {
        canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
        parts = drawParts(canvas.ctx, parts, 1 / 55);
        // main bolt top → cell + forks
        drawElectricArc(canvas.ctx, rc.x, 0, rc.x, rc.y, seed + t * 3, '#ffff66');
        drawElectricArc(canvas.ctx, rc.x - 18, 8, rc.x - 4, rc.y, seed + 1.7 + t, '#ffe088');
        drawElectricArc(canvas.ctx, rc.x + 16, 4, rc.x + 6, rc.y, seed + 2.9 + t, '#ffffaa');
        drawRadialWash(canvas.ctx, rc.x, rc.y, 40 + t * 30, `rgba(255,255,100,${0.2 + t * 0.25})`);
        drawShockwave(canvas.ctx, rc.x, rc.y, t * 0.85, [255, 255, 80], 55);
      });
      await hitStop(40);
      screenPunch(ti === 0 ? 'full' : 'sm');
      parts = parts.concat(proBurst(canvas.ctx, rc.x, rc.y, {
        core: '#ffffff', mid: '#ffff66', smoke: 'rgba(80,80,20,0.35)',
      }, 1.45));
      parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#ffe066', vfxParticleN(16), 'star'));
      parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#ffcc44', vfxParticleN(10), 'ember'));
    }
    const ch = (step.changes || []).find(x => {
      const q = stepPos(x.pos);
      return q && q.c === p.c && q.r === p.r;
    });
    if (ch) setCellSymbol(p.c, p.r, ch.to);
    else setCellSymbol(p.c, p.r, 11);
    renderGrid();
    {
      const el = cellEl(p.c, p.r);
      el?.classList.add('vfx-surge', 'vfx-wild-glow');
      if (el) setCellSymbolFx(el, 'surge');
      boostWildSprite(1400);
    }

    if (rc && st) {
      const ring = document.createElement('div');
      ring.className = 'vfx-shock-ring';
      ring.style.left = rc.x + 'px';
      ring.style.top = rc.y + 'px';
      st.appendChild(ring);
      const ring2 = document.createElement('div');
      ring2.className = 'vfx-shock-ring';
      ring2.style.left = rc.x + 'px';
      ring2.style.top = rc.y + 'px';
      ring2.style.animationDelay = '0.12s';
      st.appendChild(ring2);
    }
    await vfxWait(vfxMs(70, 25));
  }

  // Arc chain between converted cells (cinematic link)
  if (canvas && wildTargets.length >= 2 && !isVfxSkip()) {
    const pts = wildTargets.map(p => cellRectInWrap(p.c, p.r)).filter(Boolean);
    await runAnimFrame(vfxMs(420, 150), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      for (let i = 0; i < pts.length - 1; i++) {
        drawElectricArc(
          canvas.ctx, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y,
          t * 8 + i, i % 2 ? '#ffff88' : '#ffe060'
        );
      }
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  } else if (canvas && parts.length) {
    await runAnimFrame(vfxMs(400, 140), () => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  }

  if (Array.isArray(step.splitChanges) && step.splitChanges.length) {
    showVfxBanner('Power Surge — shockwave split', 'surge');
    screenPunch('sm');
    await applySplitsAnimated(step.splitChanges);
  }
  clearCellClasses(['vfx-surge', 'vfx-wild-glow']);
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

async function presentVfxGlitch(step, featId) {
  showVfxBanner('System Glitch — noise / reshuffle', 'glitch');
  featureStepToast(step, featId);
  clearVfxStage();
  const st = vfxStage();
  const bars = document.createElement('div');
  bars.className = 'vfx-glitch-bars on';
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('span');
    s.style.top = `${(i / 16) * 100 + Math.random() * 3}%`;
    s.style.animationDelay = `${Math.random() * 0.12}s`;
    bars.appendChild(s);
  }
  st?.appendChild(bars);

  const grid = document.getElementById('reelsGrid');
  grid?.classList.add('vfx-glitch-hard', 'vfx-glitch');
  setVfxBloom('purple', true);
  setVfxVignette(true);
  screenPunch('full');
  await vfxFlash('purple', vfxMs(180, 60));

  // Full-frame RGB split + scanlines storm
  const canvas = prepVfxCanvas();
  let parts = [];
  if (canvas && !isVfxSkip()) {
    await runAnimFrame(vfxMs(700, 260), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      drawRgbSplit(canvas.ctx, canvas.w, canvas.h, t, 8 + t * 6);
      drawScanlines(canvas.ctx, canvas.w, canvas.h, t, 0.16 + t * 0.08);
      if (Math.random() < 0.4) {
        parts = parts.concat(burstParticles(
          canvas.ctx,
          Math.random() * canvas.w,
          Math.random() * canvas.h,
          Math.random() > 0.5 ? '#aa44ff' : '#00f0ff',
          vfxParticleN(3),
          'code'
        ));
      }
      parts = drawParts(canvas.ctx, parts, 1 / 50);
    });
  } else {
    await vfxWait(vfxMs(480, 160));
  }

  // Morph cells one-by-one with local glitch pop
  const changes = Array.isArray(step.changes) ? step.changes : [];
  if (changes.length) {
    showVfxBanner('System Glitch — rewrite cells', 'glitch');
    for (let i = 0; i < changes.length; i++) {
      if (isVfxSkip()) {
        applyStepChanges(changes.slice(i));
        break;
      }
      const ch = changes[i];
      const p = stepPos(ch?.pos);
      if (!p) continue;
      if (ch.to != null) setCellSymbol(p.c, p.r, ch.to);
      setCellMystery(p.c, p.r, false);
      renderGrid();
      const el = cellEl(p.c, p.r);
      el?.classList.add('vfx-morph', 'vfx-hit');
      const rc = cellRectInWrap(p.c, p.r);
      if (canvas && rc) {
        await runAnimFrame(vfxMs(120, 45), (t) => {
          canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
          drawRgbSplit(canvas.ctx, canvas.w, canvas.h, t * 0.5 + i * 0.07, 5);
          drawScanlines(canvas.ctx, canvas.w, canvas.h, t + i * 0.1, 0.1);
          drawShockwave(canvas.ctx, rc.x, rc.y, t, [180, 80, 255], 48);
          parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#c080ff', vfxParticleN(4), 'code'));
          parts = drawParts(canvas.ctx, parts, 1 / 55);
        });
      } else {
        await vfxWait(vfxMs(90, 30));
      }
      el?.classList.remove('vfx-morph', 'vfx-hit');
    }
    if (step.splitChanges) applyStepSplitChanges(step.splitChanges);
    renderGrid();
    const keys = posKeys(changes.map(ch => ch.pos));
    await highlightCells(keys, 'vfx-morph', vfxMs(280, 100));
  } else if (step.splitChanges) {
    applyStepSplitChanges(step.splitChanges);
    renderGrid();
  }

  // Outro glitch flash
  if (canvas && !isVfxSkip()) {
    await hitStop(50);
    screenPunch('sm');
    await runAnimFrame(vfxMs(280, 100), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      drawRgbSplit(canvas.ctx, canvas.w, canvas.h, 1 - t, 10 * (1 - t));
      drawScanlines(canvas.ctx, canvas.w, canvas.h, t, 0.12 * (1 - t));
      parts = drawParts(canvas.ctx, parts, 1 / 50);
    });
  }

  grid?.classList.remove('vfx-glitch-hard', 'vfx-glitch');
  bars.classList.remove('on');
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

async function presentVfxScan(step, featId) {
  const types = Array.isArray(step.convertedTypes)
    ? step.convertedTypes.map(symNameFromId).join(', ')
    : 'targets';
  showVfxBanner(`Algorithmic Scan — lock ${types}`, 'scan');
  featureStepToast(step, featId);
  clearVfxStage();
  const canvas = prepVfxCanvas();
  setVfxVignette(true);

  let keys = posKeys(step.positions);
  if (!keys.length) keys = posKeys((step.changes || []).map(ch => ch.pos));
  const targets = keys.map(k => {
    const [c, r] = k.split(',').map(Number);
    return cellRectInWrap(c, r);
  }).filter(Boolean);

  // Radar sweeps then locks each target
  if (canvas) {
    const cx = canvas.w / 2;
    const cy = canvas.h / 2;
    setVfxBloom('cyan', true);
    let lockParts = [];
    await runAnimFrame(vfxMs(920, 320), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      drawScanlines(canvas.ctx, canvas.w, canvas.h, t, 0.07);
      const ang = t * Math.PI * 2.8;
      // radar fill wedge
      canvas.ctx.fillStyle = 'rgba(0,240,255,0.07)';
      canvas.ctx.beginPath();
      canvas.ctx.moveTo(cx, cy);
      canvas.ctx.arc(cx, cy, 150, ang - 0.5, ang);
      canvas.ctx.closePath();
      canvas.ctx.fill();
      canvas.ctx.strokeStyle = 'rgba(0,240,255,0.35)';
      canvas.ctx.lineWidth = 1;
      for (let i = 1; i <= 5; i++) {
        canvas.ctx.beginPath();
        canvas.ctx.arc(cx, cy, 26 * i + t * 14, 0, Math.PI * 2);
        canvas.ctx.stroke();
      }
      // sweep beam
      const grd = canvas.ctx.createLinearGradient(cx, cy, cx + Math.cos(ang) * 150, cy + Math.sin(ang) * 150);
      grd.addColorStop(0, 'rgba(0,240,255,0.95)');
      grd.addColorStop(1, 'rgba(0,240,255,0)');
      canvas.ctx.strokeStyle = grd;
      canvas.ctx.lineWidth = 3.5;
      canvas.ctx.shadowColor = '#00f0ff';
      canvas.ctx.shadowBlur = 12;
      canvas.ctx.beginPath();
      canvas.ctx.moveTo(cx, cy);
      canvas.ctx.lineTo(cx + Math.cos(ang) * 150, cy + Math.sin(ang) * 150);
      canvas.ctx.stroke();
      canvas.ctx.shadowBlur = 0;
      // progressive lock
      const showN = Math.floor(t * (targets.length + 0.99));
      for (let i = 0; i < showN && i < targets.length; i++) {
        const tg = targets[i];
        const pulse = 14 + Math.sin(t * 20 + i) * 3;
        const lockT = Math.min(1, (t * targets.length - i));
        canvas.ctx.strokeStyle = '#00f0ff';
        canvas.ctx.lineWidth = 2;
        canvas.ctx.shadowColor = '#00f0ff';
        canvas.ctx.shadowBlur = 12;
        canvas.ctx.beginPath();
        canvas.ctx.arc(tg.x, tg.y, pulse, 0, Math.PI * 2);
        canvas.ctx.stroke();
        canvas.ctx.beginPath();
        canvas.ctx.moveTo(tg.x - 24, tg.y);
        canvas.ctx.lineTo(tg.x + 24, tg.y);
        canvas.ctx.moveTo(tg.x, tg.y - 24);
        canvas.ctx.lineTo(tg.x, tg.y + 24);
        canvas.ctx.stroke();
        canvas.ctx.shadowBlur = 0;
        // corner brackets
        const s = 18;
        canvas.ctx.beginPath();
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([dx, dy]) => {
          const bx = tg.x + dx * s;
          const by = tg.y + dy * s;
          canvas.ctx.moveTo(bx, by + dy * -8);
          canvas.ctx.lineTo(bx, by);
          canvas.ctx.lineTo(bx + dx * -8, by);
        });
        canvas.ctx.stroke();
        if (lockT > 0.2 && Math.random() < 0.15) {
          lockParts = lockParts.concat(
            burstParticles(canvas.ctx, tg.x, tg.y, '#00f0ff', vfxParticleN(2), 'star')
          );
        }
        drawShockwave(canvas.ctx, tg.x, tg.y, Math.min(1, lockT * 0.8), [0, 240, 255], 36);
      }
      lockParts = drawParts(canvas.ctx, lockParts, 1 / 55);
    });
  }

  await hitStop(45);
  screenPunch('sm');

  if (keys.length) {
    await highlightCellsKeep(keys, 'vfx-lock', vfxMs(300, 100));
    clearCellClasses(['vfx-lock']);
  }
  if (Array.isArray(step.changes) && step.changes.length) {
    await morphChangesSequential(step.changes, 'vfx-morph', {
      canvas, rgb: [0, 240, 255], partColor: '#7dffff',
    });
  } else if (keys.length) {
    for (const k of keys) {
      const [c, r] = k.split(',').map(Number);
      setCellSymbol(c, r, 11);
    }
    renderGrid();
    if (canvas) {
      let parts = [];
      for (const k of keys) {
        const [c, r] = k.split(',').map(Number);
        const rc = cellRectInWrap(c, r);
        if (rc) {
          parts = parts.concat(proBurst(canvas.ctx, rc.x, rc.y, {
            core: '#fff', mid: '#00f0ff', smoke: 'rgba(0,40,60,0.3)',
          }, 1.15));
        }
      }
      await runAnimFrame(vfxMs(360, 120), (t) => {
        canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
        for (const k of keys) {
          const [c, r] = k.split(',').map(Number);
          const rc = cellRectInWrap(c, r);
          if (rc) drawShockwave(canvas.ctx, rc.x, rc.y, t, [0, 240, 255], 48);
        }
        parts = drawParts(canvas.ctx, parts, 1 / 55);
      });
    }
    await highlightCells(keys, 'vfx-hit', vfxMs(280, 95));
  }
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

async function presentVfxBandwidth(step, featId) {
  const mult = Number(step.multiplier) || 1;
  state.globalMultiplier = mult;
  showVfxBanner(`Bandwidth Multiplier — charging ×${mult}`, 'bandwidth');
  featureStepToast(step, featId);
  clearVfxStage();
  sfx('charge', { gain: 0.85, pitch: 0.95 });
  setVfxBloom('orange', true);
  setVfxVignette(true);

  const bar = document.getElementById('vfxBwBar');
  const fill = document.getElementById('vfxBwFill');
  const label = document.getElementById('vfxBwLabel');
  bar?.classList.add('show');
  label?.classList.add('show');
  if (fill) fill.style.width = '0%';
  if (label) label.textContent = '×01';

  // Tick through known mult marks for drama
  const marks = [3, 5, 8, 10].filter(m => m <= mult);
  if (!marks.includes(mult)) marks.push(mult);

  const canvas = prepVfxCanvas();
  let parts = [];
  const dur = vfxMs(980, 340);
  let lastMark = 0;
  await runAnimFrame(dur, (t) => {
    const eased = 1 - Math.pow(1 - t, 3);
    if (fill) fill.style.width = `${Math.round(eased * 100)}%`;
    const cur = Math.max(1, Math.round(1 + (mult - 1) * eased));
    if (label) label.textContent = `×${String(cur).padStart(2, '0')}`;
    if (cur !== lastMark && marks.includes(cur)) {
      lastMark = cur;
      sfx('tick', { gain: 0.4, pitch: 0.9 + cur * 0.05 });
    }
    if (canvas) {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      // vertical data beams
      for (let i = 0; i < 5; i++) {
        const x = (canvas.w * (i + 0.5)) / 5;
        const g = canvas.ctx.createLinearGradient(x, 0, x, canvas.h);
        g.addColorStop(0, 'rgba(255,140,0,0)');
        g.addColorStop(eased, `rgba(255,180,40,${0.12 + eased * 0.2})`);
        g.addColorStop(1, 'rgba(255,100,0,0)');
        canvas.ctx.fillStyle = g;
        canvas.ctx.fillRect(x - 6, 0, 12, canvas.h);
      }
      // rising energy from bottom
      const hy = canvas.h * (1 - eased);
      const hg = canvas.ctx.createLinearGradient(0, hy, 0, canvas.h);
      hg.addColorStop(0, 'rgba(255,160,0,0)');
      hg.addColorStop(1, `rgba(255,120,0,${0.2 * eased})`);
      canvas.ctx.fillStyle = hg;
      canvas.ctx.fillRect(0, hy, canvas.w, canvas.h - hy);
      // floating ×N
      canvas.ctx.save();
      canvas.ctx.globalAlpha = 0.35 + eased * 0.55;
      canvas.ctx.fillStyle = '#ffcc66';
      canvas.ctx.font = `bold ${28 + eased * 22}px system-ui,sans-serif`;
      canvas.ctx.textAlign = 'center';
      canvas.ctx.shadowColor = '#ff8800';
      canvas.ctx.shadowBlur = 18;
      canvas.ctx.fillText(`×${cur}`, canvas.w / 2, canvas.h * 0.42);
      canvas.ctx.restore();
      if (Math.random() < 0.35) {
        parts = parts.concat(burstParticles(
          canvas.ctx, Math.random() * canvas.w, canvas.h * (0.7 + Math.random() * 0.25),
          '#ffaa44', vfxParticleN(2), 'ember'
        ));
      }
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    }
  });

  if (label) label.textContent = `×${String(mult).padStart(2, '0')}`;
  const box = document.getElementById('multDisplay');
  if (box) {
    box.textContent = String(mult).padStart(2, '0');
    box.parentElement?.classList.remove('bump');
    void box.parentElement?.offsetWidth;
    box.parentElement?.classList.add('bump');
  }
  await hitStop(60);
  screenPunch(mult >= 8 ? 'full' : 'sm');
  if (canvas) {
    parts = parts.concat(proBurst(canvas.ctx, canvas.w / 2, canvas.h * 0.42, {
      core: '#fff', mid: '#ff8800', smoke: 'rgba(60,30,0,0.3)',
    }, 1.5));
    await runAnimFrame(vfxMs(480, 160), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      drawShockwave(canvas.ctx, canvas.w / 2, canvas.h * 0.42, t, [255, 160, 0], 130);
      canvas.ctx.save();
      canvas.ctx.globalAlpha = 1 - t * 0.5;
      canvas.ctx.fillStyle = '#ffe088';
      canvas.ctx.font = `bold ${42 + t * 18}px system-ui,sans-serif`;
      canvas.ctx.textAlign = 'center';
      canvas.ctx.shadowColor = '#ff8800';
      canvas.ctx.shadowBlur = 22;
      canvas.ctx.fillText(`×${mult}`, canvas.w / 2, canvas.h * 0.42 - t * 20);
      canvas.ctx.restore();
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  }
  await vfxFlash('orange', vfxMs(180, 60));
  await sleepRaw(vfxMs(180, 60));
  bar?.classList.remove('show');
  label?.classList.remove('show');
  if (fill) fill.style.width = '0%';
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

async function presentVfxBypass(step, featId) {
  state.bypassProtocol = true;
  showVfxBanner('Bypass Protocol — dual data flow', 'bypass');
  featureStepToast(step, featId);
  clearVfxStage();
  const arrows = document.getElementById('vfxBypassArrows');
  arrows?.classList.add('show');
  setVfxBloom('cyan', true);
  setVfxVignette(true);
  const canvas = prepVfxCanvas();
  let parts = [];
  if (canvas) {
    await runAnimFrame(vfxMs(1000, 360), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      const midY = canvas.h / 2;
      // dual highway glow
      const g1 = canvas.ctx.createLinearGradient(0, midY - 40, 0, midY);
      g1.addColorStop(0, 'rgba(0,240,255,0)');
      g1.addColorStop(1, 'rgba(0,240,255,0.12)');
      canvas.ctx.fillStyle = g1;
      canvas.ctx.fillRect(0, midY - 40, canvas.w, 40);
      const g2 = canvas.ctx.createLinearGradient(0, midY, 0, midY + 40);
      g2.addColorStop(0, 'rgba(0,255,180,0.12)');
      g2.addColorStop(1, 'rgba(0,255,180,0)');
      canvas.ctx.fillStyle = g2;
      canvas.ctx.fillRect(0, midY, canvas.w, 40);

      // flowing packets L→R and R→L denser
      for (let i = 0; i < 14; i++) {
        const phase = (t * 2.2 + i * 0.08) % 1;
        const x1 = phase * canvas.w;
        const x2 = (1 - phase) * canvas.w;
        const a = 0.35 + 0.55 * Math.sin(phase * Math.PI);
        canvas.ctx.fillStyle = `rgba(0,240,255,${a})`;
        canvas.ctx.shadowColor = '#00f0ff';
        canvas.ctx.shadowBlur = 10;
        canvas.ctx.beginPath();
        canvas.ctx.arc(x1, midY - 18, 3.5 + (i % 3), 0, Math.PI * 2);
        canvas.ctx.fill();
        canvas.ctx.fillStyle = `rgba(0,255,180,${a})`;
        canvas.ctx.shadowColor = '#00ffb0';
        canvas.ctx.beginPath();
        canvas.ctx.arc(x2, midY + 18, 3.5 + (i % 3), 0, Math.PI * 2);
        canvas.ctx.fill();
        canvas.ctx.shadowBlur = 0;
      }
      // dashed dual lanes
      canvas.ctx.strokeStyle = 'rgba(0,240,255,0.4)';
      canvas.ctx.setLineDash([8, 10]);
      canvas.ctx.lineWidth = 2;
      canvas.ctx.beginPath();
      canvas.ctx.moveTo(10, midY - 18);
      canvas.ctx.lineTo(canvas.w - 10, midY - 18);
      canvas.ctx.stroke();
      canvas.ctx.strokeStyle = 'rgba(0,255,180,0.4)';
      canvas.ctx.beginPath();
      canvas.ctx.moveTo(10, midY + 18);
      canvas.ctx.lineTo(canvas.w - 10, midY + 18);
      canvas.ctx.stroke();
      canvas.ctx.setLineDash([]);

      // endpoint shockwaves when packets "arrive"
      if (t > 0.15) {
        drawShockwave(canvas.ctx, canvas.w - 20, midY - 18, (t * 3) % 1, [0, 240, 255], 40);
        drawShockwave(canvas.ctx, 20, midY + 18, ((t * 3) + 0.5) % 1, [0, 255, 180], 40);
      }
      if (Math.random() < 0.25) {
        parts = parts.concat(burstParticles(
          canvas.ctx, Math.random() * canvas.w, midY + (Math.random() > 0.5 ? -18 : 18),
          Math.random() > 0.5 ? '#00f0ff' : '#00ffb0', vfxParticleN(2), 'star'
        ));
      }
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
    await hitStop(40);
    screenPunch('sm');
    // final dual pulse
    await runAnimFrame(vfxMs(320, 110), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      drawShockwave(canvas.ctx, canvas.w * 0.25, canvas.h / 2, t, [0, 240, 255], 100);
      drawShockwave(canvas.ctx, canvas.w * 0.75, canvas.h / 2, t, [0, 255, 180], 100);
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  } else {
    await sleepRaw(vfxMs(750, 260));
  }
  arrows?.classList.remove('show');
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

async function presentVfxGeneric(step, featId) {
  showVfxBanner(step?.name || featId || 'Feature', featId || '');
  featureStepToast(step, featId);
  await vfxFlash('', vfxMs(150, 50));
  const hitSym = applyStepChanges(step.changes);
  const hitSplit = applyStepSplitChanges(step.splitChanges);
  renderGrid();
  if (hitSym.length) await highlightCells(hitSym, 'vfx-hit', vfxMs(420, 140));
  if (hitSplit.length) await highlightCells(hitSplit, 'vfx-split', vfxMs(380, 130));
  if (!hitSym.length && !hitSplit.length) await sleepRaw(vfxMs(320, 110));
  hideVfxBanner();
}

const ONLINE_FEATURE_VFX = {
  firewall: presentVfxFirewall,
  decrypt: presentVfxDecrypt,
  trojan: presentVfxTrojan,
  overload: presentVfxOverload,
  overclock: presentVfxOverclock,
  cloning: presentVfxCloning,
  root: presentVfxRoot,
  surge: presentVfxSurge,
  glitch: presentVfxGlitch,
  scan: presentVfxScan,
  bandwidth: presentVfxBandwidth,
  bypass: presentVfxBypass,
};

/** Áp data step không animation (khi Skip) */
function applyFeatureStepDataOnly(step) {
  if (!step) return;
  const featId = mapServerFeatureName(step.name) || '';
  if (Array.isArray(step.changes)) applyStepChanges(step.changes);
  if (Array.isArray(step.splitChanges)) applyStepSplitChanges(step.splitChanges);
  if (featId === 'overclock') {
    const mult = Number(step.multiplier) || 1;
    for (const pos of step.positions || []) {
      const p = stepPos(pos);
      if (p) setCellMultiplier(p.c, p.r, mult);
    }
  }
  if (featId === 'bandwidth') {
    state.globalMultiplier = Number(step.multiplier) || state.globalMultiplier || 1;
  }
  if (featId === 'bypass') state.bypassProtocol = true;
  if (featId === 'trojan' && step.revealTo != null && !step.changes?.length) {
    for (const pos of step.mysteryPositions || []) {
      const p = stepPos(pos);
      if (p) {
        setCellSymbol(p.c, p.r, step.revealTo);
        setCellMystery(p.c, p.r, false);
      }
    }
  }
}

/**
 * Apply ONE featureSteps[] entry with PRO beat:
 * fly icon → intro/explain → scene → hit settle.
 */
async function applyFeatureStep(step, opts = {}) {
  if (!step || !step.name) return;
  if (isVfxSkip()) {
    applyFeatureStepDataOnly(step);
    renderGrid();
    return;
  }
  const featId = mapServerFeatureName(step.name) || String(step.name).toLowerCase();
  const beat = VFX_BEAT[featId] || { settle: 120 };
  const bloom = VFX_BLOOM_COLOR[featId] || 'cyan';

  setMeterStepActive(featId);
  renderFeatureMeter((state.triggeredFeatures || []).map(f => f.id));
  setMeterStepActive(featId);

  // Transition: icon bay từ meter
  if (!(featId === 'firewall' && opts.firewallAnnounced)) {
    await flyFeatureIconFromMeter(featId);
  }
  if (isVfxSkip()) {
    applyFeatureStepDataOnly(step);
    renderGrid();
    return;
  }

  // Explain 📖 hoặc intro ngắn
  if (state.featureExplain) {
    await playFeatureExplainBeat(featId, step);
  } else {
    const skipIntro = featId === 'firewall' && opts.firewallAnnounced;
    if (!skipIntro) {
      await playFeatureIntro(featId);
    } else {
      const badge = document.querySelector(`#featureMeter .feat-badge[data-feature-id="${featId}"]`);
      badge?.classList.add('vfx-active', 'vfx-charge');
      setVfxVignette(true);
      await vfxWait(vfxMs(120, 40));
    }
  }
  if (isVfxSkip()) {
    applyFeatureStepDataOnly(step);
    renderGrid();
    clearVfxStage();
    return;
  }

  const presenter = ONLINE_FEATURE_VFX[featId] || presentVfxGeneric;
  try {
    if (!isVfxSkip()) sfxForFeatureStart(featId);
    await presenter(step, featId, opts);
    if (!isVfxSkip()) {
      sfxForFeatureHit(featId);
      await vfxHitImpact(
        ['firewall', 'trojan', 'surge', 'scan', 'bandwidth'].includes(featId) ? 'full' : 'sm',
        bloom
      );
    }
  } finally {
    hideVfxBanner();
    setVfxVignette(false);
    clearVfxStage();
    document.getElementById('reelsGrid')?.classList.remove('vfx-glitch', 'vfx-glitch-hard');
    clearCellClasses([
      'vfx-hit', 'vfx-split', 'vfx-mult', 'vfx-morph', 'vfx-decrypt',
      'vfx-lock', 'vfx-surge', 'vfx-firewall', 'scrub', 'vfx-shake',
      'vfx-wild-glow',
    ]);
  }
  await vfxWait(vfxMs(beat.settle || 120, 40));
}

/**
 * Play full featureSteps chain after reels land on baseScreen.
 */
async function presentFeatureSteps(featureSteps, opts = {}) {
  if (!Array.isArray(featureSteps) || !featureSteps.length) return false;
  resetVfxSkip();
  setSkipBarVisible(true);
  setVfxVignette(true);
  showVfxBanner(
    `⚡ KÍCH HOẠT ${featureSteps.length} FEATURE`,
    ''
  );
  await vfxWait(vfxMs(320, 100));
  hideVfxBanner();
  setVfxVignette(false);

  try {
    for (let i = 0; i < featureSteps.length; i++) {
      if (isVfxSkip()) {
        for (let j = i; j < featureSteps.length; j++) {
          applyFeatureStepDataOnly(featureSteps[j]);
        }
        renderGrid();
        break;
      }
      await applyFeatureStep(featureSteps[i], {
        ...opts,
        stepIndex: i,
        stepTotal: featureSteps.length,
      });
    }
  } finally {
    setSkipBarVisible(false);
    clearMeterStepActive();
    hideFeatureIntro(true);
    hideFeatureExplain(true);
  }
  return true;
}

function snapshotBoard() {
  return {
    grid: (state.grid || []).map(col => (Array.isArray(col) ? col.slice() : [])),
    cellMeta: (state.cellMeta || []).map(col =>
      (Array.isArray(col) ? col.map(m => ({ split: !!m?.split, multiplier: m?.multiplier || 1, mystery: !!m?.mystery })) : [])
    ),
    globalMultiplier: state.globalMultiplier || 1,
    bypassProtocol: !!state.bypassProtocol,
    blockedSymbols: [...(state.blockedSymbols || [])],
  };
}

function gridToServerScreen(grid) {
  if (!Array.isArray(grid) || grid.length !== REELS) return null;
  return grid.map(col => (Array.isArray(col) ? col.map(s => SYM_TO_ID[s] ?? 6) : []));
}

function cellMetaToSplitCounts(meta) {
  if (!Array.isArray(meta) || meta.length !== REELS) return null;
  return meta.map(col => (Array.isArray(col) ? col.map(m => (m?.split ? 2 : 1)) : []));
}

function cellMetaToMultMap(meta) {
  if (!Array.isArray(meta)) return null;
  const map = {};
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const m = Number(meta[c]?.[r]?.multiplier) || 1;
      if (m > 1) map[`${r},${c}`] = m;
    }
  }
  return Object.keys(map).length ? map : null;
}

function clientToServerFeatureName(id) {
  for (const [name, cid] of Object.entries(SERVER_FEATURE_MAP)) {
    if (cid === id) return name;
  }
  return id;
}

function diffBoardsToStep(feat, before, after) {
  const changes = [];
  const splitChanges = [];
  const positions = [];
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const pos = [c, r];
      const bg = before.grid[c]?.[r];
      const ag = after.grid[c]?.[r];
      const bm = before.cellMeta[c]?.[r] || {};
      const am = after.cellMeta[c]?.[r] || {};
      if (bg !== ag && ag != null) changes.push({ pos, to: SYM_TO_ID[ag] ?? ag });
      if (!bm.split && am.split) splitChanges.push({ pos, to: 2 });
      if ((am.multiplier || 1) > 1 && am.multiplier !== bm.multiplier) positions.push(pos);
    }
  }
  const step = {
    name: clientToServerFeatureName(feat.id),
    changes,
    splitChanges,
  };
  if (feat.id === 'firewall') {
    step.bannedLows = (after.blockedSymbols || []).map(s => SYM_TO_ID[s]).filter(n => n != null);
  }
  if (feat.id === 'trojan' && changes.length) {
    step.revealTo = changes[0].to;
    step.mysteryPositions = changes.map(ch => ch.pos);
  }
  if (feat.id === 'overclock') {
    step.positions = positions;
    const sample = positions[0];
    step.multiplier = sample
      ? (after.cellMeta[sample[0]]?.[sample[1]]?.multiplier || 1)
      : 1;
  }
  if (feat.id === 'bandwidth') step.multiplier = after.globalMultiplier || 1;
  if (feat.id === 'overload') {
    const cols = [];
    for (let c = 0; c < REELS; c++) {
      const nowWild = after.grid[c]?.every(s => s === 'W');
      const wasWild = before.grid[c]?.every(s => s === 'W');
      if (nowWild && !wasWild) cols.push(c);
    }
    step.columns = cols;
  }
  if (feat.id === 'root') {
    const reels = [];
    for (let c = 0; c < REELS; c++) {
      let newly = 0;
      for (let r = 0; r < ROWS; r++) {
        if (after.cellMeta[c]?.[r]?.split && !before.cellMeta[c]?.[r]?.split) newly++;
      }
      if (newly >= 2) reels.push(c);
    }
    step.reels = reels;
  }
  return step;
}

function captureLastFeatureReplay(pack) {
  const steps = Array.isArray(pack?.featureSteps) ? pack.featureSteps.filter(s => s && s.name) : [];
  if (!steps.length) {
    state.lastFeatureReplay = null;
    return;
  }
  let cloned;
  try {
    cloned = JSON.parse(JSON.stringify(steps));
  } catch (_) {
    cloned = steps.slice();
  }
  state.lastFeatureReplay = {
    featureSteps: cloned,
    featObjs: pack.featObjs || [],
    baseScreen: pack.baseScreen || null,
    finalScreen: pack.finalScreen || null,
    splitCounts: pack.splitCounts || null,
    cellMultipliers: pack.cellMultipliers || null,
    finalGlobalMult: pack.finalGlobalMult ?? state.globalMultiplier ?? 1,
    finalBypass: pack.finalBypass ?? !!state.bypassProtocol,
    finalBoard: pack.finalBoard || snapshotBoard(),
  };
}

function lastReplayMeterIds() {
  const pack = state.lastFeatureReplay;
  if (!pack) {
    return [
      ...(state.inFreeSpins ? (state.persistentFeatures || []).map(f => f.id) : []),
      ...(state.triggeredFeatures || []).map(f => f.id),
    ].filter((id, i, a) => a.indexOf(id) === i);
  }
  const ids = [
    ...(pack.featObjs || []).map(f => f.id),
    ...(pack.featureSteps || []).map(s => mapServerFeatureName(s?.name)).filter(Boolean),
  ];
  if (state.inFreeSpins) ids.push(...(state.persistentFeatures || []).map(f => f.id));
  return ids.filter((id, i, a) => a.indexOf(id) === i);
}

function renderLastSpinFeatureMeter() {
  renderFeatureMeter(lastReplayMeterIds());
}

function findReplayStepIndex(featId) {
  const steps = state.lastFeatureReplay?.featureSteps;
  if (!steps?.length || !featId) return -1;
  return steps.findIndex(s => mapServerFeatureName(s?.name) === featId);
}

function replayHoldReason() {
  if (state.spinning || state.fxPlaying) return 'Đợi spin / VFX xong rồi replay';
  if ((state.autoSpins || 0) > 0) return 'Tắt Autospin để replay feature';
  if (state.inFreeSpins && state.fsRemaining > 0 && !isEditFsGridOn()) {
    return 'Bật Edit Grid (pause FS) hoặc đợi hết Free Spins để replay';
  }
  return '';
}

function canReplayFeature(featId) {
  return !replayHoldReason() && findReplayStepIndex(featId) >= 0;
}

function restoreReplayBeforeStep(stepIndex) {
  const pack = state.lastFeatureReplay;
  if (!pack) return false;
  state.globalMultiplier = 1;
  state.bypassProtocol = false;
  const land = pack.baseScreen || pack.finalScreen;
  if (land) applyServerScreen(land, null);
  else if (pack.finalBoard) {
    state.grid = pack.finalBoard.grid.map(col => col.slice());
    state.cellMeta = pack.finalBoard.cellMeta.map(col => col.map(m => ({ ...m })));
  }
  for (let i = 0; i < stepIndex; i++) applyFeatureStepDataOnly(pack.featureSteps[i]);
  const box = document.getElementById('multDisplay');
  if (box) box.textContent = String(state.globalMultiplier || 1).padStart(2, '0');
  renderGrid();
  return true;
}

async function replayLastFeature(featId) {
  const hold = replayHoldReason();
  if (hold) {
    showToast(hold, '#ff8800');
    return;
  }
  const idx = findReplayStepIndex(featId);
  if (idx < 0) {
    showFeatureDetail(featId);
    return;
  }
  const pack = state.lastFeatureReplay;
  const step = pack.featureSteps[idx];
  const f = FEATURES.find(x => x.id === featId);
  closeModal('modalFeatureDetail');
  resetVfxSkip();
  setSkipBarVisible(true);
  beginFx();
  try {
    restoreReplayBeforeStep(idx);
    renderFeatureMeter(lastReplayMeterIds());
    showToast(`▶ Replay: ${f?.name || featId}`, f?.color || 'var(--cyan)');
    await applyFeatureStep(step, {
      firewallAnnounced: false,
      stepIndex: idx,
      stepTotal: pack.featureSteps.length,
      isReplay: true,
    });
  } finally {
    setSkipBarVisible(false);
    clearMeterStepActive();
    hideFeatureIntro(true);
    hideFeatureExplain(true);
    hideVfxBanner();
    clearVfxStage();
    setVfxVignette(false);
    endFx();
    renderLastSpinFeatureMeter();
  }
}

/** Map server screen matrix → client symbol keys for animateReelSpin */
function screenToForcedResults(screen) {
  if (!Array.isArray(screen) || screen.length !== REELS) return null;
  return screen.map(col => {
    if (!Array.isArray(col)) return Array(ROWS).fill('A');
    return col.map(num => SYM_MAP[num] || 'A');
  });
}

function setConnState(state, msg) {
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

function sendWS(data) {
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

function wsInit() {
  const agentId = resolveSessionAgencyId();
  return sendWS([1, "MiniGame", "", "", { agentId, accessToken, reconnect: false }]);
}

/** Prefer stored session → input → hostname from srvUrl (agency001.xxx → agency001). */
function resolveSessionAgencyId() {
  const fromInput = document.getElementById('cheatAgencyId')?.value?.trim();
  if (sessionAgencyId) return sessionAgencyId;
  if (fromInput) return fromInput;
  return deriveAgencyFromSrvUrl() || 'AGENCY_001';
}

function resolveSessionUserId() {
  const fromInput = document.getElementById('cheatUserId')?.value?.trim();
  if (sessionUserId) return sessionUserId;
  if (fromInput) return fromInput;
  if (sessionUsername) return sessionUsername;
  return document.getElementById('loginUser')?.value?.trim() || '';
}

function deriveAgencyFromSrvUrl() {
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
function captureSessionIdentity(src, { force = false } = {}) {
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
  if (agency && (force || !sessionAgencyId)) sessionAgencyId = String(agency);
  if (userId && (force || !sessionUserId)) sessionUserId = String(userId);
  if (username && (force || !sessionUsername)) sessionUsername = String(username);
}

function syncCheatSessionFields() {
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

function wsJoin() {
  const gid = document.getElementById('gameId').value;
  return sendWS([6, "MiniGame", gid, { cmd: "1005" }]);
}

function wsSpin(bet) {
  const gid = document.getElementById('gameId').value;
  return sendWS([6, "MiniGame", gid, { cmd: "1500", bet: bet.toString() }]);
}

function wsGetBalance() {
  const gid = document.getElementById('gameId').value;
  return sendWS([6, "MiniGame", gid, { cmd: "1503" }]);
}

/** LAST_SESSION (1502) — same shape as init; backup resume after JOIN */
function wsLastSession() {
  const gid = document.getElementById('gameId').value;
  return sendWS([6, 'MiniGame', gid, { cmd: '1502' }]);
}

/**
 * BUY_FEATURE (cmd 1501) — be-zero-day PluginCommand.BUY_FEATURE
 * feature: FS1–FS4 | scatterBooster | 3Features | 12Features
 * Response = full spin result (type result).
 */
function wsBuyFeature(feature, bet) {
  const gid = document.getElementById('gameId').value;
  return sendWS([6, "MiniGame", gid, {
    cmd: "1501",
    bet: String(bet),
    feature: String(feature),
  }]);
}

function connectWS() {
  if (ws) { ws.close(); ws = null; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  const url = document.getElementById('wsUrl').value;
  setConnState('connecting', 'Connecting...');

  ws = new WebSocket(url);

  ws.onopen = () => {
    setConnState('connected', 'Authenticating...');
    wsInit();
    if (pingTimer) clearInterval(pingTimer);
    pingSeq = 0;
    pingTimer = setInterval(() => {
      sendWS(["7", "MiniGame", "1", ++pingSeq]);
    }, 15000);
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
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    ws = null;
    if (pendingSpinResolve) {
      pendingSpinResolve(false);
      pendingSpinResolve = null;
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

function handleWSMessage(msg) {
  if (!Array.isArray(msg) || msg.length < 2) return;

  const type = msg[0];

  // Auth response: [1, true, 0, sessionId, zone, null]
  if (type === 1 && msg[1] === true) {
    wsSessionId = msg[3] || '';
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
      if (pendingSpinResolve) { pendingSpinResolve(false); pendingSpinResolve = null; }
      // Fail any waiting cmd (history/detail/etc.)
      if (cmd) resolvePendingCmd(cmd, null);
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

      case '1999': // CHEAT (dev/staging)
        resolvePendingCmd('1999', payload);
        break;

      case '1531': // BALANCE_UPDATED push
        applyOnlineBalance(payload, { syncBefore: !state.spinning });
        break;
    }
  }
}

function handleSpinResponse(payload) {
  const parsed = parseOnlineRound(payload);
  if (!parsed.screen || !Array.isArray(parsed.screen) || parsed.screen.length !== REELS) {
    if (pendingSpinResolve) { pendingSpinResolve(false); pendingSpinResolve = null; }
    return;
  }

  // Lưu IN SPIN làm nguồn authoritative cho panel giải thích win
  captureLastInSpin(payload, payload);

  // Không sync BEFORE — giữ snapshot lúc bấm spin (trước kết quả)
  applyOnlineBalance(payload, { syncBefore: false });
  pendingSpinData = { payload, ...parsed };

  if (pendingSpinResolve) {
    pendingSpinResolve(true);
    pendingSpinResolve = null;
  }
}

/**
 * Online spin / buy feature.
 * @param {{ buyFeature?: string, buyCostHint?: number }} opts
 *   buyFeature: FS1–FS4 | scatterBooster | 3Features | 12Features → cmd 1501
 */
async function doOnlineSpin(opts = {}) {
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

  pendingSpinData = null;
  if (isBuy) {
    wsBuyFeature(buyFeature, bet);
  } else {
    wsSpin(bet);
  }

  const ok = await new Promise(resolve => {
    pendingSpinResolve = resolve;
    setTimeout(() => {
      if (pendingSpinResolve) {
        pendingSpinResolve(false);
        pendingSpinResolve = null;
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

    // 5b) Core Hack jackpot — pick-and-click VFX (win đã nằm trong totalWin)
    if (jpOn) {
      await playJackpot(jp);
    }

    // Balance từ server
    if (control?.balance != null && control.balance !== '') {
      onlineBalance = parseFloat(control.balance);
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

// ─── Override doSpin for online mode ──────────────────────────
const origDoSpin = doSpin;
doSpin = async function(forcedScatters = 0) {
  if (online) return await doOnlineSpin();
  return await origDoSpin.apply(this, arguments);
};

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
    sessionUsername = username;
    captureSessionIdentity(loginData, { force: true });
    captureSessionIdentity(loginData.user || loginData.data || {}, { force: false });
    if (!sessionUserId) sessionUserId = String(loginData.userId || loginData.uid || username || '');
    if (!sessionAgencyId) sessionAgencyId = deriveAgencyFromSrvUrl();

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
    accessToken = playData.token;
    captureSessionIdentity(playData, { force: false });
    captureSessionIdentity(playData.data || {}, { force: false });
    if (!sessionAgencyId) sessionAgencyId = deriveAgencyFromSrvUrl();
    syncCheatSessionFields();

    // 3) Start UI + connect WebSocket với accessToken
    online = true;
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
  online = false;
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

function isLoginVisible() {
  const el = document.getElementById('loginOverlay');
  return !!(el && el.style.display !== 'none');
}

function isTypingTarget(el) {
  if (!el || el === document.body || el === document.documentElement) return false;
  const tag = (el.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

window.addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === 'Enter') {
    if (!isLoginVisible()) return;
    if (e.target && e.target.id === 'btnPlayOffline') return;
    if (e.target && e.target.id === 'btnPlayOnline') return;
    const btn = document.getElementById('btnPlayOnline');
    if (!btn || btn.disabled) return;
    e.preventDefault();
    btn.click();
    return;
  }

  if (e.key === ' ' || e.code === 'Space') {
    if (isLoginVisible()) return;
    if (isTypingTarget(e.target)) return;
    const splash = document.getElementById('splash');
    if (splash && !splash.classList.contains('hidden')) return;
    if (isFsGridEditorOpen()) {
      e.preventDefault();
      applyFsGridAndSpin();
      return;
    }
    if (document.querySelector('.modal-overlay.open')) return;
    const btn = document.getElementById('btnSpin');
    if (!btn || btn.disabled) return;
    e.preventDefault();
    btn.click();
  }
});

// ═══════════════════════════════════════════════════════════════
// CHEAT / DEBUG PANEL — WS cmd 1999 + REST /debug/cheat
// ═══════════════════════════════════════════════════════════════

const CHEAT_CODES = [
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
const CHEAT_IMMEDIATE = new Set([
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

const CHEAT_SYM_OPTS = [
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

const CHEAT_FEATURE_NAMES = [
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
const CHEAT_PRESETS = [
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
  { group: 'Features', code: 'FORCE_POWER_SURGE', label: 'Surge', value: { convertedTypes: [1, 6] } },
  { group: 'Features', code: 'FORCE_SYSTEM_GLITCH', label: 'Glitch', value: { protectWinning: true } },
  { group: 'Features', code: 'FORCE_ALGORITHMIC_SCAN', label: 'Scan', value: { convertedTypes: [8] } },
  { group: 'Features', code: 'FORCE_BANDWIDTH_MULTIPLIER', label: 'Bandwidth', value: { multiplier: 10 } },
  { group: 'Features', code: 'FORCE_BYPASS_PROTOCOL', label: 'Bypass', value: {} },
  { group: 'Session', code: 'FORCE_LAST_FREE_SPIN', label: 'Last FS = 1', value: { game_id: 'yama_01023' } },
  { group: 'Session', code: 'SET_GAME_MODE', label: 'Enter free', value: { mode: 'free', bet: 1, game_id: 'yama_01023' } },
  { group: 'Session', code: 'RESET_SESSION', label: 'Reset session', value: { game_id: 'yama_01023' } },
  { group: 'Session', code: 'CLEAR_AGENT_STATE', label: 'Clear state', value: { game_id: 'yama_01023' } },
];

const CHEAT_CODE_GROUP = {
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

let cheatPanelBuilt = false;

function initCheatPanel() {
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

function openCheatPanel() {
  initCheatPanel();
  if (!sessionAgencyId) sessionAgencyId = deriveAgencyFromSrvUrl();
  if (!sessionUserId) {
    sessionUserId = sessionUsername || document.getElementById('loginUser')?.value || '';
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
}

function setCheatLog(text, kind) {
  const el = document.getElementById('cheatLog');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('ok', 'err');
  if (kind === 'ok') el.classList.add('ok');
  if (kind === 'err') el.classList.add('err');
}

function saveCheatPrefs() {
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
let editFsGridEnabled = false;
let fsGridBusy = false;
let pendingLocalForceGrid = null;
let pendingLocalForceFeatures = null;

function isEditFsGridOn() {
  return !!editFsGridEnabled;
}

function isFsGridEditorOpen() {
  return !!document.getElementById('modalFsGrid')?.classList.contains('open');
}

function setEditFsGridEnabled(on, opts = {}) {
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

function syncEditFsGridChip() {
  document.getElementById('btnFsEditGrid')?.classList.toggle('is-on', isEditFsGridOn());
}

function buildFsOverlayEditor() {
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

function readFsOverlayGrid() {
  const grid = [[], [], []];
  document.querySelectorAll('#fsGridBody select.fs-cell').forEach(sel => {
    const r = Number(sel.dataset.r);
    const c = Number(sel.dataset.c);
    grid[r][c] = Number(sel.value) || 1;
  });
  return grid;
}

function applyGridToFsOverlay(grid) {
  if (!Array.isArray(grid) || grid.length !== 3) return;
  document.querySelectorAll('#fsGridBody select.fs-cell').forEach(sel => {
    const r = Number(sel.dataset.r);
    const c = Number(sel.dataset.c);
    const v = grid[r]?.[c];
    if (v != null) sel.value = String(v);
  });
}

function fillFsOverlayGrid(symId) {
  document.querySelectorAll('#fsGridBody select.fs-cell').forEach(sel => {
    sel.value = String(symId);
  });
}

function readFsOverlayFeatures() {
  return [...document.querySelectorAll('#fsFeatureList input[type="checkbox"]:checked')]
    .map(el => el.value)
    .filter(name => CHEAT_FEATURE_NAMES.includes(name));
}

function applyFeaturesToFsOverlay(features) {
  const selected = new Set(Array.isArray(features) ? features : []);
  document.querySelectorAll('#fsFeatureList .cheat-feature-item').forEach(label => {
    const on = selected.has(label.dataset.feature);
    const input = label.querySelector('input');
    if (input) input.checked = on;
    label.classList.toggle('is-on', on);
  });
}

function currentScreenAsRowMajor() {
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

function loadFsOverlayFromScreen() {
  const grid = currentScreenAsRowMajor();
  if (!grid) {
    showToast('Chưa có screen trên reels', '#ff8800');
    return;
  }
  applyGridToFsOverlay(grid);
}

function mergePendingLocalForceFeatures(features) {
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

function applyPendingLocalForceGrid() {
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

function closeFsGridEditor() {
  closeModal('modalFsGrid');
}

function openFsGridEditor() {
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

async function sendCheatCode(code, value) {
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

async function skipFsGridAndSpin() {
  if (fsGridBusy || state.spinning) return;
  closeFsGridEditor();
  pendingLocalForceGrid = null;
  pendingLocalForceFeatures = null;
  showToast('FS RNG — không force grid', '#ff8800');
  await doSpin();
}

async function applyFsGridAndSpin() {
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

function buildCheatGridEditor() {
  const body = document.getElementById('cheatGridBody');
  if (!body || body.dataset.built === '1') return;
  const opts = CHEAT_SYM_OPTS.map(o => `<option value="${o.id}">${o.label}</option>`).join('');
  let html = '';
  for (let r = 0; r < 3; r++) {
    html += `<tr><th style="font-size:.6rem;color:var(--dim)">row${r}</th>`;
    for (let c = 0; c < 5; c++) {
      html += `<td><select data-r="${r}" data-c="${c}" class="cheat-cell">${opts}</select></td>`;
    }
    html += '</tr>';
  }
  body.innerHTML = html;
  body.dataset.built = '1';
  body.querySelectorAll('select.cheat-cell').forEach(sel => {
    sel.addEventListener('change', () => writeCheatGridToJson());
  });
}

function setCheatGridEditorVisible(on) {
  document.getElementById('cheatGridEditor')?.classList.toggle('visible', !!on);
}

function syncCheatJsonBox(code) {
  const box = document.getElementById('cheatJsonBox');
  if (!box) return;
  box.open = !(code === 'FORCE_GRID' || isDedicatedFeatureCheat(code));
}

const CHEAT_FEATURE_TUNES = {
  FORCE_FIREWALL_BLOCK: {
    title: 'FirewallBlock',
    help: 'Cấm 1–2 low (6–10) khỏi strip + scrub grid. Bỏ trống = RNG 1–2 loại.',
    fields: ['bannedLows'],
  },
  FORCE_DATA_DECRYPT: {
    title: 'DataDecrypt',
    help: 'Chọn 1–2 loại Low đang có trên lưới (F/G/H/I/K). Mọi ô cùng loại → cùng một High (toSymbol 1–5). positions chỉ pin ô (debug); để trống = theo loại.',
    fields: ['count12', 'toHigh', 'positions'],
  },
  FORCE_TROJAN_HORSE: {
    title: 'TrojanHorse',
    help: 'Bấm 3–6 ô Mystery ([col,row]). revealTo = symbol sau khi mở (1–10). Không chọn ô thì dùng count.',
    fields: ['count36', 'revealTo', 'positions'],
  },
  FORCE_DATA_OVERLOAD: {
    title: 'DataOverload',
    help: 'Reel được chọn nở full Wild (kể cả reel chưa có Wild).',
    fields: ['reels'],
  },
  FORCE_SYSTEM_OVERCLOCK: {
    title: 'SystemOverclock',
    help: 'targetSymbol phải đang có trên grid. multiplier ∈ 3 / 5 / 8 / 10.',
    fields: ['targetPay', 'mult'],
  },
  FORCE_DATA_CLONING: {
    title: 'DataCloning',
    help: 'Split ×2 mọi ô của targetSymbol (phải có trên grid).',
    fields: ['targetPay'],
  },
  FORCE_ROOT_ACCESS: {
    title: 'RootAccess',
    help: 'Split ×2 cả reel (trừ Scatter). Chọn reel hoặc reelCount 1–3.',
    fields: ['reels', 'reelCount'],
  },
  FORCE_POWER_SURGE: {
    title: 'PowerSurge',
    help: '1–2 loại pay đang có trên lưới → Wild + split 8 ô kề (cả chéo), trừ Scatter. Tick loại, tối đa 2.',
    fields: ['types2'],
  },
  FORCE_SYSTEM_GLITCH: {
    title: 'SystemGlitch',
    help: 'Shuffle ô không thắng / không scatter. Tắt protectWinning để xáo cả ô thắng.',
    fields: ['protectWinning'],
  },
  FORCE_ALGORITHMIC_SCAN: {
    title: 'AlgorithmicScan',
    help: '1–3 loại pay → Wild. Tick loại, tối đa 3.',
    fields: ['types3'],
  },
  FORCE_BANDWIDTH_MULTIPLIER: {
    title: 'BandwidthMultiplier',
    help: 'Hệ số nhân win sau payout: 3 / 5 / 8 / 10.',
    fields: ['mult'],
  },
  FORCE_BYPASS_PROTOCOL: {
    title: 'BypassProtocol',
    help: 'Bật đánh ways phải → trái. Không có tham số thêm.',
    fields: [],
  },
};

const CHEAT_PAY_OPTS = [
  { id: 1, label: '1 A' }, { id: 2, label: '2 B' }, { id: 3, label: '3 C' },
  { id: 4, label: '4 D' }, { id: 5, label: '5 E' }, { id: 6, label: '6 F' },
  { id: 7, label: '7 G' }, { id: 8, label: '8 H' }, { id: 9, label: '9 I' },
  { id: 10, label: '10 K' },
];

function isDedicatedFeatureCheat(code) {
  return !!CHEAT_FEATURE_TUNES[code];
}

function setCheatTuneVisible(on) {
  document.getElementById('cheatFeatureTune')?.classList.toggle('visible', !!on);
}

function renderCheatTune(code, value) {
  const spec = CHEAT_FEATURE_TUNES[code];
  const root = document.getElementById('cheatTuneFields');
  const title = document.getElementById('cheatTuneTitle');
  const help = document.getElementById('cheatTuneHelp');
  if (!spec || !root) return;
  title.textContent = spec.title;
  help.textContent = spec.help;
  const v = value && typeof value === 'object' ? value : {};
  const posSet = new Set(
    (Array.isArray(v.positions) ? v.positions : [])
      .filter(p => Array.isArray(p) && p.length >= 2)
      .map(p => `${p[0]},${p[1]}`)
  );
  const selected = (arr) => new Set((arr || []).map(Number));
  let html = '';
  for (const field of spec.fields) {
    if (field === 'bannedLows') {
      const on = selected(v.bannedLows);
      html += `<div class="cheat-tune-row"><label>bannedLows</label><div class="cheat-chip-list" data-tune="bannedLows">`;
      for (const o of CHEAT_PAY_OPTS.filter(x => x.id >= 6)) {
        html += `<button type="button" class="cheat-chip${on.has(o.id) ? ' is-on' : ''}" data-id="${o.id}">${o.label}</button>`;
      }
      html += `</div></div>`;
    } else if (field === 'count12' || field === 'count36' || field === 'reelCount') {
      const min = field === 'count36' ? 3 : 1;
      const max = field === 'count36' ? 6 : field === 'reelCount' ? 3 : 2;
      const key = field === 'reelCount' ? 'reelCount' : 'count';
      const val = v[key] != null ? v[key] : (field === 'count36' ? 4 : min);
      const countLabel = code === 'FORCE_DATA_DECRYPT' ? 'count (types)' : key;
      html += `<div class="cheat-tune-row"><label>${countLabel}</label><input type="number" min="${min}" max="${max}" value="${val}" data-tune="${key}"></div>`;
    } else if (field === 'toHigh' || field === 'revealTo' || field === 'targetPay') {
      const key = field === 'targetPay' ? 'targetSymbol' : field === 'toHigh' ? 'toSymbol' : 'revealTo';
      const min = field === 'toHigh' ? 1 : 1;
      const max = field === 'toHigh' ? 5 : 10;
      const val = v[key] != null ? v[key] : (field === 'revealTo' ? 8 : 1);
      const opts = CHEAT_PAY_OPTS.filter(o => o.id >= min && o.id <= max);
      html += `<div class="cheat-tune-row"><label>${key}</label><select data-tune="${key}">`;
      html += opts.map(o => `<option value="${o.id}"${Number(val) === o.id ? ' selected' : ''}>${o.label}</option>`).join('');
      html += `</select></div>`;
    } else if (field === 'mult') {
      const val = v.multiplier != null ? v.multiplier : 10;
      html += `<div class="cheat-tune-row"><label>multiplier</label><select data-tune="multiplier">`;
      html += [3, 5, 8, 10].map(m => `<option value="${m}"${Number(val) === m ? ' selected' : ''}>×${m}</option>`).join('');
      html += `</select></div>`;
    } else if (field === 'reels') {
      const on = selected(v.reels || v.columns);
      html += `<div class="cheat-tune-row"><label>reels</label><div class="cheat-chip-list" data-tune="reels">`;
      for (let i = 0; i < 5; i++) {
        html += `<button type="button" class="cheat-chip${on.has(i) ? ' is-on' : ''}" data-id="${i}">R${i + 1}</button>`;
      }
      html += `</div></div>`;
    } else if (field === 'types2' || field === 'types3') {
      const max = field === 'types2' ? 2 : 3;
      const on = selected(v.convertedTypes);
      html += `<div class="cheat-tune-row"><label>types (max ${max})</label><div class="cheat-chip-list" data-tune="convertedTypes" data-max="${max}">`;
      for (const o of CHEAT_PAY_OPTS) {
        html += `<button type="button" class="cheat-chip${on.has(o.id) ? ' is-on' : ''}" data-id="${o.id}">${o.label}</button>`;
      }
      html += `</div></div>`;
    } else if (field === 'protectWinning') {
      const on = v.protectWinning !== false;
      html += `<div class="cheat-tune-row"><label>protectWinning</label><button type="button" class="cheat-chip${on ? ' is-on' : ''}" data-tune="protectWinning">${on ? 'true' : 'false'}</button></div>`;
    } else if (field === 'positions') {
      html += `<div class="cheat-tune-row"><label>positions</label><div class="cheat-pos-wrap">`;
      html += `<div class="cheat-pos-head"><span></span><span>R1</span><span>R2</span><span>R3</span><span>R4</span><span>R5</span></div>`;
      html += `<div class="cheat-pos-grid" data-tune="positions">`;
      for (let r = 0; r < 3; r++) {
        html += `<span class="cheat-pos-rowlab">r${r}</span>`;
        for (let c = 0; c < 5; c++) {
          const key = `${c},${r}`;
          html += `<button type="button" class="cheat-pos-cell${posSet.has(key) ? ' is-on' : ''}" data-c="${c}" data-r="${r}" title="[${c},${r}]"></button>`;
        }
      }
      html += `</div></div></div>`;
    }
  }
  root.innerHTML = html || '<p style="font-size:.7rem;color:var(--dim);margin:0">Không có field — chỉ force feature.</p>';
  root.querySelectorAll('.cheat-chip-list .cheat-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const list = btn.parentElement;
      const max = Number(list.dataset.max || 0);
      if (list.dataset.tune === 'bannedLows') {
        btn.classList.toggle('is-on');
        const ons = [...list.querySelectorAll('.cheat-chip.is-on')];
        if (ons.length > 2) ons[0].classList.remove('is-on');
      } else if (max > 0) {
        if (btn.classList.contains('is-on')) btn.classList.remove('is-on');
        else {
          const ons = [...list.querySelectorAll('.cheat-chip.is-on')];
          if (ons.length >= max) ons[0].classList.remove('is-on');
          btn.classList.add('is-on');
        }
      } else {
        btn.classList.toggle('is-on');
      }
      writeCheatTuneToJson();
    });
  });
  root.querySelectorAll('.cheat-pos-cell').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('is-on');
      const ons = root.querySelectorAll('.cheat-pos-cell.is-on');
      if (ons.length > 6) ons[0].classList.remove('is-on');
      writeCheatTuneToJson();
    });
  });
  root.querySelectorAll('select[data-tune], input[data-tune]').forEach(el => {
    el.addEventListener('change', () => writeCheatTuneToJson());
    el.addEventListener('input', () => writeCheatTuneToJson());
  });
  const prot = root.querySelector('[data-tune="protectWinning"]');
  if (prot) {
    prot.addEventListener('click', () => {
      const next = prot.textContent !== 'true';
      prot.textContent = next ? 'true' : 'false';
      prot.classList.toggle('is-on', next);
      writeCheatTuneToJson();
    });
  }
}

function writeCheatTuneToJson() {
  const code = document.getElementById('cheatCode')?.value;
  if (!isDedicatedFeatureCheat(code)) return;
  let value = {};
  try { value = parseCheatValue(); } catch (_) { value = {}; }
  const root = document.getElementById('cheatTuneFields');
  if (!root) return;
  root.querySelectorAll('select[data-tune], input[data-tune]').forEach(el => {
    const key = el.dataset.tune;
    const n = Number(el.value);
    value[key] = Number.isFinite(n) ? n : el.value;
  });
  root.querySelectorAll('.cheat-chip-list').forEach(list => {
    const key = list.dataset.tune;
    const ids = [...list.querySelectorAll('.cheat-chip.is-on')].map(b => Number(b.dataset.id));
    if (ids.length) value[key] = ids;
    else delete value[key];
  });
  const prot = root.querySelector('[data-tune="protectWinning"]');
  if (prot) value.protectWinning = prot.textContent === 'true';
  const posRoot = root.querySelector('[data-tune="positions"]');
  if (posRoot) {
    const pos = [...posRoot.querySelectorAll('.cheat-pos-cell.is-on')].map(b => [Number(b.dataset.c), Number(b.dataset.r)]);
    if (pos.length) value.positions = pos;
    else delete value.positions;
  }
  document.getElementById('cheatValue').value = JSON.stringify(value, null, 2);
}

function setCheatPresetActive(code) {
  document.querySelectorAll('#cheatPresets button[data-preset]').forEach(btn => {
    const p = CHEAT_PRESETS[Number(btn.dataset.preset)];
    btn.classList.toggle('is-active', p?.code === code);
  });
}

function buildCheatFeaturePicker() {
  const root = document.getElementById('cheatFeatureList');
  if (!root || root.dataset.built === '1') return;
  root.innerHTML = CHEAT_FEATURE_NAMES.map(
    name =>
      `<label class="cheat-feature-item" data-feature="${name}">` +
      `<input type="checkbox" value="${name}" /><span>${name}</span></label>`
  ).join('');
  root.dataset.built = '1';
  root.addEventListener('change', e => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;
    input.closest('.cheat-feature-item')?.classList.toggle('is-on', input.checked);
    writeCheatGridToJson();
  });
}

function readCheatFeaturesFromEditor() {
  return [...document.querySelectorAll('#cheatFeatureList input[type="checkbox"]:checked')]
    .map(el => el.value)
    .filter(name => CHEAT_FEATURE_NAMES.includes(name));
}

function applyFeaturesToEditor(features) {
  const selected = new Set(Array.isArray(features) ? features : []);
  document.querySelectorAll('#cheatFeatureList .cheat-feature-item').forEach(label => {
    const on = selected.has(label.dataset.feature);
    const input = label.querySelector('input');
    if (input) input.checked = on;
    label.classList.toggle('is-on', on);
  });
}

function onCheatCodeChanged({ fromPreset = false } = {}) {
  const code = document.getElementById('cheatCode')?.value || '';
  const preset = CHEAT_PRESETS.find(p => p.code === code);
  setCheatPresetActive(code);
  if (code === 'FORCE_GRID') {
    setCheatTuneVisible(false);
    setCheatGridEditorVisible(true);
    try {
      const v = JSON.parse(document.getElementById('cheatValue')?.value || '{}');
      if (Array.isArray(v.grid) && v.grid.length === 3) {
        applyGridToEditor(v.grid);
        applyFeaturesToEditor(v.features);
      } else if (preset?.value?.grid) {
        document.getElementById('cheatValue').value = JSON.stringify(preset.value, null, 2);
        applyGridToEditor(preset.value.grid);
        applyFeaturesToEditor(preset.value.features);
      } else {
        fillCheatGrid(8);
        applyFeaturesToEditor([]);
      }
    } catch (_) {
      fillCheatGrid(8);
      applyFeaturesToEditor([]);
    }
  } else if (isDedicatedFeatureCheat(code)) {
    setCheatGridEditorVisible(false);
    setCheatTuneVisible(true);
    let v = {};
    if (fromPreset && preset?.value != null) {
      v = preset.value;
      document.getElementById('cheatValue').value = JSON.stringify(v, null, 2);
    } else {
      try { v = JSON.parse(document.getElementById('cheatValue')?.value || '{}'); } catch (_) { v = {}; }
      if (!v || typeof v !== 'object' || Array.isArray(v) || !Object.keys(v).length) {
        v = preset?.value && typeof preset.value === 'object' ? preset.value : {};
        document.getElementById('cheatValue').value = JSON.stringify(v, null, 2);
      }
    }
    renderCheatTune(code, v);
  } else {
    setCheatGridEditorVisible(false);
    setCheatTuneVisible(false);
    if (fromPreset && preset?.value != null) {
      document.getElementById('cheatValue').value = JSON.stringify(preset.value, null, 2);
    }
  }
  const spinBtn = document.getElementById('cheatSendSpin');
  if (spinBtn) {
    spinBtn.title = CHEAT_IMMEDIATE.has(code)
      ? 'Immediate cheat — will send only (no auto-spin)'
      : 'Send next-spin cheat then trigger SPIN';
  }
  syncCheatJsonBox(code);
}

function readCheatGridFromEditor() {
  const grid = [[], [], []];
  document.querySelectorAll('#cheatGridBody select.cheat-cell').forEach(sel => {
    const r = Number(sel.dataset.r);
    const c = Number(sel.dataset.c);
    grid[r][c] = Number(sel.value) || 1;
  });
  return grid;
}

function applyGridToEditor(grid) {
  if (!Array.isArray(grid) || grid.length !== 3) return;
  document.querySelectorAll('#cheatGridBody select.cheat-cell').forEach(sel => {
    const r = Number(sel.dataset.r);
    const c = Number(sel.dataset.c);
    const v = grid[r]?.[c];
    if (v != null) sel.value = String(v);
  });
}

function writeCheatGridToJson() {
  let value = {};
  try {
    value = parseCheatValue();
  } catch (_) {
    value = {};
  }
  value.grid = readCheatGridFromEditor();
  const features = readCheatFeaturesFromEditor();
  if (features.length) value.features = features;
  else delete value.features;
  document.getElementById('cheatValue').value = JSON.stringify(value, null, 2);
}

function fillCheatGrid(symId) {
  document.querySelectorAll('#cheatGridBody select.cheat-cell').forEach(sel => {
    sel.value = String(symId);
  });
  writeCheatGridToJson();
}

/** Client state.grid is col-major keys A/B… → server row-major ids */
function loadCheatGridFromScreen() {
  if (!state.grid || state.grid.length !== 5) {
    setCheatLog('No screen on reels yet', 'err');
    return;
  }
  const inv = {};
  Object.entries(SYM_MAP).forEach(([id, key]) => {
    inv[key] = Number(id);
  });
  const grid = [[], [], []];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      const key = state.grid[c][r];
      grid[r][c] = inv[key] || 1;
    }
  }
  applyGridToEditor(grid);
  writeCheatGridToJson();
  setCheatLog('Loaded grid from current screen', 'ok');
}

function loadCheatGridScatter3() {
  // Low fillers + scatter on reels 2,3,4 (cols 1,2,3) row 1
  const grid = [
    [6, 7, 8, 9, 10],
    [6, 12, 12, 12, 10],
    [7, 8, 9, 6, 7],
  ];
  applyGridToEditor(grid);
  writeCheatGridToJson();
  setCheatLog('3 scatters mid reels', 'ok');
}

function parseCheatValue() {
  const raw = (document.getElementById('cheatValue')?.value || '{}').trim() || '{}';
  try {
    const v = JSON.parse(raw);
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      throw new Error('value must be a JSON object');
    }
    return v;
  } catch (e) {
    throw new Error('Invalid value JSON: ' + e.message);
  }
}

/**
 * Send cheat via WebSocket cmd 1999.
 * Backend PluginServiceHandler injects agency_id / user_id from session.
 */
async function sendCheatViaWs(code, value) {
  if (!online || !ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket not connected');
  }
  const payload = await requestGameCmd('1999', { cheat: code, value }, 12000);
  if (!payload) {
    throw new Error('No response / timeout (is server profile dev|staging?)');
  }
  if (payload.c !== undefined && payload.c !== null && payload.c != 0) {
    throw new Error(payload.msg || 'error code ' + payload.c);
  }
  return payload;
}

/** Send cheat via REST POST /debug/cheat/{agencyId}/{userId} */
async function sendCheatViaRest(code, value) {
  const base = (document.getElementById('cheatDebugBase')?.value || '').replace(/\/$/, '');
  const token = document.getElementById('cheatDebugToken')?.value || 'zeroday-debug-2024';
  const agencyId = resolveSessionAgencyId();
  const userId = resolveSessionUserId();
  if (!base) throw new Error('Missing debug base URL');
  if (!userId) throw new Error('Missing user ID for REST cheat — login or fill User ID');
  if (!agencyId) throw new Error('Missing agency ID — Pull session or fill Agency ID');

  const url = `${base}/debug/cheat/${encodeURIComponent(agencyId)}/${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Token': token,
    },
    body: JSON.stringify({ cheat: code, value }),
  });
  let body = null;
  try {
    body = await res.json();
  } catch (_) {
    body = { raw: await res.text() };
  }
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status}: ` + (body?.error || body?.message || JSON.stringify(body))
    );
  }
  return body;
}

/**
 * @param {{ andSpin?: boolean }} opts
 */
async function sendCheatFromPanel(opts = {}) {
  const andSpin = !!opts.andSpin;
  const code = document.getElementById('cheatCode')?.value;
  if (!code) {
    setCheatLog('Select a cheat code', 'err');
    return;
  }

  // Sync FORCE_GRID editor → JSON before parse
  if (code === 'FORCE_GRID') {
    writeCheatGridToJson();
  }

  let value;
  try {
    value = parseCheatValue();
  } catch (e) {
    setCheatLog(e.message, 'err');
    return;
  }

  const gid = document.getElementById('gameId')?.value || 'yama_01023';
  if (
    [
      'SET_FREE_SPIN_COUNT',
      'FORCE_LAST_FREE_SPIN',
      'SET_GAME_MODE',
      'SET_ACCUMULATED_WIN',
      'RESET_SESSION',
      'CLEAR_AGENT_STATE',
    ].includes(code) &&
    value.game_id == null &&
    value.gameId == null
  ) {
    value = { ...value, game_id: gid };
  }

  saveCheatPrefs();
  const transport = document.getElementById('cheatTransport')?.value || 'auto';
  const btnSend = document.getElementById('cheatSend');
  const btnSpin = document.getElementById('cheatSendSpin');
  if (btnSend) btnSend.disabled = true;
  if (btnSpin) btnSpin.disabled = true;
  setCheatLog(
    `Sending ${code} via ${transport}${andSpin ? ' + spin' : ''}…\n` +
      `agency=${resolveSessionAgencyId()} userId=${resolveSessionUserId()}\n` +
      JSON.stringify(value),
    ''
  );

  try {
    let result;
    let used = transport;
    if (transport === 'ws') {
      result = await sendCheatViaWs(code, value);
      used = 'ws';
    } else if (transport === 'rest') {
      result = await sendCheatViaRest(code, value);
      used = 'rest';
    } else if (online && ws?.readyState === WebSocket.OPEN) {
      try {
        result = await sendCheatViaWs(code, value);
        used = 'ws';
      } catch (wsErr) {
        setCheatLog(`WS failed (${wsErr.message}) — trying REST…`, '');
        result = await sendCheatViaRest(code, value);
        used = 'rest (fallback)';
      }
    } else {
      result = await sendCheatViaRest(code, value);
      used = 'rest';
    }

    const desc = result?.description || result?.msg || '';
    setCheatLog(
      `OK via ${used}\n${code}\n${desc}\n${JSON.stringify(result, null, 2)}`,
      'ok'
    );
    showToast(`Cheat OK: ${code}`, '#00ff88');

    if (andSpin) {
      if (CHEAT_IMMEDIATE.has(code)) {
        setCheatLog(
          (document.getElementById('cheatLog')?.textContent || '') +
            '\n\n(Immediate cheat — skipped auto-spin)',
          'ok'
        );
        showToast('Immediate cheat — spin manually if needed', '#ff8800');
      } else if (state.spinning) {
        showToast('Already spinning — cheat applied for next free window', '#ff8800');
      } else if (!online) {
        // Offline: no server cheat consume — still run local spin for UI smoke
        closeModal('modalCheat');
        showToast('Offline: cheat not applied to server; local spin only', '#ff8800');
        await doSpin();
      } else {
        closeModal('modalCheat');
        // Small delay so Redis/cache is visible to next spin
        await sleepRaw(80);
        await doSpin();
      }
    }
  } catch (e) {
    setCheatLog(`FAILED\n${code}\n${e.message}`, 'err');
    showToast('Cheat failed: ' + e.message, '#ff3355');
  } finally {
    if (btnSend) btnSend.disabled = false;
    if (btnSpin) btnSpin.disabled = false;
  }
}

/** Bind once — works before Play (initUI not required). */
function bindCheatPanelEvents() {
  if (bindCheatPanelEvents._done) return;
  bindCheatPanelEvents._done = true;
  document.getElementById('menuCheat')?.addEventListener('click', () => {
    closeModal('modalMenu');
    openCheatPanel();
  });
  document.getElementById('btnCheatFab')?.addEventListener('click', () => openCheatPanel());
  document.getElementById('closeCheat')?.addEventListener('click', () => closeModal('modalCheat'));
  document.getElementById('cheatSend')?.addEventListener('click', () =>
    sendCheatFromPanel({ andSpin: false })
  );
  document.getElementById('cheatSendSpin')?.addEventListener('click', () =>
    sendCheatFromPanel({ andSpin: true })
  );
  document.getElementById('cheatClearLog')?.addEventListener('click', () => setCheatLog('Ready.', ''));
  document.getElementById('cheatPullSession')?.addEventListener('click', () => {
    const agencyEl = document.getElementById('cheatAgencyId');
    const userEl = document.getElementById('cheatUserId');
    if (agencyEl) agencyEl.dataset.auto = '1';
    if (userEl) userEl.dataset.auto = '1';
    if (!sessionAgencyId) sessionAgencyId = deriveAgencyFromSrvUrl();
    if (!sessionUserId) {
      sessionUserId = sessionUsername || document.getElementById('loginUser')?.value || '';
    }
    syncCheatSessionFields();
    setCheatLog(
      `Pulled session\nagency=${resolveSessionAgencyId()}\nuserId=${resolveSessionUserId()}`,
      'ok'
    );
  });
  document.getElementById('cheatAgencyId')?.addEventListener('input', e => {
    e.target.dataset.auto = '0';
    if (e.target.value.trim()) sessionAgencyId = e.target.value.trim();
  });
  document.getElementById('cheatUserId')?.addEventListener('input', e => {
    e.target.dataset.auto = '0';
    if (e.target.value.trim()) sessionUserId = e.target.value.trim();
  });
  document.getElementById('modalCheat')?.addEventListener('click', e => {
    if (e.target.id === 'modalCheat') closeModal('modalCheat');
  });
  document.getElementById('cheatCode')?.addEventListener('change', () => {
    const code = document.getElementById('cheatCode').value;
    const preset = CHEAT_PRESETS.find(p => p.code === code);
    if (preset?.value != null) {
      document.getElementById('cheatValue').value = JSON.stringify(preset.value, null, 2);
    } else if (code !== 'FORCE_GRID') {
      document.getElementById('cheatValue').value = '{}';
    }
    onCheatCodeChanged({ fromPreset: true });
  });
  document.getElementById('cheatGridFillH')?.addEventListener('click', () => fillCheatGrid(8));
  document.getElementById('cheatGridFillA')?.addEventListener('click', () => fillCheatGrid(1));
  document.getElementById('cheatGridFromScreen')?.addEventListener('click', () => loadCheatGridFromScreen());
  document.getElementById('cheatGridScatter3')?.addEventListener('click', () => loadCheatGridScatter3());
  document.getElementById('cheatGridSyncJson')?.addEventListener('click', () => {
    writeCheatGridToJson();
    setCheatLog('Grid → JSON synced', 'ok');
  });
  document.getElementById('cheatFeatAll')?.addEventListener('click', () => {
    applyFeaturesToEditor(CHEAT_FEATURE_NAMES);
    writeCheatGridToJson();
  });
  document.getElementById('cheatFeatNone')?.addEventListener('click', () => {
    applyFeaturesToEditor([]);
    writeCheatGridToJson();
  });
  document.getElementById('cheatEditFsGrid')?.addEventListener('change', e => {
    setEditFsGridEnabled(!!e.target.checked);
  });
  document.getElementById('btnFsEditGrid')?.addEventListener('click', e => {
    e.stopPropagation();
    if (!state.inFreeSpins || state.spinning) return;
    openFsGridEditor();
  });
  document.getElementById('fsGridSkip')?.addEventListener('click', () => skipFsGridAndSpin());
  document.getElementById('fsGridApply')?.addEventListener('click', () => applyFsGridAndSpin());
  document.getElementById('fsGridFillH')?.addEventListener('click', () => fillFsOverlayGrid(8));
  document.getElementById('fsGridFillA')?.addEventListener('click', () => fillFsOverlayGrid(1));
  document.getElementById('fsGridFromScreen')?.addEventListener('click', () => loadFsOverlayFromScreen());
  document.getElementById('fsGridScatter3')?.addEventListener('click', () => {
    applyGridToFsOverlay([
      [6, 7, 8, 9, 10],
      [6, 12, 12, 12, 10],
      [7, 8, 9, 6, 7],
    ]);
  });
  document.getElementById('fsFeatAll')?.addEventListener('click', () => {
    applyFeaturesToFsOverlay(CHEAT_FEATURE_NAMES);
  });
  document.getElementById('fsFeatNone')?.addEventListener('click', () => {
    applyFeaturesToFsOverlay([]);
  });
  window.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
      e.preventDefault();
      openCheatPanel();
      return;
    }
    if (
      e.key === 'c' &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.shiftKey &&
      !/^(input|textarea|select)$/i.test(e.target?.tagName || '') &&
      !e.target?.isContentEditable
    ) {
      openCheatPanel();
    }
  });
}

// Init cheat panel once DOM ready (fab visible even before play)
bindCheatPanelEvents();
initCheatPanel();

// ─── WS TRAFFIC DOCK ─────────────────────────────────────────
const WS_CMD_LABELS = {
  '1002': 'PING',
  '1005': 'JOIN',
  '1006': 'FORCE_LOGOUT',
  '1500': 'SPIN',
  '1501': 'BUY_FEATURE',
  '1502': 'LAST_SESSION',
  '1503': 'GET_BALANCE',
  '1504': 'GET_SPIN_LIST',
  '1505': 'GET_SESSION_ROUNDS',
  '1506': 'GET_SPIN_DETAIL',
  '1507': 'JACKPOT_HISTORY',
  '1508': 'PREV_LAST_SESSION',
  '1531': 'BALANCE_UPDATED',
  '1999': 'CHEAT',
  '9000': 'JACKPOT_WIN',
  '9001': 'JACKPOT_POOL',
};

const wsTrafficState = {
  items: [],
  maxItems: 200,
  paused: false,
  seq: 0,
};

function wsTrafficStorageKey(k) {
  return 'zd.wsTraffic.' + k;
}

function extractWsCmdMeta(data) {
  // Outgoing game: [6, 'MiniGame', gameId, { cmd, ... }]
  // Incoming game: [5, { cmd, c, data, ... }]
  // Auth: [1, ...]
  // Ping: ["7", ...] or [7, ...]
  let cmd = '';
  let label = '';
  let err = false;
  try {
    if (Array.isArray(data)) {
      const t = data[0];
      if (t === 6 || t === '6') {
        const p = data[3];
        if (p && typeof p === 'object' && p.cmd != null) {
          cmd = String(p.cmd);
          label = WS_CMD_LABELS[cmd] || ('cmd ' + cmd);
        } else if (data[1] === 1 || data[1] === '1') {
          label = 'PING_ACK';
          cmd = 'ping-ack';
        } else {
          label = 'FRAME_6';
        }
      } else if (t === 5 || t === '5') {
        const p = data[1];
        if (p && typeof p === 'object') {
          cmd = String(p.cmd ?? '');
          label = WS_CMD_LABELS[cmd] || (cmd ? 'cmd ' + cmd : 'GAME');
          if (p.c != null && p.c !== 0 && p.c !== '0') err = true;
        } else label = 'GAME';
      } else if (t === 1 || t === '1') {
        label = 'AUTH';
        cmd = 'auth';
      } else if (t === 0 || t === '0') {
        label = 'ERROR';
        err = true;
      } else if (t === 7 || t === '7') {
        label = 'PING';
        cmd = 'ping';
      } else {
        label = 'T' + String(t);
      }
    } else if (data && typeof data === 'object' && data.cmd != null) {
      cmd = String(data.cmd);
      label = WS_CMD_LABELS[cmd] || ('cmd ' + cmd);
    } else {
      label = typeof data === 'string' ? 'RAW' : 'MSG';
    }
  } catch (_) {
    label = 'MSG';
  }
  return { cmd, label, err };
}

function isWsPingLike(meta, data) {
  if (!meta) return false;
  if (meta.cmd === 'ping' || meta.cmd === 'ping-ack' || meta.label === 'PING' || meta.label === 'PING_ACK') {
    return true;
  }
  if (Array.isArray(data) && (data[0] === 7 || data[0] === '7')) return true;
  if (Array.isArray(data) && (data[0] === 6 || data[0] === '6') && (data[1] === 1 || data[1] === '1')) {
    return true;
  }
  return false;
}

function formatWsTrafficPayload(data) {
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch (_) {
    return String(data);
  }
}

function logWsTraffic(dir, data, note) {
  if (wsTrafficState.paused) return;
  const meta = extractWsCmdMeta(data);
  const hidePing = document.getElementById('wsTrafficHidePing')?.checked !== false;
  if (hidePing && isWsPingLike(meta, data)) return;

  const item = {
    id: ++wsTrafficState.seq,
    t: Date.now(),
    dir, // out | in | err
    cmd: meta.cmd,
    label: meta.label + (note ? ' · ' + note : ''),
    err: dir === 'err' || meta.err,
    data, // raw frame — dùng cho win explain (IN SPIN)
    text: formatWsTrafficPayload(data),
  };
  wsTrafficState.items.push(item);
  while (wsTrafficState.items.length > wsTrafficState.maxItems) {
    wsTrafficState.items.shift();
  }
  renderWsTrafficItem(item);
  updateWsTrafficCount();

  const dock = document.getElementById('wsTrafficDock');
  if (dock && dock.style.display === 'none') {
    document.getElementById('wsTrafficFab')?.classList.add('has-new');
  }
}

function updateWsTrafficCount() {
  const el = document.getElementById('wsTrafficCount');
  if (el) el.textContent = String(wsTrafficState.items.length);
}

function renderWsTrafficItem(item) {
  const body = document.getElementById('wsTrafficBody');
  const empty = document.getElementById('wsTrafficEmpty');
  if (!body) return;
  if (empty) empty.remove();

  const row = document.createElement('div');
  row.className =
    'ws-traffic-item ' +
    (item.err ? 'err' : item.dir === 'out' ? 'out' : 'in');
  row.dataset.id = String(item.id);

  const time = new Date(item.t).toLocaleTimeString('en-GB', { hour12: false }) +
    '.' + String(item.t % 1000).padStart(3, '0');
  const dirLabel = item.dir === 'out' ? 'OUT' : item.dir === 'err' ? 'ERR' : 'IN';
  const preview = (item.text || '').replace(/\s+/g, ' ').slice(0, 80);

  row.innerHTML =
    '<div class="ws-traffic-item-head">' +
    '<span class="ws-traffic-dir">' + dirLabel + '</span>' +
    '<span class="ws-traffic-cmd">' + escapeHtmlLite(item.label) + '</span>' +
    '<span class="ws-traffic-preview">' + escapeHtmlLite(preview) + '</span>' +
    '<span class="ws-traffic-time">' + time + '</span>' +
    '</div>' +
    '<pre class="ws-traffic-item-body"></pre>';

  const pre = row.querySelector('.ws-traffic-item-body');
  pre.textContent = item.text;

  row.querySelector('.ws-traffic-item-head').addEventListener('click', () => {
    const willOpen = !row.classList.contains('open');
    // Accordion: only one fully expanded at a time (easier to read full body)
    if (willOpen) {
      body.querySelectorAll('.ws-traffic-item.open').forEach(el => {
        if (el !== row) el.classList.remove('open');
      });
    }
    row.classList.toggle('open', willOpen);
    if (willOpen) {
      requestAnimationFrame(() => {
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        // Reset inner scroll to top so long responses start from the beginning
        const pre = row.querySelector('.ws-traffic-item-body');
        if (pre) pre.scrollTop = 0;
      });
    }
  });

  body.appendChild(row);
  if (document.getElementById('wsTrafficAutoScroll')?.checked !== false) {
    body.scrollTop = body.scrollHeight;
  }
}

function escapeHtmlLite(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clearWsTraffic() {
  wsTrafficState.items = [];
  const body = document.getElementById('wsTrafficBody');
  if (body) {
    body.innerHTML =
      '<div class="ws-traffic-empty" id="wsTrafficEmpty">' +
      'Đã xóa log.<br>Traffic mới sẽ hiện tại đây.' +
      '</div>';
  }
  updateWsTrafficCount();
}

function copyWsTraffic() {
  const payload = wsTrafficState.items.map(i => ({
    t: new Date(i.t).toISOString(),
    dir: i.dir,
    label: i.label,
    cmd: i.cmd,
    body: (() => { try { return JSON.parse(i.text); } catch (_) { return i.text; } })(),
  }));
  const text = JSON.stringify(payload, null, 2);
  const done = () => showToast('WS traffic copied (' + payload.length + ')', '#00ff88');
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      fallbackCopyText(text);
      done();
    });
  } else {
    fallbackCopyText(text);
    done();
  }
}

function fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (_) {}
  ta.remove();
}

function setWsTrafficCollapsed(collapsed) {
  const dock = document.getElementById('wsTrafficDock');
  const btn = document.getElementById('wsTrafficCollapse');
  if (!dock) return;
  dock.classList.toggle('collapsed', !!collapsed);
  if (btn) btn.textContent = collapsed ? '+' : '−';
  try {
    localStorage.setItem(wsTrafficStorageKey('collapsed'), collapsed ? '1' : '0');
  } catch (_) {}
}

function setWsTrafficVisible(visible) {
  const dock = document.getElementById('wsTrafficDock');
  const fab = document.getElementById('wsTrafficFab');
  if (!dock || !fab) return;
  dock.style.display = visible ? 'flex' : 'none';
  fab.style.display = visible ? 'none' : 'flex';
  if (visible) fab.classList.remove('has-new');
  try {
    localStorage.setItem(wsTrafficStorageKey('visible'), visible ? '1' : '0');
  } catch (_) {}
}

function saveWsTrafficGeom() {
  const dock = document.getElementById('wsTrafficDock');
  if (!dock || dock.classList.contains('collapsed')) return;
  try {
    localStorage.setItem(
      wsTrafficStorageKey('geom'),
      JSON.stringify({
        left: dock.style.left || '',
        top: dock.style.top || '',
        right: dock.style.right || '',
        bottom: dock.style.bottom || '',
        width: dock.style.width || dock.offsetWidth + 'px',
        height: dock.style.height || dock.offsetHeight + 'px',
      })
    );
  } catch (_) {}
}

function restoreWsTrafficGeom() {
  const dock = document.getElementById('wsTrafficDock');
  if (!dock) return;
  try {
    const raw = localStorage.getItem(wsTrafficStorageKey('geom'));
    if (!raw) return;
    const g = JSON.parse(raw);
    if (g.width) dock.style.width = g.width;
    if (g.height) dock.style.height = g.height;
    if (g.left) {
      dock.style.left = g.left;
      dock.style.right = 'auto';
    } else if (g.right) {
      dock.style.right = g.right;
      dock.style.left = 'auto';
    }
    if (g.top) {
      dock.style.top = g.top;
      dock.style.bottom = 'auto';
    } else if (g.bottom) {
      dock.style.bottom = g.bottom;
      dock.style.top = 'auto';
    }
  } catch (_) {}
}

function bindWsTrafficDrag() {
  const dock = document.getElementById('wsTrafficDock');
  const head = document.getElementById('wsTrafficHead');
  if (!dock || !head) return;

  let dragging = false;
  let ox = 0;
  let oy = 0;

  const onMove = (e) => {
    if (!dragging) return;
    const pt = e.touches ? e.touches[0] : e;
    let nx = pt.clientX - ox;
    let ny = pt.clientY - oy;
    const maxX = window.innerWidth - Math.min(dock.offsetWidth, 80);
    const maxY = window.innerHeight - 40;
    nx = Math.max(0, Math.min(nx, maxX));
    ny = Math.max(0, Math.min(ny, maxY));
    dock.style.left = nx + 'px';
    dock.style.top = ny + 'px';
    dock.style.right = 'auto';
    dock.style.bottom = 'auto';
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    saveWsTrafficGeom();
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
  };

  const onDown = (e) => {
    if (e.target.closest('button')) return;
    if (dock.classList.contains('collapsed')) {
      // collapsed: click head expands
      if (e.type === 'mousedown' || e.type === 'touchstart') {
        setWsTrafficCollapsed(false);
      }
      return;
    }
    const pt = e.touches ? e.touches[0] : e;
    const rect = dock.getBoundingClientRect();
    dragging = true;
    ox = pt.clientX - rect.left;
    oy = pt.clientY - rect.top;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
    e.preventDefault();
  };

  head.addEventListener('mousedown', onDown);
  head.addEventListener('touchstart', onDown, { passive: false });

  // Persist size after resize
  if (typeof ResizeObserver !== 'undefined') {
    let t = null;
    new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(saveWsTrafficGeom, 200);
    }).observe(dock);
  }
}

function initWsTrafficDock() {
  const dock = document.getElementById('wsTrafficDock');
  if (!dock) return;

  restoreWsTrafficGeom();

  try {
    const collapsed = localStorage.getItem(wsTrafficStorageKey('collapsed')) === '1';
    setWsTrafficCollapsed(collapsed);
    const visible = localStorage.getItem(wsTrafficStorageKey('visible'));
    setWsTrafficVisible(visible !== '0');
  } catch (_) {
    setWsTrafficVisible(true);
  }

  document.getElementById('wsTrafficCollapse')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setWsTrafficCollapsed(!dock.classList.contains('collapsed'));
  });
  document.getElementById('wsTrafficHide')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setWsTrafficVisible(false);
  });
  document.getElementById('wsTrafficFab')?.addEventListener('click', () => {
    setWsTrafficVisible(true);
  });
  document.getElementById('wsTrafficClear')?.addEventListener('click', clearWsTraffic);
  document.getElementById('wsTrafficCopy')?.addEventListener('click', copyWsTraffic);
  document.getElementById('wsTrafficPause')?.addEventListener('click', (e) => {
    wsTrafficState.paused = !wsTrafficState.paused;
    e.currentTarget.classList.toggle('active', wsTrafficState.paused);
    e.currentTarget.textContent = wsTrafficState.paused ? '▶' : '❚❚';
    e.currentTarget.title = wsTrafficState.paused ? 'Tiếp tục ghi log' : 'Tạm dừng ghi log';
  });

  bindWsTrafficDrag();

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
      e.preventDefault();
      const visible = dock.style.display !== 'none';
      setWsTrafficVisible(!visible);
    }
  });
}

initWsTrafficDock();

document.addEventListener('visibilitychange', () => {
  document.body.classList.toggle('tab-hidden', document.hidden);
  if (document.hidden) {
    if (_spriteRaf) {
      cancelAnimationFrame(_spriteRaf);
      _spriteRaf = 0;
    }
  } else if (typeof ensureSpritePackTicker === 'function') {
    ensureSpritePackTicker();
  }
});
if (document.hidden) document.body.classList.add('tab-hidden');

// ─── Boot — preload while login is visible ───────────────────
startAssetPreload();

// Service worker: cache assets → lần mở sau gần như instant
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
