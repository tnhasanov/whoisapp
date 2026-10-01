import { gt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { workerHeartbeats } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe for the hosting platform. Public by design, so it
 * reports only coarse states: no versions, hostnames, counts or configuration.
 */
export async function GET() {
  let database: "ok" | "error" = "ok";
  let worker: "online" | "offline" | "unknown" = "unknown";
  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    const recent = await db
      .select({ id: workerHeartbeats.workerId })
      .from(workerHeartbeats)
      .where(gt(workerHeartbeats.lastSeenAt, sql`now() - interval '60 seconds'`))
      .limit(1);
    worker = recent.length > 0 ? "online" : "offline";
  } catch {
    database = "error";
  }
  const status = database === "ok" ? (worker === "online" ? "ok" : "degraded") : "error";
  return NextResponse.json(
    { status, database, worker },
    { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
