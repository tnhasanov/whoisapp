import { and, asc, eq } from "drizzle-orm";
import { FIXTURE_WORLD_MAX_VERSION } from "@/fixtures/world";
import type { Database } from "@/lib/db/client";
import { candidateIdentities, profiles, researchJobs, usageRecords, type JobUsageSummary, type StepOutput } from "@/lib/db/schema";
import type { CoverageEntry, ResearchCategory } from "@/lib/domain/types";
import type { Env } from "@/lib/env";
import {
  appendEvent,
  finishJob,
  loadSteps,
  markStepFinished,
  markStepRunning,
  pauseForIdentity,
  setJobStage,
  setSelectedCandidate,
  withFence,
  type JobEventInput,
  type JobRow,
  type StepRow,
} from "@/lib/jobs/store";
import { generateNameVariants, normaliseName, type NameVariant } from "@/lib/names";
import { cacheGet, cacheKey, cachePut, contentHash } from "@/lib/research/cache";
import { estimateAnthropicCostUsd, estimateTavilyCostUsd } from "@/lib/research/config";
import { createProviders, type ProviderSet } from "@/lib/research/providers";
import {
  JobCancelledError,
  LeaseLostError,
  ProviderError,
  type EvidenceDocument,
  type ProviderUsage,
  type SearchRequest,
  type SearchResponse,
  type SubjectDescriptor,
} from "@/lib/research/providers/types";
import { EMPTY_EXTRACTION, type DiscoveryOutput, type ExtractionOutput, type SynthesisOutput } from "@/lib/research/schemas";
import { canonicaliseUrl } from "@/lib/urls/canonical";
import { safeFetchText } from "@/lib/urls/safe-fetch";
import { checkUrl } from "@/lib/urls/safe-url";
import { assembleSnapshot, documentTextForModel, type DraftSnapshot } from "./assemble";
import { isLoginWalledDomain, loadDocuments, storeHits, updateDocumentContent, type JobDocumentRow } from "./documents";
import { decideIdentity, evaluateCandidates, type AutoSelection } from "./identity";
import { persistSnapshot } from "./persist";
import { buildSynthesisInput, overviewWithoutNarrative, validateSynthesis } from "./synthesis";

/* -------------------------------------------------------------------------- */

export type RunContext = {
  db: Database;
  env: Env;
  job: JobRow;
  token: number;
  signal: AbortSignal;
  /** Why the signal fired (set by the heartbeat loop). */
  abortReason: () => "cancelled" | "lease_lost" | "shutdown" | null;
  log?: (message: string, extra?: Record<string, unknown>) => void;
};

export type RunOutcome = "completed" | "partial" | "awaiting_identity" | "no_candidates" | "failed" | "cancelled" | "lease_lost" | "released";

class StepFailedError extends Error {
  constructor(
    readonly step: string,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "StepFailedError";
  }
}

const STEP_SEQ: Record<string, number> = {
  normalise: 10,
  "discover:search": 20,
  "discover:identify": 30,
  resolve: 40,
  plan: 50,
  "search:career": 60,
  "search:contacts": 61,
  "search:accounts": 62,
  "search:connections": 63,
  "search:news": 64,
  retrieve: 70,
  verify: 200,
  synthesise: 210,
  persist: 220,
};

const EXTRACT_BATCH_MAX_DOCS = 6;
const EXTRACT_BATCH_MAX_CHARS = 60_000;
const DISCOVERY_DOC_CHARS = 4_000;
const SOCIAL_SEARCH_DOMAINS = [
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "youtube.com",
  "github.com",
  "linkedin.example",
  "x.example",
  "instagram.example",
  "facebook.example",
  "youtube.example",
  "github.example",
];

type PlannedQuery = SearchRequest & { label: string };

type DiscoverySearchOutput = {
  queries: { query: string; language: string | null; results: number; error: string | null }[];
  documentKeys: string[];
  blocked: { url: string; reason: string }[];
};

type IdentifyOutput = { candidateCount: number; selection: AutoSelection };

type SearchStepOutput = {
  queries: { query: string; language: string | null; results: number }[];
  documentKeys: string[];
  blocked: { url: string; reason: string }[];
};

type RetrieveOutput = { attempted: number; read: number; failed: { key: string; reason: string }[]; skippedLoginWalled: number };

type ExtractStepOutput = { documentKeys: string[]; extraction: ExtractionOutput };

/* -------------------------------------------------------------------------- */

export async function runJob(rc: RunContext): Promise<RunOutcome> {
  const runner = new JobRunner(rc);
  return runner.run();
}

class JobRunner {
  private readonly db: Database;
  private job: JobRow;
  private steps = new Map<string, StepRow>();
  private failures: { step: string; code: string; message: string; optional: boolean }[] = [];
  private usage: JobUsageSummary;
  private providers: ProviderSet | null = null;
  private readonly researchedAt: Date;

  constructor(private readonly rc: RunContext) {
    this.db = rc.db;
    this.job = rc.job;
    this.researchedAt = new Date();
    this.usage = rc.job.usage ?? { searchRequests: 0, extractRequests: 0, modelCalls: 0, inputTokens: 0, outputTokens: 0, credits: 0, estimatedCostUsd: 0 };
  }

  /* ------------------------------ plumbing ------------------------------ */

  private throwIfAborted() {
    if (!this.rc.signal.aborted) return;
    const reason = this.rc.abortReason();
    if (reason === "lease_lost" || reason === "shutdown") throw new LeaseLostError();
    throw new JobCancelledError();
  }

  private async emit(event: JobEventInput) {
    await appendEvent(this.db, this.job.id, event);
  }

  private async recordUsage(provider: "tavily" | "anthropic" | "fixture", operation: string, usage: ProviderUsage, cached = false) {
    const inputTokens = usage.inputTokens ?? 0;
    const outputTokens = usage.outputTokens ?? 0;
    const cacheReadTokens = usage.cacheReadTokens ?? 0;
    const credits = usage.credits ?? 0;
    const cost = cached
      ? 0
      : provider === "anthropic"
        ? estimateAnthropicCostUsd(usage.model ?? this.job.config.model.model, inputTokens, outputTokens, cacheReadTokens)
        : provider === "tavily"
          ? estimateTavilyCostUsd(credits)
          : 0;
    if (!cached) {
      if (operation === "search") this.usage.searchRequests += usage.requests;
      else if (operation === "extract") this.usage.extractRequests += usage.requests;
      else this.usage.modelCalls += usage.requests;
      this.usage.inputTokens += inputTokens;
      this.usage.outputTokens += outputTokens;
      this.usage.credits += credits;
      this.usage.estimatedCostUsd = Number((this.usage.estimatedCostUsd + cost).toFixed(5));
    }
    await this.db.insert(usageRecords).values({
      ownerId: this.job.ownerId,
      jobId: this.job.id,
      workspace: this.job.workspace,
      provider,
      operation,
      model: provider === "anthropic" ? (usage.model ?? this.job.config.model.model) : null,
      requests: cached ? 0 : usage.requests,
      inputTokens: cached ? 0 : inputTokens,
      outputTokens: cached ? 0 : outputTokens,
      cacheReadTokens: cached ? 0 : cacheReadTokens,
      credits: String(cached ? 0 : credits),
      estimatedCostUsd: String(cost),
      cached,
    });
  }

  private providerName(): "tavily" | "anthropic" | "fixture" {
    return this.job.workspace === "live" ? "tavily" : "fixture";
  }

  private reasoningName(): "anthropic" | "fixture" {
    return this.job.workspace === "live" ? "anthropic" : "fixture";
  }

  private shouldRetry(error: ProviderError): boolean {
    // The Anthropic SDK already retries transport/429/5xx errors; only re-ask on malformed output.
    if (error.provider === "anthropic") return error.kind === "invalid_output";
    return error.retryable;
  }

  private async sleep(ms: number) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      this.rc.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(this.rc.abortReason() === "cancelled" ? new JobCancelledError() : new LeaseLostError());
        },
        { once: true },
      );
    });
  }

  /**
   * Execute a step once per job: completed checkpoints are reused, retryable
   * provider errors are retried with backoff, optional steps degrade to a
   * partial result instead of failing the job.
   */
  private async step<T extends StepOutput>(name: string, stage: string, optional: boolean, fn: () => Promise<T>): Promise<T | null> {
    const existing = this.steps.get(name);
    if (existing?.status === "completed") return (existing.output ?? null) as T | null;
    this.throwIfAborted();
    const seq = STEP_SEQ[name] ?? (name.startsWith("extract:") ? 100 + Number(name.split(":")[1]) : 150);
    await withFence(this.db, this.job.id, this.rc.token, async (tx) => {
      await markStepRunning(tx, { jobId: this.job.id, name, stage, seq, optional });
      await setJobStage(tx, this.job.id, stage);
    });
    const started = Date.now();
    const maxRetries = this.job.config.limits.providerMaxRetries;
    for (let attempt = 0; ; attempt++) {
      try {
        const output = await fn();
        await withFence(this.db, this.job.id, this.rc.token, async (tx) => {
          await markStepFinished(tx, { jobId: this.job.id, name, status: "completed", output, durationMs: Date.now() - started });
          await tx.update(researchJobs).set({ usage: this.usage, lastProgressAt: new Date() }).where(eq(researchJobs.id, this.job.id));
        });
        this.steps.set(name, { ...(existing ?? ({} as StepRow)), name, status: "completed", output } as StepRow);
        return output;
      } catch (error) {
        if (error instanceof JobCancelledError || error instanceof LeaseLostError) throw error;
        const providerError = error instanceof ProviderError ? error : null;
        if (providerError && this.shouldRetry(providerError) && attempt < maxRetries) {
          const wait = providerError.retryAfterMs ?? Math.min(8_000, 1_000 * 2 ** attempt) + Math.floor(Math.random() * 250);
          await this.emit({
            level: "warn",
            stage,
            code: "step.retrying",
            message: `${providerError.message} Retrying (${attempt + 1}/${maxRetries}).`,
            data: { step: name, attempt: attempt + 1, max: maxRetries, kind: providerError.kind },
          });
          await this.sleep(wait);
          this.throwIfAborted();
          continue;
        }
        const code = providerError ? `${providerError.provider}.${providerError.kind}` : "internal_error";
        const message = providerError?.message ?? "An internal error stopped this step.";
        await withFence(this.db, this.job.id, this.rc.token, async (tx) => {
          await markStepFinished(tx, { jobId: this.job.id, name, status: "failed", errorCode: code, errorMessage: message, durationMs: Date.now() - started });
        });
        await this.emit({ level: optional ? "warn" : "error", stage, code: "step.failed", message, data: { step: name, code, optional } });
        await this.emit({
          level: "error",
          stage,
          code: "step.failed.detail",
          visibility: "diagnostic",
          message: providerError?.detail ?? (error instanceof Error ? (error.stack ?? error.message) : String(error)).slice(0, 4000),
          data: { step: name },
        });
        this.failures.push({ step: name, code, message, optional });
        if (optional) return null;
        throw new StepFailedError(name, code, message);
      }
    }
  }

  private async search(request: SearchRequest, bypassCache: boolean): Promise<SearchResponse> {
    const key = cacheKey({
      op: "search",
      provider: this.providerName(),
      query: request.query,
      topic: request.topic,
      max: request.maxResults,
      include: request.includeDomains ?? null,
      start: request.startDate ?? null,
      category: request.category,
      world: this.job.workspace === "demo" ? this.worldVersion : null,
    });
    if (!bypassCache) {
      const cached = await cacheGet<SearchResponse>(this.db, this.job.ownerId, this.job.workspace, key);
      if (cached) {
        await this.recordUsage(this.providerName(), "search", cached.usage, true);
        return cached;
      }
    }
    const response = await this.providers!.search.search(request, this.rc.signal);
    await this.recordUsage(this.providerName(), "search", response.usage);
    await cachePut(this.db, {
      ownerId: this.job.ownerId,
      workspace: this.job.workspace,
      jobId: this.job.id,
      key,
      provider: this.providerName(),
      operation: "search",
      response,
      ttlHours: this.rc.env.PROVIDER_CACHE_TTL_HOURS,
    });
    return response;
  }

  private worldVersion = 1;

  private makeProviders(worldVersion: number) {
    this.worldVersion = worldVersion;
    this.providers = createProviders({
      workspace: this.job.workspace,
      config: this.job.config,
      env: this.rc.env,
      fixture: { worldVersion, isRetry: this.job.kind === "retry", runDate: this.job.createdAt.toISOString().slice(0, 10) },
    });
  }

  /* -------------------------------- run --------------------------------- */

  async run(): Promise<RunOutcome> {
    try {
      for (const s of await loadSteps(this.db, this.job.id)) this.steps.set(s.name, s);
      await this.emit({ code: "job.started", message: this.job.attempt > 0 ? "Research resumed from saved checkpoints." : "Research started.", data: { attempt: this.job.attempt } });
      if (this.job.phase === "discovery") {
        this.makeProviders(1);
        const next = await this.discoveryPhase();
        if (next !== "research") return next;
      }
      return await this.researchPhase();
    } catch (error) {
      if (error instanceof LeaseLostError) {
        this.rc.log?.("lease lost; stopping without writes", { jobId: this.job.id });
        return this.rc.abortReason() === "shutdown" ? "released" : "lease_lost";
      }
      if (error instanceof JobCancelledError) {
        try {
          await withFence(this.db, this.job.id, this.rc.token, (tx) => finishJob(tx, this.job.id, { status: "cancelled", usage: this.usage }));
          await this.emit({ code: "job.cancelled", message: "Research cancelled. Completed steps were kept." });
        } catch (e) {
          if (!(e instanceof LeaseLostError)) throw e;
        }
        return "cancelled";
      }
      const code = error instanceof StepFailedError ? error.code : error instanceof ProviderError ? `${error.provider}.${error.kind}` : "internal_error";
      const message =
        error instanceof StepFailedError || error instanceof ProviderError
          ? error.message
          : "An unexpected internal error stopped the research. Details were logged.";
      if (!(error instanceof StepFailedError)) {
        await this.emit({
          level: "error",
          code: "job.internal_error",
          visibility: "diagnostic",
          message: error instanceof Error ? (error.stack ?? error.message).slice(0, 4000) : String(error),
        });
      }
      try {
        await withFence(this.db, this.job.id, this.rc.token, (tx) =>
          finishJob(tx, this.job.id, { status: "failed", errorCode: code, errorMessage: message, usage: this.usage }),
        );
        await this.emit({ level: "error", code: "job.failed", message, data: { code } });
      } catch (e) {
        if (!(e instanceof LeaseLostError)) throw e;
        return "lease_lost";
      }
      return "failed";
    }
  }

  /* ----------------------------- discovery ------------------------------ */

  private async discoveryPhase(): Promise<"research" | "awaiting_identity" | "no_candidates"> {
    const query = this.job.query;
    const normalised = (await this.step("normalise", "normalise", false, async () => {
      const name = normaliseName(query.fullName);
      const variants = generateNameVariants(query.fullName, 8);
      await this.emit({ stage: "normalise", code: "names.variants", message: `Prepared ${variants.length} spelling variants for searching.`, data: { variants: variants.map((v) => v.text) } });
      return { display: name.display, script: name.script, variants };
    })) as { display: string; script: string; variants: NameVariant[] };

    const discovery = (await this.step("discover:search", "discover", false, async (): Promise<DiscoverySearchOutput> => {
      const picks: NameVariant[] = [];
      // Up to 3 discovery searches, always leaving at least one for research.
      const maxDiscovery = Math.max(1, Math.min(3, this.job.config.limits.maxSearchQueries - 1));
      for (const lang of ["original", "az", "ru", "en"] as const) {
        const v = lang === "original" ? normalised.variants[0] : normalised.variants.find((x) => x.language === lang && !picks.includes(x));
        if (v && !picks.includes(v)) picks.push(v);
        if (picks.length >= maxDiscovery) break;
      }
      const context = [query.company ? `"${query.company}"` : null, query.country].filter(Boolean).join(" ");
      const outputs: DiscoverySearchOutput = { queries: [], documentKeys: [], blocked: [] };
      let succeeded = 0;
      let lastError: ProviderError | null = null;
      for (const variant of picks) {
        const q = `"${variant.text}"${context ? ` ${context}` : ""}`;
        try {
          const response = await this.search(
            { query: q, category: "discovery", language: variant.language, topic: "general", maxResults: Math.min(10, this.job.config.limits.maxResultsPerQuery + 2) },
            false,
          );
          const stored = await withFence(this.db, this.job.id, this.rc.token, (tx) =>
            storeHits(tx, { jobId: this.job.id, ownerId: this.job.ownerId, category: "discovery", hits: response.hits, retentionDays: this.rc.env.SOURCE_CONTENT_RETENTION_DAYS }),
          );
          for (const s of stored) {
            if (s.kind === "stored" && !outputs.documentKeys.includes(s.key)) outputs.documentKeys.push(s.key);
            if (s.kind === "blocked") outputs.blocked.push({ url: s.url, reason: s.reason });
          }
          outputs.queries.push({ query: q, language: variant.language, results: response.hits.length, error: null });
          succeeded++;
          await this.emit({ stage: "discover", code: "search.completed", message: `Searched ${q} (${response.hits.length} results).`, data: { query: q, results: response.hits.length, language: variant.language } });
        } catch (error) {
          if (!(error instanceof ProviderError)) throw error;
          lastError = error;
          outputs.queries.push({ query: q, language: variant.language, results: 0, error: error.message });
          await this.emit({ level: "warn", stage: "discover", code: "search.failed", message: `${error.message} (${q})`, data: { query: q } });
        }
      }
      if (succeeded === 0 && lastError) throw lastError;

      if (query.profileUrl) {
        const check = checkUrl(query.profileUrl);
        if (check.ok) {
          try {
            const extracted = await this.providers!.search.extract([check.url.toString()], this.rc.signal);
            await this.recordUsage(this.providerName(), "extract", extracted.usage);
            const page = extracted.pages[0];
            const stored = await withFence(this.db, this.job.id, this.rc.token, (tx) =>
              storeHits(tx, {
                jobId: this.job.id,
                ownerId: this.job.ownerId,
                category: "discovery",
                hits: [{ url: check.url.toString(), title: page?.title ?? null, snippet: (page?.content ?? "").slice(0, 300), rawContent: page?.content ?? null, score: null, providerPublishedDate: null, fixtureKey: page?.fixtureKey ?? null }],
                retentionDays: this.rc.env.SOURCE_CONTENT_RETENTION_DAYS,
              }),
            );
            for (const s of stored) if (s.kind === "stored" && !outputs.documentKeys.includes(s.key)) outputs.documentKeys.push(s.key);
            await this.emit({ stage: "discover", code: "profile_url.read", message: page ? "Read the profile page you supplied." : "The profile page you supplied could not be read.", data: { ok: Boolean(page) } });
          } catch (error) {
            if (!(error instanceof ProviderError)) throw error;
            await this.emit({ level: "warn", stage: "discover", code: "profile_url.failed", message: `The supplied profile page could not be read: ${error.message}` });
          }
        }
      }
      return outputs;
    }))!;

    const identify = (await this.step("discover:identify", "discover", false, async (): Promise<IdentifyOutput> => {
      const docs = (await loadDocuments(this.db, this.job.id)).filter((d) => discovery.documentKeys.includes(d.sourceKey));
      if (docs.length === 0) return { candidateCount: 0, selection: { decision: "none", reason: "No search results mentioned this name." } };
      const evidence: EvidenceDocument[] = docs.map((d) => ({
        id: d.sourceKey,
        url: d.url,
        title: d.title,
        publisher: d.publisher,
        providerPublishedDate: d.providerPublishedAt,
        access: d.content ? "full_text" : "snippet_only",
        text: d.content ? d.content.slice(0, DISCOVERY_DOC_CHARS) : [d.title, d.snippet].filter(Boolean).join("\n"),
        fixtureKey: d.fixtureKey,
      }));
      const key = cacheKey({
        op: "discover",
        model: this.providers!.reasoning.modelInfo.model,
        prompt: this.providers!.reasoning.modelInfo.promptVersion,
        query,
        docs: evidence.map((e) => [e.id, contentHash(e.text), e.fixtureKey ?? null]),
      });
      let output = await cacheGet<DiscoveryOutput>(this.db, this.job.ownerId, this.job.workspace, key);
      if (output) {
        await this.recordUsage(this.reasoningName(), "discover", { requests: 1, credits: null }, true);
      } else {
        const result = await this.providers!.reasoning.discoverCandidates(
          { query, nameVariants: normalised.variants.map((v) => v.text), documents: evidence },
          this.rc.signal,
        );
        output = result.output;
        await this.recordUsage(this.reasoningName(), "discover", result.usage);
        await cachePut(this.db, { ownerId: this.job.ownerId, workspace: this.job.workspace, jobId: this.job.id, key, provider: this.reasoningName(), operation: "discover", response: output, ttlHours: this.rc.env.PROVIDER_CACHE_TTL_HOURS });
      }
      const evaluated = evaluateCandidates(
        output.candidates,
        docs.map((d) => ({ key: d.sourceKey, url: d.url, canonicalUrl: d.canonicalUrl, title: d.title, snippet: d.snippet })),
        query,
        normalised.variants.map((v) => v.text),
      );
      const selection = decideIdentity(evaluated, query, this.job.config.autoSelect !== false);
      const docByKey = new Map(docs.map((d) => [d.sourceKey, d]));
      await withFence(this.db, this.job.id, this.rc.token, async (tx) => {
        await tx.delete(candidateIdentities).where(eq(candidateIdentities.jobId, this.job.id));
        if (evaluated.length > 0) {
          await tx.insert(candidateIdentities).values(
            evaluated.map((c) => ({
              jobId: this.job.id,
              ownerId: this.job.ownerId,
              rank: c.rank,
              displayName: c.displayName,
              nativeName: c.nativeName,
              organisation: c.organisation,
              role: c.role,
              location: c.location,
              summary: c.summary,
              matchStrength: c.matchStrength,
              matchReasons: c.matchReasons,
              distinguishingFacts: c.distinguishingFacts,
              sourceRefs: c.sourceKeys.map((k) => {
                const d = docByKey.get(k)!;
                return { key: k, url: d.url, title: d.title, publisher: d.publisher, fixtureKey: d.fixtureKey };
              }),
              anchorKey: c.anchorKey,
              anchorUrls: c.anchorUrls,
              nameVariants: c.nameVariants,
              autoSelected: selection.decision === "auto" && selection.rank === c.rank,
              fixturePersonKey: c.fixturePersonKey,
            })),
          );
        }
      });
      await this.emit({ stage: "discover", code: "candidates.found", message: `Found ${evaluated.length} distinct ${evaluated.length === 1 ? "person" : "people"} matching the name.`, data: { count: evaluated.length } });
      return { candidateCount: evaluated.length, selection };
    }))!;

    const resolved = await this.step("resolve", "resolve", false, async () => {
      const selection = identify.selection;
      if (this.job.selectedCandidateId) return { decision: "preselected" };
      if (selection.decision === "auto") {
        const [candidate] = await this.db
          .select({ id: candidateIdentities.id })
          .from(candidateIdentities)
          .where(and(eq(candidateIdentities.jobId, this.job.id), eq(candidateIdentities.rank, selection.rank)));
        if (candidate) {
          await withFence(this.db, this.job.id, this.rc.token, (tx) =>
            setSelectedCandidate(tx, this.job.id, candidate.id, { method: selection.method, reason: selection.reason, decidedAt: new Date().toISOString() }),
          );
          this.job = { ...this.job, selectedCandidateId: candidate.id };
          await this.emit({ stage: "resolve", code: "identity.auto", message: selection.reason });
          return { decision: "auto", rank: selection.rank };
        }
      }
      return { decision: selection.decision };
    });

    if (resolved?.decision === "auto" || resolved?.decision === "preselected") {
      if (!this.job.selectedCandidateId) {
        const [fresh] = await this.db.select().from(researchJobs).where(eq(researchJobs.id, this.job.id));
        this.job = { ...this.job, selectedCandidateId: fresh.selectedCandidateId };
      }
      return "research";
    }
    if (resolved?.decision === "none") {
      await withFence(this.db, this.job.id, this.rc.token, (tx) => finishJob(tx, this.job.id, { status: "completed", outcome: "no_candidates", usage: this.usage }));
      await this.emit({ code: "job.no_candidates", message: "No matching people were found. Try another spelling or add a company." });
      return "no_candidates";
    }
    await withFence(this.db, this.job.id, this.rc.token, (tx) => pauseForIdentity(tx, this.job.id, this.usage));
    await this.emit({ stage: "resolve", code: "identity.awaiting", message: "Several possible matches were found. Choose the right person to continue.", data: { count: identify.candidateCount } });
    return "awaiting_identity";
  }

  /* ------------------------------ research ------------------------------ */

  private async researchPhase(): Promise<RunOutcome> {
    if (!this.job.selectedCandidateId) throw new StepFailedError("resolve", "no_identity", "No identity was selected for this research.");
    const [candidate] = await this.db
      .select()
      .from(candidateIdentities)
      .where(and(eq(candidateIdentities.id, this.job.selectedCandidateId), eq(candidateIdentities.ownerId, this.job.ownerId)));
    if (!candidate) throw new StepFailedError("resolve", "no_identity", "The selected identity no longer exists.");

    const subject: SubjectDescriptor = {
      displayName: candidate.displayName,
      nativeName: candidate.nativeName,
      nameVariants: candidate.nameVariants,
      organisation: candidate.organisation,
      role: candidate.role,
      location: candidate.location,
      distinguishingFacts: candidate.distinguishingFacts,
      fixturePersonKey: candidate.fixturePersonKey,
    };
    const limits = this.job.config.limits;

    const plan = (await this.step("plan", "plan", false, async () => {
      let worldVersion = 1;
      if (this.job.workspace === "demo") {
        const profileId = this.job.profileId;
        const [existing] = profileId
          ? await this.db.select({ count: profiles.snapshotCount }).from(profiles).where(eq(profiles.id, profileId))
          : await this.db
              .select({ count: profiles.snapshotCount })
              .from(profiles)
              .where(and(eq(profiles.ownerId, this.job.ownerId), eq(profiles.workspace, "demo"), eq(profiles.anchorKey, candidate.anchorKey)));
        worldVersion = Math.min(FIXTURE_WORLD_MAX_VERSION, (existing?.count ?? 0) + 1);
      }
      const queries = buildQueryPlan(subject, limits, this.researchedAt);
      await this.emit({ stage: "plan", code: "plan.ready", message: `Planned ${queries.length} bounded searches across career, contacts, accounts, connections${limits.includeNews ? " and news" : ""}.`, data: { queries: queries.length } });
      return { worldVersion, queries };
    }))! as { worldVersion: number; queries: PlannedQuery[] };
    this.makeProviders(plan.worldVersion);

    const categories: ResearchCategory[] = ["career", "contacts", "accounts", "connections", "news"];
    const bypass = this.job.config.bypassSearchCache === true;
    const searchOutputs = new Map<ResearchCategory, SearchStepOutput | null>();
    for (const category of categories) {
      const planned = plan.queries.filter((q) => q.category === category);
      if (planned.length === 0) {
        searchOutputs.set(category, null);
        continue;
      }
      const out = await this.step(`search:${category}`, "search", true, async (): Promise<SearchStepOutput> => {
        const result: SearchStepOutput = { queries: [], documentKeys: [], blocked: [] };
        for (const q of planned) {
          const response = await this.search(q, bypass);
          const stored = await withFence(this.db, this.job.id, this.rc.token, (tx) =>
            storeHits(tx, { jobId: this.job.id, ownerId: this.job.ownerId, category, hits: response.hits, retentionDays: this.rc.env.SOURCE_CONTENT_RETENTION_DAYS }),
          );
          for (const s of stored) {
            if (s.kind === "stored" && !result.documentKeys.includes(s.key)) result.documentKeys.push(s.key);
            if (s.kind === "blocked") result.blocked.push({ url: s.url, reason: s.reason });
          }
          result.queries.push({ query: q.query, language: q.language, results: response.hits.length });
          await this.emit({ stage: "search", code: "search.completed", message: `${q.label}: ${response.hits.length} results.`, data: { category, query: q.query, results: response.hits.length, language: q.language } });
        }
        return result;
      });
      searchOutputs.set(category, out);
    }

    // Retrieval: read pages that the search did not already return in full.
    const candidateKeys = new Set(candidate.sourceRefs.map((r) => r.key));
    await this.step("retrieve", "retrieve", true, async (): Promise<RetrieveOutput> => {
      const docs = await loadDocuments(this.db, this.job.id);
      const relevant = docs.filter((d) => candidateKeys.has(d.sourceKey) || d.categories.some((c) => c !== "discovery"));
      const loginWalled = relevant.filter((d) => isLoginWalledDomain(d.url));
      for (const d of loginWalled) {
        if (d.accessStatus !== "login_required") {
          await withFence(this.db, this.job.id, this.rc.token, (tx) =>
            updateDocumentContent(tx, { jobId: this.job.id, key: d.sourceKey, content: null, accessStatus: "login_required", accessNote: "Platform requires sign-in; only the search listing was used." }),
          );
        }
      }
      const toRead = relevant
        .filter((d) => !d.content && !isLoginWalledDomain(d.url) && d.accessStatus !== "paywalled")
        .slice(0, limits.maxExtractPages);
      const out: RetrieveOutput = { attempted: toRead.length, read: 0, failed: [], skippedLoginWalled: loginWalled.length };
      for (let i = 0; i < toRead.length; i += 10) {
        const chunk = toRead.slice(i, i + 10);
        const pending: JobDocumentRow[] = [];
        for (const d of chunk) {
          const cached = await cacheGet<{ title: string | null; content: string }>(this.db, this.job.ownerId, this.job.workspace, cacheKey({ op: "extract", url: d.canonicalUrl, world: this.job.workspace === "demo" ? this.worldVersion : null }));
          if (cached && !bypass) {
            await withFence(this.db, this.job.id, this.rc.token, (tx) =>
              updateDocumentContent(tx, { jobId: this.job.id, key: d.sourceKey, content: cached.content, accessStatus: "read", accessMethod: d.fixtureKey ? "fixture" : "provider_extract", title: d.title ?? cached.title }),
            );
            out.read++;
          } else pending.push(d);
        }
        if (pending.length === 0) continue;
        const response = await this.providers!.search.extract(pending.map((d) => d.url), this.rc.signal);
        await this.recordUsage(this.providerName(), "extract", response.usage);
        for (const page of response.pages) {
          const d = pending.find((p) => p.url === page.url || p.canonicalUrl === canonicaliseUrl(page.url));
          if (!d || !page.content.trim()) continue;
          await withFence(this.db, this.job.id, this.rc.token, (tx) =>
            updateDocumentContent(tx, { jobId: this.job.id, key: d.sourceKey, content: page.content, accessStatus: "read", accessMethod: d.fixtureKey ? "fixture" : "provider_extract", title: d.title ?? page.title }),
          );
          await cachePut(this.db, { ownerId: this.job.ownerId, workspace: this.job.workspace, jobId: this.job.id, key: cacheKey({ op: "extract", url: d.canonicalUrl, world: this.job.workspace === "demo" ? this.worldVersion : null }), provider: this.providerName(), operation: "extract", response: { title: page.title, content: page.content }, ttlHours: this.rc.env.PROVIDER_CACHE_TTL_HOURS });
          out.read++;
          await this.emit({ stage: "retrieve", code: "page.read", message: `Read ${d.publisher ?? d.url}.`, data: { key: d.sourceKey, publisher: d.publisher } });
        }
        for (const failed of response.failed) {
          const d = pending.find((p) => p.url === failed.url);
          if (!d) continue;
          let content: string | null = null;
          if (this.rc.env.DIRECT_FETCH_ENABLED && this.job.workspace === "live" && !/paywall|login|sign-in/i.test(failed.reason)) {
            try {
              const fetched = await safeFetchText(d.url, { timeoutMs: Math.min(15_000, limits.providerTimeoutMs), signal: this.rc.signal });
              content = fetched.text.slice(0, limits.maxSourceChars);
            } catch {
              content = null;
            }
          }
          const status = content ? "read" : /paywall/i.test(failed.reason) ? "paywalled" : /login|sign-in/i.test(failed.reason) ? "login_required" : "snippet_only";
          await withFence(this.db, this.job.id, this.rc.token, (tx) =>
            updateDocumentContent(tx, {
              jobId: this.job.id,
              key: d.sourceKey,
              content,
              accessStatus: status,
              accessMethod: content ? "direct_fetch" : undefined,
              accessNote: content ? null : `${failed.reason}`,
            }),
          );
          if (content) out.read++;
          else {
            out.failed.push({ key: d.sourceKey, reason: failed.reason });
            await this.emit({ level: "warn", stage: "retrieve", code: "page.limited", message: `${d.publisher ?? d.url}: ${failed.reason}`, data: { key: d.sourceKey, status } });
          }
        }
      }
      return out;
    });

    // Extraction in deterministic batches within the model-call budget.
    const docs = await loadDocuments(this.db, this.job.id);
    const analysable = docs
      .filter((d) => candidateKeys.has(d.sourceKey) || d.categories.some((c) => c !== "discovery"))
      .sort((a, b) => Number(a.sourceKey.slice(1)) - Number(b.sourceKey.slice(1)));
    const batches: JobDocumentRow[][] = [];
    let current: JobDocumentRow[] = [];
    let chars = 0;
    for (const d of analysable) {
      const len = documentTextForModel(d, limits.maxSourceChars).length;
      if (current.length >= EXTRACT_BATCH_MAX_DOCS || (current.length > 0 && chars + len > EXTRACT_BATCH_MAX_CHARS)) {
        batches.push(current);
        current = [];
        chars = 0;
      }
      current.push(d);
      chars += len;
    }
    if (current.length > 0) batches.push(current);
    const maxBatches = Math.max(1, limits.maxModelCalls - 2);
    const notAnalysed: { key: string; reason: "budget" | "analysis_failed" }[] = batches
      .slice(maxBatches)
      .flat()
      .map((d) => ({ key: d.sourceKey, reason: "budget" as const }));
    if (notAnalysed.length > 0) {
      await this.emit({ level: "warn", stage: "extract", code: "budget.reached", message: `${notAnalysed.length} retrieved sources were not analysed because the research budget was reached.`, data: { count: notAnalysed.length } });
    }
    const extractions: ExtractionOutput[] = [];
    const analysedKeys: string[] = [];
    const usedBatches = batches.slice(0, maxBatches);
    for (const [index, batch] of usedBatches.entries()) {
      const out = await this.step(`extract:${index + 1}`, "extract", true, async (): Promise<ExtractStepOutput> => {
        const evidence: EvidenceDocument[] = batch.map((d) => ({
          id: d.sourceKey,
          url: d.url,
          title: d.title,
          publisher: d.publisher,
          providerPublishedDate: d.providerPublishedAt,
          access: d.accessStatus === "read" && d.content ? "full_text" : "snippet_only",
          text: documentTextForModel(d, limits.maxSourceChars),
          fixtureKey: d.fixtureKey,
        }));
        const key = cacheKey({
          op: "extract-evidence",
          model: this.providers!.reasoning.modelInfo.model,
          prompt: this.providers!.reasoning.modelInfo.promptVersion,
          subject: candidate.anchorKey,
          docs: evidence.map((e) => [e.id, e.url, contentHash(e.text)]),
          world: this.job.workspace === "demo" ? this.worldVersion : null,
        });
        let extraction = await cacheGet<ExtractionOutput>(this.db, this.job.ownerId, this.job.workspace, key);
        if (extraction) {
          await this.recordUsage(this.reasoningName(), "extract-evidence", { requests: 1, credits: null }, true);
        } else {
          const result = await this.providers!.reasoning.extractEvidence({ subject, documents: evidence, researchedAt: this.researchedAt.toISOString() }, this.rc.signal);
          extraction = result.output;
          await this.recordUsage(this.reasoningName(), "extract-evidence", result.usage);
          await cachePut(this.db, { ownerId: this.job.ownerId, workspace: this.job.workspace, jobId: this.job.id, key, provider: this.reasoningName(), operation: "extract-evidence", response: extraction, ttlHours: this.rc.env.PROVIDER_CACHE_TTL_HOURS });
        }
        await this.emit({ stage: "extract", code: "extract.batch", message: `Analysed batch ${index + 1} of ${usedBatches.length} (${batch.length} sources).`, data: { batch: index + 1, total: usedBatches.length, sources: batch.length } });
        return { documentKeys: batch.map((d) => d.sourceKey), extraction };
      });
      if (out) {
        extractions.push(out.extraction ?? EMPTY_EXTRACTION);
        analysedKeys.push(...out.documentKeys);
      } else {
        notAnalysed.push(...batch.map((d) => ({ key: d.sourceKey, reason: "analysis_failed" as const })));
      }
    }

    // Coverage per category.
    const coverage: CoverageEntry[] = [];
    for (const category of categories) {
      const planned = plan.queries.filter((q) => q.category === category);
      const step = this.steps.get(`search:${category}`);
      const out = searchOutputs.get(category);
      if (planned.length === 0) {
        coverage.push({ category, status: "skipped", queries: 0, results: 0, note: category === "news" && !limits.includeNews ? "News search is turned off in settings." : "No searches planned." });
      } else if (out) {
        coverage.push({ category, status: "ok", queries: out.queries.length, results: out.queries.reduce((n, q) => n + q.results, 0), note: null });
      } else {
        const failure = this.failures.find((f) => f.step === `search:${category}`);
        coverage.push({ category, status: "failed", queries: planned.length, results: 0, note: failure?.message ?? step?.errorMessage ?? "Search failed." });
      }
    }

    const blocked = [
      ...((this.steps.get("discover:search")?.output as DiscoverySearchOutput | undefined)?.blocked ?? []),
      ...[...searchOutputs.values()].flatMap((o) => o?.blocked ?? []),
    ].filter((b, i, all) => all.findIndex((x) => x.url === b.url) === i);

    const draft = (await this.step("verify", "verify", false, async () => {
      const finalDocs = (await loadDocuments(this.db, this.job.id)).filter((d) => candidateKeys.has(d.sourceKey) || d.categories.some((c) => c !== "discovery"));
      const assembled = assembleSnapshot({
        identity: { displayName: subject.displayName, nativeName: subject.nativeName, nameVariants: subject.nameVariants },
        documents: finalDocs.map((d) => ({
          key: d.sourceKey,
          url: d.url,
          canonicalUrl: d.canonicalUrl,
          title: d.title,
          publisher: d.publisher,
          snippet: d.snippet,
          content: d.content,
          accessMethod: d.accessMethod,
          accessStatus: d.accessStatus,
          accessNote: d.accessNote,
          providerPublishedAt: d.providerPublishedAt,
          categories: d.categories,
          fixtureKey: d.fixtureKey,
          fetchedAt: d.fetchedAt.toISOString(),
        })),
        analysedKeys,
        notAnalysed,
        extractions,
        blocked,
        coverage,
        researchedAt: this.researchedAt.toISOString(),
        maxSourceChars: limits.maxSourceChars,
      });
      await this.emit({
        stage: "verify",
        code: "verify.completed",
        message: `Verified evidence: ${assembled.claims.length} facts, ${assembled.contacts.length} contact routes, ${assembled.accounts.length} accounts, ${assembled.stories.length} stories; ${assembled.rejected.length} extracted items rejected.`,
        data: { claims: assembled.claims.length, rejected: assembled.rejected.length },
      });
      return assembled as unknown as StepOutput;
    })) as unknown as DraftSnapshot;

    const overviewOut = (await this.step("synthesise", "synthesise", true, async () => {
      if (draft.claims.length === 0 && draft.stories.length === 0) return { overview: overviewWithoutNarrative(draft) };
      const input = buildSynthesisInput(draft, subject, this.researchedAt.toISOString());
      const key = cacheKey({
        op: "synthesise",
        model: this.providers!.reasoning.modelInfo.model,
        prompt: this.providers!.reasoning.modelInfo.promptVersion,
        claims: input.claims,
        media: input.media,
        world: this.job.workspace === "demo" ? this.worldVersion : null,
      });
      let output = await cacheGet<SynthesisOutput>(this.db, this.job.ownerId, this.job.workspace, key);
      if (output) {
        await this.recordUsage(this.reasoningName(), "synthesise", { requests: 1, credits: null }, true);
      } else {
        const result = await this.providers!.reasoning.synthesise(input, this.rc.signal);
        output = result.output;
        await this.recordUsage(this.reasoningName(), "synthesise", result.usage);
        await cachePut(this.db, { ownerId: this.job.ownerId, workspace: this.job.workspace, jobId: this.job.id, key, provider: this.reasoningName(), operation: "synthesise", response: output, ttlHours: this.rc.env.PROVIDER_CACHE_TTL_HOURS });
      }
      return { overview: validateSynthesis(output, draft) };
    })) as { overview: ReturnType<typeof validateSynthesis> } | null;
    const overview = overviewOut?.overview ?? overviewWithoutNarrative(draft);

    const status: "completed" | "partial" = this.failures.length > 0 || coverage.some((c) => c.status === "failed") ? "partial" : "completed";
    const identityResolution = this.job.identityResolution ?? (await this.loadResolution());
    // Persist: the snapshot, the step checkpoint and the job's terminal state commit together.
    const persistStarted = Date.now();
    await withFence(this.db, this.job.id, this.rc.token, async (tx) => {
      await markStepRunning(tx, { jobId: this.job.id, name: "persist", stage: "persist", seq: STEP_SEQ.persist, optional: false });
      await setJobStage(tx, this.job.id, "persist");
    });
    let persisted: { profileId: string; snapshotId: string; version: number };
    try {
      persisted = await persistSnapshot({
        db: this.db,
        job: this.job,
        token: this.rc.token,
        workspace: this.job.workspace,
        identity: {
          displayName: subject.displayName,
          nativeName: subject.nativeName,
          nameVariants: subject.nameVariants,
          organisation: subject.organisation,
          role: subject.role,
          anchorKey: candidate.anchorKey,
          anchorUrls: candidate.anchorUrls,
          resolution: identityResolution ?? { method: "user_selected", reason: "Selected by the owner.", decidedAt: new Date().toISOString() },
        },
        draft,
        overview,
        modelInfo: this.providers!.reasoning.modelInfo,
        usage: this.usage,
        status,
        researchedAt: this.researchedAt,
        fixturePersonKey: candidate.fixturePersonKey,
        retentionDays: this.rc.env.SOURCE_CONTENT_RETENTION_DAYS,
        stepStartedAt: persistStarted,
      });
    } catch (error) {
      if (error instanceof LeaseLostError) throw error;
      await withFence(this.db, this.job.id, this.rc.token, (tx) =>
        markStepFinished(tx, { jobId: this.job.id, name: "persist", status: "failed", errorCode: "persist_failed", errorMessage: "Saving the research snapshot failed." }),
      );
      await this.emit({ level: "error", stage: "persist", code: "step.failed.detail", visibility: "diagnostic", message: error instanceof Error ? (error.stack ?? error.message).slice(0, 4000) : String(error) });
      throw new StepFailedError("persist", "persist_failed", "Saving the research snapshot failed. Retry to try again.");
    }
    await this.emit({
      code: status === "completed" ? "job.completed" : "job.partial",
      message: status === "completed" ? "Research complete." : "Research finished with partial results: some sources or providers failed.",
      data: { snapshotId: persisted.snapshotId, profileId: persisted.profileId, version: persisted.version },
    });
    return status;
  }

  private async loadResolution() {
    const [row] = await this.db.select({ r: researchJobs.identityResolution }).from(researchJobs).where(eq(researchJobs.id, this.job.id));
    return row?.r ?? null;
  }
}

/* -------------------------------------------------------------------------- */

/**
 * Bounded search plan. Queries are distributed across categories within the
 * owner's search budget; every query includes the subject's name, and the
 * organisation where known, to avoid drifting onto namesakes.
 */
export function buildQueryPlan(
  subject: SubjectDescriptor,
  limits: { maxSearchQueries: number; maxResultsPerQuery: number; includeNews: boolean; newsWindowMonths: number },
  now: Date,
): PlannedQuery[] {
  const name = subject.displayName;
  const org = subject.organisation;
  const az = subject.nameVariants.find((v) => /[əğıöüşçİ]/i.test(v) && v !== name) ?? (subject.nativeName && /[ə]/.test(subject.nativeName) ? subject.nativeName : null);
  const ru = subject.nameVariants.find((v) => /\p{Script=Cyrillic}/u.test(v)) ?? (subject.nativeName && /\p{Script=Cyrillic}/u.test(subject.nativeName) ? subject.nativeName : null);
  const max = limits.maxResultsPerQuery;
  const quoted = (v: string) => `"${v}"`;
  const start = new Date(now);
  start.setUTCMonth(start.getUTCMonth() - limits.newsWindowMonths);
  const startDate = start.toISOString().slice(0, 10);

  const candidates: PlannedQuery[] = [
    { label: "Career and biography", category: "career", query: `${quoted(name)}${org ? ` ${quoted(org)}` : ""}`, language: "en", topic: "general", maxResults: max },
    { label: "Career (Azerbaijani spelling)", category: "career", query: az ? quoted(az) : "", language: "az", topic: "general", maxResults: max },
    { label: "Career (Russian spelling)", category: "career", query: ru ? quoted(ru) : "", language: "ru", topic: "general", maxResults: max },
    { label: "Published business contacts", category: "contacts", query: `${quoted(name)}${org ? ` ${quoted(org)}` : ""} contact`, language: "en", topic: "general", maxResults: max },
    { label: "Public professional profiles", category: "accounts", query: `${quoted(name)}${org ? ` ${org}` : ""}`, language: "en", topic: "general", maxResults: max, includeDomains: SOCIAL_SEARCH_DOMAINS },
    { label: "Documented collaborators", category: "connections", query: `${quoted(name)} co-founder OR board OR co-author OR partner`, language: "en", topic: "general", maxResults: max },
    ...(limits.includeNews
      ? ([
          { label: "News (English)", category: "news", query: `${quoted(name)}${org ? ` OR ${quoted(org)}` : ""}`, language: "en", topic: "news", maxResults: max, startDate },
          { label: "News (Azerbaijani)", category: "news", query: az ? quoted(az) : "", language: "az", topic: "news", maxResults: max, startDate },
          { label: "News (Russian)", category: "news", query: ru ? quoted(ru) : "", language: "ru", topic: "news", maxResults: max, startDate },
          { label: "Interviews and commentary", category: "news", query: `${quoted(name)} interview OR podcast OR panel`, language: "en", topic: "general", maxResults: max },
        ] satisfies PlannedQuery[])
      : []),
  ];
  const plan = candidates.filter((q) => q.query.trim().length > 0);

  // Respect the overall budget (discovery uses up to 3 queries). A floor above 1 would
  // overrun small budgets (e.g. 4 queries per run allowed 3 + 5).
  const budget = Math.max(1, limits.maxSearchQueries - 3);
  if (plan.length <= budget) return plan;
  const priority: ResearchCategory[] = ["career", "news", "contacts", "accounts", "connections"];
  const selected: PlannedQuery[] = [];
  const queues = new Map(priority.map((c) => [c, plan.filter((q) => q.category === c)]));
  while (selected.length < budget) {
    let progressed = false;
    for (const c of priority) {
      const next = queues.get(c)!.shift();
      if (next && selected.length < budget) {
        selected.push(next);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return plan.filter((q) => selected.includes(q));
}

export async function loadCandidatesForJob(db: Database, jobId: string, ownerId: string) {
  return db
    .select()
    .from(candidateIdentities)
    .where(and(eq(candidateIdentities.jobId, jobId), eq(candidateIdentities.ownerId, ownerId)))
    .orderBy(asc(candidateIdentities.rank));
}
