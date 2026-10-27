# RiftTimers

A Windows 11 desktop **standalone summoner-spell simulation prototype** built with Electron, React, TypeScript, Vite, Tailwind, Zustand, electron-store and Socket.IO. Includes five configurable champion rows, transparent overlay, manual timers, private synchronized simulation rooms, persistent settings and an NSIS installer.

Automatic champion/spell setup uses Riot’s documented local game API. Timer starts remain manual. This prototype is not Riot-approved; see the [policy review](docs/COMPLIANCE.md).

## Install and use

Build output is `release/RiftTimers Setup 0.1.2.exe`. Run it to select an installation directory and create desktop/Start menu shortcuts. Node.js is not required on the player's computer. The prototype is unsigned, so Windows may identify the publisher as unknown. A signing certificate and a published update feed are not included.

1. Launch RiftTimers. It can remain open alongside League.
2. Automatic setup is enabled by default in **Champion Setup**. Once a Summoner’s Rift game exposes its local API, the five opponents and both summoner spells load automatically. You can disable this toggle and select champions/spells manually. Blank haste means unknown.
3. Click any spell in the dashboard or overlay to begin a simulation. Right-click to reset, mark ready, adjust seconds or undo. `~` indicates an estimate.
4. Select **Open simulation overlay**. Drag its larger header or bottom grip; use the lock icon to lock/unlock it. **Overlay Settings** also offers **Center overlay on this screen** and **Bring overlay to front**. Default visibility shortcut: `Ctrl+Shift+T`. Use **Borderless** mode in League if exclusive fullscreen covers the overlay.
5. Start a simulation server (below), then create/join a room in **Multiplayer**. All participants need the same server and release. Creating/joining loads the room's lineup; local timers are not uploaded automatically.
6. Closing the main window minimizes to the tray by default. Use the tray **Quit** command to exit, or disable the tray preference.

Manual timers and the overlay remain available while League is open. Automatic setup checks local game data about every five seconds. Routine refreshes preserve timers; a new game resets them. In rooms, the first connected participant supplies the automatic lineup. No spell casts or exact enemy cooldown modifiers are detected.

## Development

Requirements: Windows 11, Node 24 LTS, pnpm 11.25.0. Dependencies are locked in `pnpm-lock.yaml`. Version ranges were initially resolved from current stable registry packages on 26 October 2026.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm dev
```

`pnpm dev` starts Vite, the Socket.IO server and Electron. Browser preview: `http://127.0.0.1:5173`. Vite listens only on loopback. On Windows, stop development processes with Ctrl+C and close remaining app windows if needed.

Run built components separately:

```sh
pnpm --filter @rift/server start
pnpm --filter @rift/desktop exec electron .
pnpm --filter @rift/desktop exec electron . --second-client
```

The second-client flag gives an independent Electron profile for two-player testing. For friends on other computers, deploy a hosted server and enter its HTTPS address under General Settings. See [deployment instructions](docs/DEPLOYMENT.md).

## Build an installer

```sh
pnpm dist
```

Produces the NSIS installer and an unpacked application under `release/`. Installation provides shortcuts and a standard Windows uninstall entry. electron-builder bundles Electron; players do not install Node. Release publishing, code signing, update hosting and automatic updates are not configured. “Check for updates” explains that limitation rather than reporting a fabricated update result.

## Data

Official Riot Data Dragon patch 16.21.1 definitions and assets are cached locally: 173 champions and nine CLASSIC spells. Refresh from Riot with `pnpm data`, review the catalog changes, then rebuild **both** packages. Haste uses `base / (1 + haste / 100)`. Smite charges and Teleport transformations are not modeled exactly; these remain estimates with manual adjustments. See [accuracy notes](docs/COMPLIANCE.md).

## Tests and structure

- `packages/shared`: schema-validated commands, cooldown engine, catalog, settings and wire types.
- `apps/server`: authoritative rooms, revision conflicts, deduplication, rate limits, presence, clock and reconnect recovery.
- `apps/desktop`: React control panel and transparent Electron overlay with restricted IPC.
- `tests`: timer calculations, expiry, undo/reset, malformed events, room creation/joining, two-client sync, reconnect, conflicts and rate limits.
- `scripts/smoke.mjs`: launches built Electron with Playwright, checks timers and bidirectional overlay IPC, captures screenshots.
- `scripts/multiplayer-smoke.mjs`: tests create/join/start/reset through two real Electron interfaces.
- `scripts/game-overlay-smoke.mjs`: with an active Summoner’s Rift game, checks real imported champions/spells, preserved timers, native window properties, and overlay lock/center controls. Add `--packaged` to test the release executable.
- `pnpm --filter @rift/server exec tsx ../../scripts/probe-game.ts`: checks the fixed local API and prints only the mapped enemy champions/spells, not player identities.

For the smoke scripts, set `RIFT_NODE_MODULES` to an absolute directory containing Playwright, then run `node scripts/smoke.mjs` and `node scripts/multiplayer-smoke.mjs`. These scripts launch app windows and use local application profiles. The multiplayer smoke test needs port 3001 free.

See [architecture and reliability limits](docs/ARCHITECTURE.md). Rooms recover after network interruption, but **do not survive server restarts**. There is no provisioned public server, Riot registration or claim of production readiness.

RiftTimers is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
