import { createHash } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { providerCache } from "@/lib/db/schema";
import type { Workspace } from "@/lib/domain/types";

/**
 * Owner-scoped response cache. Keys hash every input that changes the
 * result: provider, operation, normalised request, identity anchor, model
 * and prompt version. Entries expire (freshness) and are deleted with the
 * job that created them when a profile is deleted.
 */

export function cacheKey(parts: Record<string, unknown>): string {
  const stable = JSON.stringify(parts, Object.keys(parts).sort());
  return createHash("sha256").update(stable).digest("hex");
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

export async function cacheGet<T>(db: Database, ownerId: string, workspace: Workspace, key: string): Promise<T | null> {
  const [row] = await db
    .select({ response: providerCache.response })
    .from(providerCache)
    .where(
      and(
        eq(providerCache.ownerId, ownerId),
        eq(providerCache.workspace, workspace),
        eq(providerCache.cacheKey, key),
        gt(providerCache.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return (row?.response as T | undefined) ?? null;
}

export async function cachePut(
  db: Database,
  input: { ownerId: string; workspace: Workspace; jobId: string; key: string; provider: string; operation: string; response: unknown; ttlHours: number },
): Promise<void> {
  if (input.ttlHours <= 0) return;
  const expiresAt = new Date(Date.now() + input.ttlHours * 3_600_000);
  await db
    .insert(providerCache)
    .values({
      ownerId: input.ownerId,
      workspace: input.workspace,
      jobId: input.jobId,
      cacheKey: input.key,
      provider: input.provider,
      operation: input.operation,
      response: input.response,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [providerCache.ownerId, providerCache.workspace, providerCache.cacheKey],
      set: { response: input.response, expiresAt, jobId: input.jobId, createdAt: new Date() },
    });
}

export async function purgeExpiredCache(db: Database): Promise<number> {
  const deleted = await db.delete(providerCache).where(lt(providerCache.expiresAt, new Date())).returning({ id: providerCache.id });
  return deleted.length;
}
