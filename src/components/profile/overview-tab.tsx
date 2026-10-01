"use client";

import { AlertTriangle, Info, Lightbulb, MessageCircleQuestion, Newspaper } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { EvidenceStatusBadge } from "@/components/evidence/evidence-badge";
import { useEvidence } from "@/components/evidence/evidence-context";
import { CitationMarkers } from "@/components/evidence/evidence-trigger";
import { Badge } from "@/components/ui/badge";
import { Card, SectionHeading } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { formatPartialDate, formatPartialDateString, partialDateSortKey } from "@/lib/dates/partial-date";
import { gapText } from "@/lib/i18n/gaps";
import { uncertaintyText } from "@/lib/i18n/uncertainty";
import type { ClaimView } from "@/lib/data/profiles";
import { cn } from "@/lib/utils";
import { NotesPanel } from "./notes-panel";

function MediaMarker({ id }: { id: string }) {
  const { open, view } = useEvidence();
  const item = view.stories.flatMap((s) => s.items).find((i) => i.id === id);
  if (!item) return null;
  return (
    <button
      type="button"
      onClick={() => open({ kind: "media", id })}
      className="ml-1 inline-flex translate-y-[-1px] items-center gap-0.5 rounded px-1 align-middle text-[11px] font-semibold text-accent hover:bg-accent-soft"
      aria-label={`${item.outlet}: ${item.headline}`}
      title={item.headline}
    >
      <Newspaper className="h-3 w-3" aria-hidden />
    </button>
  );
}

function ClaimMarkers({ claimIds }: { claimIds: string[] }) {
  const { view } = useEvidence();
  return (
    <>
      {claimIds.map((id) => {
        const c = view.claims.find((x) => x.id === id);
        return c ? <CitationMarkers key={id} target={{ kind: "claim", id }} sourceIds={c.evidence.map((e) => e.sourceId)} label={c.displayValue} /> : null;
      })}
    </>
  );
}

function periodLabel(c: ClaimView, locale: string, t: (k: string, v?: Record<string, string>) => string): string {
  const start = formatPartialDate(c.temporal.start, locale);
  const end = formatPartialDate(c.temporal.end, locale);
  if (start && end) return `${start} – ${end}`;
  if (start && c.temporal.currency === "stated_current") return `${start} – ${t("present")}`;
  if (start) return `${start} – ?`;
  if (end) return t("until", { date: end });
  if (c.temporal.currency === "stated_current" && c.temporal.asOf) {
    return t(c.temporal.asOfBasis === "accessed" ? "asOfAccessed" : "asOf", { date: formatPartialDateString(c.temporal.asOf, locale) });
  }
  return t("dateUnknown");
}

/** One timeline row. Conflicting versions of the same fact render together. */
function TimelineEntry({ claims }: { claims: ClaimView[] }) {
  const t = useTranslations("Overview");
  const tLanguages = useTranslations("Evidence.languages");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const primary = claims[0];
  const tUncertainty = useTranslations("Uncertainty");
  const uncertainty = uncertaintyText(primary.temporal, primary.uncertaintyNote, locale, (key, values) => tUncertainty(key, values));
  const conflicting = claims.length > 1 || primary.evidenceStatus === "conflicting";
  const value = primary.value;
  const title = value.kind === "employment" ? (value.title ?? "—") : value.kind === "affiliation" ? (value.role ?? t("memberFallback")) : primary.displayValue;
  const org = value.kind === "employment" || value.kind === "affiliation" ? value.organisation : value.kind === "education" ? value.institution : null;
  const current = primary.temporal.currency === "stated_current";
  return (
    <li className="relative grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 pb-6 last:pb-0 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
      <div className="pt-0.5 text-right">
        {conflicting ? (
          <div className="space-y-0.5">
            {claims.map((c) => (
              <p key={c.id} className="text-[12.5px] text-ink-2 tabular">
                {periodLabel(c, locale, tCommon)}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] text-ink-2 tabular">{periodLabel(primary, locale, tCommon)}</p>
        )}
      </div>
      <div className="relative border-l border-line pl-5">
        <span
          className={cn(
            "absolute -left-[5px] top-1.5 h-[9px] w-[9px] rounded-full border-2",
            current && !primary.temporal.possiblyOutdated ? "border-accent bg-accent" : "border-line-strong bg-surface",
          )}
          aria-hidden
        />
        <p className="text-[15px] font-medium leading-snug text-ink">
          {title}
          {!conflicting ? <ClaimMarkers claimIds={[primary.id]} /> : null}
        </p>
        {org ? <p className="text-[14px] text-ink-2">{org}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {conflicting ? (
            <Badge tone="danger" icon={<AlertTriangle className="h-3 w-3" aria-hidden />}>
              {t("conflict")}
            </Badge>
          ) : (
            <EvidenceStatusBadge status={primary.evidenceStatus} />
          )}
          {current && primary.temporal.asOf ? (
            <Badge tone="outline">
              {t(primary.temporal.asOfBasis === "accessed" ? "statedCurrentAccessed" : "statedCurrent", { date: formatPartialDateString(primary.temporal.asOf, locale) })}
            </Badge>
          ) : null}
          {primary.temporal.possiblyOutdated ? <Badge tone="warn">{t("possiblyOutdated")}</Badge> : null}
          {primary.isTranslated ? <Badge tone="outline">{t("translated", { language: tLanguages(primary.language) })}</Badge> : null}
        </div>
        {conflicting ? (
          <ul className="mt-2 space-y-1 rounded-md bg-danger-soft/60 px-3 py-2 text-[13px] text-ink-2">
            {claims.map((c) => (
              <li key={c.id}>
                {periodLabel(c, locale, tCommon)} — <EvidenceStatusBadge status={c.evidence.length > 1 ? "multiple_sources" : "single_source"} />
                <ClaimMarkers claimIds={[c.id]} />
              </li>
            ))}
          </ul>
        ) : null}
        {uncertainty && !conflicting ? <p className="mt-1.5 text-xs text-muted">{uncertainty}</p> : null}
      </div>
    </li>
  );
}

function groupForTimeline(claims: ClaimView[]): ClaimView[][] {
  const groups = new Map<string, ClaimView[]>();
  for (const c of claims) {
    const key = c.conflictGroup ?? c.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  // Most recent first. Only roles stated as current by a recent source sort as "present";
  // an old "currently" statement is placed at the date it was made.
  const known = (d: Parameters<typeof partialDateSortKey>[0]) => (d ? partialDateSortKey(d) : "0000");
  const anchor = (g: ClaimView[]) => {
    const c = g[0];
    if (c.temporal.currency === "stated_current" && !c.temporal.end && !c.temporal.possiblyOutdated) return `9${known(c.temporal.start)}`;
    if (c.temporal.end) return known(c.temporal.end);
    if (c.temporal.currency === "stated_current" && c.temporal.asOf) return c.temporal.asOf;
    return known(c.temporal.start);
  };
  return [...groups.values()].sort((a, b) => anchor(b).localeCompare(anchor(a)));
}

function Block({ title, description, children, id }: { title: string; description?: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id}>
      <SectionHeading id={id} title={title} description={description} />
      {children}
    </section>
  );
}

export function OverviewTab() {
  const { view } = useEvidence();
  const t = useTranslations("Overview");
  const tLanguages = useTranslations("Evidence.languages");
  const tGaps = useTranslations("Gaps");
  const tCategories = useTranslations("Sources.categories");
  const locale = useLocale();
  const overview = view.snapshot.overview;
  const employment = view.claims.filter((c) => c.category === "employment");
  const education = view.claims.filter((c) => c.category === "education");
  const affiliations = view.claims.filter((c) => c.category === "affiliation");
  const other = view.claims.filter((c) => ["biography", "award", "publication", "location"].includes(c.category));

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-10">
        <Block id="summary" title={t("summary")} description={t("summaryHint")}>
          <Card className="p-5 sm:p-6">
            {overview.narrativeAvailable && overview.summary.length > 0 ? (
              <div className="space-y-3 font-serif text-[16.5px] leading-[1.65] text-ink">
                {overview.summary.map((s, i) => (
                  <p key={i} className={cn(s.kind === "inferred" && "italic text-ink-2")}>
                    {s.kind === "inferred" ? (
                      <Badge tone="violet" className="mr-2 not-italic align-middle font-sans" icon={<Lightbulb className="h-3 w-3" aria-hidden />} title={t("inferredHint")}>
                        {t("inferred")}
                      </Badge>
                    ) : null}
                    {s.text}
                    <span className="font-sans not-italic">
                      <ClaimMarkers claimIds={s.claimIds} />
                      {s.mediaIds.map((m) => (
                        <MediaMarker key={m} id={m} />
                      ))}
                    </span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">{t("summaryUnavailable")}</p>
            )}
          </Card>
        </Block>

        <Block id="career" title={t("career")}>
          {employment.length === 0 ? (
            <EmptyState title={t("careerEmpty")} />
          ) : (
            <Card className="p-5 sm:p-6">
              <ol>
                {groupForTimeline(employment).map((g) => (
                  <TimelineEntry key={g[0].id} claims={g} />
                ))}
              </ol>
            </Card>
          )}
        </Block>

        <div className="grid gap-10 lg:grid-cols-2">
          <Block id="education" title={t("education")}>
            {education.length === 0 ? (
              <EmptyState title={t("educationEmpty")} />
            ) : (
              <Card className="divide-y divide-line">
                {groupForTimeline(education).map((g) => {
                  const c = g[0];
                  const v = c.value.kind === "education" ? c.value : null;
                  return (
                    <div key={c.id} className="p-4">
                      <p className="text-[14.5px] font-medium text-ink">
                        {[v?.qualification, v?.field].filter(Boolean).join(", ") || c.displayValue}
                        <ClaimMarkers claimIds={g.map((x) => x.id)} />
                      </p>
                      <p className="text-[13.5px] text-ink-2">{v?.institution}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted tabular">{[formatPartialDate(c.temporal.start, locale), formatPartialDate(c.temporal.end, locale)].filter(Boolean).join(" – ") || "—"}</span>
                        {g.length > 1 || c.evidenceStatus === "conflicting" ? <Badge tone="danger">{t("conflict")}</Badge> : <EvidenceStatusBadge status={c.evidenceStatus} />}
                        {c.isTranslated ? <Badge tone="outline">{t("translated", { language: tLanguages(c.language) })}</Badge> : null}
                      </div>
                      {c.isTranslated && c.originalText ? (
                        <p className="mt-1 text-xs text-muted">
                          {t("original")}: <span lang={c.language === "unknown" ? undefined : c.language} className="font-serif text-ink-2">{c.originalText}</span>
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </Card>
            )}
          </Block>
          <Block id="affiliations" title={t("affiliations")}>
            {affiliations.length === 0 ? (
              <EmptyState title={t("affiliationsEmpty")} />
            ) : (
              <Card className="divide-y divide-line">
                {affiliations.map((c) => (
                  <div key={c.id} className="p-4">
                    <p className="text-[14.5px] font-medium text-ink">
                      {c.value.kind === "affiliation" ? (c.value.role ?? "—") : c.displayValue}
                      <ClaimMarkers claimIds={[c.id]} />
                    </p>
                    <p className="text-[13.5px] text-ink-2">{c.value.kind === "affiliation" ? c.value.organisation : null}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted tabular">
                        {[formatPartialDate(c.temporal.start, locale), formatPartialDate(c.temporal.end, locale)].filter(Boolean).join(" – ") || "—"}
                      </span>
                      <EvidenceStatusBadge status={c.evidenceStatus} />
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </Block>
        </div>

        {other.length > 0 ? (
          <Block id="other" title={t("otherFacts")}>
            <Card className="divide-y divide-line">
              {other.map((c) => (
                <div key={c.id} className="flex flex-wrap items-start justify-between gap-2 p-4">
                  <p className="min-w-0 flex-1 text-[14px] text-ink">
                    <span className="label-caps mr-2">{t(`categories.${c.category}`)}</span>
                    {c.value.kind === "location" ? t(c.value.scope === "work" ? "worksIn" : "basedIn", { place: c.value.place }) : c.displayValue}
                    <ClaimMarkers claimIds={[c.id]} />
                  </p>
                  <EvidenceStatusBadge status={c.evidenceStatus} />
                </div>
              ))}
            </Card>
          </Block>
        ) : null}

        <Block id="developments" title={t("keyDevelopments")}>
          {overview.keyDevelopments.length === 0 ? (
            <EmptyState title={t("keyDevelopmentsEmpty")} />
          ) : (
            <Card className="p-5 sm:p-6">
              <ol className="space-y-4">
                {overview.keyDevelopments.map((k, i) => (
                  <li key={i} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
                    <span className="pt-0.5 text-right text-[12.5px] text-ink-2 tabular">{k.date ? formatPartialDate(k.date, locale) : "—"}</span>
                    <p className="text-[14.5px] leading-relaxed text-ink">
                      {k.text}
                      <ClaimMarkers claimIds={k.claimIds} />
                      {k.mediaIds.map((m) => (
                        <MediaMarker key={m} id={m} />
                      ))}
                    </p>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </Block>

        <div className="grid gap-10 lg:grid-cols-2">
          <Block id="gaps" title={t("gaps")} description={t("gapsHint")}>
            <Card className="p-5">
              <ul className="space-y-2.5">
                {overview.gaps.map((g) => (
                  <li key={g.code} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden />
                    {gapText(g, (k, v) => tGaps(k as never, v as never), (k) => tCategories(k as never))}
                  </li>
                ))}
              </ul>
            </Card>
          </Block>
          <Block id="questions" title={t("questions")} description={t("questionsHint")}>
            <Card className="p-5">
              {overview.questions.length === 0 ? (
                <p className="text-sm text-muted">—</p>
              ) : (
                <ol className="space-y-3">
                  {overview.questions.map((q, i) => (
                    <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink">
                      <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                      <span>
                        {q.question}
                        <ClaimMarkers claimIds={q.claimIds} />
                        {q.mediaIds.map((m) => (
                          <MediaMarker key={m} id={m} />
                        ))}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </Block>
        </div>
      </div>
      <aside className="xl:sticky xl:top-20">
        <NotesPanel />
      </aside>
    </div>
  );
}
