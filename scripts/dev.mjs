import { spawn } from "node:child_process";
const children = [];
const run = (args, env = {}) => {
  const p = spawn(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  children.push(p);
  return p;
};
run(["--filter", "@rift/server", "dev"]);
run(["--filter", "@rift/desktop", "dev"]);
for (let n = 0; n < 60; n++) {
  try {
    await fetch("http://127.0.0.1:5173");
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
const b = run(["--filter", "@rift/desktop", "exec", "node", "build.mjs"]);
b.on("exit", (code) => {
  if (code === 0)
    run(["--filter", "@rift/desktop", "exec", "electron", "."], {
      RIFT_DEV: "1",
    });
});
process.on("SIGINT", () => {
  children.forEach((p) => p.kill());
  process.exit();
});
