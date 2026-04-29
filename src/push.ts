import { writeFile } from "node:fs/promises";
import { collectClaude } from "./collectors/claude.js";
import { collectCodex } from "./collectors/codex.js";
import { dateInTz } from "./collectors/util.js";
import type { DailyUsage } from "./collectors/types.js";
import { buildUsageData } from "./aggregate.js";
import { renderUsageCardLocal } from "./render.node.js";
import { DotClient, pngBytesToBase64 } from "./dot-client.js";
import {
  resolveAppConfig,
  resolveTheme,
  resolveTimezone,
  type EnvLike,
} from "./config.js";
import { loadUserConfig } from "./user-config.js";
import type { ColorMode, UsageData } from "./render.js";

export interface PushOptions {
  env: EnvLike;
  dryRun?: boolean;
  debugPng?: string;
  date?: Date;
  /** Override the resolved theme (light|dark). Wins over env / file. */
  theme?: ColorMode;
}

export interface PushResult {
  data: UsageData;
  usage: DailyUsage;
  pushed: boolean;
  png: Uint8Array;
}

export async function collectAndPush(opts: PushOptions): Promise<PushResult> {
  const tz = resolveTimezone(opts.env);
  const date = opts.date ?? new Date();

  const [claude, codex] = await Promise.all([
    collectClaude({
      date,
      timezone: tz,
      home: opts.env.CLAUDE_HOME?.trim() || undefined,
    }).catch((err) => {
      console.error("[claude] collect failed:", err);
      return null;
    }),
    collectCodex({
      date,
      timezone: tz,
      home: opts.env.CODEX_HOME?.trim() || undefined,
    }).catch((err) => {
      console.error("[codex] collect failed:", err);
      return null;
    }),
  ]);

  const usage: DailyUsage = {
    date: dateInTz(date.getTime(), tz),
    timezone: tz,
    claude,
    codex,
  };
  const data = buildUsageData(usage);

  // Theme is resolved separately from credentials so dryRun/preview works
  // even when apiKey / deviceId are missing.
  const theme =
    opts.theme ?? resolveTheme(opts.env, await loadUserConfig());
  const png = await renderUsageCardLocal(data, theme);

  if (opts.debugPng) {
    await writeFile(opts.debugPng, png);
    console.log(
      `[preview] ${opts.debugPng} (${png.byteLength} bytes)`,
    );
  }

  if (opts.dryRun) {
    console.log("[dry-run]", JSON.stringify(data, null, 2));
    return { data, usage, pushed: false, png };
  }

  const config = await resolveAppConfig(opts.env);
  const client = new DotClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  });
  const res = await client.pushImage(config.deviceId, {
    image: pngBytesToBase64(png),
    refreshNow: true,
    border: theme === "dark" ? 1 : 0,
    ditherType: "DIFFUSION",
    ditherKernel: "FLOYD_STEINBERG",
  });
  console.log("[push] ok:", res.message);
  return { data, usage, pushed: true, png };
}
