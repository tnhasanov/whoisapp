import { authed, idParam, json } from "@/lib/api/v1/http";
import { refineSearch } from "@/lib/research/service";

export const dynamic = "force-dynamic";

/** "None of these": closes the identity choice without researching anyone and returns the query to refine. */
export const POST = authed<{ jobId: string }>(async (ctx, { jobId }) => {
  const query = await refineSearch(ctx.db, ctx.actor, idParam(jobId, "Research not found."));
  return json({ query });
});
