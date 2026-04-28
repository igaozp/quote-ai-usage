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
  CLAUDE_HOME?: string;
  CODEX_HOME?: string;
  DEBUG_PNG?: string;
  QUOTE_AI_CACHE?: string;
}

export function loadConfig(env: EnvLike): AppConfig {
  const apiKey = env.DOT_API_KEY?.trim();
  const deviceId = env.DOT_DEVICE_ID?.trim();
  if (!apiKey) throw new Error("Missing DOT_API_KEY");
  if (!deviceId) throw new Error("Missing DOT_DEVICE_ID");
  return {
    apiKey,
    deviceId,
    baseUrl: env.DOT_API_BASE_URL?.trim() || undefined,
  };
}

export function resolveTimezone(env: EnvLike): string {
  return env.USAGE_TIMEZONE?.trim() || "Asia/Shanghai";
}
