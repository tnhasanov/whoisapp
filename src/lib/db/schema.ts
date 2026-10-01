import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  AccessLimitation,
  AccessMethod,
  AccessStatus,
  AccountDiscovery,
  AccountStatus,
  AllegationStructure,
  ClaimCategory,
  ClaimValue,
  ContactOwner,
  ContactType,
  ContentLanguage,
  CoverageEntry,
  CoverageType,
  DatePrecision,
  EvidenceStatus,
  IdentityResolutionMethod,
  IssueCategory,
  JobKind,
  JobPhase,
  JobStatus,
  Locale,
  MatchReason,
  MatchStrength,
  MediaKind,
  MediaTopic,
  ModelInfo,
  PartialDate,
  RelationshipKind,
  RelationshipType,
  SnapshotOverview,
  SocialPlatform,
  SourceRef,
  SourceReliability,
  SourceType,
  StepStatus,
  SummaryBasis,
  Temporal,
  UserRole,
  Workspace,
} from "@/lib/domain/types";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* -------------------------------------------------------------------------- */
/* Authentication (Better Auth models; property names follow its field names) */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "auth_users",
  {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** "owner" may run live research; "demo" is confined to fictional data. */
  role: text("role").$type<UserRole>().notNull().default("demo"),
  isAnonymous: boolean("is_anonymous").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Single-owner product: the database itself refuses a second owner.
  (t) => [uniqueIndex("auth_users_single_owner_idx").on(t.role).where(sql`${t.role} = 'owner'`)],
);

export const sessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "auth_accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_accounts_user_idx").on(t.userId)],
);

export const verifications = pgTable(
  "auth_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_verifications_identifier_idx").on(t.identifier)],
);

/** Better Auth rate-limit storage (shared across instances). */
export const authRateLimits = pgTable("auth_rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/* -------------------------------------------------------------------------- */
/* Owner settings                                                             */
/* -------------------------------------------------------------------------- */

export type ResearchLimits = {
  maxSearchQueries?: number;
  maxResultsPerQuery?: number;
  maxExtractPages?: number;
  maxModelCalls?: number;
  includeNews?: boolean;
  newsWindowMonths?: number;
};

export const ownerSettings = pgTable("owner_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  locale: text("locale").$type<Locale>().notNull().default("en"),
  timezone: text("timezone").notNull().default("Asia/Baku"),
  theme: text("theme").$type<"system" | "light" | "dark">().notNull().default("system"),
  activeWorkspace: text("active_workspace").$type<Workspace>().notNull().default("live"),
  researchLimits: jsonb("research_limits").$type<ResearchLimits>().notNull().default({}),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/* Research jobs (durable, lease-based execution)                            */
/* -------------------------------------------------------------------------- */

export type ResearchQuery = {
  fullName: string;
  company: string | null;
  country: string | null;
  profileUrl: string | null;
};

export type JobConfig = {
  limits: Required<Omit<ResearchLimits, "includeNews" | "newsWindowMonths">> & {
    includeNews: boolean;
    newsWindowMonths: number;
    maxOutputTokens: number;
    maxSourceChars: number;
    providerTimeoutMs: number;
    providerMaxRetries: number;
  };
  model: ModelInfo;
  searchProvider: "tavily" | "fixture";
  /** False when the owner reopened identity choice: never auto-select again. */
  autoSelect?: boolean;
  /** Refresh runs fetch fresh search results instead of cached ones. */
  bypassSearchCache?: boolean;
};

export type IdentityResolution = {
  method: IdentityResolutionMethod;
  reason: string;
  decidedAt: string;
};

export type JobUsageSummary = {
  searchRequests: number;
  extractRequests: number;
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  credits: number;
  estimatedCostUsd: number;
};

export const researchJobs = pgTable(
  "research_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspace: text("workspace").$type<Workspace>().notNull(),
    kind: text("kind").$type<JobKind>().notNull().default("search"),
    parentJobId: uuid("parent_job_id").references((): AnyPgColumn => researchJobs.id, { onDelete: "set null" }),
    profileId: uuid("profile_id").references((): AnyPgColumn => profiles.id, { onDelete: "set null" }),
    snapshotId: uuid("snapshot_id").references((): AnyPgColumn => snapshots.id, { onDelete: "set null" }),
    status: text("status").$type<JobStatus>().notNull().default("queued"),
    /** Result of a finished job: a profile, nobody found, or the owner chose to refine the search. */
    outcome: text("outcome").$type<"profile" | "no_candidates" | "refined">(),
    phase: text("phase").$type<JobPhase>().notNull().default("discovery"),
    currentStage: text("current_stage"),
    query: jsonb("query").$type<ResearchQuery>().notNull(),
    queryKey: text("query_key").notNull(),
    selectedCandidateId: uuid("selected_candidate_id").references((): AnyPgColumn => candidateIdentities.id, {
      onDelete: "set null",
    }),
    identityResolution: jsonb("identity_resolution").$type<IdentityResolution>(),
    idempotencyKey: text("idempotency_key").notNull(),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    leaseOwner: text("lease_owner"),
    /** Fencing token: incremented on every claim; writes must present the current value. */
    leaseToken: integer("lease_token").notNull().default(0),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    cancelRequestedAt: timestamp("cancel_requested_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    config: jsonb("config").$type<JobConfig>().notNull(),
    usage: jsonb("usage").$type<JobUsageSummary>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    lastProgressAt: timestamp("last_progress_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("research_jobs_owner_idem_idx").on(t.ownerId, t.idempotencyKey),
    index("research_jobs_claim_idx").on(t.status, t.createdAt),
    index("research_jobs_owner_idx").on(t.ownerId, t.workspace, t.createdAt),
    index("research_jobs_profile_idx").on(t.profileId),
  ],
);

export type StepOutput = Record<string, unknown>;

export const jobSteps = pgTable(
  "job_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => researchJobs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    stage: text("stage").notNull(),
    seq: integer("seq").notNull(),
    status: text("status").$type<StepStatus>().notNull().default("pending"),
    optional: boolean("optional").notNull().default(false),
    attempt: integer("attempt").notNull().default(0),
    output: jsonb("output").$type<StepOutput>(),
    /** True when the output was copied from a parent job's completed step. */
    reused: boolean("reused").notNull().default(false),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
  },
  (t) => [uniqueIndex("job_steps_job_name_idx").on(t.jobId, t.name)],
);

export const jobEvents = pgTable(
  "job_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => researchJobs.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    level: text("level").$type<"info" | "warn" | "error" | "debug">().notNull().default("info"),
    stage: text("stage"),
    code: text("code").notNull(),
    message: text("message").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    /** "diagnostic" events hold technical detail and are only shown in the protected diagnostics view. */
    visibility: text("visibility").$type<"user" | "diagnostic">().notNull().default("user"),
  },
  (t) => [index("job_events_job_idx").on(t.jobId, t.id)],
);

/** Retrieved page content, kept only for the retention window (needed for retries and excerpt checks). */
export const jobDocuments = pgTable(
  "job_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => researchJobs.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceKey: text("source_key").notNull(),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    title: text("title"),
    publisher: text("publisher"),
    snippet: text("snippet"),
    content: text("content"),
    contentHash: text("content_hash"),
    providerPublishedAt: text("provider_published_at"),
    accessMethod: text("access_method").$type<AccessMethod>().notNull(),
    accessStatus: text("access_status").$type<AccessStatus>().notNull(),
    accessNote: text("access_note"),
    categories: jsonb("categories").$type<string[]>().notNull().default([]),
    fixtureKey: text("fixture_key"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("job_documents_job_url_idx").on(t.jobId, t.canonicalUrl),
    uniqueIndex("job_documents_job_key_idx").on(t.jobId, t.sourceKey),
    index("job_documents_expiry_idx").on(t.expiresAt),
  ],
);

export const candidateIdentities = pgTable(
  "candidate_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => researchJobs.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    displayName: text("display_name").notNull(),
    nativeName: text("native_name"),
    organisation: text("organisation"),
    role: text("role"),
    location: text("location"),
    summary: text("summary"),
    matchStrength: text("match_strength").$type<MatchStrength>().notNull(),
    matchReasons: jsonb("match_reasons").$type<MatchReason[]>().notNull().default([]),
    distinguishingFacts: jsonb("distinguishing_facts").$type<string[]>().notNull().default([]),
    sourceRefs: jsonb("source_refs").$type<SourceRef[]>().notNull().default([]),
    anchorKey: text("anchor_key").notNull(),
    anchorUrls: jsonb("anchor_urls").$type<string[]>().notNull().default([]),
    nameVariants: jsonb("name_variants").$type<string[]>().notNull().default([]),
    autoSelected: boolean("auto_selected").notNull().default(false),
    fixturePersonKey: text("fixture_person_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("candidate_identities_job_idx").on(t.jobId, t.rank)],
);

/* -------------------------------------------------------------------------- */
/* Profiles and versioned snapshots                                           */
/* -------------------------------------------------------------------------- */

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspace: text("workspace").$type<Workspace>().notNull(),
    displayName: text("display_name").notNull(),
    nativeName: text("native_name"),
    nameVariants: jsonb("name_variants").$type<string[]>().notNull().default([]),
    headlineRole: text("headline_role"),
    headlineOrganisation: text("headline_organisation"),
    headlineLocation: text("headline_location"),
    anchorKey: text("anchor_key").notNull(),
    anchorUrls: jsonb("anchor_urls").$type<string[]>().notNull().default([]),
    latestSnapshotId: uuid("latest_snapshot_id").references((): AnyPgColumn => snapshots.id, {
      onDelete: "set null",
    }),
    snapshotCount: integer("snapshot_count").notNull().default(0),
    savedAt: timestamp("saved_at", { withTimezone: true }),
    lastResearchedAt: timestamp("last_researched_at", { withTimezone: true }),
    fixturePersonKey: text("fixture_person_key"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("profiles_owner_anchor_idx").on(t.ownerId, t.workspace, t.anchorKey),
    index("profiles_owner_updated_idx").on(t.ownerId, t.workspace, t.updatedAt),
  ],
);

export type SnapshotHeadline = {
  role: string | null;
  roleClaimId: string | null;
  organisation: string | null;
  organisationClaimId: string | null;
  location: string | null;
  locationClaimId: string | null;
};

export type SnapshotIdentity = {
  displayName: string;
  nativeName: string | null;
  nameVariants: string[];
  organisation: string | null;
  role: string | null;
  anchorKey: string;
  anchorUrls: string[];
  resolution: IdentityResolution;
};

export type SnapshotCounts = {
  sources: number;
  claims: number;
  media: number;
  stories: number;
  contacts: number;
  accounts: number;
  relationships: number;
};

export type SnapshotDiagnostics = {
  rejected: { kind: string; reason: string; sourceKey: string | null; preview: string }[];
  stats: Record<string, number>;
};

export type SnapshotUsage = {
  searchRequests: number;
  extractRequests: number;
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  credits: number;
  estimatedCostUsd: number;
};

export const snapshots = pgTable(
  "snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspace: text("workspace").$type<Workspace>().notNull(),
    jobId: uuid("job_id").references((): AnyPgColumn => researchJobs.id, { onDelete: "set null" }),
    version: integer("version").notNull(),
    status: text("status").$type<"complete" | "partial">().notNull(),
    researchedAt: timestamp("researched_at", { withTimezone: true }).notNull(),
    identity: jsonb("identity").$type<SnapshotIdentity>().notNull(),
    headline: jsonb("headline").$type<SnapshotHeadline>().notNull(),
    overview: jsonb("overview").$type<SnapshotOverview>().notNull(),
    coverage: jsonb("coverage").$type<CoverageEntry[]>().notNull().default([]),
    accessLimitations: jsonb("access_limitations").$type<AccessLimitation[]>().notNull().default([]),
    modelInfo: jsonb("model_info").$type<ModelInfo>().notNull(),
    usage: jsonb("usage").$type<SnapshotUsage>(),
    counts: jsonb("counts").$type<SnapshotCounts>().notNull(),
    /** Extracted items that failed verification (reason + short preview), for the owner's diagnostics view only. */
    diagnostics: jsonb("diagnostics").$type<SnapshotDiagnostics>().notNull().default({ rejected: [], stats: {} }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("snapshots_profile_version_idx").on(t.profileId, t.version),
    uniqueIndex("snapshots_job_idx").on(t.jobId),
    index("snapshots_owner_idx").on(t.ownerId),
  ],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceKey: text("source_key").notNull(),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    title: text("title"),
    publisher: text("publisher"),
    sourceType: text("source_type").$type<SourceType>().notNull(),
    reliability: text("reliability").$type<SourceReliability>().notNull(),
    language: text("language").$type<ContentLanguage>().notNull().default("unknown"),
    publishedAt: text("published_at"),
    publishedPrecision: text("published_precision").$type<DatePrecision>(),
    sourceUpdatedAt: text("source_updated_at"),
    /** Date reported by the search provider (may be an index date); never shown as the publication date. */
    providerReportedDate: text("provider_reported_date"),
    accessedAt: timestamp("accessed_at", { withTimezone: true }).notNull(),
    accessMethod: text("access_method").$type<AccessMethod>().notNull(),
    accessStatus: text("access_status").$type<AccessStatus>().notNull(),
    accessNote: text("access_note"),
    aboutSubject: text("about_subject").$type<"yes" | "no" | "unclear">().notNull().default("unclear"),
    identityEvidence: text("identity_evidence"),
    /** Short preview only; full page text is not retained in snapshots. */
    excerpt: text("excerpt"),
    fixtureKey: text("fixture_key"),
  },
  (t) => [
    uniqueIndex("sources_snapshot_url_idx").on(t.snapshotId, t.canonicalUrl),
    index("sources_snapshot_idx").on(t.snapshotId),
  ],
);

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Stable semantic key used to compare snapshots ("What changed?"). */
    claimKey: text("claim_key").notNull(),
    category: text("category").$type<ClaimCategory>().notNull(),
    value: jsonb("value").$type<ClaimValue>().notNull(),
    displayValue: text("display_value").notNull(),
    evidenceStatus: text("evidence_status").$type<EvidenceStatus>().notNull(),
    temporal: jsonb("temporal").$type<Temporal>().notNull(),
    uncertaintyNote: text("uncertainty_note"),
    conflictGroup: text("conflict_group"),
    language: text("language").$type<ContentLanguage>().notNull().default("unknown"),
    /** Present when displayValue is our translation of non-English source wording. */
    originalText: text("original_text"),
    isTranslated: boolean("is_translated").notNull().default(false),
    accepted: boolean("accepted").notNull().default(true),
    rejectionReason: text("rejection_reason"),
    sortKey: text("sort_key"),
  },
  (t) => [
    index("claims_snapshot_idx").on(t.snapshotId, t.category),
    index("claims_conflict_idx").on(t.snapshotId, t.conflictGroup),
  ],
);

export const claimSources = pgTable(
  "claim_sources",
  {
    claimId: uuid("claim_id")
      .notNull()
      .references(() => claims.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    supportingExcerpt: text("supporting_excerpt").notNull(),
    excerptLanguage: text("excerpt_language").$type<ContentLanguage>().notNull().default("unknown"),
    /** True when the excerpt was found verbatim (after whitespace/quote normalisation) in the retrieved text. */
    excerptVerified: boolean("excerpt_verified").notNull(),
    stance: text("stance").$type<"supports" | "contradicts">().notNull().default("supports"),
  },
  (t) => [primaryKey({ columns: [t.claimId, t.sourceId] })],
);

export const organisations = pgTable(
  "organisations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalisedName: text("normalised_name").notNull(),
    kind: text("kind").$type<"company" | "institution" | "board" | "project" | "other">().notNull(),
  },
  (t) => [uniqueIndex("organisations_snapshot_name_idx").on(t.snapshotId, t.normalisedName)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contactType: text("contact_type").$type<ContactType>().notNull(),
    value: text("value").notNull(),
    normalisedValue: text("normalised_value"),
    belongsTo: text("belongs_to").$type<ContactOwner>().notNull(),
    ownerLabel: text("owner_label").notNull(),
    purpose: text("purpose"),
    publicationContext: text("publication_context").notNull(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    supportingExcerpt: text("supporting_excerpt").notNull(),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull(),
    /** Only true for routes that reach the person themselves (never a reception or switchboard). */
    isDirect: boolean("is_direct").notNull().default(false),
    contactKey: text("contact_key").notNull(),
  },
  (t) => [index("contacts_snapshot_idx").on(t.snapshotId)],
);

export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform").$type<SocialPlatform>().notNull(),
    handle: text("handle"),
    url: text("url").notNull(),
    description: text("description"),
    status: text("status").$type<AccountStatus>().notNull(),
    discovery: text("discovery").$type<AccountDiscovery>().notNull(),
    matchEvidence: jsonb("match_evidence").$type<{ text: string; sourceId: string | null }[]>().notNull().default([]),
    accessNote: text("access_note"),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    accountKey: text("account_key").notNull(),
  },
  (t) => [index("social_accounts_snapshot_idx").on(t.snapshotId)],
);

export const relationships = pgTable(
  "relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<RelationshipKind>().notNull(),
    relationType: text("relation_type").$type<RelationshipType>().notNull(),
    label: text("label").notNull(),
    counterpartName: text("counterpart_name").notNull(),
    counterpartRole: text("counterpart_role"),
    organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "set null" }),
    organisationName: text("organisation_name"),
    project: text("project"),
    start: jsonb("start").$type<PartialDate | null>(),
    end: jsonb("end").$type<PartialDate | null>(),
    note: text("note"),
    relationshipKey: text("relationship_key").notNull(),
  },
  (t) => [index("relationships_snapshot_idx").on(t.snapshotId)],
);

export const relationshipSources = pgTable(
  "relationship_sources",
  {
    relationshipId: uuid("relationship_id")
      .notNull()
      .references(() => relationships.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    supportingExcerpt: text("supporting_excerpt").notNull(),
    excerptVerified: boolean("excerpt_verified").notNull(),
  },
  (t) => [primaryKey({ columns: [t.relationshipId, t.sourceId] })],
);

export const mediaStoryGroups = pgTable(
  "media_story_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storyKey: text("story_key").notNull(),
    headline: text("headline").notNull(),
    coverageType: text("coverage_type").$type<CoverageType>().notNull(),
    topic: text("topic").$type<MediaTopic>().notNull(),
    firstPublishedAt: text("first_published_at"),
    itemCount: integer("item_count").notNull(),
    relevanceRank: integer("relevance_rank").notNull(),
  },
  (t) => [uniqueIndex("media_story_groups_snapshot_key_idx").on(t.snapshotId, t.storyKey)],
);

export const mediaItems = pgTable(
  "media_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storyGroupId: uuid("story_group_id")
      .notNull()
      .references(() => mediaStoryGroups.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    headline: text("headline").notNull(),
    outlet: text("outlet").notNull(),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    kind: text("kind").$type<MediaKind>().notNull(),
    publishedAt: text("published_at"),
    publishedPrecision: text("published_precision").$type<DatePrecision>(),
    sourceUpdatedAt: text("source_updated_at"),
    providerReportedDate: text("provider_reported_date"),
    eventDate: jsonb("event_date").$type<PartialDate | null>(),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull(),
    language: text("language").$type<ContentLanguage>().notNull(),
    summary: text("summary").notNull(),
    summaryBasis: text("summary_basis").$type<SummaryBasis>().notNull(),
    involvement: text("involvement"),
    coverageType: text("coverage_type").$type<CoverageType>().notNull(),
    topic: text("topic").$type<MediaTopic>().notNull(),
    matchEvidence: text("match_evidence"),
    allegations: jsonb("allegations").$type<AllegationStructure | null>(),
    relevanceRank: integer("relevance_rank").notNull(),
    mediaKey: text("media_key").notNull(),
  },
  (t) => [
    index("media_items_snapshot_idx").on(t.snapshotId),
    index("media_items_group_idx").on(t.storyGroupId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Private owner data (kept separate from researched facts)                   */
/* -------------------------------------------------------------------------- */

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    ...timestamps,
  },
  (t) => [index("notes_profile_idx").on(t.profileId, t.createdAt)],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspace: text("workspace").$type<Workspace>().notNull(),
    name: text("name").notNull(),
    normalisedName: text("normalised_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tags_owner_name_idx").on(t.ownerId, t.workspace, t.normalisedName)],
);

export const profileTags = pgTable(
  "profile_tags",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.tagId] })],
);

export const exportLog = pgTable(
  "export_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    format: text("format").$type<"pdf" | "json">().notNull(),
    includeNotes: boolean("include_notes").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("export_log_profile_idx").on(t.profileId)],
);

export const issueReports = pgTable(
  "issue_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    snapshotId: uuid("snapshot_id").references(() => snapshots.id, { onDelete: "set null" }),
    claimId: uuid("claim_id").references(() => claims.id, { onDelete: "set null" }),
    category: text("category").$type<IssueCategory>().notNull(),
    message: text("message").notNull(),
    status: text("status").$type<"open" | "resolved">().notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("issue_reports_profile_idx").on(t.profileId)],
);

/* -------------------------------------------------------------------------- */
/* Provider usage, caches, rate limits, worker liveness                       */
/* -------------------------------------------------------------------------- */

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => researchJobs.id, { onDelete: "set null" }),
    workspace: text("workspace").$type<Workspace>().notNull(),
    provider: text("provider").$type<"tavily" | "anthropic" | "fixture">().notNull(),
    operation: text("operation").notNull(),
    model: text("model"),
    requests: integer("requests").notNull().default(1),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    credits: numeric("credits", { precision: 12, scale: 3 }).notNull().default("0"),
    /** Always an estimate computed from published list prices; labelled as such in the UI. */
    estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 5 }).notNull().default("0"),
    cached: boolean("cached").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("usage_records_owner_idx").on(t.ownerId, t.createdAt)],
);

/**
 * Owner-scoped provider response cache. The key hashes the provider,
 * operation, normalised request, identity anchor and prompt/model version.
 */
export const providerCache = pgTable(
  "provider_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspace: text("workspace").$type<Workspace>().notNull(),
    jobId: uuid("job_id").references(() => researchJobs.id, { onDelete: "cascade" }),
    cacheKey: text("cache_key").notNull(),
    provider: text("provider").notNull(),
    operation: text("operation").notNull(),
    response: jsonb("response").$type<unknown>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("provider_cache_owner_key_idx").on(t.ownerId, t.workspace, t.cacheKey),
    index("provider_cache_expiry_idx").on(t.expiresAt),
  ],
);

export const appRateLimits = pgTable("app_rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

export const workerHeartbeats = pgTable("worker_heartbeats", {
  workerId: text("worker_id").primaryKey(),
  hostname: text("hostname"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  activeJobs: integer("active_jobs").notNull().default(0),
  version: text("version"),
});
