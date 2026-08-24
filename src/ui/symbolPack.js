// src/ui/symbolPack.js — extracted from main.js
import { state } from '../core/state.js';
import { DEFAULT_SYMBOL_PACK, LETTER_SYMS, MYSTERY_FILE, SYMBOLS, SYMBOL_PACKS } from '../game/config.js';
import { assetUrl } from './assets.js';
import { renderPaytable } from './buyFeatures.js';
import { showToast } from './feedback.js';
import { renderGrid } from './render.js';
import { ensureSpritePackTicker, preloadSpritePack } from './sprites.js';

export function getSymbolPackId() {
  return state?.symbolPack && SYMBOL_PACKS[state.symbolPack]
    ? state.symbolPack
    : DEFAULT_SYMBOL_PACK;
}

export function symbolPackLabel(packId = getSymbolPackId()) {
  return SYMBOL_PACKS[packId]?.label || SYMBOL_PACKS.classic.label;
}

/** Apply art pack paths onto SYMBOLS; re-render grid/paytable when UI ready. */
export function applySymbolPack(packId, { persist = true, toast = false, rerender = true } = {}) {
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

export function cycleSymbolPack() {
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
