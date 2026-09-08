// src/ui/preload.js — extracted from main.js
import { CORE_HACK, FEATURES, JACKPOT_CORE_IMG, LETTER_SYMS, MYSTERY_FILE } from '../game/config.js';
import { ASSET, assetUrl } from './assets.js';
import { SPRITE_PACK_BASE, SYM_SPRITES } from './sprites.js';

export let _preloadPromise = null;
export let _preloadDone = 0;
export let _preloadTotal = 0;

export function listPreloadUrls() {
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
  add(ASSET + 'art-new/background.webp');
  add(ASSET + 'art-new/panel-reel.webp');
  add(ASSET + 'art-new/layer-top-banner-bar.webp');
  add(ASSET + 'art-new/panel-feature-meter.webp');
  add(ASSET + 'art-new/panel-bottom.webp');
  add(ASSET + 'art-new/panel-balance.webp');
  add(ASSET + 'art-new/panel-bet.webp');
  add(ASSET + 'art-new/panel-win-amount.webp');
  add(ASSET + 'art-new/panel-show-multi.webp');
  add(ASSET + 'art-new/pannel-total-balance.webp');
  add(ASSET + 'art-new/btn-spin.webp');
  add(ASSET + 'art-new/btn-auto-spin.webp');
  add(ASSET + 'art-new/btn-fast-spin.webp');
  return [...urls];
}

/** Heavy/rarely-shown assets — load in background after critical set. */
export function listDeferredUrls() {
  const urls = new Set();
  const add = (p) => { if (p) urls.add(assetUrl(p)); };
  add(SPRITE_PACK_BASE + 'animation-sequence.webp');
  add(CORE_HACK.img);
  for (const f of FEATURES) add(f.img);
  add(JACKPOT_CORE_IMG);
  return [...urls];
}

export function preloadOne(url) {
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => resolve();
    img.onload = done;
    img.onerror = done;
    img.src = url;
  });
}

export function updateLoginLoadUi() {
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

export function startAssetPreload() {
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

export function assetsReady() {
  return _preloadTotal > 0 && _preloadDone >= _preloadTotal;
}
