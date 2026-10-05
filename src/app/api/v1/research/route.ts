import { ACTIVE_JOB_STATUSES, TERMINAL_JOB_STATUSES, type JobStatus } from "@/lib/domain/types";
import { listJobsPage } from "@/lib/data/jobs";
import { toJobSummary } from "@/lib/api/v1/dto";
import { authed, decodeCursor, encodeCursor, json, readBody, requireIdempotencyKey, searchParams } from "@/lib/api/v1/http";
import { jobDetailOr404 } from "@/lib/api/v1/jobs";
import { startResearch } from "@/lib/research/service";
import { StartResearchRequestSchema, type Page, type JobSummary } from "@personbrief/shared/api/v1";

export const dynamic = "force-dynamic";

const FILTERS: Record<string, readonly JobStatus[] | null> = {
  all: null,
  active: [...ACTIVE_JOB_STATUSES, "awaiting_identity"],
  finished: TERMINAL_JOB_STATUSES,
};

/** Research history for the current workspace, newest first (?status=all|active|finished&cursor=&limit=). */
export const GET = authed(async (ctx) => {
  const params = searchParams(ctx.request);
  const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 30));
  const statuses = FILTERS[params.get("status") ?? "all"] ?? null;
  const after = decodeCursor(params.get("cursor"), (v): v is { t: string; id: string } => typeof v.t === "string" && typeof v.id === "string");
  const page = await listJobsPage(ctx.db, ctx.viewer.userId, ctx.viewer.workspace, {
    limit,
    after: after ? { createdAt: after.t, id: after.id } : null,
    statuses: statuses ? [...statuses] : null,
  });
  const last = page.items[page.items.length - 1];
  const body: Page<JobSummary> = {
    items: page.items.map(toJobSummary),
    nextCursor: page.hasMore && last ? encodeCursor({ t: last.createdAt, id: last.id }) : null,
  };
  return json(body);
});

/**
 * Start research in the current workspace. Requires an Idempotency-Key: a
 * repeated request (double tap, retry after a dropped connection) returns the
 * original run instead of starting new paid research. Live runs also count
 * against the hourly budget.
 */
export const POST = authed(async (ctx) => {
  const key = requireIdempotencyKey(ctx.request);
  const input = await readBody(ctx.request, StartResearchRequestSchema);
  const { jobId, created } = await startResearch(ctx.db, ctx.env, ctx.actor, input, key);
  return json({ job: await jobDetailOr404(ctx, jobId), created }, { status: created ? 201 : 200 });
});
