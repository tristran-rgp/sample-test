import { beforeEach, describe, expect, it } from 'vitest';
import { state } from '../src/core/state.js';
import {
  calcTotalWin,
  calcWays,
  countScatters,
  createEmptyGrid,
  getEffectiveSymbols,
  splitCountOf,
} from '../src/game/grid.js';
import { getSymbolPayMult } from '../src/core/utils.js';

/** Build a 5×3 grid from rows of column arrays: cols = [['A','A','A'], ...] */
function setGrid(cols) {
  state.grid = cols.map(c => [...c]);
}

beforeEach(() => {
  createEmptyGrid();
  state.bet = 1;
  state.globalMultiplier = 1;
  state.bypassProtocol = false;
});

describe('splitCountOf', () => {
  it('treats missing/≤1 as single piece', () => {
    expect(splitCountOf(undefined)).toBe(1);
    expect(splitCountOf({ split: 1 })).toBe(1);
    expect(splitCountOf({ split: 0 })).toBe(1);
  });
  it('clamps to the 1 → 2 → 4 ladder', () => {
    expect(splitCountOf({ split: 2 })).toBe(2);
    expect(splitCountOf({ split: 3 })).toBe(2);
    expect(splitCountOf({ split: 4 })).toBe(4);
    expect(splitCountOf({ split: 99 })).toBe(4);
  });
});

describe('getEffectiveSymbols', () => {
  it('mystery cells collapse to M regardless of symbol', () => {
    state.grid[0][0] = 'A';
    state.cellMeta[0][0].mystery = true;
    expect(getEffectiveSymbols(0, 0)).toEqual(['M']);
  });
  it('split cells repeat their symbol', () => {
    state.grid[1][2] = 'K';
    state.cellMeta[1][2].split = 4;
    expect(getEffectiveSymbols(1, 2)).toEqual(['K', 'K', 'K', 'K']);
  });
});

describe('getSymbolPayMult', () => {
  it('maps length 3/4/5 onto pays indices', () => {
    // SYMBOLS.A.pays = [0, 0, 0.75, 1.00, 1.50]
    expect(getSymbolPayMult('A', 3)).toBe(0.75);
    expect(getSymbolPayMult('A', 4)).toBe(1.0);
    expect(getSymbolPayMult('A', 5)).toBe(1.5);
  });
  it('returns 0 for short chains and unknown symbols', () => {
    expect(getSymbolPayMult('A', 2)).toBe(0);
    expect(getSymbolPayMult('Z', 4)).toBe(0);
  });
});

describe('calcWays', () => {
  it('computes ways across left-to-right consecutive reels', () => {
    setGrid([
      ['A', 'A', 'B'],
      ['A', 'B', 'A'],
      ['A', 'A', 'K'],
      ['B', 'B', 'B'],
      ['K', 'K', 'K'],
    ]);
    const wins = calcWays('ltr');
    const a = wins.find(w => w.sym === 'A');
    expect(a.length).toBe(3);
    expect(a.winCount).toBe(2 * 2 * 2); // 2 per reel: [A,A,B] / [A,B,A] / [A,A,K]
    expect(a.win).toBeCloseTo(8 * 0.75); // × paymult(A,3) × bet 1
  });

  it('wilds substitute present symbols but never invent absent ones', () => {
    setGrid([
      ['W', 'W', 'W'],
      ['B', 'F', 'F'],
      ['B', 'B', 'B'],
      ['F', 'F', 'F'],
      ['F', 'F', 'F'],
    ]);
    const wins = calcWays('ltr');
    expect(wins.map(w => w.sym)).toEqual(['B']); // no phantom A/K wins from wilds
    const b = wins[0];
    expect(b.length).toBe(3);
    expect(b.winCount).toBe(3 * 1 * 3);
    expect(b.win).toBeCloseTo(9 * 0.5);
  });

  it('ignores leftover Overclock M on Wild when scoring another symbol', () => {
    setGrid([
      ['B', 'F', 'F'],
      ['W', 'F', 'F'],
      ['B', 'F', 'F'],
      ['F', 'F', 'F'],
      ['F', 'F', 'F'],
    ]);
    state.cellMeta[1][0].multiplier = 10;
    const b = calcWays('ltr').find(w => w.sym === 'B');
    expect(b.win).toBeCloseTo(0.5);
  });

  it('applies the max cell multiplier within the winning chain', () => {
    setGrid([
      ['A', 'A', 'A'],
      ['A', 'A', 'A'],
      ['A', 'A', 'A'],
      ['F', 'F', 'F'],
      ['F', 'F', 'F'],
    ]);
    state.cellMeta[1][1].multiplier = 10;
    const [a] = calcWays('ltr');
    expect(a.winCount).toBe(27);
    expect(a.cx).toBe(0.75);
    expect(a.win).toBeCloseTo(27 * 0.75 * 10); // ways × pay × bet(1) × cell mult
  });
});

describe('calcTotalWin', () => {
  const fullA = () =>
    setGrid([
      ['A', 'A', 'A'],
      ['A', 'A', 'A'],
      ['A', 'A', 'A'],
      ['A', 'A', 'A'],
      ['A', 'A', 'A'],
    ]);

  it('sums ways and applies the global multiplier', () => {
    fullA();
    const base = calcTotalWin().total; // ltr only
    expect(base).toBeCloseTo(243 * 1.5);
    state.globalMultiplier = 2;
    expect(calcTotalWin().total).toBeCloseTo(base * 2);
  });

  it('adds right-to-left ways when Bypass Protocol is active', () => {
    fullA();
    const oneWay = calcTotalWin();
    expect(oneWay.wins.every(w => w.direction === 'ltr')).toBe(true);
    state.bypassProtocol = true;
    const both = calcTotalWin();
    expect(both.wins.some(w => w.direction === 'rtl')).toBe(true);
    expect(both.total).toBeCloseTo(oneWay.total * 2);
  });

  it('caps total win at WIN_CAP × bet', () => {
    fullA();
    state.globalMultiplier = 500; // force way past the cap
    const r = calcTotalWin();
    expect(r.capped).toBe(true);
    expect(r.total).toBe(19693);
    expect(r.cap).toBe(19693);
  });
});

describe('countScatters', () => {
  it('counts scatter symbols on the grid', () => {
    setGrid([
      ['S', 'A', 'A'],
      ['A', 'S', 'A'],
      ['A', 'A', 'A'],
      ['A', 'A', 'A'],
      ['S', 'A', 'A'],
    ]);
    expect(countScatters()).toBe(3);
  });
});
