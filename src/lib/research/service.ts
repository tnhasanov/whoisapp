import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/client";
import {
  candidateIdentities,
  ownerSettings,
  profiles,
  researchJobs,
  snapshots,
  type JobConfig,
  type ResearchQuery,
} from "@/lib/db/schema";
import type { UserRole, Workspace } from "@/lib/domain/types";
import type { Env } from "@/lib/env";
import {
  appendEvent,
  chooseCandidate,
  copyCheckpoints,
  dismissCandidates,
  insertJob,
  requestCancel,
  type JobRow,
} from "@/lib/jobs/store";
import { consumeRateLimit } from "@/lib/rate-limit";
import { buildJobConfig } from "@/lib/research/config";
import { cacheKey } from "@/lib/research/cache";
import { getLiveReadiness } from "@/lib/research/readiness";
import { normaliseForMatch } from "@/lib/research/text";
import { canonicaliseUrl } from "@/lib/urls/canonical";
import { validateProfileUrl } from "@/lib/urls/safe-url";
import { SearchInputSchema, type SearchInput } from "@personbrief/shared/research/search-input";

/**
 * Research commands used by server actions. Every function takes the
 * authenticated actor explicitly and enforces ownership and workspace rules
 * itself — UI visibility is never relied on for authorisation.
 */

export type Actor = { userId: string; role: UserRole; workspace: Workspace };

export class ResearchCommandError extends Error {
  constructor(
    readonly code:
      | "invalid_input"
      | "live_not_configured"
      | "live_not_allowed"
      | "rate_limited"
      | "not_found"
      | "invalid_state",
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ResearchCommandError";
  }
}

export { SearchInputSchema, type SearchInput };

export function parseSearchInput(raw: SearchInput): ResearchQuery {
  const parsed = SearchInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    throw new ResearchCommandError("invalid_input", "Please correct the highlighted fields.", fieldErrors);
  }
  let profileUrl: string | null = null;
  if (parsed.data.profileUrl) {
    const check = validateProfileUrl(parsed.data.profileUrl);
    if (!check.ok) {
      throw new ResearchCommandError("invalid_input", "Please correct the highlighted fields.", {
        profileUrl: check.reason === "scheme" ? "url_scheme" : check.reason === "credentials" ? "url_credentials" : "url_private",
      });
    }
    profileUrl = check.url.toString();
  }
  return { fullName: parsed.data.fullName, company: parsed.data.company, country: parsed.data.country, profileUrl };
}

export function queryKeyFor(query: ResearchQuery): string {
  return cacheKey({
    name: normaliseForMatch(query.fullName),
    company: query.company ? normaliseForMatch(query.company) : null,
    country: query.country ? normaliseForMatch(query.country) : null,
    profile: query.profileUrl ? canonicaliseUrl(query.profileUrl) : null,
  }).slice(0, 24);
}

async function ownerLimits(db: Database, userId: string) {
  const [settings] = await db.select({ limits: ownerSettings.researchLimits }).from(ownerSettings).where(eq(ownerSettings.userId, userId));
  return settings?.limits ?? {};
}

async function enforceWorkspaceRules(db: Database, env: Env, actor: Actor) {
  if (actor.workspace === "live") {
    if (actor.role !== "owner") throw new ResearchCommandError("live_not_allowed", "Live research is only available to the owner account.");
    const readiness = await getLiveReadiness(db, env);
    if (!readiness.configured) {
      throw new ResearchCommandError("live_not_configured", "Live research is not configured yet. Add the provider keys, or switch to the demo workspace.");
    }
    if (!readiness.ready) {
      throw new ResearchCommandError("live_not_configured", "The research worker does not have the provider keys yet. Restart or redeploy the worker, then try again.");
    }
  }
  const limit = actor.workspace === "live" ? env.RESEARCH_MAX_JOBS_PER_HOUR : 120;
  const rate = await consumeRateLimit(db, `research:${actor.userId}:${actor.workspace}`, limit, 3600);
  if (!rate.allowed) throw new ResearchCommandError("rate_limited", "Too many research runs this hour. Please wait and try again.");
}

/** Start research. The job row is persisted before any external call is made. */
export async function startResearch(
  db: Database,
  env: Env,
  actor: Actor,
  raw: SearchInput,
  idempotencyKey: string,
): Promise<{ jobId: string; created: boolean }> {
  const query = parseSearchInput(raw);
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(idempotencyKey)) throw new ResearchCommandError("invalid_input", "Invalid request token.");
  const [existing] = await db
    .select({ id: researchJobs.id })
    .from(researchJobs)
    .where(and(eq(researchJobs.ownerId, actor.userId), eq(researchJobs.idempotencyKey, idempotencyKey)));
  if (existing) return { jobId: existing.id, created: false };

  await enforceWorkspaceRules(db, env, actor);
  const config = buildJobConfig(env, actor.workspace, await ownerLimits(db, actor.userId));
  const { job, created } = await insertJob(db, {
    ownerId: actor.userId,
    workspace: actor.workspace,
    kind: "search",
    status: "queued",
    phase: "discovery",
    query,
    queryKey: queryKeyFor(query),
    idempotencyKey,
    config,
    maxAttempts: env.JOB_MAX_ATTEMPTS,
  });
  if (created) await appendEvent(db, job.id, { code: "job.queued", message: "Research queued." });
  return { jobId: job.id, created };
}

export async function loadOwnedJob(db: Database, actor: Pick<Actor, "userId">, jobId: string): Promise<JobRow> {
  if (!z.string().uuid().safeParse(jobId).success) throw new ResearchCommandError("not_found", "Research not found.");
  const [job] = await db.select().from(researchJobs).where(and(eq(researchJobs.id, jobId), eq(researchJobs.ownerId, actor.userId)));
  if (!job) throw new ResearchCommandError("not_found", "Research not found.");
  return job;
}

export async function selectCandidate(db: Database, actor: Actor, jobId: string, candidateId: string): Promise<void> {
  await loadOwnedJob(db, actor, jobId);
  if (!z.string().uuid().safeParse(candidateId).success) throw new ResearchCommandError("not_found", "Candidate not found.");
  const ok = await chooseCandidate(db, actor.userId, jobId, candidateId);
  if (!ok) {
    const job = await loadOwnedJob(db, actor, jobId);
    // A duplicate click after the first selection succeeded is not an error.
    if (job.selectedCandidateId === candidateId) return;
    throw new ResearchCommandError("invalid_state", "This research is no longer waiting for an identity choice.");
  }
}

export async function refineSearch(db: Database, actor: Actor, jobId: string): Promise<ResearchQuery> {
  const job = await loadOwnedJob(db, actor, jobId);
  await dismissCandidates(db, actor.userId, jobId);
  return job.query;
}

export async function cancelResearch(db: Database, actor: Actor, jobId: string) {
  await loadOwnedJob(db, actor, jobId);
  return requestCancel(db, actor.userId, jobId);
}

/** Retry a failed, partial or cancelled job, reusing its successful checkpoints. */
export async function retryResearch(db: Database, env: Env, actor: Actor, jobId: string, idempotencyKey: string): Promise<string> {
  const parent = await loadOwnedJob(db, actor, jobId);
  if (!["failed", "partial", "cancelled"].includes(parent.status) || parent.outcome === "refined") {
    throw new ResearchCommandError("invalid_state", "Only failed, partial or cancelled research can be retried.");
  }
  await enforceWorkspaceRules(db, env, { ...actor, workspace: parent.workspace });
  return db.transaction(async (tx) => {
    const [child] = await tx
      .insert(researchJobs)
      .values({
        ownerId: actor.userId,
        workspace: parent.workspace,
        kind: "retry",
        parentJobId: parent.id,
        // A retry adds its snapshot to the same profile as the run it retries (if any).
        profileId: parent.profileId,
        status: "queued",
        phase: parent.selectedCandidateId ? "research" : "discovery",
        query: parent.query,
        queryKey: parent.queryKey,
        idempotencyKey,
        config: parent.config,
        identityResolution: parent.identityResolution,
        maxAttempts: env.JOB_MAX_ATTEMPTS,
      })
      .onConflictDoNothing({ target: [researchJobs.ownerId, researchJobs.idempotencyKey] })
      .returning();
    if (!child) {
      const [existing] = await tx
        .select({ id: researchJobs.id })
        .from(researchJobs)
        .where(and(eq(researchJobs.ownerId, actor.userId), eq(researchJobs.idempotencyKey, idempotencyKey)));
      return existing.id;
    }
    const { candidateIdMap } = await copyCheckpoints(tx, parent.id, child.id, { includeResolve: true });
    if (parent.selectedCandidateId) {
      const mapped = candidateIdMap.get(parent.selectedCandidateId) ?? null;
      await tx.update(researchJobs).set({ selectedCandidateId: mapped, phase: mapped ? "research" : "discovery" }).where(eq(researchJobs.id, child.id));
    }
    await appendEvent(tx, child.id, { code: "job.retry_queued", message: "Retry queued; completed steps from the previous run will be reused.", data: { parentJobId: parent.id } });
    await appendEvent(tx, parent.id, { code: "job.retried", message: "A retry was started.", data: { childJobId: child.id } });
    return child.id;
  });
}

/**
 * Re-open identity choice after an automatic selection: a new job with the
 * same candidates, waiting for the owner, with automatic selection disabled.
 */
export async function reopenIdentityChoice(db: Database, env: Env, actor: Actor, jobId: string, idempotencyKey: string): Promise<string> {
  const parent = await loadOwnedJob(db, actor, jobId);
  const candidates = await db.select({ id: candidateIdentities.id }).from(candidateIdentities).where(eq(candidateIdentities.jobId, parent.id));
  if (candidates.length === 0) throw new ResearchCommandError("invalid_state", "There are no other candidates for this search.");
  return db.transaction(async (tx) => {
    const [child] = await tx
      .insert(researchJobs)
      .values({
        ownerId: actor.userId,
        workspace: parent.workspace,
        kind: "search",
        parentJobId: parent.id,
        status: "awaiting_identity",
        phase: "research",
        currentStage: "resolve",
        query: parent.query,
        queryKey: parent.queryKey,
        idempotencyKey,
        config: { ...parent.config, autoSelect: false } satisfies JobConfig,
        maxAttempts: env.JOB_MAX_ATTEMPTS,
        startedAt: new Date(),
      })
      .onConflictDoNothing({ target: [researchJobs.ownerId, researchJobs.idempotencyKey] })
      .returning();
    if (!child) {
      const [existing] = await tx
        .select({ id: researchJobs.id })
        .from(researchJobs)
        .where(and(eq(researchJobs.ownerId, actor.userId), eq(researchJobs.idempotencyKey, idempotencyKey)));
      return existing.id;
    }
    await copyCheckpoints(tx, parent.id, child.id, { includeResolve: false });
    await tx.update(candidateIdentities).set({ autoSelected: false }).where(eq(candidateIdentities.jobId, child.id));
    await appendEvent(tx, child.id, { stage: "resolve", code: "identity.reopened", message: "Identity choice reopened. Choose the right person to continue." });
    return child.id;
  });
}

/** Refresh: research the same identity again and store a new snapshot version. */
export async function refreshProfile(db: Database, env: Env, actor: Actor, profileId: string, idempotencyKey: string): Promise<string> {
  if (!z.string().uuid().safeParse(profileId).success) throw new ResearchCommandError("not_found", "Profile not found.");
  const [profile] = await db.select().from(profiles).where(and(eq(profiles.id, profileId), eq(profiles.ownerId, actor.userId)));
  if (!profile) throw new ResearchCommandError("not_found", "Profile not found.");
  const [latest] = await db
    .select()
    .from(snapshots)
    .where(and(eq(snapshots.profileId, profile.id), eq(snapshots.ownerId, actor.userId)))
    .orderBy(desc(snapshots.version))
    .limit(1);
  if (!latest) throw new ResearchCommandError("invalid_state", "This profile has no completed research to refresh.");
  await enforceWorkspaceRules(db, env, { ...actor, workspace: profile.workspace });
  const config = { ...buildJobConfig(env, profile.workspace, await ownerLimits(db, actor.userId)), bypassSearchCache: true };
  const identity = latest.identity;
  return db.transaction(async (tx) => {
    const [job] = await tx
      .insert(researchJobs)
      .values({
        ownerId: actor.userId,
        workspace: profile.workspace,
        kind: "refresh",
        profileId: profile.id,
        status: "queued",
        phase: "research",
        query: { fullName: identity.displayName, company: identity.organisation, country: null, profileUrl: null },
        queryKey: `refresh:${profile.id}`,
        idempotencyKey,
        config,
        identityResolution: { method: "refresh_existing_profile", reason: "Refreshing an existing profile; the identity was confirmed earlier.", decidedAt: new Date().toISOString() },
        maxAttempts: env.JOB_MAX_ATTEMPTS,
      })
      .onConflictDoNothing({ target: [researchJobs.ownerId, researchJobs.idempotencyKey] })
      .returning();
    if (!job) {
      const [existing] = await tx
        .select({ id: researchJobs.id })
        .from(researchJobs)
        .where(and(eq(researchJobs.ownerId, actor.userId), eq(researchJobs.idempotencyKey, idempotencyKey)));
      return existing.id;
    }
    const [candidate] = await tx
      .insert(candidateIdentities)
      .values({
        jobId: job.id,
        ownerId: actor.userId,
        rank: 1,
        displayName: identity.displayName,
        nativeName: identity.nativeName,
        organisation: identity.organisation,
        role: identity.role,
        location: profile.headlineLocation,
        summary: "Existing profile being refreshed.",
        matchStrength: "strong",
        matchReasons: [{ code: "role_context", text: "Same identity as the existing profile.", sourceKeys: [] }],
        distinguishingFacts: [],
        sourceRefs: [],
        anchorKey: profile.anchorKey,
        anchorUrls: profile.anchorUrls,
        nameVariants: identity.nameVariants,
        autoSelected: true,
        fixturePersonKey: profile.fixturePersonKey,
      })
      .returning({ id: candidateIdentities.id });
    await tx.update(researchJobs).set({ selectedCandidateId: candidate.id }).where(eq(researchJobs.id, job.id));
    await appendEvent(tx, job.id, { code: "job.queued", message: "Refresh queued for the existing profile.", data: { profileId: profile.id } });
    return job.id;
  });
}
