// src/ui/reels.js — extracted from main.js
import { state } from '../core/state.js';
import { easeOutQuint, sleepRaw } from '../core/utils.js';
import { REELS, ROWS, SYMBOLS } from '../game/config.js';
import { spinReel } from '../game/grid.js';
import { set_lastSpinTickAt, sfx, sfxReelLand, sfxSpinTick, unlockAudio } from '../sfx/sfx.js';
import { renderGrid } from './render.js';
import { createSymbolEl } from './sprites.js';

export function buildSpinStripSymbols(strip, result3, count) {
  const pool = strip.filter(s => !state.blockedSymbols.includes(s));
  const use = pool.length ? pool : strip;
  // Results first, then filler — spin scrolls DOWN (y increases toward 0)
  const symbols = [result3[0], result3[1], result3[2]];
  for (let i = 3; i < count; i++) symbols.push(use[Math.floor(Math.random() * use.length)]);
  return symbols;
}

export function createStripReel(reelIndex, symbols, cellH) {
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

export async function animateReelSpin(strips, forcedResults = null) {
  const results = forcedResults || strips.map(s => spinReel(s, state.blockedSymbols));
  const grid = document.getElementById('reelsGrid');
  const wrap = document.getElementById('reelsWrapper');

  const gridRect = grid.getBoundingClientRect();
  let cellH = Math.max(48, (gridRect.height || wrap?.clientHeight || 270) / ROWS);

  unlockAudio();
  set_lastSpinTickAt(0);
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
