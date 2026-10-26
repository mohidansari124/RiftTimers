import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { mainWindow } from './test-window.mjs';
const require = createRequire(process.env.RIFT_NODE_MODULES + "/package.json");
const { _electron } = require("playwright");
const desktop = path.resolve("apps/desktop");
const local = createRequire(path.join(desktop, "package.json"));
const executablePath = local("electron");
const app = await _electron.launch({
  executablePath,
  args: [desktop],
  env: { ...process.env, RIFT_DEV: "0" },
  timeout: 30000,
});
try {
  const page = await mainWindow(app);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("heading", { name: "Every second counts." }).waitFor();
  await page.waitForFunction(() => window.rift !== undefined);
  await page.waitForTimeout(4500);
  await page
    .getByRole("button", { name: "Darius Flash", exact: true })
    .first()
    .click();
  await page
    .getByText("~4:")
    .first()
    .waitFor({ timeout: 1000 })
    .catch(() => {});
  assert.ok((await page.locator(".cooling").count()) > 0, "Timer starts");
  await page.getByRole("button", { name: "Open simulation overlay" }).click();
  const overlay = app.windows().find((w) => w !== page);
  assert.ok(overlay, "Overlay exists");
  await overlay.waitForTimeout(300);
  assert.ok(
    (await overlay.locator(".cooling").count()) > 0,
    "Overlay mirrors timer",
  );
  await overlay
    .getByRole("button", { name: "Ahri Flash", exact: true })
    .click();
  await page.waitForTimeout(300);
  assert.ok(
    (await page.locator(".cooling").count()) >= 4,
    "Overlay actions reach main window",
  );
  await page
    .getByRole("button", { name: "Champion Setup", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Champion setup", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Overlay Settings", exact: true })
    .click();
  await page.getByRole("heading", { name: "Make it yours." }).waitFor();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
  await overlay.screenshot({ path: "test-results/overlay.png" });
  assert.deepEqual(errors, []);
  console.log(
    "Electron smoke passed: launch, timer, separate overlay, bidirectional IPC, setup and settings navigation.",
  );
} finally {
  await app.close();
}
