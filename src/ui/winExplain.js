// src/ui/winExplain.js — extracted from main.js
import { state } from '../core/state.js';
import { fmt, fmtBalance, getSymbolPayMult, sleepRaw } from '../core/utils.js';
import { REELS, REF_BET, ROWS, SYMBOLS, SYM_MAP } from '../game/config.js';
import { parseOnlineRound } from '../net/session.js';
import { sfx } from '../sfx/sfx.js';
import { imgTag } from './assets.js';
import { closeModal, openModal, showToast } from './feedback.js';
import { renderGrid, setInfoBar } from './render.js';
import { boostSpritePack, useSpritePackAnim } from './sprites.js';
import { cellRectInWrap, hideVfxBanner, prepVfxCanvas, runAnimFrame, showVfxBanner } from './vfx/core.js';
import { cellsForWin, runMoneyTicker } from './winfx.js';
import { wsTrafficState } from './wsTrafficDock.js';

// ─── Win explain (breakdown spin vừa rồi) ─────────────────────
export let _wxZoom = 1;

export function countsPerReelFromPositions(positions, length, direction) {
  const counts = Array(REELS).fill(0);
  if (!Array.isArray(positions)) return counts;
  for (const p of positions) {
    const c = Array.isArray(p) ? Number(p[0]) : Number(p.c);
    if (c >= 0 && c < REELS) counts[c] += 1;
  }
  // Chuỗi LTR: reel 0..length-1; RTL: (REELS-1) xuống
  const chain = [];
  for (let i = 0; i < length; i++) {
    const c = direction === 'rtl' ? (REELS - 1 - i) : i;
    chain.push(Math.max(1, counts[c] || 0));
  }
  return chain;
}

export function waysProduct(chainCounts) {
  return (chainCounts || []).reduce((a, b) => a * Math.max(0, b), 1) || 0;
}

/**
 * Lưu frame IN SPIN/BUY gần nhất (cmd 1500 / 1501).
 * @param {any} frame full WS message (thường [5, { cmd, c, data }])
 * @param {object} [payload] game payload nếu đã bóc
 */
export function captureLastInSpin(frame, payload) {
  let pl = payload;
  let cmd = '';
  if (!pl && Array.isArray(frame) && (frame[0] === 5 || frame[0] === '5') && frame[1] && typeof frame[1] === 'object') {
    pl = frame[1];
  }
  if (!pl && frame && typeof frame === 'object' && !Array.isArray(frame) && frame.data) {
    pl = frame;
  }
  if (!pl || typeof pl !== 'object') return false;
  cmd = String(pl.cmd ?? '');
  if (cmd !== '1500' && cmd !== '1501') return false;
  // Deep clone để panel không bị mutate sau này
  let frameCopy = null;
  let payloadCopy = null;
  try {
    frameCopy = JSON.parse(JSON.stringify(frame));
    payloadCopy = JSON.parse(JSON.stringify(pl));
  } catch (_) {
    payloadCopy = pl;
    frameCopy = frame;
  }
  state.lastInSpin = {
    t: Date.now(),
    cmd,
    frame: frameCopy,
    payload: payloadCopy,
    // BEFORE đã trừ bet (snapshot lúc bấm spin) — không có trong IN, gắn kèm FE
    balanceBefore: Number(state.balanceBefore) || 0,
  };
  // Build explain ngay từ IN
  buildWinExplainFromLastInSpin();
  return true;
}

/**
 * Tìm IN SPIN mới nhất trong WS traffic log (cmd 1500/1501).
 */
export function findLatestInSpinFromTraffic() {
  const items = typeof wsTrafficState !== 'undefined' ? wsTrafficState.items : null;
  if (!Array.isArray(items) || !items.length) return null;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.dir !== 'in') continue;
    if (it.cmd !== '1500' && it.cmd !== '1501') continue;
    if (it.data != null) return it.data;
    // Fallback: parse text JSON
    if (typeof it.text === 'string') {
      try { return JSON.parse(it.text); } catch (_) { /* ignore */ }
    }
  }
  return null;
}

/**
 * Parse payload IN → breakdown win. Nguồn duy nhất cho online = stages[0].wins + totalWin.
 */
export function buildWinExplainFromInPayload(payload, meta = {}) {
  if (!payload || typeof payload !== 'object') return null;
  const parsed = parseOnlineRound(payload);
  const round = parsed.round || payload?.data?.round || {};
  const stage = parsed.stage || {};
  const bet = parseFloat(round.totalBet ?? payload?.data?.round?.totalBet ?? state.bet) || 0;
  const totalWin = Number(parsed.totalWin) || 0;
  const balAfter = parseFloat(
    parsed.control?.balance ??
      payload?.data?.control?.balance ??
      state.balance
  );
  const rawWins = Array.isArray(stage.wins) ? stage.wins : [];
  // Ưu tiên raw server wins (symbol id, occurs, positions, win string)
  const winsIn = rawWins.length
    ? rawWins.map(w => ({
        sym: SYM_MAP[w.symbol] || String(w.symbol),
        symbolId: w.symbol,
        length: Number(w.occurs) || 3,
        win: parseFloat(w.win) || 0,
        direction: String(w.type || '').includes('rtl') ? 'rtl' : 'ltr',
        type: w.type || 'way',
        positions: Array.isArray(w.positions) ? w.positions : null,
        payline: w.payline,
      }))
    : (parsed.wins || []);

  const screen = parsed.screen;
  let gridSnap = null;
  if (Array.isArray(screen) && screen.length === REELS) {
    gridSnap = screen.map(col => (Array.isArray(col) ? col.map(id => SYM_MAP[id] || id) : []));
  }

  const featuresObj = parsed.result?.features || payload?.data?.round?.result?.features || {};
  const featureNames = []
    .concat(featuresObj.spinFeatures || [])
    .concat((parsed.featObjs || []).map(f => f.name || f.id));
  // unique
  const featUnique = [...new Set(featureNames.filter(Boolean))];

  // Bandwidth: nếu có trong featureSteps
  let bandwidthMult = 1;
  const steps = parsed.featureSteps || [];
  for (const st of steps) {
    const n = String(st?.name || '');
    if (/bandwidth/i.test(n) && st.multiplier != null) {
      bandwidthMult = Math.max(bandwidthMult, Number(st.multiplier) || 1);
    }
  }
  if (state.globalMultiplier > 1) {
    bandwidthMult = Math.max(bandwidthMult, state.globalMultiplier);
  }

  const lines = winsIn.map((w, idx) => {
    const sym = w.sym || SYM_MAP[w.symbolId] || 'A';
    const length = Number(w.length) || 3;
    const dir = w.direction === 'rtl' ? 'rtl' : 'ltr';
    const payMult = getSymbolPayMult(sym, length);
    const chainCounts = countsPerReelFromPositions(w.positions, length, dir);
    const ways = waysProduct(chainCounts);
    const rawServerWin = Number(w.win) || 0;
    const baseLine = ways * payMult * bet;
    const positions = Array.isArray(w.positions)
      ? w.positions.map(p => (Array.isArray(p) ? [Number(p[0]), Number(p[1])] : [p.c, p.r]))
      : [];

    return {
      idx: idx + 1,
      sym,
      symbolId: w.symbolId != null ? w.symbolId : null,
      name: SYMBOLS[sym]?.name || sym,
      img: SYMBOLS[sym]?.img || '',
      length,
      direction: dir,
      type: w.type || 'way',
      chainCounts,
      ways,
      payMult,
      bet,
      cellMult: 1,
      baseLine,
      win: rawServerWin,
      positions,
      payline: w.payline,
      raw: w,
    };
  });

  const sumLines = lines.reduce((s, L) => s + (L.win || 0), 0);
  const jp = parsed.progressiveJackpot || null;
  const jpWin = jp && (jp.isTriggered === true || jp.isTriggered === 'true' || jp.tier)
    ? (parseFloat(jp.win) || 0)
    : 0;

  // Stage totalWin string from IN
  const stageTotalWin = parseFloat(stage.totalWin) || totalWin;

  return {
    at: meta.t || Date.now(),
    source: meta.source || `IN ${meta.cmd || payload.cmd || 'SPIN'}`,
    cmd: String(meta.cmd || payload.cmd || ''),
    bet,
    totalWin,
    stageTotalWin,
    balanceBefore: Number(meta.balanceBefore ?? state.balanceBefore) || 0,
    balanceAfter: Number.isFinite(balAfter) ? balAfter : Number(state.balance) || 0,
    thisMode: parsed.thisMode || 'base',
    nextMode: parsed.nextMode || '',
    globalMult: bandwidthMult,
    featureNames: featUnique,
    maxWinReached: !!parsed.maxWinReached,
    spinId: parsed.spinId || '',
    roundId: parsed.roundId || '',
    gridSnap,
    lines,
    sumLines,
    jpWin,
    jpTier: jp?.tier || jp?.tierName || '',
    note: meta.note || '',
    // Giữ raw để panel trích đoạn JSON
    rawWins,
    rawTotalWin: round.totalWin ?? stage.totalWin,
    rawTotalBet: round.totalBet,
    rawScreen: screen,
    rawFeatures: {
      spinFeatures: featuresObj.spinFeatures || null,
      activeFeatures: featuresObj.activeFeatures || null,
      maxWinReached: featuresObj.maxWinReached || false,
      progressiveJackpot: jp,
    },
  };
}

/** Build/update state.lastSpinExplain từ state.lastInSpin (IN SPIN gần nhất). */
export function buildWinExplainFromLastInSpin() {
  // Fallback: lấy từ traffic nếu capture lúc message miss
  if (!state.lastInSpin?.payload) {
    const fromTraffic = findLatestInSpinFromTraffic();
    if (fromTraffic) {
      captureLastInSpin(fromTraffic);
    }
  }
  const rec = state.lastInSpin;
  if (!rec?.payload) {
    state.lastSpinExplain = null;
    return null;
  }
  const ex = buildWinExplainFromInPayload(rec.payload, {
    t: rec.t,
    cmd: rec.cmd,
    source: `IN SPIN cmd ${rec.cmd}`,
    balanceBefore: rec.balanceBefore,
  });
  state.lastSpinExplain = ex;
  const btn = document.getElementById('btnWinExplain');
  if (btn) btn.style.opacity = ex && ex.totalWin > 0 ? '1' : '0.55';
  return ex;
}

/**
 * Fallback local (offline demo) — chỉ khi không có IN SPIN.
 * @param {object} opts
 */
export function recordSpinWinExplainLocal(opts = {}) {
  if (state.lastInSpin?.payload) {
    // Online đã có IN — không ghi đè bằng local estimate
    return buildWinExplainFromLastInSpin();
  }
  const bet = Number(opts.bet ?? state.bet) || 0;
  const totalWin = Number(opts.totalWin ?? state.lastWin) || 0;
  const winsIn = Array.isArray(opts.wins) ? opts.wins : [];
  const screen = opts.screen || null;
  let gridSnap = null;
  if (Array.isArray(screen) && screen.length === REELS) {
    gridSnap = screen.map(col => (Array.isArray(col) ? col.map(id => SYM_MAP[id] || id) : []));
  } else if (state.grid?.length) {
    gridSnap = state.grid.map(col => col.map(s => s));
  }
  const lines = winsIn.map((w, idx) => {
    const sym = w.sym || 'A';
    const length = Number(w.length) || 3;
    const dir = w.direction === 'rtl' ? 'rtl' : 'ltr';
    const payMult = getSymbolPayMult(sym, length);
    let chainCounts = Array.isArray(w.reelPositions) && w.reelPositions.length
      ? w.reelPositions.map(Number)
      : countsPerReelFromPositions(w.positions, length, dir);
    let ways = Number(w.winCount);
    if (!Number.isFinite(ways) || ways <= 0) ways = waysProduct(chainCounts);
    const rawServerWin = Number(w.win) || 0;
    const baseLine = ways * payMult * bet;
    const positions = Array.isArray(w.positions)
      ? w.positions.map(p => (Array.isArray(p) ? [p[0], p[1]] : [p.c, p.r]))
      : cellsForWin(w).map(k => k.split(',').map(Number));
    return {
      idx: idx + 1, sym, name: SYMBOLS[sym]?.name || sym, img: SYMBOLS[sym]?.img || '',
      length, direction: dir, chainCounts, ways, payMult, bet, cellMult: 1,
      baseLine, win: rawServerWin, positions,
    };
  });
  state.lastSpinExplain = {
    at: Date.now(),
    source: 'local (no IN SPIN)',
    cmd: '',
    bet,
    totalWin,
    stageTotalWin: totalWin,
    balanceBefore: Number(opts.balanceBefore ?? state.balanceBefore) || 0,
    balanceAfter: Number(opts.balanceAfter ?? state.balance) || 0,
    thisMode: opts.thisMode || 'base',
    globalMult: Math.max(1, Number(opts.globalMultiplier) || 1),
    featureNames: opts.featureNames || [],
    maxWinReached: !!opts.maxWinReached,
    spinId: '',
    roundId: '',
    gridSnap,
    lines,
    sumLines: lines.reduce((s, L) => s + L.win, 0),
    jpWin: 0,
    jpTier: '',
    note: 'Offline/demo — không có frame IN',
    rawWins: [],
    rawTotalWin: totalWin,
    rawTotalBet: bet,
  };
  return state.lastSpinExplain;
}

export function setWinExplainZoom(z) {
  _wxZoom = Math.min(1.8, Math.max(0.7, z));
  const stage = document.getElementById('wxZoomStage');
  const lab = document.getElementById('wxZoomLabel');
  if (stage) stage.style.transform = `scale(${_wxZoom})`;
  if (lab) lab.textContent = `${Math.round(_wxZoom * 100)}%`;
}

export function renderWinExplainBody() {
  const body = document.getElementById('winExplainBody');
  if (!body) return;
  // Luôn rebuild từ IN SPIN gần nhất trước khi vẽ
  buildWinExplainFromLastInSpin();
  const ex = state.lastSpinExplain;
  if (!ex) {
    body.className = 'wx-empty';
    body.innerHTML = 'Chưa có <strong>IN SPIN</strong> (cmd 1500/1501).<br>Connect &amp; spin — panel này đọc thắng từ frame nhận về, không tự tính local.';
    return;
  }
  body.className = '';

  const modeLabel = ex.thisMode === 'free' ? 'Free Spin' : 'Base';
  const srcBadge = String(ex.source || '').startsWith('IN')
    ? `<span style="color:#00ff88">● ${ex.source}</span>`
    : `<span style="color:#ff8800">○ ${ex.source}</span>`;
  const cards = `
    <div class="wx-summary">
      <div class="wx-card"><span class="k">NGUỒN</span><span class="v" style="font-size:.75rem">${srcBadge}</span></div>
      <div class="wx-card"><span class="k">BET (IN totalBet)</span><span class="v">${fmtBalance(ex.bet)}</span></div>
      <div class="wx-card"><span class="k">TOTAL WIN (IN)</span><span class="v green">${fmtBalance(ex.totalWin)}</span></div>
      <div class="wx-card"><span class="k">BALANCE BEFORE</span><span class="v">${fmtBalance(ex.balanceBefore)}</span></div>
      <div class="wx-card"><span class="k">BALANCE AFTER (IN)</span><span class="v">${fmtBalance(ex.balanceAfter)}</span></div>
      <div class="wx-card"><span class="k">MODE</span><span class="v">${modeLabel}</span></div>
      <div class="wx-card"><span class="k">stages[0].wins</span><span class="v">${ex.lines.length}</span></div>
    </div>`;

  let formulaTop = `Nguồn: ${ex.source}\n`;
  formulaTop += `round.totalBet (IN) = ${ex.rawTotalBet ?? ex.bet}\n`;
  formulaTop += `round.totalWin (IN) = ${ex.rawTotalWin ?? ex.totalWin}\n`;
  formulaTop += `Σ stages[0].wins[].win = ${fmtBalance(ex.sumLines)}\n`;
  formulaTop += `stages[0].totalWin = ${fmtBalance(ex.stageTotalWin ?? ex.totalWin)}`;
  if (ex.globalMult > 1) {
    formulaTop += `\nBandwidth / mult (từ featureSteps hoặc UI) ×${ex.globalMult} — win IN thường đã nhân sẵn`;
  }
  if (ex.jpWin > 0) {
    formulaTop += `\n+ progressiveJackpot.win = ${fmtBalance(ex.jpWin)} (tier ${ex.jpTier || '?'})`;
  }
  if (ex.maxWinReached) formulaTop += `\n⚠ features.maxWinReached = true`;

  // Mini grid 5×3 (row-major visual: row r, col c)
  let mini = '';
  if (ex.gridSnap) {
    const hit = new Set();
    const hitRtl = new Set();
    for (const L of ex.lines) {
      for (const [c, r] of L.positions || []) {
        (L.direction === 'rtl' ? hitRtl : hit).add(`${c},${r}`);
      }
    }
    mini = `<div class="wx-section-title">LƯỚI PAYOUT (cột →)</div><div class="wx-mini-grid">`;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < REELS; c++) {
        const key = `${c},${r}`;
        const sym = ex.gridSnap[c]?.[r] || '';
        const img = SYMBOLS[sym]?.img || '';
        const cls = hitRtl.has(key) ? 'wx-mini-cell hit-rtl' : (hit.has(key) ? 'wx-mini-cell hit' : 'wx-mini-cell');
        mini += `<div class="${cls}" title="col ${c}, row ${r}: ${sym}">${
          img ? imgTag(img, `alt="${sym}"`) : `<span style="font-size:.65rem;color:#666">${sym || '·'}</span>`
        }</div>`;
      }
    }
    mini += `</div>
      <div class="wx-note">Viền xanh = ô tham gia way LTR · viền cyan = RTL (Bypass). Mỗi ô đếm 1 lần trên reel → nhân ways.</div>`;
  }

  let feats = '';
  if (ex.featureNames?.length) {
    feats = `<div class="wx-section-title">MINI-FEATURES SPIN NÀY</div>
      <div style="font-size:.8rem;color:#bcd;margin-bottom:8px">${ex.featureNames.map(n => `• ${n}`).join('<br>')}</div>`;
  }

  let linesHtml = `<div class="wx-section-title">TỪNG WAY — stages[0].wins (từ IN)</div>`;
  if (!ex.lines.length) {
    linesHtml += `<div class="wx-empty" style="padding:12px">IN không có stages[0].wins (totalWin có thể từ jackpot / không trúng ways).</div>`;
  } else {
    linesHtml += ex.lines.map(L => {
      const dirLabel = L.direction === 'rtl' ? 'RTL' : 'LTR';
      const dirCls = L.direction === 'rtl' ? 'dir-rtl' : 'dir-ltr';
      const sid = L.symbolId != null ? L.symbolId : '—';
      const p3 = getSymbolPayMult(L.sym, 3);
      const p4 = getSymbolPayMult(L.sym, 4);
      const p5 = getSymbolPayMult(L.sym, 5);
      const matched = Math.abs(L.baseLine - L.win) <= 0.02 * Math.max(1, L.bet);
      const chain = L.chainCounts || [];
      const reelChips = chain.map((n, i) => {
        const reel = L.direction === 'rtl' ? (REELS - 1 - i) : i;
        return `<div class="wx-reel-chip"><span class="rk">Reel ${reel}</span><span class="rv">${n}</span></div>`;
      }).join('<span class="wx-op">×</span>');
      const posChips = (L.positions || []).map(([c, r]) =>
        `<span class="wx-pos">[${c},${r}]</span>`
      ).join('');
      return `<div class="wx-way">
        <div class="wx-way-head">
          ${L.img ? imgTag(L.img, 'alt=""') : ''}
          <div class="wx-way-title">
            <strong>#${L.idx} · ${L.name}</strong>
            <span class="sub">Symbol ${L.sym} · id ${sid} · type ${L.type || 'way'}</span>
          </div>
          <span class="wx-pill ${dirCls}">${dirLabel}</span>
          <span class="wx-pill oak">${L.length}-of-a-kind</span>
          <span class="wx-way-amount">${fmtBalance(L.win)}</span>
        </div>
        <div class="wx-way-body">
          <div class="wx-steps">
            <div class="wx-step">
              <div class="wx-step-num">1</div>
              <div class="wx-step-body">
                <div class="wx-step-label">Ô thắng (IN positions)</div>
                <div class="wx-step-text">Tọa độ <code>[cột, hàng]</code> server gửi:</div>
                <div class="wx-pos-list">${posChips || '<span class="wx-note">—</span>'}</div>
              </div>
            </div>
            <div class="wx-step">
              <div class="wx-step-num">2</div>
              <div class="wx-step-body">
                <div class="wx-step-label">Đếm ô mỗi reel → số ways</div>
                <div class="wx-step-text">Mỗi reel nhân số ô khớp symbol / wild:</div>
                <div class="wx-reel-row">
                  ${reelChips}
                  <span class="wx-op">=</span>
                  <span class="wx-ways-result">${L.ways} ways</span>
                </div>
              </div>
            </div>
            <div class="wx-step">
              <div class="wx-step-num">3</div>
              <div class="wx-step-body">
                <div class="wx-step-label">Paytable symbol ${L.sym} (${L.name})</div>
                <div class="wx-pay-row">
                  <span class="wx-pay-chip${L.length === 3 ? ' active' : ''}">3-oak ×${p3}</span>
                  <span class="wx-pay-chip${L.length === 4 ? ' active' : ''}">4-oak ×${p4}</span>
                  <span class="wx-pay-chip${L.length === 5 ? ' active' : ''}">5-oak ×${p5}</span>
                </div>
                <div class="wx-step-text" style="margin-top:6px">Đang dùng: <strong style="color:#ffc850">${L.length}-oak = ${L.payMult}× totalBet</strong></div>
              </div>
            </div>
            <div class="wx-step">
              <div class="wx-step-num">4</div>
              <div class="wx-step-body">
                <div class="wx-step-label">Công thức tiền</div>
                <div class="wx-eq">
                  <span class="dim">ways × pay × totalBet</span><br>
                  = <span class="hl">${L.ways}</span> × <span class="hl">${L.payMult}</span> × <span class="hl">${L.bet}</span><br>
                  = <span class="hl">${fmtBalance(L.baseLine)}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="wx-match ${matched ? 'ok' : 'bad'}">
            ${matched
              ? `✓ Khớp IN · wins[].win = ${fmtBalance(L.win)}`
              : `△ Chênh IN · tính ${fmtBalance(L.baseLine)} vs wins[].win ${fmtBalance(L.win)} (Δ ${fmtBalance(L.win - L.baseLine)}) — Bandwidth / mult / cap`}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  let rawJson = '';
  if (ex.rawWins && ex.rawWins.length) {
    try {
      rawJson = `<div class="wx-section-title">RAW stages[0].wins (IN)</div>
        <pre class="wx-formula" style="max-height:180px;overflow:auto;font-size:.68rem">${
          escapeHtmlWx(JSON.stringify(ex.rawWins, null, 2))
        }</pre>`;
    } catch (_) { /* ignore */ }
  }

  const meta = `<div class="wx-note">spinId: ${ex.spinId || '—'} · roundId: ${ex.roundId || '—'} · ${ex.source}
${state.lastInSpin?.t ? `· IN @ ${new Date(state.lastInSpin.t).toLocaleTimeString()}` : ''}</div>`;

  body.innerHTML = cards
    + `<div class="wx-formula">${formulaTop}</div>`
    + mini
    + feats
    + linesHtml
    + rawJson
    + meta
    + `<div class="wx-note">Giải thích bám <strong>IN SPIN</strong> (WS frame nhận). Công thức ways chỉ để hiểu <em>vì sao</em> server trả wins[].win — số tiền authoritative là field trong IN.</div>`;
}

export function escapeHtmlWx(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function openWinExplain() {
  // Ưu tiên IN SPIN; nếu miss capture thì quét traffic
  if (!state.lastInSpin?.payload) {
    const frame = findLatestInSpinFromTraffic();
    if (frame) captureLastInSpin(frame);
  }
  buildWinExplainFromLastInSpin();
  renderWinExplainBody();
  setWinExplainZoom(_wxZoom || 1);
  openModal('modalWinExplain');
}

export function highlightExplainOnMainGrid() {
  const ex = state.lastSpinExplain;
  if (!ex?.lines?.length) {
    showToast('Không có ô win để highlight', '#ff8800');
    return;
  }
  const all = [];
  for (const L of ex.lines) {
    for (const [c, r] of L.positions || []) {
      const k = `${c},${r}`;
      if (!all.includes(k)) all.push(k);
    }
  }
  closeModal('modalWinExplain');
  renderGrid(all);
  document.querySelectorAll('#reelsGrid .cell').forEach(el => {
    const k = `${el.dataset.reel},${el.dataset.row}`;
    el.classList.toggle('win', all.includes(k));
    el.classList.toggle('win-ltr', all.includes(k));
  });
  showToast(`Highlight ${all.length} ô thắng`, '#00ff88');
  setTimeout(() => {
    document.querySelectorAll('#reelsGrid .cell').forEach(el => {
      el.classList.remove('win', 'win-ltr', 'win-rtl');
    });
    renderGrid();
  }, 4500);
}

/** Energy path flowing smoothly (Catmull-Rom spline) through winning cells along the chain direction */
async function animateWayPath(w, cells) {
  const canvas = prepVfxCanvas();
  if (!canvas || !cells.length) return;
  const dir = w.direction === 'rtl' ? -1 : 1;
  const ctrl = cells
    .map(k => k.split(',').map(Number))
    .map(([c, r]) => ({ c, r, rc: cellRectInWrap(c, r) }))
    .filter(x => x.rc)
    .sort((a, b) => (dir * (a.c - b.c)) || (a.r - b.r))
    .map(x => ({ x: x.rc.x, y: x.rc.y }));
  // drop consecutive duplicates (same cell listed twice)
  const pts = ctrl.filter((p, i) => !i || Math.hypot(p.x - ctrl[i - 1].x, p.y - ctrl[i - 1].y) > 1);
  if (pts.length < 2) return;
  const rgb = dir < 0 ? [0, 255, 176] : [0, 240, 255];

  // Dense samples along a Catmull-Rom spline through the cell centers
  const samples = [];
  const PER = 18;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < PER; s++) {
      const t = s / PER;
      const t2 = t * t;
      const t3 = t2 * t;
      samples.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  samples.push({ ...pts[pts.length - 1] });

  const segLens = [];
  let total = 0;
  for (let i = 1; i < samples.length; i++) {
    const d = Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
    segLens.push(d);
    total += d;
  }
  const fracToIndex = (frac) => {
    let d = Math.max(0, Math.min(1, frac)) * total;
    for (let i = 0; i < segLens.length; i++) {
      if (d <= segLens[i] || i === segLens.length - 1) return i;
      d -= segLens[i];
    }
    return segLens.length - 1;
  };

  await runAnimFrame(state.fastSpin ? 260 : 460, (t) => {
    canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
    canvas.ctx.save();
    // smooth spline glow through all winning cells
    canvas.ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.5)`;
    canvas.ctx.lineWidth = 3;
    canvas.ctx.lineJoin = 'round';
    canvas.ctx.lineCap = 'round';
    canvas.ctx.shadowColor = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    canvas.ctx.shadowBlur = 14;
    canvas.ctx.beginPath();
    samples.forEach((p, i) => (i ? canvas.ctx.lineTo(p.x, p.y) : canvas.ctx.moveTo(p.x, p.y)));
    canvas.ctx.stroke();
    // traveling energy pulse hugs the curve
    const headI = fracToIndex(t);
    const tailI = fracToIndex(t - 0.35);
    const head = samples[headI];
    const tail = samples[tailI];
    const grad = canvas.ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    grad.addColorStop(1, '#ffffff');
    canvas.ctx.strokeStyle = grad;
    canvas.ctx.lineWidth = 5;
    canvas.ctx.beginPath();
    for (let i = tailI; i <= headI; i++) {
      const p = samples[i];
      if (i === tailI) canvas.ctx.moveTo(p.x, p.y);
      else canvas.ctx.lineTo(p.x, p.y);
    }
    canvas.ctx.stroke();
    canvas.ctx.fillStyle = '#fff';
    canvas.ctx.beginPath();
    canvas.ctx.arc(head.x, head.y, 5 + Math.sin(t * Math.PI * 2) * 1.5, 0, Math.PI * 2);
    canvas.ctx.fill();
    canvas.ctx.restore();
  });
  canvas.ctx.clearRect(0, 0, canvas.w, canvas.h);
}

export async function animateWinWays(wins, total) {
  const wrap = document.getElementById('reelsWrapper');
  wrap?.classList.add('dim-win');

  if (!wins.length) {
    await sleepRaw(state.fastSpin ? 200 : 400);
    wrap?.classList.remove('dim-win');
    return;
  }

  const markWinDir = (cells, dir) => {
    const cls = dir === 'rtl' ? 'win-rtl' : 'win-ltr';
    const set = new Set(cells);
    document.querySelectorAll('#reelsGrid .cell').forEach(el => {
      const k = `${el.dataset.reel},${el.dataset.row}`;
      el.classList.remove('win-rtl', 'win-ltr');
      if (set.has(k)) el.classList.add(cls, 'win');
    });
  };

  // Show all winning cells together first
  const allCells = [];
  for (const w of wins) {
    for (const key of cellsForWin(w)) {
      if (!allCells.includes(key)) allCells.push(key);
    }
  }
  renderGrid(allCells);
  markWinDir(allCells, 'ltr');
  // Âm thanh win mở đầu (scale theo mức thắng)
  {
    const ref = state.bet / REF_BET || 1;
    if (total >= 40 * ref) sfx('jackpot', { gain: 1.15, force: true });
    else if (total >= 20 * ref) sfx('bigwin', { gain: 1.1, force: true });
    else sfx('win', { gain: 1.0, force: true });
  }
  // Symbol có sprite trên lưới thắng → chạy nhanh
  if (useSpritePackAnim()) boostSpritePack(1600);
  if (state.bypassProtocol || wins.some(w => w.direction === 'rtl')) {
    showVfxBanner('Ways win — LTR + RTL', 'bypass');
  } else {
    showVfxBanner(`${wins.length} way(s) · ${fmt(total)}`, '');
  }
  // Bắt đầu từ 0 để ticker cộng tiền nhìn thấy
  document.getElementById('headerWin').textContent = '0.00';
  await sleepRaw(state.fastSpin ? 120 : 280);

  // LTR ways then RTL ways (Bypass semantic) — rút gọn, cộng dồn header WIN
  const ltr = wins.filter(w => w.direction !== 'rtl');
  const rtl = wins.filter(w => w.direction === 'rtl');
  const ordered = [...ltr, ...rtl];
  const showWays = ordered.slice(0, Math.min(5, ordered.length));
  const wayHold = state.fastSpin ? 160 : 320;
  let running = 0;
  for (const w of showWays) {
    const cells = cellsForWin(w);
    renderGrid(cells);
    markWinDir(cells, w.direction === 'rtl' ? 'rtl' : 'ltr');
    sfx('coin', { gain: 0.75, pitch: 0.95 + Math.min(0.25, running / Math.max(total, 1)), force: true });
    if (w.direction === 'rtl') {
      showVfxBanner(`RTL way · ${SYMBOLS[w.sym]?.name || w.sym} · ${fmt(w.win)}`, 'bypass');
    } else {
      showVfxBanner(`LTR way · ${SYMBOLS[w.sym]?.name || w.sym} · ${fmt(w.win)}`, '');
    }
    const mid = cells[Math.floor(cells.length / 2)];
    if (mid) {
      const [c, r] = mid.split(',').map(Number);
      const el = document.querySelector(`.cell[data-reel="${c}"][data-row="${r}"]`);
      if (el) {
        const float = document.createElement('div');
        float.className = 'win-float';
        float.textContent = fmt(w.win);
        el.appendChild(float);
      }
    }
    // Cộng dồn nhanh theo từng way (phần còn lại tickerWin bù về total)
    const next = running + (Number(w.win) || 0);
    await Promise.all([
      animateWayPath(w, cells),
      runMoneyTicker(running, next, {
        durationMs: state.fastSpin ? 80 : 140,
        onTick: (val) => {
          document.getElementById('headerWin').textContent = val.toFixed(2);
        },
      }),
    ]);
    running = next;
    await sleepRaw(wayHold);
  }

  renderGrid(allCells);
  markWinDir(allCells, 'ltr');
  hideVfxBanner();
  // Snap/ticker phần còn lại tới total (nếu chưa đủ ways hiển thị)
  if (running < total - 0.001) {
    await runMoneyTicker(running, total, {
      durationMs: state.fastSpin ? 100 : 200,
      onTick: (val) => {
        setInfoBar('win', `WIN ${fmt(val)}`);
        document.getElementById('headerWin').textContent = val.toFixed(2);
      },
    });
  } else {
    document.getElementById('headerWin').textContent = Number(total).toFixed(2);
    setInfoBar('win', `WIN ${fmt(total)}`);
  }
  await sleepRaw(state.fastSpin ? 80 : 160);
  wrap?.classList.remove('dim-win');
  document.querySelectorAll('.win-float').forEach(el => el.remove());
  document.querySelectorAll('#reelsGrid .cell').forEach(el => {
    el.classList.remove('win-rtl', 'win-ltr');
  });
}
