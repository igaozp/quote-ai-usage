export interface ClaudeModelMetric {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  estUsd: number;
}

export interface ClaudeMetric {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  estUsd: number;
  byModel: Record<string, ClaudeModelMetric>;
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
