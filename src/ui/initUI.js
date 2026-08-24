// src/ui/initUI.js — extracted from main.js
import { online, state, ws } from '../core/state.js';
import { fmt, randInt } from '../core/utils.js';
import { ALL_BETS, BET_LEVELS, DEFAULT_SYMBOL_PACK, SYMBOL_PACKS } from '../game/config.js';
import { startAutoSpin, stopAutoSpin, updateAutoUI } from '../game/fsAuto.js';
import { createEmptyGrid } from '../game/grid.js';
import { replayLastFeature } from '../game/replay.js';
import { doSpin } from '../game/spin.js';
import { doOnlineSpin } from '../net/ws.js';
import { sfx, unlockAudio } from '../sfx/sfx.js';
import { initBuyModals, renderPaytable, selectedBuyFS, selectedBuyFeature, setSelectedBuyFS, setSelectedBuyFeature } from './buyFeatures.js';
import { applyFsGridAndSpin, isFsGridEditorOpen } from './cheat/fsEditor.js';
import { openCheatPanel } from './cheat/panel.js';
import { closeModal, openModal, showToast } from './feedback.js';
import { renderHistoryOnline, renderJackpotHistoryOnline } from './historyOnline.js';
import { renderFeatureMeter, renderGrid, updateUI } from './render.js';
import { applySymbolPack, cycleSymbolPack } from './symbolPack.js';
import { requestSkipAllVfx } from './vfx/core.js';
import { _wxZoom, highlightExplainOnMainGrid, openWinExplain, setWinExplainZoom } from './winExplain.js';

// ─── Init UI ─────────────────────────────────────────────────
export function initUI() {
  // Restore art pack before first paint of symbols
  let savedPack = DEFAULT_SYMBOL_PACK;
  try {
    const raw = localStorage.getItem('zd_symbol_pack');
    if (raw && SYMBOL_PACKS[raw]) savedPack = raw;
  } catch (_) { /* ignore */ }
  applySymbolPack(savedPack, { persist: false, toast: false, rerender: false });

  createEmptyGrid();
  renderGrid();
  renderFeatureMeter();
  updateUI();
  renderPaytable();

  // Bet options
  const betOpts = document.getElementById('betOptions');
  ['low', 'med', 'high'].forEach(tier => {
    const label = document.createElement('div');
    label.style.cssText = 'font-size:.7rem;color:var(--dim);margin:10px 0 4px;letter-spacing:1px;text-transform:uppercase';
    label.textContent = tier;
    betOpts.appendChild(label);
    BET_LEVELS[tier].forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.cssText = 'margin:3px;width:calc(25% - 6px)';
      btn.textContent = fmt(b);
      btn.addEventListener('click', () => {
        state.bet = b;
        state.betIdx = ALL_BETS.indexOf(b);
        updateUI();
        closeModal('modalBet');
      });
      betOpts.appendChild(btn);
    });
  });

  // Auto options
  const autoOpts = document.getElementById('autoOptions');
  autoOpts.innerHTML = '';
  [10, 25, 50, 100, 250, 1000].forEach(n => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.cssText = 'margin:4px;width:calc(33% - 8px)';
    btn.textContent = n + ' spins';
    btn.addEventListener('click', () => startAutoSpin(n));
    autoOpts.appendChild(btn);
  });
  // Stop option trong modal
  const stopBtn = document.createElement('button');
  stopBtn.className = 'btn';
  stopBtn.style.cssText = 'margin:8px 4px 4px;width:calc(100% - 8px);border-color:var(--red);color:var(--red)';
  stopBtn.textContent = 'Stop Autospin';
  stopBtn.addEventListener('click', () => {
    stopAutoSpin('Autospin stopped');
    closeModal('modalAuto');
  });
  autoOpts.appendChild(stopBtn);

  initBuyModals();
  updateAutoUI();

  // Event listeners
  document.getElementById('btnSpin').addEventListener('click', () => {
    unlockAudio();
    if (state.autoSpins > 0) {
      stopAutoSpin('Autospin stopped');
      return;
    }
    if (state.spinning) return;
    if (isFsGridEditorOpen()) {
      applyFsGridAndSpin();
      return;
    }
    sfx('tick', { gain: 0.45 });
    doSpin();
  });
  document.getElementById('betDisplay').addEventListener('click', () => {
    if (state.spinning || state.inFreeSpins) return;
    openModal('modalBet');
  });
  document.getElementById('closeBet').addEventListener('click', () => closeModal('modalBet'));
  document.getElementById('btnWinExplain')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openWinExplain();
  });
  document.querySelector('.bottom-bar .win-block')?.addEventListener('click', () => openWinExplain());
  document.getElementById('closeWinExplain')?.addEventListener('click', () => closeModal('modalWinExplain'));
  document.getElementById('modalWinExplain')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalWinExplain') closeModal('modalWinExplain');
  });
  document.getElementById('wxZoomIn')?.addEventListener('click', () => setWinExplainZoom(_wxZoom + 0.1));
  document.getElementById('wxZoomOut')?.addEventListener('click', () => setWinExplainZoom(_wxZoom - 0.1));
  document.getElementById('wxZoomReset')?.addEventListener('click', () => setWinExplainZoom(1));
  document.getElementById('wxHighlightGrid')?.addEventListener('click', () => highlightExplainOnMainGrid());
  document.getElementById('btnMenu').addEventListener('click', () => openModal('modalMenu'));
  document.getElementById('closeMenu').addEventListener('click', () => closeModal('modalMenu'));
  document.getElementById('menuPaytable').addEventListener('click', () => { closeModal('modalMenu'); openModal('modalPaytable'); });
  document.getElementById('closePaytable').addEventListener('click', () => closeModal('modalPaytable'));
  document.getElementById('menuSymbolPack')?.addEventListener('click', () => {
    cycleSymbolPack();
  });
  document.getElementById('menuRules').addEventListener('click', () => { closeModal('modalMenu'); openModal('modalRules'); });
  document.getElementById('closeRules').addEventListener('click', () => closeModal('modalRules'));
  document.getElementById('closeFeatureDetail')?.addEventListener('click', () => closeModal('modalFeatureDetail'));
  document.getElementById('btnReplayFeature')?.addEventListener('click', () => {
    const id = document.getElementById('btnReplayFeature')?.dataset.featureId;
    if (id) replayLastFeature(id);
  });
  document.getElementById('modalFeatureDetail')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalFeatureDetail') closeModal('modalFeatureDetail');
  });
  document.getElementById('menuHistory').addEventListener('click', async () => {
    closeModal('modalMenu');
    openModal('modalHistory');
    if (online) await renderHistoryOnline();
    else renderHistory();
  });
  document.getElementById('closeHistory').addEventListener('click', () => closeModal('modalHistory'));
  ['modalHistory', 'modalSpinDetail', 'modalJackpotHistory'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('click', e => { if (e.target === el) closeModal(id); });
  });
  document.getElementById('closeSpinDetail')?.addEventListener('click', () => closeModal('modalSpinDetail'));
  document.getElementById('menuJackpotHistory')?.addEventListener('click', async () => {
    closeModal('modalMenu');
    openModal('modalJackpotHistory');
    if (online) await renderJackpotHistoryOnline();
    else {
      document.getElementById('jackpotHistoryList').innerHTML =
        '<p style="color:var(--dim);text-align:center;padding:20px">Jackpot history chỉ có online</p>';
    }
  });
  document.getElementById('closeJackpotHistory')?.addEventListener('click', () => closeModal('modalJackpotHistory'));
  document.getElementById('menuCheat')?.addEventListener('click', () => {
    closeModal('modalMenu');
    openCheatPanel();
  });
  document.getElementById('btnCheatFab')?.addEventListener('click', () => openCheatPanel());
  // Cheat panel listeners are bound once in bindCheatPanelEvents() (before Play)
  document.getElementById('btnAuto').addEventListener('click', () => {
    if (state.autoSpins > 0) {
      stopAutoSpin('Autospin stopped');
      return;
    }
    if (state.spinning) {
      showToast('Wait for current spin', '#ff8800');
      return;
    }
    if (state.inFreeSpins) {
      showToast('Cannot start autospin during Free Spins', '#ff8800');
      return;
    }
    openModal('modalAuto');
  });
  document.getElementById('closeAuto').addEventListener('click', () => closeModal('modalAuto'));
  document.getElementById('btnFast').addEventListener('click', () => {
    state.fastSpin = !state.fastSpin;
    document.getElementById('btnFast').classList.toggle('active', state.fastSpin);
  });
  document.getElementById('btnExplainFeat')?.addEventListener('click', () => {
    state.featureExplain = !state.featureExplain;
    document.getElementById('btnExplainFeat')?.classList.toggle('active', state.featureExplain);
    showToast(
      state.featureExplain
        ? '📖 Bật giải thích: mỗi feature sẽ dừng và hiện chữ tiếng Việt'
        : 'Tắt giải thích feature',
      state.featureExplain ? '#00f0ff' : 'var(--dim)'
    );
  });
  document.getElementById('btnSkipVfx')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    requestSkipAllVfx();
  });
  document.getElementById('btnSound').addEventListener('click', () => {
    state.sound = !state.sound;
    document.getElementById('btnSound').textContent = state.sound ? '🔊' : '🔇';
    document.getElementById('btnSound').classList.toggle('active', !state.sound);
    document.getElementById('menuSound').textContent = `🔊 Sound: ${state.sound ? 'ON' : 'OFF'}`;
    if (state.sound) {
      unlockAudio();
      sfx('blip', { gain: 0.5 });
    }
  });
  document.getElementById('menuSound').addEventListener('click', () => {
    state.sound = !state.sound;
    document.getElementById('menuSound').textContent = `🔊 Sound: ${state.sound ? 'ON' : 'OFF'}`;
    document.getElementById('btnSound').textContent = state.sound ? '🔊' : '🔇';
    if (state.sound) {
      unlockAudio();
      sfx('blip', { gain: 0.5 });
    }
  });
  document.getElementById('menuMusic').addEventListener('click', () => {
    state.music = !state.music;
    document.getElementById('menuMusic').textContent = `🎵 Music: ${state.music ? 'ON' : 'OFF'}`;
  });
  document.getElementById('btnBuyFeature').addEventListener('click', () => {
    if (state.spinning || state.fxPlaying) {
      showToast('Wait for current spin', '#ff8800');
      return;
    }
    if (state.inFreeSpins) {
      showToast('Cannot buy features during Free Spins', '#ff8800');
      return;
    }
    if (online && (!ws || ws.readyState !== WebSocket.OPEN)) {
      showToast('Not connected — cannot buy online', '#ff3355');
      return;
    }
    initBuyModals();
    openModal('modalBuyFeature');
  });
  document.getElementById('cancelBuyFeature').addEventListener('click', () => closeModal('modalBuyFeature'));
  document.getElementById('confirmBuyFeature').addEventListener('click', async () => {
    if (!selectedBuyFeature) {
      showToast('Select a feature package', '#ff8800');
      return;
    }
    if (state.spinning || state.fxPlaying || state.inFreeSpins) {
      showToast('Cannot buy features right now', '#ff8800');
      return;
    }
    const costs = { scatter: 1.4, buy3: 12, buy12: 4500 };
    const featureMap = {
      scatter: 'scatterBooster',
      buy3: '3Features',
      buy12: '12Features',
    };
    const optId = selectedBuyFeature;
    const costMult = costs[optId];
    const feature = featureMap[optId];
    setSelectedBuyFeature(null);
    closeModal('modalBuyFeature');
    stopAutoSpin();

    if (online) {
      // BE: cmd 1501 + feature → debit cost×bet + run 1 spin with boost/force features
      const cost = costMult * state.bet;
      if (state.balance < cost) {
        showToast('Insufficient balance!', '#ff3355');
        return;
      }
      await doOnlineSpin({ buyFeature: feature, buyCostHint: cost });
      return;
    }

    // Offline only: sticky flags for subsequent spins
    state.extraFee = (costMult - 1) * state.bet;
    state.scatterBooster = optId === 'scatter';
    state.buy3Features = optId === 'buy3';
    state.buy12Features = optId === 'buy12';
    showToast(`Script active: ${feature}`, '#aa44ff');
  });
  document.getElementById('btnBuyFS').addEventListener('click', () => {
    if (state.spinning || state.fxPlaying) {
      showToast('Wait for current spin', '#ff8800');
      return;
    }
    if (state.inFreeSpins) {
      showToast('Cannot buy Free Spins during Free Spins', '#ff8800');
      return;
    }
    if (online && (!ws || ws.readyState !== WebSocket.OPEN)) {
      showToast('Not connected — cannot buy online', '#ff3355');
      return;
    }
    // Refresh cost labels theo bet hiện tại
    initBuyModals();
    openModal('modalBuyFS');
  });
  document.getElementById('cancelBuyFS').addEventListener('click', () => closeModal('modalBuyFS'));
  document.getElementById('confirmBuyFS').addEventListener('click', async () => {
    if (!selectedBuyFS) {
      showToast('Select a Free Spin package', '#ff8800');
      return;
    }
    if (state.spinning || state.fxPlaying || state.inFreeSpins) {
      showToast('Cannot buy Free Spins right now', '#ff8800');
      return;
    }

    const costs = { fs1: 80, fs2: 240, fs3: 500, fs4: 212 };
    const featureMap = { fs1: 'FS1', fs2: 'FS2', fs3: 'FS3', fs4: 'FS4' };
    const costMult = costs[selectedBuyFS];
    const feature = featureMap[selectedBuyFS];
    const cost = costMult * state.bet;
    const optId = selectedBuyFS;
    setSelectedBuyFS(null);
    closeModal('modalBuyFS');
    stopAutoSpin();

    if (online) {
      // Online: server trừ phí qua BUY_FEATURE 1501 — client không trừ trước
      if (state.balance < cost) {
        showToast('Insufficient balance!', '#ff3355');
        return;
      }
      await doOnlineSpin({ buyFeature: feature, buyCostHint: cost });
      return;
    }

    // Offline: trừ local + force scatters
    if (state.balance < cost) {
      showToast('Insufficient balance!', '#ff3355');
      return;
    }
    state.balance -= cost;
    updateUI();
    const scatterMap = { fs1: 3, fs2: 4, fs3: 5, fs4: [3, 4, 5][randInt(0, 2)] };
    await doSpin(scatterMap[optId]);
  });
}

export function renderHistory() {
  const sub = document.getElementById('historySubtitle');
  if (sub) sub.textContent = '(local offline)';
  const list = document.getElementById('historyList');
  if (!state.history.length) { list.innerHTML = '<p style="color:var(--dim);text-align:center;padding:20px">No spins yet</p>'; return; }
  list.innerHTML = state.history.slice(0, 30).map(h => `
    <div class="history-item">
      <div style="display:flex;justify-content:space-between">
        <span>${h.type} — ${h.time}</span>
        <span class="${h.profit >= 0 ? 'history-profit-pos' : 'history-profit-neg'}">${h.profit >= 0 ? '+' : ''}${fmt(h.profit)}</span>
      </div>
      <div style="color:var(--dim);font-size:.7rem;margin-top:2px">
        Bet: ${fmt(h.bet)} | Win: ${fmt(h.win)} | ${h.features?.join(', ') || 'No features'}
      </div>
    </div>`).join('');
}

/** Online history row click → 1506 detail */
