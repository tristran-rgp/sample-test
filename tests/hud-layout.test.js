import { describe, expect, it } from 'vitest';
import { state } from '../src/core/state.js';
import { listPreloadUrls } from '../src/ui/preload.js';
import { setInfoBar, updateUI } from '../src/ui/render.js';
import { tickerWin } from '../src/ui/winfx.js';
import { fmt, fmtBalance } from '../src/core/utils.js';

describe('grid top HUD', () => {
  it('places win amount in the center neon and multi on the right pad', () => {
    const hud = document.getElementById('gridTopHud');
    const win = document.getElementById('headerWin');
    const multi = document.getElementById('multDisplay');
    expect(hud).toBeTruthy();
    expect(win).toBeTruthy();
    expect(multi).toBeTruthy();
    expect(hud.contains(win)).toBe(true);
    expect(hud.contains(multi)).toBe(true);
    expect(win.closest('.grid-hud-win')).toBeTruthy();
    expect(multi.closest('.mult-box')).toBeTruthy();
    expect(document.querySelector('.bottom-bar #headerWin')).toBeNull();
    expect(document.querySelector('.meter-shell .mult-box')).toBeNull();
  });


  it('formats bet and balance with consistent $ currency', () => {
    expect(fmt(1)).toBe('$1.00');
    expect(fmtBalance(12345.67)).toBe('$0012345.67');
    expect(fmtBalance(1000)).toBe('$0001000.00');
    state.balance = 12345.67;
    state.balanceBefore = 1000;
    state.bet = 1;
    state.lastWin = 0;
    state.globalMultiplier = 1;
    updateUI();
    expect(document.getElementById('balanceDisplay').textContent).toBe('$0012345.67');
    expect(document.getElementById('balanceBeforeDisplay').textContent).toBe('$0001000.00');
    expect(document.getElementById('betAmount').textContent).toBe('$1.00');
  });

  it('updateUI writes win and multiplier into the HUD', () => {
    state.lastWin = 12.5;
    state.globalMultiplier = 8;
    state.balance = 1000;
    state.balanceBefore = 900;
    state.bet = 1;
    updateUI();
    expect(document.getElementById('headerWin').textContent).toBe('12.50');
    expect(document.getElementById('multDisplay').textContent).toBe('08');
  });

  it('preloads the reel-top banner art', () => {
    const urls = listPreloadUrls();
    expect(urls.some(u => String(u).includes('layer-top-banner-bar'))).toBe(true);
    expect(urls.some(u => String(u).includes('panel-feature-meter'))).toBe(true);
    expect(urls.some(u => String(u).includes('panel-bottom'))).toBe(true);
  });

  it('clusters bottom-bar chips under the game frame', () => {
    const bar = document.querySelector('.bottom-bar');
    const playfield = document.querySelector('.playfield');
    const frame = document.querySelector('.game-frame');
    expect(bar).toBeTruthy();
    expect(playfield).toBeTruthy();
    expect(frame).toBeTruthy();
    expect(playfield.contains(bar)).toBe(true);
    expect(frame.contains(bar)).toBe(false);
    expect(bar.querySelectorAll('.bb-chip')).toHaveLength(3);
    expect(bar.querySelector('.bb-bet #betAmount')).toBeTruthy();
    expect(bar.querySelector('.bb-before #balanceBeforeDisplay')).toBeTruthy();
    expect(bar.querySelector('.bb-balance #balanceDisplay')).toBeTruthy();
  });

  it('sizes art-new bottom plaques by native PNG aspect ratio', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/style.css', 'utf8');
    expect(css).toMatch(/\.bb-bet\s*\{[^}]*width:\s*calc\(var\(--bb-h\) \* 240 \/ 186\)/s);
    expect(css).toMatch(/\.bb-before,\s*\n\s*body\.pack-art-new \.bottom-bar \.bb-balance\s*\{[^}]*width:\s*calc\(var\(--bb-h\) \* 587 \/ 200\)/s);
    expect(css).toMatch(/\.bb-before,\s*\n\s*body\.pack-art-new \.bottom-bar \.bb-balance\s*\{[^}]*aspect-ratio:\s*587\s*\/\s*200/s);
    expect(css).toMatch(/\.bb-before,\s*\n\s*body\.pack-art-new \.bottom-bar \.bb-balance\s*\{[^}]*pannel-total-balance\.webp/s);
    expect(css).toMatch(/\.bb-bet\s*\{[^}]*aspect-ratio:\s*240\s*\/\s*186/s);
    expect(css).toMatch(/background-size:\s*100%\s*100%/);
    expect(css).not.toMatch(/panel-bet\.png'\) center \/ 100% 140%/);
  });

  it('does not put WIN $ amount into the info-bar', () => {
    const bar = document.getElementById('infoBar');
    setInfoBar('idle', 'Spinning...');
    setInfoBar('win', 'WIN $20.00');
    expect(bar.classList.contains('win-result')).toBe(false);
    expect(bar.textContent).not.toMatch(/WIN\s*\$/);
    expect(bar.textContent).toContain('Spinning...');
  });

  it('tickerWin updates HUD only, not the info-bar', async () => {
    const bar = document.getElementById('infoBar');
    setInfoBar('idle', 'Spinning...');
    await tickerWin(0, 20);
    expect(document.getElementById('headerWin').textContent).toBe('20.00');
    expect(bar.classList.contains('win-result')).toBe(false);
    expect(bar.textContent).not.toMatch(/WIN\s*\$/);
  });
});
