// src/ui/fsIntro.js — full-screen "DEEP WEB INFILTRATION" cinematic before the FS modal
import { state } from '../core/state.js';
import { sleepRaw } from '../core/utils.js';
import { sfx } from '../sfx/sfx.js';

/**
 * Screen glitch → logo slam → spins countdown. Resolves when done
 * (caller then opens the FS trigger modal as usual).
 */
export async function playFsIntroCinematic({ remain = 7, features = [], scatters = 0 } = {}) {
  const overlay = document.createElement('div');
  overlay.id = 'fsIntroCine';
  const featLine = features.length ? features.map(f => f.name).join(' · ') : '';
  overlay.innerHTML =
    '<div class="fs-cine-glitch"></div>' +
    '<div class="fs-cine-core">' +
      '<div class="fs-cine-kicker">// INCOMING TRANSMISSION' +
        (scatters ? ` — ${scatters} SCATTERS` : '') + '</div>' +
      '<h2 class="fs-cine-title" data-text="DEEP WEB INFILTRATION">DEEP WEB INFILTRATION</h2>' +
      `<div class="fs-cine-spins"><span class="fs-cine-count">${remain}</span> FREE SPINS</div>` +
      (featLine ? `<div class="fs-cine-feats">${featLine}</div>` : '') +
    '</div>';
  document.body.appendChild(overlay);

  // 1) Glitch burst
  sfx('glitch', { gain: 0.8, force: true });
  await sleepRaw(state.fastSpin ? 140 : 300);

  // 2) Logo slam
  overlay.classList.add('logo-in');
  sfx('hit', { gain: 0.95, force: true });
  await sleepRaw(state.fastSpin ? 420 : 950);

  // 3) Spins countdown
  overlay.classList.add('count-in');
  sfx('charge', { gain: 0.7, pitch: 1.25, force: true });
  await sleepRaw(state.fastSpin ? 420 : 950);

  // 4) Exit
  overlay.classList.add('out');
  await sleepRaw(state.fastSpin ? 160 : 340);
  overlay.remove();
}
