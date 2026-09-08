// src/ui/feedback.js — extracted from main.js
const modalStack = [];

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusablesIn(el) {
  return [...el.querySelectorAll(FOCUSABLE)].filter(
    (n) => n.offsetParent !== null || n === document.activeElement
  );
}

export function showToast(msg, color = 'var(--cyan)') {
  const el = document.getElementById('featToast');
  if (!el) return;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.textContent = msg;
  el.style.borderColor = color;
  el.style.color = color;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!el.classList.contains('open')) {
    el._zdPrevFocus = document.activeElement;
    modalStack.push(id);
  }
  el.classList.add('open');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  const nodes = focusablesIn(el);
  (nodes[0] || el).focus?.();
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const wasOpen = el.classList.contains('open');
  el.classList.remove('open');
  el.removeAttribute('role');
  el.removeAttribute('aria-modal');
  const idx = modalStack.lastIndexOf(id);
  if (idx >= 0) modalStack.splice(idx, 1);
  if (wasOpen) {
    const prev = el._zdPrevFocus;
    delete el._zdPrevFocus;
    if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
      prev.focus();
    }
  }
}

function topOpenModal() {
  while (modalStack.length) {
    const id = modalStack[modalStack.length - 1];
    const el = document.getElementById(id);
    if (el && el.classList.contains('open')) return el;
    modalStack.pop();
  }
  const open = document.querySelectorAll('.modal-overlay.open');
  return open.length ? open[open.length - 1] : null;
}

if (typeof window !== 'undefined' && !window.__zdModalA11yBound) {
  window.__zdModalA11yBound = true;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const top = topOpenModal();
      if (!top?.id) return;
      e.preventDefault();
      closeModal(top.id);
      return;
    }
    if (e.key !== 'Tab') return;
    const top = topOpenModal();
    if (!top) return;
    const nodes = focusablesIn(top);
    if (!nodes.length) {
      e.preventDefault();
      top.focus?.();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first || !top.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last || !top.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  });
}
