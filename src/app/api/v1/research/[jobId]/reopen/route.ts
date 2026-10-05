import { authed, idParam, json, requireIdempotencyKey } from "@/lib/api/v1/http";
import { reopenIdentityChoice } from "@/lib/research/service";

export const dynamic = "force-dynamic";

/** After an automatic identity match: start a new run that waits for the owner's choice. Requires an Idempotency-Key. */
export const POST = authed<{ jobId: string }>(async (ctx, { jobId }) => {
  const id = idParam(jobId, "Research not found.");
  const key = requireIdempotencyKey(ctx.request);
  return json({ jobId: await reopenIdentityChoice(ctx.db, ctx.env, ctx.actor, id, key) }, { status: 201 });
});
