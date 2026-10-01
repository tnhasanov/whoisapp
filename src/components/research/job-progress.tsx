"use client";

import { CheckCircle2, Circle, CircleDashed, CircleDot, CircleSlash, Loader2, TriangleAlert, XCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cancelJobAction, refineAction, reopenIdentityAction, retryJobAction } from "@/app/actions/research";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Callout } from "@/components/ui/feedback";
import type { JobView, StageView } from "@/lib/data/jobs";
import { cn } from "@/lib/utils";
import { identityReason } from "@/lib/i18n/identity";
import { useDateFormat } from "@/lib/i18n/use-date-format";

const ACTIVE = new Set(["queued", "running"]);

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function formatDuration(ms: number, t: (key: "durationHours" | "durationMinutes", values: Record<string, string | number>) => string): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m >= 60 ? t("durationHours", { hours: Math.floor(m / 60), minutes: m % 60 }) : t("durationMinutes", { minutes: m, seconds: String(s).padStart(2, "0") });
}

function newKey() {
  return crypto.randomUUID().replace(/-/g, "");
}

export function JobProgress({ initial }: { initial: JobView }) {
  const t = useTranslations("Job");
  const tStatus = useTranslations("Search.statuses");
  const tEvents = useTranslations("JobEvents");
  const tMethods = useTranslations("Identity.methods");
  const tKinds = useTranslations("Activity.kinds");
  const fmtDate = useDateFormat();
  const router = useRouter();
  const [job, setJob] = useState(initial);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const wasActive = useRef(ACTIVE.has(initial.status));
  const active = ACTIVE.has(job.status);
  const now = useNow(active);

  useEffect(() => {
    if (!ACTIVE.has(job.status)) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${job.id}`, { cache: "no-store" });
        if (res.ok) {
          const next = (await res.json()) as JobView;
          if (stopped) return;
          setJob(next);
          if (!ACTIVE.has(next.status)) {
            if (next.status === "completed" && next.profileId && wasActive.current) {
              router.push(`/profiles/${next.profileId}`);
            } else {
              router.refresh();
            }
            return;
          }
        }
      } catch {
        // transient network error: keep polling
      }
      if (!stopped) timer = setTimeout(poll, document.hidden ? 5000 : 1500);
    };
    timer = setTimeout(poll, 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [job.id, job.status, router]);

  const started = job.startedAt ?? job.createdAt;
  const elapsed = (job.finishedAt ? new Date(job.finishedAt).getTime() : now) - new Date(started).getTime();
  const name = job.query.fullName;
  const terminal = !active;

  // Keep the newest activity in view unless the reader has scrolled up to older entries.
  const eventList = useRef<HTMLOListElement>(null);
  const eventCount = job.events.length;
  useEffect(() => {
    const list = eventList.current;
    if (!list) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    if (nearBottom || list.dataset.seen !== "1") {
      list.scrollTop = list.scrollHeight;
      list.dataset.seen = "1";
    }
  }, [eventCount]);

  const eventText = (e: JobView["events"][number]) => {
    const data = e.data ?? {};
    const key = e.code.replace(/\./g, "_") as Parameters<typeof tEvents>[0];
    if (tEvents.has(key)) {
      try {
        return tEvents(key, { ...data, count: Array.isArray(data.variants) ? data.variants.length : (data.count as number | undefined) ?? 0 } as Record<string, string | number>);
      } catch {
        return e.message;
      }
    }
    return e.message;
  };

  const run = (fn: () => Promise<{ error?: string } | void>) =>
    start(async () => {
      setActionError(null);
      const result = await fn();
      if (result && "error" in result && result.error) setActionError(result.error);
      else router.refresh();
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="label-caps mb-1.5 flex items-center gap-2">
            {t("eyebrow")}
            {job.workspace === "demo" ? <Badge tone="demo">{t("demoBadge")}</Badge> : null}
            {job.kind !== "search" ? <Badge tone="outline">{tKinds(job.kind as "refresh" | "retry")}</Badge> : null}
          </div>
          <h1 className="font-serif text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[32px]">
            {job.outcome === "no_candidates" ? t("titleNone") : active ? t("titleRunning", { name }) : t("titleDone", { name })}
          </h1>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
            <span className="tabular">{t("elapsed", { time: formatDuration(elapsed, t) })}</span>
            {job.query.company ? <span>· {job.query.company}</span> : null}
            {job.query.country ? <span>· {job.query.country}</span> : null}
            <span>· {fmtDate(job.createdAt, "dateTime")}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {active ? (
            <ConfirmDialog
              trigger={
                <Button variant="secondary" disabled={job.cancelRequested || pending}>
                  {job.cancelRequested ? t("cancelling") : t("cancel")}
                </Button>
              }
              title={t("cancelConfirmTitle")}
              description={t("cancelConfirmBody")}
              confirmLabel={t("cancel")}
              cancelLabel={t("keepRunning")}
              destructive
              onConfirm={() => run(() => cancelJobAction(job.id))}
            />
          ) : null}
          {terminal && ["failed", "partial", "cancelled"].includes(job.status) && job.outcome !== "refined" && !job.retriedById ? (
            <Button disabled={pending} onClick={() => run(() => retryJobAction(job.id, newKey()))}>
              {pending ? t("retrying") : t("retry")}
            </Button>
          ) : null}
          {job.profileId && terminal ? (
            <ButtonLink href={`/profiles/${job.profileId}`} variant={job.status === "completed" ? "primary" : "secondary"}>
              {t("viewProfile")}
            </ButtonLink>
          ) : null}
        </div>
      </div>

      {actionError ? <Callout tone="danger">{actionError}</Callout> : null}

      <StatusPanel job={job} pending={pending} onRefine={() => run(() => refineAction(job.id))} />

      {job.identityResolution && job.identityResolution.method !== "user_selected" ? (
        <Callout
          title={job.identityResolution.method === "refresh_existing_profile" ? t("identityRefresh") : t("identityAuto")}
          action={
            job.identityResolution.method.startsWith("auto_") && job.candidates.length > 0 ? (
              <Button variant="link" disabled={pending} onClick={() => run(() => reopenIdentityAction(job.id, newKey()))}>
                {t("chooseDifferent")}
              </Button>
            ) : null
          }
        >
          {identityReason(job.identityResolution, (k, v) => tMethods(k as never, v as never))}
        </Callout>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card className="p-5">
          <ol className="space-y-1" aria-label={t("stagesLabel")}>
            {job.stages.map((s) => (
              <StageRow key={s.stage} stage={s} label={t(`stages.${s.stage}`)} statusLabel={t(`stageStatus.${s.status}`)} />
            ))}
          </ol>
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
            <div>
              <dt className="label-caps">{t("statSources")}</dt>
              <dd className="mt-1 font-serif text-2xl text-ink tabular">{job.sources.total}</dd>
            </div>
            <div>
              <dt className="label-caps">{t("statRead")}</dt>
              <dd className="mt-1 font-serif text-2xl text-ink tabular">{job.sources.read}</dd>
            </div>
            <div>
              <dt className="label-caps">{t("statLimited")}</dt>
              <dd className="mt-1 font-serif text-2xl text-ink tabular">{job.sources.limited}</dd>
            </div>
          </dl>
          <p className="sr-only">
            {t("sourcesFound", { total: job.sources.total })}, {t("sourcesRead", { read: job.sources.read })}, {t("sourcesLimited", { limited: job.sources.limited })}
          </p>
        </Card>

        <Card className="flex max-h-[520px] flex-col p-0">
          <h2 className="border-b border-line px-5 py-3 label-caps">{t("activity")}</h2>
          <ol ref={eventList} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-4 text-[13px] scrollbar-thin" aria-live="polite" aria-relevant="additions">
            {job.events.length === 0 ? <li className="text-muted">{t("noEvents")}</li> : null}
            {job.events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="shrink-0 whitespace-nowrap pt-px text-[11.5px] text-subtle tabular">{fmtDate(e.at, "timeSeconds")}</span>
                <span className={cn("min-w-0 break-anywhere", e.level === "error" ? "text-danger" : e.level === "warn" ? "text-warn" : "text-ink-2")}>{eventText(e)}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <UsageNote job={job} />
      {active ? <p className="text-xs text-muted">{t("leaveNote")}</p> : null}
      <span className="sr-only" aria-live="polite">
        {tStatus(job.status)}
      </span>
    </div>
  );
}

function StatusPanel({ job, pending, onRefine }: { job: JobView; pending: boolean; onRefine: () => void }) {
  const t = useTranslations("Job");
  if (job.status === "queued") {
    return (
      <Callout tone={job.workerOnline ? "info" : "warn"} title={job.workerOnline ? t("queuedWaiting") : undefined}>
        {job.workerOnline ? null : t("queuedNoWorker")}
      </Callout>
    );
  }
  if (job.status === "running") {
    const stale = job.heartbeatAgeSeconds !== null && job.heartbeatAgeSeconds > 60;
    return stale ? <Callout tone="warn">{t("staleWarning", { seconds: job.heartbeatAgeSeconds ?? 0 })}</Callout> : null;
  }
  if (job.outcome === "no_candidates") {
    return (
      <Callout
        title={t("titleNone")}
        action={
          <Button size="sm" disabled={pending} onClick={onRefine}>
            {t("refineSearch")}
          </Button>
        }
      >
        {t("noCandidatesBody")}
      </Callout>
    );
  }
  if (job.status === "completed") return <Callout tone="ok" title={t("statusCompleted")} />;
  if (job.status === "partial") return <Callout tone="warn" title={t("statusPartial")}>{t("statusPartialBody")} {t("retryHint")}</Callout>;
  if (job.status === "failed") {
    return (
      <Callout tone="danger" title={t("statusFailed")}>
        <p>{job.errorMessage}</p>
        <p className="mt-1">{t("retryHint")}</p>
        {job.errorCode ? <p className="mt-1 text-xs text-muted">{t("technicalHint", { code: job.errorCode })}</p> : null}
      </Callout>
    );
  }
  if (job.status === "cancelled" && job.outcome !== "refined") return <Callout title={t("statusCancelled")}>{t("statusCancelledBody")}</Callout>;
  return null;
}

function StageRow({ stage, label, statusLabel }: { stage: StageView; label: string; statusLabel: string }) {
  const icon = {
    pending: <Circle className="h-4 w-4 text-line-strong" aria-hidden />,
    running: <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />,
    completed: <CheckCircle2 className="h-4 w-4 text-ok" aria-hidden />,
    failed: <XCircle className="h-4 w-4 text-danger" aria-hidden />,
    skipped: <CircleSlash className="h-4 w-4 text-subtle" aria-hidden />,
    partial: <TriangleAlert className="h-4 w-4 text-warn" aria-hidden />,
  }[stage.status];
  return (
    <li className={cn("flex items-center justify-between gap-3 rounded-md px-2 py-1.5", stage.status === "running" && "bg-accent-soft")}>
      <span className="flex min-w-0 items-center gap-2.5">
        {icon ?? <CircleDashed className="h-4 w-4" aria-hidden />}
        <span className={cn("truncate text-[13.5px]", stage.status === "pending" || stage.status === "skipped" ? "text-muted" : "text-ink")}>{label}</span>
      </span>
      <span className={cn("shrink-0 text-[11.5px]", stage.status === "failed" ? "text-danger" : stage.status === "partial" ? "text-warn" : "text-subtle")}>
        {stage.status === "running" ? <CircleDot className="mr-1 inline h-3 w-3 animate-soft-pulse" aria-hidden /> : null}
        {statusLabel}
      </span>
    </li>
  );
}

function UsageNote({ job }: { job: JobView }) {
  const t = useTranslations("Job");
  const format = useFormatter();
  if (job.workspace === "demo") return <p className="text-xs text-muted">{t("usageDemo")}</p>;
  if (!job.usage) return null;
  return (
    <p className="text-xs text-muted">
      {t("usageDetail", { searches: job.usage.searchRequests, extracts: job.usage.extractRequests, calls: job.usage.modelCalls })} ·{" "}
      {t("usageEstimate", { cost: format.number(job.usage.estimatedCostUsd, { style: "currency", currency: "USD", maximumFractionDigits: 3 }) })}
    </p>
  );
}
