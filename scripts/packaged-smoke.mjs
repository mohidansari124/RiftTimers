import { createRequire } from "node:module";
import path from "node:path";
import assert from "node:assert/strict";
import { mainWindow, manualFixture } from "./test-window.mjs";
const require = createRequire(process.env.RIFT_NODE_MODULES + "/package.json");
const { _electron } = require("playwright");
const app = await _electron.launch({
  executablePath: path.resolve("release/win-unpacked/RiftTimers.exe"),
  args: [],
  timeout: 30000,
});
let restore;
try {
  const p = await mainWindow(app);
  restore = await manualFixture(p);
  await p.getByRole("heading", { name: "Every second counts." }).waitFor();
  await p
    .getByRole("button", { name: "Ahri Flash", exact: true })
    .first()
    .click();
  assert.ok((await p.locator(".cooling").count()) > 0);
  await p.getByRole("button", { name: "Open simulation overlay" }).click();
  // Wait beyond the former process-poll interval to catch regressions.
  await p.waitForTimeout(4500);
  const overlay = app.windows().find((w) => w.url().endsWith("#overlay"));
  assert.ok(overlay);
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith("#overlay"))
        ?.isVisible(),
    ),
    true,
  );
  await overlay
    .getByRole("button", { name: "Darius Flash", exact: true })
    .click();
  await p.waitForFunction(
    () => document.querySelectorAll(".cooling").length >= 4,
  );
  console.log(
    "Packaged app passed: timers, overlay visibility, and overlay actions remain available.",
  );
} finally {
  if (restore) await restore();
  await app.close();
}
