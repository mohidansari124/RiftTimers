# Riot policy review — 26 October 2026

RiftTimers is an independent desktop **simulation and testing prototype**. It is not Riot-approved and must not be used to track enemy cooldowns in live matches or competitive play.

## Authoritative sources

- [Riot patch 25.17 notes, 26 August 2025](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-25-17-notes/), “Death Recap and Summoner Spell Tracking”: Riot describes removing third-party summoner tracking and updating its third-party policy.
- [Riot Developer Portal: game integrity, registration, static data and client APIs](https://developer.riotgames.com/docs/lol). Technical API availability is not permission to ship a particular gameplay feature. Products serving players must be registered with Riot.
- [Riot: third-party applications](https://support.riotgames.com/en-us/riot/events/third-party-applications).
- [Riot: game memory access removed](https://support.riotgames.com/en-us/riot/performance/game-memory-access-removed-for-third-party-apps).

## Implemented boundaries

- v0.1.2 implements the user-requested automatic champion/spell import through the documented local Live Client Data API. `AUTOMATIC_LINEUP_ENABLED` describes adapter availability; a persisted setting lets users turn polling off. No automatic spell-cast or cooldown detection is implemented.
- Room admission retains `mode: simulation` for protocol compatibility. The first online participant can share imported lineups; this label is not a compliance gate.
- As of v0.1.1, the requested manual timers and desktop overlay remain available while League is open. The application no longer polls the process list or automatically pauses. No process memory, injection, protected files, Vanguard interaction, or undocumented Riot endpoint is used.
- Running alongside League or accessing documented endpoints is not proof of Riot approval. The original disabled-adapter boundary has been superseded by the later explicit request for automatic lineup loading.
- No account credentials, Riot API keys, match history or telemetry are collected. Local player identities are read transiently to identify the player’s team; only champion/spell rows are shared with room members.

## API investigation

Data Dragon supplies documented champion names, icons, portraits and summoner definitions. All 173 champions and the nine CLASSIC-mode spells from patch 16.21.1 are bundled offline. The catalog records its source and retrieval time. `pnpm data` refreshes definitions and assets together; rebuilding updates both client and server.

Riot documents a local Game Client API, including Live Client Data and event information. The League Client API has different support guarantees. Spectator endpoints concern active games and require an approved API-key deployment. Only the documented local active-player, player-list and game-stats endpoints are connected here. Manual selection remains the fallback. Using these documented endpoints does not imply approval for cooldown tracking.

## Accuracy and limitations

Base seconds come directly from Riot's `summoner.json`. Data Dragon does not fully represent every dynamic mechanic or necessarily match every regional live patch. Haste defaults to unknown and is displayed as an estimate. Smite uses the catalog's 15-second cast lockout without applying haste; it does not model charge recharge. Smite charges/recharge and Teleport transformations/level-dependent cooldowns are intentionally always estimates; this prototype does not model charge inventories or upgrades. Users may manually adjust the simulated deadline. `~` marks an estimated active timer.

Before any future live feature: obtain explicit written approval for that exact feature, review current policies again, add an approved adapter, and retain manual fallback. Do not enable a flag merely because an endpoint works. Public distribution also requires appropriate Riot registration; no such registration or endorsement is claimed here.
