import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { candidateIdentities, jobDocuments, jobEvents, jobSteps, researchJobs, workerHeartbeats, type IdentityResolution } from "@/lib/db/schema";
import { STAGES, type JobStatus, type Stage } from "@/lib/domain/types";

export type StageView = { stage: Stage; status: "pending" | "running" | "completed" | "failed" | "skipped" | "partial" };

export type JobView = {
  id: string;
  workspace: "live" | "demo";
  kind: string;
  status: JobStatus;
  outcome: string | null;
  phase: string;
  currentStage: string | null;
  query: { fullName: string; company: string | null; country: string | null; profileUrl: string | null };
  profileId: string | null;
  snapshotId: string | null;
  parentJobId: string | null;
  retriedById: string | null;
  identityResolution: IdentityResolution | null;
  selectedCandidateId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  cancelRequested: boolean;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastProgressAt: string | null;
  stages: StageView[];
  steps: { name: string; stage: string; status: string; reused: boolean; errorMessage: string | null; durationMs: number | null }[];
  events: { id: number; at: string; level: string; stage: string | null; code: string; message: string; data: Record<string, unknown> | null }[];
  sources: { total: number; read: number; limited: number };
  candidates: CandidateView[];
  usage: { searchRequests: number; extractRequests: number; modelCalls: number; inputTokens: number; outputTokens: number; credits: number; estimatedCostUsd: number } | null;
  /** Seconds since the worker last touched this job (null when not running). */
  heartbeatAgeSeconds: number | null;
  workerOnline: boolean;
  queuedSeconds: number | null;
};

export type CandidateView = {
  id: string;
  rank: number;
  displayName: string;
  nativeName: string | null;
  organisation: string | null;
  role: string | null;
  location: string | null;
  summary: string | null;
  matchStrength: "strong" | "moderate" | "weak";
  matchReasons: { code: string; text: string; sourceKeys: string[] }[];
  distinguishingFacts: string[];
  sourceRefs: { key: string; url: string; title: string | null; publisher: string | null; fixtureKey?: string | null }[];
  autoSelected: boolean;
};

const STAGE_OF_STEP = (name: string): Stage => {
  if (name === "normalise") return "normalise";
  if (name.startsWith("discover:")) return "discover";
  if (name === "resolve") return "resolve";
  if (name === "plan") return "plan";
  if (name.startsWith("search:")) return "search";
  if (name === "retrieve") return "retrieve";
  if (name.startsWith("extract:")) return "extract";
  if (name === "verify") return "verify";
  if (name === "synthesise") return "synthesise";
  return "persist";
};

export async function getJobView(db: Database, ownerId: string, jobId: string, options: { afterEventId?: number } = {}): Promise<JobView | null> {
  const [job] = await db.select().from(researchJobs).where(and(eq(researchJobs.id, jobId), eq(researchJobs.ownerId, ownerId)));
  if (!job) return null;
  const [steps, events, docStats, candidates, child, worker] = await Promise.all([
    db.select().from(jobSteps).where(eq(jobSteps.jobId, job.id)).orderBy(asc(jobSteps.seq), asc(jobSteps.name)),
    db
      .select()
      .from(jobEvents)
      .where(and(eq(jobEvents.jobId, job.id), eq(jobEvents.visibility, "user"), options.afterEventId ? gt(jobEvents.id, options.afterEventId) : undefined))
      .orderBy(desc(jobEvents.id))
      .limit(60),
    db
      .select({
        total: sql<number>`count(*)::int`,
        read: sql<number>`count(*) filter (where ${jobDocuments.accessStatus} = 'read')::int`,
        limited: sql<number>`count(*) filter (where ${jobDocuments.accessStatus} in ('login_required','paywalled','blocked','failed'))::int`,
      })
      .from(jobDocuments)
      .where(eq(jobDocuments.jobId, job.id)),
    db.select().from(candidateIdentities).where(eq(candidateIdentities.jobId, job.id)).orderBy(asc(candidateIdentities.rank)),
    db.select({ id: researchJobs.id }).from(researchJobs).where(and(eq(researchJobs.parentJobId, job.id), eq(researchJobs.ownerId, ownerId))).orderBy(desc(researchJobs.createdAt)).limit(1),
    db.select({ id: workerHeartbeats.workerId }).from(workerHeartbeats).where(gt(workerHeartbeats.lastSeenAt, new Date(Date.now() - 60_000))).limit(1),
  ]);

  const stageStatus = new Map<Stage, StageView["status"]>();
  for (const stage of STAGES) stageStatus.set(stage, "pending");
  for (const step of steps) {
    const stage = STAGE_OF_STEP(step.name);
    const current = stageStatus.get(stage)!;
    const s = step.status;
    const next: StageView["status"] =
      s === "running"
        ? "running"
        : s === "failed"
          ? step.optional
            ? current === "running"
              ? "running"
              : "partial"
            : "failed"
          : s === "completed"
            ? current === "pending" || current === "completed"
              ? "completed"
              : current
            : current;
    stageStatus.set(stage, next);
  }
  // Research phase only runs after identity resolution; discovery stages are skipped on refresh jobs.
  if (job.kind === "refresh" || (job.phase === "research" && !steps.some((s) => s.name === "normalise"))) {
    for (const stage of ["normalise", "discover", "resolve"] as Stage[]) if (stageStatus.get(stage) === "pending") stageStatus.set(stage, "skipped");
  }
  if (job.status === "awaiting_identity") stageStatus.set("resolve", "running");

  const now = Date.now();
  return {
    id: job.id,
    workspace: job.workspace,
    kind: job.kind,
    status: job.status,
    outcome: job.outcome,
    phase: job.phase,
    currentStage: job.currentStage,
    query: job.query,
    profileId: job.profileId,
    snapshotId: job.snapshotId,
    parentJobId: job.parentJobId,
    retriedById: child[0]?.id ?? null,
    identityResolution: job.identityResolution ?? null,
    selectedCandidateId: job.selectedCandidateId,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    cancelRequested: Boolean(job.cancelRequestedAt),
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    lastProgressAt: job.lastProgressAt?.toISOString() ?? null,
    stages: STAGES.map((stage) => ({ stage, status: stageStatus.get(stage)! })),
    steps: steps.map((s) => ({ name: s.name, stage: s.stage, status: s.status, reused: s.reused, errorMessage: s.errorMessage, durationMs: s.durationMs })),
    events: events.reverse().map((e) => ({ id: e.id, at: e.createdAt.toISOString(), level: e.level, stage: e.stage, code: e.code, message: e.message, data: e.data })),
    sources: docStats[0] ?? { total: 0, read: 0, limited: 0 },
    candidates: candidates.map((c) => ({
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
      sourceRefs: c.sourceRefs,
      autoSelected: c.autoSelected,
    })),
    usage: job.usage ?? null,
    heartbeatAgeSeconds: job.status === "running" && job.heartbeatAt ? Math.round((now - job.heartbeatAt.getTime()) / 1000) : null,
    workerOnline: worker.length > 0,
    queuedSeconds: job.status === "queued" ? Math.round((now - job.updatedAt.getTime()) / 1000) : null,
  };
}

export type JobListItem = {
  id: string;
  workspace: "live" | "demo";
  kind: string;
  status: JobStatus;
  outcome: string | null;
  fullName: string;
  company: string | null;
  profileId: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export async function listJobs(db: Database, ownerId: string, workspace: "live" | "demo", limit = 50): Promise<JobListItem[]> {
  const rows = await db
    .select()
    .from(researchJobs)
    .where(and(eq(researchJobs.ownerId, ownerId), eq(researchJobs.workspace, workspace)))
    .orderBy(desc(researchJobs.createdAt))
    .limit(limit);
  return rows.map((j) => ({
    id: j.id,
    workspace: j.workspace,
    kind: j.kind,
    status: j.status,
    outcome: j.outcome,
    fullName: j.query.fullName,
    company: j.query.company,
    profileId: j.profileId,
    createdAt: j.createdAt.toISOString(),
    finishedAt: j.finishedAt?.toISOString() ?? null,
  }));
}

export type JobPageItem = JobListItem & { query: JobView["query"] };

/**
 * Keyset-paginated research history (newest first). The cursor is the last
 * item's (createdAt, id), so pages stay stable while new runs are added.
 */
export async function listJobsPage(
  db: Database,
  ownerId: string,
  workspace: "live" | "demo",
  options: { limit: number; after?: { createdAt: string; id: string } | null; statuses?: JobStatus[] | null },
): Promise<{ items: JobPageItem[]; hasMore: boolean }> {
  const after = options.after;
  const rows = await db
    .select()
    .from(researchJobs)
    .where(
      and(
        eq(researchJobs.ownerId, ownerId),
        eq(researchJobs.workspace, workspace),
        options.statuses && options.statuses.length > 0 ? inArray(researchJobs.status, options.statuses) : undefined,
        // Compared at millisecond precision, the precision of the cursor's ISO timestamp.
        after ? sql`(date_trunc('milliseconds', ${researchJobs.createdAt}), ${researchJobs.id}) < (${new Date(after.createdAt).toISOString()}::timestamptz, ${after.id}::uuid)` : undefined,
      ),
    )
    .orderBy(desc(sql`date_trunc('milliseconds', ${researchJobs.createdAt})`), desc(researchJobs.id))
    .limit(options.limit + 1);
  const items = rows.slice(0, options.limit).map((j) => ({
    id: j.id,
    workspace: j.workspace,
    kind: j.kind,
    status: j.status,
    outcome: j.outcome,
    fullName: j.query.fullName,
    company: j.query.company,
    query: j.query,
    profileId: j.profileId,
    createdAt: j.createdAt.toISOString(),
    finishedAt: j.finishedAt?.toISOString() ?? null,
  }));
  return { items, hasMore: rows.length > options.limit };
}

export async function recentSearches(db: Database, ownerId: string, workspace: "live" | "demo", limit = 6) {
  const rows = await db
    .select({ id: researchJobs.id, query: researchJobs.query, status: researchJobs.status, createdAt: researchJobs.createdAt, profileId: researchJobs.profileId, kind: researchJobs.kind })
    .from(researchJobs)
    .where(and(eq(researchJobs.ownerId, ownerId), eq(researchJobs.workspace, workspace), inArray(researchJobs.kind, ["search"])))
    .orderBy(desc(researchJobs.createdAt))
    .limit(limit * 3);
  const seen = new Set<string>();
  const out: { id: string; fullName: string; company: string | null; status: JobStatus; createdAt: string; profileId: string | null }[] = [];
  for (const r of rows) {
    const key = `${r.query.fullName.toLowerCase()}|${(r.query.company ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: r.id, fullName: r.query.fullName, company: r.query.company, status: r.status, createdAt: r.createdAt.toISOString(), profileId: r.profileId });
    if (out.length >= limit) break;
  }
  return out;
}
