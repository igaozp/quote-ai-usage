#!/usr/bin/env node
import { argv, env, exit } from "node:process";
import { resolve } from "node:path";
import { collectAndPush } from "./push.js";

type Cmd = "push" | "watch" | "preview" | "help";

interface Args {
  cmd: Cmd;
  dryRun: boolean;
  intervalSeconds: number;
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
  // For `preview`, the second positional is treated as output path:
  //   quote-ai preview ./out.png
  const outFromPositional =
    cmdStr === "preview" ? positional[1] : undefined;
  return {
    cmd: cmdStr,
    dryRun: flat.includes("--dry-run"),
    intervalSeconds: parseDuration(intervalArg),
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
      "  quote-ai push [--dry-run]                    collect + render + push",
      "  quote-ai watch [--interval=30m] [--dry-run]  loop in-process",
      "  quote-ai preview [out.png] [--open]          render only; no Dot call",
      "  quote-ai help",
      "",
      "Env:",
      "  DOT_API_KEY, DOT_DEVICE_ID    required for push/watch (preview ignores them)",
      "  USAGE_TIMEZONE                default Asia/Shanghai",
      "  USAGE_INTERVAL                default 30m (watch mode)",
      "  CLAUDE_HOME, CODEX_HOME       override ~/.claude, ~/.codex",
      "  DEBUG_PNG                     also write the rendered PNG to this path",
    ].join("\n"),
  );
}

async function once(dryRun: boolean, debugPng?: string): Promise<void> {
  try {
    await collectAndPush({ env, dryRun, debugPng });
  } catch (err) {
    console.error("[push] failed:", err instanceof Error ? err.message : err);
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
    await once(args.dryRun, env.DEBUG_PNG);
    return;
  }

  // watch
  console.log(
    `[watch] running every ${args.intervalSeconds}s (Ctrl-C to stop)`,
  );
  await once(args.dryRun, env.DEBUG_PNG);
  setInterval(() => {
    void once(args.dryRun, env.DEBUG_PNG);
  }, args.intervalSeconds * 1000);
  await new Promise<never>(() => {});
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
