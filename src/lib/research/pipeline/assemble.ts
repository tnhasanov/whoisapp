import { classifyContact, contactKey, normaliseContactValue } from "@/lib/contacts";
import { isValidPartialDateString, parsePartialDate, precisionOf, partialDateToString } from "@/lib/dates/partial-date";
import {
  DOCUMENTED_RELATIONSHIP_TYPES,
  type AccessLimitation,
  type AccessMethod,
  type AccessStatus,
  type AccountDiscovery,
  type AccountStatus,
  type AllegationStructure,
  type ClaimCategory,
  type ClaimValue,
  type ContactOwner,
  type ContactType,
  type ContentLanguage,
  type CoverageEntry,
  type CoverageType,
  type DatePrecision,
  type EvidenceStatus,
  type InformationGap,
  type MediaKind,
  type MediaTopic,
  type PartialDate,
  type RelationshipKind,
  type RelationshipType,
  type SocialPlatform,
  type SourceReliability,
  type SourceType,
  type SummaryBasis,
  type Temporal,
} from "@/lib/domain/types";
import {
  claimSortKey,
  claimValueFromFact,
  evidenceStatusFor,
  normaliseTitle,
  organisationKey,
  pickHeadlineRole,
  reliabilityFor,
  temporalFor,
  mergeFacts,
  type FactWithSource,
} from "@/lib/evidence";
import { groupStories, syndicationGroups } from "@/lib/media/grouping";
import { queryMentionsName } from "@/lib/names";
import { LOGIN_WALLED_DOMAINS, SOCIAL_PLATFORM_DOMAINS } from "@/lib/research/config";
import type { ExtractedFact, ExtractedSource, ExtractionOutput } from "@/lib/research/schemas";
import { clip, contactValueAppearsIn, excerptAppearsIn, keyify, normaliseForMatch } from "@/lib/research/text";
import { languageOrUnknown } from "@/lib/research/providers/types";
import { canonicaliseUrl, hostnameOf, registrableDomain } from "@/lib/urls/canonical";

/* ---------------------------------- Types --------------------------------- */

export type AssembleDocument = {
  key: string;
  url: string;
  canonicalUrl: string;
  title: string | null;
  publisher: string | null;
  snippet: string | null;
  content: string | null;
  accessMethod: AccessMethod;
  accessStatus: AccessStatus;
  accessNote: string | null;
  providerPublishedAt: string | null;
  categories: string[];
  fixtureKey: string | null;
  fetchedAt: string;
};

export type AssembleIdentity = {
  displayName: string;
  nativeName: string | null;
  nameVariants: string[];
};

export type AssembleInput = {
  identity: AssembleIdentity;
  documents: AssembleDocument[];
  /** Document keys that were part of a successfully analysed extraction batch. */
  analysedKeys: string[];
  notAnalysed: { key: string; reason: "budget" | "analysis_failed" }[];
  extractions: ExtractionOutput[];
  /** Results dropped by policy before analysis (people-search sites etc.). */
  blocked: { url: string; reason: string }[];
  coverage: CoverageEntry[];
  researchedAt: string;
  maxSourceChars: number;
};

export type DraftSource = {
  key: string;
  url: string;
  canonicalUrl: string;
  title: string | null;
  publisher: string | null;
  sourceType: SourceType;
  reliability: SourceReliability;
  language: ContentLanguage;
  publishedAt: string | null;
  publishedPrecision: DatePrecision | null;
  sourceUpdatedAt: string | null;
  providerReportedDate: string | null;
  accessedAt: string;
  accessMethod: AccessMethod;
  accessStatus: AccessStatus;
  accessNote: string | null;
  aboutSubject: "yes" | "no" | "unclear";
  identityEvidence: string | null;
  excerpt: string | null;
  fixtureKey: string | null;
  syndicationGroup: string | null;
};

export type DraftClaimSource = { sourceKey: string; excerpt: string; excerptLanguage: ContentLanguage; excerptVerified: boolean };

export type DraftClaim = {
  tempId: string;
  claimKey: string;
  category: ClaimCategory;
  value: ClaimValue;
  displayValue: string;
  evidenceStatus: EvidenceStatus;
  temporal: Temporal;
  uncertaintyNote: string | null;
  conflictGroup: string | null;
  language: ContentLanguage;
  originalText: string | null;
  isTranslated: boolean;
  sortKey: string;
  sources: DraftClaimSource[];
};

export type DraftContact = {
  contactType: ContactType;
  value: string;
  normalisedValue: string | null;
  belongsTo: ContactOwner;
  ownerLabel: string;
  purpose: string | null;
  publicationContext: string;
  sourceKey: string;
  supportingExcerpt: string;
  isDirect: boolean;
  note: string | null;
  contactKey: string;
};

export type DraftAccount = {
  platform: SocialPlatform;
  handle: string | null;
  url: string;
  description: string | null;
  status: AccountStatus;
  discovery: AccountDiscovery;
  matchEvidence: { text: string; sourceKey: string | null }[];
  accessNote: string | null;
  sourceKey: string | null;
  accountKey: string;
};

export type DraftRelationship = {
  kind: RelationshipKind;
  relationType: RelationshipType;
  label: string;
  counterpartName: string;
  counterpartRole: string | null;
  organisationName: string | null;
  project: string | null;
  start: PartialDate | null;
  end: PartialDate | null;
  note: string | null;
  relationshipKey: string;
  sources: { sourceKey: string; excerpt: string; excerptVerified: boolean }[];
};

export type DraftOrganisation = { name: string; normalisedName: string; kind: "company" | "institution" | "board" | "project" | "other" };

export type DraftMediaItem = {
  tempId: string;
  sourceKey: string;
  headline: string;
  outlet: string;
  url: string;
  canonicalUrl: string;
  kind: MediaKind;
  publishedAt: string | null;
  publishedPrecision: DatePrecision | null;
  sourceUpdatedAt: string | null;
  providerReportedDate: string | null;
  eventDate: PartialDate | null;
  language: ContentLanguage;
  summary: string;
  summaryBasis: SummaryBasis;
  involvement: string | null;
  coverageType: CoverageType;
  topic: MediaTopic;
  matchEvidence: string | null;
  allegations: AllegationStructure | null;
  isPrimary: boolean;
  relevanceRank: number;
  mediaKey: string;
};

export type DraftStory = {
  storyKey: string;
  headline: string;
  coverageType: CoverageType;
  topic: MediaTopic;
  firstPublishedAt: string | null;
  relevanceRank: number;
  items: DraftMediaItem[];
};

export type RejectedItem = { kind: string; reason: string; sourceKey: string | null; preview: string };

export type DraftHeadline = {
  roleClaimTempId: string | null;
  role: string | null;
  organisation: string | null;
  roleConfirmedCurrent: boolean;
  locationClaimTempId: string | null;
  location: string | null;
};

export type DraftSnapshot = {
  sources: DraftSource[];
  claims: DraftClaim[];
  contacts: DraftContact[];
  accounts: DraftAccount[];
  relationships: DraftRelationship[];
  organisations: DraftOrganisation[];
  stories: DraftStory[];
  headline: DraftHeadline;
  gaps: InformationGap[];
  coverage: CoverageEntry[];
  accessLimitations: AccessLimitation[];
  rejected: RejectedItem[];
  stats: { analysedSources: number; notAnalysedSources: number; rejectedItems: number };
};

/* -------------------------------- Helpers --------------------------------- */

/** The exact text the model was shown for a document; verification uses the same text. */
export function documentTextForModel(doc: Pick<AssembleDocument, "accessStatus" | "content" | "title" | "snippet">, maxChars: number): string {
  if (doc.accessStatus === "read" && doc.content) return doc.content.slice(0, maxChars);
  return [doc.title, doc.snippet].filter(Boolean).join("\n");
}

function platformFromUrl(url: string): SocialPlatform | null {
  const domain = registrableDomain(url);
  if (!domain) return null;
  for (const [platform, domains] of Object.entries(SOCIAL_PLATFORM_DOMAINS)) {
    if (domains.includes(domain)) return platform as SocialPlatform;
  }
  return null;
}

function handleFromUrl(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const last = parts[0] === "in" || parts[0] === "company" || parts[0] === "user" || parts[0] === "c" ? parts[1] : parts[0];
    return last ? (last.startsWith("@") ? last : `@${last}`) : null;
  } catch {
    return null;
  }
}

function isLoginWalled(url: string): boolean {
  const domain = registrableDomain(url);
  return Boolean(domain && LOGIN_WALLED_DOMAINS.includes(domain));
}

const RELIABILITY_RANK: Record<SourceReliability, number> = {
  official: 6,
  self_published: 5,
  established_media: 4,
  other_media: 3,
  social_platform: 2,
  aggregator: 1,
  unknown: 0,
};

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  co_founder: "Co-founder",
  fellow_director: "Fellow director",
  business_partner: "Business partner",
  collaborator: "Collaborator",
  co_author: "Co-author",
  shared_employer: "Shared employer",
  shared_board: "Shared board",
  shared_institution: "Shared institution",
};

function descriptiveText(f: ExtractedFact): { english: string; original: string | null } {
  const original = (() => {
    switch (f.category) {
      case "employment":
      case "affiliation":
        return f.title;
      case "education":
        return [f.qualification, f.field].filter(Boolean).join(", ") || null;
      case "biography":
        return f.statement;
      case "award":
        return f.award_name;
      case "publication":
        return f.publication_title;
      case "location":
        return f.place;
    }
  })();
  return { english: f.english_rendering ?? original ?? "", original: f.english_rendering ? original : null };
}

function displayForFact(f: ExtractedFact): string {
  const { english } = descriptiveText(f);
  switch (f.category) {
    case "employment":
      return [english || "Role not stated", f.organisation].filter(Boolean).join(", ");
    case "affiliation":
      return [english || "Member", f.organisation].filter(Boolean).join(", ");
    case "education":
      return [english, f.institution].filter(Boolean).join(", ");
    case "location":
      return f.place ?? "";
    case "award":
      return [english, f.issuer].filter(Boolean).join(" — ");
    case "publication":
      return [english, f.venue].filter(Boolean).join(", ");
    case "biography":
      return english;
  }
}

function dateInfo(value: string | null | undefined): { date: string | null; precision: DatePrecision | null } {
  if (!value || !isValidPartialDateString(value)) return { date: null, precision: null };
  const parsed = parsePartialDate(value);
  return parsed ? { date: partialDateToString(parsed), precision: precisionOf(parsed) } : { date: null, precision: null };
}

/* ---------------------------------- Main ---------------------------------- */

export function assembleSnapshot(input: AssembleInput): DraftSnapshot {
  const researchedAt = new Date(input.researchedAt);
  const docs = new Map(input.documents.map((d) => [d.key, d]));
  const analysed = new Set(input.analysedKeys);
  const rejected: RejectedItem[] = [];
  const reject = (kind: string, reason: string, sourceKey: string | null, preview: string) =>
    rejected.push({ kind, reason, sourceKey, preview: clip(preview, 140) });

  const texts = new Map<string, string>();
  const textOf = (key: string) => {
    if (!texts.has(key)) texts.set(key, documentTextForModel(docs.get(key)!, input.maxSourceChars));
    return texts.get(key)!;
  };

  // 1. Per-source analysis (first statement wins; only for documents that were actually analysed).
  const sourceInfo = new Map<string, ExtractedSource>();
  for (const extraction of input.extractions) {
    for (const s of extraction.sources) {
      if (!docs.has(s.source_id) || !analysed.has(s.source_id) || sourceInfo.has(s.source_id)) continue;
      sourceInfo.set(s.source_id, s);
    }
  }

  const nameForms = [input.identity.displayName, input.identity.nativeName, ...input.identity.nameVariants].filter(
    (n): n is string => Boolean(n && n.trim()),
  );
  const mentionsSubject = (key: string) => {
    const doc = docs.get(key)!;
    const text = `${doc.title ?? ""}\n${textOf(key)}`;
    return nameForms.some((form) => queryMentionsName(text, form));
  };

  const about = new Map<string, "yes" | "no" | "unclear">();
  const aboutNote = new Map<string, string>();
  for (const [key, info] of sourceInfo) {
    let value = info.about_subject;
    if (value === "yes" && !mentionsSubject(key)) {
      value = "unclear";
      aboutNote.set(key, "Marked as about the subject, but the subject's name does not appear in the text that was read.");
    }
    about.set(key, value);
  }

  const reliabilityOf = (key: string): SourceReliability => {
    const info = sourceInfo.get(key);
    if (!info) return "unknown";
    return reliabilityFor(info.source_type, info.self_published);
  };

  const employerDomains = new Set(
    [...sourceInfo.entries()]
      .filter(([key, s]) => about.get(key) === "yes" && (s.source_type === "official_bio" || s.source_type === "company_site"))
      .map(([key]) => registrableDomain(docs.get(key)!.url))
      .filter((d): d is string => Boolean(d)),
  );

  const syndication = syndicationGroups(
    [...analysed].filter((k) => docs.get(k)?.accessStatus === "read").map((k) => ({ key: k, text: textOf(k) })),
  );

  const sourcePublished = (key: string): string | null => dateInfo(sourceInfo.get(key)?.published_date).date;

  // 2. Facts → claims.
  const validFacts: FactWithSource[] = [];
  const factOriginal = new Map<ExtractedFact, { english: string; original: string | null }>();
  for (const extraction of input.extractions) {
    for (const fact of extraction.facts) {
      const key = fact.source_id;
      const preview = displayForFact(fact);
      if (!docs.has(key) || !analysed.has(key)) {
        reject("fact", "unknown_source", null, preview);
        continue;
      }
      if (about.get(key) !== "yes") {
        reject("fact", "identity_not_confirmed", key, preview);
        continue;
      }
      if (!excerptAppearsIn(fact.supporting_excerpt, textOf(key))) {
        reject("fact", "excerpt_not_found", key, preview);
        continue;
      }
      if (!preview.trim() || !isValidPartialDateString(fact.start) || !isValidPartialDateString(fact.end)) {
        reject("fact", "invalid_fields", key, preview);
        continue;
      }
      factOriginal.set(fact, descriptiveText(fact));
      const doc = docs.get(key)!;
      validFacts.push({
        fact,
        sourceId: key,
        sourceDomain: registrableDomain(doc.url),
        syndicationGroup: syndication.get(key) ?? null,
        sourceReliability: reliabilityOf(key),
        sourceAccess: doc.accessStatus,
        sourcePublishedAt: sourcePublished(key),
        sourceAccessedAt: doc.fetchedAt,
      });
    }
  }

  const merged = mergeFacts(validFacts);
  const claims: DraftClaim[] = [];
  merged
    .map((m) => {
      const best = [...m.members].sort((a, b) => RELIABILITY_RANK[b.sourceReliability] - RELIABILITY_RANK[a.sourceReliability])[0];
      const { temporal, uncertaintyNote } = temporalFor(m, researchedAt);
      const evidenceStatus = evidenceStatusFor(m);
      const bestText = factOriginal.get(best.fact) ?? descriptiveText(best.fact);
      const lang = languageOrUnknown(sourceInfo.get(best.sourceId)?.page_language);
      return {
        m,
        claim: {
          tempId: "",
          claimKey: m.claimKey,
          category: m.category,
          value: claimValueFromFact({
            ...best.fact,
            title: best.fact.category === "employment" || best.fact.category === "affiliation" ? bestText.english || best.fact.title : best.fact.title,
            statement: best.fact.category === "biography" ? bestText.english : best.fact.statement,
            // Education rendered in English when the source was not; the original stays in originalText.
            qualification: best.fact.category === "education" && bestText.original ? bestText.english : best.fact.qualification,
            field: best.fact.category === "education" && bestText.original ? null : best.fact.field,
          }),
          displayValue: displayForFact(best.fact),
          evidenceStatus,
          temporal,
          uncertaintyNote,
          conflictGroup: m.conflictGroup,
          language: lang,
          originalText: bestText.original,
          isTranslated: Boolean(bestText.original),
          sortKey: claimSortKey(m.start, m.end),
          sources: dedupeClaimSources(
            m.members.map((member) => ({
              sourceKey: member.sourceId,
              excerpt: member.fact.supporting_excerpt,
              excerptLanguage: languageOrUnknown(sourceInfo.get(member.sourceId)?.page_language),
              excerptVerified: true,
            })),
          ),
        } satisfies DraftClaim,
      };
    })
    .sort((a, b) => a.claim.category.localeCompare(b.claim.category) || b.claim.sortKey.localeCompare(a.claim.sortKey))
    .forEach(({ claim }, i) => claims.push({ ...claim, tempId: `C${i + 1}` }));

  // 3. Contacts.
  const contactsByKey = new Map<string, DraftContact & { rank: number }>();
  for (const extraction of input.extractions) {
    for (const c of extraction.contacts) {
      const key = c.source_id;
      if (!docs.has(key) || !analysed.has(key)) {
        reject("contact", "unknown_source", null, c.contact_type);
        continue;
      }
      const doc = docs.get(key)!;
      const domain = registrableDomain(doc.url);
      const linked = about.get(key) === "yes" || (domain !== null && employerDomains.has(domain) && c.belongs_to !== "person");
      if (!linked) {
        reject("contact", "identity_not_confirmed", key, c.contact_type);
        continue;
      }
      if (!excerptAppearsIn(c.supporting_excerpt, textOf(key))) {
        reject("contact", "excerpt_not_found", key, c.contact_type);
        continue;
      }
      const info = sourceInfo.get(key);
      const decision = classifyContact({
        type: c.contact_type,
        belongsTo: c.belongs_to,
        value: c.value,
        publicationContext: c.publication_context,
        supportingExcerpt: c.supporting_excerpt,
        sourceType: info?.source_type ?? "other",
        selfPublished: info?.self_published ?? false,
        valuePresentInSource: contactValueAppearsIn(c.value, textOf(key)),
      });
      if (!decision.accepted) {
        reject("contact", decision.reason, key, c.contact_type);
        continue;
      }
      const normalised = normaliseContactValue(decision.type, c.value);
      const ckey = contactKey(decision.type, normalised.normalised, c.value);
      const rank = RELIABILITY_RANK[reliabilityOf(key)];
      const existing = contactsByKey.get(ckey);
      if (existing && existing.rank >= rank) continue;
      contactsByKey.set(ckey, {
        contactType: decision.type,
        value: normalised.display,
        normalisedValue: normalised.normalised,
        belongsTo: decision.belongsTo,
        ownerLabel: c.owner_label,
        purpose: c.purpose,
        publicationContext: c.publication_context,
        sourceKey: key,
        supportingExcerpt: c.supporting_excerpt,
        isDirect: decision.isDirect,
        note: decision.note,
        contactKey: ckey,
        rank,
      });
    }
  }
  const contactOrder: ContactType[] = ["work_email", "office_line", "business_mobile", "assistant", "switchboard", "press_office", "contact_page"];
  const contacts = [...contactsByKey.values()]
    .map(({ rank: _rank, ...c }) => c)
    .sort((a, b) => contactOrder.indexOf(a.contactType) - contactOrder.indexOf(b.contactType));

  // 4. Accounts.
  const accountsByUrl = new Map<string, DraftAccount>();
  for (const extraction of input.extractions) {
    for (const a of extraction.accounts) {
      const key = a.source_id;
      if (!docs.has(key) || !analysed.has(key)) {
        reject("account", "unknown_source", null, a.url);
        continue;
      }
      if (!/^https?:\/\//i.test(a.url)) {
        reject("account", "invalid_url", key, a.url);
        continue;
      }
      if (!excerptAppearsIn(a.supporting_excerpt, textOf(key))) {
        reject("account", "excerpt_not_found", key, a.url);
        continue;
      }
      const text = normaliseForMatch(textOf(key));
      const linkPresent = text.includes(normaliseForMatch(a.url.replace(/^https?:\/\//i, "").replace(/\/$/, "")));
      const aboutSource = about.get(key);
      let status: AccountStatus = "possible";
      let discovery = a.discovery;
      if (discovery.startsWith("linked_from_")) {
        if (aboutSource === "yes" && linkPresent) status = "accepted";
        else discovery = "search_result";
      } else if (discovery === "accessible_page" || discovery === "authorised_api") {
        if (aboutSource === "yes" && mentionsSubject(key)) status = "accepted";
      }
      const canonical = canonicaliseUrl(a.url);
      const platform = platformFromUrl(a.url) ?? a.platform;
      const evidenceText = `${a.identity_evidence}`.trim();
      const draft: DraftAccount = {
        platform,
        handle: a.handle ?? (platform === "website" ? hostnameOf(a.url) : handleFromUrl(a.url)),
        url: a.url,
        description: a.description,
        status,
        discovery,
        matchEvidence: [{ text: evidenceText || "Linked from a source about the subject.", sourceKey: key }],
        accessNote: isLoginWalled(a.url) ? "Profile page not accessed: the platform requires sign-in." : null,
        sourceKey: key,
        accountKey: `account|${canonical}`,
      };
      const existing = accountsByUrl.get(canonical);
      if (!existing) {
        accountsByUrl.set(canonical, draft);
      } else {
        const accepted = existing.status === "accepted" ? existing : draft.status === "accepted" ? draft : existing;
        accountsByUrl.set(canonical, {
          ...accepted,
          matchEvidence: [...existing.matchEvidence, ...draft.matchEvidence].filter(
            (e, i, all) => all.findIndex((x) => x.sourceKey === e.sourceKey && x.text === e.text) === i,
          ),
        });
      }
    }
  }
  const accounts = [...accountsByUrl.values()].sort(
    (a, b) => (a.status === b.status ? a.platform.localeCompare(b.platform) : a.status === "accepted" ? -1 : 1),
  );

  // 5. Relationships.
  const relationshipsByKey = new Map<string, DraftRelationship>();
  for (const extraction of input.extractions) {
    for (const r of extraction.relationships) {
      const key = r.source_id;
      if (!docs.has(key) || !analysed.has(key)) {
        reject("relationship", "unknown_source", null, r.counterpart_name);
        continue;
      }
      if (about.get(key) !== "yes") {
        reject("relationship", "identity_not_confirmed", key, r.counterpart_name);
        continue;
      }
      if (!excerptAppearsIn(r.supporting_excerpt, textOf(key))) {
        reject("relationship", "excerpt_not_found", key, r.counterpart_name);
        continue;
      }
      if (!queryMentionsName(textOf(key), r.counterpart_name)) {
        reject("relationship", "counterpart_not_in_source", key, r.counterpart_name);
        continue;
      }
      const kind: RelationshipKind = DOCUMENTED_RELATIONSHIP_TYPES.includes(r.relation_type) ? "documented" : "shared_affiliation";
      const rkey = `relationship|${r.relation_type}|${keyify(r.counterpart_name)}|${organisationKey(r.organisation)}`;
      const existing = relationshipsByKey.get(rkey);
      const source = { sourceKey: key, excerpt: r.supporting_excerpt, excerptVerified: true };
      if (existing) {
        if (!existing.sources.some((s) => s.sourceKey === key)) existing.sources.push(source);
        existing.start ??= parsePartialDate(r.start);
        existing.end ??= parsePartialDate(r.end);
        continue;
      }
      relationshipsByKey.set(rkey, {
        kind,
        relationType: r.relation_type,
        label: RELATIONSHIP_LABELS[r.relation_type],
        counterpartName: r.counterpart_name.trim(),
        counterpartRole: r.counterpart_role,
        organisationName: r.organisation,
        project: r.project,
        start: parsePartialDate(r.start),
        end: parsePartialDate(r.end),
        note:
          kind === "shared_affiliation"
            ? "Shared affiliation only: this does not establish a direct working or personal relationship."
            : null,
        relationshipKey: rkey,
        sources: [source],
      });
    }
  }
  const relationships = [...relationshipsByKey.values()].sort((a, b) =>
    a.kind === b.kind ? a.counterpartName.localeCompare(b.counterpartName) : a.kind === "documented" ? -1 : 1,
  );

  // 6. Media items and stories.
  const mediaDrafts: Omit<DraftMediaItem, "tempId" | "isPrimary" | "relevanceRank">[] = [];
  const seenMediaUrls = new Set<string>();
  for (const extraction of input.extractions) {
    for (const m of extraction.media) {
      const key = m.source_id;
      if (!docs.has(key) || !analysed.has(key)) {
        reject("media", "unknown_source", null, m.headline);
        continue;
      }
      const doc = docs.get(key)!;
      const aboutSource = about.get(key) ?? "unclear";
      let coverage: CoverageType = m.coverage_type;
      if (aboutSource === "no") {
        if (coverage !== "organisation") {
          reject("media", "different_person", key, m.headline);
          continue;
        }
      } else if (aboutSource === "unclear" && coverage === "direct") {
        coverage = "unresolved_same_name";
      }
      if (seenMediaUrls.has(doc.canonicalUrl)) continue;
      seenMediaUrls.add(doc.canonicalUrl);
      const published = dateInfo(m.published_date ?? sourceInfo.get(key)?.published_date);
      mediaDrafts.push({
        sourceKey: key,
        headline: m.headline.trim(),
        outlet: m.outlet.trim() || doc.publisher || registrableDomain(doc.url) || "Unknown outlet",
        url: doc.url,
        canonicalUrl: doc.canonicalUrl,
        kind: m.kind,
        publishedAt: published.date,
        publishedPrecision: published.precision,
        sourceUpdatedAt: dateInfo(sourceInfo.get(key)?.updated_date).date,
        providerReportedDate: published.date ? null : (doc.providerPublishedAt?.slice(0, 10) ?? null),
        eventDate: parsePartialDate(m.event_date),
        language: languageOrUnknown(m.language),
        summary: clip(m.summary, 600),
        summaryBasis: doc.accessStatus === "read" ? "full_text" : "snippet_only",
        involvement: m.involvement,
        coverageType: coverage,
        topic: m.topic,
        matchEvidence: m.identity_evidence || null,
        allegations: m.allegations
          ? {
              allegations: m.allegations.allegations.map((a) => ({ text: a.text, attributedTo: a.attributed_to })),
              responses: m.allegations.responses.map((a) => ({ text: a.text, attributedTo: a.attributed_to })),
              outcomes: m.allegations.outcomes.map((a) => ({ text: a.text, documentedBy: a.attributed_to })),
            }
          : null,
        mediaKey: `media|${doc.canonicalUrl}`,
      });
    }
  }
  const coverageRank: Record<CoverageType, number> = { direct: 0, organisation: 1, unresolved_same_name: 2 };
  const groups = groupStories(
    mediaDrafts.map((m) => ({
      key: m.sourceKey,
      canonicalUrl: m.canonicalUrl,
      headline: m.headline,
      language: m.language,
      publishedAt: m.publishedAt,
      text: textOf(m.sourceKey),
    })),
  );
  const draftByKey = new Map(mediaDrafts.map((m) => [m.sourceKey, m]));
  const storiesUnranked = groups.map((keys) => {
    const items = keys.map((k) => draftByKey.get(k)!);
    const ordered = [...items].sort((a, b) => {
      const ad = a.publishedAt ?? "9999";
      const bd = b.publishedAt ?? "9999";
      if (ad !== bd) return ad.localeCompare(bd);
      if (a.summaryBasis !== b.summaryBasis) return a.summaryBasis === "full_text" ? -1 : 1;
      return a.sourceKey.localeCompare(b.sourceKey);
    });
    const primary = ordered[0];
    const coverageType = items.reduce<CoverageType>(
      (best, i) => (coverageRank[i.coverageType] < coverageRank[best] ? i.coverageType : best),
      "unresolved_same_name",
    );
    return {
      storyKey: `story|${keyify(primary.headline).slice(0, 80)}|${primary.publishedAt ?? "undated"}`,
      headline: primary.headline,
      coverageType,
      topic: primary.topic,
      firstPublishedAt: ordered.map((i) => i.publishedAt).find(Boolean) ?? null,
      items: ordered.map((i, idx) => ({ ...i, isPrimary: idx === 0 })),
    };
  });
  storiesUnranked.sort(
    (a, b) =>
      coverageRank[a.coverageType] - coverageRank[b.coverageType] ||
      (b.firstPublishedAt ?? "").localeCompare(a.firstPublishedAt ?? ""),
  );
  let mediaCounter = 0;
  const stories: DraftStory[] = storiesUnranked.map((s, rank) => ({
    ...s,
    relevanceRank: rank,
    items: s.items.map((i) => ({ ...i, tempId: `M${++mediaCounter}`, relevanceRank: rank })),
  }));

  // 7. Organisations.
  const orgs = new Map<string, DraftOrganisation>();
  const addOrg = (name: string | null | undefined, kind: DraftOrganisation["kind"]) => {
    if (!name?.trim()) return;
    const normalisedName = organisationKey(name);
    if (!normalisedName || orgs.has(normalisedName)) return;
    orgs.set(normalisedName, { name: name.trim(), normalisedName, kind });
  };
  for (const c of claims) {
    if (c.value.kind === "employment") addOrg(c.value.organisation, "company");
    if (c.value.kind === "affiliation") addOrg(c.value.organisation, /board|foundation|council|fond|şura|совет/i.test(`${c.value.organisation} ${c.value.role ?? ""}`) ? "board" : "company");
    if (c.value.kind === "education") addOrg(c.value.institution, "institution");
  }
  for (const r of relationships) addOrg(r.organisationName, r.relationType === "fellow_director" || r.relationType === "shared_board" ? "board" : "company");

  // 8. Headline.
  const headlinePick = pickHeadlineRole(claims.map((c) => ({ id: c.tempId, category: c.category, value: c.value, evidenceStatus: c.evidenceStatus, temporal: c.temporal })));
  const roleClaim = headlinePick ? claims.find((c) => c.tempId === headlinePick.claim.id)! : null;
  const locationClaim =
    claims
      .filter((c) => c.category === "location")
      .sort((a, b) => Number(b.evidenceStatus === "official_source") - Number(a.evidenceStatus === "official_source"))[0] ?? null;
  const headline: DraftHeadline = {
    roleClaimTempId: roleClaim?.tempId ?? null,
    role: roleClaim && roleClaim.value.kind === "employment" ? (roleClaim.value.title ?? null) : null,
    organisation: roleClaim && roleClaim.value.kind === "employment" ? roleClaim.value.organisation : null,
    roleConfirmedCurrent: headlinePick?.confirmedCurrent ?? false,
    locationClaimTempId: locationClaim?.tempId ?? null,
    location: locationClaim && locationClaim.value.kind === "location" ? locationClaim.value.place : null,
  };

  // 9. Sources (everything retrieved, with what happened to it).
  const notAnalysedReason = new Map(input.notAnalysed.map((n) => [n.key, n.reason]));
  const sources: DraftSource[] = input.documents.map((doc) => {
    const info = sourceInfo.get(doc.key);
    const aboutValue = about.get(doc.key) ?? "unclear";
    const published = dateInfo(info?.published_date);
    const notes = [doc.accessNote, aboutNote.get(doc.key)];
    const reason = notAnalysedReason.get(doc.key);
    if (!info) {
      notes.push(
        reason === "budget"
          ? "Retrieved but not analysed: the research budget was reached."
          : reason === "analysis_failed"
            ? "Retrieved but not analysed: the analysis step failed for this batch."
            : "Retrieved but not analysed.",
      );
    }
    return {
      key: doc.key,
      url: doc.url,
      canonicalUrl: doc.canonicalUrl,
      title: doc.title,
      publisher: doc.publisher,
      sourceType: info?.source_type ?? "other",
      reliability: info ? reliabilityFor(info.source_type, info.self_published) : "unknown",
      language: languageOrUnknown(info?.page_language),
      publishedAt: published.date,
      publishedPrecision: published.precision,
      sourceUpdatedAt: dateInfo(info?.updated_date).date,
      providerReportedDate: doc.providerPublishedAt?.slice(0, 10) ?? null,
      accessedAt: doc.fetchedAt,
      accessMethod: doc.accessMethod,
      accessStatus: doc.accessStatus,
      accessNote: notes.filter(Boolean).join(" ") || null,
      aboutSubject: aboutValue,
      identityEvidence: info?.identity_evidence ?? null,
      // Short preview only, and none for documents about other people.
      excerpt: aboutValue === "no" ? null : clip(doc.snippet || textOf(doc.key), 280),
      fixtureKey: doc.fixtureKey,
      syndicationGroup: syndication.get(doc.key) ?? null,
    };
  });

  // 10. Access limitations.
  const accessLimitations: AccessLimitation[] = [
    ...input.documents
      .filter((d) => d.accessStatus !== "read")
      .map((d) => ({
        domain: registrableDomain(d.url) ?? d.url,
        url: d.url,
        status: d.accessStatus,
        note:
          d.accessNote ??
          (d.accessStatus === "login_required"
            ? "Requires sign-in; not accessed."
            : d.accessStatus === "paywalled"
              ? "Paywalled; only the search snippet was used."
              : "Only the search snippet was available."),
      })),
    ...input.blocked.map((b) => ({ domain: registrableDomain(b.url) ?? b.url, url: null, status: "blocked" as AccessStatus, note: b.reason })),
  ];

  // 11. Gaps (deterministic; neutral wording — missing information is not a negative finding).
  const gaps: InformationGap[] = [];
  if (!claims.some((c) => c.category === "education")) gaps.push({ code: "no_education", text: "No published education history was found." });
  if (contacts.length === 0) gaps.push({ code: "no_contacts", text: "No public business contact found." });
  if (!accounts.some((a) => a.status === "accepted")) gaps.push({ code: "no_accounts", text: "No public social account could be confirmed from an official or self-published link." });
  if (!relationships.some((r) => r.kind === "documented")) gaps.push({ code: "no_connections", text: "No documented professional relationships were found." });
  if (!stories.some((s) => s.coverageType === "direct")) gaps.push({ code: "no_direct_news", text: "No news coverage directly about this person was found." });
  if (!headline.roleClaimTempId) gaps.push({ code: "no_role", text: "No professional role could be evidenced." });
  else if (!headline.roleConfirmedCurrent) gaps.push({ code: "role_not_current", text: "No recent source confirms the latest role as current." });
  for (const c of input.coverage) {
    if (c.status === "failed") gaps.push({ code: `search_failed_${c.category}`, text: `The ${c.category} search did not complete${c.note ? ` (${c.note})` : ""}; this section may be incomplete.` });
  }
  if (input.notAnalysed.some((n) => n.reason === "budget")) {
    gaps.push({ code: "budget_limited", text: "Some retrieved sources were not analysed because the research budget was reached." });
  }

  return {
    sources,
    claims,
    contacts,
    accounts,
    relationships,
    organisations: [...orgs.values()],
    stories,
    headline,
    gaps,
    coverage: input.coverage,
    accessLimitations,
    rejected,
    stats: { analysedSources: sourceInfo.size, notAnalysedSources: input.documents.length - sourceInfo.size, rejectedItems: rejected.length },
  };
}

function dedupeClaimSources(sources: DraftClaimSource[]): DraftClaimSource[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    if (seen.has(s.sourceKey)) return false;
    seen.add(s.sourceKey);
    return true;
  });
}

export { normaliseTitle };
