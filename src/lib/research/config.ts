import type { JobConfig, ResearchLimits } from "@/lib/db/schema";
import type { Workspace } from "@/lib/domain/types";
import type { Env } from "@/lib/env";

/** Bump when prompts or extraction rules change; part of every cache key and snapshot. */
export const PROMPT_VERSION = "2026-10-01.1";

/**
 * Published list prices used ONLY for labelled cost estimates (USD per
 * million tokens). Unknown models fall back to the most expensive tier so
 * estimates err high.
 */
const ANTHROPIC_PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1 },
};

/** Estimated USD per Tavily API credit (pay-as-you-go list price; plans differ). */
export const TAVILY_USD_PER_CREDIT_ESTIMATE = 0.008;

export function estimateAnthropicCostUsd(model: string, inputTokens: number, outputTokens: number, cacheReadTokens = 0): number {
  const price = ANTHROPIC_PRICES[model] ?? { input: 10, output: 50, cacheRead: 1 };
  return (inputTokens * price.input + outputTokens * price.output + cacheReadTokens * price.cacheRead) / 1_000_000;
}

export function estimateTavilyCostUsd(credits: number): number {
  return credits * TAVILY_USD_PER_CREDIT_ESTIMATE;
}

export const DEFAULT_NEWS_WINDOW_MONTHS = 60;

/** Owner settings may lower but never raise the server caps. */
export function resolveLimits(env: Env, owner: ResearchLimits | null | undefined): JobConfig["limits"] {
  // The cap is applied last so a minimum can never lift a value above a server cap.
  const clamp = (value: number | undefined, cap: number, min = 1) =>
    value === undefined || !Number.isFinite(value) ? cap : Math.min(cap, Math.max(min, Math.floor(value)));
  return {
    maxSearchQueries: clamp(owner?.maxSearchQueries, env.RESEARCH_MAX_SEARCH_QUERIES, 4),
    maxResultsPerQuery: clamp(owner?.maxResultsPerQuery, env.RESEARCH_MAX_RESULTS_PER_QUERY),
    maxExtractPages: clamp(owner?.maxExtractPages, env.RESEARCH_MAX_EXTRACT_PAGES, 0),
    maxModelCalls: clamp(owner?.maxModelCalls, env.RESEARCH_MAX_MODEL_CALLS, 3),
    includeNews: owner?.includeNews ?? true,
    newsWindowMonths: owner?.newsWindowMonths ? clamp(owner.newsWindowMonths, 120, 1) : DEFAULT_NEWS_WINDOW_MONTHS,
    maxOutputTokens: env.RESEARCH_MAX_OUTPUT_TOKENS,
    maxSourceChars: env.RESEARCH_MAX_SOURCE_CHARS,
    providerTimeoutMs: env.RESEARCH_PROVIDER_TIMEOUT_MS,
    providerMaxRetries: env.RESEARCH_PROVIDER_MAX_RETRIES,
  };
}

export function buildJobConfig(env: Env, workspace: Workspace, owner: ResearchLimits | null | undefined, extra?: Partial<JobConfig>): JobConfig {
  const limits = resolveLimits(env, owner);
  const live = workspace === "live";
  return {
    limits,
    model: live
      ? { provider: "anthropic", model: env.ANTHROPIC_MODEL, promptVersion: PROMPT_VERSION, effort: env.ANTHROPIC_EFFORT }
      : { provider: "fixture", model: "fixture-replay", promptVersion: PROMPT_VERSION, effort: null },
    searchProvider: live ? "tavily" : "fixture",
    ...extra,
  };
}

/**
 * Domains never used as evidence: people-search aggregators and data brokers
 * (invasive by design). Results from them are dropped before extraction.
 */
export const BLOCKED_SOURCE_DOMAINS = [
  "people-lookup.example",
  "spokeo.com",
  "whitepages.com",
  "beenverified.com",
  "truepeoplesearch.com",
  "fastpeoplesearch.com",
  "peoplefinders.com",
  "intelius.com",
  "radaris.com",
  "zabasearch.com",
  "pipl.com",
  "nuwber.com",
  "mylife.com",
  "thatsthem.com",
  "rocketreach.co",
  "contactout.com",
  "lusha.com",
];

/**
 * Platforms whose profile pages sit behind a login wall. We may use permitted
 * search listings that link to them, but never fetch or scrape the pages.
 */
export const LOGIN_WALLED_DOMAINS = [
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "linkedin.example",
  "facebook.example",
  "instagram.example",
];

export const SOCIAL_PLATFORM_DOMAINS: Record<string, string[]> = {
  linkedin: ["linkedin.com", "linkedin.example"],
  facebook: ["facebook.com", "fb.com", "facebook.example"],
  instagram: ["instagram.com", "instagram.example"],
  x: ["x.com", "twitter.com", "x.example"],
  youtube: ["youtube.com", "youtu.be", "youtube.example"],
  github: ["github.com", "github.example"],
};
