import { beforeEach, describe, expect, it } from 'vitest';
import { state } from '../src/core/state.js';
import { createEmptyGrid } from '../src/game/grid.js';
import { maybeTriggerFeatures, selectRandomFeatures } from '../src/game/features.js';
import { FEATURES } from '../src/game/config.js';

beforeEach(() => {
  createEmptyGrid();
  state.buy3Features = false;
  state.buy12Features = false;
  state.inFreeSpins = false;
  state.persistentFeatures = [];
});

describe('selectRandomFeatures', () => {
  it('returns unique features when count ≤ pool size', () => {
    const picks = selectRandomFeatures(5);
    const ids = new Set(picks.map(f => f.id));
    expect(picks.length).toBe(5);
    expect(ids.size).toBe(5);
  });

  it('every pick belongs to FEATURES and keeps GDD order', () => {
    const picks = selectRandomFeatures(6);
    for (const p of picks) expect(FEATURES.includes(p)).toBe(true);
    const order = picks.map(f => FEATURES.indexOf(f));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('caps at pool size (12 minis)', () => {
    expect(selectRandomFeatures(99).length).toBe(FEATURES.length);
  });
});

describe('maybeTriggerFeatures', () => {
  it('buy-12 returns all features deterministically', () => {
    state.buy12Features = true;
    expect(maybeTriggerFeatures().length).toBe(FEATURES.length);
  });

  it('buy-3 returns exactly 3 unique features', () => {
    state.buy3Features = true;
    const picks = maybeTriggerFeatures();
    expect(picks.length).toBe(3);
    expect(new Set(picks.map(f => f.id)).size).toBe(3);
  });

  it('FS persistent features are preserved (extra may stack)', () => {
    state.inFreeSpins = true;
    state.persistentFeatures = [{ ...FEATURES[0] }];
    const picks = maybeTriggerFeatures();
    expect(picks.some(f => f.id === FEATURES[0].id)).toBe(true);
  });
});
