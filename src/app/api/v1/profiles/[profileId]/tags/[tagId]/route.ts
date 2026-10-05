import { profileTagState, removeTag } from "@/lib/data/profiles";
import { ApiError, authed, idParam, json } from "@/lib/api/v1/http";

export const dynamic = "force-dynamic";

/** Remove a tag from the profile (the tag itself disappears once nothing uses it). */
export const DELETE = authed<{ profileId: string; tagId: string }>(async (ctx, { profileId, tagId }) => {
  const id = idParam(profileId, "Profile not found.");
  if (!(await removeTag(ctx.db, ctx.viewer.userId, id, idParam(tagId, "Tag not found.")))) throw new ApiError("not_found", "Tag not found.");
  return json(await profileTagState(ctx.db, ctx.viewer.userId, id));
});
