import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("rift", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (value: unknown) => ipcRenderer.invoke("settings:set", value),
  overlay: (visible: boolean) => ipcRenderer.invoke("overlay", visible),
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
  onSafety: (cb: (value: boolean) => void) => {
    const f = (_: unknown, v: boolean) => cb(v);
    ipcRenderer.on("safety", f);
    return () => ipcRenderer.removeListener("safety", f);
  },
  safety: () => ipcRenderer.invoke("safety"),
  version: () => ipcRenderer.invoke("version"),
});
