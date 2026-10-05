import { getProfileChanges } from "@/lib/data/changes";
import { toChanges } from "@/lib/api/v1/dto";
import { ApiError, authed, idParam, json, searchParams } from "@/lib/api/v1/http";

export const dynamic = "force-dynamic";

/** "What changed?" between two versions (?from=&to=; defaults to the latest and the one before). */
export const GET = authed<{ profileId: string }>(async (ctx, { profileId }) => {
  const id = idParam(profileId, "Profile not found.");
  const params = searchParams(ctx.request);
  const changes = await getProfileChanges(ctx.db, ctx.viewer.userId, id, params.get("from"), params.get("to"));
  if (!changes) throw new ApiError("not_found", "Profile not found.");
  return json(toChanges(changes));
});
