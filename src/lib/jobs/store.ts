import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  candidateIdentities,
  jobDocuments,
  jobEvents,
  jobSteps,
  researchJobs,
  type IdentityResolution,
  type JobUsageSummary,
  type StepOutput,
} from "@/lib/db/schema";
import type { JobStatus } from "@/lib/domain/types";
import { LeaseLostError } from "@/lib/research/providers/types";

export type JobRow = typeof researchJobs.$inferSelect;
export type NewJob = typeof researchJobs.$inferInsert;
export type StepRow = typeof jobSteps.$inferSelect;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbOrTx = Database | Tx;

/* ------------------------------- Creation -------------------------------- */

/** Idempotent: a repeated submission with the same key returns the existing job. */
export async function insertJob(db: Database, values: NewJob): Promise<{ job: JobRow; created: boolean }> {
  const inserted = await db
    .insert(researchJobs)
    .values(values)
    .onConflictDoNothing({ target: [researchJobs.ownerId, researchJobs.idempotencyKey] })
    .returning();
  if (inserted[0]) return { job: inserted[0], created: true };
  const [existing] = await db
    .select()
    .from(researchJobs)
    .where(and(eq(researchJobs.ownerId, values.ownerId), eq(researchJobs.idempotencyKey, values.idempotencyKey)));
  if (!existing) throw new Error("Job insert conflicted but no existing job was found.");
  return { job: existing, created: false };
}

/* ------------------------------- Claiming -------------------------------- */

/**
 * Claim the oldest runnable job. Also reclaims jobs whose lease expired
 * (worker died) while attempts remain. Every claim bumps the fencing token.
 */
export async function claimNextJob(db: Database, workerId: string, leaseSeconds: number): Promise<JobRow | null> {
  const result = await db.execute<{ id: string }>(sql`
    WITH next AS (
      SELECT id FROM research_jobs
      WHERE status = 'queued'
         OR (status = 'running' AND lease_expires_at < now() AND attempt + 1 < max_attempts AND cancel_requested_at IS NULL)
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE research_jobs AS j
    SET status = 'running',
        attempt = CASE WHEN j.status = 'running' THEN j.attempt + 1 ELSE j.attempt END,
        lease_owner = ${workerId},
        lease_token = j.lease_token + 1,
        lease_expires_at = now() + make_interval(secs => ${leaseSeconds}),
        heartbeat_at = now(),
        started_at = COALESCE(j.started_at, now()),
        last_progress_at = now(),
        updated_at = now()
    FROM next
    WHERE j.id = next.id
    RETURNING j.id
  `);
  const id = result.rows[0]?.id;
  if (!id) return null;
  const [job] = await db.select().from(researchJobs).where(eq(researchJobs.id, id));
  return job ?? null;
}

/** Extend the lease. Returns alive=false when another worker holds the job or it left "running". */
export async function heartbeat(
  db: Database,
  jobId: string,
  token: number,
  leaseSeconds: number,
): Promise<{ alive: boolean; cancelRequested: boolean }> {
  const result = await db.execute<{ cancel_requested_at: Date | null }>(sql`
    UPDATE research_jobs
    SET lease_expires_at = now() + make_interval(secs => ${leaseSeconds}), heartbeat_at = now()
    WHERE id = ${jobId} AND lease_token = ${token} AND status = 'running'
    RETURNING cancel_requested_at
  `);
  const row = result.rows[0];
  if (!row) return { alive: false, cancelRequested: false };
  return { alive: true, cancelRequested: row.cancel_requested_at !== null };
}

/**
 * Run `fn` in a transaction that first verifies (and locks) the caller's
 * lease. A worker that lost its lease, or whose job was cancelled or moved on,
 * gets LeaseLostError and must stop without writing.
 */
export async function withFence<T>(db: Database, jobId: string, token: number, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const locked = await tx.execute<{ id: string }>(sql`
      SELECT id FROM research_jobs
      WHERE id = ${jobId} AND lease_token = ${token} AND status = 'running'
      FOR UPDATE
    `);
    if (locked.rows.length === 0) throw new LeaseLostError();
    return fn(tx);
  });
}

/** Mark running jobs whose worker vanished: cancelled if cancellation was requested, otherwise failed after max attempts. */
export async function sweepStaleJobs(db: Database): Promise<string[]> {
  const result = await db.execute<{ id: string; status: JobStatus }>(sql`
    UPDATE research_jobs
    SET status = CASE WHEN cancel_requested_at IS NOT NULL THEN 'cancelled' ELSE 'failed' END,
        error_code = CASE WHEN cancel_requested_at IS NOT NULL THEN NULL ELSE 'worker_lost' END,
        error_message = CASE WHEN cancel_requested_at IS NOT NULL THEN NULL
          ELSE 'The research worker stopped responding. Completed steps were saved and can be reused by Retry.' END,
        lease_owner = NULL,
        lease_expires_at = NULL,
        finished_at = now(),
        updated_at = now()
    WHERE status = 'running'
      AND lease_expires_at < now()
      AND (attempt + 1 >= max_attempts OR cancel_requested_at IS NOT NULL)
    RETURNING id, status
  `);
  for (const row of result.rows) {
    await appendEvent(db, row.id, {
      level: row.status === "cancelled" ? "info" : "error",
      code: row.status === "cancelled" ? "job.cancelled" : "job.worker_lost",
      message:
        row.status === "cancelled"
          ? "Research cancelled."
          : "The research worker stopped responding. Completed steps were kept.",
    });
  }
  return result.rows.map((r) => r.id);
}

/** Give a job back to the queue (graceful worker shutdown) so another worker resumes from checkpoints. */
export async function releaseLease(db: Database, jobId: string, token: number): Promise<void> {
  await db.execute(sql`
    UPDATE research_jobs
    SET status = 'queued', lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
    WHERE id = ${jobId} AND lease_token = ${token} AND status = 'running'
  `);
}

/* --------------------------------- Steps --------------------------------- */

export async function loadSteps(db: DbOrTx, jobId: string): Promise<StepRow[]> {
  return db.select().from(jobSteps).where(eq(jobSteps.jobId, jobId)).orderBy(asc(jobSteps.seq));
}

export async function markStepRunning(
  tx: Tx,
  input: { jobId: string; name: string; stage: string; seq: number; optional: boolean },
): Promise<void> {
  await tx
    .insert(jobSteps)
    .values({
      jobId: input.jobId,
      name: input.name,
      stage: input.stage,
      seq: input.seq,
      optional: input.optional,
      status: "running",
      attempt: 1,
      startedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [jobSteps.jobId, jobSteps.name],
      set: {
        status: "running",
        attempt: sql`${jobSteps.attempt} + 1`,
        startedAt: new Date(),
        finishedAt: null,
        errorCode: null,
        errorMessage: null,
      },
    });
}

export async function markStepFinished(
  tx: Tx,
  input: {
    jobId: string;
    name: string;
    status: "completed" | "failed" | "skipped";
    output?: StepOutput | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    durationMs?: number;
  },
): Promise<void> {
  await tx
    .update(jobSteps)
    .set({
      status: input.status,
      output: input.output ?? null,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      finishedAt: new Date(),
      durationMs: input.durationMs ?? null,
    })
    .where(and(eq(jobSteps.jobId, input.jobId), eq(jobSteps.name, input.name)));
}

/* --------------------------------- Events -------------------------------- */

export type JobEventInput = {
  level?: "info" | "warn" | "error" | "debug";
  stage?: string | null;
  code: string;
  message: string;
  data?: Record<string, unknown>;
  visibility?: "user" | "diagnostic";
};

export async function appendEvent(db: DbOrTx, jobId: string, event: JobEventInput): Promise<void> {
  await db.insert(jobEvents).values({
    jobId,
    level: event.level ?? "info",
    stage: event.stage ?? null,
    code: event.code,
    message: event.message,
    data: event.data ?? null,
    visibility: event.visibility ?? "user",
  });
}

/* ------------------------------- Transitions ----------------------------- */

export async function finishJob(
  tx: Tx,
  jobId: string,
  input: {
    status: "completed" | "partial" | "failed" | "cancelled";
    outcome?: JobRow["outcome"];
    snapshotId?: string | null;
    profileId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    usage?: JobUsageSummary | null;
  },
): Promise<void> {
  await tx
    .update(researchJobs)
    .set({
      status: input.status,
      outcome: input.outcome ?? null,
      snapshotId: input.snapshotId ?? undefined,
      profileId: input.profileId ?? undefined,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      usage: input.usage ?? undefined,
      leaseOwner: null,
      leaseExpiresAt: null,
      currentStage: null,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(researchJobs.id, jobId));
}

export async function pauseForIdentity(tx: Tx, jobId: string, usage: JobUsageSummary | null): Promise<void> {
  await tx
    .update(researchJobs)
    .set({
      status: "awaiting_identity",
      phase: "research",
      leaseOwner: null,
      leaseExpiresAt: null,
      currentStage: "resolve",
      usage: usage ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(researchJobs.id, jobId));
}

export async function setJobStage(tx: Tx, jobId: string, stage: string): Promise<void> {
  await tx
    .update(researchJobs)
    .set({ currentStage: stage, lastProgressAt: new Date(), updatedAt: new Date() })
    .where(eq(researchJobs.id, jobId));
}

export async function setSelectedCandidate(
  tx: Tx,
  jobId: string,
  candidateId: string,
  resolution: IdentityResolution,
): Promise<void> {
  await tx
    .update(researchJobs)
    .set({ selectedCandidateId: candidateId, identityResolution: resolution, phase: "research", updatedAt: new Date() })
    .where(eq(researchJobs.id, jobId));
}

/* ---------------------------- Owner-side actions -------------------------- */

/** Cancel: immediate for queued/awaiting jobs; a running job is stopped by its worker at the next checkpoint. */
export async function requestCancel(db: Database, ownerId: string, jobId: string): Promise<JobStatus | null> {
  const result = await db.execute<{ status: JobStatus }>(sql`
    UPDATE research_jobs
    SET status = CASE WHEN status IN ('queued', 'awaiting_identity') THEN 'cancelled' ELSE status END,
        finished_at = CASE WHEN status IN ('queued', 'awaiting_identity') THEN now() ELSE finished_at END,
        cancel_requested_at = COALESCE(cancel_requested_at, now()),
        updated_at = now()
    WHERE id = ${jobId} AND owner_id = ${ownerId} AND status IN ('queued', 'running', 'awaiting_identity')
    RETURNING status
  `);
  const status = result.rows[0]?.status ?? null;
  if (status) {
    await appendEvent(db, jobId, {
      code: status === "cancelled" ? "job.cancelled" : "job.cancel_requested",
      message: status === "cancelled" ? "Research cancelled." : "Cancellation requested; stopping at the next safe point.",
    });
  }
  return status;
}

/** Owner picks a candidate. Only one transition can win, so double clicks are harmless. */
export async function chooseCandidate(db: Database, ownerId: string, jobId: string, candidateId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({ id: candidateIdentities.id })
      .from(candidateIdentities)
      .where(and(eq(candidateIdentities.id, candidateId), eq(candidateIdentities.jobId, jobId), eq(candidateIdentities.ownerId, ownerId)));
    if (!candidate) return false;
    const updated = await tx
      .update(researchJobs)
      .set({
        status: "queued",
        phase: "research",
        selectedCandidateId: candidateId,
        identityResolution: { method: "user_selected", reason: "Chosen by the owner on the identity-selection screen.", decidedAt: new Date().toISOString() },
        updatedAt: new Date(),
      })
      .where(and(eq(researchJobs.id, jobId), eq(researchJobs.ownerId, ownerId), eq(researchJobs.status, "awaiting_identity")))
      .returning({ id: researchJobs.id });
    if (updated.length === 0) return false;
    await appendEvent(tx, jobId, { stage: "resolve", code: "identity.selected", message: "Identity chosen; research continues." });
    return true;
  });
}

/** "None of these": close the job without researching anyone. */
export async function dismissCandidates(db: Database, ownerId: string, jobId: string): Promise<boolean> {
  const updated = await db
    .update(researchJobs)
    .set({ status: "cancelled", outcome: "refined", finishedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(researchJobs.id, jobId), eq(researchJobs.ownerId, ownerId), eq(researchJobs.status, "awaiting_identity")))
    .returning({ id: researchJobs.id });
  if (updated.length > 0) {
    await appendEvent(db, jobId, { stage: "resolve", code: "identity.none", message: "None of the candidates matched; search refined." });
  }
  return updated.length > 0;
}

/** Steps whose checkpoints are safe to reuse in a retry/reopen job. */
export function isReusableStep(step: StepRow): boolean {
  if (step.status !== "completed") return false;
  return (
    step.name === "normalise" ||
    step.name.startsWith("discover:") ||
    step.name === "resolve" ||
    step.name === "plan" ||
    step.name.startsWith("search:")
  );
}

/**
 * Copy reusable checkpoints, retrieved documents and candidates from a parent
 * job into a child job (retry, or reopening identity choice).
 */
export async function copyCheckpoints(
  tx: Tx,
  parentJobId: string,
  childJobId: string,
  options: { includeResolve: boolean },
): Promise<{ candidateIdMap: Map<string, string> }> {
  const steps = await loadSteps(tx, parentJobId);
  const reusable = steps.filter((s) => isReusableStep(s) && (options.includeResolve || s.name !== "resolve"));
  if (reusable.length > 0) {
    await tx.insert(jobSteps).values(
      reusable.map((s) => ({
        jobId: childJobId,
        name: s.name,
        stage: s.stage,
        seq: s.seq,
        status: "completed" as const,
        optional: s.optional,
        attempt: s.attempt,
        output: s.output,
        reused: true,
        startedAt: s.startedAt,
        finishedAt: s.finishedAt,
        durationMs: s.durationMs,
      })),
    );
  }
  const docs = await tx.select().from(jobDocuments).where(eq(jobDocuments.jobId, parentJobId));
  if (docs.length > 0) {
    await tx.insert(jobDocuments).values(
      docs.map(({ id: _id, jobId: _job, ...rest }) => ({ ...rest, jobId: childJobId })),
    );
  }
  const candidates = await tx.select().from(candidateIdentities).where(eq(candidateIdentities.jobId, parentJobId));
  const candidateIdMap = new Map<string, string>();
  for (const { id, jobId: _job, ...rest } of candidates) {
    const [row] = await tx
      .insert(candidateIdentities)
      .values({ ...rest, jobId: childJobId })
      .returning({ id: candidateIdentities.id });
    candidateIdMap.set(id, row.id);
  }
  return { candidateIdMap };
}

export async function deleteJobsCascade(tx: Tx, jobIds: string[]): Promise<void> {
  if (jobIds.length === 0) return;
  await tx.delete(researchJobs).where(inArray(researchJobs.id, jobIds));
}
