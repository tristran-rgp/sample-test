# PR: fix/ui-p0-polish

P0 UI polish + P1 hotkeys/a11y. No math/RTP/spin/WS protocol changes.

## Summary
- Cleared hardcoded username/password/debug-token HTML defaults; empty prefs + placeholders.
- localStorage prefs: zd_srvUrl, zd_loginUser, zd_wsUrl, zd_gameId (no password).
- Modal stack + Escape + focus trap + toast live region in feedback.js.
- Currency unified to dollar; fmtBalance uses 7-digit pad + 2 decimals.
- Space/Enter moved to src/ui/hotkeys.js; aria-pressed on fast/auto/sound.

## Files
index.html main.js utils.js feedback.js hotkeys.js panel.js initUI.js fsAuto.js hud-layout.test.js

## Tests
53 passed (7 files).

## Risks
- Empty connection fields until prefs restored or typed.
- transport.js code fallback for empty debug token remains.
- Simple focus trap; balance pad grows past 7 digits if needed.
