// src/ui/historyOnline.js — extracted from main.js
import { ws } from '../core/state.js';
import { fmt } from '../core/utils.js';
import { ROWS, SYMBOLS, SYM_MAP } from '../game/config.js';
import { requestGameCmd } from '../net/session.js';
import { imgTag } from './assets.js';
import { openModal } from './feedback.js';

export let lastDetailSpinId = null;
export let lastDetailRoundId = null;

export async function renderHistoryOnline() {
  const sub = document.getElementById('historySubtitle');
  if (sub) sub.textContent = '(server · cmd 1504)';
  const list = document.getElementById('historyList');
  list.innerHTML = '<p style="color:var(--dim);text-align:center;padding:20px">Loading…</p>';
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    list.innerHTML = '<p style="color:var(--red);text-align:center;padding:20px">Not connected</p>';
    return;
  }
  const payload = await requestGameCmd('1504', { limit: 30, offset: 0 });
  const spins = payload?.spins || payload?.data?.spins || [];
  if (!Array.isArray(spins) || !spins.length) {
    list.innerHTML = '<p style="color:var(--dim);text-align:center;padding:20px">No server history yet</p>';
    return;
  }
  list.innerHTML = spins.map((h, idx) => rowHtml(h, idx)).join('');

  list.querySelectorAll('.history-item[data-spin-id]').forEach(el => {
    el.addEventListener('click', () => openSpinDetailOnline(el.dataset.spinId, el.dataset.roundId));
  });
}

/** One 1504 row → list HTML. Jackpot rows share their trigger spin's roundId (BE display join). */
export function rowHtml(h, idx) {
  if (h?.kind === 'jackpot_win') return jackpotRowHtml(h);
  return spinRowHtml(h, idx);
}

function spinRowHtml(h, idx) {
  const bet = Number(h.betAmount ?? h.totalBet ?? 0);
  const win = Number(h.totalWin ?? h.win ?? 0);
  const profit = Number(h.profit != null ? h.profit : win - bet);
  const mode = h.mode || h.thisMode || 'base';
  const ts = h.timestamp ? String(h.timestamp).replace('T', ' ').slice(0, 19) : '';
  const spinId = h.spinId || '';
  const roundId = h.roundId || '';
  const jpTag = h.jackpotWonTier ? ` · JP ${h.jackpotWonTier}` : '';
  return `
    <div class="history-item" data-kind="spin" data-spin-id="${spinId}" data-round-id="${roundId}" style="cursor:pointer" title="Open detail">
      <div style="display:flex;justify-content:space-between">
        <span>${mode} · #${h.spinIndex || idx + 1}${h.buyFeatureTrigger ? ' · buy' : ''}${h.maxWinReached ? ' · CAP' : ''}${jpTag}</span>
        <span class="${profit >= 0 ? 'history-profit-pos' : 'history-profit-neg'}">${profit >= 0 ? '+' : ''}${fmt(profit)}</span>
      </div>
      <div style="color:var(--dim);font-size:.7rem;margin-top:2px">
        Bet: ${fmt(bet)} | Win: ${fmt(win)}${ts ? ` | ${ts}` : ''}
      </div>
      <div style="color:var(--dim);font-size:.65rem;margin-top:2px;word-break:break-all">
        spinId: ${spinId || '—'} · roundId: ${roundId || '—'}
      </div>
    </div>`;
}

function jackpotRowHtml(h) {
  const amount = Number(h.totalWin ?? h.win ?? h.jackpotWonAmount ?? h.amount ?? 0);
  const tier = h.jackpotWonTier || h.jackpotType || 'JACKPOT';
  const ts = h.timestamp || h.createdAt
    ? String(h.timestamp || h.createdAt).replace('T', ' ').slice(0, 19)
    : '';
  const spinId = h.spinId || '';
  const roundId = h.roundId || '';
  const winId = h.winId || '';
  return `
    <div class="history-item" data-kind="jackpot_win" data-spin-id="${spinId}" data-round-id="${roundId}" data-win-id="${winId}" style="cursor:pointer;border-color:var(--orange,#e8a33d)" title="Open triggering spin">
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--orange,#e8a33d)">◆ JACKPOT · ${tier}</span>
        <span class="history-profit-pos">+${fmt(amount)}</span>
      </div>
      <div style="color:var(--dim);font-size:.7rem;margin-top:2px">
        Win: ${fmt(amount)}${ts ? ` | ${ts}` : ''}
      </div>
      <div style="color:var(--dim);font-size:.65rem;margin-top:2px;word-break:break-all">
        winId: ${winId || '—'} · roundId: ${roundId || '—'}
      </div>
    </div>`;
}

export async function openSpinDetailOnline(spinId, roundId) {
  if (!spinId) return;
  lastDetailSpinId = spinId;
  lastDetailRoundId = roundId || spinId;
  const body = document.getElementById('spinDetailBody');
  const btnRounds = document.getElementById('btnSessionRounds');
  body.innerHTML = '<p>Loading detail…</p>';
  if (btnRounds) btnRounds.style.display = 'none';
  openModal('modalSpinDetail');
  const payload = await requestGameCmd('1506', { spinId, roundId: roundId || spinId });
  if (!payload) {
    body.innerHTML = '<p style="color:var(--red)">Detail timeout / not found</p>';
    return;
  }
  const d = payload.detail || payload;
  const wins = Array.isArray(d.wins) ? d.wins : [];
  const bet = Number(d.betAmount ?? d.totalBet ?? 0);
  const win = Number(d.totalWin ?? d.win ?? 0);
  const profit = Number(d.profit != null ? d.profit : win - bet);
  const ts = d.timestamp ? String(d.timestamp).replace('T', ' ').slice(0, 19) : '—';
  const mode = String(d.thisMode || 'base').toLowerCase();
  const spinType = (d.jackpotWonTier || d.jackpotWonAmount > 0) ? 'JACKPOT'
    : mode.includes('free') || mode === 'fs' ? 'FREE SPIN' : 'NORMAL SPIN';

  // Grid — support row-major (3×5) hoặc column-major (5×3)
  let matrix = null;
  if (Array.isArray(d.screen) && Array.isArray(d.screen[0])) {
    matrix = d.screen.length === ROWS ? d.screen
      : d.screen[0].length === ROWS ? d.screen[0].map((_, r) => d.screen.map(col => col[r]))
      : d.screen;
  }
  const symTag = key => {
    const s = SYMBOLS[key];
    return s?.img ? imgTag(s.img, 'style="width:100%;height:100%;object-fit:contain;display:block" draggable="false"') : (key || '?');
  };
  let gridHtml = '';
  if (matrix) {
    const rows = matrix.length, cols = matrix[0].length;
    gridHtml = `<div id="sdGrid" style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:5px;margin:12px 0">`
      + matrix.map((row, r) => row.map((id, c) => {
        const highlight = wins.some(w => (w.positions || []).some(p => p[0] === c && p[1] === r));
        const dim = !wins.length || highlight ? '' : 'opacity:.4;filter:brightness(.65) grayscale(.35) saturate(.7);';
        return `<div data-r="${r}" data-c="${c}" style="aspect-ratio:1/1;background:rgba(0,0,0,.35);border:1px solid ${highlight ? 'var(--cyan)' : '#1e3a5f'};${highlight ? 'box-shadow:0 0 10px rgba(0,240,255,.5);' : ''}border-radius:6px;display:flex;align-items:center;justify-content:center;padding:3px"><div data-dimmed="1" style="${dim}display:flex;width:100%;height:100%;align-items:center;justify-content:center;transition:opacity .2s,filter .2s;pointer-events:none">${symTag(SYM_MAP[id])}</div></div>`;
      }).join('')).join('') + '</div>';
  }

  // Way wins — pager 6/page (GDD 9.3)
  const PAGE = 6;
  const totalPages = Math.max(1, Math.ceil(wins.length / PAGE));
  let winPage = 0;
  const winRowHtml = (w, idx) => {
    const key = SYM_MAP[w.symbolId] || '?';
    const posTxt = (w.positions || []).map(p => `R${p[0] + 1}·h${p[1] + 1}`).join(', ');
    return `<div data-win="${idx}" class="history-item" style="display:flex;align-items:center;gap:10px;cursor:pointer">
      <div style="width:44px;height:44px;flex:0 0 44px;background:rgba(0,0,0,.35);border-radius:6px;padding:3px;display:flex;align-items:center;justify-content:center">${symTag(key)}</div>
      <div style="flex:1;min-width:0">
        <div style="color:var(--text);font-size:.8rem">#${idx + 1} · ${SYMBOLS[key]?.name || key} ×${w.count}${w.type ? ` · ${w.type}` : ''}${w.lineId != null ? ` · line ${w.lineId}` : ''}</div>
        <div style="color:var(--dim);font-size:.7rem;margin-top:2px">${posTxt || '—'}</div>
      </div>
      <div class="history-profit-pos" style="flex:0 0 auto">${fmt(w.amount)}</div>
    </div>`;
  };
  const winsPageHtml = () => `<div id="sdWins">${wins.slice(winPage * PAGE, winPage * PAGE + PAGE).map((w, i) => winRowHtml(w, winPage * PAGE + i)).join('')}</div>`;
  const pagerHtml = () => (totalPages > 1 ? `
    <div id="sdPager" style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px">
      <button class="btn" id="sdPrev" style="padding:6px 14px;font-size:.75rem" ${winPage === 0 ? 'disabled' : ''}>‹ Prev</button>
      <span style="color:var(--dim);font-size:.75rem">${winPage + 1} / ${totalPages}</span>
      <button class="btn" id="sdNext" style="padding:6px 14px;font-size:.75rem" ${winPage >= totalPages - 1 ? 'disabled' : ''}>Next ›</button>
    </div>` : '');

  const modeBadge = `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
      <span style="padding:3px 10px;border-radius:20px;border:1px solid var(--frame-hi);font-size:.65rem;letter-spacing:1px;color:var(--cyan)">${spinType}</span>
      ${d.buyFeatureTrigger ? '<span style="padding:3px 10px;border-radius:20px;border:1px solid var(--orange);font-size:.65rem;color:var(--orange)">BUY FEATURE</span>' : ''}
      ${d.maxWinReached ? '<span style="padding:3px 10px;border-radius:20px;border:1px solid var(--red);font-size:.65rem;color:var(--red)">WIN CAP</span>' : ''}
    </div>
    ${d.maxWinReached ? '<p style="color:var(--red);font-size:.75rem;margin:-4px 0 8px">Maximum Win Cap reached. Only ' + fmt(Math.min(win, 19693 * bet)) + ' has been awarded for this spin.</p>' : ''}`;

  body.innerHTML = `
    ${modeBadge}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">
      <div style="background:rgba(0,0,0,.35);border:1px solid #1e3a5f;border-radius:8px;padding:8px;text-align:center"><div style="font-size:.65rem;color:var(--dim)">BET</div><div style="color:var(--text)">${fmt(bet)}</div></div>
      <div style="background:rgba(0,0,0,.35);border:1px solid #1e3a5f;border-radius:8px;padding:8px;text-align:center"><div style="font-size:.65rem;color:var(--dim)">WIN</div><div style="color:var(--green)">${fmt(win)}</div></div>
      <div style="background:rgba(0,0,0,.35);border:1px solid #1e3a5f;border-radius:8px;padding:8px;text-align:center"><div style="font-size:.65rem;color:var(--dim)">PROFIT</div><div class="${profit >= 0 ? 'history-profit-pos' : 'history-profit-neg'}">${profit >= 0 ? '+' : ''}${fmt(profit)}</div></div>
    </div>
    ${gridHtml}
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <strong style="color:var(--text);font-size:.85rem;letter-spacing:1px">WAY WINS (${wins.length})</strong>
      <span style="font-size:.7rem;color:var(--dim)">${ts}</span>
    </div>
    ${wins.length ? winsPageHtml() + pagerHtml() : '<p style="color:var(--dim);padding:10px;text-align:center">No wins this spin</p>'}
    <div style="border-top:1px solid #1e3a5f;margin-top:12px;padding-top:10px;font-size:.7rem;color:var(--dim);display:grid;gap:3px">
      <div>mode: ${d.thisMode || '—'} → ${d.nextMode || '—'} · jackpot: ${d.jackpotWonTier ? d.jackpotWonTier + ' ' : ''}${fmt(d.jackpotWonAmount ?? 0)} · contribution: ${fmt(d.jackpotContribution ?? 0)}</div>
      <div style="word-break:break-all">spinId: ${d.spinId || payload.spinId || spinId}</div>
      <div style="word-break:break-all">roundId: ${d.roundId || payload.roundId || roundId || '—'} · session: ${d.sessionId || payload.sessionId || '—'} · game: ${d.gameId || '—'}</div>
    </div>
  `;

  // Highlight winning positions khi click vào way win
  const hlCells = w => {
    const posSet = new Set((w?.positions || []).map(p => p[0] + ',' + p[1]));
    const hasSel = posSet.size > 0;
    body.querySelectorAll('#sdGrid > div[data-r]').forEach(el => {
      const on = posSet.has(el.dataset.c + ',' + el.dataset.r);
      el.style.border = on ? '1px solid var(--cyan)' : '1px solid #1e3a5f';
      el.style.boxShadow = on ? '0 0 10px rgba(0,240,255,.5)' : 'none';
      const inner = el.firstElementChild;
      const symEl = inner?.dataset?.dimmed === '1' ? inner : null;
      if (symEl) {
        if (hasSel && !on) { symEl.style.opacity = '.4'; symEl.style.filter = 'brightness(.65) grayscale(.35) saturate(.7)'; }
        else { symEl.style.opacity = '1'; symEl.style.filter = 'none'; }
      }
    });
  };
  const bindWins = () => {
    body.querySelectorAll('#sdWins .history-item[data-win]').forEach(el =>
      el.addEventListener('click', () => hlCells(wins[Number(el.dataset.win)])));
    if (wins.length) hlCells(wins[0]);
  };
  const bindPager = () => {
    body.querySelector('#sdPrev')?.addEventListener('click', () => { winPage--; reWins(); });
    body.querySelector('#sdNext')?.addEventListener('click', () => { winPage++; reWins(); });
  };
  const reWins = () => {
    const winsEl = body.querySelector('#sdWins');
    if (winsEl) winsEl.outerHTML = winsPageHtml();
    const pager = body.querySelector('#sdPager');
    const parsed = new DOMParser().parseFromString(pagerHtml(), 'text/html').body.firstElementChild;
    if (pager) {
      if (parsed) pager.replaceWith(parsed);
      else pager.remove();
      body.querySelector('#sdPrev')?.addEventListener('click', () => { winPage--; reWins(); });
      body.querySelector('#sdNext')?.addEventListener('click', () => { winPage++; reWins(); });
    }
    bindWins();
  };
  bindWins(); bindPager();
  if (btnRounds) {
    btnRounds.style.display = 'inline-block';
    btnRounds.onclick = () => openSessionRoundsOnline(lastDetailRoundId || lastDetailSpinId);
  }
}

export async function openSessionRoundsOnline(roundOrSpinId) {
  if (!roundOrSpinId) return;
  const body = document.getElementById('spinDetailBody');
  body.innerHTML = '<p>Loading package rounds…</p>';
  openModal('modalSpinDetail');
  const payload = await requestGameCmd('1505', {
    roundId: roundOrSpinId,
    transactionId: roundOrSpinId,
    spinId: roundOrSpinId,
  });
  if (!payload) {
    body.innerHTML = '<p style="color:var(--red)">Session rounds timeout</p>';
    return;
  }
  const items = payload.items || [];
  body.innerHTML = `
    <div><strong style="color:var(--text)">package roundId</strong>: ${payload.roundId || roundOrSpinId}</div>
    <div><strong style="color:var(--text)">totalItems</strong>: ${payload.totalItems ?? items.length} · maxWin: ${payload.maxWinReached ? 'YES' : 'no'}</div>
    <div style="margin-top:10px">${(items.length ? items : []).map(it => `
      <div class="history-item" style="margin-bottom:6px">
        <div style="display:flex;justify-content:space-between">
          <span>#${it.roundIndex} ${it.thisMode || ''} → ${it.nextMode || ''}</span>
          <span class="history-profit-pos">${fmt(it.totalWin ?? it.win)}</span>
        </div>
        <div style="font-size:.65rem;word-break:break-all">${it.spinId || ''}</div>
      </div>`).join('') || '<p style="color:var(--dim)">Empty package</p>'}
    </div>`;
}

export async function renderJackpotHistoryOnline() {
  const list = document.getElementById('jackpotHistoryList');
  list.innerHTML = '<p style="color:var(--dim);text-align:center;padding:20px">Loading…</p>';
  const payload = await requestGameCmd('1507', { limit: 30 });
  const rows = payload?.history || payload?.data?.history || [];
  if (!Array.isArray(rows) || !rows.length) {
    list.innerHTML = '<p style="color:var(--dim);text-align:center;padding:20px">No jackpot history</p>';
    return;
  }
  list.innerHTML = rows.map(r => `
    <div class="history-item">
      <div style="display:flex;justify-content:space-between">
        <span>${r.jackpotType || r.tier || 'JP'} · ${r.username || r.userId || ''}</span>
        <span class="history-profit-pos">${fmt(r.amount)}</span>
      </div>
      <div style="color:var(--dim);font-size:.7rem;margin-top:2px">${r.winId || r.id || ''}</div>
    </div>`).join('');
}

// ─── Splash ──────────────────────────────────────────────────
