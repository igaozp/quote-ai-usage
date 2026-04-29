#!/usr/bin/env bun
import { argv, env as rawEnv, exit } from "node:process";
import { resolve } from "node:path";
import { collectAndPush } from "./push.js";
import { throttledRun } from "./debounce.js";
import {
  resolveAppConfig,
  ConfigMissingError,
  type EnvLike,
} from "./config.js";
import type { ColorMode } from "./render.js";
import {
  deleteUserConfig,
  loadUserConfig,
  saveUserConfig,
  userConfigPath,
  type StoredConfig,
} from "./user-config.js";
import {
  isInteractive,
  maskSecret,
  promptHidden,
  promptText,
  promptYesNo,
} from "./prompt.js";

const env = rawEnv as EnvLike & Record<string, string | undefined>;

type Cmd = "push" | "watch" | "preview" | "config" | "help";

interface Args {
  cmd: Cmd;
  dryRun: boolean;
  intervalSeconds: number;
  cooldownSeconds: number;
  skipIfCooling: boolean;
  out?: string;
  open: boolean;
  show: boolean;
  reset: boolean;
  theme?: ColorMode;
}

function parseTheme(raw: string | undefined): ColorMode | undefined {
  if (raw === undefined) return undefined;
  if (raw === "light" || raw === "dark") return raw;
  throw new Error(`Bad --theme value: ${raw} (expected light|dark)`);
}

const VALID_CMDS: Cmd[] = ["push", "watch", "preview", "config", "help"];

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
    show: flat.includes("--show"),
    reset: flat.includes("--reset"),
    theme: parseTheme(pickFlag(flat, "--theme=")),
  };
}

function printHelp() {
  console.log(
    [
      "quote-ai — render today's Claude Code & Codex CLI token usage and push it to a Dot device.",
      "",
      "Usage:",
      "  quote-ai config [--show] [--reset]            interactive setup wizard",
      "  quote-ai push [--dry-run] [--cooldown=60s] [--skip-if-cooling]",
      "                                                collect + render + push (throttled)",
      "  quote-ai watch [--interval=30m] [--dry-run]   loop in-process",
      "  quote-ai preview [out.png] [--open] [--theme=light|dark]",
      "                                                render only; no Dot call",
      "  quote-ai help",
      "",
      "First-run flow:",
      "  Running `push` or `watch` without DOT_API_KEY / DOT_DEVICE_ID",
      "  triggers an interactive wizard that stores credentials in",
      "  ~/.config/quote-ai-usage/config.json (mode 0600).",
      "",
      "Env (override on-disk config when set):",
      "  DOT_API_KEY, DOT_DEVICE_ID, DOT_API_BASE_URL",
      "  USAGE_TIMEZONE                default Asia/Shanghai",
      "  USAGE_THEME                   light|dark; default light",
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

async function preview(
  out: string,
  openAfter: boolean,
  theme: ColorMode | undefined,
): Promise<void> {
  const absolute = resolve(out);
  await collectAndPush({ env, dryRun: true, debugPng: absolute, theme });
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

function showStored(stored: StoredConfig): void {
  console.log(`config file: ${userConfigPath()}`);
  console.log(
    `  apiKey:   ${stored.apiKey ? maskSecret(stored.apiKey) : "(not set)"}`,
  );
  console.log(`  deviceId: ${stored.deviceId ?? "(not set)"}`);
  console.log(`  baseUrl:  ${stored.baseUrl ?? "(default)"}`);
  console.log(`  theme:    ${stored.theme ?? "(default light)"}`);
}

async function configCmd(args: Args): Promise<void> {
  if (args.show) {
    showStored(await loadUserConfig());
    return;
  }
  if (args.reset) {
    const removed = await deleteUserConfig();
    console.log(
      removed
        ? `[config] removed ${userConfigPath()}`
        : "[config] nothing to remove",
    );
    return;
  }
  await runWizard({ allowSkipApiKey: false });
}

interface WizardOpts {
  /** When the wizard runs as a bootstrap step we require both fields. */
  allowSkipApiKey: boolean;
}

async function runWizard(_opts: WizardOpts): Promise<void> {
  if (!isInteractive()) {
    throw new Error(
      "Cannot run interactive setup: stdin/stdout is not a TTY.\n" +
        "Either run `quote-ai config` in a real terminal, or set " +
        "DOT_API_KEY and DOT_DEVICE_ID in the environment.",
    );
  }

  const existing = await loadUserConfig();
  console.log(`[config] writing to ${userConfigPath()}`);
  console.log(
    "        Env vars (DOT_API_KEY / DOT_DEVICE_ID / DOT_API_BASE_URL)",
  );
  console.log("        will continue to take precedence over this file.\n");

  const apiKeyHint = existing.apiKey
    ? ` (current ${maskSecret(existing.apiKey)} — leave empty to keep)`
    : "";
  const apiKeyInput = await promptHidden(`API Key${apiKeyHint}: `);
  const apiKey = apiKeyInput.trim() || existing.apiKey;
  if (!apiKey) {
    console.error("[config] apiKey is required.");
    exit(1);
  }

  const deviceId = (
    await promptText("Device ID", existing.deviceId)
  ).trim();
  if (!deviceId) {
    console.error("[config] deviceId is required.");
    exit(1);
  }

  const customBase = await promptYesNo(
    "Use a custom Dot API base URL?",
    Boolean(existing.baseUrl),
  );
  let baseUrl: string | undefined;
  if (customBase) {
    const answer = (
      await promptText("Base URL", existing.baseUrl)
    ).trim();
    baseUrl = answer || existing.baseUrl;
  }

  const themeDefault: ColorMode = existing.theme ?? "light";
  let theme: ColorMode = themeDefault;
  while (true) {
    const answer = (await promptText("Color mode (light/dark)", themeDefault))
      .trim()
      .toLowerCase();
    if (answer === "light" || answer === "dark") {
      theme = answer;
      break;
    }
    console.error(`[config] invalid theme: ${answer}; please type light or dark.`);
  }

  const path = await saveUserConfig({ apiKey, deviceId, baseUrl, theme });
  console.log(`[config] saved → ${path}`);
}

async function ensureConfigured(): Promise<boolean> {
  try {
    await resolveAppConfig(env);
    return true;
  } catch (err) {
    if (!(err instanceof ConfigMissingError)) throw err;
    if (!isInteractive()) {
      console.error(
        `[config] missing ${err.missing.join(", ")}. Run \`quote-ai config\` ` +
          "interactively, or set DOT_API_KEY / DOT_DEVICE_ID in the env.",
      );
      return false;
    }
    console.log(
      "[config] No DOT credentials yet — let's set them up.\n",
    );
    await runWizard({ allowSkipApiKey: false });
    return true;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(argv);

  if (args.cmd === "help") {
    printHelp();
    return;
  }

  if (args.cmd === "config") {
    await configCmd(args);
    return;
  }

  if (args.cmd === "preview") {
    // Preview never touches Dot — no config needed.
    await preview(args.out ?? "preview.png", args.open, args.theme);
    return;
  }

  // push / watch path: ensure credentials exist (interactive bootstrap if TTY)
  if (!args.dryRun) {
    const ok = await ensureConfigured();
    if (!ok) {
      exit(1);
    }
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
