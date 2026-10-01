import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getJobView, listJobs } from "@/lib/data/jobs";
import { addNote, addTag, deleteJob, deleteProfile, getProfileView, listProfiles, reportIssue, setSaved } from "@/lib/data/profiles";
import { jobDocuments, notes, profiles, researchJobs } from "@/lib/db/schema";
import { buildJsonExport } from "@/lib/export/json";
import { storeHits } from "@/lib/research/pipeline/documents";
import { createProviders } from "@/lib/research/providers";
import { buildJobConfig } from "@/lib/research/config";
import {
  cancelResearch,
  refreshProfile,
  reopenIdentityChoice,
  retryResearch,
  selectCandidate,
  startResearch,
} from "@/lib/research/service";
import { createUser, db, env, idem, makeWorker, resetDb } from "./helpers";

const RICH = { fullName: "Elnara Gasimova", company: "Caspian Lantern Analytics" };

async function researchAsOwner() {
  const owner = await createUser("owner", "demo");
  const { jobId } = await startResearch(db(), env(), owner, RICH, idem());
  expect(await makeWorker().drain()).toEqual(["completed"]);
  const [job] = await db().select().from(researchJobs).where(eq(researchJobs.id, jobId));
  return { owner, jobId, profileId: job.profileId! };
}

describe("authentication and ownership", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("another account cannot read or change the owner's profiles, jobs, notes or exports", async () => {
    const { owner, jobId, profileId } = await researchAsOwner();
    await addNote(db(), owner.userId, profileId, "Private note: met at the 2025 forum.");
    const guest = await createUser("demo");

    expect(await getJobView(db(), guest.userId, jobId)).toBeNull();
    expect(await getProfileView(db(), guest.userId, profileId)).toBeNull();
    expect(await listProfiles(db(), guest.userId, "demo")).toEqual([]);
    expect(await listJobs(db(), guest.userId, "demo")).toEqual([]);

    await expect(cancelResearch(db(), guest, jobId)).rejects.toMatchObject({ code: "not_found" });
    await expect(retryResearch(db(), env(), guest, jobId, idem())).rejects.toMatchObject({ code: "not_found" });
    await expect(reopenIdentityChoice(db(), env(), guest, jobId, idem())).rejects.toMatchObject({ code: "not_found" });
    await expect(refreshProfile(db(), env(), guest, profileId, idem())).rejects.toMatchObject({ code: "not_found" });
    await expect(selectCandidate(db(), guest, jobId, "00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({ code: "not_found" });

    expect(await addNote(db(), guest.userId, profileId, "intrusion")).toBe(false);
    expect(await addTag(db(), guest.userId, profileId, "intrusion")).toBe(false);
    expect(await setSaved(db(), guest.userId, profileId, true)).toBe(false);
    expect(await reportIssue(db(), guest.userId, { profileId, snapshotId: null, claimId: null, category: "other", message: "x" })).toBe(false);
    expect(await deleteProfile(db(), guest.userId, profileId)).toBe(false);
    expect(await deleteJob(db(), guest.userId, jobId)).toBe(false);

    // Nothing changed for the owner.
    const view = (await getProfileView(db(), owner.userId, profileId))!;
    expect(view.notes.map((n) => n.body)).toEqual(["Private note: met at the 2025 forum."]);
    expect(view.tags).toEqual([]);
    expect(view.profile.savedAt).toBeNull();
    // Exports are built only from an owned view, and notes stay out unless asked for.
    const exported = buildJsonExport(view, { includeNotes: false, generatedAt: new Date() });
    expect(JSON.stringify(exported)).not.toContain("Private note");
  });

  it("demo accounts cannot start live research, and live research never falls back to fixtures", async () => {
    const guest = await createUser("demo");
    await expect(startResearch(db(), env(), { ...guest, workspace: "live" }, RICH, idem())).rejects.toMatchObject({ code: "live_not_allowed" });

    const owner = await createUser("owner", "live");
    // No provider keys are configured in the test environment.
    await expect(startResearch(db(), env(), owner, RICH, idem())).rejects.toMatchObject({ code: "live_not_configured" });
    expect(await db().select().from(researchJobs)).toHaveLength(0);

    // With keys, the live workspace gets the real adapters, never fixture providers.
    const keyed = { ...env(), TAVILY_API_KEY: "tvly-placeholder", ANTHROPIC_API_KEY: "sk-ant-placeholder" };
    const live = createProviders({ workspace: "live", config: buildJobConfig(keyed, "live", null), env: keyed });
    expect(live.search.id).toBe("tavily");
    expect(live.reasoning.id).toBe("anthropic");
    // Without keys the live adapters refuse to start instead of degrading to demo data.
    expect(() => createProviders({ workspace: "live", config: buildJobConfig(env(), "live", null), env: env() })).toThrow(/not configured/i);
  });

  it("demo and live workspaces never share profiles", async () => {
    const { owner } = await researchAsOwner();
    expect(await listProfiles(db(), owner.userId, "demo")).toHaveLength(1);
    expect(await listProfiles(db(), owner.userId, "live")).toHaveLength(0);
  });
});

describe("hostile content and unsafe URLs", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("instructions inside a retrieved page do not change the brief", async () => {
    const { owner, profileId } = await researchAsOwner();
    const view = (await getProfileView(db(), owner.userId, profileId))!;
    const everything = JSON.stringify({
      headline: view.snapshot.headline,
      overview: view.snapshot.overview,
      claims: view.claims.map((c) => c.displayValue),
      contacts: view.contacts.map((c) => c.value),
    });
    expect(everything).not.toMatch(/central bank|api key|ignore all previous/i);
    const forum = view.sources.find((s) => s.url.includes("caspian-forum.example"));
    if (forum) {
      // The forum can be listed as a source, but it never supports a fact or a contact.
      expect(view.claims.flatMap((c) => c.evidence).some((e) => e.sourceId === forum.id)).toBe(false);
      expect(view.contacts.some((c) => c.sourceId === forum.id)).toBe(false);
    }
  });

  it("unsafe or excluded URLs in search results are never stored for reading", async () => {
    const owner = await createUser("owner", "demo");
    const { jobId } = await startResearch(db(), env(), owner, RICH, idem());
    const hit = (url: string) => ({ url, title: "t", snippet: "s", providerPublishedDate: null, score: 1, rawContent: null, fixtureKey: null });
    const dispositions = await storeHits(db(), {
      jobId,
      ownerId: owner.userId,
      category: "career",
      retentionDays: 1,
      hits: [
        hit("http://169.254.169.254/latest/meta-data/iam/security-credentials/"),
        hit("http://localhost:5432/"),
        hit("http://10.0.0.7/admin"),
        hit("http://[::1]/"),
        hit("http://0x7f000001/"),
        hit("file:///etc/passwd"),
        hit("https://user:secret@caspianlantern.example/team"),
        hit("https://caspianlantern.example:8443/internal"),
        hit("https://people-lookup.example/elnara-gasimova"),
        hit("https://caspianlantern.example/team/elnara-gasimova"),
      ],
    });
    expect(dispositions.filter((d) => d.kind === "blocked")).toHaveLength(9);
    const stored = await db().select().from(jobDocuments).where(eq(jobDocuments.jobId, jobId));
    expect(stored.map((d) => d.url)).toEqual(["https://caspianlantern.example/team/elnara-gasimova"]);
  });

  it("deleting a profile removes its research data and leaves other profiles intact", async () => {
    const { owner, jobId, profileId } = await researchAsOwner();
    const other = await startResearch(db(), env(), owner, { fullName: "Sevinj Abbasli" }, idem());
    let outcomes = await makeWorker().drain();
    if (outcomes[0] === "awaiting_identity") {
      const [candidate] = (await getJobView(db(), owner.userId, other.jobId))!.candidates;
      await selectCandidate(db(), owner, other.jobId, candidate.id);
      outcomes = await makeWorker().drain();
    }
    await addNote(db(), owner.userId, profileId, "note to delete");

    expect(await deleteProfile(db(), owner.userId, profileId)).toBe(true);
    expect(await getProfileView(db(), owner.userId, profileId)).toBeNull();
    expect(await db().select().from(profiles).where(eq(profiles.id, profileId))).toHaveLength(0);
    expect(await db().select().from(researchJobs).where(eq(researchJobs.id, jobId))).toHaveLength(0);
    expect(await db().select().from(jobDocuments).where(eq(jobDocuments.jobId, jobId))).toHaveLength(0);
    expect(await db().select().from(notes).where(eq(notes.profileId, profileId))).toHaveLength(0);

    const remaining = await listProfiles(db(), owner.userId, "demo");
    expect(remaining.map((p) => p.displayName)).toEqual(["Sevinj Abbasli"]);
  });
});
