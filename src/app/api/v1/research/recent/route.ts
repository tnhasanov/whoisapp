import { recentSearches } from "@/lib/data/jobs";
import { authed, json } from "@/lib/api/v1/http";

export const dynamic = "force-dynamic";

/** Distinct recent searches in the current workspace (for the Search screen). */
export const GET = authed(async (ctx) => {
  const items = await recentSearches(ctx.db, ctx.viewer.userId, ctx.viewer.workspace, 8);
  return json({ items: items.map((r) => ({ jobId: r.id, fullName: r.fullName, company: r.company, status: r.status, createdAt: r.createdAt, profileId: r.profileId })) });
});
