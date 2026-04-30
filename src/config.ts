import { loadUserConfig } from "./user-config.js";

export interface AppConfig {
  apiKey: string;
  deviceId: string;
  baseUrl?: string;
}

export interface EnvLike {
  DOT_API_KEY?: string;
  DOT_DEVICE_ID?: string;
  DOT_API_BASE_URL?: string;
  USAGE_TIMEZONE?: string;
  USAGE_INTERVAL?: string;
  USAGE_COOLDOWN?: string;
  CLAUDE_HOME?: string;
  CODEX_HOME?: string;
  DEBUG_PNG?: string;
  QUOTE_AI_CACHE?: string;
  CLAUDE_CREDENTIALS_PATH?: string;
}

export class ConfigMissingError extends Error {
  readonly missing: readonly string[];
  constructor(missing: readonly string[]) {
    super(`Missing config: ${missing.join(", ")}`);
    this.name = "ConfigMissingError";
    this.missing = missing;
  }
}

/**
 * Resolve credentials from env first, then the on-disk user config
 * (`~/.config/quote-ai-usage/config.json`). Throws ConfigMissingError when
 * apiKey or deviceId still cannot be found.
 */
export async function resolveAppConfig(env: EnvLike): Promise<AppConfig> {
  const stored = await loadUserConfig();
  const apiKey = env.DOT_API_KEY?.trim() || stored.apiKey?.trim();
  const deviceId = env.DOT_DEVICE_ID?.trim() || stored.deviceId?.trim();
  const baseUrlRaw = env.DOT_API_BASE_URL?.trim() || stored.baseUrl?.trim();

  const missing: string[] = [];
  if (!apiKey) missing.push("apiKey");
  if (!deviceId) missing.push("deviceId");
  if (missing.length > 0) throw new ConfigMissingError(missing);

  return {
    apiKey: apiKey!,
    deviceId: deviceId!,
    baseUrl: baseUrlRaw || undefined,
  };
}

export function resolveTimezone(env: EnvLike): string {
  return env.USAGE_TIMEZONE?.trim() || "Asia/Shanghai";
}
