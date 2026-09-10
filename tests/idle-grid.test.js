import { describe, expect, it } from 'vitest';
import { state } from '../src/core/state.js';
import { createEmptyGrid, isIdleSym } from '../src/game/grid.js';
import { renderGrid } from '../src/ui/render.js';

describe('idle grid', () => {
  it('does not fill Bitcoin (F) before reel data exists', () => {
    createEmptyGrid();
    const cells = state.grid.flat();
    expect(cells).toHaveLength(15);
    expect(cells.every(s => s == null)).toBe(true);
    expect(cells.includes('F')).toBe(false);
    expect(cells.every(isIdleSym)).toBe(true);
  });

  it('renders loading placeholders until symbols arrive', () => {
    createEmptyGrid();
    renderGrid();
    expect(document.querySelectorAll('#reelsGrid .cell')).toHaveLength(15);
    expect(document.querySelectorAll('#reelsGrid .cell-loading')).toHaveLength(15);
    expect(document.querySelectorAll('#reelsGrid .sym-load')).toHaveLength(15);
    expect(document.querySelectorAll('#reelsGrid .sym-img')).toHaveLength(0);

    state.grid[0][0] = 'A';
    renderGrid();
    const first = document.querySelector('#reelsGrid .cell[data-reel="0"][data-row="0"]');
    expect(first.classList.contains('cell-loading')).toBe(false);
    expect(first.querySelector('.sym-img')).toBeTruthy();
    expect(document.querySelectorAll('#reelsGrid .cell-loading')).toHaveLength(14);
  });
});
