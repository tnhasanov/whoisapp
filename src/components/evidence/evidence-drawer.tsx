"use client";

import { ArrowLeft, CheckCircle2, ExternalLink, FileText, Flag } from "lucide-react";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { formatPartialDate, formatPartialDateString } from "@/lib/dates/partial-date";
import type { ProfileView, SourceView } from "@/lib/data/profiles";
import { displayHost, sourceHref } from "@/lib/source-links";
import { cn } from "@/lib/utils";
import { EvidenceStatusBadge } from "./evidence-badge";
import type { EvidenceTarget } from "./evidence-context";

type Props = {
  view: ProfileView;
  target: EvidenceTarget | null;
  canGoBack: boolean;
  onBack: () => void;
  onNavigate: (t: EvidenceTarget) => void;
  onClose: () => void;
};

export function EvidenceDrawer({ view, target, canGoBack, onBack, onNavigate, onClose }: Props) {
  const t = useTranslations("Evidence");
  const tCommon = useTranslations("Common");
  const resolved = target ? resolveTarget(view, target) : null;
  return (
    <Sheet
      open={Boolean(target && resolved)}
      onOpenChange={(open) => !open && onClose()}
      title={resolved?.title ?? t("title")}
      description={resolved?.subtitle}
      closeLabel={tCommon("close")}
      footer={
        <div className="flex items-center justify-between gap-3">
          {canGoBack ? (
            <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {tCommon("back")}
            </button>
          ) : (
            <span />
          )}
          {target?.kind === "claim" ? (
            <Link href={`/profiles/${view.profile.id}/report?claim=${target.id}&snapshot=${view.snapshot.id}`} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
              <Flag className="h-3.5 w-3.5" aria-hidden />
              <ReportLabel />
            </Link>
          ) : null}
        </div>
      }
    >
      {target && resolved ? <DrawerBody view={view} target={target} onNavigate={onNavigate} /> : null}
    </Sheet>
  );
}

function ReportLabel() {
  const t = useTranslations("Profile");
  return <>{t("reportIssue")}</>;
}

function resolveTarget(view: ProfileView, target: EvidenceTarget): { title: string; subtitle?: string } | null {
  switch (target.kind) {
    case "claim": {
      const c = view.claims.find((x) => x.id === target.id);
      return c ? { title: c.displayValue } : null;
    }
    case "source": {
      const s = view.sources.find((x) => x.id === target.id);
      return s ? { title: s.title ?? displayHost(s.url), subtitle: s.publisher ?? displayHost(s.url) } : null;
    }
    case "contact": {
      const c = view.contacts.find((x) => x.id === target.id);
      return c ? { title: c.value, subtitle: c.ownerLabel } : null;
    }
    case "account": {
      const a = view.accounts.find((x) => x.id === target.id);
      return a ? { title: a.handle ?? displayHost(a.url), subtitle: a.url } : null;
    }
    case "relationship": {
      const r = view.relationships.find((x) => x.id === target.id);
      return r ? { title: r.counterpartName, subtitle: r.label } : null;
    }
    case "media": {
      const m = view.stories.flatMap((s) => s.items).find((x) => x.id === target.id);
      return m ? { title: m.headline, subtitle: m.outlet } : null;
    }
    case "organisation": {
      const o = view.organisations.find((x) => x.id === target.id);
      return o ? { title: o.name } : null;
    }
  }
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-1.5 text-[13px]">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-ink-2 break-anywhere">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="label-caps mb-2">{title}</h3>
      {children}
    </section>
  );
}

function langAttr(code: string | null | undefined) {
  return code === "az" || code === "en" || code === "ru" || code === "tr" ? code : undefined;
}

export function SourceCard({ source, excerpt, excerptLanguage, verified, onOpenSource }: { source: SourceView; excerpt?: string | null; excerptLanguage?: string | null; verified?: boolean; onOpenSource?: () => void }) {
  const t = useTranslations("Evidence");
  const tTypes = useTranslations("SourceTypes");
  const format = useFormatter();
  const locale = useLocale();
  const link = sourceHref(source);
  return (
    <article className="rounded-lg border border-line bg-surface-2 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium leading-snug text-ink break-anywhere">
            <span className="mr-1.5 text-[11px] font-semibold text-accent tabular">[{source.sourceKey.replace(/^S/, "")}]</span>
            {source.title ?? displayHost(source.url)}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {source.publisher ?? displayHost(source.url)} · {tTypes(source.sourceType)}
          </p>
        </div>
        {link.external ? (
          <a href={link.href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-accent hover:bg-accent-soft" aria-label={`${t("openSource")}: ${source.title ?? source.url}`}>
            {t("openSource")}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ) : (
          <Link href={link.href} className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-accent hover:bg-accent-soft">
            <FileText className="h-3 w-3" aria-hidden />
            {t("openFixture")}
          </Link>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone="outline">{t(`reliability.${source.reliability}`)}</Badge>
        <Badge tone={source.accessStatus === "read" ? "neutral" : "warn"}>{t(`access.${source.accessStatus}`)}</Badge>
        {source.language !== "unknown" ? <Badge tone="outline">{t(`languages.${source.language}`)}</Badge> : null}
      </div>
      <dl className="mt-2 space-y-0.5 text-xs text-muted">
        <dd>{source.publishedAt ? t("published", { date: formatPartialDateString(source.publishedAt, locale) }) : t("publishedUnknown")}</dd>
        {!source.publishedAt && source.providerReportedDate ? <dd>{t("providerDate", { date: formatPartialDateString(source.providerReportedDate, locale) })}</dd> : null}
        <dd>{t("accessed", { date: format.dateTime(new Date(source.accessedAt), { dateStyle: "medium" }) })} · {t(`method.${source.accessMethod}`)}</dd>
      </dl>
      {excerpt ? (
        <figure className="mt-3">
          <figcaption className="label-caps mb-1">{t("supportingExcerpt")}</figcaption>
          <blockquote lang={langAttr(excerptLanguage)} className="border-l-2 border-accent pl-3 font-serif text-[14.5px] leading-relaxed text-ink">
            “{excerpt}”
          </blockquote>
          {verified ? (
            <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-ok">
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              {t("excerptVerified")}
            </p>
          ) : null}
          {excerptLanguage && excerptLanguage !== "en" && excerptLanguage !== "unknown" ? (
            <p className="mt-1 text-[11.5px] text-muted">{t("originalLanguage", { language: t(`languages.${excerptLanguage}`) })}</p>
          ) : null}
        </figure>
      ) : null}
      {onOpenSource ? (
        <button type="button" onClick={onOpenSource} className="mt-2 text-xs font-medium text-accent hover:underline">
          {t("identityEvidence")}
        </button>
      ) : null}
    </article>
  );
}

function DrawerBody({ view, target, onNavigate }: { view: ProfileView; target: EvidenceTarget; onNavigate: (t: EvidenceTarget) => void }) {
  const t = useTranslations("Evidence");
  const tOverview = useTranslations("Overview");
  const tContacts = useTranslations("Contacts");
  const tAccounts = useTranslations("Accounts");
  const tConn = useTranslations("Connections");
  const tNews = useTranslations("News");
  const tSources = useTranslations("Sources");
  const locale = useLocale();
  const format = useFormatter();
  const sourceById = (id: string | null | undefined) => (id ? view.sources.find((s) => s.id === id) : undefined);

  if (target.kind === "claim") {
    const claim = view.claims.find((c) => c.id === target.id)!;
    const others = claim.conflictGroup ? view.claims.filter((c) => c.conflictGroup === claim.conflictGroup && c.id !== claim.id) : [];
    const temporal = claim.temporal;
    const period = [formatPartialDate(temporal.start, locale), temporal.end ? formatPartialDate(temporal.end, locale) : temporal.currency === "stated_current" ? "…" : ""].filter(Boolean).join(" – ");
    return (
      <div>
        <EvidenceStatusBadge status={claim.evidenceStatus} withHelp />
        <dl className="mt-4 divide-y divide-line border-y border-line">
          {period ? <Row label={t("period")}>{period}</Row> : null}
          <Row label={t("currency")}>
            {temporal.currency === "stated_current"
              ? t("currencyStated", { date: temporal.asOf ? formatPartialDateString(temporal.asOf, locale) : "—" })
              : temporal.currency === "ended"
                ? t("currencyEnded")
                : t("currencyUnknown")}
            {temporal.possiblyOutdated ? <Badge tone="warn" className="ml-2">{tOverview("possiblyOutdated")}</Badge> : null}
          </Row>
          {claim.uncertaintyNote ? <Row label={t("uncertainty")}>{claim.uncertaintyNote}</Row> : null}
          {claim.isTranslated && claim.originalText ? (
            <Row label={tOverview("translated", { language: t(`languages.${claim.language}`) })}>
              <span lang={langAttr(claim.language)} className="font-serif">
                {claim.originalText}
              </span>
            </Row>
          ) : null}
        </dl>
        {others.length > 0 ? (
          <Section title={t("conflictsWith")}>
            <ul className="space-y-1.5">
              {others.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => onNavigate({ kind: "claim", id: o.id })} className="text-left text-[13px] font-medium text-accent hover:underline">
                    {o.displayValue}
                    {o.temporal.start ? ` (${formatPartialDate(o.temporal.start, locale)})` : ""}
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
        <Section title={t("title")}>
          {claim.evidence.length === 0 ? <p className="text-sm text-muted">{t("noEvidence")}</p> : null}
          <div className="space-y-3">
            {claim.evidence.map((e) => {
              const source = sourceById(e.sourceId);
              return source ? (
                <SourceCard key={e.sourceId} source={source} excerpt={e.excerpt} excerptLanguage={e.excerptLanguage} verified={e.verified} onOpenSource={() => onNavigate({ kind: "source", id: source.id })} />
              ) : null;
            })}
          </div>
        </Section>
      </div>
    );
  }

  if (target.kind === "source") {
    const source = view.sources.find((s) => s.id === target.id)!;
    const citing = view.claims.filter((c) => c.evidence.some((e) => e.sourceId === source.id));
    return (
      <div>
        <SourceCard source={source} excerpt={source.excerpt} excerptLanguage={source.language} />
        <dl className="mt-4 divide-y divide-line border-y border-line">
          <Row label={tSources(`about.${source.aboutSubject}`)}>{source.identityEvidence ?? "—"}</Row>
          {source.accessNote ? <Row label={t("accessNote")}>{source.accessNote}</Row> : null}
        </dl>
        {citing.length > 0 ? (
          <Section title={tOverview("otherFacts")}>
            <ul className="space-y-1.5">
              {citing.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => onNavigate({ kind: "claim", id: c.id })} className="text-left text-[13px] text-accent hover:underline">
                    {c.displayValue}
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
    );
  }

  if (target.kind === "contact") {
    const c = view.contacts.find((x) => x.id === target.id)!;
    const source = sourceById(c.sourceId);
    return (
      <div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="neutral">{tContacts(`types.${c.contactType}`)}</Badge>
          <Badge tone={c.isDirect ? "ok" : "outline"}>{c.isDirect ? tContacts("direct") : tContacts("notDirect")}</Badge>
        </div>
        <dl className="mt-4 divide-y divide-line border-y border-line">
          <Row label={t("ownerLabel")}>{c.ownerLabel}</Row>
          <Row label={tContacts("purpose")}>{c.purpose ?? "—"}</Row>
          <Row label={tContacts("context")}>{c.publicationContext}</Row>
          <Row label={t("lastChecked")}>{format.dateTime(new Date(c.lastCheckedAt), { dateStyle: "medium" })}</Row>
        </dl>
        {source ? (
          <Section title={t("title")}>
            <SourceCard source={source} excerpt={c.supportingExcerpt} excerptLanguage={source.language} verified />
          </Section>
        ) : null}
      </div>
    );
  }

  if (target.kind === "account") {
    const a = view.accounts.find((x) => x.id === target.id)!;
    return (
      <div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="neutral">{tAccounts(`platforms.${a.platform}`)}</Badge>
          <Badge tone={a.status === "accepted" ? "ok" : "warn"}>{a.status === "accepted" ? tAccounts("accepted") : tAccounts("possible")}</Badge>
          <Badge tone="outline">{tAccounts(`discovery.${a.discovery}`)}</Badge>
        </div>
        {a.description ? <p className="mt-3 text-sm text-ink-2">{a.description}</p> : null}
        {a.accessNote ? <p className="mt-2 text-xs text-muted">{a.accessNote}</p> : null}
        <Section title={tAccounts("matchEvidence")}>
          <div className="space-y-3">
            {a.matchEvidence.map((m, i) => {
              const source = sourceById(m.sourceId);
              return (
                <div key={i}>
                  <p className="mb-2 text-[13px] text-ink-2">{m.text}</p>
                  {source ? <SourceCard source={source} /> : null}
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    );
  }

  if (target.kind === "relationship") {
    const r = view.relationships.find((x) => x.id === target.id)!;
    const dates = [formatPartialDate(r.start, locale), formatPartialDate(r.end, locale)].filter(Boolean).join(" – ");
    return (
      <div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={r.kind === "documented" ? "accent" : "outline"}>{tConn(`types.${r.relationType}`)}</Badge>
        </div>
        {r.note ? <p className="mt-3 rounded-md bg-warn-soft px-3 py-2 text-[13px] text-ink-2">{r.note}</p> : null}
        <dl className="mt-4 divide-y divide-line border-y border-line">
          {r.counterpartRole ? <Row label={t("role")}>{r.counterpartRole}</Row> : null}
          {r.organisationName ? <Row label={t("organisation")}>{r.organisationName}</Row> : null}
          {r.project ? <Row label={t("project")}>{r.project}</Row> : null}
          {dates ? <Row label={t("period")}>{dates}</Row> : null}
        </dl>
        <Section title={t("title")}>
          <div className="space-y-3">
            {r.evidence.map((e) => {
              const source = sourceById(e.sourceId);
              return source ? <SourceCard key={e.sourceId} source={source} excerpt={e.excerpt} excerptLanguage={source.language} verified={e.verified} /> : null;
            })}
          </div>
        </Section>
      </div>
    );
  }

  if (target.kind === "media") {
    const story = view.stories.find((s) => s.items.some((i) => i.id === target.id))!;
    const m = story.items.find((i) => i.id === target.id)!;
    const source = sourceById(m.sourceId);
    const copies = story.items.filter((i) => i.id !== m.id);
    return (
      <div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="neutral">{tNews(`kinds.${m.kind}`)}</Badge>
          <Badge tone="outline">{tNews(`topics.${m.topic}`)}</Badge>
          <Badge tone={m.coverageType === "direct" ? "accent" : m.coverageType === "organisation" ? "neutral" : "warn"}>
            {m.coverageType === "direct" ? tNews("direct") : m.coverageType === "organisation" ? tNews("organisation") : tNews("unresolved")}
          </Badge>
        </div>
        <dl className="mt-4 divide-y divide-line border-y border-line">
          <Row label={tNews("published")}>
            {m.publishedAt ? formatPartialDateString(m.publishedAt, locale) : t("publishedUnknown")}
            {!m.publishedAt && m.providerReportedDate ? <span className="block text-xs text-muted">{t("providerDate", { date: formatPartialDateString(m.providerReportedDate, locale) })}</span> : null}
          </Row>
          {m.eventDate ? <Row label={tNews("eventDate")}>{formatPartialDate(m.eventDate, locale)}</Row> : null}
          <Row label={t("found")}>{format.dateTime(new Date(m.discoveredAt), { dateStyle: "medium" })}</Row>
          <Row label={t("language")}>{t(`languages.${m.language}`)}</Row>
          {m.involvement ? <Row label={tNews("involvement")}>{m.involvement}</Row> : null}
          {m.matchEvidence ? <Row label={tNews("matchEvidence")}>{m.matchEvidence}</Row> : null}
        </dl>
        <Section title={tOverview("summary")}>
          <p className="text-[14px] leading-relaxed text-ink-2">{m.summary}</p>
          {m.summaryBasis === "snippet_only" ? <p className="mt-1.5 text-xs text-warn">{tNews("summaryBasisSnippet")}</p> : null}
        </Section>
        {m.allegations ? <AllegationsBlock allegations={m.allegations} /> : null}
        {source ? (
          <Section title={t("title")}>
            <SourceCard source={source} />
          </Section>
        ) : null}
        {copies.length > 0 ? (
          <Section title={tNews("alternateLinks")}>
            <p className="mb-2 text-xs text-muted">{tNews("copiesHint")}</p>
            <ul className="space-y-1.5">
              {copies.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => onNavigate({ kind: "media", id: c.id })} className="text-left text-[13px] text-accent hover:underline">
                    {c.outlet}
                    {c.publishedAt ? ` · ${formatPartialDateString(c.publishedAt, locale)}` : ""}
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
    );
  }

  // organisation
  const org = view.organisations.find((o) => o.id === target.id)!;
  const rels = view.relationships.filter((r) => r.organisationId === org.id || r.organisationName === org.name);
  const claimsAbout = view.claims.filter((c) => (c.value.kind === "employment" || c.value.kind === "affiliation") && c.value.organisation === org.name || (c.value.kind === "education" && c.value.institution === org.name));
  return (
    <div>
      <Section title={tOverview("career")}>
        <ul className="space-y-1.5">
          {claimsAbout.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onNavigate({ kind: "claim", id: c.id })} className={cn("text-left text-[13px] text-accent hover:underline")}>
                {c.displayValue}
              </button>
            </li>
          ))}
          {claimsAbout.length === 0 ? <li className="text-sm text-muted">—</li> : null}
        </ul>
      </Section>
      <Section title={tConn("title")}>
        <ul className="space-y-1.5">
          {rels.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onNavigate({ kind: "relationship", id: r.id })} className="text-left text-[13px] text-accent hover:underline">
                {r.counterpartName} · {tConn(`types.${r.relationType}`)}
              </button>
            </li>
          ))}
          {rels.length === 0 ? <li className="text-sm text-muted">—</li> : null}
        </ul>
      </Section>
    </div>
  );
}

export function AllegationsBlock({ allegations }: { allegations: NonNullable<ProfileView["stories"][number]["items"][number]["allegations"]> }) {
  const t = useTranslations("News");
  return (
    <div className="mt-5 space-y-3 rounded-lg border border-line p-3.5">
      <div>
        <h4 className="label-caps mb-1.5">{t("allegations")}</h4>
        <ul className="space-y-1 text-[13px] text-ink-2">
          {allegations.allegations.map((a, i) => (
            <li key={i}>
              {a.text} <span className="text-muted">{t("attributedTo", { source: a.attributedTo })}</span>
            </li>
          ))}
        </ul>
      </div>
      {allegations.responses.length > 0 ? (
        <div>
          <h4 className="label-caps mb-1.5">{t("responses")}</h4>
          <ul className="space-y-1 text-[13px] text-ink-2">
            {allegations.responses.map((a, i) => (
              <li key={i}>
                {a.text} <span className="text-muted">{t("attributedTo", { source: a.attributedTo })}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <h4 className="label-caps mb-1.5">{t("outcomes")}</h4>
        {allegations.outcomes.length > 0 ? (
          <ul className="space-y-1 text-[13px] text-ink-2">
            {allegations.outcomes.map((a, i) => (
              <li key={i}>
                {a.text} <span className="text-muted">{t("attributedTo", { source: a.documentedBy })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">{t("noOutcome")}</p>
        )}
      </div>
    </div>
  );
}
