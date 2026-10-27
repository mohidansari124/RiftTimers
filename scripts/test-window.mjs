// Main and overlay windows can finish loading in either order.
export async function mainWindow(app) {
  await app.firstWindow();
  for (let i = 0; i < 100; i++) {
    const page = app
      .windows()
      .find(
        (w) => w.url().includes("index.html") && !w.url().endsWith("#overlay"),
      );
    if (page) return page;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Main application window did not load");
}
// Keep fixture-based smoke tests independent of any game running on the machine.
export async function manualFixture(page) {
  const previous = await page.evaluate(async () => {
    const s = await window.rift.getSettings();
    await window.rift.saveSettings({ ...s, autoLineup: false });
    return s;
  });
  await page
    .getByRole("button", { name: "Champion Setup", exact: true })
    .click();
  await page.getByRole("button", { name: "Reset lineup", exact: true }).click();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  return () => page.evaluate((s) => window.rift.saveSettings(s), previous);
}
