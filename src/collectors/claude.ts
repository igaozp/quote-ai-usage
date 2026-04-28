import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import {
  estimateUsd,
  priceFor,
  type TokenCounts,
} from "./pricing.js";
import type { ClaudeMetric, ClaudeModelMetric } from "./types.js";
import { dateInTz } from "./util.js";

export interface ClaudeCollectorOptions {
  /** Override ~/.claude root */
  home?: string;
  /** Date used to derive "today" in the given timezone */
  date: Date;
  timezone: string;
}

export async function collectClaude(
  opts: ClaudeCollectorOptions,
): Promise<ClaudeMetric> {
  const home = opts.home ?? join(homedir(), ".claude");
  const projectsDir = join(home, "projects");
  const total = emptyMetric();
  const today = dateInTz(opts.date.getTime(), opts.timezone);

  let projectSlugs: string[];
  try {
    projectSlugs = await readdir(projectsDir);
  } catch {
    return total;
  }

  // Files whose mtime is older than start of the previous calendar day in any
  // tz can never contribute — use a generous 36h window cutoff.
  const minMtime = opts.date.getTime() - 36 * 3600 * 1000;

  for (const slug of projectSlugs) {
    const dir = join(projectsDir, slug);
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!name.endsWith(".jsonl")) continue;
      const path = join(dir, name);
      try {
        const st = await stat(path);
        if (st.mtimeMs < minMtime) continue;
      } catch {
        continue;
      }
      await accumulateFile(path, today, opts.timezone, total);
    }
  }

  return total;
}

function emptyMetric(): ClaudeMetric {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    estUsd: 0,
    byModel: {},
  };
}

async function accumulateFile(
  path: string,
  todayStr: string,
  tz: string,
  total: ClaudeMetric,
): Promise<void> {
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
    const record = obj as ClaudeRecord;
    const usage = record?.message?.usage;
    if (!usage) continue;
    const ts = record.timestamp ? Date.parse(record.timestamp) : NaN;
    if (!Number.isFinite(ts)) continue;
    if (dateInTz(ts, tz) !== todayStr) continue;

    const counts: TokenCounts = {
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    };
    const model = record.message?.model ?? "unknown";
    const usd = estimateUsd(priceFor(model), counts);

    total.inputTokens += counts.inputTokens;
    total.outputTokens += counts.outputTokens;
    total.cacheCreationTokens += counts.cacheCreationTokens;
    total.cacheReadTokens += counts.cacheReadTokens;
    total.estUsd += usd;

    let perModel = total.byModel[model];
    if (!perModel) {
      perModel = total.byModel[model] = {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        estUsd: 0,
      };
    }
    addInto(perModel, counts, usd);
  }
}

function addInto(
  m: ClaudeModelMetric,
  inc: TokenCounts,
  usd: number,
): void {
  m.inputTokens += inc.inputTokens;
  m.outputTokens += inc.outputTokens;
  m.cacheCreationTokens += inc.cacheCreationTokens;
  m.cacheReadTokens += inc.cacheReadTokens;
  m.estUsd += usd;
}

interface ClaudeRecord {
  timestamp?: string;
  message?: {
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
}
