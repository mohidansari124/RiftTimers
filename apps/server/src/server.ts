import { createServer } from "node:http";
import { randomInt, randomUUID } from "node:crypto";
import { Server } from "socket.io";
import {
  applyCommand,
  commandSchema,
  initialState,
  joinSchema,
  type State,
  type Member,
  type Snapshot,
  type Reply,
} from "@rift/shared";
type Room = {
  code: string;
  state: State;
  members: Map<string, Member & { socketId?: string }>;
  seen: Set<string>;
  touched: number;
};
export function createRiftServer({
  ttl = 2 * 60 * 60 * 1000,
  maxRooms = 1000,
} = {}) {
  const http = createServer((req, res) => {
    res.writeHead(req.url === "/health" ? 200 : 404, {
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify({ service: "RiftTimers", mode: "simulation" }));
  });
  const io = new Server(http, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(",") ?? [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "null",
      ],
    },
    maxHttpBufferSize: 16384,
    pingInterval: 15000,
    pingTimeout: 10000,
  });
  const rooms = new Map<string, Room>();
  const snap = (r: Room): Snapshot => ({
    code: r.code,
    state: r.state,
    serverNow: Date.now(),
    members: [...r.members.values()].map(({ id, name, online }) => ({
      id,
      name,
      online,
    })),
  });
  const broadcast = (r: Room) => io.to(r.code).emit("snapshot", snap(r));
  const limits = new Map<string, { count: number; since: number }>();
  const sweep = setInterval(
    () => {
      const now = Date.now();
      for (const [code, r] of rooms)
        if (now - r.touched > ttl) {
          io.to(code).emit("expired");
          io.in(code).socketsLeave(code);
          rooms.delete(code);
        }
      for (const [k, v] of limits) if (now - v.since > 60000) limits.delete(k);
    },
    Math.min(ttl, 60000),
  );
  sweep.unref();
  io.on("connection", (socket) => {
    let room: Room | undefined, token: string | undefined;
    function leave() {
      if (room && token) {
        const m = room.members.get(token);
        if (m?.socketId === socket.id) {
          m.online = false;
          m.socketId = undefined;
          broadcast(room);
        }
        void socket.leave(room.code);
      }
      room = undefined;
      token = undefined;
    }
    function allowed() {
      const key = socket.handshake.address;
      const now = Date.now();
      let b = limits.get(key);
      if (!b || now - b.since > 10000) {
        b = { count: 0, since: now };
        limits.set(key, b);
      }
      return ++b.count <= 100;
    }
    const handle = (event: string, fn: (data: unknown) => Reply) =>
      socket.on(event, (data: unknown, ack: unknown) => {
        if (typeof ack !== "function") return;
        try {
          if (!allowed()) throw Error("Too many requests. Wait a moment.");
          ack(fn(data));
        } catch (e) {
          ack({
            ok: false,
            error: e instanceof Error ? e.message : "Invalid request",
          });
        }
      });
    handle("enter", (raw) => {
      const data = joinSchema.parse(raw);
      let target: Room;
      if (data.code) {
        const found = rooms.get(data.code);
        if (!found) throw Error("Room not found or expired");
        target = found;
      } else {
        if (rooms.size >= maxRooms) throw Error("Server at capacity");
        let code = "";
        do {
          code = Array.from(
            { length: 6 },
            () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(32)],
          ).join("");
        } while (rooms.has(code));
        target = {
          code,
          state: initialState(),
          members: new Map(),
          seen: new Set(),
          touched: Date.now(),
        };
        rooms.set(code, target);
      }
      let nextToken =
        data.token && target.members.has(data.token)
          ? data.token
          : randomUUID();
      if (!target.members.has(nextToken) && target.members.size >= 10)
        throw Error("Room is full");
      const existing = target.members.get(nextToken);
      if (existing?.online && existing.socketId !== socket.id)
        throw Error("Session is already connected");
      leave();
      room = target;
      token = nextToken;
      room.members.set(token, {
        id: existing?.id ?? randomUUID(),
        name: data.name,
        online: true,
        socketId: socket.id,
      });
      room.touched = Date.now();
      void socket.join(room.code);
      broadcast(room);
      return { ok: true, token, snapshot: snap(room) };
    });
    handle("command", (raw) => {
      if (!room || !rooms.has(room.code)) throw Error("Join a room first");
      const c = commandSchema.parse(raw);
      if (!room.seen.has(c.id)) {
        room.state = applyCommand(room.state, c, Date.now());
        room.seen.add(c.id);
        if (room.seen.size > 2000)
          room.seen.delete(room.seen.values().next().value!);
        room.touched = Date.now();
        broadcast(room);
      }
      return { ok: true, snapshot: snap(room) };
    });
    handle("leave", () => {
      leave();
      return { ok: true };
    });
    handle("clock", () => ({ ok: true, serverNow: Date.now() }) as Reply);
    socket.on("disconnect", leave);
  });
  return {
    http,
    io,
    rooms,
    close: async () => {
      clearInterval(sweep);
      await new Promise<void>((r) => io.close(() => r()));
    },
  };
}
