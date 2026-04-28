/**
 * Pricing tables in USD per 1M tokens. Numbers reflect the public list price
 * for the model family at the time of writing — adjust here when the vendor
 * changes pricing or new models ship.
 */

export interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const SONNET: ModelPricing = {
  input: 3,
  output: 15,
  cacheRead: 0.3,
  cacheWrite: 3.75,
};

const OPUS: ModelPricing = {
  input: 15,
  output: 75,
  cacheRead: 1.5,
  cacheWrite: 18.75,
};

const HAIKU: ModelPricing = {
  input: 1,
  output: 5,
  cacheRead: 0.1,
  cacheWrite: 1.25,
};

const CLAUDE_PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-7": OPUS,
  "claude-opus-4-6": OPUS,
  "claude-sonnet-4-7": SONNET,
  "claude-sonnet-4-6": SONNET,
  "claude-haiku-4-5": HAIKU,
};

export function priceFor(model: string): ModelPricing {
  const exact = CLAUDE_PRICING[model];
  if (exact) return exact;
  const lower = model.toLowerCase();
  if (lower.includes("opus")) return OPUS;
  if (lower.includes("haiku")) return HAIKU;
  return SONNET;
}

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export function estimateUsd(p: ModelPricing, m: TokenCounts): number {
  return (
    (m.inputTokens * p.input +
      m.outputTokens * p.output +
      m.cacheReadTokens * p.cacheRead +
      m.cacheCreationTokens * p.cacheWrite) /
    1_000_000
  );
}
