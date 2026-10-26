# Riot policy review — 26 October 2026

RiftTimers is an independent desktop **simulation and testing prototype**. It is not Riot-approved and must not be used to track enemy cooldowns in live matches or competitive play.

## Authoritative sources

- [Riot patch 25.17 notes, 26 August 2025](https://www.leagueoflegends.com/en-sg/news/game-updates/patch-25-17-notes/), “Death Recap and Summoner Spell Tracking”: Riot describes removing third-party summoner tracking and updating its third-party policy.
- [Riot Developer Portal: game integrity, registration, static data and client APIs](https://developer.riotgames.com/docs/lol). Technical API availability is not permission to ship a particular gameplay feature. Products serving players must be registered with Riot.
- [Riot: third-party applications](https://support.riotgames.com/en-us/riot/events/third-party-applications).
- [Riot: game memory access removed](https://support.riotgames.com/en-us/riot/performance/game-memory-access-removed-for-third-party-apps).

## Implemented boundaries

- `LIVE_MATCH_ENABLED` is a compile-time `false`, with no user switch or environment override. The isolated game adapter throws instead of connecting to League.
- Room admission requires `mode: simulation`; there is no live event type or live API adapter.
- The desktop process checks the Windows process list every three seconds for `League of Legends.exe`. Detection, or a failed check, hides the overlay and blocks timer actions. Only the process name is checked: no process memory, injection, protected files, Vanguard interaction, or undocumented Riot endpoint.
- The process check is a local misuse guard, **not** proof of approval, a security boundary, or a guarantee against all possible competitive use. A remote participant cannot establish another person's game status. Users must restrict all sessions to standalone testing. Browser development previews lack the Windows process guard and are development-only.
- No Riot accounts, API keys, live game information, credentials, match history, or telemetry are collected.

## API investigation

Data Dragon supplies documented champion names, icons, portraits and summoner definitions. All 173 champions and the nine CLASSIC-mode spells from patch 16.21.1 are bundled offline. The catalog records its source and retrieval time. `pnpm data` refreshes definitions and assets together; rebuilding updates both client and server.

Riot documents a local Game Client API, including Live Client Data and event information. The League Client API has different support guarantees. Spectator endpoints concern active games and require an approved API-key deployment. None is connected here, because permitted technical access would not authorize cooldown tracking. Manual selection is the fallback.

## Accuracy and limitations

Base seconds come directly from Riot's `summoner.json`. Data Dragon does not fully represent every dynamic mechanic or necessarily match every regional live patch. Haste defaults to unknown and is displayed as an estimate. Smite uses the catalog's 15-second cast lockout without applying haste; it does not model charge recharge. Smite charges/recharge and Teleport transformations/level-dependent cooldowns are intentionally always estimates; this prototype does not model charge inventories or upgrades. Users may manually adjust the simulated deadline. `~` marks an estimated active timer.

Before any future live feature: obtain explicit written approval for that exact feature, review current policies again, add an approved adapter, and retain manual fallback. Do not enable a flag merely because an endpoint works. Public distribution also requires appropriate Riot registration; no such registration or endorsement is claimed here.
