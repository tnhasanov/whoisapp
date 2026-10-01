import { randomBytes } from "node:crypto";
import { hostname } from "node:os";
import { and, eq, lt, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { appRateLimits, users, workerHeartbeats } from "@/lib/db/schema";
import type { Env } from "@/lib/env";
import { claimNextJob, heartbeat, releaseLease, sweepStaleJobs, type JobRow } from "@/lib/jobs/store";
import { purgeExpiredCache } from "@/lib/research/cache";
import { purgeExpiredDocumentContent } from "@/lib/research/pipeline/documents";
import { runJob, type RunOutcome } from "@/lib/research/pipeline/run";

export type WorkerOptions = {
  db: Database;
  env: Env;
  workerId?: string;
  concurrency?: number;
  leaseSeconds?: number;
  pollMs?: number;
  gracefulShutdownMs?: number;
  log?: (message: string, extra?: Record<string, unknown>) => void;
};

type ActiveJob = { job: JobRow; controller: AbortController; reason: "cancelled" | "lease_lost" | "shutdown" | null; done: Promise<void> };

/**
 * Durable research worker. All state lives in Postgres: a crash or restart
 * loses at most the in-flight step, which another worker resumes from the
 * last checkpoint once the lease expires.
 */
export class ResearchWorker {
  readonly workerId: string;
  private readonly db: Database;
  private readonly env: Env;
  private readonly concurrency: number;
  private readonly leaseSeconds: number;
  private readonly pollMs: number;
  private readonly gracefulShutdownMs: number;
  private readonly log: NonNullable<WorkerOptions["log"]>;
  private readonly active = new Map<string, ActiveJob>();
  private stopping = false;
  private loopPromise: Promise<void> | null = null;
  private lastSweep = 0;
  private lastHousekeeping = 0;
  private lastPresence = 0;
  private readonly startedAt = new Date();

  constructor(options: WorkerOptions) {
    this.db = options.db;
    this.env = options.env;
    this.workerId = options.workerId ?? `${hostname()}-${process.pid}-${randomBytes(3).toString("hex")}`;
    this.concurrency = options.concurrency ?? options.env.WORKER_CONCURRENCY;
    this.leaseSeconds = options.leaseSeconds ?? options.env.WORKER_LEASE_SECONDS;
    this.pollMs = options.pollMs ?? options.env.WORKER_POLL_MS;
    this.gracefulShutdownMs = options.gracefulShutdownMs ?? 20_000;
    this.log = options.log ?? ((message, extra) => console.log(`[worker ${this.workerId}] ${message}`, extra ? JSON.stringify(extra) : ""));
  }

  start(): Promise<void> {
    this.loopPromise ??= this.loop();
    return this.loopPromise;
  }

  private async loop() {
    this.log("started", { concurrency: this.concurrency, leaseSeconds: this.leaseSeconds });
    while (!this.stopping) {
      try {
        await this.maintenance();
        let claimed = false;
        while (!this.stopping && this.active.size < this.concurrency) {
          const job = await claimNextJob(this.db, this.workerId, this.leaseSeconds);
          if (!job) break;
          claimed = true;
          this.launch(job);
        }
        if (!claimed) await new Promise((r) => setTimeout(r, this.pollMs));
      } catch (error) {
        this.log("loop error", { error: error instanceof Error ? error.message : String(error) });
        await new Promise((r) => setTimeout(r, Math.max(this.pollMs, 2_000)));
      }
    }
  }

  private launch(job: JobRow) {
    const controller = new AbortController();
    const entry: ActiveJob = { job, controller, reason: null, done: Promise.resolve() };
    entry.done = this.execute(entry)
      .then(() => undefined)
      .catch((error) => this.log("job crashed", { jobId: job.id, error: error instanceof Error ? error.message : String(error) }))
      .finally(() => this.active.delete(job.id));
    this.active.set(job.id, entry);
  }

  private async execute(entry: ActiveJob): Promise<RunOutcome> {
    const { job, controller } = entry;
    this.log("claimed job", { jobId: job.id, phase: job.phase, attempt: job.attempt, token: job.leaseToken });
    const beatEvery = Math.max(1_000, Math.floor((this.leaseSeconds * 1000) / 3));
    const beat = setInterval(() => {
      heartbeat(this.db, job.id, job.leaseToken, this.leaseSeconds)
        .then((hb) => {
          if (!hb.alive) {
            entry.reason ??= "lease_lost";
            controller.abort();
          } else if (hb.cancelRequested) {
            entry.reason ??= "cancelled";
            controller.abort();
          }
        })
        .catch((error) => this.log("heartbeat failed", { jobId: job.id, error: error instanceof Error ? error.message : String(error) }));
    }, beatEvery);
    try {
      if (job.cancelRequestedAt) {
        entry.reason = "cancelled";
        controller.abort();
      }
      const outcome = await runJob({
        db: this.db,
        env: this.env,
        job,
        token: job.leaseToken,
        signal: controller.signal,
        abortReason: () => entry.reason,
        log: this.log,
      });
      if (outcome === "released") await releaseLease(this.db, job.id, job.leaseToken);
      this.log("job finished", { jobId: job.id, outcome });
      return outcome;
    } finally {
      clearInterval(beat);
    }
  }

  /** Claim and run at most one job to completion (used by tests and one-shot runs). */
  async runOnce(): Promise<RunOutcome | null> {
    const job = await claimNextJob(this.db, this.workerId, this.leaseSeconds);
    if (!job) return null;
    const entry: ActiveJob = { job, controller: new AbortController(), reason: null, done: Promise.resolve() };
    this.active.set(job.id, entry);
    try {
      return await this.execute(entry);
    } finally {
      this.active.delete(job.id);
    }
  }

  /** Run queued jobs until the queue is empty (tests / CLI). */
  async drain(maxJobs = 50): Promise<RunOutcome[]> {
    const outcomes: RunOutcome[] = [];
    for (let i = 0; i < maxJobs; i++) {
      const outcome = await this.runOnce();
      if (!outcome) break;
      outcomes.push(outcome);
    }
    return outcomes;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    const deadline = Date.now() + this.gracefulShutdownMs;
    while (this.active.size > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
    }
    for (const entry of this.active.values()) {
      entry.reason ??= "shutdown";
      entry.controller.abort();
    }
    await Promise.allSettled([...this.active.values()].map((e) => e.done));
    await this.loopPromise?.catch(() => undefined);
    await this.db.delete(workerHeartbeats).where(eq(workerHeartbeats.workerId, this.workerId)).catch(() => undefined);
    this.log("stopped");
  }

  private async maintenance() {
    const now = Date.now();
    if (now - this.lastPresence > 15_000) {
      this.lastPresence = now;
      await this.db
        .insert(workerHeartbeats)
        .values({ workerId: this.workerId, hostname: hostname(), startedAt: this.startedAt, lastSeenAt: new Date(), activeJobs: this.active.size, version: process.env.npm_package_version ?? null })
        .onConflictDoUpdate({ target: workerHeartbeats.workerId, set: { lastSeenAt: new Date(), activeJobs: this.active.size } });
    }
    if (now - this.lastSweep > 30_000) {
      this.lastSweep = now;
      const swept = await sweepStaleJobs(this.db);
      if (swept.length > 0) this.log("marked stale jobs", { count: swept.length });
    }
    if (now - this.lastHousekeeping > 10 * 60_000) {
      this.lastHousekeeping = now;
      await runHousekeeping(this.db, this.env, this.log);
    }
  }
}

/** Retention and cleanup. Safe to run from several workers concurrently. */
export async function runHousekeeping(db: Database, env: Env, log: (m: string, e?: Record<string, unknown>) => void = () => undefined) {
  const contentPurged = await purgeExpiredDocumentContent(db);
  const cachePurged = await purgeExpiredCache(db);
  const guestCutoff = new Date(Date.now() - env.DEMO_GUEST_TTL_HOURS * 3_600_000);
  const guests = await db
    .delete(users)
    .where(and(eq(users.role, "demo"), eq(users.isAnonymous, true), lt(users.createdAt, guestCutoff)))
    .returning({ id: users.id });
  await db.delete(appRateLimits).where(lt(appRateLimits.windowStart, new Date(Date.now() - 2 * 86_400_000)));
  await db.delete(workerHeartbeats).where(lt(workerHeartbeats.lastSeenAt, new Date(Date.now() - 86_400_000)));
  await db.execute(sql`DELETE FROM auth_sessions WHERE expires_at < now() - interval '1 day'`);
  if (contentPurged || cachePurged || guests.length) {
    log("housekeeping", { contentPurged, cachePurged, demoGuestsRemoved: guests.length });
  }
}
