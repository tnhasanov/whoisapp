import "server-only";
import type { JobListItem, JobView } from "@/lib/data/jobs";
import type { ProfileListItem as ProfileRow, ProfileView } from "@/lib/data/profiles";
import type { ProfileChanges } from "@/lib/data/changes";
import { ACTIVE_JOB_STATUSES, type Workspace } from "@/lib/domain/types";
import type {
  ChangesResponse,
  JobDetail,
  JobSummary,
  ProfileDetail,
  ProfileListItem,
} from "@personbrief/shared/api/v1";

/**
 * Database/view rows → /api/v1 shapes. Explicit field-by-field mapping keeps
 * internal columns (cache keys, diagnostics, canonical URLs, owner ids) out of
 * responses, and turns every timestamp into a UTC ISO string.
 */

const iso = (value: Date | string | null | undefined): string | null => (value ? new Date(value).toISOString() : null);

/** Running: poll quickly; queued: a little slower; finished or waiting for the owner: stop. */
function pollAfter(status: JobSummary["status"]): number | null {
  if (status === "running") return 2000;
  if ((ACTIVE_JOB_STATUSES as readonly string[]).includes(status)) return 3000;
  return null;
}

export function toJobSummary(job: JobListItem & { query?: JobView["query"] }): JobSummary {
  return {
    id: job.id,
    workspace: job.workspace,
    kind: job.kind,
    status: job.status,
    outcome: job.outcome,
    query: job.query ?? { fullName: job.fullName, company: job.company, country: null, profileUrl: null },
    profileId: job.profileId,
    createdAt: iso(job.createdAt)!,
    finishedAt: iso(job.finishedAt),
  };
}

export function toJobDetail(view: JobView): JobDetail {
  return {
    id: view.id,
    workspace: view.workspace,
    kind: view.kind,
    status: view.status,
    outcome: view.outcome,
    query: view.query,
    profileId: view.profileId,
    createdAt: iso(view.createdAt)!,
    finishedAt: iso(view.finishedAt),
    phase: view.phase,
    currentStage: view.currentStage,
    snapshotId: view.snapshotId,
    parentJobId: view.parentJobId,
    retriedById: view.retriedById,
    identityResolution: view.identityResolution,
    selectedCandidateId: view.selectedCandidateId,
    error: view.errorCode || view.errorMessage ? { code: view.errorCode ?? "error", message: view.errorMessage ?? "" } : null,
    cancelRequested: view.cancelRequested,
    startedAt: iso(view.startedAt),
    lastProgressAt: iso(view.lastProgressAt),
    stages: view.stages,
    events: view.events
      // Debug-level events are diagnostics, not progress.
      .filter((e) => e.level !== "debug")
      .map((e) => ({ id: e.id, at: iso(e.at)!, level: e.level, stage: e.stage, code: e.code, message: e.message, data: e.data })),
    sources: view.sources,
    candidates: view.candidates.map((c) => ({
      id: c.id,
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
      sources: c.sourceRefs.map((s) => ({ key: s.key, url: s.url, title: s.title, publisher: s.publisher, fixtureKey: s.fixtureKey ?? null })),
      autoSelected: c.autoSelected,
    })),
    usage: view.usage,
    worker: { online: view.workerOnline, heartbeatAgeSeconds: view.heartbeatAgeSeconds, queuedSeconds: view.queuedSeconds },
    pollAfterMs: pollAfter(view.status),
  };
}

export function toProfileListItem(row: ProfileRow, workspace: Workspace): ProfileListItem {
  return {
    id: row.id,
    workspace,
    displayName: row.displayName,
    nativeName: row.nativeName,
    headline: { role: row.headlineRole, organisation: row.headlineOrganisation, location: row.headlineLocation },
    savedAt: iso(row.savedAt),
    lastResearchedAt: iso(row.lastResearchedAt),
    snapshotCount: row.snapshotCount,
    latestStatus: row.latestStatus,
    sourceCount: row.sourceCount,
    tags: row.tags,
  };
}

export function toProfileDetail(view: ProfileView): ProfileDetail {
  const { profile, snapshot } = view;
  const fixtureKeyOf = new Map(view.sources.map((s) => [s.id, s.fixtureKey]));
  return {
    profile: {
      id: profile.id,
      workspace: profile.workspace,
      displayName: profile.displayName,
      nativeName: profile.nativeName,
      nameVariants: profile.nameVariants,
      savedAt: iso(profile.savedAt),
      lastResearchedAt: iso(profile.lastResearchedAt),
      snapshotCount: profile.snapshotCount,
    },
    snapshot: {
      id: snapshot.id,
      version: snapshot.version,
      status: snapshot.status,
      researchedAt: iso(snapshot.researchedAt)!,
      jobId: snapshot.jobId,
      identity: {
        displayName: snapshot.identity.displayName,
        nativeName: snapshot.identity.nativeName,
        nameVariants: snapshot.identity.nameVariants,
        organisation: snapshot.identity.organisation,
        role: snapshot.identity.role,
        resolution: snapshot.identity.resolution,
      },
      headline: snapshot.headline,
      model: snapshot.modelInfo,
      counts: snapshot.counts,
      coverage: snapshot.coverage,
      accessLimitations: snapshot.accessLimitations,
      rejectedCount: snapshot.diagnostics?.rejected?.length ?? 0,
    },
    snapshots: view.snapshots.map((s) => ({ id: s.id, version: s.version, status: s.status as "complete" | "partial", researchedAt: iso(s.researchedAt)! })),
    overview: snapshot.overview,
    claims: view.claims.map((c) => ({
      id: c.id,
      category: c.category,
      value: c.value,
      displayValue: c.displayValue,
      evidenceStatus: c.evidenceStatus,
      temporal: c.temporal,
      uncertaintyNote: c.uncertaintyNote,
      conflictGroup: c.conflictGroup,
      language: c.language,
      originalText: c.originalText,
      isTranslated: c.isTranslated,
      evidence: c.evidence.map((e) => ({ sourceId: e.sourceId, excerpt: e.excerpt, excerptLanguage: e.excerptLanguage, verified: e.verified, stance: e.stance })),
    })),
    contacts: view.contacts.map((c) => ({
      id: c.id,
      contactType: c.contactType,
      value: c.value,
      normalisedValue: c.normalisedValue,
      belongsTo: c.belongsTo,
      ownerLabel: c.ownerLabel,
      purpose: c.purpose,
      publicationContext: c.publicationContext,
      sourceId: c.sourceId,
      supportingExcerpt: c.supportingExcerpt,
      lastCheckedAt: iso(c.lastCheckedAt)!,
      isDirect: c.isDirect,
    })),
    accounts: view.accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      handle: a.handle,
      url: a.url,
      description: a.description,
      status: a.status,
      discovery: a.discovery,
      matchEvidence: a.matchEvidence,
      accessNote: a.accessNote,
      sourceId: a.sourceId,
    })),
    relationships: view.relationships.map((r) => ({
      id: r.id,
      kind: r.kind,
      relationType: r.relationType,
      label: r.label,
      counterpartName: r.counterpartName,
      counterpartRole: r.counterpartRole,
      organisationName: r.organisationName,
      project: r.project,
      start: r.start,
      end: r.end,
      note: r.note,
      evidence: r.evidence,
    })),
    organisations: view.organisations.map((o) => ({ id: o.id, name: o.name, kind: o.kind })),
    stories: view.stories.map((s) => ({
      id: s.id,
      headline: s.headline,
      coverageType: s.coverageType,
      topic: s.topic,
      firstPublishedAt: s.firstPublishedAt,
      itemCount: s.itemCount,
      items: s.items.map((i) => ({
        id: i.id,
        isPrimary: i.isPrimary,
        sourceId: i.sourceId,
        headline: i.headline,
        outlet: i.outlet,
        url: i.url,
        kind: i.kind,
        publishedAt: i.publishedAt,
        sourceUpdatedAt: i.sourceUpdatedAt,
        providerReportedDate: i.providerReportedDate,
        eventDate: i.eventDate,
        discoveredAt: iso(i.discoveredAt)!,
        language: i.language,
        summary: i.summary,
        summaryBasis: i.summaryBasis,
        involvement: i.involvement,
        coverageType: i.coverageType,
        topic: i.topic,
        matchEvidence: i.matchEvidence,
        allegations: i.allegations,
        fixtureKey: (i.sourceId && fixtureKeyOf.get(i.sourceId)) || null,
      })),
    })),
    sources: view.sources.map((s) => ({
      id: s.id,
      key: s.sourceKey,
      url: s.url,
      title: s.title,
      publisher: s.publisher,
      sourceType: s.sourceType,
      reliability: s.reliability,
      language: s.language,
      publishedAt: s.publishedAt,
      sourceUpdatedAt: s.sourceUpdatedAt,
      providerReportedDate: s.providerReportedDate,
      accessedAt: iso(s.accessedAt)!,
      accessMethod: s.accessMethod,
      accessStatus: s.accessStatus,
      accessNote: s.accessNote,
      aboutSubject: s.aboutSubject,
      identityEvidence: s.identityEvidence,
      excerpt: s.excerpt,
      fixtureKey: s.fixtureKey,
    })),
    notes: view.notes,
    tags: view.tags,
    availableTags: view.allTags,
  };
}

export function toChanges(changes: ProfileChanges): ChangesResponse {
  const ref = (s: { id: string; version: number; researchedAt: Date; status: string }) => ({
    id: s.id,
    version: s.version,
    researchedAt: s.researchedAt.toISOString(),
    status: s.status as "complete" | "partial",
  });
  return {
    snapshots: changes.snapshots.map(ref),
    fromSnapshotId: changes.from?.id ?? null,
    toSnapshotId: changes.to?.id ?? null,
    diff: changes.diff,
  };
}
