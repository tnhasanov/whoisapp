import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findFixtureBundle } from "@/fixtures/world";
import { getJobView } from "@/lib/data/jobs";
import { getProfileView } from "@/lib/data/profiles";
import { jobEvents, jobSteps, researchJobs, snapshots } from "@/lib/db/schema";
import { claimNextJob, requestCancel, sweepStaleJobs, withFence } from "@/lib/jobs/store";
import { runJob, type RunContext } from "@/lib/research/pipeline/run";
import { LeaseLostError } from "@/lib/research/providers/types";
import { cancelResearch, refreshProfile, selectCandidate, startResearch } from "@/lib/research/service";
import { createUser, db, env, idem, makeWorker, resetDb } from "./helpers";

const RICH = { fullName: "Elnara Gasimova", company: "Caspian Lantern Analytics" };

function context(job: RunContext["job"], overrides: Partial<RunContext> = {}): RunContext {
  return { db: db(), env: env(), job, token: job.leaseToken, signal: new AbortController().signal, abortReason: () => null, ...overrides };
}

async function waitFor(check: () => Promise<boolean>, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("condition not met in time");
}

async function expireLease(jobId: string) {
  await db().update(researchJobs).set({ leaseExpiresAt: new Date(Date.now() - 1_000) }).where(eq(researchJobs.id, jobId));
}

describe("job runner safety", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("duplicate submissions with one idempotency key create exactly one job", async () => {
    const owner = await createUser("owner", "demo");
    const key = idem();
    const [a, b] = await Promise.all([startResearch(db(), env(), owner, RICH, key), startResearch(db(), env(), owner, RICH, key)]);
    expect(a.jobId).toBe(b.jobId);
    expect([a.created, b.created].filter(Boolean)).toHaveLength(1);
    const rows = await db().select().from(researchJobs).where(eq(researchJobs.ownerId, owner.userId));
    expect(rows).toHaveLength(1);
  });

  it("only one worker can claim a queued job", async () => {
    const owner = await createUser("owner", "demo");
    await startResearch(db(), env(), owner, RICH, idem());
    const claims = await Promise.all([claimNextJob(db(), "worker-a", 30), claimNextJob(db(), "worker-b", 30), claimNextJob(db(), "worker-c", 30)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("a worker that lost its lease cannot write; the new holder finishes exactly once", async () => {
    const owner = await createUser("owner", "demo");
    const { jobId } = await startResearch(db(), env(), owner, RICH, idem());
    const first = (await claimNextJob(db(), "worker-a", 30))!;
    // worker-a stalls; its lease runs out and worker-b takes over.
    await expireLease(jobId);
    const second = (await claimNextJob(db(), "worker-b", 30))!;
    expect(second.id).toBe(jobId);
    expect(second.leaseToken).toBe(first.leaseToken + 1);
    expect(second.attempt).toBe(first.attempt + 1);

    await expect(withFence(db(), jobId, first.leaseToken, async () => "write")).rejects.toBeInstanceOf(LeaseLostError);
    expect(await runJob(context(first))).toBe("lease_lost");
    expect(await runJob(context(second))).toBe("completed");

    const [job] = await db().select().from(researchJobs).where(eq(researchJobs.id, jobId));
    expect(job.status).toBe("completed");
    const snaps = await db().select().from(snapshots).where(eq(snapshots.ownerId, owner.userId));
    expect(snaps).toHaveLength(1);
    // A late write from the old worker still cannot touch the finished job.
    await expect(withFence(db(), jobId, first.leaseToken, async () => "write")).rejects.toBeInstanceOf(LeaseLostError);
  });

  it("a job whose worker vanished is resumed from its checkpoints by another worker", async () => {
    const owner = await createUser("owner", "demo");
    const { jobId } = await startResearch(db(), env(), owner, { fullName: "Tural Mammadov" }, idem());
    expect(await makeWorker().drain()).toEqual(["awaiting_identity"]);
    const [candidate] = (await getJobView(db(), owner.userId, jobId))!.candidates;
    await selectCandidate(db(), owner, jobId, candidate.id);
    const crashed = (await claimNextJob(db(), "worker-a", 30))!;
    expect(crashed.phase).toBe("research");
    await expireLease(jobId);
    expect(await makeWorker().drain()).toEqual(["completed"]);
    const [job] = await db().select().from(researchJobs).where(eq(researchJobs.id, jobId));
    expect(job.status).toBe("completed");
    expect(job.attempt).toBe(1);
    // Discovery ran once; its checkpoints were not repeated.
    const steps = await db().select().from(jobSteps).where(eq(jobSteps.jobId, jobId));
    expect(steps.filter((s) => s.name === "discover:search")).toHaveLength(1);
    expect(steps.find((s) => s.name === "discover:search")?.attempt).toBe(1);
  });

  it("a stale job ends visibly failed once attempts are exhausted, keeping completed steps", async () => {
    const owner = await createUser("owner", "demo");
    const { jobId } = await startResearch(db(), env(), owner, RICH, idem());
    const claimed = (await claimNextJob(db(), "worker-a", 30))!;
    // Complete the first checkpoint, then let the worker die on its last attempt.
    const controller = new AbortController();
    let reason: "lease_lost" | null = null;
    const run = runJob(context(claimed, { env: { ...env(), FIXTURE_LATENCY_MS: 40 }, signal: controller.signal, abortReason: () => reason }));
    await waitFor(async () => (await db().select().from(jobSteps).where(and(eq(jobSteps.jobId, jobId), eq(jobSteps.status, "completed")))).length >= 1);
    reason = "lease_lost";
    controller.abort();
    await run;
    await db()
      .update(researchJobs)
      .set({ status: "running", attempt: env().JOB_MAX_ATTEMPTS - 1, leaseExpiresAt: new Date(Date.now() - 1_000) })
      .where(eq(researchJobs.id, jobId));

    expect(await claimNextJob(db(), "worker-b", 30)).toBeNull();
    expect(await sweepStaleJobs(db())).toEqual([jobId]);
    const view = (await getJobView(db(), owner.userId, jobId))!;
    expect(view.status).toBe("failed");
    expect(view.errorCode).toBe("worker_lost");
    expect(view.events.some((e) => e.code === "job.worker_lost")).toBe(true);
    expect(view.steps.some((s) => s.status === "completed")).toBe(true);
  });

  it("cancelling a queued job stops it before any work", async () => {
    const owner = await createUser("owner", "demo");
    const { jobId } = await startResearch(db(), env(), owner, RICH, idem());
    await cancelResearch(db(), owner, jobId);
    expect(await makeWorker().drain()).toEqual([]);
    const [job] = await db().select().from(researchJobs).where(eq(researchJobs.id, jobId));
    expect(job.status).toBe("cancelled");
  });

  it("cancelling a running job stops at the next checkpoint without writing a profile", async () => {
    const owner = await createUser("owner", "demo");
    const { jobId } = await startResearch(db(), env(), owner, RICH, idem());
    const claimed = (await claimNextJob(db(), "worker-a", 30))!;
    const controller = new AbortController();
    let reason: "cancelled" | null = null;
    const run = runJob(context(claimed, { env: { ...env(), FIXTURE_LATENCY_MS: 40 }, signal: controller.signal, abortReason: () => reason }));
    await waitFor(async () => (await db().select().from(jobSteps).where(and(eq(jobSteps.jobId, jobId), eq(jobSteps.status, "completed")))).length >= 2);
    expect(await requestCancel(db(), owner.userId, jobId)).toBe("running");
    reason = "cancelled";
    controller.abort();
    expect(await run).toBe("cancelled");

    const view = (await getJobView(db(), owner.userId, jobId))!;
    expect(view.status).toBe("cancelled");
    expect(view.profileId).toBeNull();
    expect(view.steps.filter((s) => s.status === "completed").length).toBeGreaterThanOrEqual(2);
    expect(await db().select().from(snapshots).where(eq(snapshots.ownerId, owner.userId))).toHaveLength(0);
  });

  it("the worker notices a cancellation requested while the job runs", async () => {
    const owner = await createUser("owner", "demo");
    const { jobId } = await startResearch(db(), env(), owner, RICH, idem());
    // A short lease makes the heartbeat (lease/3, at least 1 s) check for cancellation quickly.
    const worker = makeWorker({ env: { ...env(), FIXTURE_LATENCY_MS: 200 }, leaseSeconds: 3 });
    const outcome = worker.runOnce();
    await waitFor(async () => (await db().select().from(jobSteps).where(eq(jobSteps.jobId, jobId))).length >= 1);
    await requestCancel(db(), owner.userId, jobId);
    expect(await outcome).toBe("cancelled");
    const [job] = await db().select().from(researchJobs).where(eq(researchJobs.id, jobId));
    expect(job.status).toBe("cancelled");
  }, 30_000);

  it("a refresh adds a version, keeps the earlier one, and duplicate refresh clicks share one job", async () => {
    const owner = await createUser("owner", "demo");
    const { jobId } = await startResearch(db(), env(), owner, RICH, idem());
    await makeWorker().drain();
    const [job] = await db().select().from(researchJobs).where(eq(researchJobs.id, jobId));
    const before = (await getProfileView(db(), owner.userId, job.profileId!))!;

    const key = idem();
    const [r1, r2] = await Promise.all([
      refreshProfile(db(), env(), owner, job.profileId!, key),
      refreshProfile(db(), env(), owner, job.profileId!, key),
    ]);
    expect(r1).toBe(r2);
    expect(await makeWorker().drain()).toEqual(["completed"]);

    const after = (await getProfileView(db(), owner.userId, job.profileId!))!;
    expect(after.snapshots).toHaveLength(2);
    expect(after.snapshot.version).toBe(2);
    const v1 = (await getProfileView(db(), owner.userId, job.profileId!, before.snapshot.id))!;
    expect(v1.snapshot.version).toBe(1);
    expect(v1.claims.length).toBe(before.claims.length);
    expect(v1.snapshot.headline).toEqual(before.snapshot.headline);
  });
});

describe("provider failures end honestly", () => {
  const bundle = findFixtureBundle("javid-nuriyev")!;
  const original = structuredClone(bundle.person.failures);

  beforeEach(async () => {
    await resetDb();
  });
  afterEach(() => {
    bundle.person.failures = structuredClone(original);
  });

  it.each(["rate_limited", "timeout", "unavailable"] as const)("a %s news search gives a partial profile that says what is missing", async (kind) => {
    bundle.person.failures = [{ category: "news", kind, untilRetry: true }];
    const owner = await createUser("owner", "demo");
    const { jobId } = await startResearch(db(), env(), owner, { fullName: "Javid Nuriyev" }, idem());
    let outcomes = await makeWorker().drain();
    if (outcomes[0] === "awaiting_identity") {
      const [candidate] = (await getJobView(db(), owner.userId, jobId))!.candidates;
      await selectCandidate(db(), owner, jobId, candidate.id);
      outcomes = await makeWorker().drain();
    }
    expect(outcomes).toEqual(["partial"]);
    const view = (await getJobView(db(), owner.userId, jobId))!;
    expect(view.status).toBe("partial");
    const [failedNews] = await db().select().from(jobSteps).where(and(eq(jobSteps.jobId, jobId), eq(jobSteps.name, "search:news")));
    expect(failedNews?.status).toBe("failed");
    expect(failedNews?.errorCode).toBe(`fixture.${kind}`);
    const profile = (await getProfileView(db(), owner.userId, view.profileId!))!;
    expect(profile.snapshot.status).toBe("partial");
    expect(profile.snapshot.coverage.find((c) => c.category === "news")?.status).toBe("failed");
    expect(profile.snapshot.overview.gaps.some((g) => g.code === "search_failed_news")).toBe(true);
    // Everything that did succeed is kept.
    expect(profile.claims.length).toBeGreaterThan(0);
    const events = await db().select().from(jobEvents).where(eq(jobEvents.jobId, jobId));
    expect(events.some((e) => e.level === "warn" || e.level === "error")).toBe(true);
  });
});
