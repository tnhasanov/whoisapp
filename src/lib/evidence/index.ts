import {
  monthsBetween,
  parsePartialDate,
  partialDatesCompatible,
  partialDateSortKey,
  partialDateStart,
  comparePartialDates,
} from "@/lib/dates/partial-date";
import type {
  AccessStatus,
  ClaimCategory,
  ClaimValue,
  CurrencyState,
  EvidenceStatus,
  PartialDate,
  SourceReliability,
  SourceType,
  Temporal,
} from "@/lib/domain/types";
import type { ExtractedFact } from "@/lib/research/schemas";
import { keyify } from "@/lib/research/text";

/* --------------------------- Source reliability --------------------------- */

export function reliabilityFor(sourceType: SourceType, selfPublished: boolean): SourceReliability {
  if (selfPublished || sourceType === "personal_site") return "self_published";
  switch (sourceType) {
    case "official_bio":
    case "company_site":
    case "registry":
    case "press_release":
      return "official";
    case "news":
    case "interview":
    case "video":
      return "other_media";
    case "academic":
    case "conference":
      return "other_media";
    case "social_profile":
      return "social_platform";
    case "search_listing":
      return "aggregator";
    default:
      return "unknown";
  }
}

/* ------------------------------ Title / keys ------------------------------ */

const TITLE_ABBREVIATIONS: [RegExp, string][] = [
  [/\bceo\b/g, "chief executive officer"],
  [/\bcto\b/g, "chief technology officer"],
  [/\bcoo\b/g, "chief operating officer"],
  [/\bcfo\b/g, "chief financial officer"],
  [/\bcio\b/g, "chief information officer"],
  [/\bcmo\b/g, "chief marketing officer"],
  [/\bvp\b/g, "vice president"],
  [/\bsvp\b/g, "senior vice president"],
  [/\bmd\b/g, "managing director"],
  [/\bsr\.?\b/g, "senior"],
  [/\bchief executive\b(?! officer)/g, "chief executive officer"],
];

/** Canonical role title for comparison ("Co-founder & CEO" → "chief executive officer"). */
export function normaliseTitle(title: string | null | undefined): string {
  if (!title) return "";
  let t = title.toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  for (const [re, rep] of TITLE_ABBREVIATIONS) t = t.replace(re, rep);
  const stripped = t
    .replace(/^(co-?founder|founder)\s*(and|&|,|\/)\s*/g, "")
    .replace(/\s*(and|&|,|\/)\s*(co-?founder|founder)$/g, "")
    .trim();
  return stripped || t;
}

export function factMainLabel(f: Pick<ExtractedFact, "category" | "organisation" | "title" | "institution" | "qualification" | "field" | "place" | "statement" | "award_name" | "publication_title" | "english_rendering" | "issuer" | "venue" | "place_scope" | "department">): string {
  switch (f.category) {
    case "employment":
      return [f.title, f.organisation].filter(Boolean).join(", ");
    case "education":
      return [f.qualification, f.field, f.institution].filter(Boolean).join(", ");
    case "affiliation":
      return [f.title, f.organisation].filter(Boolean).join(", ");
    case "location":
      return f.place ?? "";
    case "biography":
      return f.english_rendering ?? f.statement ?? "";
    case "award":
      return [f.award_name, f.issuer].filter(Boolean).join(" — ");
    case "publication":
      return [f.publication_title, f.venue].filter(Boolean).join(", ");
  }
}

export function claimValueFromFact(f: ExtractedFact): ClaimValue {
  switch (f.category) {
    case "employment":
      return { kind: "employment", organisation: f.organisation ?? "", title: f.title, department: f.department };
    case "education":
      return { kind: "education", institution: f.institution ?? "", qualification: f.qualification, field: f.field };
    case "affiliation":
      return { kind: "affiliation", organisation: f.organisation ?? "", role: f.title };
    case "location":
      return { kind: "location", place: f.place ?? "", scope: f.place_scope ?? "based" };
    case "biography":
      return { kind: "biography", statement: f.english_rendering ?? f.statement ?? "" };
    case "award":
      return { kind: "award", name: f.award_name ?? "", issuer: f.issuer };
    case "publication":
      return { kind: "publication", title: f.publication_title ?? "", venue: f.venue };
  }
}

// Unicode-aware word boundaries: `\b` only knows ASCII letters, so it never matched "ООО"
// and wrongly matched "co" after a non-ASCII letter ("Bakıco").
const LEGAL_SUFFIXES =
  /(?<![\p{L}\p{N}])(llc|l\.l\.c|ltd|limited|inc|incorporated|plc|llp|gmbh|ag|jsc|ojsc|cjsc|asc|qsc|mmc|ooo|ооо|оао|зао|пао|ao|ао|co|corp|corporation|company|group)(?![\p{L}\p{N}])\.?/giu;

/** Comparison key for organisation names ("Caspian Lantern Analytics MMC" = "Caspian Lantern Analytics LLC"). */
export function organisationKey(name: string | null | undefined): string {
  if (!name) return "";
  return keyify(name.replace(/[«»"“”]/g, " ").replace(LEGAL_SUFFIXES, " "));
}

/** Degree level, so "MSc Data Science" and "Master of Science in Data Science" compare equal. */
export function degreeLevel(qualification: string | null | undefined): string {
  const q = (qualification ?? "").toLowerCase();
  if (/(ph\.?\s?d|doctor|doktor|кандидат|доктор|dphil)/.test(q)) return "doctorate";
  // "MA"/"BA" must start a word: "Diploma" and "Cinema" are not master's degrees.
  if (/(m\.?\s?sc|\bm\.?a\b|mba|master|magistr|магистр|llm|meng)/.test(q)) return "master";
  if (/(b\.?\s?sc|\bb\.?a\b|bachelor|bakalavr|бакалавр|beng|llb)/.test(q)) return "bachelor";
  if (/(diploma|diplom|диплом|certificate|sertifikat|сертификат)/.test(q)) return "diploma";
  return keyify(q) || "unspecified";
}

/** The English role title when the source was not in English. */
function titleForKey(f: ExtractedFact): string {
  return normaliseTitle(f.english_rendering ?? f.title);
}

export function claimKeyForFact(f: ExtractedFact): string {
  switch (f.category) {
    case "employment":
      return `employment|${organisationKey(f.organisation)}|${keyify(titleForKey(f))}`;
    case "education":
      return `education|${organisationKey(f.institution)}|${degreeLevel(f.qualification ?? f.english_rendering)}`;
    case "affiliation":
      return `affiliation|${organisationKey(f.organisation)}|${keyify(titleForKey(f))}`;
    case "location":
      return `location|${keyify(f.place ?? "")}`;
    case "biography":
      return `biography|${keyify(f.english_rendering ?? f.statement ?? "").slice(0, 80)}`;
    case "award":
      return `award|${keyify(f.award_name ?? "")}`;
    case "publication":
      return `publication|${keyify(f.publication_title ?? "")}`;
  }
}

/* --------------------------- Merge and conflicts -------------------------- */

export type FactWithSource = {
  fact: ExtractedFact;
  sourceId: string;
  sourceDomain: string | null;
  syndicationGroup: string | null;
  sourceReliability: SourceReliability;
  sourceAccess: AccessStatus;
  sourcePublishedAt: string | null;
  sourceAccessedAt: string;
};

export type MergedClaim = {
  claimKey: string;
  category: ClaimCategory;
  members: FactWithSource[];
  conflictGroup: string | null;
  start: PartialDate | null;
  end: PartialDate | null;
};

function datesCompatible(a: ExtractedFact, b: ExtractedFact): boolean {
  return (
    partialDatesCompatible(parsePartialDate(a.start), parsePartialDate(b.start)) &&
    partialDatesCompatible(parsePartialDate(a.end), parsePartialDate(b.end))
  );
}

/** The most precise of a set of compatible dates. */
function mostPrecise(dates: (PartialDate | null)[]): PartialDate | null {
  const known = dates.filter((d): d is PartialDate => Boolean(d));
  if (known.length === 0) return null;
  return known.sort((a, b) => (b.day ? 3 : b.month ? 2 : 1) - (a.day ? 3 : a.month ? 2 : 1))[0];
}

/**
 * Merge facts that describe the same thing. Facts with the same claim key but
 * incompatible dates are kept as separate claims sharing a conflict group;
 * they are never silently reconciled.
 */
export function mergeFacts(items: FactWithSource[]): MergedClaim[] {
  const byKey = new Map<string, FactWithSource[]>();
  for (const item of items) {
    const key = claimKeyForFact(item.fact);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(item);
  }
  const merged: MergedClaim[] = [];
  for (const [claimKey, group] of byKey) {
    const dated = group.filter((g) => g.fact.start || g.fact.end);
    const undated = group.filter((g) => !g.fact.start && !g.fact.end);
    const clusters: FactWithSource[][] = [];
    for (const item of dated) {
      const target = clusters.find((cluster) => cluster.every((c) => datesCompatible(c.fact, item.fact)));
      if (target) target.push(item);
      else clusters.push([item]);
    }
    if (clusters.length === 0) clusters.push([]);
    // Undated mentions support the role itself; attach them to the best-supported cluster.
    const largest = clusters.reduce((best, c) => (c.length > best.length ? c : best), clusters[0]);
    largest.push(...undated);
    const conflictGroup = clusters.length > 1 ? `conflict:${claimKey}` : null;
    for (const cluster of clusters) {
      merged.push({
        claimKey: conflictGroup ? `${claimKey}|${cluster.map((c) => c.fact.start ?? "").find(Boolean) ?? "undated"}` : claimKey,
        category: cluster[0].fact.category,
        members: cluster,
        conflictGroup,
        start: mostPrecise(cluster.map((c) => parsePartialDate(c.fact.start, c.fact.approximate))),
        end: mostPrecise(cluster.map((c) => parsePartialDate(c.fact.end))),
      });
    }
  }
  return merged;
}

/** Independent sources: distinct publishers, counting syndicated copies once. */
export function independentSourceCount(members: Pick<FactWithSource, "sourceDomain" | "syndicationGroup" | "sourceId">[]): number {
  const keys = new Set(members.map((m) => m.syndicationGroup ?? m.sourceDomain ?? m.sourceId));
  return keys.size;
}

export function evidenceStatusFor(claim: Pick<MergedClaim, "members" | "conflictGroup">): EvidenceStatus {
  if (claim.conflictGroup) return "conflicting";
  const members = claim.members;
  if (members.length > 0 && members.every((m) => m.sourceAccess !== "read")) return "snippet_only";
  if (independentSourceCount(members) >= 2) return "multiple_sources";
  const reliabilities = new Set(members.map((m) => m.sourceReliability));
  if (reliabilities.has("official")) return "official_source";
  if (reliabilities.has("self_published")) return "self_reported";
  return "single_source";
}

/* -------------------------------- Temporal -------------------------------- */

const OUTDATED_AFTER_MONTHS = 18;

/**
 * Determine what the evidence says about currency. "Accessed today" is not
 * "current today": an undated official page supports "stated as current when
 * accessed", while an old article saying "currently" is flagged.
 */
export function temporalFor(claim: MergedClaim, researchedAt: Date): { temporal: Temporal; uncertaintyNote: string | null } {
  let currency: CurrencyState = "unknown";
  let asOf: string | null = null;
  let asOfBasis: "published" | "accessed" | undefined;
  let possiblyOutdated = false;
  const notes: string[] = [];

  const stating = claim.members.filter((m) => m.fact.currency === "stated_current");
  if (claim.end) {
    currency = "ended";
  } else if (stating.length > 0) {
    currency = "stated_current";
    // The freshest statement wins. For an undated page the date is when it was read, which only
    // shows the page still said so then; the basis is kept so the UI never calls it a publication date.
    const statements = stating
      .map((m) => (m.sourcePublishedAt ? { date: m.sourcePublishedAt, basis: "published" as const } : { date: m.sourceAccessedAt.slice(0, 10), basis: "accessed" as const }))
      .sort((a, b) => b.date.localeCompare(a.date) || (a.basis === "published" ? -1 : 1));
    asOf = statements[0]?.date ?? null;
    asOfBasis = statements[0]?.basis;
    const freshest = parsePartialDate(asOf);
    if (freshest && monthsBetween(partialDateStart(freshest), researchedAt) > OUTDATED_AFTER_MONTHS) {
      possiblyOutdated = true;
      notes.push(`Described as current in a source dated ${asOf}; this may no longer be accurate.`);
    }
  } else if (claim.members.some((m) => m.fact.currency === "ended")) {
    currency = "ended";
  }
  if (claim.start && claim.end && comparePartialDates(claim.end, claim.start) === -1) {
    notes.push("The stated end date is earlier than the start date.");
  }
  if (claim.start?.approximate) notes.push("Start date is approximate in the source.");
  return {
    temporal: { start: claim.start, end: claim.end, currency, asOf, ...(asOfBasis ? { asOfBasis } : {}), possiblyOutdated },
    uncertaintyNote: notes.length ? notes.join(" ") : null,
  };
}

export function claimSortKey(start: PartialDate | null, end: PartialDate | null): string {
  // Most recent first: invert the sort key of the end (or start) date.
  const anchor = end ?? start;
  return anchor ? partialDateSortKey(anchor) : "0000";
}

/* ------------------------------- Headline -------------------------------- */

export type HeadlineCandidate = {
  id: string;
  category: ClaimCategory;
  value: ClaimValue;
  evidenceStatus: EvidenceStatus;
  temporal: Temporal;
};

const EVIDENCE_RANK: Record<EvidenceStatus, number> = {
  multiple_sources: 5,
  official_source: 4,
  self_reported: 3,
  single_source: 2,
  snippet_only: 1,
  conflicting: 1,
  inferred: 0,
};

/**
 * Latest evidenced professional role. Prefers roles stated as current by a
 * source that is not old; otherwise the most recent open-ended role, which the
 * UI labels as not confirmed current.
 */
export function pickHeadlineRole(claims: HeadlineCandidate[]): { claim: HeadlineCandidate; confirmedCurrent: boolean } | null {
  const employment = claims.filter((c) => c.category === "employment" && c.value.kind === "employment");
  if (employment.length === 0) return null;
  const score = (c: HeadlineCandidate) =>
    `${EVIDENCE_RANK[c.evidenceStatus]}|${c.temporal.asOf ?? ""}|${partialDateSortKey(c.temporal.start).replace("9999-99-99", "0000")}`;
  const current = employment
    .filter((c) => c.temporal.currency === "stated_current" && !c.temporal.possiblyOutdated)
    .sort((a, b) => score(b).localeCompare(score(a)));
  if (current[0]) return { claim: current[0], confirmedCurrent: true };
  const startKey = (c: HeadlineCandidate) => (c.temporal.start ? partialDateSortKey(c.temporal.start) : "0000");
  const open = employment
    .filter((c) => c.temporal.currency !== "ended" && !c.temporal.end)
    .sort((a, b) => startKey(b).localeCompare(startKey(a)));
  return open[0] ? { claim: open[0], confirmedCurrent: false } : null;
}

export const EVIDENCE_STATUS_ORDER = EVIDENCE_RANK;
