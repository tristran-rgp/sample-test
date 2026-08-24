import { beforeEach, describe, expect, it } from 'vitest';
import { state } from '../src/core/state.js';
import { createEmptyGrid } from '../src/game/grid.js';
import { countsPerReelFromPositions, waysProduct } from '../src/ui/winExplain.js';
import { parseCheatValue } from '../src/ui/cheat/editor.js';

beforeEach(() => {
  createEmptyGrid();
});

describe('countsPerReelFromPositions', () => {
  it('counts positions per reel from [c,r] pairs', () => {
    const chain = countsPerReelFromPositions([[0, 0], [0, 1], [1, 2]], 3, 'ltr');
    expect(chain).toEqual([2, 1, 1]);
  });
  it('accepts {c,r} objects too', () => {
    const chain = countsPerReelFromPositions([{ c: 2, r: 0 }, { c: 2, r: 1 }], 3, 'ltr');
    expect(chain).toEqual([1, 1, 2]);
  });
  it('builds the chain from the right for rtl', () => {
    const chain = countsPerReelFromPositions([[4, 0], [4, 1], [4, 2], [3, 0], [3, 1], [3, 2]], 3, 'rtl');
    expect(chain).toEqual([3, 3, 1]);
  });
  it('never returns zero inside the chain (min 1)', () => {
    const chain = countsPerReelFromPositions([], 5, 'ltr');
    expect(chain).toEqual([1, 1, 1, 1, 1]);
  });
  it('handles missing positions array (early-returns zero counts, length = REELS)', () => {
    expect(countsPerReelFromPositions(null, 3, 'ltr')).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('waysProduct', () => {
  it('multiplies chain counts', () => {
    expect(waysProduct([3, 2, 2])).toBe(12);
  });
  it('zero anywhere in the chain zeroes the product', () => {
    expect(waysProduct([3, 0, 2])).toBe(0);
  });
  // Current behavior: empty product = identity 1 (callers always pass full chains).
  it('empty/missing → 1', () => {
    expect(waysProduct([])).toBe(1);
    expect(waysProduct(null)).toBe(1);
  });
});

describe('parseCheatValue', () => {
  const withValue = html => {
    let el = document.getElementById('cheatValue');
    if (!el) {
      el = document.createElement('input');
      el.id = 'cheatValue';
      document.body.appendChild(el);
    }
    el.value = html;
  };

  it('parses a JSON object body', () => {
    withValue('{"grid":[["A"]],"features":["firewall"]}');
    expect(parseCheatValue()).toEqual({ grid: [['A']], features: ['firewall'] });
  });

  it('defaults to {} on empty input', () => {
    withValue('');
    expect(parseCheatValue()).toEqual({});
  });

  it('rejects arrays / null / scalars', () => {
    withValue('[1,2]');
    expect(() => parseCheatValue()).toThrow(/JSON object/);
    withValue('null');
    expect(() => parseCheatValue()).toThrow(/JSON object/);
    withValue('"x"');
    expect(() => parseCheatValue()).toThrow(/JSON object/);
  });

  it('wraps syntax errors with a friendly message', () => {
    withValue('{oops');
    expect(() => parseCheatValue()).toThrow(/^Invalid value JSON:/);
  });
});
