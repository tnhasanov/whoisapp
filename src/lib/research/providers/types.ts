import type { ContentLanguage, ModelInfo, ResearchCategory } from "@/lib/domain/types";
import type { DiscoveryOutput, ExtractionOutput, SynthesisOutput } from "@/lib/research/schemas";

/* ------------------------------ Search side ------------------------------ */

export type SearchRequest = {
  query: string;
  category: ResearchCategory | "discovery";
  /** Language the query is written in (used for reporting and fixture matching). */
  language: "az" | "en" | "ru" | null;
  topic: "general" | "news";
  maxResults: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  /** ISO date (YYYY-MM-DD); only results published after it (news). */
  startDate?: string;
  country?: string | null;
};

export type SearchHit = {
  url: string;
  title: string | null;
  snippet: string;
  /** Page text when the provider returned it with the search result. */
  rawContent: string | null;
  /** Relevance score reported by the provider; used for ordering only, never displayed. */
  score: number | null;
  /** Date as reported by the search provider; may be an index date, so it is never trusted alone. */
  providerPublishedDate: string | null;
  fixtureKey?: string | null;
};

export type ProviderUsage = {
  requests: number;
  credits: number | null;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  model?: string | null;
};

export type SearchResponse = {
  hits: SearchHit[];
  usage: ProviderUsage;
};

export type ExtractedPage = {
  url: string;
  title: string | null;
  content: string;
  fixtureKey?: string | null;
};

export type ExtractResponse = {
  pages: ExtractedPage[];
  failed: { url: string; reason: string }[];
  usage: ProviderUsage;
};

export interface SearchProvider {
  readonly id: "tavily" | "fixture";
  search(request: SearchRequest, signal: AbortSignal): Promise<SearchResponse>;
  extract(urls: string[], signal: AbortSignal): Promise<ExtractResponse>;
}

/* ----------------------------- Reasoning side ---------------------------- */

/** A retrieved document as presented to the model. Text is untrusted data. */
export type EvidenceDocument = {
  id: string;
  url: string;
  title: string | null;
  publisher: string | null;
  providerPublishedDate: string | null;
  access: "full_text" | "snippet_only";
  text: string;
  fixtureKey?: string | null;
};

export type SubjectDescriptor = {
  displayName: string;
  nativeName: string | null;
  nameVariants: string[];
  organisation: string | null;
  role: string | null;
  location: string | null;
  distinguishingFacts: string[];
  fixturePersonKey?: string | null;
};

export type DiscoveryInput = {
  query: { fullName: string; company: string | null; country: string | null; profileUrl: string | null };
  nameVariants: string[];
  documents: EvidenceDocument[];
};

export type ExtractionInput = {
  subject: SubjectDescriptor;
  documents: EvidenceDocument[];
  /** ISO timestamp of the research run; lets the model reason about "current" wording. */
  researchedAt: string;
};

export type SynthesisClaim = {
  id: string;
  category: string;
  text: string;
  evidence: string;
  period: string | null;
  claimKey: string;
};

export type SynthesisMedia = {
  id: string;
  headline: string;
  outlet: string;
  publishedAt: string | null;
  coverageType: string;
  summary: string;
  involvement: string | null;
  mediaKey: string;
};

export type SynthesisInput = {
  subject: SubjectDescriptor;
  claims: SynthesisClaim[];
  media: SynthesisMedia[];
  gapsDetected: string[];
  researchedAt: string;
};

export type ReasoningResult<T> = { output: T; usage: ProviderUsage; raw?: unknown };

export interface ReasoningProvider {
  readonly id: "anthropic" | "fixture";
  readonly modelInfo: ModelInfo;
  discoverCandidates(input: DiscoveryInput, signal: AbortSignal): Promise<ReasoningResult<DiscoveryOutput>>;
  extractEvidence(input: ExtractionInput, signal: AbortSignal): Promise<ReasoningResult<ExtractionOutput>>;
  synthesise(input: SynthesisInput, signal: AbortSignal): Promise<ReasoningResult<SynthesisOutput>>;
}

/* -------------------------------- Errors --------------------------------- */

export type ProviderErrorKind =
  | "not_configured"
  | "auth"
  | "rate_limited"
  | "quota"
  | "timeout"
  | "unavailable"
  | "bad_request"
  | "refusal"
  | "invalid_output"
  | "network"
  | "cancelled"
  | "unknown";

const RETRYABLE: ReadonlySet<ProviderErrorKind> = new Set([
  "rate_limited",
  "timeout",
  "unavailable",
  "network",
  "invalid_output",
]);

/** Provider failures carry a user-safe message; technical detail goes to diagnostics only. */
export class ProviderError extends Error {
  readonly retryable: boolean;
  constructor(
    readonly provider: string,
    readonly kind: ProviderErrorKind,
    message: string,
    readonly detail?: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ProviderError";
    this.retryable = RETRYABLE.has(kind);
  }
}

export class JobCancelledError extends Error {
  constructor() {
    super("Research was cancelled.");
    this.name = "JobCancelledError";
  }
}

/** Raised when a worker discovers its lease was taken over; it must stop writing. */
export class LeaseLostError extends Error {
  constructor() {
    super("Lease lost to another worker.");
    this.name = "LeaseLostError";
  }
}

export function languageOrUnknown(value: string | null | undefined): ContentLanguage {
  if (value === "az" || value === "en" || value === "ru" || value === "tr" || value === "other") return value;
  return "unknown";
}
