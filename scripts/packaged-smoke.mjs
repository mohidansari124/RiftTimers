import { createRequire } from "node:module";
import path from "node:path";
import assert from "node:assert/strict";
import { mainWindow } from './test-window.mjs';
const require = createRequire(process.env.RIFT_NODE_MODULES + "/package.json"),
  { _electron } = require("playwright");
const app = await _electron.launch({
  executablePath: path.resolve("release/win-unpacked/RiftTimers.exe"),
  args: [],
  timeout: 30000,
});
try {
  const p = await mainWindow(app);
  await p.getByRole("heading", { name: "Every second counts." }).waitFor();
  await p.waitForTimeout(4000);
  const blocked = await p.evaluate(() => window.rift.safety());
  if (blocked) {
    assert.equal(
      await p
        .getByRole("button", { name: "Ahri Flash", exact: true })
        .first()
        .isDisabled(),
      true,
    );
    assert.equal(
      await p
        .getByRole("button", { name: "Open simulation overlay" })
        .isDisabled(),
      true,
    );
    console.log(
      "Packaged application launches; process safety guard blocks timers and overlay.",
    );
  } else {
    await p
      .getByRole("button", { name: "Ahri Flash", exact: true })
      .first()
      .click();
    assert.ok((await p.locator(".cooling").count()) > 0);
    console.log("Packaged application launches and timer works.");
  }
} finally {
  await app.close();
}
