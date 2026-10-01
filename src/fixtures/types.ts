import type { ClaimCategory, ResearchCategory, SourceType } from "@/lib/domain/types";
import type {
  ExtractedAccount,
  ExtractedContact,
  ExtractedFact,
  ExtractedMedia,
  ExtractedRelationship,
  ExtractedSource,
} from "@/lib/research/schemas";

/**
 * FICTIONAL DEMO WORLD
 *
 * Every person, organisation, publication, URL, email address and phone
 * number in the fixture world is invented. URLs use reserved example domains
 * (RFC 2606: *.example, example.com/.org/.net). Phone numbers use ranges that
 * are reserved for drama/fiction (UK Ofcom 020 7946 0xxx and 07700 900xxx,
 * North American 555-01xx). Fixture sources are shown in the local fixture
 * viewer, never linked as live articles.
 */

export type FixtureAccess = "read" | "snippet_only" | "login_required" | "paywalled";

export type FixtureDocument = {
  /** Unique kebab-case key, e.g. "gasimova-official-bio-v1". */
  key: string;
  /** https URL on a reserved example domain. May repeat across versions only. */
  url: string;
  title: string;
  publisher: string;
  language: "az" | "en" | "ru";
  sourceType: SourceType;
  /**
   * Publication date printed on the page: "YYYY", "YYYY-MM" or "YYYY-MM-DD";
   * null when the page shows no date. The special value "@run-date" resolves to
   * the date the research job runs (simulates a story published since the
   * previous snapshot; used only in world version 2).
   */
  publishedDate: string | null;
  /** Date the search provider reports. May differ (e.g. a re-index date). */
  providerPublishedDate?: string | null;
  access: FixtureAccess;
  /** Search-result snippet (plain text, ≤ 320 chars). */
  snippet: string;
  /** Full page text for access "read"; null for any other access value. */
  body: string | null;
  /** Searches that can return this document. "discovery" = the initial name search. */
  categories: Array<ResearchCategory | "discovery">;
  /** Every spelling of a person's name that appears in this document (any script). */
  nameForms: string[];
  /** World versions that contain this document. Defaults to [1, 2]. */
  versions?: number[];
  /** Shared by syndicated copies of the same story. */
  storyKey?: string;
};

/** Extraction output for one document from one person's perspective (source_id is filled in at run time). */
export type FixtureDocExtraction = {
  source: Omit<ExtractedSource, "source_id">;
  facts?: Omit<ExtractedFact, "source_id">[];
  contacts?: Omit<ExtractedContact, "source_id">[];
  accounts?: Omit<ExtractedAccount, "source_id">[];
  relationships?: Omit<ExtractedRelationship, "source_id">[];
  media?: Omit<ExtractedMedia, "source_id">[];
};

/** Selects accepted claims by category and a case-insensitive substring of their display text. */
export type ClaimSelector = { category: ClaimCategory; contains: string };
/** Selects media items by a case-insensitive substring of the headline. */
export type MediaSelector = { headlineContains: string };

export type FixtureSynthesis = {
  summary: { text: string; claims: ClaimSelector[]; media: MediaSelector[]; kind: "sourced" | "inferred" }[];
  keyDevelopments: { text: string; claims: ClaimSelector[]; media: MediaSelector[]; date: string | null }[];
  gaps: string[];
  questions: { question: string; claims: ClaimSelector[]; media: MediaSelector[] }[];
};

export type FixtureScenario =
  | "rich"
  | "ambiguous"
  | "sparse"
  | "transliteration"
  | "conflicting-dates"
  | "duplicated-news"
  | "blocked-source"
  | "partial-failure"
  | "same-name-collision"
  | "hostile-source";

export type FixtureFailure = {
  /** Research category whose searches fail. */
  category: ResearchCategory;
  kind: "timeout" | "rate_limited" | "unavailable";
  /** When true the failure only happens in the original job; a retry job succeeds. */
  untilRetry: boolean;
};

export type FixturePerson = {
  /** Unique key, e.g. "elnara-gasimova". */
  key: string;
  displayName: string;
  /** Spelling in the person's own language/script when different (e.g. Azerbaijani Latin). */
  nativeName: string | null;
  /** Every known spelling (Latin, Azerbaijani, Cyrillic) used in this person's documents. */
  nameVariants: string[];
  organisation: string | null;
  role: string | null;
  location: string | null;
  /** One neutral sentence used on the identity-selection card. */
  summary: string;
  distinguishingFacts: string[];
  /** The strongest identity source (usually an official biography). */
  anchorDocKey: string;
  scenarios: FixtureScenario[];
  failures?: FixtureFailure[];
};

export type FixturePersonBundle = {
  person: FixturePerson;
  /** Documents primarily about this person (other bundles may also see them via search). */
  documents: FixtureDocument[];
  /**
   * Extraction outputs from this person's perspective, keyed by document key.
   * Documents returned by a search but missing here are treated as not about
   * the subject (about_subject "no").
   */
  extraction: Record<string, FixtureDocExtraction>;
  /** Synthesis per world version (1 = first research, 2 = after refresh). */
  synthesis: Partial<Record<1 | 2, FixtureSynthesis>>;
};

/** Example searches shown on the search screen. */
export type FixtureExample = {
  label: string;
  fullName: string;
  company?: string;
  country?: string;
  profileUrl?: string;
  scenario: string;
};
