import { authed, idParam, json, requireIdempotencyKey } from "@/lib/api/v1/http";
import { retryResearch } from "@/lib/research/service";

export const dynamic = "force-dynamic";

/** Retry a failed, partial or cancelled run, reusing its completed steps. Requires an Idempotency-Key. */
export const POST = authed<{ jobId: string }>(async (ctx, { jobId }) => {
  const id = idParam(jobId, "Research not found.");
  const key = requireIdempotencyKey(ctx.request);
  return json({ jobId: await retryResearch(ctx.db, ctx.env, ctx.actor, id, key) }, { status: 201 });
});
