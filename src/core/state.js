// src/core/state.js — extracted from main.js
import { DEFAULT_SYMBOL_PACK } from '../game/config.js';

// ─── State ───────────────────────────────────────────────────
export const state = {
  balance: 10000,
  /** Số dư chụp lúc bắt đầu spin (trước debit/win) — giữ đến spin kế */
  balanceBefore: 10000,
  bet: 1.00,
  betIdx: 4,
  spinning: false,
  fxPlaying: false, // true khi đang diễn FX — chặn spin kế (auto/FS)
  fastSpin: false,
  /** Khi bật: mỗi feature pause 1 nhịp hiện chữ giải thích sẽ làm gì */
  featureExplain: false,
  autoSpins: 0,
  sound: true,
  music: true,
  /** Art pack id: classic | artNew — paths live on SYMBOLS[k].img */
  symbolPack: DEFAULT_SYMBOL_PACK,
  grid: [],
  cellMeta: [],
  lastWin: 0,
  /** Breakdown win spin vừa rồi (panel giải thích) */
  lastSpinExplain: null,
  /**
   * Frame WS IN gần nhất cho SPIN/BUY (cmd 1500/1501).
   * Panel giải thích win **bắt buộc** parse từ đây — không suy từ UI local.
   * Shape: { t, cmd, frame, payload, balanceBefore }
   */
  lastInSpin: null,
  sessionWin: 0,
  // Free spins
  inFreeSpins: false,
  fsRemaining: 0,
  fsTotal: 0,
  fsActiveFeatures: [],
  fsSessionWin: 0,
    fsBet: 0,
  // Buy features
  scatterBooster: false,
  buy3Features: false,
  buy12Features: false,
  extraFee: 0,
  // History
  history: [],
  txnId: null,
  // Active features this spin
  triggeredFeatures: [],
  /** Spin vừa rồi — bấm badge để replay VFX từng feature */
  lastFeatureReplay: null,
  lastJackpotActive: false,
  blockedSymbols: [],
  globalMultiplier: 1,
  bypassProtocol: false,
  persistentFeatures: [],
};

/** Runtime VFX control (skip remaining feature animations) */
export let _vfxSkipAll = false;
export let _vfxAnimCancel = null;
export let _explainContinueResolve = null;

export let ws = null;
export let accessToken = '';
export let online = false;
export let wsSessionId = '';
/** Session identity for REST cheat / wsInit — filled from login, host, or server payloads */
export let sessionAgencyId = '';
export let sessionUserId = '';
export let sessionUsername = '';
export let pendingSpinResolve = null;
export let pendingSpinData = null;
/** cmd string → { resolve, timer } for non-spin request/response (1502/1504–1507) */
export let pendingCmdWaiters = {};
/** Active sessions from cmd 1998 — target pool for cross-user cheat (REST only) */
export let activeSessionsCache = [];
/** Selected cheat target session (null = self / current login) */
export let cheatTargetSession = null;
export let onlineBalance = 0;
export let spinQueue = [];
export let pingSeq = 0;
export let pingTimer = null;
export let reconnectTimer = null;
/** true while closing WS on purpose (force logout / disconnect) — avoid treating as error */
export let intentionalWsClose = false;

/**
 * Fail any in-flight spin / cmd waiters so promises do not hang after logout.
 */

// ── cross-module setters (mutable shared state) ──
export function setPendingSpinResolve(v) { pendingSpinResolve = v; }
export function setPendingSpinData(v) { pendingSpinData = v; }
export function setSpinQueue(v) { spinQueue = v; }
export function setIntentionalWsClose(v) { intentionalWsClose = v; }
export function setOnline(v) { online = v; }
export function set_vfxSkipAll(v) { _vfxSkipAll = v; }
export function set_explainContinueResolve(v) { _explainContinueResolve = v; }
export function setPingTimer(v) { pingTimer = v; }
export function setReconnectTimer(v) { reconnectTimer = v; }
export function setWs(v) { ws = v; }
export function setAccessToken(v) { accessToken = v; }
export function setWsSessionId(v) { wsSessionId = v; }
export function setSessionAgencyId(v) { sessionAgencyId = v; }
export function setSessionUserId(v) { sessionUserId = v; }
export function setOnlineBalance(v) { onlineBalance = v; }
export function set_vfxAnimCancel(v) { _vfxAnimCancel = v; }
export function setSessionUsername(v) { sessionUsername = v; }
export function setPingSeq(v) { pingSeq = v; }
export function setActiveSessionsCache(v) { activeSessionsCache = v; }
// manual: multi-line assignment in cheat/events.js was skipped by the codemod
export function setCheatTargetSession(v) { cheatTargetSession = v; }
