// src/game/flow.js — extracted from main.js
import { state } from '../core/state.js';
import { sleepRaw } from '../core/utils.js';
import { REF_BET } from './config.js';
import { syncPerfMode } from '../ui/render.js';
import { clearWinFxPosition } from '../ui/winfx.js';

// ─── Presentation gate: auto/FS chỉ spin tiếp khi FX xong ────
export function beginFx() { state.fxPlaying = true; syncPerfMode(); }
export function endFx() { state.fxPlaying = false; syncPerfMode(); }

/**
 * Chờ toàn bộ hiệu ứng UI của spin hiện tại kết thúc
 * (float CSS, overlay, dim-win, toast) trước khi gửi spin kế.
 */
export async function settleAfterSpinPresentation({
  hadWin = false,
  hadFeatures = false,
  totalWin = 0,
} = {}) {
  beginFx();
  try {
    // Win float/ticker đã xong trong animateWinWays — nghỉ ngắn trước spin kế
    if (hadWin) {
      await sleepRaw(state.fastSpin ? 120 : 280);
    } else if (hadFeatures) {
      await sleepRaw(state.fastSpin ? 220 : 450);
    } else {
      // Nhịp nghỉ tối thiểu giữa 2 spin (auto/FS no-win)
      await sleepRaw(state.fastSpin ? 160 : 320);
    }

    // Dọn class/animation còn sót — tránh spin sau cắt ngang
    document.getElementById('winOverlay')?.classList.remove('show');
    clearWinFxPosition();
    const wrap = document.getElementById('reelsWrapper');
    wrap?.classList.remove('dim-win', 'tease-dim');
    document.querySelectorAll('.win-float').forEach(el => el.remove());
    document.querySelectorAll('.reel').forEach(el => {
      el.classList.remove('spinning-reel', 'landing', 'tease', 'stopping');
    });

    // Beat cuối trước khi cho phép lệnh spin tiếp theo
    const big = totalWin >= (20 * (state.bet / REF_BET));
    await sleepRaw(state.fastSpin ? (big ? 200 : 120) : (big ? 450 : 280));
  } finally {
    endFx();
  }
}

export async function waitFxIdle() {
  let guard = 0;
  while (state.fxPlaying && guard < 400) {
    await sleepRaw(50);
    guard++;
  }
}
