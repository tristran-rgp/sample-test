// src/ui/winfx.js — extracted from main.js
import { state } from '../core/state.js';
import { fmt, sleepRaw } from '../core/utils.js';
import { REELS, REF_BET, ROWS } from '../game/config.js';
import { sfx } from '../sfx/sfx.js';
import { isVfxSkip } from './vfx/core.js';

// ─── Win effects ─────────────────────────────────────────────
export function shakeScreen() {
  document.body.classList.remove('shake');
  void document.body.offsetWidth;
  document.body.classList.add('shake');
  setTimeout(() => document.body.classList.remove('shake'), 500);
}

/**
 * Ticker cộng tiền 0→total (header WIN + optional overlay amount).
 * Nhanh: ~0.25–0.45s (turbo ~0.12–0.2s) — ease-out để cảm giác “đếm xong dứt”.
 */
export async function runMoneyTicker(from, to, {
  onTick,
  durationMs,
} = {}) {
  const start = Number(from) || 0;
  const end = Number(to) || 0;
  if (!Number.isFinite(end) || end === start) {
    onTick?.(end, 1);
    return end;
  }
  const dur = durationMs != null
    ? durationMs
    : (state.fastSpin
        ? (Math.abs(end - start) >= 50 * state.bet ? 200 : 120)
        : (Math.abs(end - start) >= 50 * state.bet ? 420 : 280));
  const t0 = performance.now();
  await new Promise(resolve => {
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / Math.max(1, dur));
      // ease-out cubic — tăng nhanh đầu, chạm đích gọn
      const e = 1 - Math.pow(1 - t, 3);
      const val = start + (end - start) * e;
      onTick?.(val, t);
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  onTick?.(end, 1);
  return end;
}

/**
 * Win celebration overlay — mọi spin win > 0.
 * animation-sequence.png (6×6) + chữ WIN + số tiền $0.00 → total (đếm nhanh, lấp lánh).
 * Big/Mega/Legendary: giữ class màu (GDD threshold), label luôn "WIN".
 * Vị trí: neo đúng giữa khung symbol grid (#reelsWrapper), không căn viewport.
 */
export const WIN_SEQ = {
  cols: 6,
  rows: 6,
  frames: 36,
  fps: 14,
  file: 'animation-sequence.webp',
};

/** Pin .win-fx-stage lên bounding box reels (grid symbol). */
export function positionWinFxToReels() {
  const stage = document.querySelector('#winOverlay .win-fx-stage');
  const target =
    document.getElementById('reelsGrid') ||
    document.getElementById('reelsWrapper');
  if (!stage || !target) return;
  const r = target.getBoundingClientRect();
  if (!r.width || !r.height) return;
  stage.style.left = `${r.left}px`;
  stage.style.top = `${r.top}px`;
  stage.style.width = `${r.width}px`;
  stage.style.height = `${r.height}px`;
  stage.style.transform = 'none';
  stage.style.maxWidth = 'none';
  stage.style.maxHeight = 'none';
}

export function clearWinFxPosition() {
  const stage = document.querySelector('#winOverlay .win-fx-stage');
  if (!stage) return;
  stage.style.left = '';
  stage.style.top = '';
  stage.style.width = '';
  stage.style.height = '';
  stage.style.transform = '';
  stage.style.maxWidth = '';
  stage.style.maxHeight = '';
}

export function setWinSeqFrame(el, frame) {
  if (!el) return;
  const f = ((frame % WIN_SEQ.frames) + WIN_SEQ.frames) % WIN_SEQ.frames;
  const c = f % WIN_SEQ.cols;
  const r = Math.floor(f / WIN_SEQ.cols) % WIN_SEQ.rows;
  const x = WIN_SEQ.cols <= 1 ? 0 : (c / (WIN_SEQ.cols - 1)) * 100;
  const y = WIN_SEQ.rows <= 1 ? 0 : (r / (WIN_SEQ.rows - 1)) * 100;
  el.style.backgroundPosition = `${x}% ${y}%`;
}

/** Play win sequence once (or until skip). Returns when sheet finishes. */
export function playWinSequenceOnce(el, { fps, onFrame } = {}) {
  const rate = fps || (state.fastSpin ? 22 : WIN_SEQ.fps);
  const interval = 1000 / rate;
  return new Promise(resolve => {
    let frame = 0;
    let last = performance.now();
    setWinSeqFrame(el, 0);
    onFrame?.(0);
    const tick = (now) => {
      if (isVfxSkip && isVfxSkip()) {
        setWinSeqFrame(el, WIN_SEQ.frames - 1);
        resolve();
        return;
      }
      if (now - last >= interval) {
        const steps = Math.max(1, Math.floor((now - last) / interval));
        last += steps * interval;
        frame += steps;
        if (frame >= WIN_SEQ.frames) {
          setWinSeqFrame(el, WIN_SEQ.frames - 1);
          onFrame?.(WIN_SEQ.frames - 1);
          resolve();
          return;
        }
        setWinSeqFrame(el, frame);
        onFrame?.(frame);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export async function playWinEffect(total) {
  const amount = Number(total) || 0;
  if (amount <= 0) return false;

  const threshold = (base) => base * (state.bet / REF_BET);
  const tierCls =
    amount >= threshold(100) ? 'win-legendary'
      : amount >= threshold(40) ? 'win-mega'
        : amount >= threshold(20) ? 'win-big'
          : '';

  if (tierCls === 'win-legendary' || tierCls === 'win-mega') {
    sfx('jackpot', { gain: 1.15, force: true });
  } else if (tierCls === 'win-big') {
    sfx('bigwin', { gain: 1.1, force: true });
  } else {
    sfx('win', { gain: 1.05, force: true });
  }

  const overlay = document.getElementById('winOverlay');
  const text = document.getElementById('winText');
  const amountEl = document.getElementById('winAmountFx');
  const seqEl = document.getElementById('winSeqSprite');
  if (!overlay || !text || !amountEl) return false;

  text.className = 'win-text' + (tierCls ? ' ' + tierCls : '');
  text.textContent = 'WIN';
  amountEl.className = 'win-amount-fx' + (tierCls ? ' ' + tierCls : '');
  amountEl.textContent = fmt(0);
  setWinSeqFrame(seqEl, 0);

  // Neo đúng khung symbol grid trước khi show
  positionWinFxToReels();
  overlay.classList.add('show');
  // layout pass — re-measure sau show (scroll/reflow)
  requestAnimationFrame(() => positionWinFxToReels());
  const onWinFxResize = () => positionWinFxToReels();
  window.addEventListener('resize', onWinFxResize);
  shakeScreen();

  // Header giữ total (đã ticker ở animateWinWays); overlay đếm lại 0 → total
  document.getElementById('headerWin').textContent = fmt(amount);

  // Đếm tiền 0→total (hơi chậm hơn để dễ đọc; vẫn song song animation sequence)
  const tickDur = state.fastSpin ? 380 : 820;
  try {
    const animP = playWinSequenceOnce(seqEl, {
      fps: state.fastSpin ? 24 : WIN_SEQ.fps,
    });
    const moneyP = runMoneyTicker(0, amount, {
      durationMs: tickDur,
      onTick: (val) => {
        amountEl.textContent = fmt(val);
      },
    }).then(() => {
      amountEl.textContent = fmt(amount);
      amountEl.classList.add('sparkle-done');
    });

    await Promise.all([animP, moneyP]);

    // Giữ một nhịp ngắn sau khi đếm/anim xong
    await sleepRaw(state.fastSpin ? 140 : 320);
  } finally {
    window.removeEventListener('resize', onWinFxResize);
    overlay.classList.remove('show');
    clearWinFxPosition();
    text.textContent = 'WIN';
    text.className = 'win-text';
    amountEl.textContent = '';
    amountEl.className = 'win-amount-fx';
    setWinSeqFrame(seqEl, 0);
  }
  await sleepRaw(state.fastSpin ? 60 : 100);
  return true;
}

export async function tickerWin(from, to) {
  await runMoneyTicker(from, to, {
    durationMs: state.fastSpin ? 140 : 320,
    onTick: (val) => {
      document.getElementById('headerWin').textContent = fmt(val);
    },
  });
  document.getElementById('headerWin').textContent = fmt(to);
}

/** Lấy danh sách cell "c,r" cho một way win (ưu tiên positions từ server) */
export function cellsForWin(w) {
  if (Array.isArray(w.positions) && w.positions.length) {
    return w.positions.map(p => {
      const c = Array.isArray(p) ? p[0] : p.c;
      const r = Array.isArray(p) ? p[1] : p.r;
      return `${c},${r}`;
    });
  }
  const cells = [];
  const reels = w.direction === 'rtl'
    ? [...Array(w.length).keys()].map(i => REELS - 1 - i)
    : [...Array(w.length).keys()];
  reels.forEach(c => {
    for (let r = 0; r < ROWS; r++) {
      if (state.grid[c][r] === w.sym || state.grid[c][r] === 'W') cells.push(`${c},${r}`);
    }
  });
  return cells;
}
