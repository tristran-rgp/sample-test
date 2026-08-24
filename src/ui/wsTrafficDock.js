// src/ui/wsTrafficDock.js — extracted from main.js
import { showToast } from './feedback.js';
import { _spriteRaf, ensureSpritePackTicker, set_spriteRaf } from './sprites.js';

// ─── WS TRAFFIC DOCK ─────────────────────────────────────────
export const WS_CMD_LABELS = {
  '1002': 'PING',
  '1005': 'JOIN',
  '1006': 'FORCE_LOGOUT',
  '1500': 'SPIN',
  '1501': 'BUY_FEATURE',
  '1502': 'LAST_SESSION',
  '1503': 'GET_BALANCE',
  '1504': 'GET_SPIN_LIST',
  '1505': 'GET_SESSION_ROUNDS',
  '1506': 'GET_SPIN_DETAIL',
  '1507': 'JACKPOT_HISTORY',
  '1508': 'PREV_LAST_SESSION',
  '1531': 'BALANCE_UPDATED',
  '1999': 'CHEAT',
  '9000': 'JACKPOT_WIN',
  '9001': 'JACKPOT_POOL',
};

export const wsTrafficState = {
  items: [],
  maxItems: 200,
  paused: false,
  seq: 0,
};

export function wsTrafficStorageKey(k) {
  return 'zd.wsTraffic.' + k;
}

export function extractWsCmdMeta(data) {
  // Outgoing game: [6, 'MiniGame', gameId, { cmd, ... }]
  // Incoming game: [5, { cmd, c, data, ... }]
  // Auth: [1, ...]
  // Ping: ["7", ...] or [7, ...]
  let cmd = '';
  let label = '';
  let err = false;
  try {
    if (Array.isArray(data)) {
      const t = data[0];
      if (t === 6 || t === '6') {
        const p = data[3];
        if (p && typeof p === 'object' && p.cmd != null) {
          cmd = String(p.cmd);
          label = WS_CMD_LABELS[cmd] || ('cmd ' + cmd);
        } else if (data[1] === 1 || data[1] === '1') {
          label = 'PING_ACK';
          cmd = 'ping-ack';
        } else {
          label = 'FRAME_6';
        }
      } else if (t === 5 || t === '5') {
        const p = data[1];
        if (p && typeof p === 'object') {
          cmd = String(p.cmd ?? '');
          label = WS_CMD_LABELS[cmd] || (cmd ? 'cmd ' + cmd : 'GAME');
          if (p.c != null && p.c !== 0 && p.c !== '0') err = true;
        } else label = 'GAME';
      } else if (t === 1 || t === '1') {
        label = 'AUTH';
        cmd = 'auth';
      } else if (t === 0 || t === '0') {
        label = 'ERROR';
        err = true;
      } else if (t === 7 || t === '7') {
        label = 'PING';
        cmd = 'ping';
      } else {
        label = 'T' + String(t);
      }
    } else if (data && typeof data === 'object' && data.cmd != null) {
      cmd = String(data.cmd);
      label = WS_CMD_LABELS[cmd] || ('cmd ' + cmd);
    } else {
      label = typeof data === 'string' ? 'RAW' : 'MSG';
    }
  } catch (_) {
    label = 'MSG';
  }
  return { cmd, label, err };
}

export function isWsPingLike(meta, data) {
  if (!meta) return false;
  if (meta.cmd === 'ping' || meta.cmd === 'ping-ack' || meta.label === 'PING' || meta.label === 'PING_ACK') {
    return true;
  }
  if (Array.isArray(data) && (data[0] === 7 || data[0] === '7')) return true;
  if (Array.isArray(data) && (data[0] === 6 || data[0] === '6') && (data[1] === 1 || data[1] === '1')) {
    return true;
  }
  return false;
}

export function formatWsTrafficPayload(data) {
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch (_) {
    return String(data);
  }
}

export function logWsTraffic(dir, data, note) {
  if (wsTrafficState.paused) return;
  const meta = extractWsCmdMeta(data);
  const hidePing = document.getElementById('wsTrafficHidePing')?.checked !== false;
  if (hidePing && isWsPingLike(meta, data)) return;

  const item = {
    id: ++wsTrafficState.seq,
    t: Date.now(),
    dir, // out | in | err
    cmd: meta.cmd,
    label: meta.label + (note ? ' · ' + note : ''),
    err: dir === 'err' || meta.err,
    data, // raw frame — dùng cho win explain (IN SPIN)
    text: formatWsTrafficPayload(data),
  };
  wsTrafficState.items.push(item);
  while (wsTrafficState.items.length > wsTrafficState.maxItems) {
    wsTrafficState.items.shift();
  }
  renderWsTrafficItem(item);
  updateWsTrafficCount();

  const dock = document.getElementById('wsTrafficDock');
  if (dock && dock.style.display === 'none') {
    document.getElementById('wsTrafficFab')?.classList.add('has-new');
  }
}

export function updateWsTrafficCount() {
  const el = document.getElementById('wsTrafficCount');
  if (el) el.textContent = String(wsTrafficState.items.length);
}

export function renderWsTrafficItem(item) {
  const body = document.getElementById('wsTrafficBody');
  const empty = document.getElementById('wsTrafficEmpty');
  if (!body) return;
  if (empty) empty.remove();

  const row = document.createElement('div');
  row.className =
    'ws-traffic-item ' +
    (item.err ? 'err' : item.dir === 'out' ? 'out' : 'in');
  row.dataset.id = String(item.id);

  const time = new Date(item.t).toLocaleTimeString('en-GB', { hour12: false }) +
    '.' + String(item.t % 1000).padStart(3, '0');
  const dirLabel = item.dir === 'out' ? 'OUT' : item.dir === 'err' ? 'ERR' : 'IN';
  const preview = (item.text || '').replace(/\s+/g, ' ').slice(0, 80);

  row.innerHTML =
    '<div class="ws-traffic-item-head">' +
    '<span class="ws-traffic-dir">' + dirLabel + '</span>' +
    '<span class="ws-traffic-cmd">' + escapeHtmlLite(item.label) + '</span>' +
    '<span class="ws-traffic-preview">' + escapeHtmlLite(preview) + '</span>' +
    '<span class="ws-traffic-time">' + time + '</span>' +
    '</div>' +
    '<pre class="ws-traffic-item-body"></pre>';

  const pre = row.querySelector('.ws-traffic-item-body');
  pre.textContent = item.text;

  row.querySelector('.ws-traffic-item-head').addEventListener('click', () => {
    const willOpen = !row.classList.contains('open');
    // Accordion: only one fully expanded at a time (easier to read full body)
    if (willOpen) {
      body.querySelectorAll('.ws-traffic-item.open').forEach(el => {
        if (el !== row) el.classList.remove('open');
      });
    }
    row.classList.toggle('open', willOpen);
    if (willOpen) {
      requestAnimationFrame(() => {
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        // Reset inner scroll to top so long responses start from the beginning
        const pre = row.querySelector('.ws-traffic-item-body');
        if (pre) pre.scrollTop = 0;
      });
    }
  });

  body.appendChild(row);
  if (document.getElementById('wsTrafficAutoScroll')?.checked !== false) {
    body.scrollTop = body.scrollHeight;
  }
}

export function escapeHtmlLite(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function clearWsTraffic() {
  wsTrafficState.items = [];
  const body = document.getElementById('wsTrafficBody');
  if (body) {
    body.innerHTML =
      '<div class="ws-traffic-empty" id="wsTrafficEmpty">' +
      'Đã xóa log.<br>Traffic mới sẽ hiện tại đây.' +
      '</div>';
  }
  updateWsTrafficCount();
}

export function copyWsTraffic() {
  const payload = wsTrafficState.items.map(i => ({
    t: new Date(i.t).toISOString(),
    dir: i.dir,
    label: i.label,
    cmd: i.cmd,
    body: (() => { try { return JSON.parse(i.text); } catch (_) { return i.text; } })(),
  }));
  const text = JSON.stringify(payload, null, 2);
  const done = () => showToast('WS traffic copied (' + payload.length + ')', '#00ff88');
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      fallbackCopyText(text);
      done();
    });
  } else {
    fallbackCopyText(text);
    done();
  }
}

export function fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (_) {}
  ta.remove();
}

export function setWsTrafficCollapsed(collapsed) {
  const dock = document.getElementById('wsTrafficDock');
  const btn = document.getElementById('wsTrafficCollapse');
  if (!dock) return;
  dock.classList.toggle('collapsed', !!collapsed);
  if (btn) btn.textContent = collapsed ? '+' : '−';
  try {
    localStorage.setItem(wsTrafficStorageKey('collapsed'), collapsed ? '1' : '0');
  } catch (_) {}
}

export function setWsTrafficVisible(visible) {
  const dock = document.getElementById('wsTrafficDock');
  const fab = document.getElementById('wsTrafficFab');
  if (!dock || !fab) return;
  dock.style.display = visible ? 'flex' : 'none';
  fab.style.display = visible ? 'none' : 'flex';
  if (visible) fab.classList.remove('has-new');
  try {
    localStorage.setItem(wsTrafficStorageKey('visible'), visible ? '1' : '0');
  } catch (_) {}
}

export function saveWsTrafficGeom() {
  const dock = document.getElementById('wsTrafficDock');
  if (!dock || dock.classList.contains('collapsed')) return;
  try {
    localStorage.setItem(
      wsTrafficStorageKey('geom'),
      JSON.stringify({
        left: dock.style.left || '',
        top: dock.style.top || '',
        right: dock.style.right || '',
        bottom: dock.style.bottom || '',
        width: dock.style.width || dock.offsetWidth + 'px',
        height: dock.style.height || dock.offsetHeight + 'px',
      })
    );
  } catch (_) {}
}

export function restoreWsTrafficGeom() {
  const dock = document.getElementById('wsTrafficDock');
  if (!dock) return;
  try {
    const raw = localStorage.getItem(wsTrafficStorageKey('geom'));
    if (!raw) return;
    const g = JSON.parse(raw);
    if (g.width) dock.style.width = g.width;
    if (g.height) dock.style.height = g.height;
    if (g.left) {
      dock.style.left = g.left;
      dock.style.right = 'auto';
    } else if (g.right) {
      dock.style.right = g.right;
      dock.style.left = 'auto';
    }
    if (g.top) {
      dock.style.top = g.top;
      dock.style.bottom = 'auto';
    } else if (g.bottom) {
      dock.style.bottom = g.bottom;
      dock.style.top = 'auto';
    }
  } catch (_) {}
}

export function bindWsTrafficDrag() {
  const dock = document.getElementById('wsTrafficDock');
  const head = document.getElementById('wsTrafficHead');
  if (!dock || !head) return;

  let dragging = false;
  let ox = 0;
  let oy = 0;

  const onMove = (e) => {
    if (!dragging) return;
    const pt = e.touches ? e.touches[0] : e;
    let nx = pt.clientX - ox;
    let ny = pt.clientY - oy;
    const maxX = window.innerWidth - Math.min(dock.offsetWidth, 80);
    const maxY = window.innerHeight - 40;
    nx = Math.max(0, Math.min(nx, maxX));
    ny = Math.max(0, Math.min(ny, maxY));
    dock.style.left = nx + 'px';
    dock.style.top = ny + 'px';
    dock.style.right = 'auto';
    dock.style.bottom = 'auto';
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    saveWsTrafficGeom();
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
  };

  const onDown = (e) => {
    if (e.target.closest('button')) return;
    if (dock.classList.contains('collapsed')) {
      // collapsed: click head expands
      if (e.type === 'mousedown' || e.type === 'touchstart') {
        setWsTrafficCollapsed(false);
      }
      return;
    }
    const pt = e.touches ? e.touches[0] : e;
    const rect = dock.getBoundingClientRect();
    dragging = true;
    ox = pt.clientX - rect.left;
    oy = pt.clientY - rect.top;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
    e.preventDefault();
  };

  head.addEventListener('mousedown', onDown);
  head.addEventListener('touchstart', onDown, { passive: false });

  // Persist size after resize
  if (typeof ResizeObserver !== 'undefined') {
    let t = null;
    new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(saveWsTrafficGeom, 200);
    }).observe(dock);
  }
}

export function initWsTrafficDock() {
  const dock = document.getElementById('wsTrafficDock');
  if (!dock) return;

  restoreWsTrafficGeom();

  try {
    const collapsed = localStorage.getItem(wsTrafficStorageKey('collapsed')) === '1';
    setWsTrafficCollapsed(collapsed);
    const visible = localStorage.getItem(wsTrafficStorageKey('visible'));
    setWsTrafficVisible(visible !== '0');
  } catch (_) {
    setWsTrafficVisible(true);
  }

  document.getElementById('wsTrafficCollapse')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setWsTrafficCollapsed(!dock.classList.contains('collapsed'));
  });
  document.getElementById('wsTrafficHide')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setWsTrafficVisible(false);
  });
  document.getElementById('wsTrafficFab')?.addEventListener('click', () => {
    setWsTrafficVisible(true);
  });
  document.getElementById('wsTrafficClear')?.addEventListener('click', clearWsTraffic);
  document.getElementById('wsTrafficCopy')?.addEventListener('click', copyWsTraffic);
  document.getElementById('wsTrafficPause')?.addEventListener('click', (e) => {
    wsTrafficState.paused = !wsTrafficState.paused;
    e.currentTarget.classList.toggle('active', wsTrafficState.paused);
    e.currentTarget.textContent = wsTrafficState.paused ? '▶' : '❚❚';
    e.currentTarget.title = wsTrafficState.paused ? 'Tiếp tục ghi log' : 'Tạm dừng ghi log';
  });

  bindWsTrafficDrag();

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
      e.preventDefault();
      const visible = dock.style.display !== 'none';
      setWsTrafficVisible(!visible);
    }
  });
}

initWsTrafficDock();

document.addEventListener('visibilitychange', () => {
  document.body.classList.toggle('tab-hidden', document.hidden);
  if (document.hidden) {
    if (_spriteRaf) {
      cancelAnimationFrame(_spriteRaf);
      set_spriteRaf(0);
    }
  } else if (typeof ensureSpritePackTicker === 'function') {
    ensureSpritePackTicker();
  }
});
if (document.hidden) document.body.classList.add('tab-hidden');
