import { build } from "esbuild";
import { copyFile } from "node:fs/promises";
await build({
  entryPoints: ["electron/main.ts"],
  outfile: "dist-electron/main.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
});
await copyFile("electron/certs/riotgames.pem", "dist-electron/riotgames.pem");
await build({
  entryPoints: ["electron/preload.ts"],
  outfile: "dist-electron/preload.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
});
