import { z } from "zod";
import {
  ACCESS_STATUSES,
  IDENTITY_RESOLUTION_METHODS,
  JOB_KINDS,
  JOB_STATUSES,
  MATCH_STRENGTHS,
  STAGES,
  WORKSPACES,
} from "../../domain";
import { SearchInputSchema } from "../../research/search-input";
import { entityId, isoDateTime, openEnum, pageOf, uuid } from "./common";

/* ------------------------------- Requests -------------------------------- */

/** POST /api/v1/research (requires Idempotency-Key). */
export const StartResearchRequestSchema = SearchInputSchema;

/** POST /api/v1/research/:jobId/select */
export const SelectCandidateRequestSchema = z.object({ candidateId: uuid });

/* ------------------------------- Responses ------------------------------- */

export const ResearchQuerySchema = z.object({
  fullName: z.string(),
  company: z.string().nullable(),
  country: z.string().nullable(),
  profileUrl: z.string().nullable(),
});

export const JOB_OUTCOMES = ["profile", "no_candidates", "refined"] as const;
export const STAGE_STATES = ["pending", "running", "completed", "failed", "skipped", "partial"] as const;

/** One row in Activity. */
export const JobSummarySchema = z.object({
  id: uuid,
  workspace: z.enum(WORKSPACES),
  kind: openEnum(JOB_KINDS),
  status: z.enum(JOB_STATUSES),
  outcome: openEnum(JOB_OUTCOMES).nullable(),
  query: ResearchQuerySchema,
  profileId: uuid.nullable(),
  createdAt: isoDateTime,
  finishedAt: isoDateTime.nullable(),
});
export type JobSummary = z.infer<typeof JobSummarySchema>;

export const JobListResponseSchema = pageOf(JobSummarySchema);

export const CandidateSourceSchema = z.object({
  key: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  publisher: z.string().nullable(),
  /** Fictional demo source: open it in the app's fixture viewer, never as a website. */
  fixtureKey: z.string().nullable(),
});

export const CandidateSchema = z.object({
  id: uuid,
  rank: z.number().int(),
  displayName: z.string(),
  nativeName: z.string().nullable(),
  organisation: z.string().nullable(),
  role: z.string().nullable(),
  location: z.string().nullable(),
  summary: z.string().nullable(),
  matchStrength: z.enum(MATCH_STRENGTHS),
  matchReasons: z.array(z.object({ code: z.string(), text: z.string(), sourceKeys: z.array(z.string()) })),
  distinguishingFacts: z.array(z.string()),
  sources: z.array(CandidateSourceSchema),
  autoSelected: z.boolean(),
});
export type Candidate = z.infer<typeof CandidateSchema>;

export const JobEventSchema = z.object({
  id: z.number().int(),
  at: isoDateTime,
  level: openEnum(["info", "warn", "error"] as const),
  stage: z.string().nullable(),
  /** Dotted code ("search.completed"); apps translate it with JobEvents.<code with "_"> and fall back to `message`. */
  code: z.string(),
  message: z.string(),
  data: z.record(z.string(), z.unknown()).nullable(),
});
export type JobEvent = z.infer<typeof JobEventSchema>;

export const IdentityResolutionSchema = z.object({
  method: openEnum(IDENTITY_RESOLUTION_METHODS),
  reason: z.string(),
  params: z.object({ company: z.string().optional(), domains: z.number().optional() }).optional(),
  decidedAt: z.string(),
});

export const UsageSchema = z.object({
  searchRequests: z.number(),
  extractRequests: z.number(),
  modelCalls: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  credits: z.number(),
  /** An estimate from published list prices, never an invoice amount. */
  estimatedCostUsd: z.number(),
});

/** Full persisted state of one research run (poll while `pollAfterMs` is not null). */
export const JobDetailSchema = JobSummarySchema.extend({
  phase: z.string(),
  currentStage: openEnum(STAGES).nullable(),
  snapshotId: uuid.nullable(),
  parentJobId: uuid.nullable(),
  /** Set when this run was retried or its identity choice reopened: follow it. */
  retriedById: uuid.nullable(),
  identityResolution: IdentityResolutionSchema.nullable(),
  selectedCandidateId: uuid.nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
  cancelRequested: z.boolean(),
  startedAt: isoDateTime.nullable(),
  lastProgressAt: isoDateTime.nullable(),
  stages: z.array(z.object({ stage: openEnum(STAGES), status: openEnum(STAGE_STATES) })),
  events: z.array(JobEventSchema),
  sources: z.object({ total: z.number().int(), read: z.number().int(), limited: z.number().int() }),
  candidates: z.array(CandidateSchema),
  usage: UsageSchema.nullable(),
  worker: z.object({
    online: z.boolean(),
    /** Seconds since the worker last reported progress on this run (running runs only). */
    heartbeatAgeSeconds: z.number().int().nullable(),
    /** Seconds this run has been waiting for a worker (queued runs only). */
    queuedSeconds: z.number().int().nullable(),
  }),
  /** Server's suggested polling interval; null once the run is finished or waiting for the owner. */
  pollAfterMs: z.number().int().nullable(),
});
export type JobDetail = z.infer<typeof JobDetailSchema>;

export const StartResearchResponseSchema = z.object({
  job: JobDetailSchema,
  /** False when the Idempotency-Key matched an earlier request (no new research was started). */
  created: z.boolean(),
});

export const JobReferenceResponseSchema = z.object({ jobId: uuid });

/** POST /api/v1/research/:jobId/refine — the original query, for pre-filling the search form. */
export const RefineResponseSchema = z.object({ query: ResearchQuerySchema });

export const RecentSearchSchema = z.object({
  jobId: uuid,
  fullName: z.string(),
  company: z.string().nullable(),
  status: z.enum(JOB_STATUSES),
  createdAt: isoDateTime,
  profileId: uuid.nullable(),
});
export const RecentSearchesResponseSchema = z.object({ items: z.array(RecentSearchSchema) });

/** Fictional example searches for the demo workspace. */
export const ExampleSchema = z.object({
  key: z.string(),
  label: z.string(),
  scenario: z.string(),
  fullName: z.string(),
  company: z.string().nullable(),
  country: z.string().nullable(),
  profileUrl: z.string().nullable(),
});
export const ExamplesResponseSchema = z.object({ items: z.array(ExampleSchema) });

/** A fictional demo source page, shown in the app because demo URLs are not real websites. */
export const DemoSourceSchema = z.object({
  key: z.string(),
  url: z.string(),
  title: z.string(),
  publisher: z.string(),
  language: z.string(),
  sourceType: z.string(),
  publishedDate: z.string().nullable(),
  /** True when the date is the date of the research run (a story "published since" the last run). */
  publishedOnRunDate: z.boolean(),
  access: openEnum(ACCESS_STATUSES),
  body: z.string().nullable(),
  snippet: z.string(),
});
export type DemoSource = z.infer<typeof DemoSourceSchema>;

export const jobIdParam = uuid;
export const candidateIdParam = uuid;
export const anyId = entityId;
