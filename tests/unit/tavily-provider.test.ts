import { TavilyKeylessLimitError, type TavilyClient } from "@tavily/core";
import { describe, expect, it, vi } from "vitest";
import { classifyTavilyError, TavilySearchProvider } from "@/lib/research/providers/tavily";
import { JobCancelledError, ProviderError, type SearchRequest } from "@/lib/research/providers/types";

const signal = () => new AbortController().signal;

function request(overrides: Partial<SearchRequest> = {}): SearchRequest {
  return { query: '"Elnara Gasimova"', category: "career", language: "en", topic: "general", maxResults: 6, ...overrides };
}

function fakeClient(overrides: Partial<Record<"search" | "extract", ReturnType<typeof vi.fn>>> = {}) {
  const search = overrides.search ?? vi.fn(async () => ({ query: "", responseTime: 0.1, images: [], results: [], requestId: "r" }));
  const extract = overrides.extract ?? vi.fn(async () => ({ results: [], failedResults: [], responseTime: 0.1, requestId: "r" }));
  return { client: { search, extract } as unknown as TavilyClient, search, extract };
}

describe("classifyTavilyError", () => {
  it.each([
    ["Request timed out after 45 seconds.", "timeout"],
    ["timeout of 45000ms exceeded", "timeout"],
    ['429 Error: {"detail":"Too Many Requests"}', "rate_limited"],
    ["Rate limit exceeded. Please slow down.", "rate_limited"],
    ['432 Error: {"detail":{}}', "quota"],
    ['433 Error: {"detail":{}}', "quota"],
    ["This request exceeds your plan's set usage limit. Please upgrade your plan.", "quota"],
    ["Not enough credits to complete this request.", "quota"],
    ['401 Error: {"detail":{}}', "auth"],
    ["Unauthorized: missing or invalid API key.", "auth"],
    ['403 Error: {"detail":{}}', "auth"],
    ['502 Error: {"detail":{}}', "unavailable"],
    ["Service unavailable", "unavailable"],
    ['400 Error: {"detail":{}}', "bad_request"],
    ["An unexpected error occurred while making the request. Error: getaddrinfo ENOTFOUND api.tavily.com", "network"],
    ["Something odd happened", "unknown"],
  ])("%s → %s", (message, kind) => {
    const error = classifyTavilyError(new Error(message));
    expect(error).toBeInstanceOf(ProviderError);
    expect(error.kind).toBe(kind);
    expect(error.provider).toBe("tavily");
    // The raw message goes to diagnostics only.
    expect(error.detail).toBe(message);
    expect(error.message).not.toBe(message);
  });

  it("marks transient failures as retryable and account problems as not", () => {
    expect(classifyTavilyError(new Error("Request timed out after 45 seconds.")).retryable).toBe(true);
    expect(classifyTavilyError(new Error("429 Error")).retryable).toBe(true);
    expect(classifyTavilyError(new Error("432 Error")).retryable).toBe(false);
    expect(classifyTavilyError(new Error("401 Error")).retryable).toBe(false);
  });

  it("treats keyless-mode limits as quota errors with retry-after", () => {
    const error = classifyTavilyError(
      new TavilyKeylessLimitError({ message: "Hourly keyless cap reached", capType: "hourly", retryAfter: 120, bonusEligible: false, continuationPaths: [] }),
    );
    expect(error).toMatchObject({ kind: "quota", retryAfterMs: 120_000 });
  });

  it("passes provider errors through and handles non-Error values", () => {
    const original = new ProviderError("tavily", "auth", "Rejected.");
    expect(classifyTavilyError(original)).toBe(original);
    expect(classifyTavilyError("boom")).toMatchObject({ kind: "unknown", detail: "boom" });
  });
});

describe("TavilySearchProvider: configuration", () => {
  it.each([undefined, ""])("refuses to start without an API key (%j) instead of using keyless mode", (key) => {
    expect(() => new TavilySearchProvider(key, { timeoutMs: 45_000 })).toThrow(ProviderError);
    try {
      new TavilySearchProvider(key, { timeoutMs: 45_000 });
    } catch (error) {
      expect(error).toMatchObject({ provider: "tavily", kind: "not_configured", retryable: false });
    }
  });

  it("can be constructed with a key", () => {
    expect(new TavilySearchProvider("tvly-test-key", { timeoutMs: 45_000 }).id).toBe("tavily");
  });
});

describe("TavilySearchProvider.search", () => {
  it("maps results and usage", async () => {
    const { client } = fakeClient({
      search: vi.fn(async () => ({
        query: "q",
        responseTime: 0.4,
        images: [],
        requestId: "req-1",
        usage: { credits: 2 },
        results: [
          {
            title: "Elnara Gasimova — Caspian Lantern Analytics",
            url: "https://caspian.example/team/elnara",
            content: "Chief Executive Officer of Caspian Lantern Analytics.",
            rawContent: "Full page text.",
            score: 0.91,
            publishedDate: "2026-09-28",
            id: "1",
          },
          { title: "", url: "https://news.example/a", content: undefined, score: undefined, publishedDate: "", id: "2" },
        ],
      })),
    });
    const provider = new TavilySearchProvider(undefined, { timeoutMs: 45_000, client });
    const response = await provider.search(request(), signal());
    expect(response).toEqual({
      hits: [
        {
          url: "https://caspian.example/team/elnara",
          title: "Elnara Gasimova — Caspian Lantern Analytics",
          snippet: "Chief Executive Officer of Caspian Lantern Analytics.",
          rawContent: "Full page text.",
          score: 0.91,
          providerPublishedDate: "2026-09-28",
        },
        { url: "https://news.example/a", title: null, snippet: "", rawContent: null, score: null, providerPublishedDate: null },
      ],
      usage: { requests: 1, credits: 2 },
    });
  });

  it("reports unknown credits as null", async () => {
    const { client } = fakeClient();
    const response = await new TavilySearchProvider("k", { timeoutMs: 45_000, client }).search(request(), signal());
    expect(response.usage).toEqual({ requests: 1, credits: null });
  });

  it("always asks for usage and passes the request options", async () => {
    const { client, search } = fakeClient();
    const provider = new TavilySearchProvider("k", { timeoutMs: 45_000, client });
    await provider.search(
      request({ category: "news", topic: "news", maxResults: 4, includeDomains: ["news.example"], excludeDomains: ["spam.example"], startDate: "2021-10-01" }),
      signal(),
    );
    expect(search).toHaveBeenCalledWith('"Elnara Gasimova"', {
      searchDepth: "advanced",
      topic: "news",
      maxResults: 4,
      includeRawContent: "text",
      includeDomains: ["news.example"],
      excludeDomains: ["spam.example"],
      startDate: "2021-10-01",
      includeUsage: true,
      includeFavicon: false,
      timeout: 45,
    });
  });

  it("does not request page text for discovery searches and bounds the timeout", async () => {
    const { client, search } = fakeClient();
    await new TavilySearchProvider("k", { timeoutMs: 1_000, client }).search(request({ category: "discovery" }), signal());
    expect(search.mock.calls[0][1]).toMatchObject({ includeRawContent: false, includeUsage: true, timeout: 5 });
  });

  it("classifies SDK failures", async () => {
    const { client } = fakeClient({ search: vi.fn(async () => Promise.reject(new Error('429 Error: {"detail":"slow down"}'))) });
    await expect(new TavilySearchProvider("k", { timeoutMs: 45_000, client }).search(request(), signal())).rejects.toMatchObject({
      name: "ProviderError",
      kind: "rate_limited",
    });
  });

  it("stops waiting when the job is cancelled", async () => {
    const pending = vi.fn(() => new Promise(() => undefined));
    const { client } = fakeClient({ search: pending });
    const provider = new TavilySearchProvider("k", { timeoutMs: 45_000, client });

    const aborted = new AbortController();
    aborted.abort();
    await expect(provider.search(request(), aborted.signal)).rejects.toBeInstanceOf(JobCancelledError);

    const controller = new AbortController();
    const result = provider.search(request(), controller.signal);
    controller.abort();
    await expect(result).rejects.toBeInstanceOf(JobCancelledError);
  });
});

describe("TavilySearchProvider.extract", () => {
  it("maps pages, failures and usage, asking for usage", async () => {
    const { client, extract } = fakeClient({
      extract: vi.fn(async () => ({
        results: [{ url: "https://caspian.example/team/elnara", title: "Team", rawContent: "Page text" }],
        failedResults: [
          { url: "https://paper.example/premium", error: "Paywalled" },
          { url: "https://broken.example/", error: "" },
        ],
        responseTime: 1,
        requestId: "r",
        usage: { credits: 1 },
      })),
    });
    const provider = new TavilySearchProvider("k", { timeoutMs: 30_000, client });
    const response = await provider.extract(["https://caspian.example/team/elnara", "https://paper.example/premium", "https://broken.example/"], signal());
    expect(response).toEqual({
      pages: [{ url: "https://caspian.example/team/elnara", title: "Team", content: "Page text" }],
      failed: [
        { url: "https://paper.example/premium", reason: "Paywalled" },
        { url: "https://broken.example/", reason: "Extraction failed." },
      ],
      usage: { requests: 1, credits: 1 },
    });
    expect(extract).toHaveBeenCalledWith(expect.any(Array), { extractDepth: "basic", format: "text", includeUsage: true, timeout: 30 });
  });

  it("makes no request for an empty URL list", async () => {
    const { client, extract } = fakeClient();
    expect(await new TavilySearchProvider("k", { timeoutMs: 30_000, client }).extract([], signal())).toEqual({
      pages: [],
      failed: [],
      usage: { requests: 0, credits: 0 },
    });
    expect(extract).not.toHaveBeenCalled();
  });

  it("classifies SDK failures", async () => {
    const { client } = fakeClient({ extract: vi.fn(async () => Promise.reject(new Error("Unauthorized: missing or invalid API key."))) });
    await expect(new TavilySearchProvider("k", { timeoutMs: 30_000, client }).extract(["https://a.example/"], signal())).rejects.toMatchObject({ kind: "auth" });
  });
});
