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

## Automatic lineup (v0.1.2)

The main process polls only three fixed HTTPS endpoints on `127.0.0.1:2999`: `activeplayer`, `playerlist`, and `gamestats`. Riot's bundled public root certificate validates TLS; there is no global certificate bypass or arbitrary request IPC. Each request has a two-second timeout and a 512 KiB response cap. A five-second delay follows each batch; batches cannot overlap. Turning off automatic setup stops API reads.

The parser identifies the active player's team and requires five opponents on map 11. Raw internal names resolve localized champions/spells; Smite and Teleport variants normalize to their catalog definitions. Unknown or incomplete data produces a visible status and preserves the current lineup. Player identities are used transiently for team selection and are not sent to rooms or saved.

The tracker emits new import sequences only when the lineup/spells change or game time rolls back by more than 15 seconds. Starting midgame or reconnecting does not reset timers; a fresh game clears timers. Imports preserve unchanged slot timers and known haste; changed champions/spells clear only affected slots. Detection requires a prior sample to distinguish a same-roster new game from reconnect, except for initial readings under 60 seconds.

Shared rooms permit automatic import only from the first online participant in room order. The server enforces this, including failover when that participant leaves. Imported lineup updates use the same revision checks and broadcasts as manual actions. The existing `simulation` room mode string is a protocol label, not a restriction on where imported lineup data originated.

The overlay uses `screen-saver` topmost priority and refreshes its z-order every two seconds while visible without requesting focus. Header and footer are native draggable regions; the lock button is explicitly non-draggable. Restricted overlay controls support lock/unlock, centering and raising the window. These desktop-window techniques do not guarantee visibility over exclusive fullscreen rendering; use Borderless mode. No injection or game-window modification is performed.
