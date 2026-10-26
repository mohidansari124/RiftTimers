import { z } from "zod";
import catalog from "./data/catalog.json";
export { catalog };
export const LIVE_MATCH_ENABLED = false as const;
export const spellSchema = z
  .string()
  .refine((id) => catalog.spells.some((s) => s.id === id), "Unknown spell");
export const rowSchema = z.object({
  id: z.string().uuid(),
  champion: z
    .string()
    .refine((id) => catalog.champions.some((c) => c.id === id)),
  spells: z.tuple([spellSchema, spellSchema]),
  haste: z.number().min(0).max(500).nullable(),
});
export const lineupSchema = z
  .array(rowSchema)
  .length(5)
  .refine((rows) => new Set(rows.map((r) => r.id)).size === 5);
export type Row = z.infer<typeof rowSchema>;
export type Timer = { endsAt: number; duration: number; estimate: boolean };
export type State = {
  revision: number;
  lineup: Row[];
  timers: Record<string, Timer>;
  history: Record<string, (Timer | null)[]>;
};
export const commandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("lineup"),
    id: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    lineup: lineupSchema,
  }),
  z.object({
    kind: z.enum(["start", "reset", "ready", "adjust", "undo"]),
    id: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    row: z.string().uuid(),
    slot: z.union([z.literal(0), z.literal(1)]),
    seconds: z.number().finite().min(-3600).max(3600).optional(),
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export const joinSchema = z.object({
  mode: z.literal("simulation"),
  name: z.string().trim().min(1).max(24),
  code: z
    .string()
    .regex(/^[A-Z2-9]{6}$/)
    .optional(),
  token: z.string().uuid().optional(),
});
export type Member = { id: string; name: string; online: boolean };
export type Snapshot = {
  state: State;
  serverNow: number;
  code: string;
  members: Member[];
};
export type Reply = {
  ok: boolean;
  error?: string;
  snapshot?: Snapshot;
  token?: string;
};
export function defaultLineup(): Row[] {
  return ["Darius", "LeeSin", "Ahri", "Jinx", "Thresh"].map((champion, i) => ({
    id: `00000000-0000-4000-8000-00000000000${i}`,
    champion,
    spells: [
      "SummonerFlash",
      [
        "SummonerHaste",
        "SummonerSmite",
        "SummonerDot",
        "SummonerHeal",
        "SummonerDot",
      ][i],
    ],
    haste: null,
  }));
}
export function initialState(): State {
  return { revision: 0, lineup: defaultLineup(), timers: {}, history: {} };
}
export function duration(seconds: number, haste: number | null) {
  return (seconds * 1000) / (1 + (haste ?? 0) / 100);
}
export function remaining(timer: Timer | undefined, now: number) {
  return timer ? Math.max(0, timer.endsAt - now) : 0;
}
export function applyCommand(
  state: State,
  command: Command,
  now: number,
): State {
  const c = commandSchema.parse(command);
  if (c.revision !== state.revision)
    throw Error("State changed. Review the latest timers and try again.");
  if (c.kind === "lineup")
    return {
      revision: state.revision + 1,
      lineup: c.lineup,
      timers: {},
      history: {},
    };
  const row = state.lineup.find((r) => r.id === c.row);
  if (!row) throw Error("Unknown champion row");
  const key = `${row.id}:${c.slot}`;
  const previous = state.timers[key];
  const timers = { ...state.timers },
    history = { ...state.history };
  const stack = [...(history[key] ?? [])];
  if (c.kind === "undo") {
    if (!stack.length) throw Error("Nothing to undo");
    const old = stack.pop();
    if (old) timers[key] = old;
    else delete timers[key];
  } else {
    stack.push(previous ? { ...previous } : null);
    if (stack.length > 20) stack.shift();
    if (c.kind === "ready" || c.kind === "reset") delete timers[key];
    else if (c.kind === "adjust") {
      if (c.seconds === undefined || !previous)
        throw Error("Start a timer before adjusting it");
      timers[key] = {
        ...previous,
        endsAt: Math.max(now, previous.endsAt + c.seconds * 1000),
        duration: Math.max(1000, previous.duration + c.seconds * 1000),
        estimate: true,
      };
    } else {
      const spell = catalog.spells.find((s) => s.id === row.spells[c.slot])!;
      const ms = duration(
        spell.seconds,
        spell.id === "SummonerSmite" ? 0 : row.haste,
      );
      timers[key] = {
        endsAt: now + ms,
        duration: ms,
        estimate: row.haste === null || spell.complex,
      };
    }
  }
  history[key] = stack;
  return { ...state, revision: state.revision + 1, timers, history };
}
export const settingsSchema = z.object({
  scale: z.number().min(0.65).max(1.6),
  opacity: z.number().min(0.3).max(1),
  portraitSize: z.number().min(24).max(64),
  spellSize: z.number().min(28).max(64),
  spacing: z.number().min(2).max(24),
  fontSize: z.number().min(12).max(28),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  background: z.boolean(),
  locked: z.boolean(),
  hotkey: z.string().min(1).max(60),
  startup: z.boolean(),
  tray: z.boolean(),
  debug: z.boolean(),
  server: z
    .string()
    .url()
    .refine((v) => {
      const u = new URL(v);
      return (
        u.protocol === "https:" ||
        (u.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname))
      );
    }, "Use HTTPS for hosted servers"),
  x: z.number().int().min(-20000).max(20000).optional(),
  y: z.number().int().min(-20000).max(20000).optional(),
});
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = {
  scale: 1,
  opacity: 0.94,
  portraitSize: 42,
  spellSize: 46,
  spacing: 8,
  fontSize: 18,
  color: "#F87171",
  background: true,
  locked: false,
  hotkey: "CommandOrControl+Shift+T",
  startup: false,
  tray: true,
  debug: false,
  server: "http://127.0.0.1:3001",
};
