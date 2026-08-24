// src/ui/vfx/presenters.js — extracted from main.js
import { state } from '../../core/state.js';
import { sleepRaw } from '../../core/utils.js';
import { REELS, ROWS, SYM_MAP } from '../../game/config.js';
import { splitCountOf, stackCellSplit } from '../../game/grid.js';
import { sfx, sfxForFeatureHit, sfxForFeatureStart } from '../../sfx/sfx.js';
import { showToast } from '../feedback.js';
import { renderGrid } from '../render.js';
import { boostWildSprite, setCellSymbolFx } from '../sprites.js';
import { applySplitsAnimated, drawElectricArc, drawRadialWash, drawRgbSplit, drawScanlines, drawShockwave, hitStop, morphChangesSequential, screenPunch, vfxParticleN } from './cinematic.js';
import { applyStepChanges, applyStepSplitChanges, burstParticles, cellEl, cellRectInWrap, cellWildStepLabel, clearCellClasses, clearVfxStage, drawParts, featureStepToast, hideVfxBanner, highlightCells, highlightCellsKeep, isVfxSkip, posKeys, prepVfxCanvas, proBurst, reelRectInWrap, revealTrojanStep, runAnimFrame, setCellMultiplier, setCellMystery, setCellSymbol, setVfxBloom, setVfxVignette, showVfxBanner, stepPos, surgeStepLabel, symNameFromId, vfxFlash, vfxMs, vfxStage, vfxWait } from './core.js';

// ─── 12 cinematic presenters (GDD art brief) ─────────────────

export async function presentVfxFirewall(step, featId, opts) {
  const lows = Array.isArray(step.bannedLows) ? step.bannedLows.map(symNameFromId) : [];
  showVfxBanner(lows.length ? `Firewall — incinerate ${lows.join(', ')}` : 'Firewall Block', 'firewall');
  if (!opts.firewallAnnounced) featureStepToast(step, featId);
  clearVfxStage();
  const st = vfxStage();
  const wall = document.createElement('div');
  wall.className = 'vfx-fire-wall';
  st?.appendChild(wall);
  await sleepRaw(30);
  wall.classList.add('up');
  setVfxBloom('red', true);
  setVfxVignette(true);
  screenPunch('sm');
  await vfxFlash('red', vfxMs(180, 60));

  const canvas = prepVfxCanvas();
  let parts = [];
  const burnKeys = [];
  const burnCells = [];
  if (Array.isArray(step.changes)) {
    for (const ch of step.changes) {
      const p = stepPos(ch?.pos);
      if (!p) continue;
      burnKeys.push(`${p.c},${p.r}`);
      const rc = cellRectInWrap(p.c, p.r);
      if (rc) burnCells.push(rc);
      if (rc && canvas) {
        parts = parts.concat(proBurst(canvas.ctx, rc.x, rc.y, {
          core: '#fff0a0', mid: '#ff5522', smoke: 'rgba(40,10,0,0.4)',
        }, 1.45));
        parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#ffcc44', vfxParticleN(10), 'ember'));
      }
      cellEl(p.c, p.r)?.classList.add('vfx-firewall', 'scrub');
    }
  } else {
    const banned = new Set((step.bannedLows || []).map(id => SYM_MAP[id]).filter(Boolean));
    for (let c = 0; c < REELS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (banned.has(state.grid[c][r])) {
          burnKeys.push(`${c},${r}`);
          cellEl(c, r)?.classList.add('vfx-firewall');
          const rc = cellRectInWrap(c, r);
          if (rc) burnCells.push(rc);
        }
      }
    }
  }

  if (canvas) {
    await runAnimFrame(vfxMs(900, 320), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      // rising heat + ember rain
      const g = canvas.ctx.createLinearGradient(0, canvas.h * (1 - t * 1.05), 0, canvas.h);
      g.addColorStop(0, 'rgba(255,80,0,0)');
      g.addColorStop(0.45, 'rgba(255,50,0,0.28)');
      g.addColorStop(1, 'rgba(255,200,40,0.48)');
      canvas.ctx.fillStyle = g;
      canvas.ctx.fillRect(0, 0, canvas.w, canvas.h);
      // heat shimmer on burn cells + delayed shockwave
      for (let i = 0; i < burnCells.length; i++) {
        const rc = burnCells[i];
        const localT = Math.max(0, Math.min(1, (t - i * 0.06) * 1.4));
        if (localT > 0) {
          drawShockwave(canvas.ctx, rc.x, rc.y, localT, [255, 80, 20], 70);
          drawRadialWash(canvas.ctx, rc.x, rc.y, 40 + localT * 20, `rgba(255,100,0,${0.25 * (1 - localT * 0.5)})`);
        }
      }
      if (Math.random() < 0.55) {
        parts = parts.concat(burstParticles(
          canvas.ctx,
          Math.random() * canvas.w,
          canvas.h * (0.85 + Math.random() * 0.15),
          Math.random() > 0.5 ? '#ff6622' : '#ffcc44',
          vfxParticleN(4),
          'ember'
        ));
      }
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  } else {
    await sleepRaw(vfxMs(700, 260));
  }

  await hitStop(55);
  screenPunch('full');
  if (step.changes?.length) applyStepChanges(step.changes);
  renderGrid();
  await highlightCells(burnKeys, 'vfx-hit', vfxMs(280, 95));
  clearCellClasses(['vfx-firewall', 'scrub']);
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

export async function presentVfxDecrypt(step, featId) {
  showVfxBanner('Data Decrypt — laser grid scan', 'decrypt');
  featureStepToast(step, featId);
  clearVfxStage();
  setVfxBloom('cyan', true);
  setVfxVignette(true);
  const st = vfxStage();
  const gridFx = document.createElement('div');
  gridFx.className = 'vfx-laser-grid';
  const beam = document.createElement('div');
  beam.className = 'vfx-laser-beam';
  st?.appendChild(gridFx);
  st?.appendChild(beam);
  await sleepRaw(20);
  gridFx.classList.add('on');
  beam.style.opacity = '1';

  const wrap = document.getElementById('reelsWrapper');
  const h = wrap?.clientHeight || 200;
  const canvas = prepVfxCanvas();
  let parts = [];
  // Pre-mark upgrade targets for beam "lock" sparks
  const targets = [];
  for (const ch of (step.changes || [])) {
    const p = stepPos(ch?.pos);
    if (!p) continue;
    const rc = cellRectInWrap(p.c, p.r);
    if (rc) targets.push(rc);
  }

  await runAnimFrame(vfxMs(820, 300), (t) => {
    beam.style.top = `${t * (h - 4)}px`;
    beam.style.opacity = String(0.45 + 0.55 * Math.sin(t * Math.PI));
    if (canvas) {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      drawScanlines(canvas.ctx, canvas.w, canvas.h, t, 0.08);
      const y = t * canvas.h;
      const g = canvas.ctx.createLinearGradient(0, y - 36, 0, y + 14);
      g.addColorStop(0, 'rgba(0,240,255,0)');
      g.addColorStop(0.7, 'rgba(0,240,255,0.18)');
      g.addColorStop(1, 'rgba(180,255,255,0.35)');
      canvas.ctx.fillStyle = g;
      canvas.ctx.fillRect(0, Math.max(0, y - 36), canvas.w, 50);
      // horizontal laser core
      canvas.ctx.fillStyle = `rgba(0,240,255,${0.55 + 0.35 * Math.sin(t * Math.PI)})`;
      canvas.ctx.shadowColor = '#00f0ff';
      canvas.ctx.shadowBlur = 14;
      canvas.ctx.fillRect(0, y - 1.5, canvas.w, 3);
      canvas.ctx.shadowBlur = 0;
      // spark when beam crosses target cells
      for (const rc of targets) {
        if (Math.abs(rc.y - y) < 14) {
          parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#00f0ff', vfxParticleN(3), 'star'));
          drawRadialWash(canvas.ctx, rc.x, rc.y, 28, 'rgba(0,240,255,0.25)');
        }
      }
      if (Math.random() < 0.4) {
        parts = parts.concat(burstParticles(canvas.ctx, Math.random() * canvas.w, y, '#00f0ff', vfxParticleN(3), 'star'));
      }
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    }
  });

  await hitStop(40);
  screenPunch('sm');
  if (Array.isArray(step.changes) && step.changes.length) {
    await morphChangesSequential(step.changes, 'vfx-decrypt', {
      canvas, rgb: [0, 240, 255], partColor: '#7dffff',
    });
  }
  beam.style.opacity = '0';
  gridFx.classList.remove('on');
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

export async function presentVfxTrojan(step, featId) {
  const mysteryPos = Array.isArray(step.mysteryPositions) ? step.mysteryPositions : [];
  const changePos = Array.isArray(step.changes) ? step.changes.map(ch => ch.pos) : [];
  const positions = mysteryPos.length ? mysteryPos : changePos;
  const keys = posKeys(positions);
  const revName = step.revealTo != null ? symNameFromId(step.revealTo) : '?';

  showVfxBanner('Trojan Horse — packages dropping', 'trojan');
  featureStepToast(step, featId);
  clearVfxStage();
  const st = vfxStage();
  const pkgs = [];
  const targets = [];

  // 1) Drop encrypted packages onto cells
  for (const pos of positions) {
    if (isVfxSkip()) break;
    const p = stepPos(pos);
    if (!p) continue;
    const rc = cellRectInWrap(p.c, p.r);
    if (!rc) continue;
    const pkg = document.createElement('div');
    pkg.className = 'vfx-drop-pkg';
    pkg.style.left = rc.x + 'px';
    pkg.style.top = rc.y + 'px';
    pkg.textContent = '🐴';
    pkg.title = 'Encrypted';
    st?.appendChild(pkg);
    pkgs.push({ pkg, p, rc });
    targets.push({ p, rc });
    setCellMystery(p.c, p.r, true);
  }
  renderGrid();
  setVfxVignette(true);
  setVfxBloom('purple', true);
  await vfxWait(vfxMs(520, 200));

  // 2) Charge: purple code rain + pulse on mystery cells
  const canvas = prepVfxCanvas();
  let parts = [];
  if (canvas && targets.length && !isVfxSkip()) {
    await runAnimFrame(vfxMs(720, 260), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      for (const { rc } of targets) {
        drawRadialWash(canvas.ctx, rc.x, rc.y, 48 + t * 20, `rgba(170,68,255,${0.18 + t * 0.2})`);
        if (Math.random() < 0.55) {
          parts = parts.concat(burstParticles(
            canvas.ctx, rc.x + (Math.random() - 0.5) * rc.w * 0.6,
            rc.y - rc.h * 0.35, '#c080ff', vfxParticleN(2), 'code'
          ));
        }
      }
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  } else {
    await vfxWait(vfxMs(400, 140));
  }

  // 3) Crack: staggered shockwaves
  showVfxBanner(`Trojan Horse — decrypting…`, 'trojan');
  sfx('charge', { gain: 0.75 });
  for (let i = 0; i < pkgs.length; i++) {
    if (isVfxSkip()) break;
    const { pkg, rc } = pkgs[i];
    pkg.classList.add('boom');
    screenPunch('sm');
    if (canvas && rc) {
      await runAnimFrame(vfxMs(220, 80), (t) => {
        canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
        // keep lingering particles from prior cracks
        parts = drawParts(canvas.ctx, parts, 1 / 55);
        for (let j = 0; j <= i; j++) {
          const rrc = pkgs[j].rc;
          if (!rrc) continue;
          drawShockwave(canvas.ctx, rrc.x, rrc.y, t, [200, 80, 255], 70 + j * 8);
        }
        drawRadialWash(canvas.ctx, rc.x, rc.y, 60, 'rgba(255,255,255,0.12)');
      });
      parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#e0a0ff', vfxParticleN(8), 'code'));
    }
    await vfxWait(vfxMs(55, 20));
  }

  // 4) Anticipation: all mystery cells shake in sync before the mass flip
  if (!isVfxSkip()) {
    const mysteryCells = targets
      .map(({ p }) => cellEl(p.c, p.r))
      .filter(Boolean);
    for (const el of mysteryCells) el.classList.add('vfx-anticipate');
    sfx('charge', { gain: 0.6, pitch: 1.35 });
    await vfxWait(vfxMs(420, 150));
    for (const el of mysteryCells) el.classList.remove('vfx-anticipate');
  }

  // 5) Hit-stop → mass reveal
  await hitStop(70);
  showVfxBanner(`Trojan Horse — reveal ${revName}`, 'trojan');
  sfx('hit', { gain: 1 });
  screenPunch('full');
  setVfxBloom('purple', true);

  if (canvas) {
    for (const { rc } of targets) {
      if (!rc) continue;
      parts = parts.concat(proBurst(canvas.ctx, rc.x, rc.y, {
        core: '#fff', mid: '#cc66ff', smoke: 'rgba(60,20,90,0.45)',
      }, 1.65));
      parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#e0a0ff', vfxParticleN(28), 'code'));
      parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#ffffff', vfxParticleN(14), 'star'));
    }
  }

  revealTrojanStep(step);
  renderGrid();

  if (canvas) {
    await runAnimFrame(vfxMs(680, 240), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      for (const { rc } of targets) {
        if (rc) drawShockwave(canvas.ctx, rc.x, rc.y, Math.min(1, t * 1.2), [220, 120, 255], 100);
      }
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  }
  await highlightCells(keys, 'vfx-morph', vfxMs(320, 110));
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

export async function presentVfxOverload(step, featId) {
  const cols = Array.isArray(step.columns) ? step.columns.map(Number) : [];
  showVfxBanner(
    cols.length ? `Data Overload — wild surge col ${cols.map(c => c + 1).join(', ')}` : 'Data Overload',
    'overload'
  );
  featureStepToast(step, featId);
  clearVfxStage();
  const canvas = prepVfxCanvas();
  setVfxBloom('orange', true);
  setVfxVignette(true);

  // Spark from existing wilds first
  let parts = [];
  if (canvas) {
    for (let c = 0; c < REELS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (state.grid[c][r] === 'W') {
          const rc = cellRectInWrap(c, r);
          if (rc) {
            cellEl(c, r)?.classList.add('vfx-wild-glow');
            boostWildSprite(1200);
            parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#ffcc44', vfxParticleN(14), 'spark'));
          }
        }
      }
    }
    await runAnimFrame(vfxMs(420, 150), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      for (const col of cols) {
        const rr = reelRectInWrap(col);
        if (!rr) continue;
        // column wash
        const g = canvas.ctx.createLinearGradient(rr.left, rr.top, rr.left + rr.w, rr.top);
        g.addColorStop(0, 'rgba(255,140,0,0)');
        g.addColorStop(0.5, `rgba(255,180,40,${0.18 + t * 0.15})`);
        g.addColorStop(1, 'rgba(255,140,0,0)');
        canvas.ctx.fillStyle = g;
        canvas.ctx.fillRect(rr.left, rr.top, rr.w, rr.h);
        drawElectricArc(canvas.ctx, rr.x, rr.top, rr.x, rr.top + rr.h, t * 6 + col, '#ffcc44');
        drawElectricArc(canvas.ctx, rr.x - 10, rr.top + 8, rr.x + 8, rr.top + rr.h - 6, t * 5 + col + 1, '#ff8800');
      }
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  }

  for (const col of cols) {
    document.getElementById(`reel-${col}`)?.classList.add('vfx-wild-col');
  }
  boostWildSprite(1800);

  if (Array.isArray(step.changes) && step.changes.length) {
    const byCol = new Map();
    for (const ch of step.changes) {
      const p = stepPos(ch?.pos);
      if (!p) continue;
      if (!byCol.has(p.c)) byCol.set(p.c, []);
      byCol.get(p.c).push(ch);
    }
    for (const [col, chs] of byCol) {
      if (isVfxSkip()) {
        applyStepChanges(chs);
        continue;
      }
      await hitStop(35);
      screenPunch('sm');
      applyStepChanges(chs);
      renderGrid();
      for (const ch of chs) {
        const p = stepPos(ch.pos);
        if (!p) continue;
        cellEl(p.c, p.r)?.classList.add('vfx-wild-glow');
        const rc = cellRectInWrap(p.c, p.r);
        if (canvas && rc) {
          parts = parts.concat(proBurst(canvas.ctx, rc.x, rc.y, {
            core: '#fff', mid: '#ffcc44', smoke: 'rgba(60,30,0,0.3)',
          }, 1.2));
        }
      }
      if (canvas) {
        const rr = reelRectInWrap(col);
        await runAnimFrame(vfxMs(280, 100), (t) => {
          canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
          if (rr) {
            drawShockwave(canvas.ctx, rr.x, rr.y, t, [255, 180, 40], 90);
            drawRadialWash(canvas.ctx, rr.x, rr.y, 70, `rgba(255,160,0,${0.2 * (1 - t)})`);
          }
          parts = drawParts(canvas.ctx, parts, 1 / 55);
        });
      } else {
        await sleepRaw(vfxMs(220, 80));
      }
    }
  } else {
    await sleepRaw(vfxMs(400, 140));
  }

  document.querySelectorAll('.vfx-wild-col').forEach(el => el.classList.remove('vfx-wild-col'));
  clearCellClasses(['vfx-wild-glow']);
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

export async function presentVfxOverclock(step, featId) {
  const mult = Number(step.multiplier) || 1;
  const sym = step.targetSymbol != null ? symNameFromId(step.targetSymbol) : '?';
  showVfxBanner(`System Overclock — ${sym} ×${mult}`, 'overclock');
  featureStepToast(step, featId);
  clearVfxStage();

  const badge = document.getElementById('vfxCpuBadge');
  if (badge) {
    badge.textContent = `⚡ CPU ×${mult}`;
    badge.classList.add('show');
  }
  setVfxBloom('orange', true);
  setVfxVignette(true);
  await vfxFlash('orange', vfxMs(160, 55));
  // CPU heat charge
  const canvasCharge = prepVfxCanvas();
  if (canvasCharge && !isVfxSkip()) {
    await runAnimFrame(vfxMs(320, 110), (t) => {
      canvasCharge.ctx.clearRect(0, 0, canvasCharge.w, canvasCharge.h);
      drawRadialWash(
        canvasCharge.ctx, canvasCharge.w / 2, canvasCharge.h / 2,
        40 + t * 90, `rgba(255,120,0,${0.12 + t * 0.15})`
      );
      drawScanlines(canvasCharge.ctx, canvasCharge.w, canvasCharge.h, t, 0.06);
    });
  } else {
    await sleepRaw(vfxMs(200, 70));
  }

  const hit = [];
  const positions = Array.isArray(step.positions) ? step.positions : [];
  for (const pos of positions) {
    const p = stepPos(pos);
    if (!p) continue;
    setCellMultiplier(p.c, p.r, mult);
    hit.push(`${p.c},${p.r}`);
  }
  if (!hit.length && step.targetSymbol != null) {
    const key = SYM_MAP[step.targetSymbol];
    for (let c = 0; c < REELS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (state.grid[c][r] === key) {
          setCellMultiplier(c, r, mult);
          hit.push(`${c},${r}`);
        }
      }
    }
  }
  renderGrid();

  const st = vfxStage();
  const canvas = prepVfxCanvas();
  let parts = [];
  for (let i = 0; i < hit.length; i++) {
    if (isVfxSkip()) break;
    const k = hit[i];
    const [c, r] = k.split(',').map(Number);
    const rc = cellRectInWrap(c, r);
    if (!rc) continue;
    const stamp = document.createElement('div');
    stamp.className = 'vfx-stamp';
    stamp.textContent = `×${mult}`;
    stamp.style.left = rc.x - 18 + 'px';
    stamp.style.top = rc.y - 14 + 'px';
    st?.appendChild(stamp);
    cellEl(c, r)?.classList.add('vfx-mult', 'vfx-hit');
    screenPunch(i === 0 ? 'sm' : 'sm');
    if (canvas) {
      parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#ffaa44', vfxParticleN(14), 'star'));
      parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#ff8800', vfxParticleN(10), 'ember'));
      await runAnimFrame(vfxMs(140, 50), (t) => {
        canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
        drawShockwave(canvas.ctx, rc.x, rc.y, t, [255, 140, 0], 50);
        drawRadialWash(canvas.ctx, rc.x, rc.y, 36, `rgba(255,160,40,${0.3 * (1 - t)})`);
        // floating ×N ghost
        canvas.ctx.save();
        canvas.ctx.globalAlpha = 0.85 * (1 - t * 0.4);
        canvas.ctx.fillStyle = '#ffcc66';
        canvas.ctx.font = `bold ${18 + t * 10}px system-ui,sans-serif`;
        canvas.ctx.textAlign = 'center';
        canvas.ctx.shadowColor = '#ff8800';
        canvas.ctx.shadowBlur = 12;
        canvas.ctx.fillText(`×${mult}`, rc.x, rc.y - 10 - t * 24);
        canvas.ctx.restore();
        parts = drawParts(canvas.ctx, parts, 1 / 55);
      });
    } else {
      await sleepRaw(vfxMs(100, 35));
    }
  }
  if (canvas && parts.length) {
    await runAnimFrame(vfxMs(360, 120), () => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  } else {
    await sleepRaw(vfxMs(280, 100));
  }
  clearCellClasses(['vfx-mult', 'vfx-hit']);
  badge?.classList.remove('show');
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

export async function presentVfxCloning(step, featId) {
  const sym = step.targetSymbol != null ? symNameFromId(step.targetSymbol) : 'symbols';
  showVfxBanner(`Data Cloning — ${sym} mitosis`, 'cloning');
  featureStepToast(step, featId);
  clearVfxStage();
  const st = vfxStage();
  const canvas = prepVfxCanvas();
  setVfxBloom('green', true);
  let parts = [];

  let keys = posKeys(step.positions);
  if (!keys.length && step.splitChanges) keys = posKeys(step.splitChanges.map(ch => ch.pos));

  for (const k of keys) {
    if (isVfxSkip()) break;
    const [c, r] = k.split(',').map(Number);
    const el = cellEl(c, r);
    el?.classList.add('vfx-shake');
    const rc = cellRectInWrap(c, r);
    if (rc && el) {
      const ghost = el.cloneNode(true);
      ghost.className = 'vfx-clone-ghost';
      ghost.style.left = rc.left + 'px';
      ghost.style.top = rc.top + 'px';
      ghost.style.width = rc.w + 'px';
      ghost.style.height = rc.h + 'px';
      st?.appendChild(ghost);
      if (canvas) {
        parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#00ff88', vfxParticleN(8), 'star'));
        await runAnimFrame(vfxMs(100, 35), (t) => {
          canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
          // dual ghost offsets
          drawRadialWash(canvas.ctx, rc.x - 12 * t, rc.y, 28, 'rgba(0,255,136,0.2)');
          drawRadialWash(canvas.ctx, rc.x + 12 * t, rc.y, 28, 'rgba(0,255,200,0.2)');
          drawShockwave(canvas.ctx, rc.x, rc.y, t * 0.7, [0, 255, 160], 36);
          parts = drawParts(canvas.ctx, parts, 1 / 55);
        });
      }
    }
    await vfxWait(vfxMs(40, 15));
  }
  await hitStop(45);
  screenPunch('sm');

  if (Array.isArray(step.splitChanges) && step.splitChanges.length) {
    await applySplitsAnimated(step.splitChanges);
  } else {
    for (const k of keys) {
      const [c, r] = k.split(',').map(Number);
      stackCellSplit(c, r);
    }
    renderGrid();
    await highlightCells(keys, 'vfx-split', vfxMs(420, 150));
  }
  clearCellClasses(['vfx-shake']);
  setVfxBloom(null, false);
  clearVfxStage();
  hideVfxBanner();
}

export async function presentVfxRoot(step, featId) {
  let reels = Array.isArray(step.reels) ? step.reels.map(Number).filter(c => c >= 0 && c < REELS) : [];
  // Fallback: suy reel từ positions / splitChanges nếu server không gửi reels
  if (!reels.length) {
    const fromPos = new Set();
    for (const pos of (step.positions || [])) {
      const p = stepPos(pos);
      if (p) fromPos.add(p.c);
    }
    for (const ch of (step.splitChanges || [])) {
      const p = stepPos(ch?.pos);
      if (p) fromPos.add(p.c);
    }
    reels = [...fromPos];
  }
  const reelLabel = reels.length
    ? `reel ${reels.map(c => c + 1).join(', ')}`
    : 'reels';
  showVfxBanner(`Root Access — tách đôi ${reelLabel}`, 'root');
  featureStepToast(step, featId);
  clearVfxStage();
  const canvas = prepVfxCanvas();
  sfxForFeatureStart(featId);
  setVfxBloom('green', true);
  setVfxVignette(true);

  // Highlight target reels
  for (const col of reels) {
    document.getElementById(`reel-${col}`)?.classList.add('vfx-col-root');
  }

  // Matrix rain on target reels + column wash
  const drops = [];
  if (canvas && reels.length) {
    for (const col of reels) {
      const rr = reelRectInWrap(col);
      if (!rr) continue;
      for (let i = 0; i < 22; i++) {
        drops.push({
          x: rr.left + Math.random() * rr.w,
          y: rr.top - Math.random() * rr.h,
          speed: 100 + Math.random() * 200,
          chars: '01ROOTACCESS#$%'.split(''),
          maxY: rr.top + rr.h,
        });
      }
    }
    await runAnimFrame(vfxMs(820, 280), (t, ms) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      for (const col of reels) {
        const rr = reelRectInWrap(col);
        if (!rr) continue;
        const g = canvas.ctx.createLinearGradient(rr.left, rr.top, rr.left + rr.w, rr.top);
        g.addColorStop(0, 'rgba(0,255,136,0)');
        g.addColorStop(0.5, `rgba(0,255,136,${0.1 + t * 0.12})`);
        g.addColorStop(1, 'rgba(0,255,136,0)');
        canvas.ctx.fillStyle = g;
        canvas.ctx.fillRect(rr.left, rr.top, rr.w, rr.h);
      }
      canvas.ctx.font = 'bold 12px monospace';
      for (const d of drops) {
        d.y += d.speed * (1 / 55);
        if (d.y > d.maxY + 20) d.y = d.maxY - 120 - Math.random() * 40;
        for (let k = 0; k < 10; k++) {
          const yy = d.y - k * 12;
          canvas.ctx.fillStyle = k === 0
            ? 'rgba(200,255,230,0.98)'
            : `rgba(0,255,136,${Math.max(0.08, 0.65 - k * 0.06)})`;
          canvas.ctx.fillText(d.chars[(k + Math.floor(ms / 35)) % d.chars.length], d.x, yy);
        }
      }
    });
  } else {
    await sleepRaw(vfxMs(450, 160));
  }

  await hitStop(50);
  screenPunch('full');

  // Apply split → dual-symbol pop on each cell
  let keys = [];
  if (Array.isArray(step.splitChanges) && step.splitChanges.length) {
    keys = await applySplitsAnimated(step.splitChanges);
  } else if (Array.isArray(step.positions) && step.positions.length) {
    keys = posKeys(step.positions);
    for (const k of keys) {
      const [c, r] = k.split(',').map(Number);
      stackCellSplit(c, r);
    }
    renderGrid();
    // reuse animated split feel
    const fake = keys.map(k => {
      const [c, r] = k.split(',').map(Number);
      return { pos: [c, r], to: splitCountOf(state.cellMeta[c]?.[r]) };
    });
    await applySplitsAnimated(fake);
  } else if (reels.length) {
    // Last resort: split non-scatter cells on announced reels
    for (const c of reels) {
      for (let r = 0; r < ROWS; r++) {
        if (state.grid[c]?.[r] !== 'S') {
          stackCellSplit(c, r);
          keys.push(`${c},${r}`);
        }
      }
    }
    renderGrid();
    await highlightCells(keys, 'vfx-split', vfxMs(500, 180));
  }

  if (keys.length) sfxForFeatureHit(featId);
  showToast(
    `🌧️ Root Access: ${keys.length || '—'} ô tách đôi (×2 ways)`,
    '#00ff88'
  );

  document.querySelectorAll('.vfx-col-root').forEach(el => el.classList.remove('vfx-col-root'));
  if (canvas) canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

export async function presentVfxSurge(step, featId) {
  const types = surgeStepLabel(step);
  showVfxBanner(`Power Surge — lightning · ${types}`, 'surge');
  featureStepToast(step, featId);
  clearVfxStage();
  const canvas = prepVfxCanvas();
  const st = vfxStage();
  let parts = [];
  setVfxBloom('yellow', true);
  setVfxVignette(true);

  const wildTargets = [];
  if (Array.isArray(step.changes)) {
    for (const ch of step.changes) {
      const p = stepPos(ch?.pos);
      if (p) wildTargets.push(p);
    }
  } else {
    for (const pos of step.positions || []) {
      const p = stepPos(pos);
      if (p) wildTargets.push(p);
    }
  }

  // Pre-charge sky flash
  if (canvas && !isVfxSkip()) {
    await runAnimFrame(vfxMs(280, 100), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      const g = canvas.ctx.createLinearGradient(0, 0, 0, canvas.h * 0.5);
      g.addColorStop(0, `rgba(255,255,180,${0.12 * t})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      canvas.ctx.fillStyle = g;
      canvas.ctx.fillRect(0, 0, canvas.w, canvas.h);
    });
  }

  // Lightning → convert each target
  for (let ti = 0; ti < wildTargets.length; ti++) {
    if (isVfxSkip()) break;
    const p = wildTargets[ti];
    const rc = cellRectInWrap(p.c, p.r);
    if (canvas && rc) {
      const seed = performance.now() * 0.001 + ti;
      await runAnimFrame(vfxMs(240, 85), (t) => {
        canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
        parts = drawParts(canvas.ctx, parts, 1 / 55);
        // main bolt top → cell + forks
        drawElectricArc(canvas.ctx, rc.x, 0, rc.x, rc.y, seed + t * 3, '#ffff66');
        drawElectricArc(canvas.ctx, rc.x - 18, 8, rc.x - 4, rc.y, seed + 1.7 + t, '#ffe088');
        drawElectricArc(canvas.ctx, rc.x + 16, 4, rc.x + 6, rc.y, seed + 2.9 + t, '#ffffaa');
        drawRadialWash(canvas.ctx, rc.x, rc.y, 40 + t * 30, `rgba(255,255,100,${0.2 + t * 0.25})`);
        drawShockwave(canvas.ctx, rc.x, rc.y, t * 0.85, [255, 255, 80], 55);
      });
      await hitStop(40);
      screenPunch(ti === 0 ? 'full' : 'sm');
      parts = parts.concat(proBurst(canvas.ctx, rc.x, rc.y, {
        core: '#ffffff', mid: '#ffff66', smoke: 'rgba(80,80,20,0.35)',
      }, 1.45));
      parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#ffe066', vfxParticleN(16), 'star'));
      parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#ffcc44', vfxParticleN(10), 'ember'));
    }
    const ch = (step.changes || []).find(x => {
      const q = stepPos(x.pos);
      return q && q.c === p.c && q.r === p.r;
    });
    if (ch) setCellSymbol(p.c, p.r, ch.to);
    else setCellSymbol(p.c, p.r, 11);
    renderGrid();
    {
      const el = cellEl(p.c, p.r);
      el?.classList.add('vfx-surge', 'vfx-wild-glow');
      if (el) setCellSymbolFx(el, 'surge');
      boostWildSprite(1400);
    }

    if (rc && st) {
      const ring = document.createElement('div');
      ring.className = 'vfx-shock-ring';
      ring.style.left = rc.x + 'px';
      ring.style.top = rc.y + 'px';
      st.appendChild(ring);
      const ring2 = document.createElement('div');
      ring2.className = 'vfx-shock-ring';
      ring2.style.left = rc.x + 'px';
      ring2.style.top = rc.y + 'px';
      ring2.style.animationDelay = '0.12s';
      st.appendChild(ring2);
    }
    await vfxWait(vfxMs(70, 25));
  }

  // Arc chain between converted cells (cinematic link)
  if (canvas && wildTargets.length >= 2 && !isVfxSkip()) {
    const pts = wildTargets.map(p => cellRectInWrap(p.c, p.r)).filter(Boolean);
    await runAnimFrame(vfxMs(420, 150), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      for (let i = 0; i < pts.length - 1; i++) {
        drawElectricArc(
          canvas.ctx, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y,
          t * 8 + i, i % 2 ? '#ffff88' : '#ffe060'
        );
      }
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  } else if (canvas && parts.length) {
    await runAnimFrame(vfxMs(400, 140), () => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  }

  if (Array.isArray(step.splitChanges) && step.splitChanges.length) {
    showVfxBanner('Power Surge — shockwave split', 'surge');
    screenPunch('sm');
    await applySplitsAnimated(step.splitChanges);
  }
  clearCellClasses(['vfx-surge', 'vfx-wild-glow']);
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

export async function presentVfxGlitch(step, featId) {
  showVfxBanner('System Glitch — noise / reshuffle', 'glitch');
  featureStepToast(step, featId);
  clearVfxStage();
  const st = vfxStage();
  const bars = document.createElement('div');
  bars.className = 'vfx-glitch-bars on';
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('span');
    s.style.top = `${(i / 16) * 100 + Math.random() * 3}%`;
    s.style.animationDelay = `${Math.random() * 0.12}s`;
    bars.appendChild(s);
  }
  st?.appendChild(bars);

  const grid = document.getElementById('reelsGrid');
  grid?.classList.add('vfx-glitch-hard', 'vfx-glitch');
  setVfxBloom('purple', true);
  setVfxVignette(true);
  screenPunch('full');
  await vfxFlash('purple', vfxMs(180, 60));

  // Full-frame RGB split + scanlines storm
  const canvas = prepVfxCanvas();
  let parts = [];
  if (canvas && !isVfxSkip()) {
    await runAnimFrame(vfxMs(700, 260), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      drawRgbSplit(canvas.ctx, canvas.w, canvas.h, t, 8 + t * 6);
      drawScanlines(canvas.ctx, canvas.w, canvas.h, t, 0.16 + t * 0.08);
      if (Math.random() < 0.4) {
        parts = parts.concat(burstParticles(
          canvas.ctx,
          Math.random() * canvas.w,
          Math.random() * canvas.h,
          Math.random() > 0.5 ? '#aa44ff' : '#00f0ff',
          vfxParticleN(3),
          'code'
        ));
      }
      parts = drawParts(canvas.ctx, parts, 1 / 50);
    });
  } else {
    await vfxWait(vfxMs(480, 160));
  }

  // Morph cells one-by-one with local glitch pop
  const changes = Array.isArray(step.changes) ? step.changes : [];
  if (changes.length) {
    showVfxBanner('System Glitch — rewrite cells', 'glitch');
    for (let i = 0; i < changes.length; i++) {
      if (isVfxSkip()) {
        applyStepChanges(changes.slice(i));
        break;
      }
      const ch = changes[i];
      const p = stepPos(ch?.pos);
      if (!p) continue;
      if (ch.to != null) setCellSymbol(p.c, p.r, ch.to);
      setCellMystery(p.c, p.r, false);
      renderGrid();
      const el = cellEl(p.c, p.r);
      el?.classList.add('vfx-morph', 'vfx-hit');
      const rc = cellRectInWrap(p.c, p.r);
      if (canvas && rc) {
        await runAnimFrame(vfxMs(120, 45), (t) => {
          canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
          drawRgbSplit(canvas.ctx, canvas.w, canvas.h, t * 0.5 + i * 0.07, 5);
          drawScanlines(canvas.ctx, canvas.w, canvas.h, t + i * 0.1, 0.1);
          drawShockwave(canvas.ctx, rc.x, rc.y, t, [180, 80, 255], 48);
          parts = parts.concat(burstParticles(canvas.ctx, rc.x, rc.y, '#c080ff', vfxParticleN(4), 'code'));
          parts = drawParts(canvas.ctx, parts, 1 / 55);
        });
      } else {
        await vfxWait(vfxMs(90, 30));
      }
      el?.classList.remove('vfx-morph', 'vfx-hit');
    }
    if (step.splitChanges) applyStepSplitChanges(step.splitChanges);
    renderGrid();
    const keys = posKeys(changes.map(ch => ch.pos));
    await highlightCells(keys, 'vfx-morph', vfxMs(280, 100));
  } else if (step.splitChanges) {
    applyStepSplitChanges(step.splitChanges);
    renderGrid();
  }

  // Outro glitch flash
  if (canvas && !isVfxSkip()) {
    await hitStop(50);
    screenPunch('sm');
    await runAnimFrame(vfxMs(280, 100), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      drawRgbSplit(canvas.ctx, canvas.w, canvas.h, 1 - t, 10 * (1 - t));
      drawScanlines(canvas.ctx, canvas.w, canvas.h, t, 0.12 * (1 - t));
      parts = drawParts(canvas.ctx, parts, 1 / 50);
    });
  }

  grid?.classList.remove('vfx-glitch-hard', 'vfx-glitch');
  bars.classList.remove('on');
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

export async function presentVfxScan(step, featId) {
  showVfxBanner(`Algorithmic Scan — lock ${cellWildStepLabel(step)}`, 'scan');
  featureStepToast(step, featId);
  clearVfxStage();
  const canvas = prepVfxCanvas();
  setVfxVignette(true);

  let keys = posKeys(step.positions);
  if (!keys.length) keys = posKeys((step.changes || []).map(ch => ch.pos));
  const targets = keys.map(k => {
    const [c, r] = k.split(',').map(Number);
    return cellRectInWrap(c, r);
  }).filter(Boolean);

  // Radar sweeps then locks each target
  if (canvas) {
    const cx = canvas.w / 2;
    const cy = canvas.h / 2;
    setVfxBloom('cyan', true);
    let lockParts = [];
    await runAnimFrame(vfxMs(920, 320), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      drawScanlines(canvas.ctx, canvas.w, canvas.h, t, 0.07);
      const ang = t * Math.PI * 2.8;
      // radar fill wedge
      canvas.ctx.fillStyle = 'rgba(0,240,255,0.07)';
      canvas.ctx.beginPath();
      canvas.ctx.moveTo(cx, cy);
      canvas.ctx.arc(cx, cy, 150, ang - 0.5, ang);
      canvas.ctx.closePath();
      canvas.ctx.fill();
      canvas.ctx.strokeStyle = 'rgba(0,240,255,0.35)';
      canvas.ctx.lineWidth = 1;
      for (let i = 1; i <= 5; i++) {
        canvas.ctx.beginPath();
        canvas.ctx.arc(cx, cy, 26 * i + t * 14, 0, Math.PI * 2);
        canvas.ctx.stroke();
      }
      // sweep beam
      const grd = canvas.ctx.createLinearGradient(cx, cy, cx + Math.cos(ang) * 150, cy + Math.sin(ang) * 150);
      grd.addColorStop(0, 'rgba(0,240,255,0.95)');
      grd.addColorStop(1, 'rgba(0,240,255,0)');
      canvas.ctx.strokeStyle = grd;
      canvas.ctx.lineWidth = 3.5;
      canvas.ctx.shadowColor = '#00f0ff';
      canvas.ctx.shadowBlur = 12;
      canvas.ctx.beginPath();
      canvas.ctx.moveTo(cx, cy);
      canvas.ctx.lineTo(cx + Math.cos(ang) * 150, cy + Math.sin(ang) * 150);
      canvas.ctx.stroke();
      canvas.ctx.shadowBlur = 0;
      // progressive lock
      const showN = Math.floor(t * (targets.length + 0.99));
      for (let i = 0; i < showN && i < targets.length; i++) {
        const tg = targets[i];
        const pulse = 14 + Math.sin(t * 20 + i) * 3;
        const lockT = Math.min(1, (t * targets.length - i));
        canvas.ctx.strokeStyle = '#00f0ff';
        canvas.ctx.lineWidth = 2;
        canvas.ctx.shadowColor = '#00f0ff';
        canvas.ctx.shadowBlur = 12;
        canvas.ctx.beginPath();
        canvas.ctx.arc(tg.x, tg.y, pulse, 0, Math.PI * 2);
        canvas.ctx.stroke();
        canvas.ctx.beginPath();
        canvas.ctx.moveTo(tg.x - 24, tg.y);
        canvas.ctx.lineTo(tg.x + 24, tg.y);
        canvas.ctx.moveTo(tg.x, tg.y - 24);
        canvas.ctx.lineTo(tg.x, tg.y + 24);
        canvas.ctx.stroke();
        canvas.ctx.shadowBlur = 0;
        // corner brackets
        const s = 18;
        canvas.ctx.beginPath();
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([dx, dy]) => {
          const bx = tg.x + dx * s;
          const by = tg.y + dy * s;
          canvas.ctx.moveTo(bx, by + dy * -8);
          canvas.ctx.lineTo(bx, by);
          canvas.ctx.lineTo(bx + dx * -8, by);
        });
        canvas.ctx.stroke();
        if (lockT > 0.2 && Math.random() < 0.15) {
          lockParts = lockParts.concat(
            burstParticles(canvas.ctx, tg.x, tg.y, '#00f0ff', vfxParticleN(2), 'star')
          );
        }
        drawShockwave(canvas.ctx, tg.x, tg.y, Math.min(1, lockT * 0.8), [0, 240, 255], 36);
      }
      lockParts = drawParts(canvas.ctx, lockParts, 1 / 55);
    });
  }

  await hitStop(45);
  screenPunch('sm');

  if (keys.length) {
    await highlightCellsKeep(keys, 'vfx-lock', vfxMs(300, 100));
    clearCellClasses(['vfx-lock']);
  }
  if (Array.isArray(step.changes) && step.changes.length) {
    await morphChangesSequential(step.changes, 'vfx-morph', {
      canvas, rgb: [0, 240, 255], partColor: '#7dffff',
    });
  } else if (keys.length) {
    for (const k of keys) {
      const [c, r] = k.split(',').map(Number);
      setCellSymbol(c, r, 11);
    }
    renderGrid();
    if (canvas) {
      let parts = [];
      for (const k of keys) {
        const [c, r] = k.split(',').map(Number);
        const rc = cellRectInWrap(c, r);
        if (rc) {
          parts = parts.concat(proBurst(canvas.ctx, rc.x, rc.y, {
            core: '#fff', mid: '#00f0ff', smoke: 'rgba(0,40,60,0.3)',
          }, 1.15));
        }
      }
      await runAnimFrame(vfxMs(360, 120), (t) => {
        canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
        for (const k of keys) {
          const [c, r] = k.split(',').map(Number);
          const rc = cellRectInWrap(c, r);
          if (rc) drawShockwave(canvas.ctx, rc.x, rc.y, t, [0, 240, 255], 48);
        }
        parts = drawParts(canvas.ctx, parts, 1 / 55);
      });
    }
    await highlightCells(keys, 'vfx-hit', vfxMs(280, 95));
  }
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

export async function presentVfxBandwidth(step, featId) {
  const mult = Number(step.multiplier) || 1;
  state.globalMultiplier = mult;
  showVfxBanner(`Bandwidth Multiplier — charging ×${mult}`, 'bandwidth');
  featureStepToast(step, featId);
  clearVfxStage();
  sfx('charge', { gain: 0.85, pitch: 0.95 });
  setVfxBloom('orange', true);
  setVfxVignette(true);

  const bar = document.getElementById('vfxBwBar');
  const fill = document.getElementById('vfxBwFill');
  const label = document.getElementById('vfxBwLabel');
  bar?.classList.add('show');
  label?.classList.add('show');
  if (fill) fill.style.width = '0%';

  // Split-flap departure board: × + 2 rolling digit tiles
  let bwD1 = null;
  let bwD2 = null;
  const flipBwDigit = (el) => {
    el.classList.remove('flip');
    void el.offsetWidth;
    el.classList.add('flip');
  };
  const setBwDigits = (n, flip = true) => {
    if (!bwD1 || !bwD2) return;
    const txt = String(n).padStart(2, '0');
    if (bwD1.textContent !== txt[0]) {
      bwD1.textContent = txt[0];
      if (flip) flipBwDigit(bwD1);
    }
    if (bwD2.textContent !== txt[1]) {
      bwD2.textContent = txt[1];
      if (flip) flipBwDigit(bwD2);
    }
  };
  if (label) {
    label.innerHTML = '';
    const bwX = document.createElement('span');
    bwX.className = 'bw-x';
    bwX.textContent = '×';
    bwD1 = document.createElement('span');
    bwD1.className = 'bw-digit';
    bwD1.textContent = '0';
    bwD2 = document.createElement('span');
    bwD2.className = 'bw-digit';
    bwD2.textContent = '1';
    label.append(bwX, bwD1, bwD2);
  }

  // Tick through known mult marks for drama
  const marks = [3, 5, 8, 10].filter(m => m <= mult);
  if (!marks.includes(mult)) marks.push(mult);

  const canvas = prepVfxCanvas();
  let parts = [];
  const dur = vfxMs(980, 340);
  let lastMark = 0;
  await runAnimFrame(dur, (t) => {
    const eased = 1 - Math.pow(1 - t, 3);
    if (fill) fill.style.width = `${Math.round(eased * 100)}%`;
    const cur = Math.max(1, Math.round(1 + (mult - 1) * eased));
    setBwDigits(cur);
    if (cur !== lastMark && marks.includes(cur)) {
      lastMark = cur;
      sfx('tick', { gain: 0.4, pitch: 0.9 + cur * 0.05 });
    }
    if (canvas) {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      // vertical data beams
      for (let i = 0; i < 5; i++) {
        const x = (canvas.w * (i + 0.5)) / 5;
        const g = canvas.ctx.createLinearGradient(x, 0, x, canvas.h);
        g.addColorStop(0, 'rgba(255,140,0,0)');
        g.addColorStop(eased, `rgba(255,180,40,${0.12 + eased * 0.2})`);
        g.addColorStop(1, 'rgba(255,100,0,0)');
        canvas.ctx.fillStyle = g;
        canvas.ctx.fillRect(x - 6, 0, 12, canvas.h);
      }
      // rising energy from bottom
      const hy = canvas.h * (1 - eased);
      const hg = canvas.ctx.createLinearGradient(0, hy, 0, canvas.h);
      hg.addColorStop(0, 'rgba(255,160,0,0)');
      hg.addColorStop(1, `rgba(255,120,0,${0.2 * eased})`);
      canvas.ctx.fillStyle = hg;
      canvas.ctx.fillRect(0, hy, canvas.w, canvas.h - hy);
      // floating ×N
      canvas.ctx.save();
      canvas.ctx.globalAlpha = 0.35 + eased * 0.55;
      canvas.ctx.fillStyle = '#ffcc66';
      canvas.ctx.font = `bold ${28 + eased * 22}px system-ui,sans-serif`;
      canvas.ctx.textAlign = 'center';
      canvas.ctx.shadowColor = '#ff8800';
      canvas.ctx.shadowBlur = 18;
      canvas.ctx.fillText(`×${cur}`, canvas.w / 2, canvas.h * 0.42);
      canvas.ctx.restore();
      if (Math.random() < 0.35) {
        parts = parts.concat(burstParticles(
          canvas.ctx, Math.random() * canvas.w, canvas.h * (0.7 + Math.random() * 0.25),
          '#ffaa44', vfxParticleN(2), 'ember'
        ));
      }
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    }
  });

  setBwDigits(mult);
  const box = document.getElementById('multDisplay');
  if (box) {
    box.textContent = String(mult).padStart(2, '0');
    box.parentElement?.classList.remove('bump');
    void box.parentElement?.offsetWidth;
    box.parentElement?.classList.add('bump');
  }
  await hitStop(60);
  screenPunch(mult >= 8 ? 'full' : 'sm');
  if (canvas) {
    parts = parts.concat(proBurst(canvas.ctx, canvas.w / 2, canvas.h * 0.42, {
      core: '#fff', mid: '#ff8800', smoke: 'rgba(60,30,0,0.3)',
    }, 1.5));
    await runAnimFrame(vfxMs(480, 160), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      drawShockwave(canvas.ctx, canvas.w / 2, canvas.h * 0.42, t, [255, 160, 0], 130);
      canvas.ctx.save();
      canvas.ctx.globalAlpha = 1 - t * 0.5;
      canvas.ctx.fillStyle = '#ffe088';
      canvas.ctx.font = `bold ${42 + t * 18}px system-ui,sans-serif`;
      canvas.ctx.textAlign = 'center';
      canvas.ctx.shadowColor = '#ff8800';
      canvas.ctx.shadowBlur = 22;
      canvas.ctx.fillText(`×${mult}`, canvas.w / 2, canvas.h * 0.42 - t * 20);
      canvas.ctx.restore();
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  }
  await vfxFlash('orange', vfxMs(180, 60));
  await sleepRaw(vfxMs(180, 60));
  bar?.classList.remove('show');
  label?.classList.remove('show');
  if (fill) fill.style.width = '0%';
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

export async function presentVfxBypass(step, featId) {
  state.bypassProtocol = true;
  showVfxBanner('Bypass Protocol — dual data flow', 'bypass');
  featureStepToast(step, featId);
  clearVfxStage();
  const arrows = document.getElementById('vfxBypassArrows');
  arrows?.classList.add('show');
  setVfxBloom('cyan', true);
  setVfxVignette(true);
  const canvas = prepVfxCanvas();
  let parts = [];
  if (canvas) {
    await runAnimFrame(vfxMs(1000, 360), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      const midY = canvas.h / 2;
      // dual highway glow
      const g1 = canvas.ctx.createLinearGradient(0, midY - 40, 0, midY);
      g1.addColorStop(0, 'rgba(0,240,255,0)');
      g1.addColorStop(1, 'rgba(0,240,255,0.12)');
      canvas.ctx.fillStyle = g1;
      canvas.ctx.fillRect(0, midY - 40, canvas.w, 40);
      const g2 = canvas.ctx.createLinearGradient(0, midY, 0, midY + 40);
      g2.addColorStop(0, 'rgba(0,255,180,0.12)');
      g2.addColorStop(1, 'rgba(0,255,180,0)');
      canvas.ctx.fillStyle = g2;
      canvas.ctx.fillRect(0, midY, canvas.w, 40);

      // flowing packets L→R and R→L denser
      for (let i = 0; i < 14; i++) {
        const phase = (t * 2.2 + i * 0.08) % 1;
        const x1 = phase * canvas.w;
        const x2 = (1 - phase) * canvas.w;
        const a = 0.35 + 0.55 * Math.sin(phase * Math.PI);
        canvas.ctx.fillStyle = `rgba(0,240,255,${a})`;
        canvas.ctx.shadowColor = '#00f0ff';
        canvas.ctx.shadowBlur = 10;
        canvas.ctx.beginPath();
        canvas.ctx.arc(x1, midY - 18, 3.5 + (i % 3), 0, Math.PI * 2);
        canvas.ctx.fill();
        canvas.ctx.fillStyle = `rgba(0,255,180,${a})`;
        canvas.ctx.shadowColor = '#00ffb0';
        canvas.ctx.beginPath();
        canvas.ctx.arc(x2, midY + 18, 3.5 + (i % 3), 0, Math.PI * 2);
        canvas.ctx.fill();
        canvas.ctx.shadowBlur = 0;
      }
      // dashed dual lanes
      canvas.ctx.strokeStyle = 'rgba(0,240,255,0.4)';
      canvas.ctx.setLineDash([8, 10]);
      canvas.ctx.lineWidth = 2;
      canvas.ctx.beginPath();
      canvas.ctx.moveTo(10, midY - 18);
      canvas.ctx.lineTo(canvas.w - 10, midY - 18);
      canvas.ctx.stroke();
      canvas.ctx.strokeStyle = 'rgba(0,255,180,0.4)';
      canvas.ctx.beginPath();
      canvas.ctx.moveTo(10, midY + 18);
      canvas.ctx.lineTo(canvas.w - 10, midY + 18);
      canvas.ctx.stroke();
      canvas.ctx.setLineDash([]);

      // endpoint shockwaves when packets "arrive"
      if (t > 0.15) {
        drawShockwave(canvas.ctx, canvas.w - 20, midY - 18, (t * 3) % 1, [0, 240, 255], 40);
        drawShockwave(canvas.ctx, 20, midY + 18, ((t * 3) + 0.5) % 1, [0, 255, 180], 40);
      }
      if (Math.random() < 0.25) {
        parts = parts.concat(burstParticles(
          canvas.ctx, Math.random() * canvas.w, midY + (Math.random() > 0.5 ? -18 : 18),
          Math.random() > 0.5 ? '#00f0ff' : '#00ffb0', vfxParticleN(2), 'star'
        ));
      }
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
    await hitStop(40);
    screenPunch('sm');
    // final dual pulse
    await runAnimFrame(vfxMs(320, 110), (t) => {
      canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
      drawShockwave(canvas.ctx, canvas.w * 0.25, canvas.h / 2, t, [0, 240, 255], 100);
      drawShockwave(canvas.ctx, canvas.w * 0.75, canvas.h / 2, t, [0, 255, 180], 100);
      parts = drawParts(canvas.ctx, parts, 1 / 55);
    });
  } else {
    await sleepRaw(vfxMs(750, 260));
  }
  arrows?.classList.remove('show');
  setVfxBloom(null, false);
  setVfxVignette(false);
  clearVfxStage();
  hideVfxBanner();
}

export async function presentVfxGeneric(step, featId) {
  showVfxBanner(step?.name || featId || 'Feature', featId || '');
  featureStepToast(step, featId);
  await vfxFlash('', vfxMs(150, 50));
  const hitSym = applyStepChanges(step.changes);
  const hitSplit = applyStepSplitChanges(step.splitChanges);
  renderGrid();
  if (hitSym.length) await highlightCells(hitSym, 'vfx-hit', vfxMs(420, 140));
  if (hitSplit.length) await highlightCells(hitSplit, 'vfx-split', vfxMs(380, 130));
  if (!hitSym.length && !hitSplit.length) await sleepRaw(vfxMs(320, 110));
  hideVfxBanner();
}
