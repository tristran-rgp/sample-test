// 1504 history list with the BE display join: each spin row (kind=spin) may be
// followed by a jackpot row (kind=jackpot_win) sharing the same roundId.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/net/session.js', () => ({ requestGameCmd: vi.fn() }));
vi.mock('../src/core/state.js', () => ({ ws: { readyState: 1 } }));

import { requestGameCmd } from '../src/net/session.js';
import { renderHistoryOnline, rowHtml } from '../src/ui/historyOnline.js';

const SPIN = {
  kind: 'spin',
  spinId: 'spin-1',
  roundId: 'round-1',
  spinIndex: 1,
  gameId: 'yama_01023',
  betAmount: 10,
  totalWin: 25,
  win: 25,
  profit: 15,
  mode: 'base',
  timestamp: '2026-04-28T04:00:00Z',
};
const JACKPOT = {
  kind: 'jackpot_win',
  spinId: 'spin-1',
  roundId: 'round-1',
  winId: 'win-1',
  betAmount: 0,
  totalBet: 0,
  totalWin: 100,
  win: 100,
  jackpotWonTier: 'GOD',
  jackpotType: 'GOD',
  jackpotWonAmount: 100,
  profit: 100,
  timestamp: '2026-04-28T05:00:00Z',
};

beforeEach(() => {
  globalThis.WebSocket = { OPEN: 1 };
  vi.clearAllMocks();
});

describe('1504 history list with jackpot rows', () => {
  it('renders spin + jackpot rows in order with shared roundId', async () => {
    requestGameCmd.mockResolvedValue({ spins: [SPIN, JACKPOT] });
    await renderHistoryOnline();
    const items = document.querySelectorAll('#historyList .history-item');
    expect(items.length).toBe(2);
    expect(items[0].dataset.kind).toBe('spin');
    expect(items[0].dataset.roundId).toBe('round-1');
    expect(items[1].dataset.kind).toBe('jackpot_win');
    expect(items[1].dataset.roundId).toBe('round-1');
    expect(items[1].dataset.winId).toBe('win-1');
    expect(items[1].textContent).toContain('GOD');
  });

  it('clicking a jackpot row opens the triggering spin detail (1506)', async () => {
    requestGameCmd.mockImplementation(async (cmd) => {
      if (cmd === '1504') return { spins: [SPIN, JACKPOT] };
      return null; // 1506 detail
    });
    await renderHistoryOnline();
    document.querySelector('#historyList .history-item[data-kind="jackpot_win"]').click();
    expect(requestGameCmd).toHaveBeenCalledWith(
      '1506',
      expect.objectContaining({ spinId: 'spin-1' }),
    );
  });

  it('rowHtml keeps plain spins unchanged (no jackpot tag)', () => {
    const html = rowHtml({ ...SPIN }, 0);
    expect(html).toContain('data-kind="spin"');
    expect(html).not.toContain('JACKPOT');
  });
});
