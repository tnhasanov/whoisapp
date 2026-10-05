import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { profiles, snapshots } from "@/lib/db/schema";
import { diffSnapshots, type DiffSide, type SnapshotDiff } from "@/lib/diff/snapshot-diff";
import { loadSnapshotData } from "./profiles";

export type SnapshotRef = { id: string; version: number; researchedAt: Date; status: "complete" | "partial" };

/** The comparable view of one snapshot ("What changed?"). */
export async function diffSide(db: Database, ownerId: string, snapshot: typeof snapshots.$inferSelect): Promise<DiffSide> {
  const data = await loadSnapshotData(db, ownerId, snapshot.id);
  return {
    version: snapshot.version,
    researchedAt: snapshot.researchedAt.toISOString(),
    claims: data.claims.map((c) => ({ id: c.id, claimKey: c.claimKey, category: c.category, displayValue: c.displayValue, evidenceStatus: c.evidenceStatus, conflictGroup: c.conflictGroup, temporal: c.temporal })),
    media: data.stories.flatMap((s) => s.items).map((i) => ({ id: i.id, canonicalUrl: i.canonicalUrl, headline: i.headline, outlet: i.outlet, publishedAt: i.publishedAt, coverageType: i.coverageType })),
    contacts: data.contacts.map((c) => ({ id: c.id, contactKey: c.contactKey, contactType: c.contactType, value: c.value })),
    accounts: data.accounts.map((a) => ({ id: a.id, accountKey: a.accountKey, platform: a.platform, url: a.url, status: a.status })),
    relationships: data.relationships.map((r) => ({ id: r.id, relationshipKey: r.relationshipKey, label: r.label, counterpartName: r.counterpartName, kind: r.kind })),
    headline: { role: snapshot.headline.role, organisation: snapshot.headline.organisation, location: snapshot.headline.location },
  };
}

export type ProfileChanges = {
  profile: typeof profiles.$inferSelect;
  /** Newest first. */
  snapshots: SnapshotRef[];
  from: SnapshotRef | null;
  to: SnapshotRef | null;
  diff: SnapshotDiff | null;
};

/**
 * Compare two versions of an owned profile. Defaults to the latest version
 * against the one before it; `from` must be older than `to`. Returns null when
 * the profile does not belong to the owner.
 */
export async function getProfileChanges(db: Database, ownerId: string, profileId: string, fromId?: string | null, toId?: string | null): Promise<ProfileChanges | null> {
  const [profile] = await db.select().from(profiles).where(and(eq(profiles.id, profileId), eq(profiles.ownerId, ownerId)));
  if (!profile) return null;
  const all = await db.select().from(snapshots).where(and(eq(snapshots.profileId, profile.id), eq(snapshots.ownerId, ownerId))).orderBy(desc(snapshots.version));
  const refs: SnapshotRef[] = all.map((s) => ({ id: s.id, version: s.version, researchedAt: s.researchedAt, status: s.status }));
  if (all.length < 2) return { profile, snapshots: refs, from: null, to: null, diff: null };
  let to = all.find((s) => s.id === toId) ?? all[0];
  // The oldest version has nothing earlier to compare with: fall back to the latest.
  if (!all.some((s) => s.version < to.version)) to = all[0];
  const from = all.find((s) => s.id === fromId && s.version < to.version) ?? all.find((s) => s.version < to.version)!;
  const diff = diffSnapshots(await diffSide(db, ownerId, from), await diffSide(db, ownerId, to));
  const ref = (s: typeof snapshots.$inferSelect): SnapshotRef => ({ id: s.id, version: s.version, researchedAt: s.researchedAt, status: s.status });
  return { profile, snapshots: refs, from: ref(from), to: ref(to), diff };
}
