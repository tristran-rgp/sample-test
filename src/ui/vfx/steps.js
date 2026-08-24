// src/ui/vfx/steps.js — extracted from main.js
import { state } from '../../core/state.js';
import { mapServerFeatureName } from '../../net/session.js';
import { sfx, sfxForFeatureHit, sfxForFeatureStart } from '../../sfx/sfx.js';
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
      // Escalation: rising tick per step when many features stack
      if ((opts.stepTotal || 0) >= 4) {
        sfx('tick', { gain: 0.4, pitch: 1 + (opts.stepIndex || 0) * 0.09, force: true });
      }
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
      'vfx-wild-glow', 'vfx-anticipate',
    ]);
  }
  await vfxWait(vfxMs(beat.settle || 120, 40));
}

/** ×N CHAIN combo counter — floats over the reels while the chain resolves */
function buildComboCounter() {
  const wrap = document.getElementById('reelsWrapper');
  if (!wrap) return null;
  const el = document.createElement('div');
  el.id = 'vfxCombo';
  wrap.appendChild(el);
  return el;
}

function bumpComboCounter(el, n) {
  if (!el) return;
  el.textContent = `×${n} CHAIN`;
  el.classList.add('show');
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
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
  // Sweep beat ripples across the feature meter before the chain resolves
  const meter = document.getElementById('featureMeter');
  const bgScene = document.getElementById('bgScene');
  meter?.classList.remove('chain-sweep');
  void meter?.offsetWidth;
  meter?.classList.add('chain-sweep');
  bgScene?.classList.add('chain-fast');
  await vfxWait(vfxMs(320, 100));
  hideVfxBanner();
  setVfxVignette(false);

  // Maelstrom: riser under the whole chain when ≥4 features stack
  const maelstrom = featureSteps.length >= 4;
  if (maelstrom) sfx('riser', { gain: 0.75, force: true });
  const comboEl = featureSteps.length >= 2 ? buildComboCounter() : null;

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
      bumpComboCounter(comboEl, i + 1);
    }
  } finally {
    setSkipBarVisible(false);
    clearMeterStepActive();
    meter?.classList.remove('chain-sweep');
    bgScene?.classList.remove('chain-fast');
    comboEl?.remove();
    hideFeatureIntro(true);
    hideFeatureExplain(true);
  }
  return true;
}
