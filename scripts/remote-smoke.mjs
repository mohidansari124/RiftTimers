import assert from "node:assert/strict";
import { io } from "socket.io-client";

const url = process.argv[2];
if (!url || new URL(url).protocol !== "https:")
  throw new Error("Usage: node scripts/remote-smoke.mjs https://YOUR-SERVER");
const health = await fetch(`${url}/health`, { signal: AbortSignal.timeout(90000) });
assert.equal(health.status, 200);
assert.equal((await health.json()).service, "RiftTimers");
const clients = [];
const send = (socket, event, data) => socket.timeout(10000).emitWithAck(event, data);
async function connect() {
  const socket = io(url, {
    transports: ["websocket"],
    extraHeaders: { Origin: "null" },
    reconnection: false,
    timeout: 20000,
    autoConnect: false,
  });
  clients.push(socket);
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
    socket.connect();
  });
  return socket;
}
function nextRevision(socket, revision) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("snapshot", listener);
      reject(new Error("Snapshot timeout"));
    }, 10000);
    function listener(snapshot) {
      if (snapshot.state.revision !== revision) return;
      clearTimeout(timeout);
      socket.off("snapshot", listener);
      resolve(snapshot);
    }
    socket.on("snapshot", listener);
  });
}
try {
  const a = await connect(), b = await connect();
  const room = await send(a, "enter", { mode: "simulation", name: "Deployment check" });
  assert.equal(room.ok, true);
  const joined = await send(b, "enter", {
    mode: "simulation", name: "Second check", code: room.snapshot.code,
  });
  assert.equal(joined.ok, true);
  const row = room.snapshot.state.lineup[0].id;
  const started = nextRevision(b, 1);
  const result = await send(a, "command", {
    kind: "start", id: crypto.randomUUID(), revision: 0, row, slot: 0,
  });
  assert.equal(result.ok, true);
  assert.deepEqual((await started).state, result.snapshot.state);
  assert.ok(Object.values(result.snapshot.state.timers)[0].endsAt > Date.now());
  const reset = nextRevision(a, 2);
  assert.equal((await send(b, "command", {
    kind: "reset", id: crypto.randomUUID(), revision: 1, row, slot: 0,
  })).ok, true);
  assert.deepEqual((await reset).state.timers, {});
  await send(a, "leave", {});
  await send(b, "leave", {});
  console.log("PASS: HTTPS health, two WebSocket clients, room create/join, timer start/reset synchronization.");
} finally {
  clients.forEach((socket) => socket.disconnect());
}
