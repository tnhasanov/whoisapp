import type { ProfileView } from "@/lib/data/profiles";
import { partialDateToString } from "@/lib/dates/partial-date";

export const JSON_EXPORT_SCHEMA = "personbrief.export/v1";

/**
 * Machine-readable export with evidence and timestamps. Dates keep their
 * source precision ("2014" stays "2014"); timestamps are ISO-8601 UTC.
 * Private notes are included only when explicitly requested.
 */
export function buildJsonExport(view: ProfileView, options: { includeNotes: boolean; generatedAt: Date }) {
  const { profile, snapshot } = view;
  const fictional = profile.workspace === "demo";
  const sourceKey = new Map(view.sources.map((s) => [s.id, s.sourceKey]));
  const ref = (id: string | null | undefined) => (id ? (sourceKey.get(id) ?? null) : null);
  return {
    schema: JSON_EXPORT_SCHEMA,
    generatedAt: options.generatedAt.toISOString(),
    workspace: profile.workspace,
    fictionalDemoData: fictional,
    notice: fictional
      ? "FICTIONAL DEMO DATA. Every person, organisation, source and contact in this file is invented."
      : "Research assistance from public sources. Not a background check; coverage is not exhaustive; official sources are not independent verification. Confirm important details directly.",
    profile: {
      id: profile.id,
      displayName: profile.displayName,
      nativeName: profile.nativeName,
      nameVariants: profile.nameVariants,
      savedAt: profile.savedAt?.toISOString() ?? null,
      createdAt: profile.createdAt.toISOString(),
    },
    snapshot: {
      id: snapshot.id,
      version: snapshot.version,
      totalVersions: view.snapshots.length,
      status: snapshot.status,
      researchedAt: snapshot.researchedAt.toISOString(),
      identity: snapshot.identity,
      headline: snapshot.headline,
      overview: snapshot.overview,
      coverage: snapshot.coverage,
      accessLimitations: snapshot.accessLimitations,
      model: snapshot.modelInfo,
      usage: snapshot.usage,
    },
    claims: view.claims.map((c) => ({
      id: c.id,
      category: c.category,
      value: c.value,
      displayValue: c.displayValue,
      evidenceStatus: c.evidenceStatus,
      period: { start: partialDateToString(c.temporal.start), end: partialDateToString(c.temporal.end) },
      currency: c.temporal.currency,
      statedCurrentAsOf: c.temporal.asOf,
      possiblyOutdated: c.temporal.possiblyOutdated,
      uncertaintyNote: c.uncertaintyNote,
      conflictGroup: c.conflictGroup,
      language: c.language,
      isTranslated: c.isTranslated,
      originalText: c.originalText,
      evidence: c.evidence.map((e) => ({ source: ref(e.sourceId), excerpt: e.excerpt, excerptLanguage: e.excerptLanguage, excerptVerified: e.verified })),
    })),
    contacts: view.contacts.map((c) => ({
      type: c.contactType,
      value: c.value,
      normalisedValue: c.normalisedValue,
      belongsTo: c.belongsTo,
      isDirect: c.isDirect,
      ownerLabel: c.ownerLabel,
      purpose: c.purpose,
      publicationContext: c.publicationContext,
      source: ref(c.sourceId),
      supportingExcerpt: c.supportingExcerpt,
      lastCheckedAt: c.lastCheckedAt.toISOString(),
      note: "Normalised formatting does not prove a number or address is current or working.",
    })),
    accounts: view.accounts.map((a) => ({
      platform: a.platform,
      handle: a.handle,
      url: a.url,
      status: a.status,
      discovery: a.discovery,
      description: a.description,
      accessNote: a.accessNote,
      matchEvidence: a.matchEvidence.map((m) => ({ text: m.text, source: ref(m.sourceId) })),
    })),
    relationships: view.relationships.map((r) => ({
      kind: r.kind,
      type: r.relationType,
      label: r.label,
      counterpartName: r.counterpartName,
      counterpartRole: r.counterpartRole,
      organisation: r.organisationName,
      project: r.project,
      start: partialDateToString(r.start),
      end: partialDateToString(r.end),
      note: r.note,
      evidence: r.evidence.map((e) => ({ source: ref(e.sourceId), excerpt: e.excerpt, excerptVerified: e.verified })),
    })),
    organisations: view.organisations.map((o) => ({ name: o.name, kind: o.kind })),
    media: view.stories.map((s) => ({
      storyKey: s.storyKey,
      headline: s.headline,
      coverageType: s.coverageType,
      topic: s.topic,
      firstPublishedAt: s.firstPublishedAt,
      copies: s.items.map((i) => ({
        primary: i.isPrimary,
        headline: i.headline,
        outlet: i.outlet,
        url: i.url,
        kind: i.kind,
        language: i.language,
        publishedAt: i.publishedAt,
        publishedPrecision: i.publishedPrecision,
        searchProviderReportedDate: i.providerReportedDate,
        eventDate: partialDateToString(i.eventDate),
        discoveredAt: i.discoveredAt.toISOString(),
        summary: i.summary,
        summaryBasis: i.summaryBasis,
        involvement: i.involvement,
        allegations: i.allegations,
        source: ref(i.sourceId),
      })),
    })),
    sources: view.sources.map((s) => ({
      ref: s.sourceKey,
      url: s.url,
      title: s.title,
      publisher: s.publisher,
      type: s.sourceType,
      reliability: s.reliability,
      language: s.language,
      publishedAt: s.publishedAt,
      publishedPrecision: s.publishedPrecision,
      searchProviderReportedDate: s.providerReportedDate,
      accessedAt: s.accessedAt.toISOString(),
      accessMethod: s.accessMethod,
      accessStatus: s.accessStatus,
      accessNote: s.accessNote,
      aboutSubject: s.aboutSubject,
      identityEvidence: s.identityEvidence,
      fictional: Boolean(s.fixtureKey),
    })),
    ...(options.includeNotes
      ? { privateNotes: view.notes.map((n) => ({ body: n.body, createdAt: n.createdAt, updatedAt: n.updatedAt })), tags: view.tags.map((t) => t.name) }
      : {}),
  };
}
