// src/ui/buyFeatures.js — extracted from main.js
import { state } from '../core/state.js';
import { fmt } from '../core/utils.js';
import { SYMBOLS } from '../game/config.js';
import { symImgHtml } from './assets.js';

// ─── Buy Features ────────────────────────────────────────────
export let selectedBuyFeature = null;
export let selectedBuyFS = null;

export function initBuyModals() {
  const featOpts = [
    { id: 'scatter', name: 'Scatter Booster', cost: 1.4, desc: 'Scatter rate ×1.6 on reel 2' },
    { id: 'buy3', name: 'Buy 3 Features', cost: 12, desc: 'Guarantee 3 random features per spin' },
    { id: 'buy12', name: 'Buy 12 Features', cost: 4500, desc: 'All 12 features every spin' },
  ];
  document.getElementById('buyFeatureOptions').innerHTML = featOpts.map(o => `
    <div class="option-row" data-id="${o.id}">
      <div><div class="option-name">${o.name}</div><div class="option-desc">${o.desc}</div></div>
      <div class="option-cost">${o.cost}× Bet</div>
    </div>`).join('');

  document.querySelectorAll('#buyFeatureOptions .option-row').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#buyFeatureOptions .option-row').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      selectedBuyFeature = el.dataset.id;
    });
  });

  // GDD §6 + be-zero-day BUY_FEATURE (cmd 1501) feature aliases
  const fsOpts = [
    { id: 'fs1', feature: 'FS1', name: 'Terminal Breach (FS1)', cost: 80, scatters: 3, desc: 'Feature spin → ≥3 Scatters → 7 FS + 1 sticky feature' },
    { id: 'fs2', feature: 'FS2', name: 'Server Hijack (FS2)', cost: 240, scatters: 4, desc: 'Feature spin → ≥4 Scatters → 7 FS + 2 sticky features' },
    { id: 'fs3', feature: 'FS3', name: 'Mainframe Meltdown (FS3)', cost: 500, scatters: 5, desc: 'Feature spin → ≥5 Scatters → 7 FS + 3 sticky features' },
    { id: 'fs4', feature: 'FS4', name: 'Lucky Draw (FS4)', cost: 212, scatters: 0, desc: 'Random FS1 / FS2 / FS3 outcome' },
  ];
  document.getElementById('buyFSOptions').innerHTML = fsOpts.map(o => `
    <div class="option-row" data-id="${o.id}" data-feature="${o.feature}" data-scatters="${o.scatters}" data-cost="${o.cost}">
      <div>
        <div class="option-name">${o.name}</div>
        <div class="option-desc">${o.desc}</div>
        <div class="option-desc" style="margin-top:2px;color:var(--cyan)">Cost: ${fmt(o.cost * state.bet)} (${o.cost}× bet)</div>
      </div>
      <div class="option-cost">${o.cost}×</div>
    </div>`).join('');

  document.querySelectorAll('#buyFSOptions .option-row').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#buyFSOptions .option-row').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      selectedBuyFS = el.dataset.id;
    });
  });
}

export function fmtCx(n) {
  return Number(n || 0).toFixed(2);
}

/** id + name từ be-zero-day .../games/zero_day.json `symbols`. */
export const PAYTABLE_ROWS = [
  { id: 1,  name: 'A',       key: 'A' },
  { id: 2,  name: 'B',       key: 'B' },
  { id: 3,  name: 'C',       key: 'C' },
  { id: 4,  name: 'D',       key: 'D' },
  { id: 5,  name: 'E',       key: 'E' },
  { id: 6,  name: 'F',       key: 'F' },
  { id: 7,  name: 'G',       key: 'G' },
  { id: 8,  name: 'H',       key: 'H' },
  { id: 9,  name: 'I',       key: 'I' },
  { id: 10, name: 'K',       key: 'K' },
  { id: 11, name: 'WILD',    key: 'W' },
  { id: 12, name: 'SCATTER', key: 'S' },
];

export const PAYTABLE_SPECIAL = {
  W: 'Wild · substitutes',
  S: 'Scatter · 3+ FS',
};

export function renderPaytable() {
  const ptGrid = document.getElementById('paytableGrid');
  if (ptGrid) {
    ptGrid.innerHTML = PAYTABLE_ROWS.map(row => {
      const sym = SYMBOLS[row.key];
      const note = PAYTABLE_SPECIAL[row.key];
      const pays = note || (sym?.pays || []).slice(2).map((p, i) => `${i + 3}×: ${fmtCx(p)}`).join(' | ');
      return `<div class="pay-sym">${symImgHtml(row.key)}<div class="name">#${row.id} ${row.name}</div><div class="pays">${pays}</div></div>`;
    }).join('');
  }

  const side = document.getElementById('sidePaytableBody');
  if (!side) return;
  side.innerHTML = PAYTABLE_ROWS.map(row => {
    const sym = SYMBOLS[row.key];
    const note = PAYTABLE_SPECIAL[row.key];
    const idCell = `<span class="side-pt-id"><span class="sid">${row.id}</span><span class="sname">${row.name}</span></span>`;
    if (note) {
      return `<div class="side-pt-row special" data-sym="${row.key}" data-id="${row.id}">
        <span class="side-pt-icon">${symImgHtml(row.key)}</span>
        ${idCell}
        <span class="side-pt-note">${note}</span>
      </div>`;
    }
    const [p3, p4, p5] = (sym?.pays || []).slice(2);
    return `<div class="side-pt-row" data-sym="${row.key}" data-id="${row.id}" data-type="${sym?.type || ''}">
      <span class="side-pt-icon">${symImgHtml(row.key)}</span>
      ${idCell}
      <span>${fmtCx(p3)}</span><span>${fmtCx(p4)}</span><span>${fmtCx(p5)}</span>
    </div>`;
  }).join('');
}

// ── cross-module setters (mutable shared state) ──
export function setSelectedBuyFeature(v) { selectedBuyFeature = v; }
export function setSelectedBuyFS(v) { selectedBuyFS = v; }
