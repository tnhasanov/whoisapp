import { renderToBuffer } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import { getViewer } from "@/lib/auth/session";
import { getProfileView } from "@/lib/data/profiles";
import { getDb } from "@/lib/db/client";
import { exportLog } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { buildJsonExport } from "@/lib/export/json";
import { buildBriefData } from "@/lib/export/pdf/brief-data";
import { BriefDocument, registerPdfFonts } from "@/lib/export/pdf/brief-document";
import { toComparableAscii } from "@/lib/names";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function filename(name: string, version: number, ext: string, demo: boolean) {
  const slug = toComparableAscii(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "profile";
  return `personbrief-${demo ? "DEMO-" : ""}${slug}-v${version}.${ext}`;
}

/**
 * Owner-only export. Exports are generated on demand and never stored, so
 * there is nothing to enumerate; every request re-checks the session and
 * ownership of the profile and snapshot.
 */
export async function GET(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const { profileId } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "json" ? "json" : "pdf";
  const snapshotParam = url.searchParams.get("snapshot");
  const includeNotes = format === "json" && url.searchParams.get("notes") === "1";
  if (!UUID.test(profileId) || (snapshotParam && !UUID.test(snapshotParam))) return Response.json({ error: "not_found" }, { status: 404 });

  const db = getDb();
  const rate = await consumeRateLimit(db, `export:${viewer.userId}`, 30, 60);
  if (!rate.allowed) return Response.json({ error: "rate_limited" }, { status: 429 });

  const view = await getProfileView(db, viewer.userId, profileId, snapshotParam);
  if (!view || (snapshotParam && view.snapshot.id !== snapshotParam)) return Response.json({ error: "not_found" }, { status: 404 });

  await db.insert(exportLog).values({ ownerId: viewer.userId, profileId: view.profile.id, snapshotId: view.snapshot.id, format, includeNotes });
  const demo = view.profile.workspace === "demo";
  const headers = {
    "Cache-Control": "no-store, private",
    "X-Robots-Tag": "noindex",
    "Content-Disposition": `attachment; filename="${filename(view.profile.displayName, view.snapshot.version, format, demo)}"`,
  };

  if (format === "json") {
    const body = JSON.stringify(buildJsonExport(view, { includeNotes, generatedAt: new Date() }), null, 2);
    return new Response(body, { headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
  }

  registerPdfFonts();
  const locale = viewer.locale;
  const [pdf, evidence, contacts, accounts, connections, news] = await Promise.all(
    ["Pdf", "Evidence", "Contacts", "Accounts", "Connections", "News"].map((namespace) => getTranslations({ locale, namespace })),
  );
  const data = buildBriefData(view, {
    locale,
    timeZone: viewer.timezone,
    appUrl: getEnv().APP_URL,
    now: new Date(),
    t: {
      pdf: (k, v) => pdf(k as never, v as never),
      evidence: (k, v) => evidence(k as never, v as never),
      contacts: (k, v) => contacts(k as never, v as never),
      accounts: (k, v) => accounts(k as never, v as never),
      connections: (k, v) => connections(k as never, v as never),
      news: (k, v) => news(k as never, v as never),
    },
  });
  const buffer = await renderToBuffer(<BriefDocument data={data} />);
  return new Response(new Uint8Array(buffer), { headers: { ...headers, "Content-Type": "application/pdf" } });
}
