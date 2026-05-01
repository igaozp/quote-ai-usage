import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { ColorMode } from "./render.js";

export interface StoredConfig {
  apiKey?: string;
  deviceId?: string;
  baseUrl?: string;
  theme?: ColorMode;
}

/**
 * Resolve the per-user config directory. XDG-style on all platforms,
 * with %APPDATA% as a Windows fallback when XDG_CONFIG_HOME is unset.
 */
export function userConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  if (xdg) return join(xdg, "quote-ai-usage");
  if (platform() === "win32") {
    const appdata = process.env.APPDATA?.trim();
    if (appdata) return join(appdata, "quote-ai-usage");
  }
  return join(homedir(), ".config", "quote-ai-usage");
}

export function userConfigPath(): string {
  return join(userConfigDir(), "config.json");
}

export async function loadUserConfig(): Promise<StoredConfig> {
  try {
    const txt = await readFile(userConfigPath(), "utf8");
    const obj = JSON.parse(txt) as StoredConfig;
    return {
      apiKey: typeof obj.apiKey === "string" ? obj.apiKey : undefined,
      deviceId: typeof obj.deviceId === "string" ? obj.deviceId : undefined,
      baseUrl: typeof obj.baseUrl === "string" ? obj.baseUrl : undefined,
      theme: obj.theme === "light" || obj.theme === "dark" ? obj.theme : undefined,
    };
  } catch {
    return {};
  }
}

export async function saveUserConfig(cfg: StoredConfig): Promise<string> {
  const dir = userConfigDir();
  await mkdir(dir, { recursive: true });
  const path = userConfigPath();
  await writeFile(path, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  // Best-effort 0600 on POSIX; Windows ACLs ignore the call.
  if (platform() !== "win32") {
    try {
      await chmod(path, 0o600);
    } catch {
      /* ignore */
    }
  }
  return path;
}

export async function deleteUserConfig(): Promise<boolean> {
  try {
    await stat(userConfigPath());
  } catch {
    return false;
  }
  await rm(userConfigPath(), { force: true });
  return true;
}

export async function configFileExists(): Promise<boolean> {
  try {
    await stat(userConfigPath());
    return true;
  } catch {
    return false;
  }
}
