import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { mainWindow, manualFixture } from "./test-window.mjs";
const require = createRequire(process.env.RIFT_NODE_MODULES + "/package.json"),
  { _electron } = require("playwright");
const desktop = path.resolve("apps/desktop"),
  local = createRequire(path.join(desktop, "package.json")),
  executablePath = local("electron");
const server = spawn(process.execPath, ["apps/server/dist/index.js"], {
  env: { ...process.env, PORT: "3001" },
  windowsHide: true,
  stdio: "pipe",
});
const apps = [];
const restores = [];
try {
  for (let i = 0; i < 30; i++) {
    try {
      await fetch("http://127.0.0.1:3001/health");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  for (const args of [[desktop], [desktop, "--second-client"]])
    apps.push(
      await _electron.launch({
        executablePath,
        args,
        env: { ...process.env, RIFT_DEV: "0" },
      }),
    );
  const [a, b] = await Promise.all(apps.map(mainWindow));
  for (const p of [a, b]) restores.push(await manualFixture(p));
  for (const p of [a, b]) {
    await p.getByRole("button", { name: "Multiplayer", exact: true }).click();
  }
  await a.getByRole("button", { name: "Create simulation room" }).click();
  await a.locator(".room-code").waitFor();
  const code = (await a.locator(".room-code").innerText()).trim();
  await b.getByPlaceholder("ABC234").fill(code);
  await b.getByRole("button", { name: "Join room", exact: true }).click();
  await b.locator(".room-code").waitFor();
  for (const p of [a, b])
    await p.getByRole("button", { name: "Dashboard", exact: true }).click();
  await a.waitForTimeout(4000);
  await a
    .getByRole("button", { name: "Ahri Flash", exact: true })
    .first()
    .click();
  await b.waitForFunction(
    () => document.querySelectorAll(".cooling").length === 2,
  );
  await b
    .getByRole("button", { name: "Ahri Flash", exact: true })
    .first()
    .click({ button: "right" });
  await b.getByRole("button", { name: "Mark ready", exact: true }).click();
  await a.waitForFunction(
    () => document.querySelectorAll(".cooling").length === 0,
  );
  assert.equal(await a.locator(".cooling").count(), 0);
  console.log(
    "Two Electron instances passed: create, join, shared timer start, reverse-direction reset.",
  );
  for (const p of [a, b]) {
    await p.getByRole("button", { name: "Multiplayer", exact: true }).click();
    await p.getByRole("button", { name: "Leave room", exact: true }).click();
  }
} finally {
  for (const restore of restores) await restore();
  for (const app of apps) await app.close();
  server.kill();
}
