import { describe, it, expect } from "vitest";
import { readGameLineup, GameTracker } from "../packages/shared/src/game-data";
import {
  initialState,
  applyCommand,
  defaultLineup,
  settingsSchema,
  defaultSettings,
} from "../packages/shared/src/index";
function spell(id: string) {
  return {
    displayName: "Localized",
    rawDisplayName: `GeneratedTip_SummonerSpell_${id}_DisplayName`,
  };
}
export function fixture(time = 20) {
  const rows = defaultLineup();
  return {
    activePlayer: { riotId: "Local#TEST" },
    gameData: { gameTime: time, mapNumber: 11 },
    allPlayers: [
      {
        riotId: "Local#TEST",
        championName: "Annie",
        team: "ORDER",
        summonerSpells: {
          summonerSpellOne: spell("SummonerFlash"),
          summonerSpellTwo: spell("SummonerDot"),
        },
      },
      ...rows.map((r, i) => ({
        riotId: `Enemy${i}#TEST`,
        championName: "Localized",
        rawChampionName: `game_character_displayname_${r.champion}`,
        team: "CHAOS",
        position: ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"][i],
        summonerSpells: {
          summonerSpellOne: spell(r.spells[0]),
          summonerSpellTwo: spell(r.spells[1]),
        },
      })),
    ],
  };
}
describe("automatic game lineup", () => {
  it("maps only opponents, sorting positions and reading raw localized names", () => {
    const raw = fixture();
    raw.allPlayers.reverse();
    expect(readGameLineup(raw).lineup).toEqual(defaultLineup());
  });
  it("normalizes upgraded smite and teleport", () => {
    const raw = fixture();
    raw.allPlayers[1].summonerSpells.summonerSpellOne = spell(
      "S5_SummonerSmitePlayerGanker",
    );
    raw.allPlayers[1].summonerSpells.summonerSpellTwo = spell(
      "SummonerTeleportUpgrade",
    );
    expect(readGameLineup(raw).lineup[0].spells).toEqual([
      "SummonerSmite",
      "SummonerTeleport",
    ]);
  });
  it("rejects incomplete rosters, ambiguous identity, unsupported maps and unknown spells", () => {
    const raw = fixture();
    raw.allPlayers.pop();
    expect(() => readGameLineup(raw)).toThrow("five opponents");
    expect(() =>
      readGameLineup({
        ...fixture(),
        activePlayer: { riotId: "Unknown#TEST" },
      }),
    ).toThrow("identify");
    expect(() =>
      readGameLineup({
        ...fixture(),
        gameData: { mapNumber: 12, gameTime: 10 },
      }),
    ).toThrow();
    const bad = fixture();
    bad.allPlayers[1].summonerSpells.summonerSpellOne = spell("Unknown");
    expect(() => readGameLineup(bad)).toThrow("spell");
  });
  it("retains the same sequence during polling/reconnect, detects spell changes and game time rollback", () => {
    const tracker = new GameTracker();
    const first = tracker.update(fixture());
    expect(first.reset).toBe(true);
    expect(tracker.update(fixture(300)).sequence).toBe(first.sequence);
    expect(() => tracker.update({})).toThrow();
    expect(tracker.update(fixture(310)).sequence).toBe(first.sequence);
    const changed = fixture(320);
    changed.allPlayers[1].summonerSpells.summonerSpellTwo =
      spell("SummonerBarrier");
    expect(tracker.update(changed)).toMatchObject({
      reset: false,
      sequence: 2,
    });
    expect(tracker.update(fixture(10))).toMatchObject({
      reset: true,
      sequence: 3,
    });
  });
  it("starting the app midgame does not ask to reset shared timers", () => {
    expect(new GameTracker().update(fixture(600)).reset).toBe(false);
  });
  it("preserves unchanged cooldowns and haste while clearing only changed spells", () => {
    let s = initialState();
    s.lineup[0].haste = 20;
    s = applyCommand(
      s,
      {
        id: crypto.randomUUID(),
        kind: "start",
        revision: 0,
        row: s.lineup[0].id,
        slot: 0,
      },
      0,
    );
    const timer = Object.values(s.timers)[0];
    const lineup = defaultLineup();
    lineup[0].spells[1] = "SummonerBarrier";
    s = applyCommand(
      s,
      {
        id: crypto.randomUUID(),
        kind: "importLineup",
        revision: 1,
        lineup,
        reset: false,
      },
      10,
    );
    expect(Object.values(s.timers)[0]).toEqual(timer);
    expect(s.lineup[0].haste).toBe(20);
    s = applyCommand(
      s,
      {
        id: crypto.randomUUID(),
        kind: "importLineup",
        revision: 2,
        lineup,
        reset: true,
      },
      20,
    );
    expect(s.timers).toEqual({});
    expect(s.history).toEqual({});
  });
  it("migrates existing saved settings without discarding preferences", () => {
    const { autoLineup, ...old } = defaultSettings;
    expect(settingsSchema.parse({ ...old, opacity: 0.5 })).toMatchObject({
      autoLineup: true,
      opacity: 0.5,
    });
  });
});
