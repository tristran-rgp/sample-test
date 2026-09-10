// src/game/grid.js — extracted from main.js
import { state } from '../core/state.js';
import { getSymbolPayMult } from '../core/utils.js';
import { PAYING, REELS, ROWS, WIN_CAP } from './config.js';
import { setCellSplit } from '../ui/vfx/core.js';

// ─── Grid helpers ────────────────────────────────────────────
/** Ô chờ data (session screen / spin land) — render thành loading, không phải symbol. */
export function isIdleSym(sym) {
  return !PAYING.includes(sym) && sym !== 'W' && sym !== 'S' && sym !== 'M';
}

export function createEmptyGrid() {
  // null = chưa có reel data. Không fill 'F' (Bitcoin) — idle hiện loading.
  state.grid = Array.from({ length: REELS }, () => Array(ROWS).fill(null));
  state.cellMeta = Array.from({ length: REELS }, () =>
    Array.from({ length: ROWS }, () => ({ split: 1, multiplier: 1, mystery: false }))
  );
}

/** Piece count of a split cell: 1 = no split, 2 / 4 = pieces (stacked 1 → 2 → 4, cap 4). */
export function splitCountOf(meta) {
  const n = Number(meta?.split);
  if (!n || n <= 1) return 1;
  return n >= 4 ? 4 : 2;
}

/** Double a cell's pieces (1 → 2 → 4), capped at 4. */
export function stackCellSplit(c, r) {
  if (!state.cellMeta?.[c]?.[r]) return;
  setCellSplit(c, r, splitCountOf(state.cellMeta[c][r]) * 2);
}

export function getEffectiveSymbols(reel, row) {
  const sym = state.grid[reel][row];
  const meta = state.cellMeta[reel][row];
  if (meta.mystery) return ['M'];
  return Array(splitCountOf(meta)).fill(sym);
}

export function getReelSymbols(reel) {
  const syms = [];
  for (let r = 0; r < ROWS; r++) syms.push(...getEffectiveSymbols(reel, r));
  return syms;
}

export function spinReel(strip, blocked = []) {
  const avail = strip.filter(s => !blocked.includes(s));
  const use = avail.length ? avail : strip;
  const start = Math.floor(Math.random() * use.length);
  return [0,1,2].map(i => use[(start + i) % use.length]);
}

// ─── 243 Ways Calculator ─────────────────────────────────────
export function calcWays(direction = 'ltr') {
  const wins = [];
  const reels = direction === 'ltr' ? [...Array(REELS).keys()] : [...Array(REELS).keys()].reverse();
  const startReel = reels[0];

  // Wild chỉ substitute cho pay symbol có mặt trên grid (không stand-in cho type vắng mặt).
  const presentPay = new Set();
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (PAYING.includes(state.grid[c][r])) presentPay.add(state.grid[c][r]);
    }
  }

  for (const sym of PAYING) {
    if (!presentPay.has(sym)) continue;
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

      // Class Upgrade: max M on remaining instances of this pay symbol (once).
      // Wild substitutes for ways but must not carry another type's Overclock M.
      let symMult = 1;
      for (let ri = 0; ri < length; ri++) {
        const realReel = reels[ri];
        for (let r = 0; r < ROWS; r++) {
          if (state.grid[realReel][r] === sym) {
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

export function calcTotalWin() {
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

export function countScatters() {
  let n = 0;
  for (let c = 0; c < REELS; c++)
    for (let r = 0; r < ROWS; r++)
      if (state.grid[c][r] === 'S') n++;
  return n;
}
