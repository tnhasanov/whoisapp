import { addTag, profileTagState } from "@/lib/data/profiles";
import { ApiError, authed, idParam, json, readBody } from "@/lib/api/v1/http";
import { AddTagRequestSchema } from "@personbrief/shared/api/v1";

export const dynamic = "force-dynamic";

/** Add a tag (created in this workspace if new; adding an existing tag again is harmless). */
export const POST = authed<{ profileId: string }>(async (ctx, { profileId }) => {
  const id = idParam(profileId, "Profile not found.");
  const { name } = await readBody(ctx.request, AddTagRequestSchema);
  if (!(await addTag(ctx.db, ctx.viewer.userId, id, name))) throw new ApiError("not_found", "Profile not found.");
  return json(await profileTagState(ctx.db, ctx.viewer.userId, id));
});
