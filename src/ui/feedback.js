// src/ui/feedback.js — extracted from main.js
export function showToast(msg, color = 'var(--cyan)') {
  const el = document.getElementById('featToast');
  el.textContent = msg;
  el.style.borderColor = color;
  el.style.color = color;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

export function openModal(id) { document.getElementById(id).classList.add('open'); }
export function closeModal(id) { document.getElementById(id).classList.remove('open'); }
