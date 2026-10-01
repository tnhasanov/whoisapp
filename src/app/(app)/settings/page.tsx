import { and, eq, gt, sql } from "drizzle-orm";
import { CheckCircle2, CircleAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageContainer, PageHeader } from "@/components/app-shell/app-shell";
import { LimitsForm } from "@/components/settings/limits-form";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { Badge } from "@/components/ui/badge";
import { Card, SectionHeading } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { requireViewer } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { ownerSettings, usageRecords, workerHeartbeats } from "@/lib/db/schema";
import { getEnv, getProviderStatus } from "@/lib/env";
import { resolveLimits } from "@/lib/research/config";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

function StatusRow({ label, ok, okLabel, missingLabel, detail }: { label: string; ok: boolean; okLabel: string; missingLabel: string; detail?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <span className="text-[13.5px] font-medium text-ink">{label}</span>
      <span className="flex items-center gap-2 text-[13px]">
        {detail ? <span className="text-muted">{detail}</span> : null}
        <Badge tone={ok ? "ok" : "warn"} icon={ok ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : <CircleAlert className="h-3 w-3" aria-hidden />}>
          {ok ? okLabel : missingLabel}
        </Badge>
      </span>
    </li>
  );
}

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const t = await getTranslations("Settings");
  const format = await getFormatter();
  const env = getEnv();
  const status = getProviderStatus(env);
  const db = getDb();
  const [[settings], workers, usage] = await Promise.all([
    db.select().from(ownerSettings).where(eq(ownerSettings.userId, viewer.userId)),
    db.select({ id: workerHeartbeats.workerId }).from(workerHeartbeats).where(gt(workerHeartbeats.lastSeenAt, sql`now() - interval '60 seconds'`)),
    db
      .select({
        provider: usageRecords.provider,
        requests: sql<number>`coalesce(sum(${usageRecords.requests}), 0)::int`,
        tokens: sql<number>`coalesce(sum(${usageRecords.inputTokens} + ${usageRecords.outputTokens}), 0)::int`,
        credits: sql<number>`coalesce(sum(${usageRecords.credits}), 0)::float`,
        cost: sql<number>`coalesce(sum(${usageRecords.estimatedCostUsd}), 0)::float`,
      })
      .from(usageRecords)
      .where(and(eq(usageRecords.ownerId, viewer.userId), gt(usageRecords.createdAt, sql`now() - interval '30 days'`)))
      .groupBy(usageRecords.provider),
  ]);
  const limits = resolveLimits(env, settings?.researchLimits);
  const timezones = Intl.supportedValuesOf("timeZone");
  const isOwner = viewer.role === "owner";

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="mt-8 space-y-10">
        <section aria-labelledby="prefs">
          <SectionHeading id="prefs" title={t("preferences")} />
          <Card className="p-5">
            <PreferencesForm locale={viewer.locale} timezone={viewer.timezone} theme={viewer.theme} timezones={timezones} />
          </Card>
        </section>

        {!isOwner ? (
          <Callout>{t("guestNote")}</Callout>
        ) : (
          <>
            <section aria-labelledby="providers">
              <SectionHeading id="providers" title={t("providers")} description={t("providersHint")} />
              <Card>
                <ul className="divide-y divide-line">
                  <StatusRow label={t("tavily")} ok={status.tavily} okLabel={t("configured")} missingLabel={t("missing")} detail="TAVILY_API_KEY" />
                  <StatusRow label={t("anthropic")} ok={status.anthropic} okLabel={t("configured")} missingLabel={t("missing")} detail="ANTHROPIC_API_KEY" />
                  <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px]">
                    <span className="font-medium text-ink">{t("model")}</span>
                    <span className="font-mono text-ink-2">
                      {status.model} · {t("effort")}: {status.effort} · {t("fallbacks")}: {status.fallbacks}
                    </span>
                  </li>
                  <StatusRow label={t("directFetch")} ok={status.directFetch} okLabel={t("enabled")} missingLabel={t("disabled")} />
                  <StatusRow label={t("worker")} ok={workers.length > 0} okLabel={t("workerOnline")} missingLabel={t("missing")} detail={workers.length === 0 ? t("workerOffline") : undefined} />
                </ul>
              </Card>
              <div className="mt-3">
                {status.liveReady ? (
                  <Callout tone="ok">{t("liveReady")}</Callout>
                ) : (
                  <Callout tone="warn" title={t("liveNotReady")}>
                    {t("setupSteps")}
                  </Callout>
                )}
              </div>
            </section>

            <section aria-labelledby="limits">
              <SectionHeading id="limits" title={t("limits")} description={t("limitsHint")} />
              <Card className="p-5">
                <LimitsForm
                  current={limits}
                  caps={{
                    maxSearchQueries: env.RESEARCH_MAX_SEARCH_QUERIES,
                    maxResultsPerQuery: env.RESEARCH_MAX_RESULTS_PER_QUERY,
                    maxExtractPages: env.RESEARCH_MAX_EXTRACT_PAGES,
                    maxModelCalls: env.RESEARCH_MAX_MODEL_CALLS,
                  }}
                />
              </Card>
            </section>

            <section aria-labelledby="usage">
              <SectionHeading id="usage" title={t("usage")} description={t("usageHint")} />
              <Card>
                <ul className="divide-y divide-line">
                  {usage.length === 0 ? <li className="px-4 py-3 text-sm text-muted">—</li> : null}
                  {usage.map((u) => (
                    <li key={u.provider} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px]">
                      <span className="font-medium capitalize text-ink">{u.provider}</span>
                      <span className="text-muted tabular">
                        {t("usageRow", { requests: u.requests, tokens: u.tokens, credits: u.credits })} · {t("estimatedCost")}{" "}
                        {format.number(u.cost, { style: "currency", currency: "USD", maximumFractionDigits: 3 })}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          </>
        )}

        <p>
          <Link href="/data-use" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {t("dataLink")}
          </Link>
        </p>
      </div>
    </PageContainer>
  );
}
