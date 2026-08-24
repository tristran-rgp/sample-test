// End-to-end offline gameplay in happy-dom with the REAL index.html DOM.
// One test = one uninterrupted session (single DOM lifecycle), mirroring a
// real player: boot → intro splash → Space to spin → reel settle → cheat panel.
import { describe, expect, it } from 'vitest';
import { state } from '../src/core/state.js';

async function waitFor(cond, timeoutMs = 20000, step = 100) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (cond()) return true;
    await new Promise(r => setTimeout(r, step));
  }
  return cond();
}

describe('offline gameplay (real index.html DOM)', () => {
  it('boots, spins via Space shortcut, settles, and opens cheat panel', async () => {
    await import('../src/main.js');

    // ── Play offline ──
    document.getElementById('btnPlayOffline').click();
    expect(document.getElementById('game').classList.contains('visible')).toBe(true);

    // initUI builds the 5×3 grid
    expect(await waitFor(() => document.querySelectorAll('.cell').length >= 15)).toBe(true);
    expect(document.querySelectorAll('.cell').length).toBe(15);

    // intro splash blocks input by design — wait like a real player would
    expect(await waitFor(() =>
      document.getElementById('splash')?.classList.contains('hidden') ?? false
    )).toBe(true);

    // ── Spin via keyboard shortcut ──
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
    expect(state.spinning || state.fxPlaying).toBe(true);
    expect(await waitFor(() => !state.spinning && !state.fxPlaying)).toBe(true);
    expect(state.grid.length).toBe(5);
    expect(state.grid.flat().length).toBe(15);
    expect(state.balance).not.toBe(10000); // bet was deducted (win may add back)

    // ── Cheat panel via bare c ──
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
    expect(document.getElementById('modalCheat')?.classList.contains('open')).toBe(true);
  }, 60000);
});
