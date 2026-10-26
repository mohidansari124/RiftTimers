import { beforeEach, afterEach, it, expect } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createRiftServer } from "../apps/server/src/server";
import type { Reply, Snapshot } from "../packages/shared/src/index";
let server: ReturnType<typeof createRiftServer>, url: string;
let clients: Socket[] = [];
beforeEach(async () => {
  server = createRiftServer();
  await new Promise<void>((r) => server.http.listen(0, "127.0.0.1", r));
  const a = server.http.address();
  url = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
});
afterEach(async () => {
  clients.forEach((c) => c.disconnect());
  clients = [];
  await server.close();
});
const client = async () => {
  const c = io(url, { transports: ["websocket"], forceNew: true });
  clients.push(c);
  await new Promise<void>((r) => c.on("connect", r));
  return c;
};
const send = (c: Socket, event: string, data: unknown) =>
  new Promise<Reply>((resolve, reject) => {
    c.timeout(2000).emit(event, data, (err: Error | null, r: Reply) =>
      err ? reject(err) : resolve(r),
    );
  });
const enter = (c: Socket, code?: string, token?: string) =>
  send(c, "enter", { mode: "simulation", name: "Tester", code, token });
it("creates a six-character room, joins, and synchronizes both clients", async () => {
  const a = await client(),
    b = await client(),
    room = await enter(a);
  expect(room.ok).toBe(true);
  expect(room.snapshot!.code).toMatch(/^[A-Z2-9]{6}$/);
  await enter(b, room.snapshot!.code);
  const received = new Promise<Snapshot>((r) => b.once("snapshot", r));
  const s = room.snapshot!.state;
  const command = {
    kind: "start",
    id: crypto.randomUUID(),
    revision: 0,
    row: s.lineup[0].id,
    slot: 0,
  };
  const result = await send(a, "command", command);
  const snapshot = await received;
  expect(snapshot.state).toEqual(result.snapshot!.state);
  expect(snapshot.state.revision).toBe(1);
  expect(Object.values(snapshot.state.timers)[0].endsAt).toBeGreaterThan(
    Date.now(),
  );
  const duplicate = await send(a, "command", command);
  expect(duplicate.snapshot!.state.revision).toBe(1);
  const conflict = await send(b, "command", {
    ...command,
    id: crypto.randomUUID(),
    kind: "reset",
  });
  expect(conflict.ok).toBe(false);
  const reset = await send(b, "command", {
    ...command,
    id: crypto.randomUUID(),
    kind: "reset",
    revision: 1,
  });
  expect(reset.snapshot!.state.timers).toEqual({});
});
it("recovers authoritative state after a client disconnects", async () => {
  const a = await client(),
    room = await enter(a),
    code = room.snapshot!.code;
  const row = room.snapshot!.state.lineup[0].id;
  await send(a, "command", {
    kind: "start",
    id: crypto.randomUUID(),
    revision: 0,
    row,
    slot: 0,
  });
  a.disconnect();
  await new Promise((r) => setTimeout(r, 40));
  const b = await client(),
    recovered = await enter(b, code, room.token);
  expect(recovered.token).toBe(room.token);
  expect(recovered.snapshot!.state.revision).toBe(1);
  expect(recovered.snapshot!.members).toHaveLength(1);
  expect(Object.keys(recovered.snapshot!.state.timers)).toHaveLength(1);
});
it("rejects malformed messages, unknown rooms and live modes", async () => {
  const a = await client();
  expect((await enter(a, "ZZZZZZ")).ok).toBe(false);
  expect((await send(a, "enter", { mode: "live", name: "Bad" })).ok).toBe(
    false,
  );
  expect((await send(a, "command", {})).ok).toBe(false);
  await enter(a);
  expect((await send(a, "command", { kind: "start", slot: 9 })).ok).toBe(false);
});
it("provides server clock and enforces request limits", async () => {
  const a = await client();
  const r = (await send(a, "clock", {})) as Reply & { serverNow: number };
  expect(Math.abs(Date.now() - r.serverNow)).toBeLessThan(1000);
  let last: Reply = r;
  for (let i = 0; i < 105; i++) last = await send(a, "clock", {});
  expect(last.ok).toBe(false);
  expect(last.error).toContain("Too many");
});
it("leaves a room and records offline presence", async () => {
  const a = await client(),
    b = await client(),
    r = await enter(a);
  await enter(b, r.snapshot!.code);
  const received = new Promise<Snapshot>((r) => b.once("snapshot", r));
  await send(a, "leave", {});
  expect((await received).members.filter((m) => m.online)).toHaveLength(1);
});
it("expires idle rooms and rejects their old invite codes", async () => {
  await server.close();
  server = createRiftServer({ ttl: 60 });
  await new Promise<void>((r) => server.http.listen(0, "127.0.0.1", r));
  const a = server.http.address();
  url = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
  const c = await client(),
    room = await enter(c);
  const expired = new Promise<void>((r) => c.once("expired", r));
  await expired;
  expect((await enter(c, room.snapshot!.code)).ok).toBe(false);
});
