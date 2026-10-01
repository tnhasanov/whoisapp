import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { PROMPT_VERSION } from "@/lib/research/config";
import { DISCOVERY_SYSTEM, EXTRACTION_SYSTEM, SYNTHESIS_SYSTEM } from "@/lib/research/prompts";
import { AnthropicReasoningProvider, classifyAnthropicError, type AnthropicProviderOptions } from "@/lib/research/providers/anthropic";
import { JobCancelledError, ProviderError, type DiscoveryInput, type ExtractionInput, type SynthesisInput } from "@/lib/research/providers/types";
import type { DiscoveryOutput } from "@/lib/research/schemas";

const signal = () => new AbortController().signal;
const body = (type: string, message: string) => ({ type: "error", error: { type, message } });

const DISCOVERY_INPUT: DiscoveryInput = {
  query: { fullName: "Elnara Gasimova", company: null, country: null, profileUrl: null },
  nameVariants: ["Elnara Gasimova", "Elnarə Qasımova"],
  documents: [{ id: "S1", url: "https://caspian.example/team/elnara", title: "Team", publisher: null, providerPublishedDate: null, access: "full_text", text: "Elnara Gasimova, CEO." }],
};

const VALID_DISCOVERY: DiscoveryOutput = {
  candidates: [
    {
      candidate_ref: "c1",
      display_name: "Elnara Gasimova",
      native_name: null,
      organisation: "Caspian Lantern Analytics",
      role: "CEO",
      location: "Baku",
      summary: "Chief executive of a Baku data company.",
      distinguishing_facts: [],
      source_ids: ["S1"],
      anchor_source_id: "S1",
    },
  ],
  unassigned_source_ids: [],
};

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [],
    stop_reason: "end_turn",
    stop_details: null,
    parsed_output: VALID_DISCOVERY,
    usage: { input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 800 },
    ...overrides,
  };
}

/** The parts of the request body these tests inspect. */
type SentParams = {
  model: string;
  max_tokens: number;
  system: { type: string; text: string; cache_control?: unknown }[];
  messages: { role: string; content: string }[];
  output_config: { effort: string; format: { type: string; schema: { properties: Record<string, unknown> } } };
  betas?: string[];
  fallbacks?: string;
};

const sent = (parse: ReturnType<typeof provider>["parse"]) => parse.mock.calls[0] as unknown as [SentParams, { signal: AbortSignal }];

function provider(response: unknown, options: Partial<AnthropicProviderOptions> = {}) {
  const parse = vi.fn(async () => (response instanceof Error ? Promise.reject(response) : response));
  const client = { beta: { messages: { parse } } } as unknown as Anthropic;
  const instance = new AnthropicReasoningProvider({
    apiKey: undefined,
    model: "claude-opus-5-5",
    effort: "medium",
    fallbacks: "default",
    timeoutMs: 45_000,
    maxRetries: 2,
    maxOutputTokens: 16_000,
    client,
    ...options,
  });
  return { instance, parse };
}

describe("classifyAnthropicError", () => {
  it("maps rate limits and keeps retry-after", () => {
    const error = classifyAnthropicError(new Anthropic.RateLimitError(429, body("rate_limit_error", "Slow down"), "Slow down", new Headers({ "retry-after": "7" })));
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ provider: "anthropic", kind: "rate_limited", retryAfterMs: 7_000, retryable: true });
  });

  it("leaves retry-after unset when the header is missing", () => {
    const error = classifyAnthropicError(new Anthropic.RateLimitError(429, body("rate_limit_error", "Slow down"), "Slow down", new Headers()));
    expect(error).toMatchObject({ kind: "rate_limited", retryAfterMs: undefined });
  });

  it.each([
    ["authentication", () => new Anthropic.AuthenticationError(401, body("authentication_error", "invalid x-api-key"), "invalid x-api-key", new Headers()), "auth"],
    ["permission", () => new Anthropic.PermissionDeniedError(403, body("permission_error", "denied"), "denied", new Headers()), "auth"],
    ["unknown model", () => new Anthropic.NotFoundError(404, body("not_found_error", "model not found"), "model not found", new Headers()), "bad_request"],
    ["bad request", () => new Anthropic.BadRequestError(400, body("invalid_request_error", "bad"), "bad", new Headers()), "bad_request"],
    ["server error", () => new Anthropic.InternalServerError(500, body("api_error", "oops"), "oops", new Headers()), "unavailable"],
    ["overloaded", () => new Anthropic.InternalServerError(529, body("overloaded_error", "Overloaded"), "Overloaded", new Headers()), "unavailable"],
    ["timeout", () => new Anthropic.APIConnectionTimeoutError(), "timeout"],
    ["connection", () => new Anthropic.APIConnectionError({ message: "Connection error." }), "network"],
    ["other API error", () => new Anthropic.ConflictError(409, body("conflict", "conflict"), "conflict", new Headers()), "unknown"],
    ["unparseable output", () => new Anthropic.AnthropicError("Failed to parse structured output"), "invalid_output"],
    ["plain error", () => new Error("socket hang up"), "unknown"],
  ])("maps %s errors", (_label, make, kind) => {
    const error = classifyAnthropicError(make());
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).kind).toBe(kind);
  });

  it("turns a user abort into a cancellation", () => {
    expect(classifyAnthropicError(new Anthropic.APIUserAbortError())).toBeInstanceOf(JobCancelledError);
  });

  it("passes our own errors through", () => {
    const original = new ProviderError("anthropic", "refusal", "Declined.");
    expect(classifyAnthropicError(original)).toBe(original);
    const cancelled = new JobCancelledError();
    expect(classifyAnthropicError(cancelled)).toBe(cancelled);
  });
});

describe("AnthropicReasoningProvider: configuration", () => {
  it.each([undefined, ""])("refuses to start without an API key (%j)", (apiKey) => {
    const create = () =>
      new AnthropicReasoningProvider({ apiKey, model: "claude-opus-5-5", effort: "medium", fallbacks: "default", timeoutMs: 45_000, maxRetries: 2, maxOutputTokens: 16_000 });
    expect(create).toThrow(ProviderError);
    try {
      create();
    } catch (error) {
      expect(error).toMatchObject({ provider: "anthropic", kind: "not_configured" });
    }
  });

  it("describes the model it uses", () => {
    expect(provider(message(), { effort: "high" }).instance.modelInfo).toEqual({
      provider: "anthropic",
      model: "claude-opus-5-5",
      promptVersion: PROMPT_VERSION,
      effort: "high",
    });
  });
});

describe("AnthropicReasoningProvider: requests", () => {
  it("sends structured-output format, effort and server-side fallbacks", async () => {
    const { instance, parse } = provider(message());
    const abort = new AbortController();
    await instance.discoverCandidates(DISCOVERY_INPUT, abort.signal);

    expect(parse).toHaveBeenCalledTimes(1);
    const [params, options] = sent(parse);
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.max_tokens).toBe(16_000);
    expect(params.output_config.effort).toBe("medium");
    expect(params.output_config.format).toMatchObject({ type: "json_schema" });
    expect(params.output_config.format.schema.properties).toHaveProperty("candidates");
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(params.fallbacks).toBe("default");
    expect(params.system).toEqual([{ type: "text", text: DISCOVERY_SYSTEM, cache_control: { type: "ephemeral" } }]);
    expect(params.messages).toEqual([{ role: "user", content: expect.stringContaining("<documents>") }]);
    expect(options.signal).toBe(abort.signal);
  });

  it("omits fallbacks when they are turned off", async () => {
    const { instance, parse } = provider(message(), { fallbacks: "off" });
    await instance.discoverCandidates(DISCOVERY_INPUT, signal());
    const [params] = sent(parse);
    expect(params).not.toHaveProperty("betas");
    expect(params).not.toHaveProperty("fallbacks");
  });

  it("uses the matching system prompt and schema for each operation", async () => {
    const extraction = { sources: [], facts: [], contacts: [], accounts: [], relationships: [], media: [] };
    const extractCall = provider(message({ parsed_output: extraction }));
    const extractionInput: ExtractionInput = {
      subject: { displayName: "Elnara Gasimova", nativeName: null, nameVariants: [], organisation: null, role: null, location: null, distinguishingFacts: [] },
      documents: [],
      researchedAt: "2026-10-01T09:00:00.000Z",
    };
    expect((await extractCall.instance.extractEvidence(extractionInput, signal())).output).toEqual(extraction);
    const [extractParams] = sent(extractCall.parse);
    expect(extractParams.system[0].text).toBe(EXTRACTION_SYSTEM);
    expect(extractParams.output_config.format.schema.properties).toHaveProperty("facts");

    const synthesis = { summary: [], key_developments: [], gaps: [], questions: [] };
    const synthCall = provider(message({ parsed_output: synthesis }));
    const synthesisInput: SynthesisInput = { subject: extractionInput.subject, claims: [], media: [], gapsDetected: [], researchedAt: "2026-10-01T09:00:00.000Z" };
    expect((await synthCall.instance.synthesise(synthesisInput, signal())).output).toEqual(synthesis);
    const [synthParams] = sent(synthCall.parse);
    expect(synthParams.system[0].text).toBe(SYNTHESIS_SYSTEM);
  });
});

describe("AnthropicReasoningProvider: responses", () => {
  it("returns validated output and usage", async () => {
    const { instance } = provider(message());
    expect(await instance.discoverCandidates(DISCOVERY_INPUT, signal())).toEqual({
      output: VALID_DISCOVERY,
      usage: { requests: 1, credits: null, inputTokens: 1200, outputTokens: 300, cacheReadTokens: 800, model: "claude-opus-5-5" },
    });
  });

  it("reports the model that actually served the request", async () => {
    const { instance } = provider(message({ model: "claude-sonnet-5-5", usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null } }));
    const { usage } = await instance.discoverCandidates(DISCOVERY_INPUT, signal());
    expect(usage).toMatchObject({ model: "claude-sonnet-5-5", cacheReadTokens: 0 });
  });

  it("surfaces a refusal as a provider error, never as data", async () => {
    const { instance } = provider(message({ stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber" }, parsed_output: null }));
    const error = await instance.discoverCandidates(DISCOVERY_INPUT, signal()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ kind: "refusal", retryable: false });
    expect((error as ProviderError).detail).toContain("cyber");
  });

  it("treats a truncated response as invalid output", async () => {
    const { instance } = provider(message({ stop_reason: "max_tokens", parsed_output: null }));
    await expect(instance.discoverCandidates(DISCOVERY_INPUT, signal())).rejects.toMatchObject({ name: "ProviderError", kind: "invalid_output" });
  });

  it("re-validates the parsed output against our schema", async () => {
    const { instance } = provider(message({ parsed_output: { candidates: [{ candidate_ref: "c1" }], unassigned_source_ids: [] } }));
    const error = await instance.discoverCandidates(DISCOVERY_INPUT, signal()).catch((e: unknown) => e);
    expect(error).toMatchObject({ name: "ProviderError", kind: "invalid_output", retryable: true });
    expect((error as ProviderError).detail).toBeTruthy();
  });

  it("treats missing parsed output as invalid", async () => {
    const { instance } = provider(message({ parsed_output: null }));
    await expect(instance.discoverCandidates(DISCOVERY_INPUT, signal())).rejects.toMatchObject({ kind: "invalid_output" });
  });

  it("classifies SDK errors thrown by the client", async () => {
    const { instance } = provider(new Anthropic.RateLimitError(429, body("rate_limit_error", "Slow down"), "Slow down", new Headers({ "retry-after": "3" })));
    await expect(instance.discoverCandidates(DISCOVERY_INPUT, signal())).rejects.toMatchObject({ kind: "rate_limited", retryAfterMs: 3_000 });
    const aborted = provider(new Anthropic.APIUserAbortError());
    await expect(aborted.instance.discoverCandidates(DISCOVERY_INPUT, signal())).rejects.toBeInstanceOf(JobCancelledError);
  });
});
