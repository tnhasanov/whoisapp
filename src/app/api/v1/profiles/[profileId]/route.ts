import { deleteProfile, getProfileView } from "@/lib/data/profiles";
import { toProfileDetail } from "@/lib/api/v1/dto";
import { ApiError, authed, idParam, json, noContent, searchParams } from "@/lib/api/v1/http";

export const dynamic = "force-dynamic";

/**
 * The full brief for one version (?snapshot=<id>, default latest): sections,
 * claims with evidence, sources, private notes and tags. Owner only.
 */
export const GET = authed<{ profileId: string }>(async (ctx, { profileId }) => {
  const id = idParam(profileId, "Profile not found.");
  const snapshot = searchParams(ctx.request).get("snapshot");
  const snapshotId = snapshot ? idParam(snapshot, "Profile not found.") : null;
  const view = await getProfileView(ctx.db, ctx.viewer.userId, id, snapshotId);
  if (!view || (snapshotId && view.snapshot.id !== snapshotId)) throw new ApiError("not_found", "Profile not found.");
  return json(toProfileDetail(view));
});

/** Delete the profile with its versions, sources, notes, tags, exports log and the research runs behind it. */
export const DELETE = authed<{ profileId: string }>(async (ctx, { profileId }) => {
  if (!(await deleteProfile(ctx.db, ctx.viewer.userId, idParam(profileId, "Profile not found.")))) throw new ApiError("not_found", "Profile not found.");
  return noContent();
});
