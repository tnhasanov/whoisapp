import { listTags } from "@/lib/data/profiles";
import { authed, json } from "@/lib/api/v1/http";

export const dynamic = "force-dynamic";

/** Every tag in the current workspace (for the Saved filter). */
export const GET = authed(async (ctx) => json({ items: await listTags(ctx.db, ctx.viewer.userId, ctx.viewer.workspace) }));
