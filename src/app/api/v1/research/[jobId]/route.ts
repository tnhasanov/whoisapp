import { and, eq } from "drizzle-orm";
import { deleteJob } from "@/lib/data/profiles";
import { researchJobs } from "@/lib/db/schema";
import { ApiError, authed, idParam, json, noContent } from "@/lib/api/v1/http";
import { jobDetailOr404 } from "@/lib/api/v1/jobs";

export const dynamic = "force-dynamic";

/** Persisted state of one run: stages, sources, candidates, events. Poll while pollAfterMs is set. */
export const GET = authed<{ jobId: string }>(async (ctx, { jobId }) => json(await jobDetailOr404(ctx, idParam(jobId, "Research not found."))));

/** Remove a finished run from Activity (with its retrieved page content). Running research must be cancelled first. */
export const DELETE = authed<{ jobId: string }>(async (ctx, { jobId }) => {
  const id = idParam(jobId, "Research not found.");
  if (await deleteJob(ctx.db, ctx.viewer.userId, id)) return noContent();
  const [job] = await ctx.db.select({ status: researchJobs.status }).from(researchJobs).where(and(eq(researchJobs.id, id), eq(researchJobs.ownerId, ctx.viewer.userId)));
  if (!job) throw new ApiError("not_found", "Research not found.");
  throw new ApiError("invalid_state", "Cancel this research before deleting it.");
});
