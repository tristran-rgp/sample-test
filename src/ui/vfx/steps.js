// src/ui/vfx/steps.js — extracted from main.js
import { state } from '../../core/state.js';
import { mapServerFeatureName } from '../../net/session.js';
import { sfxForFeatureHit, sfxForFeatureStart } from '../../sfx/sfx.js';
import { renderFeatureMeter, renderGrid } from '../render.js';
import { VFX_BEAT, VFX_BLOOM_COLOR, applyStepChanges, applyStepSplitChanges, clearCellClasses, clearMeterStepActive, clearVfxStage, flyFeatureIconFromMeter, hideFeatureExplain, hideFeatureIntro, hideVfxBanner, isVfxSkip, playFeatureExplainBeat, playFeatureIntro, resetVfxSkip, revealTrojanStep, setCellMultiplier, setMeterStepActive, setSkipBarVisible, setVfxVignette, showVfxBanner, stepPos, vfxHitImpact, vfxMs, vfxWait } from './core.js';
import { presentVfxBandwidth, presentVfxBypass, presentVfxCloning, presentVfxDecrypt, presentVfxFirewall, presentVfxGeneric, presentVfxGlitch, presentVfxOverclock, presentVfxOverload, presentVfxRoot, presentVfxScan, presentVfxSurge, presentVfxTrojan } from './presenters.js';

export const ONLINE_FEATURE_VFX = {
  firewall: presentVfxFirewall,
  decrypt: presentVfxDecrypt,
  trojan: presentVfxTrojan,
  overload: presentVfxOverload,
  overclock: presentVfxOverclock,
  cloning: presentVfxCloning,
  root: presentVfxRoot,
  surge: presentVfxSurge,
  glitch: presentVfxGlitch,
  scan: presentVfxScan,
  bandwidth: presentVfxBandwidth,
  bypass: presentVfxBypass,
};

/** Áp data step không animation (khi Skip) */
export function applyFeatureStepDataOnly(step) {
  if (!step) return;
  const featId = mapServerFeatureName(step.name) || '';
  if (Array.isArray(step.changes)) applyStepChanges(step.changes);
  if (Array.isArray(step.splitChanges)) applyStepSplitChanges(step.splitChanges);
  if (featId === 'overclock') {
    const mult = Number(step.multiplier) || 1;
    for (const pos of step.positions || []) {
      const p = stepPos(pos);
      if (p) setCellMultiplier(p.c, p.r, mult);
    }
  }
  if (featId === 'bandwidth') {
    state.globalMultiplier = Number(step.multiplier) || state.globalMultiplier || 1;
  }
  if (featId === 'bypass') state.bypassProtocol = true;
  if (featId === 'trojan') revealTrojanStep(step);
}

/**
 * Apply ONE featureSteps[] entry with PRO beat:
 * fly icon → intro/explain → scene → hit settle.
 */
export async function applyFeatureStep(step, opts = {}) {
  if (!step || !step.name) return;
  if (isVfxSkip()) {
    applyFeatureStepDataOnly(step);
    renderGrid();
    return;
  }
  const featId = mapServerFeatureName(step.name) || String(step.name).toLowerCase();
  const beat = VFX_BEAT[featId] || { settle: 120 };
  const bloom = VFX_BLOOM_COLOR[featId] || 'cyan';

  setMeterStepActive(featId);
  renderFeatureMeter((state.triggeredFeatures || []).map(f => f.id));
  setMeterStepActive(featId);

  // Transition: icon bay từ meter
  if (!(featId === 'firewall' && opts.firewallAnnounced)) {
    await flyFeatureIconFromMeter(featId);
  }
  if (isVfxSkip()) {
    applyFeatureStepDataOnly(step);
    renderGrid();
    return;
  }

  // Explain 📖 hoặc intro ngắn
  if (state.featureExplain) {
    await playFeatureExplainBeat(featId, step);
  } else {
    const skipIntro = featId === 'firewall' && opts.firewallAnnounced;
    if (!skipIntro) {
      await playFeatureIntro(featId);
    } else {
      const badge = document.querySelector(`#featureMeter .feat-badge[data-feature-id="${featId}"]`);
      badge?.classList.add('vfx-active', 'vfx-charge');
      setVfxVignette(true);
      await vfxWait(vfxMs(120, 40));
    }
  }
  if (isVfxSkip()) {
    applyFeatureStepDataOnly(step);
    renderGrid();
    clearVfxStage();
    return;
  }

  const presenter = ONLINE_FEATURE_VFX[featId] || presentVfxGeneric;
  try {
    if (!isVfxSkip()) sfxForFeatureStart(featId);
    await presenter(step, featId, opts);
    if (!isVfxSkip()) {
      sfxForFeatureHit(featId);
      await vfxHitImpact(
        ['firewall', 'trojan', 'surge', 'scan', 'bandwidth'].includes(featId) ? 'full' : 'sm',
        bloom
      );
    }
  } finally {
    hideVfxBanner();
    setVfxVignette(false);
    clearVfxStage();
    document.getElementById('reelsGrid')?.classList.remove('vfx-glitch', 'vfx-glitch-hard');
    clearCellClasses([
      'vfx-hit', 'vfx-split', 'vfx-mult', 'vfx-morph', 'vfx-decrypt',
      'vfx-lock', 'vfx-surge', 'vfx-firewall', 'scrub', 'vfx-shake',
      'vfx-wild-glow',
    ]);
  }
  await vfxWait(vfxMs(beat.settle || 120, 40));
}

/**
 * Play full featureSteps chain after reels land on baseScreen.
 */
export async function presentFeatureSteps(featureSteps, opts = {}) {
  if (!Array.isArray(featureSteps) || !featureSteps.length) return false;
  resetVfxSkip();
  setSkipBarVisible(true);
  setVfxVignette(true);
  showVfxBanner(
    `⚡ KÍCH HOẠT ${featureSteps.length} FEATURE`,
    ''
  );
  await vfxWait(vfxMs(320, 100));
  hideVfxBanner();
  setVfxVignette(false);

  try {
    for (let i = 0; i < featureSteps.length; i++) {
      if (isVfxSkip()) {
        for (let j = i; j < featureSteps.length; j++) {
          applyFeatureStepDataOnly(featureSteps[j]);
        }
        renderGrid();
        break;
      }
      await applyFeatureStep(featureSteps[i], {
        ...opts,
        stepIndex: i,
        stepTotal: featureSteps.length,
      });
    }
  } finally {
    setSkipBarVisible(false);
    clearMeterStepActive();
    hideFeatureIntro(true);
    hideFeatureExplain(true);
  }
  return true;
}
