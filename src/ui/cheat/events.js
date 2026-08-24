// src/ui/cheat/events.js — extracted from main.js
import { activeSessionsCache, sessionAgencyId, sessionUserId, sessionUsername, setCheatTargetSession, setSessionAgencyId, setSessionUserId, state } from '../../core/state.js';
import { deriveAgencyFromSrvUrl, resolveSessionAgencyId, resolveSessionUserId, syncCheatSessionFields } from '../../net/ws.js';
import { applyFeaturesToEditor, fillCheatGrid, loadCheatGridFromScreen, loadCheatGridScatter3, onCheatCodeChanged, writeCheatGridToJson } from './editor.js';
import { applyFeaturesToFsOverlay, applyFsGridAndSpin, applyGridToFsOverlay, fillFsOverlayGrid, loadFsOverlayFromScreen, openFsGridEditor, setEditFsGridEnabled, skipFsGridAndSpin } from './fsEditor.js';
import { CHEAT_FEATURE_NAMES, CHEAT_PRESETS, openCheatPanel, setCheatLog } from './panel.js';
import { applyCheatTargetToFields, loadActiveSessions, sendCheatFromPanel } from './transport.js';
import { closeModal } from '../feedback.js';

export function bindCheatPanelEvents() {
  if (bindCheatPanelEvents._done) return;
  bindCheatPanelEvents._done = true;
  document.getElementById('menuCheat')?.addEventListener('click', () => {
    closeModal('modalMenu');
    openCheatPanel();
  });
  document.getElementById('btnCheatFab')?.addEventListener('click', () => openCheatPanel());
  document.getElementById('closeCheat')?.addEventListener('click', () => closeModal('modalCheat'));
  document.getElementById('cheatSend')?.addEventListener('click', () =>
    sendCheatFromPanel({ andSpin: false })
  );
  document.getElementById('cheatSendSpin')?.addEventListener('click', () =>
    sendCheatFromPanel({ andSpin: true })
  );
  document.getElementById('cheatClearLog')?.addEventListener('click', () => setCheatLog('Ready.', ''));
  document.getElementById('cheatPullSession')?.addEventListener('click', () => {
    const agencyEl = document.getElementById('cheatAgencyId');
    const userEl = document.getElementById('cheatUserId');
    if (agencyEl) agencyEl.dataset.auto = '1';
    if (userEl) userEl.dataset.auto = '1';
    if (!sessionAgencyId) setSessionAgencyId(deriveAgencyFromSrvUrl());
    if (!sessionUserId) {
      setSessionUserId(sessionUsername || document.getElementById('loginUser')?.value || '');
    }
    syncCheatSessionFields();
    setCheatLog(
      `Pulled session\nagency=${resolveSessionAgencyId()}\nuserId=${resolveSessionUserId()}`,
      'ok'
    );
  });
  document.getElementById('cheatLoadSessions')?.addEventListener('click', () =>
    loadActiveSessions()
  );
  document.getElementById('cheatSessionSelect')?.addEventListener('change', e => {
    const idx = Number(e.target.value);
    const target =
      e.target.value !== '' && activeSessionsCache[idx] ? activeSessionsCache[idx] : null;
    setCheatTargetSession(target);
    applyCheatTargetToFields();
    setCheatLog(
      target
        ? `Target: ${target.username || '?'} · agency=${target.agency} · userId=${target.userId}`
        : 'Target: self (current login)',
      'ok'
    );
  });
  document.getElementById('cheatAgencyId')?.addEventListener('input', e => {
    e.target.dataset.auto = '0';
    if (e.target.value.trim()) setSessionAgencyId(e.target.value.trim());
  });
  document.getElementById('cheatUserId')?.addEventListener('input', e => {
    e.target.dataset.auto = '0';
    if (e.target.value.trim()) setSessionUserId(e.target.value.trim());
  });
  document.getElementById('modalCheat')?.addEventListener('click', e => {
    if (e.target.id === 'modalCheat') closeModal('modalCheat');
  });
  document.getElementById('cheatCode')?.addEventListener('change', () => {
    const code = document.getElementById('cheatCode').value;
    const preset = CHEAT_PRESETS.find(p => p.code === code);
    if (preset?.value != null) {
      document.getElementById('cheatValue').value = JSON.stringify(preset.value, null, 2);
    } else if (code !== 'FORCE_GRID') {
      document.getElementById('cheatValue').value = '{}';
    }
    onCheatCodeChanged({ fromPreset: true });
  });
  document.getElementById('cheatGridFillH')?.addEventListener('click', () => fillCheatGrid(8));
  document.getElementById('cheatGridFillA')?.addEventListener('click', () => fillCheatGrid(1));
  document.getElementById('cheatGridFromScreen')?.addEventListener('click', () => loadCheatGridFromScreen());
  document.getElementById('cheatGridScatter3')?.addEventListener('click', () => loadCheatGridScatter3());
  document.getElementById('cheatGridSyncJson')?.addEventListener('click', () => {
    writeCheatGridToJson();
    setCheatLog('Grid → JSON synced', 'ok');
  });
  document.getElementById('cheatFeatAll')?.addEventListener('click', () => {
    applyFeaturesToEditor(CHEAT_FEATURE_NAMES);
    writeCheatGridToJson();
  });
  document.getElementById('cheatFeatNone')?.addEventListener('click', () => {
    applyFeaturesToEditor([]);
    writeCheatGridToJson();
  });
  document.getElementById('cheatEditFsGrid')?.addEventListener('change', e => {
    setEditFsGridEnabled(!!e.target.checked);
  });
  document.getElementById('btnFsEditGrid')?.addEventListener('click', e => {
    e.stopPropagation();
    if (!state.inFreeSpins || state.spinning) return;
    openFsGridEditor();
  });
  document.getElementById('fsGridSkip')?.addEventListener('click', () => skipFsGridAndSpin());
  document.getElementById('fsGridApply')?.addEventListener('click', () => applyFsGridAndSpin());
  document.getElementById('fsGridFillH')?.addEventListener('click', () => fillFsOverlayGrid(8));
  document.getElementById('fsGridFillA')?.addEventListener('click', () => fillFsOverlayGrid(1));
  document.getElementById('fsGridFromScreen')?.addEventListener('click', () => loadFsOverlayFromScreen());
  document.getElementById('fsGridScatter3')?.addEventListener('click', () => {
    applyGridToFsOverlay([
      [6, 7, 8, 9, 10],
      [6, 12, 12, 12, 10],
      [7, 8, 9, 6, 7],
    ]);
  });
  document.getElementById('fsFeatAll')?.addEventListener('click', () => {
    applyFeaturesToFsOverlay(CHEAT_FEATURE_NAMES);
  });
  document.getElementById('fsFeatNone')?.addEventListener('click', () => {
    applyFeaturesToFsOverlay([]);
  });
  window.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
      e.preventDefault();
      openCheatPanel();
      return;
    }
    if (
      e.key === 'c' &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.shiftKey &&
      !/^(input|textarea|select)$/i.test(e.target?.tagName || '') &&
      !e.target?.isContentEditable
    ) {
      openCheatPanel();
    }
  });
}

// NOTE: bindCheatPanelEvents() + initCheatPanel() are invoked from src/main.js
// (entry) — keep them there so the keyboard listeners are always registered.
