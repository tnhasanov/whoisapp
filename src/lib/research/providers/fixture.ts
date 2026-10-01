import type { FixtureDocument, FixturePersonBundle, MediaSelector, ClaimSelector } from "@/fixtures/types";
import { FIXTURE_BUNDLES, findFixtureBundle, fixtureDocumentsForVersion } from "@/fixtures/world";
import type { ModelInfo } from "@/lib/domain/types";
import { queryMentionsName } from "@/lib/names";
import { PROMPT_VERSION } from "@/lib/research/config";
import type {
  DiscoveryOutput,
  ExtractionOutput,
  SynthesisOutput,
} from "@/lib/research/schemas";
import { normaliseForMatch } from "@/lib/research/text";
import { registrableDomain } from "@/lib/urls/canonical";
import {
  JobCancelledError,
  ProviderError,
  type DiscoveryInput,
  type ExtractResponse,
  type ExtractionInput,
  type ReasoningProvider,
  type ReasoningResult,
  type SearchProvider,
  type SearchRequest,
  type SearchResponse,
  type SynthesisInput,
} from "./types";

/**
 * Demo providers. They replay the fictional fixture world through the same
 * interfaces, schemas and verification as the live providers. Nothing here
 * touches the network, and nothing here is ever used for live research.
 */

export type FixtureRunContext = {
  /** 1 for a first research run; 2 after a refresh (the world has moved on). */
  worldVersion: number;
  /** Simulated provider failures marked `untilRetry` do not occur in retry jobs. */
  isRetry: boolean;
  /** YYYY-MM-DD; resolves "@run-date" publication dates. */
  runDate: string;
  latencyMs: number;
};

function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new JobCancelledError());
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new JobCancelledError());
      },
      { once: true },
    );
  });
}

export function resolveFixtureDate(value: string | null | undefined, runDate: string): string | null {
  if (!value) return null;
  return value === "@run-date" ? runDate : value;
}

const FAILURE_MESSAGES = {
  timeout: "The search provider timed out.",
  rate_limited: "The search provider rate-limited the request.",
  unavailable: "The search provider was unavailable.",
} as const;

export class FixtureSearchProvider implements SearchProvider {
  readonly id = "fixture" as const;
  constructor(private readonly ctx: FixtureRunContext) {}

  private documents(): FixtureDocument[] {
    return fixtureDocumentsForVersion(this.ctx.worldVersion);
  }

  async search(request: SearchRequest, signal: AbortSignal): Promise<SearchResponse> {
    await delay(this.ctx.latencyMs, signal);
    for (const bundle of FIXTURE_BUNDLES) {
      for (const failure of bundle.person.failures ?? []) {
        if (failure.category !== request.category) continue;
        if (failure.untilRetry && this.ctx.isRetry) continue;
        if (!bundle.person.nameVariants.some((v) => queryMentionsName(request.query, v))) continue;
        throw new ProviderError(
          "fixture",
          failure.kind,
          FAILURE_MESSAGES[failure.kind],
          `Simulated ${failure.kind} for the ${request.category} search (demo scenario "${bundle.person.key}").`,
        );
      }
    }
    const include = request.includeDomains?.map((d) => d.toLowerCase());
    const matches = this.documents().filter((doc) => {
      if (!doc.categories.includes(request.category)) return false;
      if (include && include.length > 0) {
        const domain = registrableDomain(doc.url);
        if (!domain || !include.some((d) => domain === d || domain.endsWith(`.${d}`))) return false;
      }
      return doc.nameForms.some((form) => queryMentionsName(request.query, form));
    });
    const hits = matches.slice(0, request.maxResults).map((doc) => ({
      url: doc.url,
      title: doc.title,
      snippet: doc.snippet,
      // Mirrors a search provider returning page text with results (not for discovery searches).
      rawContent: request.category !== "discovery" && doc.access === "read" ? doc.body : null,
      score: null,
      providerPublishedDate: resolveFixtureDate(doc.providerPublishedDate ?? doc.publishedDate, this.ctx.runDate),
      fixtureKey: doc.key,
    }));
    return { hits, usage: { requests: 1, credits: 0 } };
  }

  async extract(urls: string[], signal: AbortSignal): Promise<ExtractResponse> {
    await delay(this.ctx.latencyMs, signal);
    const docs = this.documents();
    const pages: ExtractResponse["pages"] = [];
    const failed: ExtractResponse["failed"] = [];
    for (const url of urls) {
      const doc = docs.find((d) => d.url === url);
      if (!doc) {
        failed.push({ url, reason: "Page not found." });
      } else if (doc.access === "read" && doc.body) {
        pages.push({ url, title: doc.title, content: doc.body, fixtureKey: doc.key });
      } else if (doc.access === "login_required") {
        failed.push({ url, reason: "Login required; the page was not accessed." });
      } else if (doc.access === "paywalled") {
        failed.push({ url, reason: "Paywalled; only the search snippet is available." });
      } else {
        failed.push({ url, reason: "Page content unavailable; only the search snippet is available." });
      }
    }
    return { pages, failed, usage: { requests: 1, credits: 0 } };
  }
}

/* ------------------------------- Reasoning -------------------------------- */

function bundlesAbout(fixtureKey: string | null | undefined): FixturePersonBundle[] {
  if (!fixtureKey) return [];
  return FIXTURE_BUNDLES.filter((b) => b.extraction[fixtureKey]?.source.about_subject === "yes");
}

export class FixtureReasoningProvider implements ReasoningProvider {
  readonly id = "fixture" as const;
  readonly modelInfo: ModelInfo = { provider: "fixture", model: "fixture-replay", promptVersion: PROMPT_VERSION, effort: null };
  constructor(private readonly ctx: FixtureRunContext) {}

  async discoverCandidates(input: DiscoveryInput, signal: AbortSignal): Promise<ReasoningResult<DiscoveryOutput>> {
    await delay(this.ctx.latencyMs, signal);
    const byPerson = new Map<string, string[]>();
    const unassigned: string[] = [];
    for (const doc of input.documents) {
      const owners = bundlesAbout(doc.fixtureKey);
      if (owners.length === 0) unassigned.push(doc.id);
      for (const bundle of owners) {
        if (!byPerson.has(bundle.person.key)) byPerson.set(bundle.person.key, []);
        byPerson.get(bundle.person.key)!.push(doc.id);
      }
    }
    const candidates = [...byPerson.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([personKey, sourceIds], index) => {
        const person = findFixtureBundle(personKey)!.person;
        const anchor = input.documents.find((d) => d.fixtureKey === person.anchorDocKey);
        return {
          candidate_ref: `fixture:${personKey}#${index}`,
          display_name: person.displayName,
          native_name: person.nativeName,
          organisation: person.organisation,
          role: person.role,
          location: person.location,
          summary: person.summary,
          distinguishing_facts: person.distinguishingFacts,
          source_ids: sourceIds,
          anchor_source_id: anchor?.id ?? null,
        };
      });
    return { output: { candidates, unassigned_source_ids: unassigned }, usage: { requests: 1, credits: null, inputTokens: 0, outputTokens: 0 } };
  }

  async extractEvidence(input: ExtractionInput, signal: AbortSignal): Promise<ReasoningResult<ExtractionOutput>> {
    await delay(this.ctx.latencyMs, signal);
    const bundle = input.subject.fixturePersonKey ? findFixtureBundle(input.subject.fixturePersonKey) : undefined;
    const output: ExtractionOutput = { sources: [], facts: [], contacts: [], accounts: [], relationships: [], media: [] };
    for (const doc of input.documents) {
      const entry = doc.fixtureKey && bundle ? bundle.extraction[doc.fixtureKey] : undefined;
      const fixtureDoc = doc.fixtureKey ? fixtureDocumentsForVersion(this.ctx.worldVersion).find((d) => d.key === doc.fixtureKey) : undefined;
      if (!entry) {
        output.sources.push({
          source_id: doc.id,
          about_subject: "no",
          identity_evidence: "The document does not refer to the selected person.",
          source_type: fixtureDoc?.sourceType ?? "other",
          page_language: fixtureDoc?.language ?? "unknown",
          published_date: resolveFixtureDate(fixtureDoc?.publishedDate, this.ctx.runDate),
          updated_date: null,
          self_published: false,
        });
        continue;
      }
      const id = doc.id;
      output.sources.push({ ...entry.source, source_id: id, published_date: resolveFixtureDate(entry.source.published_date, this.ctx.runDate) });
      output.facts.push(...(entry.facts ?? []).map((f) => ({ ...f, source_id: id })));
      output.contacts.push(...(entry.contacts ?? []).map((c) => ({ ...c, source_id: id })));
      output.accounts.push(...(entry.accounts ?? []).map((a) => ({ ...a, source_id: id })));
      output.relationships.push(...(entry.relationships ?? []).map((r) => ({ ...r, source_id: id })));
      output.media.push(
        ...(entry.media ?? []).map((m) => ({ ...m, source_id: id, published_date: resolveFixtureDate(m.published_date, this.ctx.runDate) })),
      );
    }
    return { output, usage: { requests: 1, credits: null, inputTokens: 0, outputTokens: 0 } };
  }

  async synthesise(input: SynthesisInput, signal: AbortSignal): Promise<ReasoningResult<SynthesisOutput>> {
    await delay(this.ctx.latencyMs, signal);
    const bundle = input.subject.fixturePersonKey ? findFixtureBundle(input.subject.fixturePersonKey) : undefined;
    const synthesis = bundle?.synthesis[this.ctx.worldVersion as 1 | 2] ?? bundle?.synthesis[1];
    if (!synthesis) {
      return { output: { summary: [], key_developments: [], gaps: [], questions: [] }, usage: { requests: 1, credits: null } };
    }
    const claimIds = (selectors: ClaimSelector[]) =>
      selectors.flatMap((sel) =>
        input.claims
          .filter((c) => c.category === sel.category && normaliseForMatch(c.text).includes(normaliseForMatch(sel.contains)))
          .map((c) => c.id),
      );
    const mediaIds = (selectors: MediaSelector[]) =>
      selectors.flatMap((sel) =>
        input.media.filter((m) => normaliseForMatch(m.headline).includes(normaliseForMatch(sel.headlineContains))).map((m) => m.id),
      );
    // A grounded line is kept only when every selector resolves: if evidence is missing
    // (e.g. a failed news search), the sentence that depended on it is dropped.
    const resolves = (claims: ClaimSelector[], media: MediaSelector[]) =>
      claims.every((s) => claimIds([s]).length > 0) && media.every((s) => mediaIds([s]).length > 0);
    const output: SynthesisOutput = {
      summary: synthesis.summary
        .filter((s) => resolves(s.claims, s.media))
        .map((s) => ({ text: s.text, claim_ids: [...new Set(claimIds(s.claims))], media_ids: [...new Set(mediaIds(s.media))], kind: s.kind })),
      key_developments: synthesis.keyDevelopments
        .filter((k) => resolves(k.claims, k.media))
        .map((k) => ({ text: k.text, claim_ids: [...new Set(claimIds(k.claims))], media_ids: [...new Set(mediaIds(k.media))], date: k.date })),
      gaps: synthesis.gaps.map((text) => ({ text })),
      questions: synthesis.questions
        .filter((q) => resolves(q.claims, q.media))
        .map((q) => ({ question: q.question, claim_ids: [...new Set(claimIds(q.claims))], media_ids: [...new Set(mediaIds(q.media))] })),
    };
    return { output, usage: { requests: 1, credits: null, inputTokens: 0, outputTokens: 0 } };
  }
}
