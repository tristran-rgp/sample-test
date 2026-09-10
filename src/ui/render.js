// src/ui/render.js — extracted from main.js
import { state } from '../core/state.js';
import { fmt, fmtBalance } from '../core/utils.js';
import { CORE_HACK, FEATURES, FEATURE_EXPLAIN_VI, REELS, ROWS, SYMBOLS } from '../game/config.js';
import { isIdleSym, splitCountOf } from '../game/grid.js';
import { canReplayFeature, findReplayStepIndex, replayLastFeature } from '../game/replay.js';
import { imgTag, setImgSrc } from './assets.js';
import { openModal } from './feedback.js';
import { createSymbolEl } from './sprites.js';

// ─── Render ──────────────────────────────────────────────────
/** Build symbol node(s). Split cells show 2 or 4 icons (GDD Split Symbol, stacked 1 → 2 → 4). */
export function appendSymbolVisual(cell, sym, pieces, fx) {
  const s = SYMBOLS[sym];
  if (!s?.img) {
    cell.textContent = '?';
    return;
  }
  if (pieces > 1) {
    const count = pieces >= 4 ? 4 : 2;
    const pair = document.createElement('div');
    pair.className = `split-pair${count === 4 ? ' quad' : ''}`;
    const sides = count === 4
      ? ['split-a', 'split-b', 'split-c', 'split-d']
      : ['split-a', 'split-b'];
    for (const side of sides) {
      const img = createSymbolEl(sym, { fx, splitSide: side });
      img.alt = `${s.name} ×${count}`;
      pair.appendChild(img);
    }
    cell.appendChild(pair);
    const badge = document.createElement('span');
    badge.className = 'split-badge';
    badge.textContent = `×${count}`;
    cell.appendChild(badge);
  } else {
    cell.appendChild(createSymbolEl(sym, { fx }));
  }
}

export function bindGridClicksOnce() {
  const grid = document.getElementById('reelsGrid');
  if (!grid || grid.dataset.clickBound === '1') return;
  grid.dataset.clickBound = '1';
  grid.addEventListener('click', e => {
    const cell = e.target.closest('.cell');
    if (!cell || !grid.contains(cell)) return;
    const c = Number(cell.dataset.reel);
    const r = Number(cell.dataset.row);
    const sym = state.grid?.[c]?.[r];
    if (sym) showSymTooltip(sym, cell);
  });
}

export function paintCell(cell, c, r, highlightSet) {
  const sym = state.grid[c][r];
  const loading = isIdleSym(sym);
  const meta = state.cellMeta[c][r] || { split: 1, multiplier: 1, mystery: false };
  const splitCount = splitCountOf(meta);
  const split = splitCount > 1 && sym !== 'S';
  const win = highlightSet.has(`${c},${r}`);
  const key = loading
    ? `idle|${c}|${r}`
    : `${sym}|${splitCount}|${meta.multiplier || 1}|${win ? 1 : 0}|${meta.mystery || sym === 'M' ? 1 : 0}`;
  if (cell.dataset.rk === key) return;
  cell.dataset.rk = key;
  cell.dataset.reel = String(c);
  cell.dataset.row = String(r);
  cell.className = 'cell';
  cell.replaceChildren();
  if (loading) {
    cell.classList.add('cell-loading');
    cell.style.setProperty('--reel', String(c));
    cell.style.setProperty('--row', String(r));
    const spin = document.createElement('span');
    spin.className = 'sym-load';
    spin.setAttribute('aria-hidden', 'true');
    cell.appendChild(spin);
    return;
  }
  if (win) cell.classList.add('win');
  if (sym === 'S') cell.classList.add('scatter-win');
  if (meta.mystery || sym === 'M') cell.classList.add('mystery');
  if (split) cell.classList.add('split');
  if (meta.multiplier > 1 && sym !== 'W') {
    const tag = document.createElement('span');
    tag.className = 'mult-tag';
    const x = document.createElement('span');
    x.className = 'mult-x';
    x.textContent = '×';
    tag.appendChild(x);
    for (const ch of String(meta.multiplier).padStart(2, '0')) {
      const digit = document.createElement('span');
      digit.className = 'mult-digit';
      digit.textContent = ch;
      tag.appendChild(digit);
    }
    cell.appendChild(tag);
  }
  appendSymbolVisual(cell, sym, split ? splitCount : 1);
}

export function renderGrid(highlight = []) {
  const grid = document.getElementById('reelsGrid');
  if (!grid || !state.grid?.length) return;
  bindGridClicksOnce();
  const winSet = new Set(highlight);
  const canPatch =
    grid.children.length === REELS &&
    Array.from(grid.children).every(reel => reel.children.length === ROWS);

  if (!canPatch) {
    grid.replaceChildren();
    for (let c = 0; c < REELS; c++) {
      const reel = document.createElement('div');
      reel.className = 'reel';
      reel.id = `reel-${c}`;
      for (let r = 0; r < ROWS; r++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        paintCell(cell, c, r, winSet);
        reel.appendChild(cell);
      }
      grid.appendChild(reel);
    }
    return;
  }

  for (let c = 0; c < REELS; c++) {
    const reel = grid.children[c];
    reel.id = `reel-${c}`;
    for (let r = 0; r < ROWS; r++) {
      paintCell(reel.children[r], c, r, winSet);
    }
  }
}

export function meterItems() {
  return [CORE_HACK, ...FEATURES];
}

export function findMeterFeature(featureId) {
  return meterItems().find(x => x.id === featureId);
}

export function showFeatureDetail(featureId) {
  const f = findMeterFeature(featureId);
  if (!f) return;
  const vi = FEATURE_EXPLAIN_VI[f.id] || {};
  const replayable = findReplayStepIndex(f.id) >= 0;
  const active = f.id === CORE_HACK.id
    ? !!state.lastJackpotActive
    : !!(state.triggeredFeatures || []).find(x => x.id === f.id)
      || !!(state.persistentFeatures || []).find(x => x.id === f.id)
      || replayable;

  const img = document.getElementById('featDetailImg');
  const title = document.getElementById('featDetailTitle');
  const timing = document.getElementById('featDetailTiming');
  const desc = document.getElementById('featDetailDesc');
  const how = document.getElementById('featDetailHow');
  const vfx = document.getElementById('featDetailVfx');
  const status = document.getElementById('featDetailStatus');
  const replayBtn = document.getElementById('btnReplayFeature');
  if (!img || !title) return;
  if (replayBtn) {
    replayBtn.style.display = replayable ? '' : 'none';
    replayBtn.dataset.featureId = f.id;
  }

  const order = meterItems().findIndex(x => x.id === f.id) + 1;
  const whenVi =
    f.timing === 'spin' ? 'Lúc quay' :
    f.timing === 'win' ? 'Giai đoạn tính tiền thắng' :
    'Sau khi hàng dừng';

  setImgSrc(img, f.img || '');
  img.alt = vi.nameVi || f.name;
  title.textContent = vi.nameVi || f.name;
  title.style.color = f.color || 'var(--cyan)';
  timing.textContent = `${whenVi} · thứ tự #${order}` + (f.name ? ` · ${f.name}` : '');

  // Tiếng Việt dễ hiểu
  if (desc) desc.textContent = vi.what || f.desc || '';
  if (how) {
    how.textContent = vi.how || '';
    how.style.display = vi.how ? 'block' : 'none';
  }
  if (vfx) vfx.textContent = vi.see || f.vfx || '';

  if (status) {
    if (replayable) {
      status.style.display = 'block';
      status.textContent = '● Có trên spin vừa rồi — bấm Replay để diễn lại VFX';
      status.style.color = f.color || 'var(--green)';
      status.style.background = 'rgba(0,255,136,.08)';
      status.style.border = '1px solid ' + (f.color || 'var(--green)');
    } else if (active) {
      status.style.display = 'block';
      status.textContent = '● ĐANG BẬT trên spin này / Free Spins';
      status.style.color = f.color || 'var(--green)';
      status.style.background = 'rgba(0,255,136,.08)';
      status.style.border = '1px solid ' + (f.color || 'var(--green)');
    } else {
      status.style.display = 'none';
      status.textContent = '';
    }
  }
  openModal('modalFeatureDetail');
}

export function renderFeatureMeter(activeIds = []) {
  const meter = document.getElementById('featureMeter');
  if (!meter) return;
  const ids = Array.isArray(activeIds) ? activeIds.filter(Boolean) : [];
  meter.innerHTML = '';
  // has-active → CSS dim các badge không trúng, phóng to badge trúng
  meter.classList.toggle('has-active', ids.length > 0);
  meterItems().forEach((f, idx) => {
    const badge = document.createElement('span');
    badge.style.setProperty('--i', String(idx));
    const on = ids.includes(f.id);
    badge.className = 'feat-badge'
      + (f.id === CORE_HACK.id ? ' core-hack' : '')
      + (on ? ' active' : '');
    const viName = (FEATURE_EXPLAIN_VI[f.id] && FEATURE_EXPLAIN_VI[f.id].nameVi) || f.name;
    const replayable = canReplayFeature(f.id);
    if (replayable) badge.classList.add('replayable');
    badge.title = replayable
      ? viName + ' — bấm để replay feature này (Shift+bấm xem giải thích)'
      : viName + ' — bấm để xem giải thích' + (on ? ' (đang bật)' : '');
    badge.style.color = f.color;
    badge.dataset.featureId = f.id;
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.setAttribute('aria-label', replayable ? ('Replay ' + viName) : ('Chi tiết ' + viName));
    if (on) badge.setAttribute('aria-current', 'true');
    if (f.img) {
      const img = document.createElement('img');
      setImgSrc(img, f.img);
      img.alt = viName;
      img.draggable = false;
      badge.appendChild(img);
    }
    const open = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (canReplayFeature(f.id) && !e.shiftKey && !e.altKey) {
        replayLastFeature(f.id);
        return;
      }
      showFeatureDetail(f.id);
    };
    badge.addEventListener('click', open);
    badge.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') open(e);
    });
    meter.appendChild(badge);
  });
}

export function syncPerfMode() {
  const busy = !!(state.spinning || state.fxPlaying);
  document.body.classList.toggle('spin-busy', busy);
}

export function updateUI() {
  const beforeEl = document.getElementById('balanceBeforeDisplay');
  if (beforeEl) beforeEl.textContent = fmtBalance(state.balanceBefore);
  document.getElementById('balanceDisplay').textContent = fmtBalance(state.balance);
  document.getElementById('betAmount').textContent = fmt(state.bet);
  document.getElementById('headerWin').textContent = fmt(state.lastWin);
  const mult = Math.max(1, state.globalMultiplier || 1);
  document.getElementById('multDisplay').textContent = String(mult).padStart(2, '0');
  syncPerfMode();
}

/** Chụp số dư sau trừ bet/phí, trước khi credit win (spin đang chờ kết quả). */
export function captureBalanceBefore() {
  state.balanceBefore = Number(state.balance) || 0;
}

export function setInfoBar(mode, text) {
  const bar = document.getElementById('infoBar');
  if (!bar) return;
  // Win amount lives on the grid HUD (#headerWin) — never put money here.
  if (mode === 'win') return;
  bar.className = 'info-bar';
  bar.innerHTML = `<div class="marquee" id="infoMarquee">${text}</div>`;
}

export function showSymTooltip(sym, el) {
  if (state.spinning) return;
  const s = SYMBOLS[sym];
  if (!s) return;
  const tip = document.getElementById('symTooltip');
  // GDD paytable = multipliers of totalBet (not cash). Show raw Cx like 0.75 / 1.00 / 1.50.
  const pays = s.pays.slice(2).map((p, i) => `${i + 3}: ${Number(p).toFixed(2)}x`).join(' | ');
  tip.innerHTML = `<div style="display:flex;align-items:center;gap:8px">${imgTag(s.img, 'style="width:40px;height:40px;object-fit:contain" alt=""')}<strong>${s.name}</strong></div><br>${pays || 'Special symbol'}`;
  const rect = el.getBoundingClientRect();
  tip.style.left = Math.min(rect.right + 8, window.innerWidth - 200) + 'px';
  tip.style.top = rect.top + 'px';
  tip.style.display = 'block';
  setTimeout(() => tip.style.display = 'none', 3000);
}
