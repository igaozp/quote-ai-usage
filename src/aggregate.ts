import type { DailyUsage } from "./collectors/types.js";
import type { CardRow, UsageData } from "./render.js";

export function buildUsageData(usage: DailyUsage): UsageData {
  return {
    title: "AI USAGE",
    rows: [buildClaudeRow(usage), buildCodexRow(usage)],
  };
}

function buildClaudeRow(usage: DailyUsage): CardRow {
  const claude = usage.claude;
  const dayPct = dayProgressPercent(usage.timezone);
  if (!claude) {
    return {
      label: "CLAUDE",
      primary: "—",
      progressPct: dayPct,
      meta: `RESETS ${formatCountdown(secondsUntilMidnight(usage.timezone))}`,
    };
  }
  if (claude.rateLimit) {
    const rl = claude.rateLimit;
    const pct = rl.utilization * 100;
    const remainingSec = rl.resetsAt - Math.floor(Date.now() / 1000);
    return {
      label: "CLAUDE",
      primary: `${Math.round(pct)}% USED`,
      progressPct: pct,
      meta: `RESETS ${formatCountdown(remainingSec)}`,
    };
  }
  const tokens =
    claude.inputTokens +
    claude.outputTokens +
    claude.cacheCreationTokens +
    claude.cacheReadTokens;
  return {
    label: "CLAUDE",
    primary: `$${claude.estUsd.toFixed(2)}`,
    progressPct: dayPct,
    meta: `${formatTokens(tokens)} · ${nowHHMM()}`,
  };
}

function buildCodexRow(usage: DailyUsage): CardRow {
  const codex = usage.codex;
  const primary = codex?.primary;
  if (!codex || !primary) {
    return {
      label: "CODEX",
      primary: codex ? "0% USED" : "—",
      secondary: codex ? "no quota data yet" : "no data",
      meta: codex ? "RESETS —" : nowHHMM(),
    };
  }
  const pct = primary.usedPercent;
  const remainingSec = primary.resetsAt - Math.floor(Date.now() / 1000);
  return {
    label: "CODEX",
    primary: `${Math.round(pct)}% USED`,
    progressPct: pct,
    meta: `RESETS ${formatCountdown(remainingSec)}`,
  };
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatCountdown(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "now";
  const totalMin = Math.floor(seconds / 60);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}D ${hours}H`;
  if (hours > 0) return `${hours}H ${mins}M`;
  return `${mins}M`;
}

function nowHHMM(): string {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Percentage of the local day already elapsed (0 at local 00:00, 100 at 24:00).
 * Used as a "soft" progress indicator for Claude (which has no real session
 * quota in its on-disk data).
 */
function dayProgressPercent(tz: string): number {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(now)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  const h = Number(parts.hour ?? "0");
  const m = Number(parts.minute ?? "0");
  const s = Number(parts.second ?? "0");
  return ((h * 3600 + m * 60 + s) / 86400) * 100;
}

function secondsUntilMidnight(tz: string): number {
  const pct = dayProgressPercent(tz);
  return Math.round(((100 - pct) / 100) * 86400);
}
