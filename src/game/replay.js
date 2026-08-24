// src/game/replay.js — extracted from main.js
import { state } from '../core/state.js';
import { FEATURES, REELS, ROWS, SYM_MAP, SYM_TO_ID } from './config.js';
import { beginFx, endFx } from './flow.js';
import { splitCountOf } from './grid.js';
import { SERVER_FEATURE_MAP, applyServerScreen, mapServerFeatureName } from '../net/session.js';
import { isEditFsGridOn } from '../ui/cheat/fsEditor.js';
import { closeModal, showToast } from '../ui/feedback.js';
import { renderFeatureMeter, renderGrid, showFeatureDetail } from '../ui/render.js';
import { clearMeterStepActive, clearVfxStage, hideFeatureExplain, hideFeatureIntro, hideVfxBanner, resetVfxSkip, setSkipBarVisible, setVfxVignette } from '../ui/vfx/core.js';
import { applyFeatureStep, applyFeatureStepDataOnly } from '../ui/vfx/steps.js';

export function snapshotBoard() {
  return {
    grid: (state.grid || []).map(col => (Array.isArray(col) ? col.slice() : [])),
    cellMeta: (state.cellMeta || []).map(col =>
      (Array.isArray(col) ? col.map(m => ({ split: splitCountOf(m), multiplier: m?.multiplier || 1, mystery: !!m?.mystery })) : [])
    ),
    globalMultiplier: state.globalMultiplier || 1,
    bypassProtocol: !!state.bypassProtocol,
    blockedSymbols: [...(state.blockedSymbols || [])],
  };
}

export function gridToServerScreen(grid) {
  if (!Array.isArray(grid) || grid.length !== REELS) return null;
  return grid.map(col => (Array.isArray(col) ? col.map(s => SYM_TO_ID[s] ?? 6) : []));
}

export function cellMetaToSplitCounts(meta) {
  if (!Array.isArray(meta) || meta.length !== REELS) return null;
  return meta.map(col => (Array.isArray(col) ? col.map(m => splitCountOf(m)) : []));
}

export function cellMetaToMultMap(meta) {
  if (!Array.isArray(meta)) return null;
  const map = {};
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const m = Number(meta[c]?.[r]?.multiplier) || 1;
      if (m > 1) map[`${r},${c}`] = m;
    }
  }
  return Object.keys(map).length ? map : null;
}

export function clientToServerFeatureName(id) {
  for (const [name, cid] of Object.entries(SERVER_FEATURE_MAP)) {
    if (cid === id) return name;
  }
  return id;
}

export function diffBoardsToStep(feat, before, after) {
  const changes = [];
  const splitChanges = [];
  const positions = [];
  for (let c = 0; c < REELS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const pos = [c, r];
      const bg = before.grid[c]?.[r];
      const ag = after.grid[c]?.[r];
      const bm = before.cellMeta[c]?.[r] || {};
      const am = after.cellMeta[c]?.[r] || {};
      if (bg !== ag && ag != null) changes.push({ pos, to: SYM_TO_ID[ag] ?? ag });
      const bmSplit = splitCountOf(bm);
      const amSplit = splitCountOf(am);
      if (bmSplit !== amSplit) splitChanges.push({ pos, from: bmSplit, to: amSplit });
      if ((am.multiplier || 1) > 1 && am.multiplier !== bm.multiplier) positions.push(pos);
    }
  }
  const step = {
    name: clientToServerFeatureName(feat.id),
    changes,
    splitChanges,
  };
  if (feat.id === 'firewall') {
    step.bannedLows = (after.blockedSymbols || []).map(s => SYM_TO_ID[s]).filter(n => n != null);
  }
  if (feat.id === 'trojan' && changes.length) {
    step.revealTo = changes[0].to;
    step.mysteryPositions = changes.map(ch => ch.pos);
  }
  if (feat.id === 'overclock') {
    step.positions = positions;
    const sample = positions[0];
    step.multiplier = sample
      ? (after.cellMeta[sample[0]]?.[sample[1]]?.multiplier || 1)
      : 1;
  }
  if (feat.id === 'bandwidth') step.multiplier = after.globalMultiplier || 1;
  if (feat.id === 'overload') {
    const cols = [];
    for (let c = 0; c < REELS; c++) {
      const nowWild = after.grid[c]?.every(s => s === 'W');
      const wasWild = before.grid[c]?.every(s => s === 'W');
      if (nowWild && !wasWild) cols.push(c);
    }
    step.columns = cols;
  }
  if (feat.id === 'root') {
    const reels = [];
    for (let c = 0; c < REELS; c++) {
      let newly = 0;
      for (let r = 0; r < ROWS; r++) {
        if (splitCountOf(after.cellMeta[c]?.[r]) > 1 && !(splitCountOf(before.cellMeta[c]?.[r]) > 1)) newly++;
      }
      if (newly >= 2) reels.push(c);
    }
    step.reels = reels;
  }
  return step;
}

export function captureLastFeatureReplay(pack) {
  const steps = Array.isArray(pack?.featureSteps) ? pack.featureSteps.filter(s => s && s.name) : [];
  if (!steps.length) {
    state.lastFeatureReplay = null;
    return;
  }
  let cloned;
  try {
    cloned = JSON.parse(JSON.stringify(steps));
  } catch (_) {
    cloned = steps.slice();
  }
  state.lastFeatureReplay = {
    featureSteps: cloned,
    featObjs: pack.featObjs || [],
    baseScreen: pack.baseScreen || null,
    finalScreen: pack.finalScreen || null,
    splitCounts: pack.splitCounts || null,
    cellMultipliers: pack.cellMultipliers || null,
    finalGlobalMult: pack.finalGlobalMult ?? state.globalMultiplier ?? 1,
    finalBypass: pack.finalBypass ?? !!state.bypassProtocol,
    finalBoard: pack.finalBoard || snapshotBoard(),
  };
}

export function lastReplayMeterIds() {
  const pack = state.lastFeatureReplay;
  if (!pack) {
    return [
      ...(state.inFreeSpins ? (state.persistentFeatures || []).map(f => f.id) : []),
      ...(state.triggeredFeatures || []).map(f => f.id),
    ].filter((id, i, a) => a.indexOf(id) === i);
  }
  const ids = [
    ...(pack.featObjs || []).map(f => f.id),
    ...(pack.featureSteps || []).map(s => mapServerFeatureName(s?.name)).filter(Boolean),
  ];
  if (state.inFreeSpins) ids.push(...(state.persistentFeatures || []).map(f => f.id));
  return ids.filter((id, i, a) => a.indexOf(id) === i);
}

export function renderLastSpinFeatureMeter() {
  renderFeatureMeter(lastReplayMeterIds());
}

export function findReplayStepIndex(featId) {
  const steps = state.lastFeatureReplay?.featureSteps;
  if (!steps?.length || !featId) return -1;
  return steps.findIndex(s => mapServerFeatureName(s?.name) === featId);
}

export function replayHoldReason() {
  if (state.spinning || state.fxPlaying) return 'Đợi spin / VFX xong rồi replay';
  if ((state.autoSpins || 0) > 0) return 'Tắt Autospin để replay feature';
  if (state.inFreeSpins && state.fsRemaining > 0 && !isEditFsGridOn()) {
    return 'Bật Edit Grid (pause FS) hoặc đợi hết Free Spins để replay';
  }
  return '';
}

export function canReplayFeature(featId) {
  return !replayHoldReason() && findReplayStepIndex(featId) >= 0;
}

export function restoreReplayBeforeStep(stepIndex) {
  const pack = state.lastFeatureReplay;
  if (!pack) return false;
  state.globalMultiplier = 1;
  state.bypassProtocol = false;
  const land = pack.baseScreen || pack.finalScreen;
  if (land) applyServerScreen(land, null);
  else if (pack.finalBoard) {
    state.grid = pack.finalBoard.grid.map(col => col.slice());
    state.cellMeta = pack.finalBoard.cellMeta.map(col => col.map(m => ({ ...m })));
  }
  for (let i = 0; i < stepIndex; i++) applyFeatureStepDataOnly(pack.featureSteps[i]);
  const box = document.getElementById('multDisplay');
  if (box) box.textContent = String(state.globalMultiplier || 1).padStart(2, '0');
  renderGrid();
  return true;
}

export async function replayLastFeature(featId) {
  const hold = replayHoldReason();
  if (hold) {
    showToast(hold, '#ff8800');
    return;
  }
  const idx = findReplayStepIndex(featId);
  if (idx < 0) {
    showFeatureDetail(featId);
    return;
  }
  const pack = state.lastFeatureReplay;
  const step = pack.featureSteps[idx];
  const f = FEATURES.find(x => x.id === featId);
  closeModal('modalFeatureDetail');
  resetVfxSkip();
  setSkipBarVisible(true);
  beginFx();
  try {
    restoreReplayBeforeStep(idx);
    renderFeatureMeter(lastReplayMeterIds());
    showToast(`▶ Replay: ${f?.name || featId}`, f?.color || 'var(--cyan)');
    await applyFeatureStep(step, {
      firewallAnnounced: false,
      stepIndex: idx,
      stepTotal: pack.featureSteps.length,
      isReplay: true,
    });
  } finally {
    setSkipBarVisible(false);
    clearMeterStepActive();
    hideFeatureIntro(true);
    hideFeatureExplain(true);
    hideVfxBanner();
    clearVfxStage();
    setVfxVignette(false);
    endFx();
    renderLastSpinFeatureMeter();
  }
}

/** Map server screen matrix → client symbol keys for animateReelSpin */
export function screenToForcedResults(screen) {
  if (!Array.isArray(screen) || screen.length !== REELS) return null;
  return screen.map(col => {
    if (!Array.isArray(col)) return Array(ROWS).fill('A');
    return col.map(num => SYM_MAP[num] || 'A');
  });
}
