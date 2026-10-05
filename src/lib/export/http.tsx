import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import type { Viewer } from "@/lib/auth/session";
import { getProfileView } from "@/lib/data/profiles";
import type { Database } from "@/lib/db/client";
import { exportLog } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { buildJsonExport } from "@/lib/export/json";
import { buildBriefData } from "@/lib/export/pdf/brief-data";
import { BriefDocument, registerPdfFonts } from "@/lib/export/pdf/brief-document";
import { toComparableAscii } from "@/lib/names";
import { consumeRateLimit } from "@/lib/rate-limit";

export function exportFilename(name: string, version: number, ext: string, demo: boolean) {
  const slug = toComparableAscii(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "profile";
  return `personbrief-${demo ? "DEMO-" : ""}${slug}-v${version}.${ext}`;
}

export type ExportRequest = { format: "pdf" | "json"; snapshotId: string | null; includeNotes: boolean };

export type ExportResult =
  | { ok: true; response: Response }
  | { ok: false; reason: "rate_limited" | "not_found"; retryAfterSeconds?: number };

/**
 * Owner-only export, shared by the website and the mobile API. Exports are
 * generated on demand and never stored; every request re-checks ownership of
 * the profile and snapshot. Private notes are included only on request (JSON).
 */
export async function renderExport(db: Database, viewer: Viewer, profileId: string, request: ExportRequest): Promise<ExportResult> {
  const rate = await consumeRateLimit(db, `export:${viewer.userId}`, 30, 60);
  if (!rate.allowed) return { ok: false, reason: "rate_limited", retryAfterSeconds: Math.max(1, Math.ceil((rate.resetAt.getTime() - Date.now()) / 1000)) };

  const view = await getProfileView(db, viewer.userId, profileId, request.snapshotId);
  if (!view || (request.snapshotId && view.snapshot.id !== request.snapshotId)) return { ok: false, reason: "not_found" };

  const includeNotes = request.format === "json" && request.includeNotes;
  await db.insert(exportLog).values({ ownerId: viewer.userId, profileId: view.profile.id, snapshotId: view.snapshot.id, format: request.format, includeNotes });
  const demo = view.profile.workspace === "demo";
  const headers = {
    "Cache-Control": "no-store, private",
    "X-Robots-Tag": "noindex",
    "Content-Disposition": `attachment; filename="${exportFilename(view.profile.displayName, view.snapshot.version, request.format, demo)}"`,
  };

  if (request.format === "json") {
    const body = JSON.stringify(buildJsonExport(view, { includeNotes, generatedAt: new Date() }), null, 2);
    return { ok: true, response: new Response(body, { headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } }) };
  }

  registerPdfFonts();
  const locale = viewer.locale;
  const [pdf, evidence, contacts, accounts, connections, news, gaps, categories, identity] = await Promise.all(
    ["Pdf", "Evidence", "Contacts", "Accounts", "Connections", "News", "Gaps", "Sources.categories", "Identity.methods"].map((namespace) =>
      getTranslations({ locale, namespace }),
    ),
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
      gaps: (k, v) => gaps(k as never, v as never),
      categories: (k, v) => categories(k as never, v as never),
      identity: (k, v) => identity(k as never, v as never),
    },
  });
  const buffer = await renderToBuffer(<BriefDocument data={data} />);
  return { ok: true, response: new Response(new Uint8Array(buffer), { headers: { ...headers, "Content-Type": "application/pdf" } }) };
}
