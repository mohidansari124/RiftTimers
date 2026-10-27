import { createRequire } from "node:module";
import path from "node:path";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { mainWindow } from "./test-window.mjs";
const require = createRequire(process.env.RIFT_NODE_MODULES + "/package.json"),
  { _electron } = require("playwright");
const desktop = path.resolve("apps/desktop"),
  local = createRequire(path.join(desktop, "package.json"));
const packaged = process.argv.includes("--packaged");
const app = await _electron.launch({
  executablePath: packaged
    ? path.resolve("release/win-unpacked/RiftTimers.exe")
    : local("electron"),
  args: packaged ? ["--second-client"] : [desktop, "--second-client"],
  env: { ...process.env, RIFT_DEV: "0" },
});
try {
  const p = await mainWindow(app);
  await p.getByRole("heading", { name: "Every second counts." }).waitFor();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.evaluate(async () => {
    const s = await window.rift.getSettings();
    await window.rift.saveSettings({ ...s, autoLineup: true, locked: false });
  });
  await p.waitForFunction(
    async () => (await window.rift.getGame()).lineup?.length === 5,
    {},
    { timeout: 20000 },
  );
  const game = await p.evaluate(() => window.rift.getGame());
  await p.waitForFunction(
    (lineup) =>
      [...document.querySelectorAll(".dashboard-row>img")].every((img, i) =>
        img.getAttribute("src").includes(lineup[i].champion + ".png"),
      ),
    game.lineup,
  );
  const rendered = await p
    .locator(".dashboard-row .spell img")
    .evaluateAll((imgs) =>
      imgs.map((img) =>
        img.getAttribute("src").split("/").pop().replace(".png", ""),
      ),
    );
  assert.deepEqual(
    rendered,
    game.lineup.flatMap((r) => r.spells),
  );
  await p.locator(".dashboard-row .spell").first().click();
  await p.getByRole("button", { name: "Open simulation overlay" }).click();
  const overlay = app.windows().find((w) => w.url().endsWith("#overlay"));
  assert.ok(overlay);
  await overlay.locator(".cooling").first().waitFor();
  assert.equal(
    await overlay
      .locator(".overlay-handle")
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue("-webkit-app-region"),
      ),
    "drag",
  );
  assert.ok(
    (await overlay.locator(".overlay-handle").boundingBox()).height >= 36,
  );
  await overlay
    .getByRole("button", { name: "Lock overlay", exact: true })
    .click();
  await overlay
    .getByRole("button", { name: "Unlock overlay", exact: true })
    .waitFor();
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith("#overlay"))
        .isMovable(),
    ),
    false,
  );
  await overlay
    .getByRole("button", { name: "Unlock overlay", exact: true })
    .click();
  await overlay
    .getByRole("button", { name: "Lock overlay", exact: true })
    .waitFor();
  await p.evaluate(() => window.rift.overlayControl("center"));
  await p.waitForTimeout(5500);
  const props = await app.evaluate(({ BrowserWindow, screen }) => {
    const w = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().endsWith("#overlay"),
    );
    return {
      top: w.isAlwaysOnTop(),
      visible: w.isVisible(),
      movable: w.isMovable(),
      bounds: w.getBounds(),
      screen: screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
        .workArea,
    };
  });
  assert.ok(props.top && props.visible && props.movable);
  assert.ok(
    Math.abs(
      props.bounds.x -
        (props.screen.x + (props.screen.width - props.bounds.width) / 2),
    ) <= 1,
  );
  // Repeated live polling must not clear a user-started timer.
  assert.equal(await p.locator(".dashboard-row .cooling").count(), 1);
  await mkdir("test-results", { recursive: true });
  await overlay.screenshot({ path: "test-results/overlay-v012.png" });
  assert.deepEqual(errors, []);
  console.log(
    "Passed: live enemy champions and both spells, timer preservation, overlay visibility/topmost, drag-region size, lock/unlock, and center control.",
  );
} finally {
  await app.close();
}
