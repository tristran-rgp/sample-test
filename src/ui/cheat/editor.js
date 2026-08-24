// src/ui/cheat/editor.js — extracted from main.js
import { state } from '../../core/state.js';
import { SYM_MAP } from '../../game/config.js';
import { CHEAT_FEATURE_NAMES, CHEAT_IMMEDIATE, CHEAT_PRESETS, CHEAT_SYM_OPTS, setCheatLog } from './panel.js';

export function buildCheatGridEditor() {
  const body = document.getElementById('cheatGridBody');
  if (!body || body.dataset.built === '1') return;
  const opts = CHEAT_SYM_OPTS.map(o => `<option value="${o.id}">${o.label}</option>`).join('');
  let html = '';
  for (let r = 0; r < 3; r++) {
    html += `<tr><th style="font-size:.6rem;color:var(--dim)">row${r}</th>`;
    for (let c = 0; c < 5; c++) {
      html += `<td><select data-r="${r}" data-c="${c}" class="cheat-cell">${opts}</select></td>`;
    }
    html += '</tr>';
  }
  body.innerHTML = html;
  body.dataset.built = '1';
  body.querySelectorAll('select.cheat-cell').forEach(sel => {
    sel.addEventListener('change', () => writeCheatGridToJson());
  });
}

export function setCheatGridEditorVisible(on) {
  document.getElementById('cheatGridEditor')?.classList.toggle('visible', !!on);
}

export function syncCheatJsonBox(code) {
  const box = document.getElementById('cheatJsonBox');
  if (!box) return;
  box.open = !(code === 'FORCE_GRID' || isDedicatedFeatureCheat(code));
}

export const CHEAT_FEATURE_TUNES = {
  FORCE_FIREWALL_BLOCK: {
    title: 'FirewallBlock',
    help: 'Cấm 1–2 low (6–10) khỏi strip + scrub grid. Bỏ trống = RNG 1–2 loại.',
    fields: ['bannedLows'],
  },
  FORCE_DATA_DECRYPT: {
    title: 'DataDecrypt',
    help: 'Chọn 1–2 loại Low đang có trên lưới (F/G/H/I/K). Mọi ô cùng loại → cùng một High (toSymbol 1–5). positions chỉ pin ô (debug); để trống = theo loại.',
    fields: ['count12', 'toHigh', 'positions'],
  },
  FORCE_TROJAN_HORSE: {
    title: 'TrojanHorse',
    help: 'Bấm 3–6 ô Mystery ([col,row]). revealTo = symbol sau khi mở (1–10). Không chọn ô thì dùng count.',
    fields: ['count36', 'revealTo', 'positions'],
  },
  FORCE_DATA_OVERLOAD: {
    title: 'DataOverload',
    help: 'Reel được chọn nở full Wild (kể cả reel chưa có Wild).',
    fields: ['reels'],
  },
  FORCE_SYSTEM_OVERCLOCK: {
    title: 'SystemOverclock',
    help: 'targetSymbol phải đang có trên grid. multiplier ∈ 3 / 5 / 8 / 10.',
    fields: ['targetPay', 'mult'],
  },
  FORCE_DATA_CLONING: {
    title: 'DataCloning',
    help: 'Split ×2 mọi ô của targetSymbol (phải có trên grid).',
    fields: ['targetPay'],
  },
  FORCE_ROOT_ACCESS: {
    title: 'RootAccess',
    help: 'Split ×2 cả reel (trừ Scatter). Chọn reel hoặc reelCount 1–3.',
    fields: ['reels', 'reelCount'],
  },
  FORCE_POWER_SURGE: {
    title: 'PowerSurge',
    help: '1–2 ô pay (ids 1–10, không Wild/Scatter) [col,row] → Wild. Epicenter không tự tách; 8 ô kề (cả chéo) bị Split ×2, trừ Scatter. Chọn tối đa 2 ô.',
    fields: ['positions'],
  },
  FORCE_SYSTEM_GLITCH: {
    title: 'SystemGlitch',
    help: 'Shuffle ô không thắng / không scatter. Tắt protectWinning để xáo cả ô thắng.',
    fields: ['protectWinning'],
  },
  FORCE_ALGORITHMIC_SCAN: {
    title: 'AlgorithmicScan',
    help: '1–3 ô pay (ids 1–10, không Wild/Scatter) [col,row] → Wild. Chọn tối đa 3 ô.',
    fields: ['positions'],
  },
  FORCE_BANDWIDTH_MULTIPLIER: {
    title: 'BandwidthMultiplier',
    help: 'Hệ số nhân win sau payout: 3 / 5 / 8 / 10.',
    fields: ['mult'],
  },
  FORCE_BYPASS_PROTOCOL: {
    title: 'BypassProtocol',
    help: 'Bật đánh ways phải → trái. Không có tham số thêm.',
    fields: [],
  },
};

export const CHEAT_PAY_OPTS = [
  { id: 1, label: '1 A' }, { id: 2, label: '2 B' }, { id: 3, label: '3 C' },
  { id: 4, label: '4 D' }, { id: 5, label: '5 E' }, { id: 6, label: '6 F' },
  { id: 7, label: '7 G' }, { id: 8, label: '8 H' }, { id: 9, label: '9 I' },
  { id: 10, label: '10 K' },
];

export function isDedicatedFeatureCheat(code) {
  return !!CHEAT_FEATURE_TUNES[code];
}

export function setCheatTuneVisible(on) {
  document.getElementById('cheatFeatureTune')?.classList.toggle('visible', !!on);
}

export function renderCheatTune(code, value) {
  const spec = CHEAT_FEATURE_TUNES[code];
  const root = document.getElementById('cheatTuneFields');
  const title = document.getElementById('cheatTuneTitle');
  const help = document.getElementById('cheatTuneHelp');
  if (!spec || !root) return;
  title.textContent = spec.title;
  help.textContent = spec.help;
  const v = value && typeof value === 'object' ? value : {};
  const posSet = new Set(
    (Array.isArray(v.positions) ? v.positions : [])
      .filter(p => Array.isArray(p) && p.length >= 2)
      .map(p => `${p[0]},${p[1]}`)
  );
  const selected = (arr) => new Set((arr || []).map(Number));
  let html = '';
  for (const field of spec.fields) {
    if (field === 'bannedLows') {
      const on = selected(v.bannedLows);
      html += `<div class="cheat-tune-row"><label>bannedLows</label><div class="cheat-chip-list" data-tune="bannedLows">`;
      for (const o of CHEAT_PAY_OPTS.filter(x => x.id >= 6)) {
        html += `<button type="button" class="cheat-chip${on.has(o.id) ? ' is-on' : ''}" data-id="${o.id}">${o.label}</button>`;
      }
      html += `</div></div>`;
    } else if (field === 'count12' || field === 'count36' || field === 'reelCount') {
      const min = field === 'count36' ? 3 : 1;
      const max = field === 'count36' ? 6 : field === 'reelCount' ? 3 : 2;
      const key = field === 'reelCount' ? 'reelCount' : 'count';
      const val = v[key] != null ? v[key] : (field === 'count36' ? 4 : min);
      const countLabel = code === 'FORCE_DATA_DECRYPT' ? 'count (types)' : key;
      html += `<div class="cheat-tune-row"><label>${countLabel}</label><input type="number" min="${min}" max="${max}" value="${val}" data-tune="${key}"></div>`;
    } else if (field === 'toHigh' || field === 'revealTo' || field === 'targetPay') {
      const key = field === 'targetPay' ? 'targetSymbol' : field === 'toHigh' ? 'toSymbol' : 'revealTo';
      const min = field === 'toHigh' ? 1 : 1;
      const max = field === 'toHigh' ? 5 : 10;
      const val = v[key] != null ? v[key] : (field === 'revealTo' ? 8 : 1);
      const opts = CHEAT_PAY_OPTS.filter(o => o.id >= min && o.id <= max);
      html += `<div class="cheat-tune-row"><label>${key}</label><select data-tune="${key}">`;
      html += opts.map(o => `<option value="${o.id}"${Number(val) === o.id ? ' selected' : ''}>${o.label}</option>`).join('');
      html += `</select></div>`;
    } else if (field === 'mult') {
      const val = v.multiplier != null ? v.multiplier : 10;
      html += `<div class="cheat-tune-row"><label>multiplier</label><select data-tune="multiplier">`;
      html += [3, 5, 8, 10].map(m => `<option value="${m}"${Number(val) === m ? ' selected' : ''}>×${m}</option>`).join('');
      html += `</select></div>`;
    } else if (field === 'reels') {
      const on = selected(v.reels || v.columns);
      html += `<div class="cheat-tune-row"><label>reels</label><div class="cheat-chip-list" data-tune="reels">`;
      for (let i = 0; i < 5; i++) {
        html += `<button type="button" class="cheat-chip${on.has(i) ? ' is-on' : ''}" data-id="${i}">R${i + 1}</button>`;
      }
      html += `</div></div>`;
    } else if (field === 'types2' || field === 'types3') {
      const max = field === 'types2' ? 2 : 3;
      const on = selected(v.convertedTypes);
      html += `<div class="cheat-tune-row"><label>types (max ${max})</label><div class="cheat-chip-list" data-tune="convertedTypes" data-max="${max}">`;
      for (const o of CHEAT_PAY_OPTS) {
        html += `<button type="button" class="cheat-chip${on.has(o.id) ? ' is-on' : ''}" data-id="${o.id}">${o.label}</button>`;
      }
      html += `</div></div>`;
    } else if (field === 'protectWinning') {
      const on = v.protectWinning !== false;
      html += `<div class="cheat-tune-row"><label>protectWinning</label><button type="button" class="cheat-chip${on ? ' is-on' : ''}" data-tune="protectWinning">${on ? 'true' : 'false'}</button></div>`;
    } else if (field === 'positions') {
      const posMax =
        code === 'FORCE_POWER_SURGE' ? 2
        : code === 'FORCE_ALGORITHMIC_SCAN' ? 3
        : 6;
      html += `<div class="cheat-tune-row"><label>positions</label><div class="cheat-pos-wrap">`;
      html += `<div class="cheat-pos-head"><span></span><span>R1</span><span>R2</span><span>R3</span><span>R4</span><span>R5</span></div>`;
      html += `<div class="cheat-pos-grid" data-tune="positions" data-max="${posMax}">`;
      for (let r = 0; r < 3; r++) {
        html += `<span class="cheat-pos-rowlab">r${r}</span>`;
        for (let c = 0; c < 5; c++) {
          const key = `${c},${r}`;
          html += `<button type="button" class="cheat-pos-cell${posSet.has(key) ? ' is-on' : ''}" data-c="${c}" data-r="${r}" title="[${c},${r}]"></button>`;
        }
      }
      html += `</div></div></div>`;
    }
  }
  root.innerHTML = html || '<p style="font-size:.7rem;color:var(--dim);margin:0">Không có field — chỉ force feature.</p>';
  root.querySelectorAll('.cheat-chip-list .cheat-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const list = btn.parentElement;
      const max = Number(list.dataset.max || 0);
      if (list.dataset.tune === 'bannedLows') {
        btn.classList.toggle('is-on');
        const ons = [...list.querySelectorAll('.cheat-chip.is-on')];
        if (ons.length > 2) ons[0].classList.remove('is-on');
      } else if (max > 0) {
        if (btn.classList.contains('is-on')) btn.classList.remove('is-on');
        else {
          const ons = [...list.querySelectorAll('.cheat-chip.is-on')];
          if (ons.length >= max) ons[0].classList.remove('is-on');
          btn.classList.add('is-on');
        }
      } else {
        btn.classList.toggle('is-on');
      }
      writeCheatTuneToJson();
    });
  });
  root.querySelectorAll('.cheat-pos-cell').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('is-on');
      const posRoot = root.querySelector('[data-tune="positions"]');
      const posMax = Number(posRoot?.dataset.max || 6);
      const ons = root.querySelectorAll('.cheat-pos-cell.is-on');
      if (ons.length > posMax) ons[0].classList.remove('is-on');
      writeCheatTuneToJson();
    });
  });
  root.querySelectorAll('select[data-tune], input[data-tune]').forEach(el => {
    el.addEventListener('change', () => writeCheatTuneToJson());
    el.addEventListener('input', () => writeCheatTuneToJson());
  });
  const prot = root.querySelector('[data-tune="protectWinning"]');
  if (prot) {
    prot.addEventListener('click', () => {
      const next = prot.textContent !== 'true';
      prot.textContent = next ? 'true' : 'false';
      prot.classList.toggle('is-on', next);
      writeCheatTuneToJson();
    });
  }
}

export function writeCheatTuneToJson() {
  const code = document.getElementById('cheatCode')?.value;
  if (!isDedicatedFeatureCheat(code)) return;
  let value = {};
  try { value = parseCheatValue(); } catch (_) { value = {}; }
  const root = document.getElementById('cheatTuneFields');
  if (!root) return;
  root.querySelectorAll('select[data-tune], input[data-tune]').forEach(el => {
    const key = el.dataset.tune;
    const n = Number(el.value);
    value[key] = Number.isFinite(n) ? n : el.value;
  });
  root.querySelectorAll('.cheat-chip-list').forEach(list => {
    const key = list.dataset.tune;
    const ids = [...list.querySelectorAll('.cheat-chip.is-on')].map(b => Number(b.dataset.id));
    if (ids.length) value[key] = ids;
    else delete value[key];
  });
  const prot = root.querySelector('[data-tune="protectWinning"]');
  if (prot) value.protectWinning = prot.textContent === 'true';
  const posRoot = root.querySelector('[data-tune="positions"]');
  if (posRoot) {
    const pos = [...posRoot.querySelectorAll('.cheat-pos-cell.is-on')].map(b => [Number(b.dataset.c), Number(b.dataset.r)]);
    if (pos.length) value.positions = pos;
    else delete value.positions;
  }
  document.getElementById('cheatValue').value = JSON.stringify(value, null, 2);
}

export function setCheatPresetActive(code) {
  document.querySelectorAll('#cheatPresets button[data-preset]').forEach(btn => {
    const p = CHEAT_PRESETS[Number(btn.dataset.preset)];
    btn.classList.toggle('is-active', p?.code === code);
  });
}

export function buildCheatFeaturePicker() {
  const root = document.getElementById('cheatFeatureList');
  if (!root || root.dataset.built === '1') return;
  root.innerHTML = CHEAT_FEATURE_NAMES.map(
    name =>
      `<label class="cheat-feature-item" data-feature="${name}">` +
      `<input type="checkbox" value="${name}" /><span>${name}</span></label>`
  ).join('');
  root.dataset.built = '1';
  root.addEventListener('change', e => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;
    input.closest('.cheat-feature-item')?.classList.toggle('is-on', input.checked);
    writeCheatGridToJson();
  });
}

export function readCheatFeaturesFromEditor() {
  return [...document.querySelectorAll('#cheatFeatureList input[type="checkbox"]:checked')]
    .map(el => el.value)
    .filter(name => CHEAT_FEATURE_NAMES.includes(name));
}

export function applyFeaturesToEditor(features) {
  const selected = new Set(Array.isArray(features) ? features : []);
  document.querySelectorAll('#cheatFeatureList .cheat-feature-item').forEach(label => {
    const on = selected.has(label.dataset.feature);
    const input = label.querySelector('input');
    if (input) input.checked = on;
    label.classList.toggle('is-on', on);
  });
}

export function onCheatCodeChanged({ fromPreset = false } = {}) {
  const code = document.getElementById('cheatCode')?.value || '';
  const preset = CHEAT_PRESETS.find(p => p.code === code);
  setCheatPresetActive(code);
  if (code === 'FORCE_GRID') {
    setCheatTuneVisible(false);
    setCheatGridEditorVisible(true);
    try {
      const v = JSON.parse(document.getElementById('cheatValue')?.value || '{}');
      if (Array.isArray(v.grid) && v.grid.length === 3) {
        applyGridToEditor(v.grid);
        applyFeaturesToEditor(v.features);
      } else if (preset?.value?.grid) {
        document.getElementById('cheatValue').value = JSON.stringify(preset.value, null, 2);
        applyGridToEditor(preset.value.grid);
        applyFeaturesToEditor(preset.value.features);
      } else {
        fillCheatGrid(8);
        applyFeaturesToEditor([]);
      }
    } catch (_) {
      fillCheatGrid(8);
      applyFeaturesToEditor([]);
    }
  } else if (isDedicatedFeatureCheat(code)) {
    setCheatGridEditorVisible(false);
    setCheatTuneVisible(true);
    let v = {};
    if (fromPreset && preset?.value != null) {
      v = preset.value;
      document.getElementById('cheatValue').value = JSON.stringify(v, null, 2);
    } else {
      try { v = JSON.parse(document.getElementById('cheatValue')?.value || '{}'); } catch (_) { v = {}; }
      if (!v || typeof v !== 'object' || Array.isArray(v) || !Object.keys(v).length) {
        v = preset?.value && typeof preset.value === 'object' ? preset.value : {};
        document.getElementById('cheatValue').value = JSON.stringify(v, null, 2);
      }
    }
    renderCheatTune(code, v);
  } else {
    setCheatGridEditorVisible(false);
    setCheatTuneVisible(false);
    if (fromPreset && preset?.value != null) {
      document.getElementById('cheatValue').value = JSON.stringify(preset.value, null, 2);
    }
  }
  const spinBtn = document.getElementById('cheatSendSpin');
  if (spinBtn) {
    spinBtn.title = CHEAT_IMMEDIATE.has(code)
      ? 'Immediate cheat — will send only (no auto-spin)'
      : 'Send next-spin cheat then trigger SPIN';
  }
  syncCheatJsonBox(code);
}

export function readCheatGridFromEditor() {
  const grid = [[], [], []];
  document.querySelectorAll('#cheatGridBody select.cheat-cell').forEach(sel => {
    const r = Number(sel.dataset.r);
    const c = Number(sel.dataset.c);
    grid[r][c] = Number(sel.value) || 1;
  });
  return grid;
}

export function applyGridToEditor(grid) {
  if (!Array.isArray(grid) || grid.length !== 3) return;
  document.querySelectorAll('#cheatGridBody select.cheat-cell').forEach(sel => {
    const r = Number(sel.dataset.r);
    const c = Number(sel.dataset.c);
    const v = grid[r]?.[c];
    if (v != null) sel.value = String(v);
  });
}

export function writeCheatGridToJson() {
  let value = {};
  try {
    value = parseCheatValue();
  } catch (_) {
    value = {};
  }
  value.grid = readCheatGridFromEditor();
  const features = readCheatFeaturesFromEditor();
  if (features.length) value.features = features;
  else delete value.features;
  document.getElementById('cheatValue').value = JSON.stringify(value, null, 2);
}

export function fillCheatGrid(symId) {
  document.querySelectorAll('#cheatGridBody select.cheat-cell').forEach(sel => {
    sel.value = String(symId);
  });
  writeCheatGridToJson();
}

/** Client state.grid is col-major keys A/B… → server row-major ids */
export function loadCheatGridFromScreen() {
  if (!state.grid || state.grid.length !== 5) {
    setCheatLog('No screen on reels yet', 'err');
    return;
  }
  const inv = {};
  Object.entries(SYM_MAP).forEach(([id, key]) => {
    inv[key] = Number(id);
  });
  const grid = [[], [], []];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      const key = state.grid[c][r];
      grid[r][c] = inv[key] || 1;
    }
  }
  applyGridToEditor(grid);
  writeCheatGridToJson();
  setCheatLog('Loaded grid from current screen', 'ok');
}

export function loadCheatGridScatter3() {
  // Low fillers + scatter on reels 2,3,4 (cols 1,2,3) row 1
  const grid = [
    [6, 7, 8, 9, 10],
    [6, 12, 12, 12, 10],
    [7, 8, 9, 6, 7],
  ];
  applyGridToEditor(grid);
  writeCheatGridToJson();
  setCheatLog('3 scatters mid reels', 'ok');
}

export function parseCheatValue() {
  const raw = (document.getElementById('cheatValue')?.value || '{}').trim() || '{}';
  try {
    const v = JSON.parse(raw);
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      throw new Error('value must be a JSON object');
    }
    return v;
  } catch (e) {
    throw new Error('Invalid value JSON: ' + e.message);
  }
}

/**
 * Send cheat via WebSocket cmd 1999. When another session is targeted
 * (cmd 1998 list), attach its session_id — backend CheatHandler resolves
 * the target agency/user from the session store.
 */
