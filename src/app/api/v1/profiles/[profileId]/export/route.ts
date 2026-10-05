import { renderExport } from "@/lib/export/http";
import { ApiError, authed, idParam, searchParams } from "@/lib/api/v1/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PDF brief (in the account's language) or JSON export of one version
 * (?format=pdf|json&snapshot=<id>&notes=1). Private notes are excluded unless
 * notes=1 is passed for a JSON export. Generated on demand, never stored.
 */
export const GET = authed<{ profileId: string }>(async (ctx, { profileId }) => {
  const id = idParam(profileId, "Profile not found.");
  const params = searchParams(ctx.request);
  const format = params.get("format") ?? "pdf";
  if (format !== "pdf" && format !== "json") throw new ApiError("invalid_input", "Unknown export format.", { fieldErrors: { format: "invalid" } });
  const snapshot = params.get("snapshot");
  const result = await renderExport(ctx.db, ctx.viewer, id, {
    format,
    snapshotId: snapshot ? idParam(snapshot, "Profile not found.") : null,
    includeNotes: params.get("notes") === "1",
  });
  if (!result.ok) {
    if (result.reason === "rate_limited") throw new ApiError("rate_limited", undefined, { retryAfterSeconds: result.retryAfterSeconds });
    throw new ApiError("not_found", "Profile not found.");
  }
  return result.response;
});
