import { z } from "zod";
import { catalog, defaultLineup, type Row } from "./index";
const identity = {
  riotId: z.string().optional(),
  summonerName: z.string().optional(),
  riotIdGameName: z.string().optional(),
  riotIdTagLine: z.string().optional(),
};
const spell = z.object({
  displayName: z.string().optional(),
  rawDisplayName: z.string().optional(),
});
const player = z.object({
  ...identity,
  championName: z.string(),
  rawChampionName: z.string().optional(),
  team: z.enum(["ORDER", "CHAOS"]),
  position: z.string().optional(),
  summonerSpells: z.object({
    summonerSpellOne: spell,
    summonerSpellTwo: spell,
  }),
});
const dataSchema = z.object({
  activePlayer: z.object(identity),
  allPlayers: z.array(player).min(2).max(20),
  gameData: z.object({
    gameTime: z.number().finite().nonnegative(),
    mapNumber: z.literal(11),
  }),
});
const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function spellId(s: z.infer<typeof spell>) {
  const raw = s.rawDisplayName ?? "";
  if (/summoner.*smite/i.test(raw)) return "SummonerSmite";
  if (/summonerteleport/i.test(raw)) return "SummonerTeleport";
  const found = catalog.spells.find(
    (x) =>
      raw.toLowerCase().includes(x.id.toLowerCase()) ||
      normalized(x.name) === normalized(s.displayName ?? ""),
  );
  if (!found)
    throw Error(
      "An equipped summoner spell is not in the cached catalog. Use manual setup.",
    );
  return found.id;
}
export function readGameLineup(raw: unknown): {
  lineup: Row[];
  gameTime: number;
} {
  const parsed = dataSchema.safeParse(raw);
  if (!parsed.success)
    throw Error("Waiting for a complete Summoner’s Rift roster.");
  const d = parsed.data,
    a = d.activePlayer;
  const same = d.allPlayers.filter((p) =>
    a.riotId
      ? p.riotId === a.riotId
      : !!a.summonerName && p.summonerName === a.summonerName,
  );
  if (same.length !== 1)
    throw Error("Could not identify your team. Use manual setup.");
  const enemies = d.allPlayers.filter((p) => p.team !== same[0].team);
  if (enemies.length !== 5)
    throw Error("Waiting for five opponents. Manual setup is available.");
  const positions = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
  enemies.sort((a, b) => {
    const rank = (p: string | undefined) => {
      const i = positions.indexOf(p ?? "");
      return i < 0 ? 5 : i;
    };
    return rank(a.position) - rank(b.position);
  });
  const lineup = enemies.map((p, i) => {
    const rawId = p.rawChampionName?.replace(
      /^game_character_displayname_/i,
      "",
    );
    const champion = catalog.champions.find(
      (c) =>
        normalized(c.id) === normalized(rawId ?? p.championName) ||
        normalized(c.name) === normalized(p.championName),
    );
    if (!champion)
      throw Error("A champion is not in the cached catalog. Use manual setup.");
    return {
      ...defaultLineup()[i],
      champion: champion.id,
      spells: [
        spellId(p.summonerSpells.summonerSpellOne),
        spellId(p.summonerSpells.summonerSpellTwo),
      ] as [string, string],
    };
  });
  return { lineup, gameTime: d.gameData.gameTime };
}
export type GameUpdate = {
  status: string;
  sequence: number;
  lineup?: Row[];
  reset: boolean;
};
/** Reconnects never count as a new match unless game time actually rolls back. */
export class GameTracker {
  private time: number | undefined;
  private signature = "";
  private sequence = 0;
  private last: GameUpdate = {
    status: "Waiting for League game data",
    sequence: 0,
    reset: false,
  };
  update(raw: unknown): GameUpdate {
    const { lineup, gameTime } = readGameLineup(raw);
    const reset =
      this.time === undefined ? gameTime < 60 : gameTime + 15 < this.time;
    const signature = JSON.stringify(lineup);
    if (reset || signature !== this.signature) {
      this.sequence++;
      this.last = {
        status: "Champion lineup detected",
        sequence: this.sequence,
        lineup,
        reset,
      };
      this.signature = signature;
    }
    this.time = gameTime;
    return this.last;
  }
}
