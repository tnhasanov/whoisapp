import { ArrowLeft, ArrowRight, CircleCheck, GitCompareArrows } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageContainer, PageHeader } from "@/components/app-shell/app-shell";
import { CompareSelector } from "@/components/profile/compare-selector";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { requireViewer } from "@/lib/auth/session";
import { formatPartialDate, formatPartialDateString } from "@/lib/dates/partial-date";
import { getProfileChanges } from "@/lib/data/changes";
import { getDb } from "@/lib/db/client";
import type { DiffClaim, DiffMedia } from "@/lib/diff/snapshot-diff";
import { getDateFormat } from "@/lib/i18n/date-format-server";

export async function generateMetadata() {
  return { title: (await getTranslations("Meta"))("changes") };
}
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ profileId: string }>; searchParams: Promise<{ from?: string; to?: string }> };

function Section({ title, hint, count, children }: { title: string; hint?: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <section>
      <h2 className="font-serif text-[18px] font-semibold text-ink">
        {title} <span className="font-sans text-sm font-normal text-muted">({count})</span>
      </h2>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      <Card className="mt-3">
        <ul className="divide-y divide-line">{children}</ul>
      </Card>
    </section>
  );
}

export default async function ChangesPage({ params, searchParams }: Props) {
  const viewer = await requireViewer();
  const { profileId } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) notFound();
  const changes = await getProfileChanges(getDb(), viewer.userId, profileId, sp.from, sp.to);
  if (!changes) notFound();
  const { profile, snapshots: all } = changes;
  const t = await getTranslations("Changes");
  const locale = await getLocale();
  const fmtDate = await getDateFormat();
  const back = (
    <Link href={`/profiles/${profile.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {profile.displayName}
    </Link>
  );
  if (!changes.diff) {
    return (
      <PageContainer>
        {back}
        <div className="mt-4">
          <PageHeader title={t("title")} />
          <EmptyState className="mt-6" icon={<GitCompareArrows className="h-6 w-6" aria-hidden />} title={t("noOther")} />
        </div>
      </PageContainer>
    );
  }
  const from = changes.from!;
  const to = changes.to!;
  const diff = changes.diff!;
  const dt = (iso: string) => fmtDate(iso, "dateTime");
  const mediaRow = (m: DiffMedia) => (
    <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-ink">{m.headline}</span>
        <span className="text-xs text-muted">{m.outlet}</span>
      </span>
      <span className="text-xs text-muted tabular">{m.publishedAt ? formatPartialDateString(m.publishedAt, locale) : "—"}</span>
    </li>
  );
  const claimLine = (c: DiffClaim) => {
    const period = [formatPartialDate(c.temporal.start, locale), formatPartialDate(c.temporal.end, locale)].filter(Boolean).join(" – ");
    return `${c.displayValue}${period ? ` (${period})` : ""}`;
  };

  return (
    <PageContainer>
      {back}
      <div className="mt-4">
        <PageHeader
          title={t("title")}
          description={t("subtitle", { from: from.version, fromDate: dt(from.researchedAt.toISOString()), to: to.version, toDate: dt(to.researchedAt.toISOString()) })}
        />
      </div>
      <div className="mt-5">
        <CompareSelector profileId={profile.id} snapshots={all.map((s) => ({ id: s.id, version: s.version, label: dt(s.researchedAt.toISOString()) }))} fromId={from.id} toId={to.id} />
      </div>

      {!diff.hasChanges ? (
        <EmptyState className="mt-8" icon={<CircleCheck className="h-6 w-6" aria-hidden />} title={t("noChanges")} />
      ) : (
        <div className="mt-8 space-y-8">
          {diff.headline.changed ? (
            <section>
              <h2 className="font-serif text-[18px] font-semibold text-ink">{t("headline")}</h2>
              <Card className="mt-3 flex flex-wrap items-center gap-3 p-4 text-[14px]">
                <span className="text-muted line-through decoration-line-strong">{[diff.headline.before.role, diff.headline.before.organisation].filter(Boolean).join(" · ") || "—"}</span>
                <ArrowRight className="h-4 w-4 text-muted" aria-hidden />
                <span className="font-medium text-ink">{[diff.headline.after.role, diff.headline.after.organisation].filter(Boolean).join(" · ") || "—"}</span>
              </Card>
            </section>
          ) : null}

          <Section title={t("newlyPublished")} hint={t("newlyPublishedHint")} count={diff.media.newlyPublished.length}>
            {diff.media.newlyPublished.map(mediaRow)}
          </Section>
          <Section title={t("newlyDiscovered")} hint={t("newlyDiscoveredHint")} count={diff.media.newlyDiscovered.length}>
            {diff.media.newlyDiscovered.map(mediaRow)}
          </Section>
          <Section title={t("dateUncertain")} count={diff.media.dateUncertain.length}>
            {diff.media.dateUncertain.map(mediaRow)}
          </Section>

          <Section title={t("claimsUpdated")} count={diff.claims.updated.length}>
            {diff.claims.updated.map((u) => (
              <li key={u.after.id} className="px-4 py-3 text-[13.5px]">
                <p className="font-medium text-ink">{u.after.displayValue}</p>
                <p className="mt-1 text-muted">
                  {t("before")}: {claimLine(u.before)}
                </p>
                <p className="text-ink-2">
                  {t("after")}: {claimLine(u.after)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {u.changes.map((c) => (
                    <Badge key={c} tone="accent">
                      {t(`changeKinds.${c}`)}
                    </Badge>
                  ))}
                </div>
              </li>
            ))}
          </Section>
          <Section title={t("claimsAdded")} count={diff.claims.added.length}>
            {diff.claims.added.map((c) => (
              <li key={c.id} className="px-4 py-3 text-[13.5px] text-ink">
                {claimLine(c)}
              </li>
            ))}
          </Section>
          <Section title={t("conflictsResolved")} count={diff.claims.conflictsResolved.length}>
            {diff.claims.conflictsResolved.map((r) => (
              <li key={r.key} className="px-4 py-3 text-[13.5px]">
                <p className="text-muted">
                  {t("before")}: {r.before.map(claimLine).join(" / ")}
                </p>
                <p className="text-ink">
                  {t("after")}: {r.after.map(claimLine).join(" / ")}
                </p>
              </li>
            ))}
          </Section>
          <Section title={t("conflictsIntroduced")} count={diff.claims.conflictsIntroduced.length}>
            {diff.claims.conflictsIntroduced.map((r) => (
              <li key={r.key} className="px-4 py-3 text-[13.5px] text-ink">
                {r.after.map(claimLine).join(" / ")}
              </li>
            ))}
          </Section>
          <Section title={t("claimsRemoved")} count={diff.claims.removed.length}>
            {diff.claims.removed.map((c) => (
              <li key={c.id} className="px-4 py-3 text-[13.5px] text-muted">
                {claimLine(c)}
              </li>
            ))}
          </Section>
          <Section title={t("noLongerFound")} count={diff.media.noLongerFound.length}>
            {diff.media.noLongerFound.map(mediaRow)}
          </Section>
          <Section title={t("contactsAdded")} count={diff.contacts.added.length}>
            {diff.contacts.added.map((c) => (
              <li key={c.id} className="px-4 py-3 font-mono text-[13px] text-ink">
                {c.value}
              </li>
            ))}
          </Section>
          <Section title={t("contactsRemoved")} count={diff.contacts.removed.length}>
            {diff.contacts.removed.map((c) => (
              <li key={c.id} className="px-4 py-3 font-mono text-[13px] text-muted">
                {c.value}
              </li>
            ))}
          </Section>
          <Section title={t("accountsChanged")} count={diff.accounts.added.length + diff.accounts.removed.length + diff.accounts.promoted.length + diff.accounts.demoted.length}>
            {[...diff.accounts.promoted.map((a) => ({ a, label: t("accountPromoted") })), ...diff.accounts.demoted.map((a) => ({ a, label: t("accountDemoted") })), ...diff.accounts.added.map((a) => ({ a, label: "+" })), ...diff.accounts.removed.map((a) => ({ a, label: "−" }))].map(({ a, label }) => (
              <li key={`${a.id}-${label}`} className="flex items-center justify-between gap-2 px-4 py-3 text-[13px]">
                <span className="font-mono text-ink-2 break-anywhere">{a.url}</span>
                <Badge tone="outline">{label}</Badge>
              </li>
            ))}
          </Section>
          <Section title={t("relationshipsAdded")} count={diff.relationships.added.length}>
            {diff.relationships.added.map((r) => (
              <li key={r.id} className="px-4 py-3 text-[13.5px] text-ink">
                {r.counterpartName} · {r.label}
              </li>
            ))}
          </Section>
          <Section title={t("relationshipsRemoved")} count={diff.relationships.removed.length}>
            {diff.relationships.removed.map((r) => (
              <li key={r.id} className="px-4 py-3 text-[13.5px] text-muted">
                {r.counterpartName} · {r.label}
              </li>
            ))}
          </Section>
          <p className="text-xs text-muted">{t("unchanged", { claims: diff.unchanged.claims, media: diff.unchanged.media })}</p>
        </div>
      )}
    </PageContainer>
  );
}
