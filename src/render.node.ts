import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureResvgInit,
  renderUsageCard,
  type ColorMode,
  type UsageData,
} from "./render.js";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const fontsDir = resolve(here, "..", "assets", "fonts");

let initialized = false;
let cachedFonts: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;

async function initOnce() {
  if (initialized) return;
  const wasmPath = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
  const wasmBuf = await readFile(wasmPath);
  await ensureResvgInit(
    wasmBuf.buffer.slice(
      wasmBuf.byteOffset,
      wasmBuf.byteOffset + wasmBuf.byteLength,
    ),
  );
  initialized = true;
}

async function loadFont(filename: string): Promise<ArrayBuffer> {
  const path = resolve(fontsDir, filename);
  try {
    const buf = await readFile(path);
    return buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer;
  } catch {
    throw new Error(
      `Missing font: ${path}\n` +
        `Drop a static TTF here as '${filename}'. See assets/fonts/README.md.`,
    );
  }
}

async function loadFonts() {
  if (cachedFonts) return cachedFonts;
  const [regular, bold] = await Promise.all([
    loadFont("Regular.ttf"),
    loadFont("Bold.ttf"),
  ]);
  cachedFonts = { regular, bold };
  return cachedFonts;
}

export async function renderUsageCardLocal(
  data: UsageData,
  mode?: ColorMode,
): Promise<Uint8Array> {
  await initOnce();
  const { regular, bold } = await loadFonts();
  return renderUsageCard(data, {
    fonts: [
      { name: "UI", data: regular, weight: 400 },
      { name: "UI", data: bold, weight: 700 },
    ],
    mode,
  });
}
