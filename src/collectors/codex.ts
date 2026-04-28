import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { CodexMetric, CodexRateLimit } from "./types.js";
import { dateInTz, utcPathParts } from "./util.js";

export interface CodexCollectorOptions {
  /** Override ~/.codex root */
  home?: string;
  date: Date;
  timezone: string;
}

export async function collectCodex(
  opts: CodexCollectorOptions,
): Promise<CodexMetric> {
  const home = opts.home ?? join(homedir(), ".codex");
  const todayStr = dateInTz(opts.date.getTime(), opts.timezone);
  const total = emptyMetric();

  // Codex names directories by UTC date, so a single local day can span up to
  // three UTC date directories. Scan ±1 UTC day to cover any timezone offset.
  const candidateDirs = new Set<string>();
  for (const offsetMs of [-86_400_000, 0, 86_400_000]) {
    const { y, m, d } = utcPathParts(opts.date.getTime() + offsetMs);
    candidateDirs.add(join(home, "sessions", y, m, d));
  }

  let latestRateLimitTs = -Infinity;

  for (const dir of candidateDirs) {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!name.endsWith(".jsonl")) continue;
      const path = join(dir, name);
      latestRateLimitTs = await accumulateFile(
        path,
        todayStr,
        opts.timezone,
        total,
        latestRateLimitTs,
      );
    }
  }

  return total;
}

function emptyMetric(): CodexMetric {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    primary: null,
    secondary: null,
  };
}

async function accumulateFile(
  path: string,
  todayStr: string,
  tz: string,
  total: CodexMetric,
  latestRateLimitTs: number,
): Promise<number> {
  const stream = createReadStream(path, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.length < 20) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const rec = obj as CodexRecord;
    if (rec.type !== "event_msg") continue;
    if (rec.payload?.type !== "token_count") continue;

    const ts = rec.timestamp ? Date.parse(rec.timestamp) : NaN;
    if (!Number.isFinite(ts)) continue;
    if (dateInTz(ts, tz) !== todayStr) continue;

    const last = rec.payload.info?.last_token_usage;
    if (last) {
      total.inputTokens += last.input_tokens ?? 0;
      total.cachedInputTokens += last.cached_input_tokens ?? 0;
      total.outputTokens += last.output_tokens ?? 0;
      total.reasoningTokens += last.reasoning_output_tokens ?? 0;
      total.totalTokens += last.total_tokens ?? 0;
    }

    const limits = rec.payload.rate_limits;
    if (limits && ts > latestRateLimitTs) {
      latestRateLimitTs = ts;
      total.primary = toRateLimit(limits.primary);
      total.secondary = toRateLimit(limits.secondary);
    }
  }
  return latestRateLimitTs;
}

function toRateLimit(
  raw: CodexRateLimitRaw | null | undefined,
): CodexRateLimit | null {
  if (!raw) return null;
  return {
    usedPercent: raw.used_percent ?? 0,
    windowMinutes: raw.window_minutes ?? 0,
    resetsAt: raw.resets_at ?? 0,
  };
}

interface CodexRecord {
  type?: string;
  timestamp?: string;
  payload?: {
    type?: string;
    info?: {
      total_token_usage?: CodexUsageRaw;
      last_token_usage?: CodexUsageRaw;
    } | null;
    rate_limits?: {
      primary?: CodexRateLimitRaw | null;
      secondary?: CodexRateLimitRaw | null;
    };
  };
}

interface CodexUsageRaw {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
  total_tokens?: number;
}

interface CodexRateLimitRaw {
  used_percent?: number;
  window_minutes?: number;
  resets_at?: number;
}
