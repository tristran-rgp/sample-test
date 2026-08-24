// src/game/spin.js — extracted from main.js
import { state } from '../core/state.js';
import { fmt, genTxnId, randInt } from '../core/utils.js';
import { REELS, REEL_STRIPS, ROWS, SYM_TO_ID } from './config.js';
import { FEATURE_HANDLERS, applyFirewallBlock, maybeTriggerFeatures } from './features.js';
import { beginFx, settleAfterSpinPresentation } from './flow.js';
import { continueAfterSpin, endFreeSpins, stopAutoSpin, triggerFreeSpins, updateAutoUI, updateFSBanner } from './fsAuto.js';
import { calcTotalWin, countScatters, createEmptyGrid } from './grid.js';
import { playJackpot } from './jackpot.js';
import { captureLastFeatureReplay, cellMetaToMultMap, cellMetaToSplitCounts, diffBoardsToStep, gridToServerScreen, renderLastSpinFeatureMeter, snapshotBoard } from './replay.js';
import { applyPendingLocalForceGrid, mergePendingLocalForceFeatures } from '../ui/cheat/fsEditor.js';
import { closeModal, openModal, showToast } from '../ui/feedback.js';
import { animateReelSpin } from '../ui/reels.js';
import { captureBalanceBefore, renderFeatureMeter, renderGrid, setInfoBar, syncPerfMode, updateUI } from '../ui/render.js';
import { celebrateWinPro, playFeatureExplainBeat } from '../ui/vfx/core.js';
import { animateWinWays, recordSpinWinExplainLocal } from '../ui/winExplain.js';
import { playWinEffect } from '../ui/winfx.js';

// ─── Main Spin ───────────────────────────────────────────────
export async function doSpin(forcedScatters = 0) {
  if (state.spinning || state.fxPlaying) return;
  if (!state.inFreeSpins) {
    const cost = state.bet + state.extraFee;
    if (state.balance < cost) {
      showToast('Insufficient balance!', '#ff3355');
      stopAutoSpin('Autospin stopped — insufficient balance');
      return;
    }
    state.balance -= cost;
    state.txnId = genTxnId();
  }
  // Snapshot sau trừ bet — BEFORE = số dư khi spin đang chờ kết quả win/lose
  captureBalanceBefore();

  state.spinning = true;
  syncPerfMode();
  state.lastWin = 0;
  state.blockedSymbols = [];
  state.globalMultiplier = 1;
  state.bypassProtocol = false;
  state.triggeredFeatures = [];
  createEmptyGrid();
  document.getElementById('multDisplay').textContent = '01';

  document.getElementById('btnSpin').disabled = true;
  setInfoBar('idle', 'Spinning...');
  updateUI();

  // Select features
  let features = maybeTriggerFeatures();
  if (state.inFreeSpins) {
    features = [...state.persistentFeatures];
    const newFeat = maybeTriggerFeatures().filter(f => !features.find(p => p.id === f.id));
    if (newFeat.length && Math.random() < 0.2) {
      features.push(newFeat[0]);
      state.persistentFeatures.push(newFeat[0]);
      state.fsRemaining++;
      state.fsTotal++;
      showToast(`+1 Free Spin! New feature: ${newFeat[0].name}`, '#aa44ff');
    }
    mergePendingLocalForceFeatures(features);
  }

  state.triggeredFeatures = features;
  const activeIds = features.map(f => f.id);
  renderFeatureMeter(activeIds);

  // Firewall block (during spin)
  if (features.find(f => f.id === 'firewall')) await applyFirewallBlock();

  // Spin animation (Nolimit-style cascade stop + tease)
  const strips = REEL_STRIPS.map(s => s);
  if (state.scatterBooster) {
    strips[1] = [...strips[1], ...Array(5).fill('S')];
  }
  await animateReelSpin(strips);
  applyPendingLocalForceGrid();

  // Force scatters for buy free spin (before feature transforms)
  if (forcedScatters > 0) {
    placeScatters(forcedScatters);
    renderGrid();
  }

  const landScreen = gridToServerScreen(state.grid);
  const offlineSteps = [];
  if (features.find(f => f.id === 'firewall')) {
    offlineSteps.push({
      name: 'FirewallBlock',
      bannedLows: (state.blockedSymbols || []).map(s => SYM_TO_ID[s]).filter(n => n != null),
      changes: [],
    });
  }

  // Post-stop features
  for (const feat of features) {
    if (feat.timing === 'post' || feat.timing === 'spin') {
      if (feat.timing === 'post' && FEATURE_HANDLERS[feat.id]) {
        const before = snapshotBoard();
        if (state.featureExplain) await playFeatureExplainBeat(feat.id, null);
        await FEATURE_HANDLERS[feat.id]();
        renderGrid();
        offlineSteps.push(diffBoardsToStep(feat, before, snapshotBoard()));
      }
    }
  }

  // Win-time features
  for (const feat of features) {
    if (feat.timing === 'win' && FEATURE_HANDLERS[feat.id]) {
      const before = snapshotBoard();
      if (state.featureExplain) await playFeatureExplainBeat(feat.id, null);
      FEATURE_HANDLERS[feat.id]();
      offlineSteps.push(diffBoardsToStep(feat, before, snapshotBoard()));
    }
  }

  captureLastFeatureReplay({
    featureSteps: offlineSteps,
    featObjs: features,
    baseScreen: landScreen,
    finalScreen: gridToServerScreen(state.grid),
    splitCounts: cellMetaToSplitCounts(state.cellMeta),
    cellMultipliers: cellMetaToMultMap(state.cellMeta),
    finalGlobalMult: state.globalMultiplier,
    finalBypass: state.bypassProtocol,
  });

  // Jackpot check (rare)
  let jackpotWin = 0;
  if (!state.inFreeSpins && Math.random() < 0.005) {
    renderGrid();
    jackpotWin = await playJackpot();
  } else {
    state.lastJackpotActive = false;
  }

  // Calculate wins
  const { total, wins, capped, cap } = calcTotalWin();
  const finalWin = total + jackpotWin;
  state.lastWin = finalWin;
  state.balance += finalWin;

  // Offline only — online dùng captureLastInSpin từ frame IN
  recordSpinWinExplainLocal({
    bet: state.bet,
    totalWin: finalWin,
    wins,
    balanceBefore: state.balanceBefore,
    balanceAfter: state.balance,
    thisMode: state.inFreeSpins ? 'free' : 'base',
    globalMultiplier: state.globalMultiplier,
    maxWinReached: capped,
    featureNames: (features || []).map(f => f.name || f.id),
  });

  if (state.inFreeSpins) {
    state.fsSessionWin += finalWin;
    state.fsRemaining--;
    updateFSBanner();
  }

  // Highlight wins + FX — giữ spinning=true suốt FX
  beginFx();
  try {
    if (finalWin > 0) {
      await animateWinWays(wins, finalWin);
      await playWinEffect(finalWin);
      await celebrateWinPro(finalWin);
    } else {
      renderGrid();
      if (!state.inFreeSpins) setInfoBar('idle', 'Win up to 19,693× Bet &nbsp;•&nbsp; 3 Scatters trigger Deep Web Infiltration &nbsp;•&nbsp; Good luck, hacker');
    }
  } finally {
    /* settle phía dưới sẽ endFx */
  }

  // Max win cap
  if (capped) {
    document.getElementById('maxWinMsg').textContent =
      `Maximum Win Cap reached. Only ${fmt(cap)} has been awarded for this spin.`;
    openModal('modalMaxWin');
    await new Promise(r => { document.getElementById('closeMaxWin').onclick = () => { closeModal('modalMaxWin'); r(); }; });
    if (state.inFreeSpins) { state.fsRemaining = 0; }
  }

  // Free spins trigger (base → FS)
  const scatters = countScatters();
  const wasInFS = state.inFreeSpins;
  if (!wasInFS && scatters >= 3) {
    // Trigger spin không trừ fsRemaining; remain = 7 lượt FS sắp tới
    await triggerFreeSpins(scatters, { sessionWin: finalWin });
  } else if (wasInFS && state.fsRemaining <= 0) {
    await endFreeSpins();
  }

  // History — type dựa trên wasInFS (trước khi enter FS trên spin trigger)
  const betUsed = wasInFS ? 0 : state.bet + state.extraFee;
  state.history.unshift({
    txnId: state.txnId,
    time: new Date().toLocaleString(),
    bet: betUsed || state.fsBet || state.bet,
    win: finalWin,
    profit: finalWin - betUsed,
    type: wasInFS ? 'Free Spin' : (jackpotWin ? 'Jackpot' : (scatters >= 3 ? 'FS Trigger' : 'Normal')),
    features: features.map(f => f.name),
    scatters,
  });
  if (state.history.length > 100) state.history.pop();

  // Đợi UI diễn HẾT hiệu ứng trước khi nhả spinning / gửi spin kế
  await settleAfterSpinPresentation({
    hadWin: finalWin > 0,
    hadFeatures: features.length > 0,
    totalWin: finalWin,
  });

  state.spinning = false;
  state.lastJackpotActive = false;
  document.getElementById('btnSpin').disabled = false;
  updateUI();
  updateAutoUI();
  renderLastSpinFeatureMeter();

  // FS continue / Autospin — chỉ sau settle
  await continueAfterSpin();
}

export function countScattersInPartial(upToReel) {
  let n = 0;
  for (let c = 0; c <= upToReel; c++)
    for (let r = 0; r < ROWS; r++)
      if (state.grid[c][r] === 'S') n++;
  return n;
}

export function placeScatters(n) {
  const positions = [];
  for (let c = 0; c < REELS && positions.length < n; c++) {
    const r = randInt(0, ROWS - 1);
    state.grid[c][r] = 'S';
    positions.push({ c, r });
  }
}

// ── cross-module setters (mutable shared state) ──
// eslint-disable-next-line no-func-assign -- intentional runtime override (online mode)
export function setDoSpin(v) { doSpin = v; }
