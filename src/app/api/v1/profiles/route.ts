import { listProfiles } from "@/lib/data/profiles";
import { toProfileListItem } from "@/lib/api/v1/dto";
import { ApiError, authed, decodeCursor, encodeCursor, fieldErrorsOf, json, searchParams } from "@/lib/api/v1/http";
import { ProfileListQuerySchema, type Page, type ProfileListItem } from "@personbrief/shared/api/v1";

export const dynamic = "force-dynamic";

/**
 * Saved work (?scope=saved, default) or every researched profile (?scope=all)
 * in the current workspace, with search (?q= matches names, organisations,
 * roles, notes and tags), sorting and an optional tag filter.
 */
export const GET = authed(async (ctx) => {
  const parsed = ProfileListQuerySchema.safeParse(Object.fromEntries(searchParams(ctx.request)));
  if (!parsed.success) throw new ApiError("invalid_input", undefined, { fieldErrors: fieldErrorsOf(parsed.error) });
  const query = parsed.data;
  const cursor = decodeCursor(query.cursor, (v): v is { o: number } => typeof v.o === "number" && Number.isInteger(v.o) && v.o >= 0);
  const offset = cursor?.o ?? 0;
  const rows = await listProfiles(ctx.db, ctx.viewer.userId, ctx.viewer.workspace, {
    q: query.q,
    sort: query.sort,
    tagId: query.tagId,
    scope: query.scope,
    limit: query.limit + 1,
    offset,
  });
  const body: Page<ProfileListItem> = {
    items: rows.slice(0, query.limit).map((row) => toProfileListItem(row, ctx.viewer.workspace)),
    nextCursor: rows.length > query.limit ? encodeCursor({ o: offset + query.limit }) : null,
  };
  return json(body);
});
