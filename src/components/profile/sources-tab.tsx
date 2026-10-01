"use client";

import { AlertTriangle, ChevronDown, ExternalLink, FileText, Lock, SearchCheck } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useEvidence } from "@/components/evidence/evidence-context";
import { Badge } from "@/components/ui/badge";
import { Card, SectionHeading } from "@/components/ui/card";
import { formatPartialDate, formatPartialDateString } from "@/lib/dates/partial-date";
import type { SourceView } from "@/lib/data/profiles";
import { displayHost, sourceHref } from "@/lib/source-links";
import { cn } from "@/lib/utils";
import { useDateFormat } from "@/lib/i18n/use-date-format";

type Filter = "all" | "yes" | "no" | "limited";

function SourceRow({ source }: { source: SourceView }) {
  const { open } = useEvidence();
  const t = useTranslations("Evidence");
  const tTypes = useTranslations("SourceTypes");
  const tS = useTranslations("Sources");
  const locale = useLocale();
  const link = sourceHref(source);
  return (
    <li className="grid gap-2 p-4 md:grid-cols-[3rem_minmax(0,1fr)_14rem] md:gap-4">
      <span className="text-[12px] font-semibold text-accent tabular">[{source.sourceKey.replace(/^S/, "")}]</span>
      <div className="min-w-0">
        <button type="button" onClick={() => open({ kind: "source", id: source.id })} className="text-left text-[14px] font-medium text-ink hover:text-accent break-anywhere">
          {source.title ?? displayHost(source.url)}
        </button>
        <p className="mt-0.5 text-xs text-muted break-anywhere">
          {source.publisher ?? displayHost(source.url)} · {tTypes(source.sourceType)} · {source.language !== "unknown" ? t(`languages.${source.language}`) : t("languages.unknown")}
        </p>
        {source.accessNote ? <p className="mt-1 text-xs text-warn">{source.accessNote}</p> : null}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge tone={source.aboutSubject === "yes" ? "ok" : source.aboutSubject === "no" ? "outline" : "warn"}>{tS(`about.${source.aboutSubject}`)}</Badge>
          <Badge tone="outline">{t(`reliability.${source.reliability}`)}</Badge>
          {source.accessStatus !== "read" ? <Badge tone="warn" icon={<Lock className="h-3 w-3" aria-hidden />}>{t(`access.${source.accessStatus}`)}</Badge> : null}
        </div>
      </div>
      <div className="text-xs text-muted md:text-right">
        <p>{source.publishedAt ? t("published", { date: formatPartialDateString(source.publishedAt, locale) }) : t("publishedUnknown")}</p>
        <p className="mt-0.5">{t(`method.${source.accessMethod}`)}</p>
        {link.external ? (
          <a href={link.href} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 font-medium text-accent hover:underline">
            {t("openSource")}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ) : (
          <Link href={link.href} className="mt-1 inline-flex items-center gap-1 font-medium text-accent hover:underline">
            <FileText className="h-3 w-3" aria-hidden />
            {t("openFixture")}
          </Link>
        )}
      </div>
    </li>
  );
}

export function SourcesTab() {
  const { view, open } = useEvidence();
  const t = useTranslations("Sources");
  const tEv = useTranslations("Evidence");
  const locale = useLocale();
  const fmtDate = useDateFormat();
  const [filter, setFilter] = useState<Filter>("all");
  const [showRejected, setShowRejected] = useState(false);
  const sources = view.sources.filter((s) =>
    filter === "all" ? true : filter === "limited" ? s.accessStatus !== "read" : filter === "yes" ? s.aboutSubject === "yes" : s.aboutSubject !== "yes",
  );
  const conflictGroups = [...new Set(view.claims.map((c) => c.conflictGroup).filter((g): g is string => Boolean(g)))];
  const rejected = view.snapshot.diagnostics?.rejected ?? [];
  const rejectedByReason = rejected.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.reason]: (acc[r.reason] ?? 0) + 1 }), {});
  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t("filterAll"), count: view.sources.length },
    { key: "yes", label: t("filterUsed"), count: view.sources.filter((s) => s.aboutSubject === "yes").length },
    { key: "no", label: t("filterExcluded"), count: view.sources.filter((s) => s.aboutSubject !== "yes").length },
    { key: "limited", label: t("filterLimited"), count: view.sources.filter((s) => s.accessStatus !== "read").length },
  ];

  return (
    <div className="space-y-10">
      <section aria-labelledby="sources-heading">
        <SectionHeading id="sources-heading" title={t("title")} description={t("hint")} />
        <div role="tablist" aria-label={t("title")} className="mb-3 flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              role="tab"
              type="button"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn("rounded-full border px-3 py-1 text-[12.5px] font-medium", filter === f.key ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-muted hover:text-ink")}
            >
              {f.label} <span className="tabular font-normal">{f.count}</span>
            </button>
          ))}
        </div>
        <Card>
          <ul className="divide-y divide-line">
            {sources.map((s) => (
              <SourceRow key={s.id} source={s} />
            ))}
          </ul>
        </Card>
        <p className="mt-2 text-xs text-muted">{t("notesOnly")}</p>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="conflicts-heading">
          <SectionHeading id="conflicts-heading" title={t("conflicts")} />
          <Card className="p-4">
            {conflictGroups.length === 0 ? (
              <p className="text-sm text-muted">{t("conflictsEmpty")}</p>
            ) : (
              <ul className="space-y-4">
                {conflictGroups.map((g) => {
                  const versions = view.claims.filter((c) => c.conflictGroup === g);
                  return (
                    <li key={g}>
                      <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
                        <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
                        {versions[0].displayValue}
                      </p>
                      <ul className="mt-1.5 space-y-1 pl-6">
                        {versions.map((v) => (
                          <li key={v.id} className="text-[13px] text-ink-2">
                            <button type="button" className="text-accent hover:underline" onClick={() => open({ kind: "claim", id: v.id })}>
                              {[formatPartialDate(v.temporal.start, locale), formatPartialDate(v.temporal.end, locale)].filter(Boolean).join(" – ") || "—"}
                            </button>{" "}
                            — {v.evidence.map((e) => view.sources.find((s) => s.id === e.sourceId)?.publisher).filter(Boolean).join(", ")}
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>

        <section aria-labelledby="limits-heading">
          <SectionHeading id="limits-heading" title={t("limitations")} />
          <Card className="p-4">
            {view.snapshot.accessLimitations.length === 0 ? (
              <p className="text-sm text-muted">{t("limitationsEmpty")}</p>
            ) : (
              <ul className="space-y-2.5">
                {view.snapshot.accessLimitations.map((l, i) => (
                  <li key={i} className="text-[13px]">
                    <span className="font-medium text-ink">{l.domain}</span> <Badge tone="warn">{tEv(`access.${l.status}`)}</Badge>
                    <p className="text-xs text-muted">{l.note}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>

      <section aria-labelledby="coverage-heading">
        <SectionHeading id="coverage-heading" title={t("coverage")} />
        <Card>
          <ul className="divide-y divide-line">
            {view.snapshot.coverage.map((c) => (
              <li key={c.category} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                  <SearchCheck className="h-4 w-4 text-muted" aria-hidden />
                  {t(`categories.${c.category}`)}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="tabular">{t("coverageRow", { queries: c.queries, results: c.results })}</span>
                  <Badge tone={c.status === "ok" ? "ok" : c.status === "failed" ? "danger" : "outline"}>{t(`coverageStatus.${c.status}`)}</Badge>
                </span>
                {c.note ? <p className="basis-full text-xs text-muted">{c.note}</p> : null}
              </li>
            ))}
          </ul>
        </Card>
        <p className="mt-2 text-xs text-muted">
          {view.snapshot.modelInfo.provider === "fixture" ? t("modelFixture") : t("model", { model: view.snapshot.modelInfo.model, prompt: view.snapshot.modelInfo.promptVersion })} ·{" "}
          {fmtDate(view.snapshot.researchedAt, "dateTime")}
        </p>
      </section>

      <section aria-labelledby="rejected-heading">
        <SectionHeading id="rejected-heading" title={t("rejected")} description={t("rejectedHint")} />
        <Card className="p-4">
          {rejected.length === 0 ? (
            <p className="text-sm text-muted">{t("rejectedNone")}</p>
          ) : (
            <>
              <ul className="flex flex-wrap gap-2">
                {Object.entries(rejectedByReason).map(([reason, count]) => (
                  <li key={reason}>
                    <Badge tone="outline">
                      {t.has(`rejectedReason.${reason}`) ? t(`rejectedReason.${reason}` as "rejectedReason.excerpt_not_found") : reason}: {count}
                    </Badge>
                  </li>
                ))}
              </ul>
              <button type="button" aria-expanded={showRejected} onClick={() => setShowRejected((v) => !v)} className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showRejected && "rotate-180")} aria-hidden />
                {rejected.length}
              </button>
              {showRejected ? (
                <ul className="mt-2 space-y-1 text-xs text-muted">
                  {rejected.map((r, i) => (
                    <li key={i}>
                      <span className="font-medium text-ink-2">{r.kind}</span> · {r.sourceKey ?? "—"} · {r.preview}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </Card>
      </section>
    </div>
  );
}
