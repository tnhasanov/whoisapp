import { eq } from "drizzle-orm";
import { authed, json, readBody, requireOwnerRole } from "@/lib/api/v1/http";
import { meResponse } from "@/lib/api/v1/viewer";
import { ownerSettings } from "@/lib/db/schema";
import { SetWorkspaceRequestSchema } from "@personbrief/shared/api/v1";

export const dynamic = "force-dynamic";

/** Switch between live research and the fictional demo (owner only; same setting as the website). */
export const PUT = authed(async (ctx) => {
  requireOwnerRole(ctx);
  const { workspace } = await readBody(ctx.request, SetWorkspaceRequestSchema);
  await ctx.db.update(ownerSettings).set({ activeWorkspace: workspace }).where(eq(ownerSettings.userId, ctx.viewer.userId));
  return json(await meResponse({ ...ctx, viewer: { ...ctx.viewer, workspace } }));
});
