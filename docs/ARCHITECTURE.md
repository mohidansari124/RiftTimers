# Architecture

`packages/shared` contains the versioned static catalog, strict Zod schemas, settings, default lineup, immutable cooldown engine, and shared wire types. `apps/server` owns room state; `apps/desktop` contains the React/Zustand renderer and isolated Electron main/preload processes.

## Time and conflicts

Timers store expiration timestamps and original durations, never decrementing counters. Local presentation uses a `performance.now()`-anchored clock, so wall-clock changes do not change a local countdown. Only active spell components tick, at 10 Hz, and stop at expiry. A ready timer is derived from its deadline; no expiry event is required.

Room mutations execute serially on the Node event loop. Every command supplies a UUID and expected revision. A stale revision is rejected rather than overwriting a newer action. The server computes deadlines and ignores client-supplied time. The client estimates server time using a round-trip midpoint clock sample on connection and every 30 seconds. Network jitter can cause small display differences; this is not a hard real-time system. Snapshots are sent on mutations/presence changes rather than on every countdown tick. Reconnect restores the full authoritative snapshot.

The server retains the last 2,000 event IDs per room for bounded retry deduplication. Older retries still carry stale revisions and are rejected. Undo is per spell, retaining 20 previous states; it can undo another participant's most recent action. Original deadlines are preserved. Changing a lineup resets all timers and histories. `reset` and `ready` both clear a timer; clicking starts a fresh full cooldown.

## Room lifetime

Six-character invitation codes use `crypto.randomInt` over 32 symbols; codes are bearer invitations, not passwords. UUID resume tokens are returned only to their owner and kept in that window's session storage. Participant IDs are distinct from resume tokens. No token is broadcast. Room limits are 10 identities and 1,000 rooms per process. Rooms expire after two hours without room mutations/entry, swept every minute. Disconnected identities remain resumable until expiry.

Rooms are in memory. Temporary network disconnections recover; **server restarts do not**. The server is a single-process prototype: do not run multiple replicas without implementing a shared room store and Socket.IO adapter. Offline edits are blocked, and leaving a room starts a fresh local simulation.

## Desktop trust boundaries

Context isolation, sandboxed renderers, disabled Node integration, restrictive CSP, navigation blocking, permission denial and an allowlisted preload bridge limit renderer capabilities. Main IPC verifies the sender/frame and validates settings/commands. No arbitrary filesystem, shell or generic IPC interface is exposed. The overlay cannot save settings or publish authoritative state: it forwards validated commands to the main window.

Settings use electron-store, presets use local storage, overlay bounds are saved with debouncing, and restored bounds are checked against attached displays. Debug output logs only revision/status to the local developer console. There is no analytics or log upload. Current timers are session-only; presets persist explicitly.

The main window remains alive when minimized to the tray so it can maintain room connectivity. Hidden/expired timers do not generate network ticks. Static assets are bundled to avoid runtime CDN requests. Maximum overlay scaling may require manually enlarging its resizable window.
