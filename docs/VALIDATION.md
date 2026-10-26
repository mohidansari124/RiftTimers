# Validation — 26 October 2026

## Passed

- Strict TypeScript checks across desktop, shared and server packages.
- 15 automated tests across the cooldown engine and real Socket.IO connections: haste, expiry, concurrent timers, reset/ready, adjustments, bounded undo, lineup reset, disabled live mode, insecure-server rejection, Smite cast lockout, room creation/joining, synchronization, stale-revision conflicts, duplicate-event handling, reconnect/state recovery, malformed events, heartbeat clock, rate limiting, leaving/presence and room expiration.
- Production renderer, Electron main/preload and server builds.
- Electron desktop smoke test while League was not running: dashboard render, timer start, separate transparent overlay, bidirectional overlay/main IPC and navigation to champion/overlay settings. Screenshots are under `test-results/` (generated, ignored by Git).
- Two full desktop instances created/joined the same room. The subsequent UI timer test was correctly blocked because League of Legends started running during validation. Server-level two-client timer synchronization and reverse reset passed independently.
- Packaged `release/win-unpacked/RiftTimers.exe` launches with the bundled renderer and assets. With League running, timer buttons and overlay opening are disabled as intended.
- NSIS Windows x64 installer generated successfully with application icon, shortcut and uninstall configuration.

## Not verified here

- Installer wizard installation/uninstallation on a clean Windows machine; only its build and unpacked executable launch were verified.
- Full two-Electron timer smoke test after League started (the guard was not bypassed).
- Remote Internet hosting, two physical computers, Windows startup behavior, all hotkey collisions, multi-monitor rearrangement, or long-duration memory/CPU benchmarks.
- Code signing, published updates, Riot approval/registration, and live-match integration are not supplied.

The test scripts are included so remaining desktop scenarios can be repeated when League is closed. No game process was stopped or modified to make tests pass.
