import type { JobConfig } from "@/lib/db/schema";
import type { Workspace } from "@/lib/domain/types";
import type { Env } from "@/lib/env";
import { AnthropicReasoningProvider } from "./anthropic";
import { FixtureReasoningProvider, FixtureSearchProvider, type FixtureRunContext } from "./fixture";
import { TavilySearchProvider } from "./tavily";
import type { ReasoningProvider, SearchProvider } from "./types";

export type ProviderSet = { search: SearchProvider; reasoning: ReasoningProvider };

/**
 * Live research uses live providers only; the demo workspace uses fixture
 * providers only. There is no fallback from one to the other: a live
 * provider failure stays a live provider failure.
 */
export function createProviders(
  input: { workspace: Workspace; config: JobConfig; env: Env; fixture?: Omit<FixtureRunContext, "latencyMs"> },
): ProviderSet {
  if (input.workspace === "live") {
    const { env, config } = input;
    return {
      search: new TavilySearchProvider(env.TAVILY_API_KEY, { timeoutMs: config.limits.providerTimeoutMs }),
      reasoning: new AnthropicReasoningProvider({
        apiKey: env.ANTHROPIC_API_KEY,
        baseURL: env.ANTHROPIC_API_URL,
        model: config.model.model,
        effort: (config.model.effort as "low" | "medium" | "high" | "xhigh" | "max" | null) ?? env.ANTHROPIC_EFFORT,
        fallbacks: env.ANTHROPIC_FALLBACKS,
        timeoutMs: config.limits.providerTimeoutMs,
        maxRetries: config.limits.providerMaxRetries,
        maxOutputTokens: config.limits.maxOutputTokens,
      }),
    };
  }
  const ctx: FixtureRunContext = {
    worldVersion: input.fixture?.worldVersion ?? 1,
    isRetry: input.fixture?.isRetry ?? false,
    runDate: input.fixture?.runDate ?? new Date().toISOString().slice(0, 10),
    latencyMs: input.env.FIXTURE_LATENCY_MS,
  };
  return { search: new FixtureSearchProvider(ctx), reasoning: new FixtureReasoningProvider(ctx) };
}
