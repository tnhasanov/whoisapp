import { authed, idParam, json, requireIdempotencyKey } from "@/lib/api/v1/http";
import { refreshProfile } from "@/lib/research/service";

export const dynamic = "force-dynamic";

/** Research the same identity again (new version; compare with "What changed?"). Requires an Idempotency-Key. */
export const POST = authed<{ profileId: string }>(async (ctx, { profileId }) => {
  const id = idParam(profileId, "Profile not found.");
  const key = requireIdempotencyKey(ctx.request);
  return json({ jobId: await refreshProfile(ctx.db, ctx.env, ctx.actor, id, key) }, { status: 201 });
});
