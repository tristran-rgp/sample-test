// src/ui/hotkeys.js — Space / Enter game + login shortcuts (cheat C stays in cheat module)
import { applyFsGridAndSpin, isFsGridEditorOpen } from './cheat/fsEditor.js';

function isLoginVisible() {
  const el = document.getElementById('loginOverlay');
  return !!(el && el.style.display !== 'none');
}

function isTypingTarget(el) {
  if (!el || el === document.body || el === document.documentElement) return false;
  const tag = (el.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export function bindHotkeys() {
  if (bindHotkeys._done) return;
  bindHotkeys._done = true;

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Enter') {
      if (!isLoginVisible()) return;
      if (e.target && e.target.id === 'btnPlayOffline') return;
      if (e.target && e.target.id === 'btnPlayOnline') return;
      const btn = document.getElementById('btnPlayOnline');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      btn.click();
      return;
    }

    if (e.key === ' ' || e.code === 'Space') {
      if (isLoginVisible()) return;
      if (isTypingTarget(e.target)) return;
      const splash = document.getElementById('splash');
      if (splash && !splash.classList.contains('hidden')) return;
      if (isFsGridEditorOpen()) {
        e.preventDefault();
        applyFsGridAndSpin();
        return;
      }
      if (document.querySelector('.modal-overlay.open')) return;
      const btn = document.getElementById('btnSpin');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      btn.click();
    }
  });
}
