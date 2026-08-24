// src/game/fsAuto.js — extracted from main.js
import { state } from '../core/state.js';
import { fmt, sleepRaw } from '../core/utils.js';
import { selectRandomFeatures } from './features.js';
import { waitFxIdle } from './flow.js';
import { doSpin } from './spin.js';
import { closeFsGridEditor, isEditFsGridOn, openFsGridEditor, syncEditFsGridChip } from '../ui/cheat/fsEditor.js';
import { closeModal, openModal, showToast } from '../ui/feedback.js';
import { renderFeatureMeter, setInfoBar } from '../ui/render.js';

// ─── Free Spins ──────────────────────────────────────────────
export function getFSFeatures(scatterCount) {
  const n = scatterCount >= 5 ? 3 : scatterCount >= 4 ? 2 : 1;
  return selectRandomFeatures(n);
}

// ─── Auto-spin control ───────────────────────────────────────
export function updateAutoUI() {
  const btn = document.getElementById('btnAuto');
  if (!btn) return;
  const n = state.autoSpins || 0;
  btn.classList.toggle('active', n > 0);
  btn.title = n > 0 ? `Autospin: ${n} left — click to stop` : 'Autospin';
  // Optional badge text via aria
  btn.dataset.remaining = String(n);
}

export function stopAutoSpin(reason) {
  if ((state.autoSpins || 0) <= 0) return;
  state.autoSpins = 0;
  updateAutoUI();
  if (reason) showToast(reason, '#ff8800');
}

export function startAutoSpin(n) {
  const count = Math.max(0, Number(n) || 0);
  if (count <= 0) return;
  if (state.spinning || state.inFreeSpins) {
    showToast(state.inFreeSpins ? 'Wait for free spins to finish' : 'Wait for current spin', '#ff8800');
    return;
  }
  state.autoSpins = count;
  updateAutoUI();
  closeModal('modalAuto');
  showToast(`Autospin ×${count}`, '#00f0ff');
  doSpin();
}

/**
 * Sau mỗi spin: ưu tiên Free Spins, rồi Autospin.
 * CHỈ gọi sau khi settleAfterSpinPresentation() xong — đảm bảo UI diễn hết FX.
 * Lệnh spin kế (ws/offline) chỉ được gửi từ đây.
 */
export async function continueAfterSpin() {
  // An toàn: nếu FX vẫn chạy thì chờ
  await waitFxIdle();
  if (state.spinning || state.fxPlaying) return;

  // Free spins: remain = số lượt còn lại cần quay
  if (state.inFreeSpins && state.fsRemaining > 0) {
    if (isEditFsGridOn()) {
      openFsGridEditor();
      return;
    }
    // Nhịp ngắn giữa 2 FS — FX đã settle xong
    await sleepRaw(state.fastSpin ? 180 : 400);
    if (state.inFreeSpins && state.fsRemaining > 0 && !state.spinning && !state.fxPlaying) {
      await doSpin();
    }
    return;
  }

  // Autospin (tạm dừng khi đang FS — chỉ resume sau khi FS kết thúc)
  if ((state.autoSpins || 0) > 0 && !state.inFreeSpins) {
    state.autoSpins--;
    updateAutoUI();
    if (state.autoSpins > 0) {
      await sleepRaw(state.fastSpin ? 180 : 400);
      if (state.autoSpins > 0 && !state.spinning && !state.fxPlaying && !state.inFreeSpins) {
        await doSpin();
      }
    } else {
      showToast('Autospin complete', '#00ff88');
    }
  }
}

export async function triggerFreeSpins(scatterCount, opts = {}) {
  const features = opts.features || getFSFeatures(scatterCount);
  const remain = opts.remain ?? 7;
  const total = opts.total ?? remain;
  const sessionWin = opts.sessionWin ?? 0;

  state.inFreeSpins = true;
  state.fsRemaining = remain;
  state.fsTotal = total;
  state.fsActiveFeatures = features;
  state.persistentFeatures = [...features];
  state.fsSessionWin = sessionWin;
  state.fsBet = state.bet;

  document.getElementById('fsTriggerInfo').textContent =
    `${remain} Free Spins` +
    (features.length ? ` with ${features.length} feature(s): ${features.map(f => f.name).join(', ')}` : '') +
    (scatterCount ? ` • ${scatterCount} Scatters` : '');
  openModal('modalFS');

  return new Promise(resolve => {
    document.getElementById('startFS').onclick = () => {
      closeModal('modalFS');
      document.getElementById('fsBanner').classList.add('visible');
      updateFSBanner();
      renderFeatureMeter(features.map(f => f.id));
      resolve();
    };
  });
}

export function updateFSBanner() {
  const el = document.getElementById('fsCount');
  if (el) el.textContent = Math.max(0, state.fsRemaining || 0);
  syncEditFsGridChip();
}

export async function endFreeSpins() {
  state.inFreeSpins = false;
  state.fsRemaining = 0;
  state.persistentFeatures = [];
  state.fsActiveFeatures = [];
  closeFsGridEditor();
  document.getElementById('fsBanner').classList.remove('visible');
  renderFeatureMeter([]);
  document.getElementById('fsTotalWin').textContent = fmt(state.fsSessionWin || 0);
  openModal('modalFSSummary');
  return new Promise(resolve => {
    document.getElementById('closeFSSummary').onclick = () => {
      closeModal('modalFSSummary');
      setInfoBar('idle', 'Win up to 19,693× Bet &nbsp;•&nbsp; 3 Scatters trigger Deep Web Infiltration &nbsp;•&nbsp; Good luck, hacker');
      resolve();
    };
  });
}
