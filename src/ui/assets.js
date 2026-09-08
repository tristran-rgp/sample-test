// src/ui/assets.js — extracted from main.js
import { SYMBOLS } from '../game/config.js';

export const ASSET = 'assert/';

/** All assets are WebP-only (PNG/JPG removed). Canonical paths may still say .png/.jpg. */
export function toPngPath(path) {
  return String(path || '')
    .replace(/\.png(\?|#|$)/i, '.webp$1')
    .replace(/\.jpe?g(\?|#|$)/i, '.webp$1');
}
export function assetUrl(path) {
  const p = toPngPath(path);
  if (!p) return p;
  const v = typeof __ZD_ASSET_VERSION__ !== 'undefined' ? __ZD_ASSET_VERSION__ : '';
  return v && !/[?#]/.test(p) ? p + '?v=' + v : p;
}
export function setImgSrc(el, path) {
  if (!el) return;
  el.src = assetUrl(path);
}
export function imgTag(path, extra = '') {
  return `<img src="${assetUrl(path)}"${extra ? ' ' + extra : ''}>`;
}

/** Letter symbols shared by both art packs (A–K, W, S). Mystery uses pack file name. */
export function symImgHtml(sym, alt = '') {
  const s = SYMBOLS[sym];
  if (!s?.img) return alt || '?';
  return imgTag(s.img, `class="sym-img" alt="${s.name}" draggable="false"`);
}

// Reel strips (weighted)
