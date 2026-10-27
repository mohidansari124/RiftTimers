# Validation — v0.1.2, 26 October 2026

## Passed

- Strict TypeScript checks across desktop, shared and server packages.
- 23 automated tests: cooldowns, haste, expiry, reset/undo, simultaneous timers, schema validation, private rooms, reconnects, synchronization, deduplication, rate limits, expiration, automatic-import leadership/failover, localized champion/spell mapping, upgraded Smite/Teleport, unsupported/incomplete rosters, unknown identity, game-time rollback, unchanged timer preservation and settings migration.
- Real HTTPS reads from Riot’s local game API using its published CA certificate. The running match supplied ten players; the mapper selected five opponents and correctly resolved both spell slots.
- Electron end-to-end test against that live data: rendered champion portraits and both spell slots match the imported roster. A manually started timer survives repeated API refreshes.
- Overlay remains visible and marked always-on-top; the larger header has a native drag region, lock/unlock changes native movable state, and Center moves it to the current display. Screenshot: `test-results/overlay-v012.png` (generated, ignored by Git).
- Production renderer, Electron main/preload and server builds.
- Final packaged v0.1.2 passed the same live-game lineup/overlay smoke test, and the NSIS installer was generated successfully. Two separate Electron clients also passed room creation/joining, shared timer start and reverse-direction reset with fixture lineups.

## Limits of verification

- No claim of Riot approval or registration is made.
- The test reads the running game’s documented API without changing League. It verifies native window flags and visibility, not actual pixel ordering over League’s focused fullscreen rendering. Use Borderless mode if exclusive fullscreen covers the overlay.
- Physical pointer dragging, installer wizard installation/uninstallation on a clean Windows machine, remote hosting, two physical computers, Windows startup, every hotkey collision and long-running performance benchmarks were not verified here.
- Game-start reset and reconnect behavior were exercised with fixtures; the real game was already running when read.

The repeatable `scripts/game-overlay-smoke.mjs` needs a running Summoner’s Rift game with five opponents. Add `--packaged` to exercise the packaged executable. Fixture-based smoke tests temporarily disable automatic setup and restore the prior setting afterward. No game process was stopped, injected into, or modified to make a test pass.
