import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import type { ModelInfo } from "@/lib/domain/types";
import { PROMPT_VERSION } from "@/lib/research/config";
import {
  DISCOVERY_SYSTEM,
  EXTRACTION_SYSTEM,
  SYNTHESIS_SYSTEM,
  discoveryUserMessage,
  extractionUserMessage,
  synthesisUserMessage,
} from "@/lib/research/prompts";
import {
  DiscoveryOutputSchema,
  ExtractionOutputSchema,
  SynthesisOutputSchema,
  type DiscoveryOutput,
  type ExtractionOutput,
  type SynthesisOutput,
} from "@/lib/research/schemas";
import {
  JobCancelledError,
  ProviderError,
  type DiscoveryInput,
  type ExtractionInput,
  type ReasoningProvider,
  type ReasoningResult,
  type SynthesisInput,
} from "./types";

/**
 * Live reasoning adapter (official Anthropic SDK).
 *
 * - Structured outputs (output_config.format) constrain the response shape;
 *   the result is re-validated with our Zod schema. A valid shape is not
 *   evidence of truth: the pipeline still checks source IDs and excerpts.
 * - Server-side fallbacks ("default") are enabled unless configured off.
 * - Refusals and truncation are surfaced as provider errors, never as data.
 */

export type AnthropicProviderOptions = {
  apiKey: string | undefined;
  baseURL?: string;
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  fallbacks: "default" | "off";
  timeoutMs: number;
  maxRetries: number;
  maxOutputTokens: number;
  /** Test seam. */
  client?: Anthropic;
};

export function classifyAnthropicError(error: unknown): ProviderError | JobCancelledError {
  if (error instanceof ProviderError || error instanceof JobCancelledError) return error;
  if (error instanceof Anthropic.APIUserAbortError) return new JobCancelledError();
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new ProviderError("anthropic", "timeout", "The model request timed out.", error.message);
  if (error instanceof Anthropic.APIConnectionError) return new ProviderError("anthropic", "network", "Could not reach the model provider.", error.message);
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new ProviderError("anthropic", "auth", "The model provider rejected the API key or permissions.", error.message);
  }
  if (error instanceof Anthropic.NotFoundError) return new ProviderError("anthropic", "bad_request", "The configured model is not available to this API key.", error.message);
  if (error instanceof Anthropic.RateLimitError) {
    // A missing header must not become 0 ("retry now"): Number(null) === 0.
    const header = error.headers?.get?.("retry-after");
    const retryAfter = header ? Number(header) : Number.NaN;
    return new ProviderError("anthropic", "rate_limited", "The model provider rate-limited the request.", error.message, Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined);
  }
  if (error instanceof Anthropic.BadRequestError) return new ProviderError("anthropic", "bad_request", "The model request was rejected.", error.message);
  if (error instanceof Anthropic.InternalServerError) return new ProviderError("anthropic", "unavailable", "The model provider is temporarily unavailable.", error.message);
  if (error instanceof Anthropic.APIError) return new ProviderError("anthropic", "unknown", "The model provider returned an error.", error.message);
  if (error instanceof Anthropic.AnthropicError) return new ProviderError("anthropic", "invalid_output", "The model returned output that could not be parsed.", error.message);
  const message = error instanceof Error ? error.message : String(error);
  return new ProviderError("anthropic", "unknown", "Unexpected error while calling the model.", message);
}

export class AnthropicReasoningProvider implements ReasoningProvider {
  readonly id = "anthropic" as const;
  readonly modelInfo: ModelInfo;
  private readonly client: Anthropic;

  constructor(private readonly options: AnthropicProviderOptions) {
    if (!options.apiKey && !options.client) {
      throw new ProviderError("anthropic", "not_configured", "Live analysis is not configured (ANTHROPIC_API_KEY is missing).");
    }
    this.client =
      options.client ??
      new Anthropic({
        apiKey: options.apiKey,
        authToken: null,
        // Explicit base URL: never inherit an ambient ANTHROPIC_BASE_URL meant for other tools.
        baseURL: options.baseURL ?? "https://api.anthropic.com",
        timeout: options.timeoutMs,
        maxRetries: options.maxRetries,
      });
    this.modelInfo = { provider: "anthropic", model: options.model, promptVersion: PROMPT_VERSION, effort: options.effort };
  }

  private async run<S extends z.ZodType>(schema: S, system: string, user: string, signal: AbortSignal): Promise<ReasoningResult<z.infer<S>>> {
    try {
      const response = await this.client.beta.messages.parse(
        {
          model: this.options.model,
          max_tokens: this.options.maxOutputTokens,
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: user }],
          output_config: { effort: this.options.effort, format: betaZodOutputFormat(schema) },
          ...(this.options.fallbacks === "default"
            ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
            : {}),
        },
        { signal },
      );
      if (response.stop_reason === "refusal") {
        throw new ProviderError(
          "anthropic",
          "refusal",
          "The model declined to analyse this material.",
          `refusal category: ${response.stop_details?.category ?? "unspecified"}`,
        );
      }
      if (response.stop_reason === "max_tokens") {
        throw new ProviderError("anthropic", "invalid_output", "The model response was cut off before it was complete.");
      }
      const validated = schema.safeParse(response.parsed_output);
      if (!validated.success) {
        throw new ProviderError("anthropic", "invalid_output", "The model output failed schema validation.", validated.error.message.slice(0, 800));
      }
      return {
        output: validated.data,
        usage: {
          requests: 1,
          credits: null,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
          model: response.model,
        },
      };
    } catch (error) {
      throw classifyAnthropicError(error);
    }
  }

  discoverCandidates(input: DiscoveryInput, signal: AbortSignal): Promise<ReasoningResult<DiscoveryOutput>> {
    return this.run(DiscoveryOutputSchema, DISCOVERY_SYSTEM, discoveryUserMessage(input), signal);
  }

  extractEvidence(input: ExtractionInput, signal: AbortSignal): Promise<ReasoningResult<ExtractionOutput>> {
    return this.run(ExtractionOutputSchema, EXTRACTION_SYSTEM, extractionUserMessage(input), signal);
  }

  synthesise(input: SynthesisInput, signal: AbortSignal): Promise<ReasoningResult<SynthesisOutput>> {
    return this.run(SynthesisOutputSchema, SYNTHESIS_SYSTEM, synthesisUserMessage(input), signal);
  }
}
