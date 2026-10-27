import https from "node:https";
import { readFileSync } from "node:fs";
import path from "node:path";
import { GameTracker, type GameUpdate } from "@rift/shared/game-data";
const endpoints = ["activeplayer", "playerlist", "gamestats"] as const;
// Fixed loopback destination, Riot's published CA, bounded body/time, no redirects.
export function startGameClient(
  enabled: () => boolean,
  publish: (update: GameUpdate) => void,
) {
  const agent = new https.Agent({
    ca: readFileSync(path.join(__dirname, "riotgames.pem")),
    keepAlive: true,
    maxSockets: 3,
  });
  const tracker = new GameTracker();
  let stopped = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  function read(endpoint: (typeof endpoints)[number]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const req = https.get(
        {
          hostname: "127.0.0.1",
          port: 2999,
          path: `/liveclientdata/${endpoint}`,
          agent,
          timeout: 2000,
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            reject(Error("Waiting for League game data"));
            return;
          }
          let body = "",
            size = 0;
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            size += Buffer.byteLength(chunk);
            if (size > 512000) {
              res.destroy(Error("Game response too large"));
              return;
            }
            body += chunk;
          });
          res.on("error", reject);
          res.on("end", () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              reject(Error("Invalid game response"));
            }
          });
        },
      );
      req.on("timeout", () => req.destroy(Error("Game connection timed out")));
      req.on("error", reject);
    });
  }
  async function poll() {
    try {
      if (!enabled())
        publish({
          status: "Automatic lineup disabled",
          sequence: 0,
          reset: false,
        });
      else {
        const [activePlayer, allPlayers, gameData] = await Promise.all(
          endpoints.map(read),
        );
        if (!stopped && enabled())
          publish(tracker.update({ activePlayer, allPlayers, gameData }));
      }
    } catch (e) {
      if (!stopped) {
        const error = e as NodeJS.ErrnoException;
        publish({
          status: ["ECONNREFUSED", "ECONNRESET"].includes(error.code ?? "")
            ? "Waiting for League game data"
            : error.code?.includes("CERT")
              ? "Riot certificate validation failed; manual setup remains available"
              : error.message,
          sequence: 0,
          reset: false,
        });
      }
    } finally {
      if (!stopped) timer = setTimeout(poll, 5000);
    }
  }
  void poll();
  return () => {
    stopped = true;
    clearTimeout(timer);
    agent.destroy();
  };
}
