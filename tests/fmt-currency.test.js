import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fmt, fmtBalance } from '../src/core/utils.js';
import { state } from '../src/core/state.js';
import { updateUI } from '../src/ui/render.js';

describe('currency ₫', () => {
  it('fmt matches fmtBalance and never uses $', () => {
    expect(fmt(1)).toBe('1.00 ₫');
    expect(fmt(10000)).toBe('10,000.00 ₫');
    expect(fmt(-3.5)).toBe('-3.50 ₫');
    expect(fmt(1)).toBe(fmtBalance(1));
    expect(fmt(80)).not.toMatch(/\$/);
    expect(fmtBalance(1.2)).not.toMatch(/\$/);
  });

  it('HUD bet / balance / win all use ₫', () => {
    state.bet = 1;
    state.balance = 10000;
    state.balanceBefore = 9000;
    state.lastWin = 12.5;
    updateUI();
    expect(document.getElementById('betAmount').textContent).toBe('1.00 ₫');
    expect(document.getElementById('balanceBeforeDisplay').textContent).toBe('9,000.00 ₫');
    expect(document.getElementById('balanceDisplay').textContent).toBe('10,000.00 ₫');
    expect(document.getElementById('headerWin').textContent).toBe('12.50 ₫');
  });

  it('loads Orbitron as the display font', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toMatch(/fonts\.googleapis\.com\/css2\?family=Orbitron/);
    const css = readFileSync('src/style.css', 'utf8');
    expect(css).toMatch(/--font-display:\s*'Orbitron'/);
  });
});
