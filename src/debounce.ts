import { mkdir, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export type ThrottleMode = "wait" | "skip";

export interface ThrottleOptions {
  cacheDir?: string;
  cooldownMs: number;
  /** Lock files older than this are considered stale and reclaimed. */
  staleAfterMs?: number;
  /** Called once before sleeping for the remaining cooldown. */
  onWait?: (ms: number) => void;
  /**
   * 'wait'  (default): sleep through the remaining cooldown then run.
   * 'skip'  : if still cooling, return ran=false reason='cooling'.
   */
  mode?: ThrottleMode;
}

export interface ThrottleResult {
  ran: boolean;
  reason?: "locked" | "cooling";
  waitedMs?: number;
  cooldownRemainingMs?: number;
}

interface State {
  lastPushAt: number;
}

export function defaultCacheDir(): string {
  return join(homedir(), ".cache", "quote-ai-usage");
}

/**
 * Run `action` with cross-process throttling. At most one process executes
 * `action` per `cooldownMs` window:
 *  - If another process currently holds the lock, return immediately with
 *    `{ ran: false, reason: 'locked' }`.
 *  - Otherwise sleep for the remaining cooldown (if any), run the action,
 *    persist `lastPushAt`, and release the lock.
 *
 * `lastPushAt` is updated even if `action` throws, so transient failures do
 * not let a hook storm bypass the cooldown.
 */
export async function throttledRun(
  action: () => Promise<void>,
  opts: ThrottleOptions,
): Promise<ThrottleResult> {
  const dir = opts.cacheDir ?? defaultCacheDir();
  await mkdir(dir, { recursive: true });
  const lockPath = join(dir, "push.lock");
  const statePath = join(dir, "state.json");
  const staleMs = opts.staleAfterMs ?? 5 * 60 * 1000;

  const acquired = await tryAcquireLock(lockPath, staleMs);
  if (!acquired) return { ran: false, reason: "locked" };

  try {
    const state = await readState(statePath);
    const remainingMs = Math.max(
      0,
      state.lastPushAt + opts.cooldownMs - Date.now(),
    );
    const mode: ThrottleMode = opts.mode ?? "wait";

    if (remainingMs > 0 && mode === "skip") {
      return {
        ran: false,
        reason: "cooling",
        cooldownRemainingMs: remainingMs,
      };
    }
    if (remainingMs > 0) {
      opts.onWait?.(remainingMs);
      await sleep(remainingMs);
    }

    let actionError: unknown;
    try {
      await action();
    } catch (err) {
      actionError = err;
    } finally {
      await writeState(statePath, { lastPushAt: Date.now() });
    }
    if (actionError) throw actionError;
    return { ran: true, waitedMs: remainingMs };
  } finally {
    await rm(lockPath, { force: true });
  }
}

async function tryAcquireLock(
  path: string,
  staleMs: number,
): Promise<boolean> {
  try {
    const handle = await open(path, "wx");
    await handle.write(`${process.pid}`);
    await handle.close();
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw err;
    try {
      const st = await stat(path);
      if (Date.now() - st.mtimeMs > staleMs) {
        await rm(path, { force: true });
        return tryAcquireLock(path, staleMs);
      }
    } catch {
      /* race: lock already gone */
    }
    return false;
  }
}

async function readState(path: string): Promise<State> {
  try {
    const txt = await readFile(path, "utf8");
    const obj = JSON.parse(txt) as Partial<State>;
    if (typeof obj?.lastPushAt === "number") {
      return { lastPushAt: obj.lastPushAt };
    }
  } catch {
    /* missing or malformed */
  }
  return { lastPushAt: 0 };
}

async function writeState(path: string, state: State): Promise<void> {
  await writeFile(path, JSON.stringify(state));
}
