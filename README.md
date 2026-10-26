# RiftTimers

A Windows 11 desktop **standalone summoner-spell simulation prototype** built with Electron, React, TypeScript, Vite, Tailwind, Zustand, electron-store and Socket.IO. Includes five configurable champion rows, transparent overlay, manual timers, private synchronized simulation rooms, persistent settings and an NSIS installer.

**Live-match tracking is disabled.** Riot's restrictions apply to manual third-party tracking too. This build is for testing independently of League; it is not Riot-approved. See [policy review](docs/COMPLIANCE.md).

## Install and use

Build output is `release/RiftTimers Setup 0.1.0.exe`. Run it to select an installation directory and create desktop/Start menu shortcuts. Node.js is not required on the player's computer. The prototype is unsigned, so Windows may identify the publisher as unknown. A signing certificate and a published update feed are not included.

1. Launch RiftTimers while League is closed.
2. In **Champion Setup**, search by champion name/ID, select two spells and optionally enter known spell haste. Blank haste means unknown. Move rows with the arrow buttons; save named presets for later.
3. Click any spell in the dashboard or overlay to begin a simulation. Right-click to reset, mark ready, adjust seconds or undo. `~` indicates an estimate.
4. Select **Open simulation overlay**. Drag its header, resize its edges, or change appearance in **Overlay Settings**. Default visibility shortcut: `Ctrl+Shift+T`.
5. Start a simulation server (below), then create/join a room in **Multiplayer**. All participants need the same server and release. Creating/joining loads the room's lineup; local timers are not uploaded automatically.
6. Closing the main window minimizes to the tray by default. Use the tray **Quit** command to exit, or disable the tray preference.

The simulator pauses and hides the overlay if the League game process is detected, or the Windows process check fails. This local guard is not a guarantee against misuse. Do not use browser previews or remote rooms during competitive play.

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

For the smoke scripts, set `RIFT_NODE_MODULES` to an absolute directory containing Playwright, then run `node scripts/smoke.mjs` and `node scripts/multiplayer-smoke.mjs`. These scripts launch app windows and use local application profiles. The multiplayer smoke test needs port 3001 free.

See [architecture and reliability limits](docs/ARCHITECTURE.md). Rooms recover after network interruption, but **do not survive server restarts**. There is no provisioned public server, Riot registration, live integration or claim of production readiness.

RiftTimers is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
