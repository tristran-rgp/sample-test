// src/game/features.js — extracted from main.js
import { state } from '../core/state.js';
import { rand, randInt, shuffle, sleep } from '../core/utils.js';
import { FEATURES, HIGHS, LOWS, PAYING, REELS, ROWS, SYMBOLS } from './config.js';
import { calcTotalWin, splitCountOf, stackCellSplit } from './grid.js';
import { showToast } from '../ui/feedback.js';
import { renderGrid } from '../ui/render.js';
import { highlightCells } from '../ui/vfx/core.js';

// ─── Feature Engine ──────────────────────────────────────────
export function selectRandomFeatures(count) {
  const pool = [...FEATURES];
  const selected = [];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    selected.push(pool.splice(idx, 1)[0]);
  }
  return selected.sort((a, b) => FEATURES.indexOf(a) - FEATURES.indexOf(b));
}

export function maybeTriggerFeatures() {
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

export async function applyFirewallBlock() {
  const n = randInt(1, 2);
  state.blockedSymbols = shuffle(LOWS).slice(0, n);
  showToast(`🔥 Firewall Block: ${state.blockedSymbols.map(s => SYMBOLS[s].name).join(', ')} blocked`, '#ff3355');
  await sleep(600);
}

export async function applyDataDecrypt() {
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

export async function applyTrojanHorse() {
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

function stampWild(c, r) {
  state.grid[c][r] = 'W';
  if (state.cellMeta[c]?.[r]) state.cellMeta[c][r].multiplier = 1;
}

export async function applyDataOverload() {
  let hasWild = false;
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (state.grid[c][r] === 'W') {
        hasWild = true;
        for (let rr = 0; rr < ROWS; rr++) stampWild(c, rr);
      }
    }
  }
  if (hasWild) { showToast('⚡ Data Overload: Wild columns expanded!', '#ff8800'); await sleep(700); }
}

export async function applySystemOverclock() {
  const sym = rand(PAYING);
  const mult = rand([3, 5, 8, 10]);
  for (let c = 0; c < REELS; c++)
    for (let r = 0; r < ROWS; r++)
      if (state.grid[c][r] === sym) state.cellMeta[c][r].multiplier = mult;
  showToast(`🔥 System Overclock: ${SYMBOLS[sym].name} ×${mult}`, '#ff8800');
  await sleep(600);
}

export async function applyDataCloning() {
  const present = [];
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const s = state.grid[c][r];
      if ((PAYING.includes(s) || s === 'W') && !present.includes(s)) present.push(s);
    }
  }
  if (!present.length) {
    showToast('🧬 Data Cloning: no pay types on grid', '#00ff88');
    await sleep(400);
    return;
  }
  const sym = rand(present);
  const keys = [];
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (state.grid[c][r] === sym) {
        stackCellSplit(c, r);
        keys.push(`${c},${r}`);
      }
    }
  }
  const pieces = keys.some(k => splitCountOf(state.cellMeta[k.split(',')[0]]?.[k.split(',')[1]]) === 4) ? '×4' : '×2';
  showToast(`🧬 Data Cloning: ${SYMBOLS[sym].name} ${pieces}`, '#00ff88');
  renderGrid();
  await highlightCells(keys, 'vfx-split', state.fastSpin ? 280 : 600);
}

export async function applyRootAccess() {
  const n = randInt(1, 3);
  const reels = shuffle([...Array(REELS).keys()]).slice(0, n);
  const keys = [];
  for (const c of reels) {
    document.getElementById(`reel-${c}`)?.classList.add('vfx-col-root');
    for (let r = 0; r < ROWS; r++) {
      if (state.grid[c][r] !== 'S') {
        stackCellSplit(c, r);
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

export async function applyPowerSurge() {
  // GDD §4.3: pick 1–2 pay cells (ids 1–10, không Wild/Scatter) → Wild;
  // 8 ô kề (cả chéo) bị split ×2 trừ Scatter; epicenter không tự tách.
  const eligible = [];
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const sym = state.grid[c][r];
      if (PAYING.includes(sym)) eligible.push({ c, r });
    }
  }
  if (!eligible.length) {
    showToast('⚡ Power Surge: no pay cells on grid', '#ffff00');
    await sleep(400);
    return;
  }
  const n = eligible.length >= 2 && Math.random() < 0.1 ? 2 : 1;
  const epicenters = shuffle(eligible).slice(0, Math.min(n, eligible.length));
  const epicenterSet = new Set(epicenters.map(p => `${p.c},${p.r}`));
  for (const { c, r } of epicenters) {
    stampWild(c, r);
  }
  const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  for (const { c, r } of epicenters) {
    for (const [dc, dr] of dirs) {
      const nc = c + dc, nr = r + dr;
      if (nc >= 0 && nc < REELS && nr >= 0 && nr < ROWS
          && state.grid[nc][nr] !== 'S'
          && !epicenterSet.has(`${nc},${nr}`)) {
        stackCellSplit(nc, nr);
      }
    }
  }
  showToast(`⚡ Power Surge: ${epicenters.length} ô → Wild`, '#ffff00');
  await sleep(700);
}

export async function applySystemGlitch() {
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

export async function applyAlgorithmicScan() {
  // Pick 1–3 pay cells (ids 1–10) → Wild — matches BE AlgorithmicScanFeature.
  const payCells = [];
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (PAYING.includes(state.grid[c][r])) payCells.push({ c, r });
    }
  }
  if (!payCells.length) {
    showToast('🎯 Algorithmic Scan: no pay cells on grid', '#00f0ff');
    await sleep(400);
    return;
  }
  const n = Math.min(randInt(1, 3), payCells.length);
  const targets = shuffle(payCells).slice(0, n);
  for (const { c, r } of targets) stampWild(c, r);
  showToast(`🎯 Algorithmic Scan: ${targets.length} ô → Wild`, '#00f0ff');
  await sleep(600);
}

export function applyBandwidthMultiplier() {
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

export function applyBypassProtocol() {
  state.bypassProtocol = true;
  showToast('↔️ Bypass Protocol: Both-way payouts active!', '#00f0ff');
}

export const FEATURE_HANDLERS = {
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
