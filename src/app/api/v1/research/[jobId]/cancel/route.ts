import { authed, idParam, json } from "@/lib/api/v1/http";
import { jobDetailOr404 } from "@/lib/api/v1/jobs";
import { cancelResearch } from "@/lib/research/service";

export const dynamic = "force-dynamic";

/** Cancel: immediate when queued or waiting; a running job stops at its next checkpoint (completed steps are kept). */
export const POST = authed<{ jobId: string }>(async (ctx, { jobId }) => {
  const id = idParam(jobId, "Research not found.");
  await cancelResearch(ctx.db, ctx.actor, id);
  return json(await jobDetailOr404(ctx, id));
});
