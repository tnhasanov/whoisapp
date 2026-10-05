import { z } from "zod";
import {
  ACCESS_METHODS,
  ACCESS_STATUSES,
  ACCOUNT_DISCOVERY,
  ACCOUNT_STATUSES,
  CLAIM_CATEGORIES,
  CONTACT_OWNERS,
  CONTACT_TYPES,
  COVERAGE_TYPES,
  CURRENCY_STATES,
  EVIDENCE_STATUSES,
  ISSUE_CATEGORIES,
  LANGUAGES,
  MEDIA_KINDS,
  MEDIA_TOPICS,
  RELATIONSHIP_KINDS,
  RELATIONSHIP_TYPES,
  SOCIAL_PLATFORMS,
  SOURCE_RELIABILITY,
  SOURCE_TYPES,
  SUMMARY_BASIS,
  WORKSPACES,
} from "../../domain";
import { isoDateTime, openEnum, pageOf, PartialDateSchema, uuid } from "./common";
import { IdentityResolutionSchema } from "./research";

/* --------------------------------- Shared -------------------------------- */

export const TagSchema = z.object({ id: uuid, name: z.string() });
export type Tag = z.infer<typeof TagSchema>;

export const NoteSchema = z.object({ id: uuid, body: z.string(), createdAt: isoDateTime, updatedAt: isoDateTime });
export type Note = z.infer<typeof NoteSchema>;

export const HeadlineSchema = z.object({
  role: z.string().nullable(),
  organisation: z.string().nullable(),
  location: z.string().nullable(),
});

/* --------------------------------- Library ------------------------------- */

export const PROFILE_SORTS = ["recent", "name", "researched"] as const;
export const PROFILE_SCOPES = ["saved", "all"] as const;

export const ProfileListQuerySchema = z.object({
  scope: z.enum(PROFILE_SCOPES).default("saved"),
  q: z.string().trim().max(120).optional(),
  sort: z.enum(PROFILE_SORTS).default("recent"),
  tagId: uuid.optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type ProfileListQuery = z.input<typeof ProfileListQuerySchema>;

export const ProfileListItemSchema = z.object({
  id: uuid,
  workspace: z.enum(WORKSPACES),
  displayName: z.string(),
  nativeName: z.string().nullable(),
  headline: HeadlineSchema,
  savedAt: isoDateTime.nullable(),
  lastResearchedAt: isoDateTime.nullable(),
  snapshotCount: z.number().int(),
  latestStatus: openEnum(["complete", "partial"] as const).nullable(),
  sourceCount: z.number().int().nullable(),
  tags: z.array(TagSchema),
});
export type ProfileListItem = z.infer<typeof ProfileListItemSchema>;
export const ProfileListResponseSchema = pageOf(ProfileListItemSchema);

export const TagListResponseSchema = z.object({ items: z.array(TagSchema) });

/* ------------------------------ Profile detail --------------------------- */

export const TemporalSchema = z.object({
  start: PartialDateSchema.nullable(),
  end: PartialDateSchema.nullable(),
  currency: openEnum(CURRENCY_STATES),
  asOf: z.string().nullable(),
  asOfBasis: openEnum(["published", "accessed"] as const).optional(),
  possiblyOutdated: z.boolean(),
});

export const ClaimValueSchema = z.union([
  z.object({ kind: z.literal("employment"), organisation: z.string(), title: z.string().nullable(), department: z.string().nullable().optional() }),
  z.object({ kind: z.literal("education"), institution: z.string(), qualification: z.string().nullable(), field: z.string().nullable() }),
  z.object({ kind: z.literal("affiliation"), organisation: z.string(), role: z.string().nullable() }),
  z.object({ kind: z.literal("location"), place: z.string(), scope: openEnum(["work", "based"] as const) }),
  z.object({ kind: z.literal("biography"), statement: z.string() }),
  z.object({ kind: z.literal("award"), name: z.string(), issuer: z.string().nullable() }),
  z.object({ kind: z.literal("publication"), title: z.string(), venue: z.string().nullable() }),
  // Forward compatibility: a kind added later still parses; apps fall back to displayValue.
  z.object({ kind: z.string() }).loose(),
]);

export const ClaimEvidenceSchema = z.object({
  sourceId: uuid,
  excerpt: z.string(),
  excerptLanguage: openEnum(LANGUAGES),
  /** The excerpt was found verbatim in the retrieved page text. */
  verified: z.boolean(),
  stance: openEnum(["supports", "contradicts"] as const),
});

export const ClaimSchema = z.object({
  id: uuid,
  category: openEnum(CLAIM_CATEGORIES),
  value: ClaimValueSchema,
  displayValue: z.string(),
  evidenceStatus: openEnum(EVIDENCE_STATUSES),
  temporal: TemporalSchema,
  uncertaintyNote: z.string().nullable(),
  /** Claims sharing a conflict group contradict each other; show them together. */
  conflictGroup: z.string().nullable(),
  language: openEnum(LANGUAGES),
  originalText: z.string().nullable(),
  isTranslated: z.boolean(),
  evidence: z.array(ClaimEvidenceSchema),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const ContactSchema = z.object({
  id: uuid,
  contactType: openEnum(CONTACT_TYPES),
  value: z.string(),
  /** E.164 for phone numbers, lower-case for emails; use it for tel:/mailto: links. */
  normalisedValue: z.string().nullable(),
  belongsTo: openEnum(CONTACT_OWNERS),
  /** Whose route this is ("Office of the CEO", "Company switchboard"). */
  ownerLabel: z.string(),
  purpose: z.string().nullable(),
  publicationContext: z.string(),
  sourceId: uuid,
  supportingExcerpt: z.string(),
  lastCheckedAt: isoDateTime,
  /** Only true when the route reaches the person themselves (never a switchboard). */
  isDirect: z.boolean(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const AccountSchema = z.object({
  id: uuid,
  platform: openEnum(SOCIAL_PLATFORMS),
  handle: z.string().nullable(),
  url: z.string(),
  description: z.string().nullable(),
  /** "possible" matches stay separate from accepted ones. */
  status: z.enum(ACCOUNT_STATUSES),
  /** How the link was found (a discovered URL is not the same as content that was read). */
  discovery: openEnum(ACCOUNT_DISCOVERY),
  matchEvidence: z.array(z.object({ text: z.string(), sourceId: uuid.nullable() })),
  accessNote: z.string().nullable(),
  sourceId: uuid.nullable(),
});
export type Account = z.infer<typeof AccountSchema>;

export const RelationshipSchema = z.object({
  id: uuid,
  /** "documented" relationships are stated by a source; "shared_affiliation" only means overlapping organisations. */
  kind: z.enum(RELATIONSHIP_KINDS),
  relationType: openEnum(RELATIONSHIP_TYPES),
  label: z.string(),
  counterpartName: z.string(),
  counterpartRole: z.string().nullable(),
  organisationName: z.string().nullable(),
  project: z.string().nullable(),
  start: PartialDateSchema.nullable(),
  end: PartialDateSchema.nullable(),
  note: z.string().nullable(),
  evidence: z.array(z.object({ sourceId: uuid, excerpt: z.string(), verified: z.boolean() })),
});
export type Relationship = z.infer<typeof RelationshipSchema>;

export const OrganisationSchema = z.object({
  id: uuid,
  name: z.string(),
  kind: openEnum(["company", "institution", "board", "project", "other"] as const),
});

export const AllegationsSchema = z.object({
  allegations: z.array(z.object({ text: z.string(), attributedTo: z.string() })),
  responses: z.array(z.object({ text: z.string(), attributedTo: z.string() })),
  outcomes: z.array(z.object({ text: z.string(), documentedBy: z.string() })),
});

export const MediaItemSchema = z.object({
  id: uuid,
  isPrimary: z.boolean(),
  sourceId: uuid.nullable(),
  headline: z.string(),
  outlet: z.string(),
  url: z.string(),
  kind: openEnum(MEDIA_KINDS),
  /** Original publication date as printed by the source (partial ISO), or null when unknown. */
  publishedAt: z.string().nullable(),
  sourceUpdatedAt: z.string().nullable(),
  /** Date reported by the search provider; never a publication date. */
  providerReportedDate: z.string().nullable(),
  eventDate: PartialDateSchema.nullable(),
  /** When PersonBrief found the item. */
  discoveredAt: isoDateTime,
  language: openEnum(LANGUAGES),
  summary: z.string(),
  summaryBasis: openEnum(SUMMARY_BASIS),
  involvement: z.string().nullable(),
  coverageType: openEnum(COVERAGE_TYPES),
  topic: openEnum(MEDIA_TOPICS),
  matchEvidence: z.string().nullable(),
  allegations: AllegationsSchema.nullable(),
  /** Fictional demo item: open the source in the app's fixture viewer. */
  fixtureKey: z.string().nullable(),
});
export type MediaItem = z.infer<typeof MediaItemSchema>;

export const StorySchema = z.object({
  id: uuid,
  headline: z.string(),
  coverageType: openEnum(COVERAGE_TYPES),
  topic: openEnum(MEDIA_TOPICS),
  firstPublishedAt: z.string().nullable(),
  itemCount: z.number().int(),
  /** Primary item first, then syndicated copies. */
  items: z.array(MediaItemSchema),
});
export type Story = z.infer<typeof StorySchema>;

export const SourceSchema = z.object({
  id: uuid,
  /** Citation key ("S1"). */
  key: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  publisher: z.string().nullable(),
  sourceType: openEnum(SOURCE_TYPES),
  reliability: openEnum(SOURCE_RELIABILITY),
  language: openEnum(LANGUAGES),
  publishedAt: z.string().nullable(),
  sourceUpdatedAt: z.string().nullable(),
  providerReportedDate: z.string().nullable(),
  accessedAt: isoDateTime,
  accessMethod: openEnum(ACCESS_METHODS),
  accessStatus: openEnum(ACCESS_STATUSES),
  accessNote: z.string().nullable(),
  aboutSubject: openEnum(["yes", "no", "unclear"] as const),
  identityEvidence: z.string().nullable(),
  excerpt: z.string().nullable(),
  /** Fictional demo source: open it in the app's fixture viewer, never as a website. */
  fixtureKey: z.string().nullable(),
});
export type Source = z.infer<typeof SourceSchema>;

export const SummarySentenceSchema = z.object({
  text: z.string(),
  claimIds: z.array(z.string()),
  mediaIds: z.array(z.string()),
  kind: openEnum(["sourced", "inferred"] as const),
});

export const OverviewSchema = z.object({
  summary: z.array(SummarySentenceSchema),
  keyDevelopments: z.array(z.object({ text: z.string(), mediaIds: z.array(z.string()), claimIds: z.array(z.string()), date: PartialDateSchema.nullable() })),
  gaps: z.array(z.object({ code: z.string(), text: z.string() })),
  questions: z.array(z.object({ question: z.string(), claimIds: z.array(z.string()), mediaIds: z.array(z.string()) })),
  /** False when the written synthesis failed or was skipped (facts are still shown). */
  narrativeAvailable: z.boolean(),
});

export const SnapshotMetaSchema = z.object({
  id: uuid,
  version: z.number().int(),
  status: openEnum(["complete", "partial"] as const),
  researchedAt: isoDateTime,
});

export const SnapshotDetailSchema = SnapshotMetaSchema.extend({
  jobId: uuid.nullable(),
  identity: z.object({
    displayName: z.string(),
    nativeName: z.string().nullable(),
    nameVariants: z.array(z.string()),
    organisation: z.string().nullable(),
    role: z.string().nullable(),
    resolution: IdentityResolutionSchema,
  }),
  headline: HeadlineSchema.extend({
    roleClaimId: z.string().nullable(),
    organisationClaimId: z.string().nullable(),
    locationClaimId: z.string().nullable(),
  }),
  model: z.object({ provider: openEnum(["anthropic", "fixture"] as const), model: z.string(), promptVersion: z.string(), effort: z.string().nullable() }),
  counts: z.object({
    sources: z.number().int(),
    claims: z.number().int(),
    media: z.number().int(),
    stories: z.number().int(),
    contacts: z.number().int(),
    accounts: z.number().int(),
    relationships: z.number().int(),
  }),
  coverage: z.array(
    z.object({
      category: z.string(),
      status: openEnum(["ok", "partial", "failed", "skipped"] as const),
      queries: z.number().int(),
      results: z.number().int(),
      note: z.string().nullable(),
    }),
  ),
  accessLimitations: z.array(z.object({ domain: z.string(), url: z.string().nullable(), status: openEnum(ACCESS_STATUSES), note: z.string() })),
  /** Extracted items rejected by verification (shown as a count; details stay on the website). */
  rejectedCount: z.number().int(),
});

export const ProfileDetailSchema = z.object({
  profile: z.object({
    id: uuid,
    workspace: z.enum(WORKSPACES),
    displayName: z.string(),
    nativeName: z.string().nullable(),
    nameVariants: z.array(z.string()),
    savedAt: isoDateTime.nullable(),
    lastResearchedAt: isoDateTime.nullable(),
    snapshotCount: z.number().int(),
  }),
  snapshot: SnapshotDetailSchema,
  /** All versions, newest first. */
  snapshots: z.array(SnapshotMetaSchema),
  overview: OverviewSchema,
  claims: z.array(ClaimSchema),
  contacts: z.array(ContactSchema),
  accounts: z.array(AccountSchema),
  relationships: z.array(RelationshipSchema),
  organisations: z.array(OrganisationSchema),
  stories: z.array(StorySchema),
  sources: z.array(SourceSchema),
  /** Private notes: never part of the sourced facts, excluded from exports by default. */
  notes: z.array(NoteSchema),
  tags: z.array(TagSchema),
  /** Every tag in this workspace, for suggestions. */
  availableTags: z.array(TagSchema),
});
export type ProfileDetail = z.infer<typeof ProfileDetailSchema>;

/* --------------------------------- Changes ------------------------------- */

const DiffClaimSchema = z.object({
  id: z.string(),
  claimKey: z.string(),
  category: openEnum(CLAIM_CATEGORIES),
  displayValue: z.string(),
  evidenceStatus: z.string(),
  conflictGroup: z.string().nullable(),
  temporal: TemporalSchema,
});
const DiffMediaSchema = z.object({ id: z.string(), canonicalUrl: z.string(), headline: z.string(), outlet: z.string(), publishedAt: z.string().nullable(), coverageType: z.string() });
const DiffContactSchema = z.object({ id: z.string(), contactKey: z.string(), contactType: z.string(), value: z.string() });
const DiffAccountSchema = z.object({ id: z.string(), accountKey: z.string(), platform: z.string(), url: z.string(), status: z.string() });
const DiffRelationshipSchema = z.object({ id: z.string(), relationshipKey: z.string(), label: z.string(), counterpartName: z.string(), kind: z.string() });

export const SnapshotDiffSchema = z.object({
  from: z.object({ version: z.number().int(), researchedAt: z.string() }),
  to: z.object({ version: z.number().int(), researchedAt: z.string() }),
  headline: z.object({ changed: z.boolean(), before: HeadlineSchema, after: HeadlineSchema }),
  media: z.object({
    /** Published after the previous research date. */
    newlyPublished: z.array(DiffMediaSchema),
    /** Older coverage found only now: not a new event. */
    newlyDiscovered: z.array(DiffMediaSchema),
    dateUncertain: z.array(DiffMediaSchema),
    noLongerFound: z.array(DiffMediaSchema),
  }),
  claims: z.object({
    added: z.array(DiffClaimSchema),
    removed: z.array(DiffClaimSchema),
    updated: z.array(z.object({ before: DiffClaimSchema, after: DiffClaimSchema, changes: z.array(z.string()) })),
    conflictsResolved: z.array(z.object({ key: z.string(), before: z.array(DiffClaimSchema), after: z.array(DiffClaimSchema) })),
    conflictsIntroduced: z.array(z.object({ key: z.string(), after: z.array(DiffClaimSchema) })),
  }),
  contacts: z.object({ added: z.array(DiffContactSchema), removed: z.array(DiffContactSchema) }),
  accounts: z.object({ added: z.array(DiffAccountSchema), removed: z.array(DiffAccountSchema), promoted: z.array(DiffAccountSchema), demoted: z.array(DiffAccountSchema) }),
  relationships: z.object({ added: z.array(DiffRelationshipSchema), removed: z.array(DiffRelationshipSchema) }),
  unchanged: z.object({ claims: z.number().int(), media: z.number().int() }),
  hasChanges: z.boolean(),
});
export type SnapshotDiffDto = z.infer<typeof SnapshotDiffSchema>;

export const ChangesResponseSchema = z.object({
  snapshots: z.array(SnapshotMetaSchema),
  /** Null when the profile has a single version. */
  fromSnapshotId: uuid.nullable(),
  toSnapshotId: uuid.nullable(),
  diff: SnapshotDiffSchema.nullable(),
});
export type ChangesResponse = z.infer<typeof ChangesResponseSchema>;

/* -------------------------------- Mutations ------------------------------ */

export const SetSavedRequestSchema = z.object({ saved: z.boolean() });
export const SavedStateSchema = z.object({ savedAt: isoDateTime.nullable() });

export const NOTE_MAX_LENGTH = 5000;
export const NoteRequestSchema = z.object({ body: z.string().trim().min(1, "note_empty").max(NOTE_MAX_LENGTH, "too_long") });

export const TAG_MAX_LENGTH = 40;
export const AddTagRequestSchema = z.object({ name: z.string().trim().min(1, "tag_empty").max(TAG_MAX_LENGTH, "too_long") });
export const ProfileTagsResponseSchema = z.object({ tags: z.array(TagSchema), availableTags: z.array(TagSchema) });

export const ISSUE_MAX_LENGTH = 2000;
export const ReportIssueRequestSchema = z.object({
  category: z.enum(ISSUE_CATEGORIES),
  message: z.string().trim().min(1, "message_empty").max(ISSUE_MAX_LENGTH, "too_long"),
  snapshotId: uuid.nullable().optional(),
  claimId: uuid.nullable().optional(),
});

export const EXPORT_FORMATS = ["pdf", "json"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
