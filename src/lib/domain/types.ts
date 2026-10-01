/**
 * Shared domain vocabulary for PersonBrief.
 *
 * These enums are persisted (as text) and rendered in the UI, exports and
 * tests, so values must stay stable. Add new values; never repurpose old ones.
 */

export const WORKSPACES = ["live", "demo"] as const;
export type Workspace = (typeof WORKSPACES)[number];

export const USER_ROLES = ["owner", "demo"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LOCALES = ["en", "az", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const DEFAULT_TIMEZONE = "Asia/Baku";

export const JOB_STATUSES = [
  "queued",
  "running",
  "awaiting_identity",
  "completed",
  "partial",
  "failed",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = ["completed", "partial", "failed", "cancelled"];
export const ACTIVE_JOB_STATUSES: readonly JobStatus[] = ["queued", "running"];

export const JOB_KINDS = ["search", "refresh", "retry"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_PHASES = ["discovery", "research"] as const;
export type JobPhase = (typeof JOB_PHASES)[number];

export const STEP_STATUSES = ["pending", "running", "completed", "failed", "skipped"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

/** Pipeline stages in execution order (a stage may own several steps). */
export const STAGES = [
  "normalise",
  "discover",
  "resolve",
  "plan",
  "search",
  "retrieve",
  "extract",
  "verify",
  "synthesise",
  "persist",
] as const;
export type Stage = (typeof STAGES)[number];

export const RESEARCH_CATEGORIES = ["career", "contacts", "accounts", "connections", "news"] as const;
export type ResearchCategory = (typeof RESEARCH_CATEGORIES)[number];

export const SOURCE_TYPES = [
  "official_bio",
  "company_site",
  "personal_site",
  "news",
  "interview",
  "press_release",
  "registry",
  "academic",
  "conference",
  "social_profile",
  "video",
  "search_listing",
  "other",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/** How the content we reasoned over was obtained. */
export const ACCESS_METHODS = [
  "provider_extract",
  "search_result",
  "search_snippet",
  "authorised_api",
  "direct_fetch",
  "fixture",
] as const;
export type AccessMethod = (typeof ACCESS_METHODS)[number];

/** What we could actually read. */
export const ACCESS_STATUSES = [
  "read",
  "snippet_only",
  "login_required",
  "paywalled",
  "blocked",
  "failed",
  "not_attempted",
] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];

/** Source reliability is about the publisher, not about any single claim. */
export const SOURCE_RELIABILITY = [
  "official",
  "self_published",
  "established_media",
  "other_media",
  "aggregator",
  "social_platform",
  "unknown",
] as const;
export type SourceReliability = (typeof SOURCE_RELIABILITY)[number];

export const LANGUAGES = ["az", "en", "ru", "tr", "other", "unknown"] as const;
export type ContentLanguage = (typeof LANGUAGES)[number];

export const CLAIM_CATEGORIES = [
  "employment",
  "education",
  "affiliation",
  "location",
  "biography",
  "award",
  "publication",
] as const;
export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number];

/**
 * Evidence status describes the support behind a claim. It is deliberately
 * qualitative: no numeric confidence is ever shown.
 */
export const EVIDENCE_STATUSES = [
  "multiple_sources",
  "official_source",
  "self_reported",
  "single_source",
  "snippet_only",
  "conflicting",
  "inferred",
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

/** Identity match strength between a source/candidate and the subject. */
export const MATCH_STRENGTHS = ["strong", "moderate", "weak"] as const;
export type MatchStrength = (typeof MATCH_STRENGTHS)[number];

export const CURRENCY_STATES = ["stated_current", "ended", "unknown"] as const;
export type CurrencyState = (typeof CURRENCY_STATES)[number];

export const CONTACT_TYPES = [
  "work_email",
  "business_mobile",
  "office_line",
  "assistant",
  "switchboard",
  "press_office",
  "contact_page",
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

/** Who answers / owns the contact route. */
export const CONTACT_OWNERS = ["person", "assistant", "organisation"] as const;
export type ContactOwner = (typeof CONTACT_OWNERS)[number];

export const SOCIAL_PLATFORMS = [
  "linkedin",
  "facebook",
  "instagram",
  "x",
  "youtube",
  "github",
  "website",
  "other",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const ACCOUNT_STATUSES = ["accepted", "possible"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** How a social account link was found. */
export const ACCOUNT_DISCOVERY = [
  "linked_from_official_bio",
  "linked_from_personal_site",
  "linked_from_company_page",
  "accessible_page",
  "authorised_api",
  "search_result",
  "search_snippet",
] as const;
export type AccountDiscovery = (typeof ACCOUNT_DISCOVERY)[number];

export const RELATIONSHIP_KINDS = ["documented", "shared_affiliation"] as const;
export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number];

export const RELATIONSHIP_TYPES = [
  "co_founder",
  "fellow_director",
  "business_partner",
  "collaborator",
  "co_author",
  "shared_employer",
  "shared_board",
  "shared_institution",
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const DOCUMENTED_RELATIONSHIP_TYPES: readonly RelationshipType[] = [
  "co_founder",
  "fellow_director",
  "business_partner",
  "collaborator",
  "co_author",
];

export const MEDIA_KINDS = ["article", "interview", "video", "commentary", "press_release", "podcast"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** Direct coverage, organisation news, or a same-name match we could not resolve. */
export const COVERAGE_TYPES = ["direct", "organisation", "unresolved_same_name"] as const;
export type CoverageType = (typeof COVERAGE_TYPES)[number];

export const MEDIA_TOPICS = [
  "appointment",
  "funding",
  "business",
  "interview",
  "policy",
  "legal",
  "award",
  "event",
  "other",
] as const;
export type MediaTopic = (typeof MEDIA_TOPICS)[number];

export const SUMMARY_BASIS = ["full_text", "snippet_only"] as const;
export type SummaryBasis = (typeof SUMMARY_BASIS)[number];

export const IDENTITY_RESOLUTION_METHODS = [
  "user_selected",
  "auto_profile_url",
  "auto_unique_company_match",
  "refresh_existing_profile",
] as const;
export type IdentityResolutionMethod = (typeof IDENTITY_RESOLUTION_METHODS)[number];

export const ISSUE_CATEGORIES = ["incorrect", "outdated", "wrong_person", "privacy", "other"] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

/**
 * A date that may be known only to year or month precision. Never widen an
 * unknown date to "today"; unknown stays null.
 */
export type PartialDate = {
  year: number;
  month?: number | null;
  day?: number | null;
  /** True when the source itself is approximate ("around 2014", "early 2015"). */
  approximate?: boolean;
};

export type DatePrecision = "day" | "month" | "year";

export type Temporal = {
  start: PartialDate | null;
  end: PartialDate | null;
  /** What the source said about currency at the time it was published. */
  currency: CurrencyState;
  /** ISO date of the source publication or access that the currency statement is based on. */
  asOf: string | null;
  /** Set when a "current" statement comes from an old source. */
  possiblyOutdated: boolean;
};

export type ClaimValue =
  | { kind: "employment"; organisation: string; title: string | null; department?: string | null }
  | { kind: "education"; institution: string; qualification: string | null; field: string | null }
  | { kind: "affiliation"; organisation: string; role: string | null }
  | { kind: "location"; place: string; scope: "work" | "based" }
  | { kind: "biography"; statement: string }
  | { kind: "award"; name: string; issuer: string | null }
  | { kind: "publication"; title: string; venue: string | null };

export type SummarySentence = {
  text: string;
  claimIds: string[];
  mediaIds: string[];
  /** "sourced" sentences restate accepted claims; "inferred" commentary is labelled as such. */
  kind: "sourced" | "inferred";
};

export type KeyDevelopment = {
  text: string;
  mediaIds: string[];
  claimIds: string[];
  date: PartialDate | null;
};

export type InformationGap = {
  code: string;
  text: string;
};

export type MeetingQuestion = {
  question: string;
  claimIds: string[];
  mediaIds: string[];
};

export type SnapshotOverview = {
  summary: SummarySentence[];
  keyDevelopments: KeyDevelopment[];
  gaps: InformationGap[];
  questions: MeetingQuestion[];
  /** False when the model synthesis step failed or was skipped. */
  narrativeAvailable: boolean;
};

export type CoverageEntry = {
  category: ResearchCategory | "discovery";
  status: "ok" | "partial" | "failed" | "skipped";
  queries: number;
  results: number;
  note: string | null;
};

export type AccessLimitation = {
  domain: string;
  url: string | null;
  status: AccessStatus;
  note: string;
};

export type MatchReason = {
  code:
    | "name_exact"
    | "name_variant"
    | "company_match"
    | "country_match"
    | "profile_url_match"
    | "role_context"
    | "multiple_sources"
    | "single_source"
    | "company_mismatch"
    | "country_mismatch";
  text: string;
  sourceKeys: string[];
};

export type SourceRef = {
  key: string;
  url: string;
  title: string | null;
  publisher: string | null;
  fixtureKey?: string | null;
};

export type ModelInfo = {
  provider: "anthropic" | "fixture";
  model: string;
  promptVersion: string;
  effort: string | null;
};

export type AllegationStructure = {
  allegations: { text: string; attributedTo: string }[];
  responses: { text: string; attributedTo: string }[];
  outcomes: { text: string; documentedBy: string }[];
};
