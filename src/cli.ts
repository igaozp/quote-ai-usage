#!/usr/bin/env node
import { argv, env, exit } from "node:process";
import { collectAndPush } from "./push.js";

interface Args {
  cmd: "push" | "watch" | "help";
  dryRun: boolean;
  intervalSeconds: number;
}

function parseDuration(input: string): number {
  const match = /^(\d+(?:\.\d+)?)([smh])?$/.exec(input.trim());
  if (!match) throw new Error(`Bad duration: ${input}`);
  const n = parseFloat(match[1]!);
  switch (match[2]) {
    case "h":
      return n * 3600;
    case "m":
      return n * 60;
    case "s":
    case undefined:
      return n;
    default:
      throw new Error(`Bad duration unit in: ${input}`);
  }
}

function parseArgs(rawArgv: string[]): Args {
  const flat = rawArgv.slice(2);
  const positional = flat.filter((a) => !a.startsWith("-"));
  const cmdStr = positional[0] ?? "push";
  if (cmdStr !== "push" && cmdStr !== "watch" && cmdStr !== "help") {
    throw new Error(`Unknown command: ${cmdStr}`);
  }
  const intervalArg =
    flat.find((a) => a.startsWith("--interval="))?.slice("--interval=".length) ??
    env.USAGE_INTERVAL ??
    "30m";
  return {
    cmd: cmdStr,
    dryRun: flat.includes("--dry-run"),
    intervalSeconds: parseDuration(intervalArg),
  };
}

function printHelp() {
  console.log(
    [
      "quote-ai — push today's Claude Code & Codex CLI token usage to a Dot device.",
      "",
      "Usage:",
      "  quote-ai push [--dry-run]",
      "  quote-ai watch [--interval=30m] [--dry-run]",
      "  quote-ai help",
      "",
      "Env:",
      "  DOT_API_KEY, DOT_DEVICE_ID    required (unless --dry-run)",
      "  USAGE_TIMEZONE                default Asia/Shanghai",
      "  USAGE_INTERVAL                default 30m (watch mode)",
      "  CLAUDE_HOME, CODEX_HOME       override ~/.claude, ~/.codex",
      "  DEBUG_PNG                     write rendered PNG to this path",
    ].join("\n"),
  );
}

async function once(dryRun: boolean): Promise<void> {
  try {
    await collectAndPush({ env, dryRun, debugPng: env.DEBUG_PNG });
  } catch (err) {
    console.error("[push] failed:", err instanceof Error ? err.message : err);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(argv);

  if (args.cmd === "help") {
    printHelp();
    return;
  }

  if (args.cmd === "push") {
    await once(args.dryRun);
    return;
  }

  // watch
  console.log(
    `[watch] running every ${args.intervalSeconds}s (Ctrl-C to stop)`,
  );
  await once(args.dryRun);
  setInterval(() => {
    void once(args.dryRun);
  }, args.intervalSeconds * 1000);
  // keep the event loop alive
  await new Promise<never>(() => {});
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
