import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { candidateIdentities, claims, mediaItems, profiles, researchJobs, snapshots } from "@/lib/db/schema";
import { getJobView } from "@/lib/data/jobs";
import { getProfileView, loadSnapshotData } from "@/lib/data/profiles";
import { diffSnapshots } from "@/lib/diff/snapshot-diff";
import { selectCandidate, startResearch, refreshProfile, retryResearch } from "@/lib/research/service";
import { createUser, db, env, idem, makeWorker, resetDb } from "./helpers";

describe("demo pipeline end to end", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("researches the rich profile with auto-selection by company and persists a snapshot", async () => {
    const owner = await createUser("owner", "demo");
    const { jobId } = await startResearch(db(), env(), owner, { fullName: "Elnara Gasimova", company: "Caspian Lantern Analytics" }, idem());
    const outcomes = await makeWorker().drain();
    expect(outcomes).toEqual(["completed"]);
    const view = await getJobView(db(), owner.userId, jobId);
    expect(view?.status).toBe("completed");
    expect(view?.identityResolution?.method).toBe("auto_unique_company_match");
    const profile = await getProfileView(db(), owner.userId, view!.profileId!);
    expect(profile).not.toBeNull();
    const p = profile!;
    expect(p.snapshot.headline.role).toMatch(/Chief Executive Officer|CEO/i);
    // Conflicting start dates are preserved as a conflict group.
    expect(p.claims.some((c) => c.conflictGroup)).toBe(true);
    // Switchboard is never direct.
    const switchboard = p.contacts.find((c) => c.contactType === "switchboard");
    expect(switchboard?.isDirect).toBe(false);
    expect(switchboard?.belongsTo).toBe("organisation");
    // Possible account kept separate from accepted ones.
    expect(p.accounts.some((a) => a.status === "accepted")).toBe(true);
    expect(p.accounts.some((a) => a.status === "possible")).toBe(true);
    // Shared employment is a shared affiliation, not a documented relationship.
    const shared = p.relationships.filter((r) => r.relationType === "shared_employer");
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.every((r) => r.kind === "shared_affiliation")).toBe(true);
    // Syndicated copies grouped into one story.
    expect(p.stories.some((s) => s.items.length >= 3)).toBe(true);
    // The old article re-indexed recently keeps its original publication date.
    const london = p.stories.flatMap((s) => s.items).find((i) => /London office/i.test(i.headline));
    expect(london?.publishedAt).toBe("2024-01-20");
    // Every accepted claim cites a verified excerpt.
    expect(p.claims.every((c) => c.evidence.length > 0 && c.evidence.every((e) => e.verified))).toBe(true);
  });

  it("asks the owner to choose between same-name people and keeps them separate", async () => {
    const owner = await createUser("owner", "demo");
    const { jobId } = await startResearch(db(), env(), owner, { fullName: "Tural Mammadov" }, idem());
    expect(await makeWorker().drain()).toEqual(["awaiting_identity"]);
    const candidates = await db().select().from(candidateIdentities).where(eq(candidateIdentities.jobId, jobId));
    expect(candidates.length).toBe(3);
    const architect = candidates.find((c) => /Northwind/.test(c.organisation ?? ""))!;
    await selectCandidate(db(), owner, jobId, architect.id);
    expect(await makeWorker().drain()).toEqual(["completed"]);
    const [job] = await db().select().from(researchJobs).where(eq(researchJobs.id, jobId));
    const p = (await getProfileView(db(), owner.userId, job.profileId!))!;
    // Nothing from the other two Turals leaks in.
    const text = JSON.stringify(p.claims.map((c) => c.displayValue));
    expect(text).not.toMatch(/Kura Basin|Ganja/i);
  });

  it("finishes partial on a simulated provider timeout and the retry reuses checkpoints", async () => {
    const owner = await createUser("owner", "demo");
    const { jobId } = await startResearch(db(), env(), owner, { fullName: "Javid Nuriyev" }, idem());
    const first = await makeWorker().drain();
    if (first[0] === "awaiting_identity") {
      const [c] = await db().select().from(candidateIdentities).where(eq(candidateIdentities.jobId, jobId));
      await selectCandidate(db(), owner, jobId, c.id);
    }
    const second = first[0] === "awaiting_identity" ? await makeWorker().drain() : first;
    expect(second).toEqual(["partial"]);
    const retryId = await retryResearch(db(), env(), owner, jobId, idem());
    expect(await makeWorker().drain()).toEqual(["completed"]);
    const retryView = await getJobView(db(), owner.userId, retryId);
    expect(retryView?.steps.some((s) => s.reused)).toBe(true);
    const [job] = await db().select().from(researchJobs).where(eq(researchJobs.id, retryId));
    const media = await db().select().from(mediaItems).where(eq(mediaItems.snapshotId, job.snapshotId!));
    expect(media.length).toBeGreaterThan(0);
  });

  it("refresh creates a new snapshot version", async () => {
    const owner = await createUser("owner", "demo");
    await startResearch(db(), env(), owner, { fullName: "Elnara Gasimova", company: "Caspian Lantern Analytics" }, idem());
    await makeWorker().drain();
    const [profile] = await db().select().from(profiles).where(eq(profiles.ownerId, owner.userId));
    await refreshProfile(db(), env(), owner, profile.id, idem());
    expect(await makeWorker().drain()).toEqual(["completed"]);
    const snaps = await db().select().from(snapshots).where(and(eq(snapshots.profileId, profile.id)));
    expect(snaps.length).toBe(2);
    const v2 = snaps.find((s) => s.version === 2)!;
    expect(v2.headline.role).toMatch(/Executive Chair/i);
    const v2claims = await db().select().from(claims).where(eq(claims.snapshotId, v2.id));
    expect(v2claims.some((c) => c.conflictGroup)).toBe(false);

    // What changed? reports the new role and the resolved date conflict.
    const side = async (snapshot: typeof v2) => {
      const data = await loadSnapshotData(db(), owner.userId, snapshot.id);
      return {
        version: snapshot.version,
        researchedAt: snapshot.researchedAt.toISOString(),
        claims: data.claims.map((c) => ({ id: c.id, claimKey: c.claimKey, category: c.category, displayValue: c.displayValue, evidenceStatus: c.evidenceStatus, conflictGroup: c.conflictGroup, temporal: c.temporal })),
        media: data.stories.flatMap((st) => st.items).map((i) => ({ id: i.id, canonicalUrl: i.canonicalUrl, headline: i.headline, outlet: i.outlet, publishedAt: i.publishedAt, coverageType: i.coverageType })),
        contacts: data.contacts.map((c) => ({ id: c.id, contactKey: c.contactKey, contactType: c.contactType, value: c.value })),
        accounts: data.accounts.map((a) => ({ id: a.id, accountKey: a.accountKey, platform: a.platform, url: a.url, status: a.status })),
        relationships: data.relationships.map((r) => ({ id: r.id, relationshipKey: r.relationshipKey, label: r.label, counterpartName: r.counterpartName, kind: r.kind })),
        headline: { role: snapshot.headline.role, organisation: snapshot.headline.organisation, location: snapshot.headline.location },
      };
    };
    const v1 = snaps.find((s) => s.version === 1)!;
    const diff = diffSnapshots(await side(v1), await side(v2));
    expect(diff.hasChanges).toBe(true);
    expect(diff.headline.changed).toBe(true);
    expect(diff.claims.conflictsResolved.length).toBeGreaterThan(0);
    expect(diff.media.newlyPublished.length + diff.media.newlyDiscovered.length).toBeGreaterThan(0);
  });

  it("a Cyrillic search keeps two same-name people apart and does not merge them into the Latin-script profile", async () => {
    const owner = await createUser("owner", "demo");
    const { jobId } = await startResearch(db(), env(), owner, { fullName: "Эльнара Гасымова" }, idem());
    expect(await makeWorker().drain()).toEqual(["awaiting_identity"]);
    const candidates = await db().select().from(candidateIdentities).where(eq(candidateIdentities.jobId, jobId));
    expect(candidates).toHaveLength(2);
    const kazan = candidates.find((c) => /Kazan/.test(c.location ?? "") || /Volga/.test(c.organisation ?? ""))!;
    expect(kazan).toBeDefined();
    await selectCandidate(db(), owner, jobId, kazan.id);
    expect(await makeWorker().drain()).toEqual(["completed"]);

    await startResearch(db(), env(), owner, { fullName: "Elnara Gasimova", company: "Caspian Lantern Analytics" }, idem());
    expect(await makeWorker().drain()).toEqual(["completed"]);

    const all = await db().select().from(profiles).where(eq(profiles.ownerId, owner.userId));
    expect(all).toHaveLength(2);
    expect(new Set(all.map((p) => p.anchorKey)).size).toBe(2);
    const [kazanJob] = await db().select().from(researchJobs).where(eq(researchJobs.id, jobId));
    const kazanView = (await getProfileView(db(), owner.userId, kazanJob.profileId!))!;
    const text = JSON.stringify([kazanView.claims.map((c) => c.displayValue), kazanView.contacts.map((c) => c.value), kazanView.snapshot.headline]);
    expect(text).toMatch(/Volga|Kazan/);
    expect(text).not.toMatch(/Caspian Lantern|Absheron/);
  });
});
