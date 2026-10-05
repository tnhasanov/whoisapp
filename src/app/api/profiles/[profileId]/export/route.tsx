import { getViewer } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { renderExport } from "@/lib/export/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Website download of a PDF brief or JSON export (see renderExport for the rules). */
export async function GET(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const { profileId } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "json" ? "json" : "pdf";
  const snapshotId = url.searchParams.get("snapshot");
  if (!UUID.test(profileId) || (snapshotId && !UUID.test(snapshotId))) return Response.json({ error: "not_found" }, { status: 404 });
  const result = await renderExport(getDb(), viewer, profileId, { format, snapshotId, includeNotes: url.searchParams.get("notes") === "1" });
  if (!result.ok) return Response.json({ error: result.reason }, { status: result.reason === "rate_limited" ? 429 : 404 });
  return result.response;
}
