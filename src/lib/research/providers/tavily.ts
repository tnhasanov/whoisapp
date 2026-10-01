import { tavily, TavilyKeylessLimitError, type TavilyClient } from "@tavily/core";
import { JobCancelledError, ProviderError, type ExtractResponse, type SearchProvider, type SearchRequest, type SearchResponse } from "./types";

/**
 * Live search adapter using the official Tavily SDK (@tavily/core).
 *
 * - Requires TAVILY_API_KEY. The SDK would otherwise switch to a capped
 *   "keyless" mode; we never allow that implicitly.
 * - Usage (credits) is requested on every call and recorded.
 * - The SDK has no AbortSignal support; cancellation stops waiting and the
 *   request is bounded by the SDK timeout.
 */

const NEWS_DEPTH = "advanced" as const;

export function classifyTavilyError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof TavilyKeylessLimitError) {
    return new ProviderError("tavily", "quota", "The search provider rejected the request (usage cap).", error.message, error.retryAfter ? error.retryAfter * 1000 : undefined);
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/timed out/i.test(message)) return new ProviderError("tavily", "timeout", "The search provider timed out.", message);
  if (/\b429\b|rate limit|too many requests/i.test(message)) return new ProviderError("tavily", "rate_limited", "The search provider rate-limited the request.", message);
  if (/\b43[23]\b|credit|usage limit|plan limit|exceed/i.test(message)) return new ProviderError("tavily", "quota", "The search provider's usage limit was reached.", message);
  if (/\b401\b|\b403\b|unauthori[sz]ed|invalid api key|forbidden/i.test(message)) return new ProviderError("tavily", "auth", "The search provider rejected the API key.", message);
  if (/\b5\d\d\b|bad gateway|unavailable/i.test(message)) return new ProviderError("tavily", "unavailable", "The search provider is unavailable.", message);
  if (/\b400\b|invalid/i.test(message)) return new ProviderError("tavily", "bad_request", "The search request was rejected.", message);
  if (/ENOTFOUND|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket|network/i.test(message)) return new ProviderError("tavily", "network", "Could not reach the search provider.", message);
  return new ProviderError("tavily", "unknown", "The search provider returned an unexpected error.", message);
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new JobCancelledError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new JobCancelledError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
}

export class TavilySearchProvider implements SearchProvider {
  readonly id = "tavily" as const;
  private readonly client: TavilyClient;
  private readonly timeoutSeconds: number;

  constructor(apiKey: string | undefined, options: { timeoutMs: number; client?: TavilyClient }) {
    if (!apiKey && !options.client) {
      throw new ProviderError("tavily", "not_configured", "Live search is not configured (TAVILY_API_KEY is missing).");
    }
    this.client = options.client ?? tavily({ apiKey, clientSource: "personbrief" });
    this.timeoutSeconds = Math.max(5, Math.round(options.timeoutMs / 1000));
  }

  async search(request: SearchRequest, signal: AbortSignal): Promise<SearchResponse> {
    try {
      const response = await abortable(
        this.client.search(request.query, {
          searchDepth: request.topic === "news" ? NEWS_DEPTH : "advanced",
          topic: request.topic,
          maxResults: request.maxResults,
          includeRawContent: request.category === "discovery" ? false : "text",
          includeDomains: request.includeDomains,
          excludeDomains: request.excludeDomains,
          startDate: request.startDate,
          includeUsage: true,
          includeFavicon: false,
          timeout: this.timeoutSeconds,
        }),
        signal,
      );
      return {
        hits: response.results.map((r) => ({
          url: r.url,
          title: r.title || null,
          snippet: r.content ?? "",
          rawContent: r.rawContent ?? null,
          score: typeof r.score === "number" ? r.score : null,
          providerPublishedDate: r.publishedDate || null,
        })),
        usage: { requests: 1, credits: response.usage?.credits ?? null },
      };
    } catch (error) {
      if (error instanceof JobCancelledError) throw error;
      throw classifyTavilyError(error);
    }
  }

  async extract(urls: string[], signal: AbortSignal): Promise<ExtractResponse> {
    if (urls.length === 0) return { pages: [], failed: [], usage: { requests: 0, credits: 0 } };
    try {
      const response = await abortable(
        this.client.extract(urls, { extractDepth: "basic", format: "text", includeUsage: true, timeout: this.timeoutSeconds }),
        signal,
      );
      return {
        pages: response.results.map((r) => ({ url: r.url, title: r.title ?? null, content: r.rawContent ?? "" })),
        failed: response.failedResults.map((f) => ({ url: f.url, reason: f.error || "Extraction failed." })),
        usage: { requests: 1, credits: response.usage?.credits ?? null },
      };
    } catch (error) {
      if (error instanceof JobCancelledError) throw error;
      throw classifyTavilyError(error);
    }
  }
}
