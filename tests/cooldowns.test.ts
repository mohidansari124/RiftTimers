import { describe, it, expect } from "vitest";
import {
  applyCommand,
  initialState,
  duration,
  remaining,
  commandSchema,
  settingsSchema,
  defaultSettings,
  LIVE_MATCH_ENABLED,
  type Command,
} from "../packages/shared/src/index";
const make = (
  kind: Exclude<Command["kind"], "lineup">,
  revision = 0,
  seconds?: number,
): Command => ({
  id: crypto.randomUUID(),
  kind,
  revision,
  row: initialState().lineup[0].id,
  slot: 0,
  seconds,
});
describe("cooldown engine", () => {
  it("calculates summoner haste and unknown modifiers", () => {
    expect(duration(300, 100)).toBe(150000);
    expect(duration(300, null)).toBe(300000);
  });
  it("uses deadlines and expires without decrementing counters", () => {
    const s = applyCommand(initialState(), make("start"), 1000);
    const t = Object.values(s.timers)[0];
    expect(t.endsAt).toBe(301000);
    expect(t.estimate).toBe(true);
    expect(remaining(t, 31000)).toBe(270000);
    expect(remaining(t, 500000)).toBe(0);
  });
  it("reset and undo preserve original deadline", () => {
    let s = applyCommand(initialState(), make("start"), 1000);
    s = applyCommand(s, make("reset", 1), 5000);
    expect(Object.keys(s.timers)).toHaveLength(0);
    s = applyCommand(s, make("undo", 2), 10000);
    expect(Object.values(s.timers)[0].endsAt).toBe(301000);
  });
  it("adjusts, marks ready and undoes an initial start", () => {
    let s = applyCommand(initialState(), make("start"), 0);
    s = applyCommand(s, make("adjust", 1, -20), 1000);
    expect(Object.values(s.timers)[0].endsAt).toBe(280000);
    s = applyCommand(s, make("ready", 2), 2000);
    expect(Object.keys(s.timers)).toHaveLength(0);
    const start = applyCommand(initialState(), make("start"), 0);
    expect(
      Object.keys(applyCommand(start, make("undo", 1), 500).timers),
    ).toHaveLength(0);
  });
  it("rejects stale updates and malformed inputs", () => {
    const s = applyCommand(initialState(), make("start"), 0);
    expect(() => applyCommand(s, make("reset"), 0)).toThrow("State changed");
    expect(commandSchema.safeParse({ ...make("start"), slot: 3 }).success).toBe(
      false,
    );
    expect(
      commandSchema.safeParse({ ...make("adjust"), seconds: Infinity }).success,
    ).toBe(false);
  });
  it("clears timers when the lineup changes", () => {
    const s = applyCommand(initialState(), make("start"), 0);
    const next = applyCommand(
      s,
      {
        kind: "lineup",
        id: crypto.randomUUID(),
        revision: 1,
        lineup: s.lineup,
      },
      0,
    );
    expect(next.timers).toEqual({});
    expect(next.history).toEqual({});
  });
  it("supports simultaneous independent timers and bounded undo", () => {
    let s = initialState();
    for (let i = 0; i < 25; i++)
      s = applyCommand(s, make("start", i), i * 1000);
    expect(Object.values(s.history)[0]).toHaveLength(20);
    s = applyCommand(s, { ...make("start", 25), slot: 1 }, 0);
    expect(Object.keys(s.timers)).toHaveLength(2);
  });
  it("does not apply haste to the Smite cast lockout", () => {
    const s = initialState();
    s.lineup[0].spells[0] = "SummonerSmite";
    s.lineup[0].haste = 100;
    expect(Object.values(applyCommand(s, make("start"), 0).timers)[0]).toEqual({
      endsAt: 15000,
      duration: 15000,
      estimate: true,
    });
  });
  it("disables live mode and rejects insecure remote servers", () => {
    expect(LIVE_MATCH_ENABLED).toBe(false);
    expect(
      settingsSchema.safeParse({
        ...defaultSettings,
        server: "http://example.com",
      }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({
        ...defaultSettings,
        server: "https://example.com",
      }).success,
    ).toBe(true);
  });
});
