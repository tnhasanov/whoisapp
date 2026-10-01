"use client";

import { Copy, Newspaper } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { AllegationsBlock } from "@/components/evidence/evidence-drawer";
import { useEvidence } from "@/components/evidence/evidence-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionHeading } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Input, Label, Select } from "@/components/ui/field";
import { formatPartialDate, formatPartialDateString, parsePartialDate, partialDateEnd, partialDateStart } from "@/lib/dates/partial-date";
import type { StoryView } from "@/lib/data/profiles";
import type { CoverageType } from "@/lib/domain/types";

type Filters = { language: string; topic: string; from: string; to: string; sort: "relevance" | "newest" };

function StoryCard({ story }: { story: StoryView }) {
  const { open } = useEvidence();
  const t = useTranslations("News");
  const tEv = useTranslations("Evidence");
  const locale = useLocale();
  const primary = story.items.find((i) => i.isPrimary) ?? story.items[0];
  const copies = story.items.filter((i) => i.id !== primary.id);
  return (
    <article className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span className="font-medium text-ink-2">{primary.outlet}</span>
        <span aria-hidden>·</span>
        <span className="tabular">{primary.publishedAt ? formatPartialDateString(primary.publishedAt, locale) : tEv("publishedUnknown")}</span>
        {primary.eventDate ? (
          <>
            <span aria-hidden>·</span>
            <span>
              {t("eventDate")}: {formatPartialDate(primary.eventDate, locale)}
            </span>
          </>
        ) : null}
        <span aria-hidden>·</span>
        <span>{tEv(`languages.${primary.language}`)}</span>
      </div>
      <h3 className="mt-1.5">
        <button type="button" onClick={() => open({ kind: "media", id: primary.id })} className="text-left font-serif text-[17.5px] font-semibold leading-snug text-ink hover:text-accent" lang={primary.language === "unknown" ? undefined : primary.language}>
          {primary.headline}
        </button>
      </h3>
      {!primary.publishedAt && primary.providerReportedDate ? (
        <p className="mt-1 text-xs text-muted">{tEv("providerDate", { date: formatPartialDateString(primary.providerReportedDate, locale) })}</p>
      ) : null}
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{primary.summary}</p>
      {primary.summaryBasis === "snippet_only" ? <p className="mt-1 text-xs text-warn">{t("summaryBasisSnippet")}</p> : null}
      {primary.involvement ? (
        <p className="mt-2 text-[13px] text-ink-2">
          <span className="font-medium text-ink">{t("involvement")}:</span> {primary.involvement}
        </p>
      ) : null}
      {primary.allegations ? <AllegationsBlock allegations={primary.allegations} /> : null}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral">{t(`kinds.${primary.kind}`)}</Badge>
        <Badge tone="outline">{t(`topics.${primary.topic}`)}</Badge>
        {copies.length > 0 ? (
          <Badge tone="accent" icon={<Copy className="h-3 w-3" aria-hidden />} title={t("copiesHint")}>
            {t("copies", { count: copies.length })}
          </Badge>
        ) : null}
      </div>
      {copies.length > 0 ? (
        <div className="mt-2 text-[12.5px] text-muted">
          {t("alternateLinks")}:{" "}
          {copies.map((c, i) => (
            <span key={c.id}>
              <button type="button" className="text-accent hover:underline" onClick={() => open({ kind: "media", id: c.id })}>
                {c.outlet}
              </button>
              {i < copies.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function matchesFilters(story: StoryView, f: Filters): boolean {
  const primary = story.items.find((i) => i.isPrimary) ?? story.items[0];
  if (f.language && !story.items.some((i) => i.language === f.language)) return false;
  if (f.topic && story.topic !== f.topic) return false;
  if (f.from || f.to) {
    const date = parsePartialDate(primary.publishedAt);
    if (!date) return false;
    if (f.from && partialDateEnd(date) < new Date(`${f.from}-01T00:00:00Z`)) return false;
    if (f.to) {
      const to = new Date(`${f.to}-01T00:00:00Z`);
      to.setUTCMonth(to.getUTCMonth() + 1);
      if (partialDateStart(date) >= to) return false;
    }
  }
  return true;
}

export function NewsTab() {
  const { view } = useEvidence();
  const t = useTranslations("News");
  const tEv = useTranslations("Evidence");
  const tOverview = useTranslations("Overview");
  const locale = useLocale();
  const [filters, setFilters] = useState<Filters>({ language: "", topic: "", from: "", to: "", sort: "relevance" });
  const languages = [...new Set(view.stories.flatMap((s) => s.items.map((i) => i.language)))];
  const topics = [...new Set(view.stories.map((s) => s.topic))];

  const filtered = useMemo(() => {
    const list = view.stories.filter((s) => matchesFilters(s, filters));
    if (filters.sort === "newest") {
      return [...list].sort((a, b) => (b.firstPublishedAt ?? "").localeCompare(a.firstPublishedAt ?? ""));
    }
    return [...list].sort((a, b) => a.relevanceRank - b.relevanceRank);
  }, [view.stories, filters]);

  const sections: { key: CoverageType; title: string; hint: string }[] = [
    { key: "direct", title: t("direct"), hint: t("directHint") },
    { key: "organisation", title: t("organisation"), hint: t("organisationHint") },
    { key: "unresolved_same_name", title: t("unresolved"), hint: t("unresolvedHint") },
  ];
  const developments = view.snapshot.overview.keyDevelopments;
  const filterActive = Boolean(filters.language || filters.topic || filters.from || filters.to);

  if (view.stories.length === 0) {
    return (
      <div className="space-y-4">
        <SectionHeading title={t("title")} />
        <EmptyState icon={<Newspaper className="h-6 w-6" aria-hidden />} title={t("empty")} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {developments.length > 0 ? (
        <section aria-labelledby="dev-heading">
          <SectionHeading id="dev-heading" title={t("keyDevelopments")} />
          <Card className="p-5">
            <ol className="space-y-3">
              {developments.map((k, i) => (
                <li key={i} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 text-[14px]">
                  <span className="text-right text-[12.5px] text-ink-2 tabular">{k.date ? formatPartialDate(k.date, locale) : "—"}</span>
                  <span className="text-ink">{k.text}</span>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="feed-heading">
        <SectionHeading id="feed-heading" title={t("feed")} description={t("results", { count: filtered.length })} />
        <form className="mb-4 grid gap-3 rounded-lg border border-line bg-surface-2 p-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => e.preventDefault()}>
          <div className="flex flex-col gap-1">
            <Label htmlFor="f-lang">{t("filterLanguage")}</Label>
            <Select id="f-lang" value={filters.language} onChange={(e) => setFilters({ ...filters, language: e.target.value })}>
              <option value="">{t("allLanguages")}</option>
              {languages.map((l) => (
                <option key={l} value={l}>
                  {tEv(`languages.${l}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="f-topic">{t("filterTopic")}</Label>
            <Select id="f-topic" value={filters.topic} onChange={(e) => setFilters({ ...filters, topic: e.target.value })}>
              <option value="">{t("allTopics")}</option>
              {topics.map((tp) => (
                <option key={tp} value={tp}>
                  {t(`topics.${tp}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="f-from">{t("filterFrom")}</Label>
            <Input id="f-from" type="month" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="f-to">{t("filterTo")}</Label>
            <Input id="f-to" type="month" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="f-sort">{t("sort")}</Label>
            <Select id="f-sort" value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value as Filters["sort"] })}>
              <option value="relevance">{t("sortRelevance")}</option>
              <option value="newest">{t("sortNewest")}</option>
            </Select>
          </div>
          {filterActive ? (
            <div className="sm:col-span-2 lg:col-span-5">
              <Button size="sm" variant="ghost" onClick={() => setFilters({ language: "", topic: "", from: "", to: "", sort: filters.sort })}>
                {t("resetFilters")}
              </Button>
            </div>
          ) : null}
        </form>

        <div className="space-y-8">
          {sections.map((section) => {
            const stories = filtered.filter((s) => s.coverageType === section.key);
            return (
              <section key={section.key} aria-labelledby={`sec-${section.key}`}>
                <h3 id={`sec-${section.key}`} className="label-caps">
                  {section.title} <span className="font-normal normal-case tracking-normal text-subtle">({stories.length})</span>
                </h3>
                <p className="mb-2 mt-0.5 text-xs text-muted">{section.hint}</p>
                {stories.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted">{t("empty")}</p>
                ) : (
                  <Card className={section.key === "unresolved_same_name" ? "divide-y divide-line border-dashed" : "divide-y divide-line"}>
                    {stories.map((s) => (
                      <StoryCard key={s.id} story={s} />
                    ))}
                  </Card>
                )}
              </section>
            );
          })}
        </div>
        <p className="mt-6 text-xs text-muted">{tOverview("summaryHint")}</p>
      </section>
    </div>
  );
}
