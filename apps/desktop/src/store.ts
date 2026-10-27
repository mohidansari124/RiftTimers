import { create } from "zustand";
import type { GameUpdate } from "@rift/shared/game-data";
import { io, type Socket } from "socket.io-client";
import {
  applyCommand,
  initialState,
  defaultSettings,
  settingsSchema,
  type State,
  type Settings,
  type Command,
  type Snapshot,
  type Reply,
  type Member,
} from "@rift/shared";
const epoch = Date.now(),
  start = performance.now();
let offset = 0;
export const now = () => epoch + performance.now() - start + offset;
let socket: Socket | undefined,
  clockInterval: ReturnType<typeof setInterval> | undefined;
let session: { code: string; token: string; name: string } | undefined;
let memberId = "",
  latestGame: GameUpdate | undefined;
const appliedGames = new Set<string>(),
  pendingImports = new Set<string>();
// Keep an import's ID across lost acknowledgements so a retry cannot reset timers twice.
const importIds = new Map<string, string>();
function importGame() {
  const s = useRift.getState(),
    game = latestGame;
  if (!game?.lineup || !s.settings.autoLineup) return;
  const key = `${s.settings.server}:${s.code || "local"}:${game.sequence}`;
  if (appliedGames.has(key) || pendingImports.has(key)) return;
  if (
    s.code &&
    (!socket?.connected || s.members.find((m) => m.online)?.id !== memberId)
  )
    return;
  if (!importIds.has(key)) importIds.set(key, crypto.randomUUID());
  const c: Command = {
    kind: "importLineup",
    id: importIds.get(key)!,
    revision: s.state.revision,
    lineup: game.lineup,
    reset: game.reset,
  };
  const complete = () => {
    importIds.delete(key);
    appliedGames.add(key);
    if (appliedGames.size > 100)
      appliedGames.delete(appliedGames.values().next().value!);
    useRift.setState({
      gameStatus: "Lineup and summoner spells loaded from League",
    });
  };
  if (s.code) {
    pendingImports.add(key);
    socket!.timeout(5000).emit("command", c, (err: Error | null, r: Reply) => {
      pendingImports.delete(key);
      if (!err && r.ok) {
        complete();
        reply(r);
      } else
        useRift.setState({
          gameStatus:
            "Lineup import will retry; " +
            (err ? "server unavailable" : r.error),
        });
    });
  } else {
    try {
      const state = applyCommand(s.state, c, now());
      complete();
      useRift.setState({ state });
    } catch (e) {
      useRift.setState({ gameStatus: (e as Error).message });
    }
  }
}
function receiveGame(game: GameUpdate) {
  latestGame = game;
  useRift.setState({ gameStatus: game.status });
  importGame();
}
try {
  session =
    JSON.parse(sessionStorage.getItem("rift-session") ?? "null") ?? undefined;
} catch {}
type Store = {
  state: State;
  settings: Settings;
  members: Member[];
  code: string;
  status: string;
  error: string;
  gameStatus: string;
  setError: (s: string) => void;
  command: (c: Command) => void;
  save: (s: Settings) => Promise<void>;
  enter: (name: string, code?: string) => void;
  leave: () => void;
};
function accept(s: Snapshot) {
  useRift.setState({
    state: s.state,
    code: s.code,
    members: s.members,
    status: "Connected",
  });
  queueMicrotask(importGame);
}
function clock() {
  if (!socket?.connected) return;
  const t = performance.now();
  socket
    .timeout(4000)
    .emit("clock", {}, (err: Error | null, r: { serverNow: number }) => {
      if (!err && Number.isFinite(r.serverNow))
        offset = r.serverNow - (epoch + (t + performance.now()) / 2 - start);
    });
}
function reply(r: Reply) {
  if (!r.ok) useRift.setState({ error: r.error ?? "Request failed" });
  if (r.snapshot) accept(r.snapshot);
}
export const useRift = create<Store>((set, get) => ({
  state: initialState(),
  settings: defaultSettings,
  members: [],
  code: "",
  status: "Local simulation",
  error: "",
  gameStatus: "Waiting for League game data",
  setError: (error) => set({ error }),
  command: (c) => {
    if (location.hash === "#overlay") {
      window.rift?.action(c);
      return;
    }
    if (get().code) {
      if (!socket?.connected) {
        set({ error: "Reconnect before changing shared timers." });
        return;
      }
      socket.timeout(5000).emit("command", c, (err: Error | null, r: Reply) => {
        if (err)
          set({
            error: "No acknowledgement. Reconnect to recover server state.",
          });
        else reply(r);
      });
    } else {
      try {
        set({ state: applyCommand(get().state, c, now()) });
      } catch (e) {
        set({ error: (e as Error).message });
      }
    }
  },
  save: async (settings) => {
    try {
      const valid = settingsSchema.parse(settings);
      const saved = window.rift ? await window.rift.saveSettings(valid) : valid;
      set({ settings: saved });
      queueMicrotask(importGame);
      localStorage.setItem("rift-settings", JSON.stringify(saved));
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  enter: (name, code) => {
    socket?.disconnect();
    clearInterval(clockInterval);
    set({ status: "Connecting…", error: "" });
    socket = io(get().settings.server, {
      transports: ["websocket"],
      autoConnect: false,
      reconnection: true,
    });
    socket.on("snapshot", accept);
    socket.on("expired", () => {
      get().leave();
      set({ error: "Room expired after two hours without changes." });
    });
    socket.on("connect", () => {
      clock();
      socket!.timeout(5000).emit(
        "enter",
        {
          mode: "simulation",
          name,
          code: session?.code ?? code,
          token: session?.token,
        },
        (err: Error | null, r: Reply) => {
          if (err) {
            set({
              error: "Room request timed out",
              status: "Room unavailable",
            });
            return;
          }
          reply(r);
          if (r.ok && r.snapshot && r.token) {
            memberId = r.memberId ?? "";
            session = { name, code: r.snapshot.code, token: r.token };
            sessionStorage.setItem("rift-session", JSON.stringify(session));
          } else {
            session = undefined;
            sessionStorage.removeItem("rift-session");
            set({ status: "Room unavailable" });
          }
        },
      );
    });
    socket.on("disconnect", () => set({ status: "Reconnecting…" }));
    socket.on("connect_error", () =>
      set({
        status: "Server unavailable",
        error: "Cannot connect. Start the server or check its address.",
      }),
    );
    socket.connect();
    clockInterval = setInterval(clock, 30000);
  },
  leave: () => {
    socket?.emit("leave", {}, () => {});
    socket?.removeAllListeners();
    socket?.disconnect();
    clearInterval(clockInterval);
    session = undefined;
    memberId = "";
    sessionStorage.removeItem("rift-session");
    offset = 0;
    set({
      code: "",
      members: [],
      status: "Local simulation",
      state: initialState(),
    });
  },
}));
export function makeCommand(
  kind: "start" | "reset" | "ready" | "adjust" | "undo",
  row: string,
  slot: 0 | 1,
  seconds?: number,
): Command {
  return {
    kind,
    id: crypto.randomUUID(),
    revision: useRift.getState().state.revision,
    row,
    slot,
    seconds,
  };
}
export async function init() {
  try {
    const settings = window.rift
      ? await window.rift.getSettings()
      : JSON.parse(localStorage.getItem("rift-settings") ?? "null");
    const p = settingsSchema.safeParse(settings);
    if (p.success) useRift.setState({ settings: p.data });
  } catch {}
  if (window.rift) {
    window.rift.onSettings((settings) => {
      useRift.setState({ settings });
    });
    if (location.hash === "#overlay")
      window.rift.onState((v) => {
        if (v && v.state && v.settings) {
          useRift.setState({ state: v.state, settings: v.settings });
          offset = v.serverNow - (epoch + performance.now() - start);
        }
      });
    else {
      window.rift.onGame(receiveGame);
      receiveGame(await window.rift.getGame());
      window.rift.onAction((c) => useRift.getState().command(c));
      const publish = () => {
        const { state, settings } = useRift.getState();
        window.rift!.publish({ state, settings, serverNow: now() });
      };
      useRift.subscribe(publish);
      publish();
    }
  }
  if (location.hash !== "#overlay" && session)
    useRift.getState().enter(session.name, session.code);
}
