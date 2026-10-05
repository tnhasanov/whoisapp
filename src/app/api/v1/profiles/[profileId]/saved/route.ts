import { and, eq } from "drizzle-orm";
import { setSaved } from "@/lib/data/profiles";
import { profiles } from "@/lib/db/schema";
import { ApiError, authed, idParam, json, readBody } from "@/lib/api/v1/http";
import { SetSavedRequestSchema } from "@personbrief/shared/api/v1";

export const dynamic = "force-dynamic";

/** Save to or remove from Saved work (idempotent). */
export const PUT = authed<{ profileId: string }>(async (ctx, { profileId }) => {
  const id = idParam(profileId, "Profile not found.");
  const { saved } = await readBody(ctx.request, SetSavedRequestSchema);
  if (!(await setSaved(ctx.db, ctx.viewer.userId, id, saved))) throw new ApiError("not_found", "Profile not found.");
  const [row] = await ctx.db.select({ savedAt: profiles.savedAt }).from(profiles).where(and(eq(profiles.id, id), eq(profiles.ownerId, ctx.viewer.userId)));
  return json({ savedAt: row?.savedAt?.toISOString() ?? null });
});
