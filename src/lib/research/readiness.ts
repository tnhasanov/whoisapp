import { gt, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { workerHeartbeats } from "@/lib/db/schema";
import { getProviderStatus, type Env } from "@/lib/env";

/** Workers that checked in within this window count as online. */
export const WORKER_ONLINE_SECONDS = 60;

export type LiveReadiness = {
  /** Both provider keys are set for this (website) process. */
  configured: boolean;
  /** Research workers online now. */
  workersOnline: number;
  /**
   * Whether the online workers have both keys: false when any of them reports
   * missing keys (for example a hosted worker not redeployed after the keys were
   * added), null when none is online or none reports it.
   */
  workerReady: boolean | null;
  /** Live research can be started. */
  ready: boolean;
};

/**
 * Research runs in the worker, which reads its own copy of the provider keys.
 * The website only accepts live research when it has the keys and no online
 * worker reports them missing; with no worker online the run waits in the queue.
 */
export async function getLiveReadiness(db: Database, env: Env): Promise<LiveReadiness> {
  const configured = getProviderStatus(env).liveReady;
  const workers = await db
    .select({ liveReady: workerHeartbeats.liveReady })
    .from(workerHeartbeats)
    .where(gt(workerHeartbeats.lastSeenAt, sql`now() - make_interval(secs => ${WORKER_ONLINE_SECONDS})`));
  const reports = workers.map((w) => w.liveReady).filter((v): v is boolean => v !== null);
  const workerReady = reports.length === 0 ? null : reports.every(Boolean);
  return { configured, workersOnline: workers.length, workerReady, ready: configured && workerReady !== false };
}
