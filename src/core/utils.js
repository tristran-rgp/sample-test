// src/core/utils.js — extracted from main.js
import { state } from './state.js';
import { SYMBOLS } from '../game/config.js';

export function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
export function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function fmtBalance(n) {
  // VND: grouping hàng nghìn, luôn 2 số thập phân + ₫
  const fixed = Number(n || 0).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const sign = intPart.startsWith('-') ? '-' : '';
  const digits = sign ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + grouped + '.' + decPart + ' ₫';
}
export function fmt(n) { return fmtBalance(n); }
/**
 * Pay mult theo of-a-kind (3/4/5).
 * Client SYMBOLS[k].pays = [0, 0, p3, p4, p5]  → index = length - 1
 * (tooltip cũng slice(2) map thành "3:","4:","5:").
 * Không dùng pays[length] — với length=5 sẽ ra undefined.
 */
export function getSymbolPayMult(sym, length) {
  const pays = SYMBOLS[sym]?.pays;
  if (!pays || length < 3) return 0;
  const v = pays[length - 1];
  return Number(v) || 0;
}
export function sleep(ms) { return new Promise(r => setTimeout(r, state.fastSpin ? ms * 0.3 : ms)); }
export function sleepRaw(ms) { return new Promise(r => setTimeout(r, ms)); }
export function genTxnId() { return 'TXN' + Date.now().toString(36).toUpperCase() + randInt(100,999); }
export function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5);
}
