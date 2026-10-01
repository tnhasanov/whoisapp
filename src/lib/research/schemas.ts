import { z } from "zod";
import {
  ACCOUNT_DISCOVERY,
  CLAIM_CATEGORIES,
  CONTACT_OWNERS,
  CONTACT_TYPES,
  COVERAGE_TYPES,
  LANGUAGES,
  MEDIA_KINDS,
  MEDIA_TOPICS,
  RELATIONSHIP_TYPES,
  SOCIAL_PLATFORMS,
  SOURCE_TYPES,
} from "@/lib/domain/types";

/**
 * Schemas for structured model output.
 *
 * The same schemas validate live (Anthropic) and demo (fixture) outputs, so the
 * demo exercises the real validation and verification path. Passing schema
 * validation only proves the shape is right; evidence checks happen later
 * (source IDs must exist, excerpts must appear in retrieved text, etc.).
 *
 * Objects are flat with nullable fields so they stay within the JSON-schema
 * subset supported by constrained decoding.
 */

const nullableString = z.string().nullable();
/** "YYYY", "YYYY-MM" or "YYYY-MM-DD" exactly as supported by the source; null when not stated. */
const looseDate = z.string().nullable();

/* ------------------------------- Discovery ------------------------------- */

export const DiscoveryCandidateSchema = z.object({
  candidate_ref: z.string(),
  display_name: z.string(),
  native_name: nullableString,
  organisation: nullableString,
  role: nullableString,
  location: nullableString,
  summary: z.string(),
  distinguishing_facts: z.array(z.string()),
  source_ids: z.array(z.string()),
  anchor_source_id: nullableString,
});

export const DiscoveryOutputSchema = z.object({
  candidates: z.array(DiscoveryCandidateSchema),
  unassigned_source_ids: z.array(z.string()),
});

export type DiscoveryCandidate = z.infer<typeof DiscoveryCandidateSchema>;
export type DiscoveryOutput = z.infer<typeof DiscoveryOutputSchema>;

/* ------------------------------- Extraction ------------------------------ */

export const ExtractedSourceSchema = z.object({
  source_id: z.string(),
  about_subject: z.enum(["yes", "no", "unclear"]),
  identity_evidence: z.string(),
  source_type: z.enum(SOURCE_TYPES),
  page_language: z.enum(LANGUAGES),
  published_date: looseDate,
  updated_date: looseDate,
  self_published: z.boolean(),
});

export const ExtractedFactSchema = z.object({
  source_id: z.string(),
  category: z.enum(CLAIM_CATEGORIES),
  organisation: nullableString,
  title: nullableString,
  department: nullableString,
  institution: nullableString,
  qualification: nullableString,
  field: nullableString,
  place: nullableString,
  place_scope: z.enum(["work", "based"]).nullable(),
  statement: nullableString,
  award_name: nullableString,
  issuer: nullableString,
  publication_title: nullableString,
  venue: nullableString,
  start: looseDate,
  end: looseDate,
  approximate: z.boolean(),
  currency: z.enum(["stated_current", "ended", "unknown"]),
  supporting_excerpt: z.string(),
  /** English rendering when the source wording is not English; null otherwise. */
  english_rendering: nullableString,
});

export const ExtractedContactSchema = z.object({
  source_id: z.string(),
  contact_type: z.enum(CONTACT_TYPES),
  value: z.string(),
  belongs_to: z.enum(CONTACT_OWNERS),
  owner_label: z.string(),
  purpose: nullableString,
  publication_context: z.string(),
  supporting_excerpt: z.string(),
});

export const ExtractedAccountSchema = z.object({
  source_id: z.string(),
  platform: z.enum(SOCIAL_PLATFORMS),
  url: z.string(),
  handle: nullableString,
  description: nullableString,
  discovery: z.enum(ACCOUNT_DISCOVERY),
  supporting_excerpt: z.string(),
  identity_evidence: z.string(),
});

export const ExtractedRelationshipSchema = z.object({
  source_id: z.string(),
  relation_type: z.enum(RELATIONSHIP_TYPES),
  counterpart_name: z.string(),
  counterpart_role: nullableString,
  organisation: nullableString,
  project: nullableString,
  start: looseDate,
  end: looseDate,
  supporting_excerpt: z.string(),
});

const AttributedStatementSchema = z.object({ text: z.string(), attributed_to: z.string() });

export const ExtractedMediaSchema = z.object({
  source_id: z.string(),
  headline: z.string(),
  outlet: z.string(),
  kind: z.enum(MEDIA_KINDS),
  published_date: looseDate,
  event_date: looseDate,
  language: z.enum(LANGUAGES),
  /** Original, concise summary written by the extractor; never a copy of the article. */
  summary: z.string(),
  involvement: nullableString,
  coverage_type: z.enum(COVERAGE_TYPES),
  topic: z.enum(MEDIA_TOPICS),
  identity_evidence: z.string(),
  allegations: z
    .object({
      allegations: z.array(AttributedStatementSchema),
      responses: z.array(AttributedStatementSchema),
      outcomes: z.array(AttributedStatementSchema),
    })
    .nullable(),
});

export const ExtractionOutputSchema = z.object({
  sources: z.array(ExtractedSourceSchema),
  facts: z.array(ExtractedFactSchema),
  contacts: z.array(ExtractedContactSchema),
  accounts: z.array(ExtractedAccountSchema),
  relationships: z.array(ExtractedRelationshipSchema),
  media: z.array(ExtractedMediaSchema),
});

export type ExtractedSource = z.infer<typeof ExtractedSourceSchema>;
export type ExtractedFact = z.infer<typeof ExtractedFactSchema>;
export type ExtractedContact = z.infer<typeof ExtractedContactSchema>;
export type ExtractedAccount = z.infer<typeof ExtractedAccountSchema>;
export type ExtractedRelationship = z.infer<typeof ExtractedRelationshipSchema>;
export type ExtractedMedia = z.infer<typeof ExtractedMediaSchema>;
export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;

/* ------------------------------- Synthesis ------------------------------- */

export const SynthesisOutputSchema = z.object({
  summary: z.array(
    z.object({
      text: z.string(),
      claim_ids: z.array(z.string()),
      media_ids: z.array(z.string()),
      kind: z.enum(["sourced", "inferred"]),
    }),
  ),
  key_developments: z.array(
    z.object({
      text: z.string(),
      media_ids: z.array(z.string()),
      claim_ids: z.array(z.string()),
      date: looseDate,
    }),
  ),
  gaps: z.array(z.object({ text: z.string() })),
  questions: z.array(
    z.object({
      question: z.string(),
      claim_ids: z.array(z.string()),
      media_ids: z.array(z.string()),
    }),
  ),
});

export type SynthesisOutput = z.infer<typeof SynthesisOutputSchema>;

export const EMPTY_EXTRACTION: ExtractionOutput = {
  sources: [],
  facts: [],
  contacts: [],
  accounts: [],
  relationships: [],
  media: [],
};
