import { describe, expect, it } from "vitest";
import type { ResearchLimits } from "@/lib/db/schema";
import type { Env } from "@/lib/env";
import {
  buildJobConfig,
  DEFAULT_NEWS_WINDOW_MONTHS,
  estimateAnthropicCostUsd,
  estimateTavilyCostUsd,
  PROMPT_VERSION,
  resolveLimits,
  TAVILY_USD_PER_CREDIT_ESTIMATE,
} from "@/lib/research/config";

/** Only the fields config.ts reads; the defaults mirror env.ts. */
function env(overrides: Partial<Env> = {}): Env {
  return {
    ANTHROPIC_MODEL: "claude-opus-5-5",
    ANTHROPIC_EFFORT: "medium",
    RESEARCH_MAX_SEARCH_QUERIES: 16,
    RESEARCH_MAX_RESULTS_PER_QUERY: 6,
    RESEARCH_MAX_EXTRACT_PAGES: 12,
    RESEARCH_MAX_MODEL_CALLS: 10,
    RESEARCH_MAX_OUTPUT_TOKENS: 16_000,
    RESEARCH_MAX_SOURCE_CHARS: 24_000,
    RESEARCH_PROVIDER_TIMEOUT_MS: 45_000,
    RESEARCH_PROVIDER_MAX_RETRIES: 2,
    ...overrides,
  } as Env;
}

describe("resolveLimits", () => {
  it("uses the server caps when the owner has no settings", () => {
    expect(resolveLimits(env(), null)).toEqual({
      maxSearchQueries: 16,
      maxResultsPerQuery: 6,
      maxExtractPages: 12,
      maxModelCalls: 10,
      includeNews: true,
      newsWindowMonths: DEFAULT_NEWS_WINDOW_MONTHS,
      maxOutputTokens: 16_000,
      maxSourceChars: 24_000,
      providerTimeoutMs: 45_000,
      providerMaxRetries: 2,
    });
    expect(resolveLimits(env(), {})).toEqual(resolveLimits(env(), undefined));
  });

  it("lets owner settings lower the caps (rounded down)", () => {
    const limits = resolveLimits(env(), { maxSearchQueries: 8, maxResultsPerQuery: 3.9, maxExtractPages: 5, maxModelCalls: 4 });
    expect(limits).toMatchObject({ maxSearchQueries: 8, maxResultsPerQuery: 3, maxExtractPages: 5, maxModelCalls: 4 });
  });

  it("never lets owner settings raise the caps", () => {
    const limits = resolveLimits(env(), { maxSearchQueries: 500, maxResultsPerQuery: 100, maxExtractPages: 99, maxModelCalls: 1_000 });
    expect(limits).toMatchObject({ maxSearchQueries: 16, maxResultsPerQuery: 6, maxExtractPages: 12, maxModelCalls: 10 });
  });

  it("ignores non-finite owner values", () => {
    const limits = resolveLimits(env(), { maxSearchQueries: Number.NaN, maxModelCalls: Number.POSITIVE_INFINITY });
    expect(limits).toMatchObject({ maxSearchQueries: 16, maxModelCalls: 10 });
  });

  it("applies working minimums to very low owner settings", () => {
    const limits = resolveLimits(env(), { maxSearchQueries: 1, maxResultsPerQuery: 0, maxExtractPages: -3, maxModelCalls: 0 });
    expect(limits).toMatchObject({ maxSearchQueries: 4, maxResultsPerQuery: 1, maxExtractPages: 0, maxModelCalls: 3 });
  });

  it("never exceeds a server cap, even one below the owner-side minimums", () => {
    const tight = env({ RESEARCH_MAX_SEARCH_QUERIES: 2, RESEARCH_MAX_MODEL_CALLS: 1, RESEARCH_MAX_EXTRACT_PAGES: 0 });
    for (const owner of [null, {}, { maxSearchQueries: 1, maxModelCalls: 1, maxExtractPages: 1 }, { maxSearchQueries: 50, maxModelCalls: 50, maxExtractPages: 50 }]) {
      const limits = resolveLimits(tight, owner as ResearchLimits | null);
      expect(limits.maxSearchQueries).toBeLessThanOrEqual(2);
      expect(limits.maxModelCalls).toBeLessThanOrEqual(1);
      expect(limits.maxExtractPages).toBe(0);
    }
  });

  it("holds for any combination of caps and owner values", () => {
    for (const cap of [1, 2, 3, 4, 5, 10, 60]) {
      for (const value of [-1, 0, 1, 2, 3, 4, 5, 7.5, 10, 61, 1_000]) {
        const limits = resolveLimits(
          env({ RESEARCH_MAX_SEARCH_QUERIES: cap, RESEARCH_MAX_RESULTS_PER_QUERY: cap, RESEARCH_MAX_EXTRACT_PAGES: cap, RESEARCH_MAX_MODEL_CALLS: cap }),
          { maxSearchQueries: value, maxResultsPerQuery: value, maxExtractPages: value, maxModelCalls: value },
        );
        expect(limits.maxSearchQueries).toBeLessThanOrEqual(cap);
        expect(limits.maxResultsPerQuery).toBeLessThanOrEqual(cap);
        expect(limits.maxExtractPages).toBeLessThanOrEqual(cap);
        expect(limits.maxModelCalls).toBeLessThanOrEqual(cap);
        expect(limits.maxResultsPerQuery).toBeGreaterThanOrEqual(1);
        expect(limits.maxExtractPages).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("takes news settings from the owner within bounds", () => {
    expect(resolveLimits(env(), { includeNews: false }).includeNews).toBe(false);
    expect(resolveLimits(env(), { newsWindowMonths: 24 }).newsWindowMonths).toBe(24);
    expect(resolveLimits(env(), { newsWindowMonths: 500 }).newsWindowMonths).toBe(120);
    expect(resolveLimits(env(), { newsWindowMonths: 0 }).newsWindowMonths).toBe(DEFAULT_NEWS_WINDOW_MONTHS);
  });

  it("always takes token, size, timeout and retry limits from the server", () => {
    const limits = resolveLimits(env({ RESEARCH_MAX_OUTPUT_TOKENS: 4_096, RESEARCH_PROVIDER_MAX_RETRIES: 0 }), { maxModelCalls: 5 });
    expect(limits).toMatchObject({ maxOutputTokens: 4_096, providerMaxRetries: 0, maxSourceChars: 24_000, providerTimeoutMs: 45_000 });
  });
});

describe("buildJobConfig", () => {
  it("uses live providers and the configured model for the live workspace", () => {
    const config = buildJobConfig(env({ ANTHROPIC_MODEL: "claude-sonnet-5-5", ANTHROPIC_EFFORT: "high" }), "live", null);
    expect(config.searchProvider).toBe("tavily");
    expect(config.model).toEqual({ provider: "anthropic", model: "claude-sonnet-5-5", promptVersion: PROMPT_VERSION, effort: "high" });
  });

  it("uses fixture providers for the demo workspace", () => {
    const config = buildJobConfig(env(), "demo", { maxModelCalls: 5 }, { autoSelect: false });
    expect(config.searchProvider).toBe("fixture");
    expect(config.model).toEqual({ provider: "fixture", model: "fixture-replay", promptVersion: PROMPT_VERSION, effort: null });
    expect(config.limits.maxModelCalls).toBe(5);
    expect(config.autoSelect).toBe(false);
  });
});

describe("cost estimates", () => {
  it("uses list prices per million tokens", () => {
    expect(estimateAnthropicCostUsd("claude-opus-5-5", 1_000_000, 100_000, 500_000)).toBeCloseTo(4 + 2 + 0.1, 10);
    expect(estimateAnthropicCostUsd("claude-haiku-4-5", 2_000_000, 0)).toBeCloseTo(2, 10);
    expect(estimateAnthropicCostUsd("claude-opus-5-5", 0, 0)).toBe(0);
  });

  it("errs high for unknown models", () => {
    const unknown = estimateAnthropicCostUsd("some-future-model", 1_000_000, 1_000_000, 1_000_000);
    for (const model of ["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-haiku-4-5"]) {
      expect(unknown).toBeGreaterThanOrEqual(estimateAnthropicCostUsd(model, 1_000_000, 1_000_000, 1_000_000));
    }
  });

  it("estimates Tavily credits", () => {
    expect(estimateTavilyCostUsd(0)).toBe(0);
    expect(estimateTavilyCostUsd(25)).toBeCloseTo(25 * TAVILY_USD_PER_CREDIT_ESTIMATE, 10);
  });
});
