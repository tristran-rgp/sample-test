import { beforeEach, describe, expect, it } from 'vitest';
import { state } from '../src/core/state.js';
import { applyAlgorithmicScan, applyDataOverload, applyPowerSurge } from '../src/game/features.js';
import { calcWays, createEmptyGrid } from '../src/game/grid.js';
import { applyCellMultipliers } from '../src/net/session.js';
import { paintCell } from '../src/ui/render.js';
import { applyStepChanges, setCellSymbol } from '../src/ui/vfx/core.js';

function fillGrid(sym) {
  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < 3; r++) state.grid[c][r] = sym;
  }
}

beforeEach(() => {
  createEmptyGrid();
  state.bet = 1;
  state.globalMultiplier = 1;
  state.bypassProtocol = false;
});

describe('Class Upgrade badge drops when Wild overlays', () => {
  it('setCellSymbol(W) clears the cell multiplier', () => {
    state.grid[0][1] = 'A';
    state.cellMeta[0][1].multiplier = 8;
    setCellSymbol(0, 1, 11);
    expect(state.grid[0][1]).toBe('W');
    expect(state.cellMeta[0][1].multiplier).toBe(1);
  });

  it('applyStepChanges to Wild (id 11) clears Overclock M', () => {
    state.grid[2][0] = 'K';
    state.cellMeta[2][0].multiplier = 3;
    applyStepChanges([{ pos: [2, 0], from: 10, to: 11 }]);
    expect(state.grid[2][0]).toBe('W');
    expect(state.cellMeta[2][0].multiplier).toBe(1);
  });

  it('PowerSurge epicenter Wild drops Class Upgrade M', async () => {
    fillGrid('S');
    state.grid[1][1] = 'A';
    state.cellMeta[1][1].multiplier = 5;
    await applyPowerSurge();
    expect(state.grid[1][1]).toBe('W');
    expect(state.cellMeta[1][1].multiplier).toBe(1);
  });

  it('AlgorithmicScan Wild overlay drops Class Upgrade M', async () => {
    fillGrid('S');
    state.grid[4][2] = 'B';
    state.cellMeta[4][2].multiplier = 10;
    await applyAlgorithmicScan();
    expect(state.grid[4][2]).toBe('W');
    expect(state.cellMeta[4][2].multiplier).toBe(1);
  });

  it('DataOverload expanding a column to Wild drops leftover M', async () => {
    fillGrid('S');
    state.grid[0][0] = 'W';
    state.grid[0][1] = 'A';
    state.cellMeta[0][1].multiplier = 3;
    await applyDataOverload();
    expect(state.grid[0][1]).toBe('W');
    expect(state.cellMeta[0][1].multiplier).toBe(1);
  });

  it('applyCellMultipliers does not stamp M onto a Wild cell', () => {
    state.grid[1][2] = 'W';
    state.cellMeta[1][2].multiplier = 1;
    applyCellMultipliers({ '2,1': 10 });
    expect(state.cellMeta[1][2].multiplier).toBe(1);
  });

  it('paintCell never renders a Class Upgrade badge on Wild', () => {
    state.grid[0][0] = 'W';
    state.cellMeta[0][0].multiplier = 3;
    const cell = document.createElement('div');
    paintCell(cell, 0, 0, new Set());
    expect(cell.querySelector('.mult-tag')).toBeNull();
  });
});

describe('Class Upgrade payout does not leak from Wild leftover M', () => {
  it('Overclock M on a Wild cell must not boost a different pay-symbol chain', () => {
    state.grid = [
      ['B', 'F', 'F'],
      ['W', 'F', 'F'],
      ['B', 'F', 'F'],
      ['F', 'F', 'F'],
      ['F', 'F', 'F'],
    ];
    state.cellMeta[1][0].multiplier = 10;
    const win = calcWays('ltr').find(w => w.sym === 'B');
    expect(win).toBeTruthy();
    expect(win.win).toBeCloseTo(0.5);
  });
});
