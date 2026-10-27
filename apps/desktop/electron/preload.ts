import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("rift", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (value: unknown) => ipcRenderer.invoke("settings:set", value),
  overlay: (visible: boolean) => ipcRenderer.invoke("overlay", visible),
  overlayControl: (action: "toggle-lock" | "center" | "raise") =>
    ipcRenderer.invoke("overlay:control", action),
  getGame: () => ipcRenderer.invoke("game:get"),
  onGame: (cb: (v: unknown) => void) => {
    const f = (_: unknown, v: unknown) => cb(v);
    ipcRenderer.on("game:update", f);
    return () => ipcRenderer.removeListener("game:update", f);
  },
  onSettings: (cb: (v: unknown) => void) => {
    const f = (_: unknown, v: unknown) => cb(v);
    ipcRenderer.on("settings:changed", f);
    return () => ipcRenderer.removeListener("settings:changed", f);
  },
  publish: (value: unknown) => ipcRenderer.send("state:publish", value),
  action: (value: unknown) => ipcRenderer.send("state:action", value),
  onState: (cb: (value: unknown) => void) => {
    const f = (_: unknown, v: unknown) => cb(v);
    ipcRenderer.on("state", f);
    return () => ipcRenderer.removeListener("state", f);
  },
  onAction: (cb: (value: unknown) => void) => {
    const f = (_: unknown, v: unknown) => cb(v);
    ipcRenderer.on("action", f);
    return () => ipcRenderer.removeListener("action", f);
  },
  version: () => ipcRenderer.invoke("version"),
});
