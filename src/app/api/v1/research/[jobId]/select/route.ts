import { authed, idParam, json, readBody } from "@/lib/api/v1/http";
import { jobDetailOr404 } from "@/lib/api/v1/jobs";
import { selectCandidate } from "@/lib/research/service";
import { SelectCandidateRequestSchema } from "@personbrief/shared/api/v1";

export const dynamic = "force-dynamic";

/** The owner chooses which candidate to research. Repeating the same choice is harmless. */
export const POST = authed<{ jobId: string }>(async (ctx, { jobId }) => {
  const id = idParam(jobId, "Research not found.");
  const { candidateId } = await readBody(ctx.request, SelectCandidateRequestSchema);
  await selectCandidate(ctx.db, ctx.actor, id, candidateId);
  return json(await jobDetailOr404(ctx, id));
});
