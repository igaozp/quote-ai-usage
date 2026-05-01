export interface ClaudeModelMetric {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  estUsd: number;
}

export interface ClaudeRateLimit {
  /** 0–1 fraction of quota consumed */
  utilization: number;
  /** Unix epoch seconds when this window resets */
  resetsAt: number;
}

export interface ClaudeMetric {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  estUsd: number;
  byModel: Record<string, ClaudeModelMetric>;
  /** Five-hour rolling rate-limit window from OAuth usage API. null when unavailable. */
  rateLimit: ClaudeRateLimit | null;
}

export interface CodexRateLimit {
  usedPercent: number;
  windowMinutes: number;
  resetsAt: number;
}

export interface CodexMetric {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  primary: CodexRateLimit | null;
  secondary: CodexRateLimit | null;
}

export interface DailyUsage {
  date: string;
  timezone: string;
  claude: ClaudeMetric | null;
  codex: CodexMetric | null;
}
