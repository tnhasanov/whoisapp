import { and, asc, desc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  claimSources,
  claims,
  contacts,
  exportLog,
  issueReports,
  mediaItems,
  mediaStoryGroups,
  notes,
  organisations,
  profileTags,
  profiles,
  providerCache,
  relationshipSources,
  relationships,
  researchJobs,
  snapshots,
  socialAccounts,
  sources,
  tags,
} from "@/lib/db/schema";
import type { IssueCategory, Workspace } from "@/lib/domain/types";
import { keyify } from "@/lib/research/text";

export type SourceView = typeof sources.$inferSelect;
export type ClaimView = typeof claims.$inferSelect & {
  evidence: { sourceId: string; excerpt: string; excerptLanguage: string; verified: boolean; stance: string }[];
};
export type ContactView = typeof contacts.$inferSelect;
export type AccountView = typeof socialAccounts.$inferSelect;
export type RelationshipView = typeof relationships.$inferSelect & { evidence: { sourceId: string; excerpt: string; verified: boolean }[] };
export type OrganisationView = typeof organisations.$inferSelect;
export type MediaItemView = typeof mediaItems.$inferSelect;
export type StoryView = typeof mediaStoryGroups.$inferSelect & { items: MediaItemView[] };
export type SnapshotRow = typeof snapshots.$inferSelect;
export type NoteView = { id: string; body: string; createdAt: string; updatedAt: string };
export type TagView = { id: string; name: string };

export type ProfileView = {
  profile: typeof profiles.$inferSelect;
  snapshot: SnapshotRow;
  snapshots: { id: string; version: number; researchedAt: string; status: string }[];
  sources: SourceView[];
  claims: ClaimView[];
  contacts: ContactView[];
  accounts: AccountView[];
  relationships: RelationshipView[];
  organisations: OrganisationView[];
  stories: StoryView[];
  notes: NoteView[];
  tags: TagView[];
  allTags: TagView[];
};

export async function loadSnapshotData(db: Database, ownerId: string, snapshotId: string) {
  const [srcs, claimRows, links, contactRows, accountRows, relRows, relLinks, orgRows, groups, items] = await Promise.all([
    db.select().from(sources).where(and(eq(sources.snapshotId, snapshotId), eq(sources.ownerId, ownerId))).orderBy(asc(sources.sourceKey)),
    db.select().from(claims).where(and(eq(claims.snapshotId, snapshotId), eq(claims.ownerId, ownerId), eq(claims.accepted, true))),
    db
      .select({ claimId: claimSources.claimId, sourceId: claimSources.sourceId, excerpt: claimSources.supportingExcerpt, excerptLanguage: claimSources.excerptLanguage, verified: claimSources.excerptVerified, stance: claimSources.stance })
      .from(claimSources)
      .innerJoin(claims, eq(claims.id, claimSources.claimId))
      .where(and(eq(claims.snapshotId, snapshotId), eq(claims.ownerId, ownerId))),
    db.select().from(contacts).where(and(eq(contacts.snapshotId, snapshotId), eq(contacts.ownerId, ownerId))),
    db.select().from(socialAccounts).where(and(eq(socialAccounts.snapshotId, snapshotId), eq(socialAccounts.ownerId, ownerId))),
    db.select().from(relationships).where(and(eq(relationships.snapshotId, snapshotId), eq(relationships.ownerId, ownerId))),
    db
      .select({ relationshipId: relationshipSources.relationshipId, sourceId: relationshipSources.sourceId, excerpt: relationshipSources.supportingExcerpt, verified: relationshipSources.excerptVerified })
      .from(relationshipSources)
      .innerJoin(relationships, eq(relationships.id, relationshipSources.relationshipId))
      .where(and(eq(relationships.snapshotId, snapshotId), eq(relationships.ownerId, ownerId))),
    db.select().from(organisations).where(and(eq(organisations.snapshotId, snapshotId), eq(organisations.ownerId, ownerId))),
    db.select().from(mediaStoryGroups).where(and(eq(mediaStoryGroups.snapshotId, snapshotId), eq(mediaStoryGroups.ownerId, ownerId))).orderBy(asc(mediaStoryGroups.relevanceRank)),
    db.select().from(mediaItems).where(and(eq(mediaItems.snapshotId, snapshotId), eq(mediaItems.ownerId, ownerId))),
  ]);
  // Source keys are "S1", "S2" … "S10": order them by number, not as text.
  srcs.sort((a, b) => Number(a.sourceKey.slice(1)) - Number(b.sourceKey.slice(1)) || a.sourceKey.localeCompare(b.sourceKey));
  const evidenceByClaim = new Map<string, ClaimView["evidence"]>();
  for (const l of links) {
    if (!evidenceByClaim.has(l.claimId)) evidenceByClaim.set(l.claimId, []);
    evidenceByClaim.get(l.claimId)!.push({ sourceId: l.sourceId, excerpt: l.excerpt, excerptLanguage: l.excerptLanguage, verified: l.verified, stance: l.stance });
  }
  const evidenceByRel = new Map<string, RelationshipView["evidence"]>();
  for (const l of relLinks) {
    if (!evidenceByRel.has(l.relationshipId)) evidenceByRel.set(l.relationshipId, []);
    evidenceByRel.get(l.relationshipId)!.push({ sourceId: l.sourceId, excerpt: l.excerpt, verified: l.verified });
  }
  const itemsByGroup = new Map<string, MediaItemView[]>();
  for (const i of items) {
    if (!itemsByGroup.has(i.storyGroupId)) itemsByGroup.set(i.storyGroupId, []);
    itemsByGroup.get(i.storyGroupId)!.push(i);
  }
  return {
    sources: srcs,
    claims: claimRows
      .map((c) => ({ ...c, evidence: evidenceByClaim.get(c.id) ?? [] }))
      .sort((a, b) => a.category.localeCompare(b.category) || (b.sortKey ?? "").localeCompare(a.sortKey ?? "")),
    contacts: contactRows,
    accounts: accountRows,
    relationships: relRows.map((r) => ({ ...r, evidence: evidenceByRel.get(r.id) ?? [] })),
    organisations: orgRows,
    stories: groups.map((g) => ({
      ...g,
      items: (itemsByGroup.get(g.id) ?? []).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || (a.publishedAt ?? "").localeCompare(b.publishedAt ?? "")),
    })),
  };
}

export async function getProfileView(db: Database, ownerId: string, profileId: string, snapshotId?: string | null): Promise<ProfileView | null> {
  const [profile] = await db.select().from(profiles).where(and(eq(profiles.id, profileId), eq(profiles.ownerId, ownerId)));
  if (!profile) return null;
  const allSnapshots = await db
    .select({ id: snapshots.id, version: snapshots.version, researchedAt: snapshots.researchedAt, status: snapshots.status })
    .from(snapshots)
    .where(and(eq(snapshots.profileId, profile.id), eq(snapshots.ownerId, ownerId)))
    .orderBy(desc(snapshots.version));
  const chosenId = (snapshotId && allSnapshots.find((s) => s.id === snapshotId)?.id) || profile.latestSnapshotId || allSnapshots[0]?.id;
  if (!chosenId) return null;
  const [snapshot] = await db.select().from(snapshots).where(and(eq(snapshots.id, chosenId), eq(snapshots.ownerId, ownerId)));
  if (!snapshot) return null;
  const [data, noteRows, tagRows, allTagRows] = await Promise.all([
    loadSnapshotData(db, ownerId, snapshot.id),
    db.select().from(notes).where(and(eq(notes.profileId, profile.id), eq(notes.ownerId, ownerId))).orderBy(desc(notes.createdAt)),
    db.select({ id: tags.id, name: tags.name }).from(profileTags).innerJoin(tags, eq(tags.id, profileTags.tagId)).where(and(eq(profileTags.profileId, profile.id), eq(tags.ownerId, ownerId))).orderBy(asc(tags.name)),
    db.select({ id: tags.id, name: tags.name }).from(tags).where(and(eq(tags.ownerId, ownerId), eq(tags.workspace, profile.workspace))).orderBy(asc(tags.name)),
  ]);
  return {
    profile,
    snapshot,
    snapshots: allSnapshots.map((s) => ({ id: s.id, version: s.version, researchedAt: s.researchedAt.toISOString(), status: s.status })),
    ...data,
    notes: noteRows.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString() })),
    tags: tagRows,
    allTags: allTagRows,
  };
}

/* --------------------------------- Library -------------------------------- */

export type ProfileListItem = {
  id: string;
  displayName: string;
  nativeName: string | null;
  headlineRole: string | null;
  headlineOrganisation: string | null;
  headlineLocation: string | null;
  savedAt: string | null;
  lastResearchedAt: string | null;
  snapshotCount: number;
  tags: TagView[];
  latestStatus: string | null;
  sourceCount: number | null;
};

export type ProfileListOptions = {
  q?: string | null;
  sort?: "recent" | "name" | "researched";
  tagId?: string | null;
  scope?: "saved" | "all";
  /** Page size (default 200) and offset for paginated clients. */
  limit?: number;
  offset?: number;
};

export async function listProfiles(db: Database, ownerId: string, workspace: Workspace, options: ProfileListOptions = {}): Promise<ProfileListItem[]> {
  const conditions: SQL[] = [eq(profiles.ownerId, ownerId), eq(profiles.workspace, workspace)];
  if (options.scope === "saved") conditions.push(isNotNull(profiles.savedAt));
  const q = options.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conditions.push(
      or(
        ilike(profiles.displayName, like),
        ilike(profiles.nativeName, like),
        ilike(profiles.headlineOrganisation, like),
        ilike(profiles.headlineRole, like),
        sql`${profiles.nameVariants}::text ILIKE ${like}`,
        sql`EXISTS (SELECT 1 FROM notes n WHERE n.profile_id = ${profiles.id} AND n.owner_id = ${ownerId} AND n.body ILIKE ${like})`,
        sql`EXISTS (SELECT 1 FROM profile_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.profile_id = ${profiles.id} AND t.name ILIKE ${like})`,
      )!,
    );
  }
  if (options.tagId) {
    conditions.push(sql`EXISTS (SELECT 1 FROM profile_tags pt WHERE pt.profile_id = ${profiles.id} AND pt.tag_id = ${options.tagId})`);
  }
  // The id tiebreaker keeps the order stable across pages.
  const order =
    options.sort === "name"
      ? [asc(profiles.displayName), asc(profiles.id)]
      : options.sort === "researched"
        ? [sql`${profiles.lastResearchedAt} DESC NULLS LAST`, asc(profiles.id)]
        : [desc(sql`coalesce(${profiles.savedAt}, ${profiles.updatedAt})`), asc(profiles.id)];
  const rows = await db
    .select({
      profile: profiles,
      latestStatus: snapshots.status,
      sourceCount: sql<number | null>`(${snapshots.counts} ->> 'sources')::int`,
    })
    .from(profiles)
    .leftJoin(snapshots, eq(snapshots.id, profiles.latestSnapshotId))
    .where(and(...conditions))
    .orderBy(...order)
    .limit(options.limit ?? 200)
    .offset(options.offset ?? 0);
  const ids = rows.map((r) => r.profile.id);
  const tagRows = ids.length
    ? await db
        .select({ profileId: profileTags.profileId, id: tags.id, name: tags.name })
        .from(profileTags)
        .innerJoin(tags, eq(tags.id, profileTags.tagId))
        .where(and(inArray(profileTags.profileId, ids), eq(tags.ownerId, ownerId)))
    : [];
  return rows.map(({ profile: p, latestStatus, sourceCount }) => ({
    id: p.id,
    displayName: p.displayName,
    nativeName: p.nativeName,
    headlineRole: p.headlineRole,
    headlineOrganisation: p.headlineOrganisation,
    headlineLocation: p.headlineLocation,
    savedAt: p.savedAt?.toISOString() ?? null,
    lastResearchedAt: p.lastResearchedAt?.toISOString() ?? null,
    snapshotCount: p.snapshotCount,
    tags: tagRows.filter((t) => t.profileId === p.id).map((t) => ({ id: t.id, name: t.name })),
    latestStatus,
    sourceCount,
  }));
}

export async function listTags(db: Database, ownerId: string, workspace: Workspace): Promise<TagView[]> {
  return db.select({ id: tags.id, name: tags.name }).from(tags).where(and(eq(tags.ownerId, ownerId), eq(tags.workspace, workspace))).orderBy(asc(tags.name));
}

/* -------------------------------- Mutations ------------------------------- */

async function ownedProfile(db: Database, ownerId: string, profileId: string) {
  const [profile] = await db.select().from(profiles).where(and(eq(profiles.id, profileId), eq(profiles.ownerId, ownerId)));
  return profile ?? null;
}

export async function setSaved(db: Database, ownerId: string, profileId: string, saved: boolean): Promise<boolean> {
  const updated = await db
    .update(profiles)
    .set({ savedAt: saved ? new Date() : null })
    .where(and(eq(profiles.id, profileId), eq(profiles.ownerId, ownerId)))
    .returning({ id: profiles.id });
  return updated.length > 0;
}

const toNoteView = (n: typeof notes.$inferSelect): NoteView => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString() });

/** Add a private note to an owned profile; null when the profile is not the owner's or the text is empty. */
export async function createNote(db: Database, ownerId: string, profileId: string, body: string): Promise<NoteView | null> {
  const text = body.trim().slice(0, 5000);
  if (!text || !(await ownedProfile(db, ownerId, profileId))) return null;
  const [note] = await db.insert(notes).values({ profileId, ownerId, body: text }).returning();
  return toNoteView(note);
}

export async function addNote(db: Database, ownerId: string, profileId: string, body: string): Promise<boolean> {
  return (await createNote(db, ownerId, profileId, body)) !== null;
}

/** Edit a note; `profileId`, when given, must also match (the API addresses notes under their profile). */
export async function editNote(db: Database, ownerId: string, noteId: string, body: string, profileId?: string): Promise<NoteView | null> {
  const text = body.trim().slice(0, 5000);
  if (!text) return null;
  const [note] = await db
    .update(notes)
    .set({ body: text })
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, ownerId), profileId ? eq(notes.profileId, profileId) : undefined))
    .returning();
  return note ? toNoteView(note) : null;
}

export async function updateNote(db: Database, ownerId: string, noteId: string, body: string): Promise<boolean> {
  return (await editNote(db, ownerId, noteId, body)) !== null;
}

export async function deleteNote(db: Database, ownerId: string, noteId: string, profileId?: string): Promise<boolean> {
  const deleted = await db
    .delete(notes)
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, ownerId), profileId ? eq(notes.profileId, profileId) : undefined))
    .returning({ id: notes.id });
  return deleted.length > 0;
}

/** Tags on one owned profile plus every tag in its workspace (for suggestions). */
export async function profileTagState(db: Database, ownerId: string, profileId: string): Promise<{ tags: TagView[]; availableTags: TagView[] } | null> {
  const profile = await ownedProfile(db, ownerId, profileId);
  if (!profile) return null;
  const [tagRows, allTags] = await Promise.all([
    db.select({ id: tags.id, name: tags.name }).from(profileTags).innerJoin(tags, eq(tags.id, profileTags.tagId)).where(and(eq(profileTags.profileId, profile.id), eq(tags.ownerId, ownerId))).orderBy(asc(tags.name)),
    listTags(db, ownerId, profile.workspace),
  ]);
  return { tags: tagRows, availableTags: allTags };
}

export async function addTag(db: Database, ownerId: string, profileId: string, rawName: string): Promise<boolean> {
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, 40);
  const profile = await ownedProfile(db, ownerId, profileId);
  if (!name || !profile) return false;
  const normalisedName = keyify(name) || name.toLowerCase();
  await db.insert(tags).values({ ownerId, workspace: profile.workspace, name, normalisedName }).onConflictDoNothing();
  const [tag] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.ownerId, ownerId), eq(tags.workspace, profile.workspace), eq(tags.normalisedName, normalisedName)));
  await db.insert(profileTags).values({ profileId, tagId: tag.id }).onConflictDoNothing();
  return true;
}

export async function removeTag(db: Database, ownerId: string, profileId: string, tagId: string): Promise<boolean> {
  if (!(await ownedProfile(db, ownerId, profileId))) return false;
  const [tag] = await db.select({ id: tags.id }).from(tags).where(and(eq(tags.id, tagId), eq(tags.ownerId, ownerId)));
  if (!tag) return false;
  await db.delete(profileTags).where(and(eq(profileTags.profileId, profileId), eq(profileTags.tagId, tagId)));
  // Drop tags no longer used anywhere.
  await db.execute(sql`DELETE FROM tags WHERE id = ${tagId} AND owner_id = ${ownerId} AND NOT EXISTS (SELECT 1 FROM profile_tags WHERE tag_id = ${tagId})`);
  return true;
}

/**
 * Delete a profile and everything derived from it: snapshots (sources,
 * claims, contacts, accounts, relationships, media), private notes, tags
 * links, export and issue records, the research jobs that produced it with
 * their retrieved page content and candidates, and cache entries those jobs
 * created. Usage/cost records are kept without the job link (no personal data).
 */
export async function deleteProfile(db: Database, ownerId: string, profileId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [profile] = await tx.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.id, profileId), eq(profiles.ownerId, ownerId)));
    if (!profile) return false;
    const snapshotJobs = await tx.select({ jobId: snapshots.jobId }).from(snapshots).where(and(eq(snapshots.profileId, profileId), eq(snapshots.ownerId, ownerId)));
    const directJobs = await tx.select({ id: researchJobs.id }).from(researchJobs).where(and(eq(researchJobs.profileId, profileId), eq(researchJobs.ownerId, ownerId)));
    const jobIds = new Set<string>([...snapshotJobs.map((s) => s.jobId).filter((x): x is string => Boolean(x)), ...directJobs.map((j) => j.id)]);
    // Include ancestor/descendant jobs in the same chain (retries, reopened identity choices).
    let frontier = [...jobIds];
    while (frontier.length > 0) {
      const related = await tx
        .select({ id: researchJobs.id, parent: researchJobs.parentJobId, profileId: researchJobs.profileId })
        .from(researchJobs)
        .where(and(eq(researchJobs.ownerId, ownerId), or(inArray(researchJobs.parentJobId, frontier), inArray(researchJobs.id, frontier))));
      const next: string[] = [];
      const parents = new Set(related.map((r) => r.parent).filter((p): p is string => Boolean(p)));
      for (const r of related) {
        // Never take a job that produced a different profile (e.g. a re-opened identity choice).
        if (r.profileId && r.profileId !== profileId) continue;
        if (!jobIds.has(r.id)) {
          jobIds.add(r.id);
          next.push(r.id);
        }
      }
      for (const parentId of parents) {
        if (jobIds.has(parentId)) continue;
        const [parent] = await tx.select({ profileId: researchJobs.profileId }).from(researchJobs).where(and(eq(researchJobs.id, parentId), eq(researchJobs.ownerId, ownerId)));
        if (parent && (!parent.profileId || parent.profileId === profileId)) {
          jobIds.add(parentId);
          next.push(parentId);
        }
      }
      frontier = next;
    }
    const ids = [...jobIds];
    if (ids.length > 0) {
      await tx.delete(providerCache).where(and(eq(providerCache.ownerId, ownerId), inArray(providerCache.jobId, ids)));
    }
    await tx.delete(exportLog).where(and(eq(exportLog.profileId, profileId), eq(exportLog.ownerId, ownerId)));
    await tx.delete(issueReports).where(and(eq(issueReports.profileId, profileId), eq(issueReports.ownerId, ownerId)));
    await tx.delete(notes).where(and(eq(notes.profileId, profileId), eq(notes.ownerId, ownerId)));
    await tx.delete(profiles).where(and(eq(profiles.id, profileId), eq(profiles.ownerId, ownerId)));
    if (ids.length > 0) {
      await tx.delete(researchJobs).where(and(eq(researchJobs.ownerId, ownerId), inArray(researchJobs.id, ids)));
    }
    await tx.execute(sql`DELETE FROM tags t WHERE t.owner_id = ${ownerId} AND NOT EXISTS (SELECT 1 FROM profile_tags pt WHERE pt.tag_id = t.id)`);
    return true;
  });
}

/** Delete a finished research job from the activity history (with its retrieved content). */
export async function deleteJob(db: Database, ownerId: string, jobId: string): Promise<boolean> {
  const deleted = await db
    .delete(researchJobs)
    .where(
      and(
        eq(researchJobs.id, jobId),
        eq(researchJobs.ownerId, ownerId),
        inArray(researchJobs.status, ["completed", "partial", "failed", "cancelled"]),
      ),
    )
    .returning({ id: researchJobs.id });
  return deleted.length > 0;
}

export async function reportIssue(
  db: Database,
  ownerId: string,
  input: { profileId: string; snapshotId: string | null; claimId: string | null; category: IssueCategory; message: string },
): Promise<boolean> {
  if (!(await ownedProfile(db, ownerId, input.profileId))) return false;
  const message = input.message.trim().slice(0, 2000);
  if (!message) return false;
  let snapshotId: string | null = null;
  if (input.snapshotId) {
    const [s] = await db.select({ id: snapshots.id }).from(snapshots).where(and(eq(snapshots.id, input.snapshotId), eq(snapshots.ownerId, ownerId), eq(snapshots.profileId, input.profileId)));
    snapshotId = s?.id ?? null;
  }
  let claimId: string | null = null;
  if (input.claimId && snapshotId) {
    const [c] = await db.select({ id: claims.id }).from(claims).where(and(eq(claims.id, input.claimId), eq(claims.ownerId, ownerId), eq(claims.snapshotId, snapshotId)));
    claimId = c?.id ?? null;
  }
  await db.insert(issueReports).values({ ownerId, profileId: input.profileId, snapshotId, claimId, category: input.category, message });
  return true;
}

export async function listIssues(db: Database, ownerId: string, profileId: string) {
  return db.select().from(issueReports).where(and(eq(issueReports.ownerId, ownerId), eq(issueReports.profileId, profileId))).orderBy(desc(issueReports.createdAt));
}
