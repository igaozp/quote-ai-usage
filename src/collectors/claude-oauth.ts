import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ClaudeRateLimit } from "./types.js";

export interface ClaudeOAuthOptions {
  /** Override default path to ~/.claude/.credentials.json */
  credentialsPath?: string;
}

const OAUTH_API_URL = "https://api.anthropic.com/api/oauth/usage";
const BETA_HEADER = "oauth-2025-04-20";

// Candidate field names tried in order (flat and one level of nesting).
const CREDENTIAL_CANDIDATES = [
  "claudeAiOauthToken",
  "oauthToken",
  "accessToken",
  "token",
];

export async function collectClaudeOAuth(
  opts: ClaudeOAuthOptions = {},
): Promise<ClaudeRateLimit | null> {
  const token = await readOAuthToken(opts.credentialsPath);
  if (!token) return null;
  return fetchOAuthUsage(token);
}

async function readOAuthToken(credentialsPath?: string): Promise<string | null> {
  const path =
    credentialsPath ?? join(homedir(), ".claude", ".credentials.json");

  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return null;
  }

  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    console.warn("[claude-oauth] credentials file is not valid JSON:", path);
    return null;
  }

  if (typeof obj !== "object" || obj === null) return null;
  const record = obj as Record<string, unknown>;

  // Try flat top-level fields first.
  for (const key of CREDENTIAL_CANDIDATES) {
    const val = record[key];
    if (typeof val === "string" && val.startsWith("sk-ant-oat")) {
      return val;
    }
  }

  // Try one level of nesting: any object-valued key whose sub-fields match.
  for (const outerKey of Object.keys(record)) {
    const sub = record[outerKey];
    if (typeof sub !== "object" || sub === null) continue;
    const subRecord = sub as Record<string, unknown>;
    for (const key of CREDENTIAL_CANDIDATES) {
      const val = subRecord[key];
      if (typeof val === "string" && val.startsWith("sk-ant-oat")) {
        return val;
      }
    }
  }

  console.warn(
    "[claude-oauth] could not find OAuth token in credentials file; tried:",
    CREDENTIAL_CANDIDATES.join(", "),
  );
  return null;
}

async function fetchOAuthUsage(token: string): Promise<ClaudeRateLimit | null> {
  let res: Response;
  try {
    res = await fetch(OAUTH_API_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        "anthropic-beta": BETA_HEADER,
      },
    });
  } catch (err) {
    console.warn(
      "[claude-oauth] network error:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }

  if (!res.ok) {
    console.warn(
      `[claude-oauth] API returned ${res.status} ${res.statusText}; skipping rate limit display`,
    );
    return null;
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    console.warn("[claude-oauth] response body is not JSON");
    return null;
  }

  return extractFiveHour(body);
}

interface OAuthUsageRaw {
  five_hour?: {
    utilization?: number;
    resets_at?: number;
  } | null;
  seven_day?: {
    utilization?: number;
    resets_at?: number;
  } | null;
}

function extractFiveHour(body: unknown): ClaudeRateLimit | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = body as OAuthUsageRaw;
  const fh = raw.five_hour;
  if (!fh) {
    console.warn("[claude-oauth] no five_hour rate limit data in response");
    return null;
  }
  const { utilization, resets_at: resetsAt } = fh;
  if (typeof utilization !== "number" || typeof resetsAt !== "number") {
    console.warn("[claude-oauth] unexpected five_hour shape:", fh);
    return null;
  }
  return {
    utilization: Math.max(0, Math.min(1, utilization)),
    resetsAt,
  };
}
