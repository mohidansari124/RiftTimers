import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(process.env.RIFT_NODE_MODULES + "/package.json");
const sharp = require("sharp");
const svg =
  '<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="248" height="248" rx="52" fill="#15191f" stroke="#51452b" stroke-width="8"/><path d="M128 32 214 128 128 224 42 128Z" fill="none" stroke="#c89b3c" stroke-width="12"/><path d="M128 74v57l36 20" fill="none" stroke="#f0e0ba" stroke-width="14" stroke-linecap="round"/><circle cx="128" cy="131" r="10" fill="#c89b3c"/></svg>';
const png = await sharp(Buffer.from(svg)).png().toBuffer();
await mkdir("apps/desktop/build", { recursive: true });
await mkdir("apps/desktop/public/assets", { recursive: true });
await writeFile("apps/desktop/public/assets/icon.png", png);
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
await writeFile("apps/desktop/build/icon.ico", Buffer.concat([header, png]));
