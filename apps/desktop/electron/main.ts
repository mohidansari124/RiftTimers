import {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  screen,
} from "electron";
import Store from "electron-store";
import { execFile } from "node:child_process";
import path from "node:path";
import {
  defaultSettings,
  settingsSchema,
  commandSchema,
  type Settings,
} from "@rift/shared";
const second = process.argv.includes("--second-client");
if (second)
  app.setPath(
    "userData",
    path.join(app.getPath("appData"), "RiftTimers-second"),
  );
const store = new Store<{ settings: Settings; bounds?: Electron.Rectangle }>({
  defaults: { settings: defaultSettings },
});
let main: BrowserWindow,
  overlay: BrowserWindow,
  tray: Tray,
  quitting = false,
  blocked = true,
  lastState: unknown;
let settings = settingsSchema.safeParse(store.get("settings")).success
  ? store.get("settings")
  : defaultSettings;
const dev = process.env.RIFT_DEV === "1";
function trusted(e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) {
  return (
    [main?.webContents, overlay?.webContents].includes(e.sender) &&
    e.senderFrame === e.sender.mainFrame
  );
}
function showOverlay(visible: boolean) {
  if (visible && !blocked) overlay.show();
  else overlay.hide();
}
function registerHotkey(value: string) {
  globalShortcut.unregisterAll();
  if (!globalShortcut.register(value, () => showOverlay(!overlay.isVisible())))
    throw Error("Hotkey is unavailable. Choose another combination.");
}
function apply(s: Settings) {
  overlay.setOpacity(s.opacity);
  overlay.setMovable(!s.locked);
  overlay.setResizable(!s.locked);
  if (s.x !== undefined && s.y !== undefined) overlay.setPosition(s.x, s.y);
  app.setLoginItemSettings({ openAtLogin: s.startup });
}
function guard() {
  execFile(
    "tasklist.exe",
    ["/FI", "IMAGENAME eq League of Legends.exe", "/FO", "CSV", "/NH"],
    { windowsHide: true, timeout: 4000 },
    (err, out) => {
      blocked = !!err || out.toLowerCase().includes("league of legends.exe");
      if (blocked) overlay?.hide();
      for (const w of [main, overlay])
        if (w && !w.isDestroyed()) w.webContents.send("safety", blocked);
    },
  );
}
function secure(w: BrowserWindow) {
  w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  w.webContents.on("will-navigate", (e) => e.preventDefault());
  w.webContents.session.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
}
app.whenReady().then(() => {
  const webPreferences = {
    preload: path.join(__dirname, "preload.cjs"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };
  main = new BrowserWindow({
    width: 1220,
    height: 850,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: "#111318",
    title: "RiftTimers • Simulation",
    webPreferences,
    autoHideMenuBar: true,
  });
  const saved = store.get("bounds");
  const valid =
    saved &&
    screen
      .getAllDisplays()
      .some(
        (d) =>
          saved.x >= d.bounds.x &&
          saved.y >= d.bounds.y &&
          saved.x < d.bounds.x + d.bounds.width - 40 &&
          saved.y < d.bounds.y + d.bounds.height - 40,
      );
  overlay = new BrowserWindow({
    width: 252,
    height: 390,
    ...(valid ? saved : {}),
    minWidth: 200,
    minHeight: 260,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    show: false,
    skipTaskbar: true,
    webPreferences,
  });
  for (const w of [main, overlay]) secure(w);
  const load = (w: BrowserWindow, hash: string) =>
    dev
      ? w.loadURL(`http://127.0.0.1:5173/#${hash}`)
      : w.loadFile(path.join(__dirname, "../dist/index.html"), { hash });
  void load(main, "");
  void load(overlay, "overlay");
  overlay.webContents.on("did-finish-load", () => {
    if (lastState) overlay.webContents.send("state", lastState);
  });
  overlay.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      overlay.hide();
    }
  });
  let boundsTimer: ReturnType<typeof setTimeout>;
  const saveBounds = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(
      () => store.set("bounds", overlay.getBounds()),
      250,
    );
  };
  overlay.on("moved", saveBounds);
  overlay.on("resized", saveBounds);
  main.on("close", (e) => {
    if (!quitting && settings.tray) {
      e.preventDefault();
      main.hide();
    } else {
      quitting = true;
      app.quit();
    }
  });
  tray = new Tray(
    nativeImage.createFromPath(path.join(__dirname, "../dist/assets/icon.png")),
  );
  tray.setToolTip("RiftTimers · standalone simulation");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open RiftTimers", click: () => main.show() },
      {
        label: "Toggle simulation overlay",
        click: () => showOverlay(!overlay.isVisible()),
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("double-click", () => main.show());
  try {
    registerHotkey(settings.hotkey);
  } catch {}
  apply(settings);
  guard();
  const interval = setInterval(guard, 3000);
  app.on("before-quit", () => {
    quitting = true;
    clearInterval(interval);
  });
  ipcMain.handle("settings:get", (e) => {
    if (!trusted(e)) throw Error("Forbidden");
    return settings;
  });
  ipcMain.handle("settings:set", (e, raw) => {
    if (!trusted(e) || e.sender !== main.webContents) throw Error("Forbidden");
    const next = settingsSchema.parse(raw);
    if (next.hotkey !== settings.hotkey) {
      try {
        registerHotkey(next.hotkey);
      } catch (err) {
        registerHotkey(settings.hotkey);
        throw err;
      }
    }
    apply(next);
    settings = next;
    store.set("settings", next);
    return next;
  });
  ipcMain.handle("overlay", (e, v) => {
    if (!trusted(e) || typeof v !== "boolean") throw Error("Forbidden");
    showOverlay(v);
    return !blocked;
  });
  ipcMain.handle("safety", () => blocked);
  ipcMain.handle("version", () => app.getVersion());
  ipcMain.on("state:publish", (e, v) => {
    if (
      trusted(e) &&
      e.sender === main.webContents &&
      JSON.stringify(v).length < 100000
    ) {
      lastState = v;
      overlay.webContents.send("state", v);
    }
  });
  ipcMain.on("state:action", (e, v) => {
    if (trusted(e) && !blocked) {
      const parsed = commandSchema.safeParse(v);
      if (parsed.success) main.webContents.send("action", parsed.data);
    }
  });
});
app.on("will-quit", () => globalShortcut.unregisterAll());
