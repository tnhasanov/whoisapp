import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { createElement } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { addNote, getProfileView, type ProfileView } from "@/lib/data/profiles";
import { researchJobs } from "@/lib/db/schema";
import { buildJsonExport } from "@/lib/export/json";
import { buildBriefData, type BriefTranslators } from "@/lib/export/pdf/brief-data";
import { BriefDocument, registerPdfFonts } from "@/lib/export/pdf/brief-document";
import { startResearch } from "@/lib/research/service";
import { createUser, db, env, idem, makeWorker, resetDb } from "./helpers";

type Messages = Record<string, unknown>;

function translators(locale: string): BriefTranslators {
  const messages = JSON.parse(readFileSync(path.join(process.cwd(), "messages", `${locale}.json`), "utf8")) as Messages;
  const make = (namespace: string) => {
    const t = createTranslator({ locale, messages, namespace: namespace as never });
    return (key: string, values?: Record<string, string | number>) => t(key as never, values as never);
  };
  return {
    pdf: make("Pdf"),
    evidence: make("Evidence"),
    contacts: make("Contacts"),
    accounts: make("Accounts"),
    connections: make("Connections"),
    news: make("News"),
    gaps: make("Gaps"),
    categories: make("Sources.categories"),
    identity: make("Identity.methods"),
  };
}

function pdfText(buffer: Buffer): string | null {
  const dir = mkdtempSync(path.join(tmpdir(), "pb-pdf-"));
  try {
    const file = path.join(dir, "brief.pdf");
    writeFileSync(file, buffer);
    return execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" });
  } catch {
    return null; // pdftotext (poppler) is optional on developer machines
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

let ownerId: string;
let view: ProfileView;

beforeAll(async () => {
  await resetDb();
  const owner = await createUser("owner", "demo");
  ownerId = owner.userId;
  const { jobId } = await startResearch(db(), env(), owner, { fullName: "Elnara Gasimova", company: "Caspian Lantern Analytics" }, idem());
  expect(await makeWorker().drain()).toEqual(["completed"]);
  const [job] = await db().select().from(researchJobs).where(eq(researchJobs.id, jobId));
  await addNote(db(), ownerId, job.profileId!, "Private: prefers morning meetings.");
  view = (await getProfileView(db(), ownerId, job.profileId!))!;
});

describe("JSON export", () => {
  it("keeps chronology, uncertain dates, citations, contradictions and provenance", () => {
    const json = buildJsonExport(view, { includeNotes: false, generatedAt: new Date("2026-10-01T09:00:00Z") });
    expect(json.schema).toBe("personbrief.export/v1");
    expect(json.fictionalDemoData).toBe(true);
    expect(json.notice).toMatch(/FICTIONAL DEMO DATA/);

    const refs = new Set(json.sources.map((s) => s.ref));
    // Every piece of evidence points at a listed source and carries its verified excerpt.
    for (const claim of json.claims) {
      expect(claim.evidence.length).toBeGreaterThan(0);
      for (const e of claim.evidence) {
        expect(refs.has(e.source!)).toBe(true);
        expect(e.excerpt.length).toBeGreaterThan(0);
        expect(e.excerptVerified).toBe(true);
      }
    }
    // Contradictory start dates are exported side by side, not merged.
    const conflicting = json.claims.filter((c) => c.conflictGroup);
    expect(conflicting.length).toBeGreaterThanOrEqual(2);
    expect(new Set(conflicting.map((c) => c.period.start)).size).toBeGreaterThan(1);
    // Year-only dates keep their precision.
    expect(json.claims.some((c) => c.period.start && /^\d{4}$/.test(c.period.start))).toBe(true);
    // Publication dates come from the article, not from the search index.
    const london = json.media.flatMap((s) => s.copies).find((c) => /London office/i.test(c.headline));
    expect(london?.publishedAt).toBe("2024-01-20");
    expect(london?.searchProviderReportedDate).not.toBe("2024-01-20");
    // Syndicated copies stay grouped in one story.
    expect(json.media.some((s) => s.copies.length >= 3)).toBe(true);
    // Switchboards are never exported as direct lines.
    expect(json.contacts.filter((c) => c.type === "switchboard").every((c) => !c.isDirect)).toBe(true);
    // Notes are private by default.
    expect("privateNotes" in json).toBe(false);
    expect(JSON.stringify(json)).not.toContain("prefers morning meetings");
  });

  it("includes private notes only when explicitly requested", () => {
    const json = buildJsonExport(view, { includeNotes: true, generatedAt: new Date() }) as ReturnType<typeof buildJsonExport> & {
      privateNotes?: { body: string }[];
    };
    expect(json.privateNotes?.map((n) => n.body)).toEqual(["Private: prefers morning meetings."]);
  });
});

describe("PDF export", () => {
  it.each(["en", "az", "ru"])("renders a %s brief with Azerbaijani and Cyrillic text and numbered references", async (locale) => {
    registerPdfFonts();
    const data = buildBriefData(view, { locale, timeZone: "Asia/Baku", appUrl: "http://localhost:3000", t: translators(locale), now: new Date("2026-10-01T09:00:00Z") });
    expect(data.fictional).toBe(true);
    expect(data.person.nativeName).toBe("Elnarə Qasımova");
    expect(data.sources.length).toBeGreaterThan(5);
    // Every reference number used in the brief resolves to a listed source.
    const listed = new Set(data.sources.map((s) => s.n));
    const used = [...data.summary, ...data.chronology, ...data.education, ...data.contacts, ...data.connections, ...data.media].flatMap((r) => r.refs);
    expect(used.length).toBeGreaterThan(0);
    expect(used.every((n) => listed.has(n))).toBe(true);

    const buffer = await renderToBuffer(createElement(BriefDocument, { data }) as Parameters<typeof renderToBuffer>[0]);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(20_000);

    const text = pdfText(buffer);
    if (text !== null) {
      expect(text).toContain("Elnarə Qasımova");
      expect(text).toMatch(/Эльнара Гасымова|Гасымова/);
      expect(text).toMatch(/\[1\]/);
      expect(text).not.toContain("prefers morning meetings");
    }
  }, 60_000);
});
