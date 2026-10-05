import { eq } from "drizzle-orm";
import { authed, json, readBody } from "@/lib/api/v1/http";
import { meResponse } from "@/lib/api/v1/viewer";
import { ownerSettings } from "@/lib/db/schema";
import { UpdatePreferencesRequestSchema } from "@personbrief/shared/api/v1";

export const dynamic = "force-dynamic";

/** Language and time zone, shared with the website (theme stays a per-device choice). */
export const PATCH = authed(async (ctx) => {
  const body = await readBody(ctx.request, UpdatePreferencesRequestSchema);
  const update: { locale?: typeof ctx.viewer.locale; timezone?: string } = {};
  if (body.locale) update.locale = body.locale;
  if (body.timezone) update.timezone = body.timezone;
  await ctx.db.update(ownerSettings).set(update).where(eq(ownerSettings.userId, ctx.viewer.userId));
  return json(await meResponse({ ...ctx, viewer: { ...ctx.viewer, ...update } }));
});
