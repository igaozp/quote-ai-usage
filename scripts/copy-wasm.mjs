import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const src = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
const dest = resolve(root, "src", "vendor", "resvg.wasm");

await mkdir(dirname(dest), { recursive: true });
await copyFile(src, dest);
console.log(`copied ${src}\n     -> ${dest}`);
