// Main and overlay windows can finish loading in either order.
export async function mainWindow(app) {
  await app.firstWindow();
  for (let i = 0; i < 100; i++) {
    const page = app.windows().find(w => w.url().includes('index.html') && !w.url().endsWith('#overlay'));
    if (page) return page;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Main application window did not load');
}
