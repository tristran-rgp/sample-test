// Faithful DOM: inject the REAL index.html body so every element exists
// exactly like production (initUI, cheat panel, docks all find their nodes).
import { readFileSync } from 'node:fs';
import { beforeEach } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const bodyHtml = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? '';

beforeEach(() => {
  document.body.innerHTML = bodyHtml;
  // happy-dom never fires Image onload → asset preload would hang forever.
  // Fake it: resolve instantly so splash/preload flows behave like a browser.
  window.Image = class {
    set src(v) { this._src = v; queueMicrotask(() => this.onload?.()); }
    get src() { return this._src; }
  };
  if (!window.AudioContext) {
    window.AudioContext = class {
      constructor() { this.state = 'running'; this.destination = {}; this.currentTime = 0; this.sampleRate = 22050; }
      resume() { return Promise.resolve(); }
      createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }; }
      createOscillator() { return { type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
      createBiquadFilter() { return { type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { value: 0 }, connect() {} }; }
      createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
      createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {} }; }
    };
  }
});
