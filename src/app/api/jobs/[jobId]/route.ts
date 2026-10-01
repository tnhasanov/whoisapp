import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { getJobView } from "@/lib/data/jobs";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/** Persisted job state for polling. Owner-scoped: other users get 404. */
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { jobId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const view = await getJobView(getDb(), viewer.userId, jobId);
  if (!view) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
}
