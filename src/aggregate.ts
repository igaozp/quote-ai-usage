import type { DailyUsage } from "./collectors/types.js";
import type { UsageData, UsageStat } from "./render.js";

export function buildUsageData(usage: DailyUsage): UsageData {
  const claude = usage.claude;
  const codex = usage.codex;

  const totalUsd = claude?.estUsd ?? 0;
  const claudeTokens = claude
    ? claude.inputTokens +
      claude.outputTokens +
      claude.cacheCreationTokens +
      claude.cacheReadTokens
    : 0;
  const codexTokens = codex?.totalTokens ?? 0;
  const primary = codex?.primary;

  const stats: UsageStat[] = [
    { label: "CC tok", value: formatTokens(claudeTokens) },
    { label: "CDX tok", value: formatTokens(codexTokens) },
    {
      label: "5h",
      value: primary ? `${primary.usedPercent.toFixed(0)}%` : "—",
    },
  ];

  return {
    title: "TODAY · CLI USAGE",
    primary: `$${totalUsd.toFixed(2)}`,
    secondary: claude
      ? `Claude $${claude.estUsd.toFixed(2)} · Codex Plus`
      : "Codex Plus",
    stats,
    updatedAt: new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
