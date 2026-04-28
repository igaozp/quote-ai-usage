#!/usr/bin/env bun
import { argv, env as rawEnv, exit } from "node:process";
import { resolve } from "node:path";
import { collectAndPush } from "./push.js";
import { throttledRun } from "./debounce.js";
import type { EnvLike } from "./config.js";

const env = rawEnv as EnvLike & Record<string, string | undefined>;

type Cmd = "push" | "watch" | "preview" | "help";

interface Args {
  cmd: Cmd;
  dryRun: boolean;
  intervalSeconds: number;
  cooldownSeconds: number;
  skipIfCooling: boolean;
  out?: string;
  open: boolean;
}

const VALID_CMDS: Cmd[] = ["push", "watch", "preview", "help"];

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

function pickFlag(flat: string[], prefix: string): string | undefined {
  const hit = flat.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function parseArgs(rawArgv: string[]): Args {
  const flat = rawArgv.slice(2);
  const positional = flat.filter((a) => !a.startsWith("-"));
  const cmdStr = (positional[0] ?? "push") as Cmd;
  if (!VALID_CMDS.includes(cmdStr)) {
    throw new Error(`Unknown command: ${cmdStr}`);
  }
  const intervalArg =
    pickFlag(flat, "--interval=") ?? env.USAGE_INTERVAL ?? "30m";
  const cooldownArg =
    pickFlag(flat, "--cooldown=") ?? env.USAGE_COOLDOWN ?? "60s";
  const outFromPositional =
    cmdStr === "preview" ? positional[1] : undefined;
  return {
    cmd: cmdStr,
    dryRun: flat.includes("--dry-run"),
    intervalSeconds: parseDuration(intervalArg),
    cooldownSeconds: parseDuration(cooldownArg),
    skipIfCooling: flat.includes("--skip-if-cooling"),
    out: pickFlag(flat, "--out=") ?? outFromPositional,
    open: flat.includes("--open"),
  };
}

function printHelp() {
  console.log(
    [
      "quote-ai — render today's Claude Code & Codex CLI token usage and push it to a Dot device.",
      "",
      "Usage:",
      "  quote-ai push [--dry-run] [--cooldown=60s] [--skip-if-cooling]",
      "                                                collect + render + push (throttled)",
      "  quote-ai watch [--interval=30m] [--dry-run]  loop in-process",
      "  quote-ai preview [out.png] [--open]          render only; no Dot call",
      "  quote-ai help",
      "",
      "Env:",
      "  DOT_API_KEY, DOT_DEVICE_ID    required for push/watch (preview ignores them)",
      "  USAGE_TIMEZONE                default Asia/Shanghai",
      "  USAGE_INTERVAL                default 30m (watch mode)",
      "  USAGE_COOLDOWN                default 60s; min seconds between pushes; 0 disables",
      "  CLAUDE_HOME, CODEX_HOME       override ~/.claude, ~/.codex",
      "  DEBUG_PNG                     also write the rendered PNG to this path",
      "  QUOTE_AI_CACHE                cache dir for lock+state (default ~/.cache/quote-ai-usage)",
    ].join("\n"),
  );
}

async function runOnce(dryRun: boolean, debugPng?: string): Promise<void> {
  await collectAndPush({ env, dryRun, debugPng });
}

async function pushOnce(
  cooldownSec: number,
  dryRun: boolean,
  skipIfCooling: boolean,
  debugPng?: string,
): Promise<void> {
  // dry-run is a local-only convenience; never throttle it.
  if (dryRun || cooldownSec === 0) {
    try {
      await runOnce(dryRun, debugPng);
    } catch (err) {
      console.error("[push] failed:", err instanceof Error ? err.message : err);
    }
    return;
  }
  const wrapped = async () => {
    try {
      await runOnce(false, debugPng);
    } catch (err) {
      console.error("[push] failed:", err instanceof Error ? err.message : err);
    }
  };
  const result = await throttledRun(wrapped, {
    cooldownMs: cooldownSec * 1000,
    cacheDir: env.QUOTE_AI_CACHE,
    mode: skipIfCooling ? "skip" : "wait",
    onWait: (ms) =>
      console.log(`[debounce] waiting ${ms}ms (cooldown) before pushing…`),
  });
  if (!result.ran) {
    if (result.reason === "cooling") {
      console.log(
        `[debounce] still cooling (${result.cooldownRemainingMs}ms left); skipped.`,
      );
    } else {
      console.log("[debounce] another push in progress; skipped.");
    }
  }
}

async function preview(out: string, openAfter: boolean): Promise<void> {
  const absolute = resolve(out);
  await collectAndPush({ env, dryRun: true, debugPng: absolute });
  console.log(`[preview] PNG written: ${absolute}`);
  if (openAfter) await openInOs(absolute);
}

async function openInOs(path: string): Promise<void> {
  const { spawn } = await import("node:child_process");
  const cmd =
    process.platform === "win32"
      ? { bin: "cmd", args: ["/c", "start", "", path] }
      : process.platform === "darwin"
        ? { bin: "open", args: [path] }
        : { bin: "xdg-open", args: [path] };
  const child = spawn(cmd.bin, cmd.args, { stdio: "ignore", detached: true });
  child.unref();
}

async function main(): Promise<void> {
  const args = parseArgs(argv);

  if (args.cmd === "help") {
    printHelp();
    return;
  }

  if (args.cmd === "preview") {
    await preview(args.out ?? "preview.png", args.open);
    return;
  }

  if (args.cmd === "push") {
    await pushOnce(
      args.cooldownSeconds,
      args.dryRun,
      args.skipIfCooling,
      env.DEBUG_PNG,
    );
    return;
  }

  // watch
  console.log(
    `[watch] running every ${args.intervalSeconds}s (Ctrl-C to stop)`,
  );
  await pushOnce(
    args.cooldownSeconds,
    args.dryRun,
    args.skipIfCooling,
    env.DEBUG_PNG,
  );
  setInterval(() => {
    void pushOnce(
      args.cooldownSeconds,
      args.dryRun,
      args.skipIfCooling,
      env.DEBUG_PNG,
    );
  }, args.intervalSeconds * 1000);
  await new Promise<never>(() => {});
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
