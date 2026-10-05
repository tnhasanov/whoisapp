import "server-only";
import { getJobView } from "@/lib/data/jobs";
import { ApiError, type ApiContext } from "./http";
import { toJobDetail } from "./dto";

/** The owner's job as a v1 detail, or 404 (other owners' jobs are indistinguishable from missing ones). */
export async function jobDetailOr404(ctx: Pick<ApiContext, "db" | "viewer">, jobId: string) {
  const view = await getJobView(ctx.db, ctx.viewer.userId, jobId);
  if (!view) throw new ApiError("not_found", "Research not found.");
  return toJobDetail(view);
}
