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
import path from "node:path";
import { startGameClient } from "./game-client";
import type { GameUpdate } from "@rift/shared/game-data";
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
  lastState: unknown;
const parsedSettings = settingsSchema.safeParse(store.get("settings"));
let settings = parsedSettings.success ? parsedSettings.data : defaultSettings;
let gameUpdate: GameUpdate = {
  status: "Waiting for League game data",
  sequence: 0,
  reset: false,
};
const dev = process.env.RIFT_DEV === "1";
function trusted(e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) {
  return (
    [main?.webContents, overlay?.webContents].includes(e.sender) &&
    e.senderFrame === e.sender.mainFrame
  );
}
function showOverlay(visible: boolean) {
  if (visible) {
    overlay.setAlwaysOnTop(true, "screen-saver");
    overlay.showInactive();
    overlay.moveTop();
  } else overlay.hide();
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
  if (
    (s.x !== settings.x || s.y !== settings.y) &&
    s.x !== undefined &&
    s.y !== undefined
  )
    overlay.setPosition(s.x, s.y);
  app.setLoginItemSettings({ openAtLogin: s.startup });
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
    fullscreenable: false,
    minimizable: false,
    webPreferences,
  });
  overlay.setAlwaysOnTop(true, "screen-saver");
  const raiseOverlay = () => {
    if (!overlay.isDestroyed() && overlay.isVisible()) {
      overlay.setAlwaysOnTop(true, "screen-saver");
      overlay.moveTop();
    }
  };
  overlay.on("blur", raiseOverlay);
  const topmostTimer = setInterval(raiseOverlay, 2000);
  function sendSettings() {
    for (const w of [main, overlay])
      if (!w.isDestroyed()) w.webContents.send("settings:changed", settings);
  }
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
    boundsTimer = setTimeout(() => {
      const bounds = overlay.getBounds();
      store.set("bounds", bounds);
      settings = { ...settings, x: bounds.x, y: bounds.y };
      store.set("settings", settings);
      sendSettings();
    }, 250);
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
  const stopGameClient = startGameClient(
    () => settings.autoLineup,
    (update) => {
      gameUpdate = update;
      if (!main.isDestroyed()) main.webContents.send("game:update", update);
    },
  );
  app.on("before-quit", () => {
    quitting = true;
    clearInterval(topmostTimer);
    clearTimeout(boundsTimer);
    stopGameClient();
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
    sendSettings();
    return next;
  });
  ipcMain.handle("game:get", (e) => {
    if (!trusted(e) || e.sender !== main.webContents) throw Error("Forbidden");
    return gameUpdate;
  });
  ipcMain.handle("overlay:control", (e, action) => {
    if (!trusted(e) || !["toggle-lock", "center", "raise"].includes(action))
      throw Error("Forbidden");
    if (action === "toggle-lock") {
      const next = { ...settings, locked: !settings.locked };
      apply(next);
      settings = next;
      store.set("settings", settings);
      sendSettings();
    }
    if (action === "center") {
      const d = screen.getDisplayNearestPoint(
        screen.getCursorScreenPoint(),
      ).workArea;
      const b = overlay.getBounds();
      overlay.setPosition(
        Math.round(d.x + (d.width - b.width) / 2),
        Math.round(d.y + (d.height - b.height) / 2),
      );
      showOverlay(true);
    }
    if (action === "raise") showOverlay(true);
    return settings;
  });
  ipcMain.handle("overlay", (e, v) => {
    if (!trusted(e) || typeof v !== "boolean") throw Error("Forbidden");
    showOverlay(v);
    return overlay.isVisible();
  });
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
    if (trusted(e)) {
      const parsed = commandSchema.safeParse(v);
      if (parsed.success) main.webContents.send("action", parsed.data);
    }
  });
});
app.on("will-quit", () => globalShortcut.unregisterAll());
