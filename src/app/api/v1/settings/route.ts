import { and, eq, gt, sql } from "drizzle-orm";
import { authed, json } from "@/lib/api/v1/http";
import { ownerSettings, usageRecords, workerHeartbeats } from "@/lib/db/schema";
import { getProviderStatus } from "@/lib/env";
import { resolveLimits } from "@/lib/research/config";
import type { SettingsResponse } from "@personbrief/shared/api/v1";

export const dynamic = "force-dynamic";

/** Provider availability (configured/missing only), effective budgets and estimated usage. */
export const GET = authed(async (ctx) => {
  const { db, env, viewer } = ctx;
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [workers, [settings], usage] = await Promise.all([
    db.select({ id: workerHeartbeats.workerId }).from(workerHeartbeats).where(gt(workerHeartbeats.lastSeenAt, sql`now() - interval '60 seconds'`)).limit(1),
    db.select().from(ownerSettings).where(eq(ownerSettings.userId, viewer.userId)),
    viewer.role === "owner"
      ? db
          .select({
            provider: usageRecords.provider,
            requests: sql<number>`coalesce(sum(${usageRecords.requests}), 0)::int`,
            tokens: sql<number>`coalesce(sum(${usageRecords.inputTokens} + ${usageRecords.outputTokens}), 0)::int`,
            credits: sql<number>`coalesce(sum(${usageRecords.credits}), 0)::float`,
            cost: sql<number>`coalesce(sum(${usageRecords.estimatedCostUsd}), 0)::float`,
          })
          .from(usageRecords)
          .where(and(eq(usageRecords.ownerId, viewer.userId), gt(usageRecords.createdAt, since)))
          .groupBy(usageRecords.provider)
      : Promise.resolve([]),
  ]);
  const status = getProviderStatus(env);
  const limits = resolveLimits(env, settings?.researchLimits);
  const body: SettingsResponse = {
    worker: { online: workers.length > 0 },
    retention: { sourceContentDays: env.SOURCE_CONTENT_RETENTION_DAYS, demoGuestHours: env.DEMO_GUEST_TTL_HOURS },
    owner:
      viewer.role === "owner"
        ? {
            providers: {
              search: { name: "Tavily", configured: status.tavily },
              model: { name: "Anthropic", configured: status.anthropic, model: status.model, effort: status.effort },
              liveReady: status.liveReady,
              directFetch: status.directFetch,
            },
            limits: {
              maxSearchQueries: limits.maxSearchQueries,
              maxResultsPerQuery: limits.maxResultsPerQuery,
              maxExtractPages: limits.maxExtractPages,
              maxModelCalls: limits.maxModelCalls,
              includeNews: limits.includeNews,
              newsWindowMonths: limits.newsWindowMonths,
              maxJobsPerHour: env.RESEARCH_MAX_JOBS_PER_HOUR,
            },
            usage: {
              since: since.toISOString(),
              byProvider: usage.map((u) => ({ provider: u.provider, requests: u.requests, tokens: u.tokens, credits: Number(u.credits), estimatedCostUsd: Number(u.cost) })),
              estimatedCostUsd: usage.reduce((sum, u) => sum + Number(u.cost), 0),
            },
          }
        : null,
  };
  return json(body);
});
