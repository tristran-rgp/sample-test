// src/sfx/sfx.js — extracted from main.js
import { state } from '../core/state.js';
import { isVfxSkip } from '../ui/vfx/core.js';

// ─── SFX — WebAudio synth (không cần file MP3) ────────────────
// Tôn trọng state.sound. Spin ticks luôn phát; VFX skip chỉ chặn feature SFX.
export const SFX_VOL = 1.45; // master loudness (1 = baseline)
export let _audioCtx = null;
export let _lastSpinTickAt = 0;

export function getAudioCtx() {
  if (!state.sound) return null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!_audioCtx) _audioCtx = new AC();
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => {});
    }
    return _audioCtx;
  } catch (_) {
    return null;
  }
}

/** Đảm bảo browser cho phép audio sau gesture (click spin / sound) */
export function unlockAudio() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start(0);
  } catch (_) { /* ignore */ }
}

/**
 * @param {string} type
 * @param {{gain?: number, pitch?: number, force?: boolean}} [opts]
 * force=true: vẫn phát khi đang skip VFX (dùng cho spin tick/land)
 */
export function sfx(type, opts = {}) {
  if (!state.sound) return;
  if (!opts.force && typeof isVfxSkip === 'function' && isVfxSkip()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const gMul = (opts.gain != null ? opts.gain : 1) * SFX_VOL;
  const pitch = opts.pitch != null ? opts.pitch : 1;

  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(ctx.destination);

  const tone = (freq, typeOsc, t0, dur, peak, end = 0.0001) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = typeOsc;
    o.frequency.setValueAtTime(freq * pitch, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * gMul), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(end, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  };

  const noiseBurst = (t0, dur, peak, hpFreq = 800, lpFreq = 0) => {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = hpFreq;
    let node = hp;
    src.connect(hp);
    if (lpFreq > 0) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lpFreq;
      hp.connect(lp);
      node = lp;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * gMul), t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  };

  let hold = 0.9;
  switch (type) {
    case 'whoosh':
      noiseBurst(now, 0.22, 0.18, 400);
      tone(420, 'triangle', now, 0.2, 0.06);
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(680 * pitch, now);
        o.frequency.exponentialRampToValueAtTime(180 * pitch, now + 0.2);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.07 * gMul, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        o.connect(g);
        g.connect(master);
        o.start(now);
        o.stop(now + 0.25);
      } catch (_) {}
      hold = 0.35;
      break;
    case 'hit':
      noiseBurst(now, 0.08, 0.22, 600);
      tone(180, 'square', now, 0.09, 0.1);
      tone(90, 'sine', now, 0.12, 0.12);
      hold = 0.25;
      break;
    case 'charge':
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(120 * pitch, now);
        o.frequency.exponentialRampToValueAtTime(520 * pitch, now + 0.38);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.05 * gMul, now + 0.08);
        g.gain.linearRampToValueAtTime(0.08 * gMul, now + 0.3);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(400, now);
        f.frequency.exponentialRampToValueAtTime(2400, now + 0.38);
        o.connect(f);
        f.connect(g);
        g.connect(master);
        o.start(now);
        o.stop(now + 0.45);
      } catch (_) {
        tone(200, 'sawtooth', now, 0.35, 0.06);
      }
      hold = 0.5;
      break;
    case 'blip':
      tone(880, 'sine', now, 0.06, 0.07);
      tone(1320, 'sine', now + 0.04, 0.05, 0.04);
      hold = 0.15;
      break;
    case 'tick':
      // Tạch ngắn — mechanical reel click
      noiseBurst(now, 0.018, 0.14, 1200, 6000);
      tone(1800 + Math.random() * 400, 'square', now, 0.018, 0.045);
      tone(900, 'triangle', now, 0.022, 0.025);
      hold = 0.06;
      break;
    case 'land':
      // Thud khi reel dừng
      noiseBurst(now, 0.05, 0.16, 200, 1800);
      tone(140 * pitch, 'sine', now, 0.07, 0.1);
      tone(70 * pitch, 'triangle', now, 0.09, 0.08);
      tone(220 * pitch, 'square', now, 0.035, 0.04);
      hold = 0.15;
      break;
    case 'spinStart':
      noiseBurst(now, 0.12, 0.12, 500);
      tone(300, 'sawtooth', now, 0.1, 0.04);
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(200 * pitch, now);
        o.frequency.exponentialRampToValueAtTime(480 * pitch, now + 0.14);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.06 * gMul, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        o.connect(g);
        g.connect(master);
        o.start(now);
        o.stop(now + 0.18);
      } catch (_) {}
      hold = 0.25;
      break;
    case 'coin':
      // Tiền / way win nhỏ
      tone(1200 * pitch, 'sine', now, 0.05, 0.06);
      tone(1600 * pitch, 'sine', now + 0.04, 0.07, 0.05);
      tone(2000 * pitch, 'triangle', now + 0.08, 0.08, 0.035);
      hold = 0.2;
      break;
    case 'win':
      tone(523.25, 'sine', now, 0.12, 0.1);
      tone(659.25, 'sine', now + 0.08, 0.12, 0.09);
      tone(783.99, 'sine', now + 0.16, 0.18, 0.11);
      tone(1046.5, 'sine', now + 0.28, 0.28, 0.09);
      noiseBurst(now + 0.05, 0.08, 0.06, 400);
      hold = 0.7;
      break;
    case 'bigwin':
      tone(392, 'triangle', now, 0.12, 0.1);
      tone(523, 'triangle', now + 0.1, 0.14, 0.1);
      tone(659, 'sine', now + 0.22, 0.16, 0.11);
      tone(784, 'sine', now + 0.36, 0.2, 0.1);
      tone(1046, 'sine', now + 0.5, 0.28, 0.09);
      noiseBurst(now + 0.12, 0.12, 0.1, 300);
      hold = 1.0;
      break;
    case 'jackpot':
      tone(392, 'triangle', now, 0.15, 0.12);
      tone(523, 'triangle', now + 0.1, 0.15, 0.11);
      tone(659, 'triangle', now + 0.2, 0.2, 0.13);
      tone(784, 'sine', now + 0.35, 0.35, 0.11);
      tone(1175, 'sine', now + 0.5, 0.4, 0.08);
      noiseBurst(now + 0.1, 0.18, 0.14, 300);
      hold = 1.1;
      break;
    case 'laser':
      // Decrypt / scan
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(1400 * pitch, now);
        o.frequency.exponentialRampToValueAtTime(280 * pitch, now + 0.22);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.07 * gMul, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1200;
        f.Q.value = 4;
        o.connect(f);
        f.connect(g);
        g.connect(master);
        o.start(now);
        o.stop(now + 0.26);
      } catch (_) {
        tone(900, 'sawtooth', now, 0.2, 0.06);
      }
      noiseBurst(now, 0.1, 0.08, 900);
      hold = 0.3;
      break;
    case 'zap':
      // Surge / power
      noiseBurst(now, 0.06, 0.2, 800);
      tone(80, 'sawtooth', now, 0.08, 0.1);
      tone(400, 'square', now, 0.05, 0.07);
      tone(1200, 'square', now + 0.03, 0.04, 0.05);
      hold = 0.2;
      break;
    case 'fire':
      // Firewall
      noiseBurst(now, 0.18, 0.16, 200, 2400);
      tone(90, 'sawtooth', now, 0.15, 0.07);
      tone(160, 'triangle', now + 0.04, 0.12, 0.05);
      hold = 0.3;
      break;
    case 'glitch':
      noiseBurst(now, 0.05, 0.14, 1000);
      tone(300 + Math.random() * 800, 'square', now, 0.04, 0.07);
      tone(200 + Math.random() * 600, 'sawtooth', now + 0.03, 0.05, 0.05);
      tone(900, 'square', now + 0.06, 0.03, 0.04);
      hold = 0.18;
      break;
    case 'reveal':
      // Trojan mystery open
      tone(300, 'sine', now, 0.08, 0.06);
      tone(450, 'sine', now + 0.06, 0.08, 0.07);
      tone(600, 'triangle', now + 0.12, 0.12, 0.08);
      tone(900, 'sine', now + 0.2, 0.15, 0.06);
      noiseBurst(now + 0.1, 0.08, 0.08, 500);
      hold = 0.45;
      break;
    case 'matrix':
      // Root / cloning
      for (let i = 0; i < 5; i++) {
        tone(600 + i * 180, 'square', now + i * 0.035, 0.04, 0.035);
      }
      noiseBurst(now, 0.12, 0.06, 1500);
      hold = 0.3;
      break;
    case 'radar':
      // Algorithmic scan
      tone(440, 'sine', now, 0.06, 0.05);
      tone(660, 'sine', now + 0.08, 0.06, 0.05);
      tone(880, 'sine', now + 0.16, 0.08, 0.06);
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(200 * pitch, now);
        o.frequency.linearRampToValueAtTime(900 * pitch, now + 0.28);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.04 * gMul, now + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        o.connect(g);
        g.connect(master);
        o.start(now);
        o.stop(now + 0.32);
      } catch (_) {}
      hold = 0.4;
      break;
    case 'flow':
      // Bypass both-ways
      tone(330, 'triangle', now, 0.1, 0.05);
      tone(440, 'triangle', now + 0.05, 0.1, 0.05);
      tone(550, 'sine', now + 0.12, 0.14, 0.06);
      tone(440, 'triangle', now + 0.18, 0.1, 0.04);
      tone(330, 'triangle', now + 0.24, 0.12, 0.04);
      hold = 0.45;
      break;
    case 'boost':
      // Bandwidth / overclock
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(100 * pitch, now);
        o.frequency.exponentialRampToValueAtTime(800 * pitch, now + 0.32);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.07 * gMul, now + 0.1);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(300, now);
        f.frequency.exponentialRampToValueAtTime(3200, now + 0.32);
        o.connect(f);
        f.connect(g);
        g.connect(master);
        o.start(now);
        o.stop(now + 0.4);
      } catch (_) {
        tone(200, 'sawtooth', now, 0.3, 0.06);
      }
      hold = 0.45;
      break;
    case 'expand':
      // Overload wild expand
      tone(180, 'sine', now, 0.1, 0.07);
      tone(240, 'triangle', now + 0.06, 0.12, 0.07);
      tone(360, 'sine', now + 0.14, 0.16, 0.08);
      noiseBurst(now + 0.08, 0.1, 0.08, 400);
      hold = 0.4;
      break;
    default:
      tone(440, 'sine', now, 0.08, 0.05);
      hold = 0.15;
  }

  master.gain.setValueAtTime(1, now);
  master.gain.setValueAtTime(1, now + Math.max(0.05, hold * 0.7));
  master.gain.exponentialRampToValueAtTime(0.0001, now + hold + 0.05);
}

/** Tick tạch-tạch khi reel đang quay (throttle theo ms). */
export function sfxSpinTick(elapsedMs, fast) {
  if (!state.sound) return;
  const interval = fast ? 48 : 68;
  if (elapsedMs - _lastSpinTickAt < interval) return;
  _lastSpinTickAt = elapsedMs;
  // pitch hơi lệch mỗi tick → sống động
  const p = 0.88 + Math.random() * 0.28;
  sfx('tick', { gain: fast ? 0.42 : 0.5, pitch: p, force: true });
}

export function sfxReelLand(reelIndex = 0) {
  sfx('land', {
    gain: 0.78,
    pitch: 0.92 + reelIndex * 0.06,
    force: true,
  });
}

/** Map feature → SFX khi bắt đầu scene */
export function sfxForFeatureStart(featId) {
  const map = {
    firewall: 'fire',
    decrypt: 'laser',
    trojan: 'reveal',
    overload: 'expand',
    overclock: 'boost',
    cloning: 'matrix',
    root: 'matrix',
    surge: 'zap',
    glitch: 'glitch',
    scan: 'radar',
    bandwidth: 'boost',
    bypass: 'flow',
  };
  sfx(map[featId] || 'charge', { gain: 1.15, force: true });
}

/** Map feature → SFX khi kết scene / hit */
export function sfxForFeatureHit(featId) {
  const map = {
    firewall: 'hit',
    decrypt: 'blip',
    trojan: 'hit',
    overload: 'hit',
    overclock: 'coin',
    cloning: 'blip',
    root: 'hit',
    surge: 'zap',
    glitch: 'glitch',
    scan: 'hit',
    bandwidth: 'coin',
    bypass: 'blip',
  };
  sfx(map[featId] || 'hit', { gain: 1.1, force: true });
}

// ── cross-module setters (mutable shared state) ──
export function set_lastSpinTickAt(v) { _lastSpinTickAt = v; }
