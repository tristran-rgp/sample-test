// src/ui/cheat/transport.js — extracted from main.js
import { activeSessionsCache, cheatTargetSession, online, setActiveSessionsCache, state, ws } from '../../core/state.js';
import { sleepRaw } from '../../core/utils.js';
import { doSpin } from '../../game/spin.js';
import { requestGameCmd } from '../../net/session.js';
import { resolveSessionAgencyId, resolveSessionUserId, syncCheatSessionFields } from '../../net/ws.js';
import { parseCheatValue, writeCheatGridToJson } from './editor.js';
import { CHEAT_IMMEDIATE, saveCheatPrefs, setCheatLog } from './panel.js';
import { closeModal, showToast } from '../feedback.js';
import { escapeHtmlLite } from '../wsTrafficDock.js';

export async function sendCheatViaWs(code, value) {
  if (!online || !ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket not connected');
  }
  const extra = { cheat: code, value };
  if (cheatTargetSession?.sessionId) {
    extra.session_id = cheatTargetSession.sessionId;
  }
  const payload = await requestGameCmd('1999', extra, 12000);
  if (!payload) {
    throw new Error('No response / timeout (is server profile dev|staging?)');
  }
  if (payload.c !== undefined && payload.c !== null && payload.c != 0) {
    throw new Error(payload.msg || 'error code ' + payload.c);
  }
  return payload;
}

/**
 * Debug REST base. Falls back to the game-server host from srvUrl when the
 * configured base points at localhost but the client talks to a remote host —
 * avoids ERR_CONNECTION_REFUSED on remote environments.
 */
export function resolveDebugBaseUrl() {
  let base = (document.getElementById('cheatDebugBase')?.value || '').replace(/\/$/, '');
  try {
    const srvRaw = document.getElementById('srvUrl')?.value || '';
    const isLocalHost = h =>
      !h || h === 'localhost' || h === '127.0.0.1' || /^\d{1,3}(\.\d{1,3}){3}$/.test(h);
    if (base && srvRaw) {
      const srvUrl = new URL(srvRaw);
      if (isLocalHost(new URL(base).hostname) && !isLocalHost(srvUrl.hostname)) {
        return `${srvUrl.origin}/api/game/zeroday`;
      }
    }
  } catch (_) {
    /* keep configured base */
  }
  return base;
}

/** Send cheat via REST POST /debug/cheat/{agencyId}/{userId} */
export async function sendCheatViaRest(code, value) {
  const base = resolveDebugBaseUrl();
  const token = document.getElementById('cheatDebugToken')?.value || 'zeroday-debug-2024';
  const target = resolveCheatTarget();
  const agencyId = target.agencyId;
  const userId = target.userId;
  if (!base) throw new Error('Missing debug base URL');
  if (!userId) throw new Error('Missing user ID for REST cheat — login or fill User ID');
  if (!agencyId) throw new Error('Missing agency ID — Pull session or fill Agency ID');

  const url = `${base}/debug/cheat/${encodeURIComponent(agencyId)}/${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Token': token,
    },
    body: JSON.stringify({ cheat: code, value }),
  });
  let body = null;
  try {
    body = await res.json();
  } catch (_) {
    body = { raw: await res.text() };
  }
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status}: ` + (body?.error || body?.message || JSON.stringify(body))
    );
  }
  return body;
}

/**
 * Cheat target: selected active session (cmd 1998) or self identity.
 * WS cmd 1999 always targets the calling session (server overwrites
 * agency/user from auth), so a selected other-session must go via REST.
 */
export function resolveCheatTarget() {
  if (cheatTargetSession?.agency && cheatTargetSession?.userId) {
    return { agencyId: cheatTargetSession.agency, userId: cheatTargetSession.userId };
  }
  return { agencyId: resolveSessionAgencyId(), userId: resolveSessionUserId() };
}

/** Load active sessions via cmd 1998 and populate the target select. */
export async function loadActiveSessions(opts = {}) {
  const quiet = !!opts.quiet;
  if (!online || !ws || ws.readyState !== WebSocket.OPEN) {
    if (!quiet) setCheatLog('Load sessions failed: WebSocket not connected', 'err');
    return;
  }
  if (!quiet) setCheatLog('Loading active sessions (cmd 1998)…', '');
  const payload = await requestGameCmd('1998', {}, 12000);
  if (!payload) {
    if (!quiet) setCheatLog('Load sessions: no response / timeout', 'err');
    return;
  }
  const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  setActiveSessionsCache(sessions.filter(s => s.authFound));
  renderActiveSessionOptions();
  if (quiet) return;
  const stale = sessions.length - activeSessionsCache.length;
  setCheatLog(
    `Loaded ${activeSessionsCache.length} active session(s)` +
      (stale > 0 ? ` (${stale} without auth skipped)` : '') +
      ` · zone=${payload.zone ?? '?'} plugin=${payload.pluginName ?? '?'}`,
    'ok'
  );
}

export function renderActiveSessionOptions() {
  const sel = document.getElementById('cheatSessionSelect');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML =
    '<option value="">(self — current login)</option>' +
    activeSessionsCache
      .map((s, i) => {
        const name = s.username || s.userId || s.sessionId;
        const label = `${name} · ${s.agency || '?'} · ${String(s.userId || '').slice(0, 28)}`;
        return `<option value="${i}">${escapeHtmlLite(label)}</option>`;
      })
      .join('');
  if ([...sel.options].some(o => o.value === current)) sel.value = current;
}

/** Apply selected target to the Agency/User ID fields (REST path reads them). */
export function applyCheatTargetToFields() {
  const agencyEl = document.getElementById('cheatAgencyId');
  const userEl = document.getElementById('cheatUserId');
  if (cheatTargetSession) {
    if (agencyEl) {
      agencyEl.value = cheatTargetSession.agency || '';
      agencyEl.dataset.auto = '0';
    }
    if (userEl) {
      userEl.value = cheatTargetSession.userId || '';
      userEl.dataset.auto = '0';
    }
  } else {
    syncCheatSessionFields();
  }
}

/**
 * @param {{ andSpin?: boolean }} opts
 */
export async function sendCheatFromPanel(opts = {}) {
  const andSpin = !!opts.andSpin;
  const code = document.getElementById('cheatCode')?.value;
  if (!code) {
    setCheatLog('Select a cheat code', 'err');
    return;
  }

  // Sync FORCE_GRID editor → JSON before parse
  if (code === 'FORCE_GRID') {
    writeCheatGridToJson();
  }

  let value;
  try {
    value = parseCheatValue();
  } catch (e) {
    setCheatLog(e.message, 'err');
    return;
  }

  const gid = document.getElementById('gameId')?.value || 'yama_01023';
  if (
    [
      'SET_FREE_SPIN_COUNT',
      'FORCE_LAST_FREE_SPIN',
      'SET_GAME_MODE',
      'SET_ACCUMULATED_WIN',
      'RESET_SESSION',
      'CLEAR_AGENT_STATE',
    ].includes(code) &&
    value.game_id == null &&
    value.gameId == null
  ) {
    value = { ...value, game_id: gid };
  }

  saveCheatPrefs();
  const transport = document.getElementById('cheatTransport')?.value || 'auto';
  const btnSend = document.getElementById('cheatSend');
  const btnSpin = document.getElementById('cheatSendSpin');
  if (btnSend) btnSend.disabled = true;
  if (btnSpin) btnSpin.disabled = true;
  const target = resolveCheatTarget();
  setCheatLog(
    `Sending ${code} via ${transport}${andSpin ? ' + spin' : ''}…\n` +
      `agency=${target.agencyId} userId=${target.userId}` +
      (cheatTargetSession ? ` (target: ${cheatTargetSession.username || cheatTargetSession.sessionId})` : '') +
      `\n` +
      JSON.stringify(value),
    ''
  );

  try {
    let result;
    let used = transport;
    if (transport === 'ws') {
      result = await sendCheatViaWs(code, value);
      used = 'ws';
    } else if (transport === 'rest') {
      result = await sendCheatViaRest(code, value);
      used = 'rest';
    } else if (online && ws?.readyState === WebSocket.OPEN) {
      try {
        result = await sendCheatViaWs(code, value);
        used = 'ws';
      } catch (wsErr) {
        setCheatLog(`WS failed (${wsErr.message}) — trying REST…`, '');
        result = await sendCheatViaRest(code, value);
        used = 'rest (fallback)';
      }
    } else {
      result = await sendCheatViaRest(code, value);
      used = 'rest';
    }

    const desc = result?.description || result?.msg || '';
    setCheatLog(
      `OK via ${used}\n${code}\n${desc}\n${JSON.stringify(result, null, 2)}`,
      'ok'
    );
    showToast(`Cheat OK: ${code}`, '#00ff88');

    // Targeted cheat consumed → refresh the session list quietly (target may be gone).
    if (cheatTargetSession) {
      loadActiveSessions({ quiet: true }).catch(() => {});
    }

    if (andSpin) {
      if (CHEAT_IMMEDIATE.has(code)) {
        setCheatLog(
          (document.getElementById('cheatLog')?.textContent || '') +
            '\n\n(Immediate cheat — skipped auto-spin)',
          'ok'
        );
        showToast('Immediate cheat — spin manually if needed', '#ff8800');
      } else if (state.spinning) {
        showToast('Already spinning — cheat applied for next free window', '#ff8800');
      } else if (!online) {
        // Offline: no server cheat consume — still run local spin for UI smoke
        closeModal('modalCheat');
        showToast('Offline: cheat not applied to server; local spin only', '#ff8800');
        await doSpin();
      } else {
        closeModal('modalCheat');
        // Small delay so Redis/cache is visible to next spin
        await sleepRaw(80);
        await doSpin();
      }
    }
  } catch (e) {
    setCheatLog(`FAILED\n${code}\n${e.message}`, 'err');
    showToast('Cheat failed: ' + e.message, '#ff3355');
  } finally {
    if (btnSend) btnSend.disabled = false;
    if (btnSpin) btnSpin.disabled = false;
  }
}

/** Bind once — works before Play (initUI not required). */
