// src/ui/splash.js — extracted from main.js
import { sleep } from '../core/utils.js';
import { assetsReady, startAssetPreload, updateLoginLoadUi } from './preload.js';

export async function splash() {
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
