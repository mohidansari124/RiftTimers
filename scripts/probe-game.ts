import https from "node:https";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readGameLineup } from "../packages/shared/src/game-data";
const ca = readFileSync(
  fileURLToPath(
    new URL("../apps/desktop/electron/certs/riotgames.pem", import.meta.url),
  ),
);
const read = (endpoint: string) =>
  new Promise<unknown>((resolve, reject) => {
    const req = https.get(
      {
        hostname: "127.0.0.1",
        port: 2999,
        path: `/liveclientdata/${endpoint}`,
        ca,
        timeout: 2000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            if (res.statusCode !== 200) throw Error(`HTTP ${res.statusCode}`);
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(Error("Timed out")));
  });
const [activePlayer, allPlayers, gameData] = await Promise.all(
  ["activeplayer", "playerlist", "gamestats"].map(read),
);
const parsed = readGameLineup({ activePlayer, allPlayers, gameData });
// Do not log player identities or unrelated game data.
console.log(
  JSON.stringify(
    {
      gameTime: parsed.gameTime,
      lineup: parsed.lineup.map(({ champion, spells }) => ({
        champion,
        spells,
      })),
    },
    null,
    2,
  ),
);
