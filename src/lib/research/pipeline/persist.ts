import { and, eq, sql } from "drizzle-orm";
import {
  claimSources,
  claims,
  contacts,
  jobDocuments,
  mediaItems,
  mediaStoryGroups,
  organisations,
  profiles,
  relationshipSources,
  relationships,
  snapshots,
  socialAccounts,
  sources,
  type JobUsageSummary,
  type SnapshotIdentity,
} from "@/lib/db/schema";
import type { ModelInfo, SnapshotOverview, Workspace } from "@/lib/domain/types";
import { finishJob, markStepFinished, withFence, type JobRow } from "@/lib/jobs/store";
import type { Database } from "@/lib/db/client";
import type { DraftSnapshot } from "./assemble";

export type PersistInput = {
  db: Database;
  job: JobRow;
  token: number;
  workspace: Workspace;
  identity: SnapshotIdentity;
  draft: DraftSnapshot;
  overview: SnapshotOverview;
  modelInfo: ModelInfo;
  usage: JobUsageSummary;
  status: "completed" | "partial";
  researchedAt: Date;
  fixturePersonKey: string | null;
  retentionDays: number;
  /** Step checkpoint written in the same transaction as the snapshot. */
  stepStartedAt: number;
};

/** Replace temporary IDs (C1, M1…) in the overview with database IDs. */
function mapOverview(overview: SnapshotOverview, claimIds: Map<string, string>, mediaIds: Map<string, string>): SnapshotOverview {
  const c = (ids: string[]) => ids.map((id) => claimIds.get(id)).filter((x): x is string => Boolean(x));
  const m = (ids: string[]) => ids.map((id) => mediaIds.get(id)).filter((x): x is string => Boolean(x));
  return {
    ...overview,
    summary: overview.summary.map((s) => ({ ...s, claimIds: c(s.claimIds), mediaIds: m(s.mediaIds) })),
    keyDevelopments: overview.keyDevelopments.map((k) => ({ ...k, claimIds: c(k.claimIds), mediaIds: m(k.mediaIds) })),
    questions: overview.questions.map((q) => ({ ...q, claimIds: c(q.claimIds), mediaIds: m(q.mediaIds) })),
  };
}

/**
 * Writes the snapshot and finishes the job in ONE fenced transaction, so a
 * cancelled or superseded worker can never publish results, and a crash
 * cannot leave a half-written snapshot. Idempotent per job.
 */
export async function persistSnapshot(input: PersistInput): Promise<{ profileId: string; snapshotId: string; version: number }> {
  const { db, job, token, draft } = input;
  return withFence(db, job.id, token, async (tx) => {
    const [existingSnapshot] = await tx.select().from(snapshots).where(eq(snapshots.jobId, job.id));
    if (existingSnapshot) {
      const result = { profileId: existingSnapshot.profileId, snapshotId: existingSnapshot.id, version: existingSnapshot.version };
      await markStepFinished(tx, { jobId: job.id, name: "persist", status: "completed", output: result, durationMs: Date.now() - input.stepStartedAt });
      await finishJob(tx, job.id, { status: input.status, outcome: "profile", snapshotId: existingSnapshot.id, profileId: existingSnapshot.profileId, usage: input.usage });
      return result;
    }

    // Profile: the refresh target, or an existing profile with the same identity anchor, or a new one.
    let profileId = job.profileId;
    if (!profileId) {
      const [byAnchor] = await tx
        .select({ id: profiles.id })
        .from(profiles)
        .where(and(eq(profiles.ownerId, job.ownerId), eq(profiles.workspace, input.workspace), eq(profiles.anchorKey, input.identity.anchorKey)));
      profileId = byAnchor?.id ?? null;
    }
    if (!profileId) {
      const [created] = await tx
        .insert(profiles)
        .values({
          ownerId: job.ownerId,
          workspace: input.workspace,
          displayName: input.identity.displayName,
          nativeName: input.identity.nativeName,
          nameVariants: input.identity.nameVariants,
          anchorKey: input.identity.anchorKey,
          anchorUrls: input.identity.anchorUrls,
          fixturePersonKey: input.fixturePersonKey,
        })
        .onConflictDoNothing({ target: [profiles.ownerId, profiles.workspace, profiles.anchorKey] })
        .returning({ id: profiles.id });
      if (created) {
        profileId = created.id;
      } else {
        const [raced] = await tx
          .select({ id: profiles.id })
          .from(profiles)
          .where(and(eq(profiles.ownerId, job.ownerId), eq(profiles.workspace, input.workspace), eq(profiles.anchorKey, input.identity.anchorKey)));
        profileId = raced.id;
      }
    }
    const locked = await tx.execute<{ snapshot_count: number }>(
      sql`SELECT snapshot_count FROM profiles WHERE id = ${profileId} AND owner_id = ${job.ownerId} FOR UPDATE`,
    );
    if (locked.rows.length === 0) throw new Error("Profile disappeared or belongs to another owner.");
    const version = Number(locked.rows[0].snapshot_count) + 1;

    const [snapshot] = await tx
      .insert(snapshots)
      .values({
        profileId,
        ownerId: job.ownerId,
        workspace: input.workspace,
        jobId: job.id,
        version,
        status: input.status === "completed" ? "complete" : "partial",
        researchedAt: input.researchedAt,
        identity: input.identity,
        headline: {
          role: draft.headline.role,
          roleClaimId: null,
          organisation: draft.headline.organisation,
          organisationClaimId: null,
          location: draft.headline.location,
          locationClaimId: null,
        },
        overview: input.overview,
        coverage: draft.coverage,
        accessLimitations: draft.accessLimitations,
        modelInfo: input.modelInfo,
        usage: input.usage,
        counts: {
          sources: draft.sources.length,
          claims: draft.claims.length,
          media: draft.stories.reduce((n, s) => n + s.items.length, 0),
          stories: draft.stories.length,
          contacts: draft.contacts.length,
          accounts: draft.accounts.length,
          relationships: draft.relationships.length,
        },
        diagnostics: { rejected: draft.rejected, stats: draft.stats },
      })
      .returning({ id: snapshots.id });

    // Sources
    const sourceIds = new Map<string, string>();
    if (draft.sources.length > 0) {
      const inserted = await tx
        .insert(sources)
        .values(
          draft.sources.map((s) => ({
            snapshotId: snapshot.id,
            ownerId: job.ownerId,
            sourceKey: s.key,
            url: s.url,
            canonicalUrl: s.canonicalUrl,
            title: s.title,
            publisher: s.publisher,
            sourceType: s.sourceType,
            reliability: s.reliability,
            language: s.language,
            publishedAt: s.publishedAt,
            publishedPrecision: s.publishedPrecision,
            sourceUpdatedAt: s.sourceUpdatedAt,
            providerReportedDate: s.providerReportedDate,
            accessedAt: new Date(s.accessedAt),
            accessMethod: s.accessMethod,
            accessStatus: s.accessStatus,
            accessNote: s.accessNote,
            aboutSubject: s.aboutSubject,
            identityEvidence: s.identityEvidence,
            excerpt: s.excerpt,
            fixtureKey: s.fixtureKey,
          })),
        )
        .returning({ id: sources.id, key: sources.sourceKey });
      for (const row of inserted) sourceIds.set(row.key, row.id);
    }

    // Claims + evidence links
    const claimIds = new Map<string, string>();
    for (const c of draft.claims) {
      const [row] = await tx
        .insert(claims)
        .values({
          snapshotId: snapshot.id,
          ownerId: job.ownerId,
          claimKey: c.claimKey,
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
          accepted: true,
          sortKey: c.sortKey,
        })
        .returning({ id: claims.id });
      claimIds.set(c.tempId, row.id);
      const links = c.sources
        .map((s) => ({ s, sourceId: sourceIds.get(s.sourceKey) }))
        .filter((x): x is { s: (typeof c.sources)[number]; sourceId: string } => Boolean(x.sourceId));
      if (links.length > 0) {
        await tx.insert(claimSources).values(
          links.map(({ s, sourceId }) => ({
            claimId: row.id,
            sourceId,
            supportingExcerpt: s.excerpt,
            excerptLanguage: s.excerptLanguage,
            excerptVerified: s.excerptVerified,
          })),
        );
      }
    }

    // Contacts
    const lastChecked = input.researchedAt;
    const contactRows = draft.contacts
      .filter((c) => sourceIds.has(c.sourceKey))
      .map((c) => ({
        snapshotId: snapshot.id,
        ownerId: job.ownerId,
        contactType: c.contactType,
        value: c.value,
        normalisedValue: c.normalisedValue,
        belongsTo: c.belongsTo,
        ownerLabel: c.ownerLabel,
        purpose: c.purpose ?? c.note,
        publicationContext: c.note ? `${c.publicationContext} — ${c.note}` : c.publicationContext,
        sourceId: sourceIds.get(c.sourceKey)!,
        supportingExcerpt: c.supportingExcerpt,
        lastCheckedAt: lastChecked,
        isDirect: c.isDirect,
        contactKey: c.contactKey,
      }));
    if (contactRows.length > 0) await tx.insert(contacts).values(contactRows);

    // Accounts
    if (draft.accounts.length > 0) {
      await tx.insert(socialAccounts).values(
        draft.accounts.map((a) => ({
          snapshotId: snapshot.id,
          ownerId: job.ownerId,
          platform: a.platform,
          handle: a.handle,
          url: a.url,
          description: a.description,
          status: a.status,
          discovery: a.discovery,
          matchEvidence: a.matchEvidence.map((e) => ({ text: e.text, sourceId: e.sourceKey ? (sourceIds.get(e.sourceKey) ?? null) : null })),
          accessNote: a.accessNote,
          sourceId: a.sourceKey ? (sourceIds.get(a.sourceKey) ?? null) : null,
          accountKey: a.accountKey,
        })),
      );
    }

    // Organisations
    const orgIds = new Map<string, string>();
    if (draft.organisations.length > 0) {
      const inserted = await tx
        .insert(organisations)
        .values(draft.organisations.map((o) => ({ snapshotId: snapshot.id, ownerId: job.ownerId, name: o.name, normalisedName: o.normalisedName, kind: o.kind })))
        .returning({ id: organisations.id, key: organisations.normalisedName });
      for (const row of inserted) orgIds.set(row.key, row.id);
    }

    // Relationships
    for (const r of draft.relationships) {
      const orgName = r.organisationName?.trim() ?? null;
      const orgKey = orgName ? draft.organisations.find((o) => o.name === orgName)?.normalisedName : undefined;
      const [row] = await tx
        .insert(relationships)
        .values({
          snapshotId: snapshot.id,
          ownerId: job.ownerId,
          kind: r.kind,
          relationType: r.relationType,
          label: r.label,
          counterpartName: r.counterpartName,
          counterpartRole: r.counterpartRole,
          organisationId: orgKey ? (orgIds.get(orgKey) ?? null) : null,
          organisationName: r.organisationName,
          project: r.project,
          start: r.start,
          end: r.end,
          note: r.note,
          relationshipKey: r.relationshipKey,
        })
        .returning({ id: relationships.id });
      const links = r.sources.filter((s) => sourceIds.has(s.sourceKey));
      if (links.length > 0) {
        await tx.insert(relationshipSources).values(
          links.map((s) => ({ relationshipId: row.id, sourceId: sourceIds.get(s.sourceKey)!, supportingExcerpt: s.excerpt, excerptVerified: s.excerptVerified })),
        );
      }
    }

    // Stories and media items
    const mediaIds = new Map<string, string>();
    for (const story of draft.stories) {
      const [group] = await tx
        .insert(mediaStoryGroups)
        .values({
          snapshotId: snapshot.id,
          ownerId: job.ownerId,
          storyKey: story.storyKey,
          headline: story.headline,
          coverageType: story.coverageType,
          topic: story.topic,
          firstPublishedAt: story.firstPublishedAt,
          itemCount: story.items.length,
          relevanceRank: story.relevanceRank,
        })
        .onConflictDoNothing()
        .returning({ id: mediaStoryGroups.id });
      if (!group) continue;
      for (const item of story.items) {
        const [row] = await tx
          .insert(mediaItems)
          .values({
            snapshotId: snapshot.id,
            ownerId: job.ownerId,
            storyGroupId: group.id,
            isPrimary: item.isPrimary,
            sourceId: sourceIds.get(item.sourceKey) ?? null,
            headline: item.headline,
            outlet: item.outlet,
            url: item.url,
            canonicalUrl: item.canonicalUrl,
            kind: item.kind,
            publishedAt: item.publishedAt,
            publishedPrecision: item.publishedPrecision,
            sourceUpdatedAt: item.sourceUpdatedAt,
            providerReportedDate: item.providerReportedDate,
            eventDate: item.eventDate,
            discoveredAt: input.researchedAt,
            language: item.language,
            summary: item.summary,
            summaryBasis: item.summaryBasis,
            involvement: item.involvement,
            coverageType: item.coverageType,
            topic: item.topic,
            matchEvidence: item.matchEvidence,
            allegations: item.allegations,
            relevanceRank: item.relevanceRank,
            mediaKey: item.mediaKey,
          })
          .returning({ id: mediaItems.id });
        mediaIds.set(item.tempId, row.id);
      }
    }

    const overview = mapOverview(input.overview, claimIds, mediaIds);
    await tx
      .update(snapshots)
      .set({
        overview,
        headline: {
          role: draft.headline.role,
          roleClaimId: draft.headline.roleClaimTempId ? (claimIds.get(draft.headline.roleClaimTempId) ?? null) : null,
          organisation: draft.headline.organisation,
          organisationClaimId: draft.headline.roleClaimTempId ? (claimIds.get(draft.headline.roleClaimTempId) ?? null) : null,
          location: draft.headline.location,
          locationClaimId: draft.headline.locationClaimTempId ? (claimIds.get(draft.headline.locationClaimTempId) ?? null) : null,
        },
      })
      .where(eq(snapshots.id, snapshot.id));

    await tx
      .update(profiles)
      .set({
        displayName: input.identity.displayName,
        nativeName: input.identity.nativeName,
        nameVariants: input.identity.nameVariants,
        headlineRole: draft.headline.role,
        headlineOrganisation: draft.headline.organisation,
        headlineLocation: draft.headline.location,
        latestSnapshotId: snapshot.id,
        snapshotCount: version,
        lastResearchedAt: input.researchedAt,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, profileId));

    const result = { profileId, snapshotId: snapshot.id, version };
    await markStepFinished(tx, { jobId: job.id, name: "persist", status: "completed", output: result, durationMs: Date.now() - input.stepStartedAt });
    await finishJob(tx, job.id, { status: input.status, outcome: "profile", snapshotId: snapshot.id, profileId, usage: input.usage });
    await tx
      .update(jobDocuments)
      .set({ expiresAt: sql`now() + make_interval(days => ${Math.max(0, input.retentionDays)})` })
      .where(eq(jobDocuments.jobId, job.id));
    return result;
  });
}
