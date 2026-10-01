import { and, asc, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/lib/jobs/store";
import { jobDocuments } from "@/lib/db/schema";
import type { AccessMethod, AccessStatus } from "@/lib/domain/types";
import { BLOCKED_SOURCE_DOMAINS, LOGIN_WALLED_DOMAINS } from "@/lib/research/config";
import { checkUrl } from "@/lib/urls/safe-url";
import { canonicaliseUrl, publisherFromUrl, registrableDomain } from "@/lib/urls/canonical";
import type { SearchHit } from "@/lib/research/providers/types";
import { contentHash } from "@/lib/research/cache";

export type JobDocumentRow = typeof jobDocuments.$inferSelect;

export type HitDisposition = { kind: "stored"; key: string; isNew: boolean } | { kind: "blocked"; url: string; reason: string };

export function isBlockedDomain(url: string): boolean {
  const domain = registrableDomain(url);
  return Boolean(domain && BLOCKED_SOURCE_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`)));
}

export function isLoginWalledDomain(url: string): boolean {
  const domain = registrableDomain(url);
  return Boolean(domain && LOGIN_WALLED_DOMAINS.includes(domain));
}

export async function loadDocuments(db: DbOrTx, jobId: string): Promise<JobDocumentRow[]> {
  return db.select().from(jobDocuments).where(eq(jobDocuments.jobId, jobId)).orderBy(asc(jobDocuments.fetchedAt), asc(jobDocuments.sourceKey));
}

function nextKeyNumber(existing: JobDocumentRow[]): number {
  return existing.reduce((max, d) => Math.max(max, Number(d.sourceKey.replace(/^\D+/, "")) || 0), 0) + 1;
}

/**
 * Store search hits as job documents, de-duplicated by canonical URL.
 * Policy filters run here: unsafe URLs and people-search sites are dropped,
 * login-walled platform pages are kept as listings but never fetched.
 */
export async function storeHits(
  tx: DbOrTx,
  input: { jobId: string; ownerId: string; category: string; hits: SearchHit[]; retentionDays: number },
): Promise<HitDisposition[]> {
  const existing = await loadDocuments(tx, input.jobId);
  const byCanonical = new Map(existing.map((d) => [d.canonicalUrl, d]));
  let next = nextKeyNumber(existing);
  const results: HitDisposition[] = [];
  const expiresAt = new Date(Date.now() + Math.max(1, input.retentionDays) * 86_400_000);

  for (const hit of input.hits) {
    const check = checkUrl(hit.url);
    if (!check.ok) {
      results.push({ kind: "blocked", url: hit.url, reason: `Unsafe or unsupported URL (${check.reason}); ignored.` });
      continue;
    }
    if (isBlockedDomain(hit.url)) {
      results.push({ kind: "blocked", url: hit.url, reason: "People-search or data-broker site; excluded by policy." });
      continue;
    }
    const canonicalUrl = canonicaliseUrl(hit.url);
    const found = byCanonical.get(canonicalUrl);
    if (found) {
      const categories = found.categories.includes(input.category) ? found.categories : [...found.categories, input.category];
      const update: Partial<JobDocumentRow> = { categories };
      // A newer version of the same page (demo world versions): adopt its identity and text.
      if (hit.fixtureKey && hit.fixtureKey !== found.fixtureKey) {
        update.fixtureKey = hit.fixtureKey;
        update.title = hit.title ?? found.title;
        update.snippet = hit.snippet;
        update.providerPublishedAt = hit.providerPublishedDate;
        update.content = null;
        update.contentHash = null;
        update.accessStatus = "snippet_only";
      }
      if (!(update.content ?? found.content) && hit.rawContent && !isLoginWalledDomain(hit.url)) {
        update.content = hit.rawContent;
        update.contentHash = contentHash(hit.rawContent);
        update.accessStatus = "read";
        update.accessMethod = "search_result";
      }
      await tx.update(jobDocuments).set(update).where(eq(jobDocuments.id, found.id));
      Object.assign(found, update);
      results.push({ kind: "stored", key: found.sourceKey, isNew: false });
      continue;
    }
    const loginWalled = isLoginWalledDomain(hit.url);
    const hasContent = Boolean(hit.rawContent) && !loginWalled;
    const accessStatus: AccessStatus = loginWalled ? "login_required" : hasContent ? "read" : "snippet_only";
    const accessMethod: AccessMethod = hit.fixtureKey ? "fixture" : hasContent ? "search_result" : "search_snippet";
    const key = `S${next++}`;
    const [row] = await tx
      .insert(jobDocuments)
      .values({
        jobId: input.jobId,
        ownerId: input.ownerId,
        sourceKey: key,
        url: hit.url,
        canonicalUrl,
        title: hit.title,
        publisher: publisherFromUrl(hit.url),
        snippet: hit.snippet,
        content: hasContent ? hit.rawContent : null,
        contentHash: hasContent && hit.rawContent ? contentHash(hit.rawContent) : null,
        providerPublishedAt: hit.providerPublishedDate,
        accessMethod,
        accessStatus,
        accessNote: loginWalled ? "Platform requires sign-in; only the search listing was used." : null,
        categories: [input.category],
        fixtureKey: hit.fixtureKey ?? null,
        expiresAt,
      })
      .returning();
    byCanonical.set(canonicalUrl, row);
    results.push({ kind: "stored", key, isNew: true });
  }
  return results;
}

export async function updateDocumentContent(
  tx: DbOrTx,
  input: { jobId: string; key: string; content: string | null; accessStatus: AccessStatus; accessMethod?: AccessMethod; accessNote?: string | null; title?: string | null },
): Promise<void> {
  await tx
    .update(jobDocuments)
    .set({
      content: input.content,
      contentHash: input.content ? contentHash(input.content) : null,
      accessStatus: input.accessStatus,
      ...(input.accessMethod ? { accessMethod: input.accessMethod } : {}),
      accessNote: input.accessNote ?? null,
      ...(input.title ? { title: input.title } : {}),
    })
    .where(and(eq(jobDocuments.jobId, input.jobId), eq(jobDocuments.sourceKey, input.key)));
}

/** Retention: drop stored page text after the window; metadata needed for the job record stays. */
export async function purgeExpiredDocumentContent(db: DbOrTx): Promise<number> {
  const result = await db.execute<{ id: string }>(sql`
    UPDATE job_documents SET content = NULL, snippet = NULL
    WHERE expires_at < now() AND (content IS NOT NULL OR snippet IS NOT NULL)
    RETURNING id
  `);
  return result.rows.length;
}
