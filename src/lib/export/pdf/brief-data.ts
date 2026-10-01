import { formatPartialDate, formatPartialDateString, partialDateSortKey } from "@/lib/dates/partial-date";
import type { ClaimView, ProfileView } from "@/lib/data/profiles";
import { formatDateTime } from "@/lib/i18n/format-date";
import { gapText } from "@/lib/i18n/gaps";
import { identityReason } from "@/lib/i18n/identity";
import type { BriefData, BriefRow } from "./brief-document";

type T = (key: string, values?: Record<string, string | number>) => string;

export type BriefTranslators = {
  pdf: T;
  evidence: T;
  contacts: T;
  accounts: T;
  connections: T;
  news: T;
  gaps: T;
  categories: T;
  identity: T;
};

/** Build print-ready data for one snapshot. Dates are formatted in the owner's locale and time zone. */
export function buildBriefData(
  view: ProfileView,
  options: { locale: string; timeZone: string; appUrl: string; t: BriefTranslators; now: Date },
): BriefData {
  const { locale, timeZone, t } = options;
  const { profile, snapshot } = view;
  const fictional = profile.workspace === "demo";
  const dateTime = (d: Date) => formatDateTime(d, locale, timeZone, "dateTime");
  const date = (d: Date) => formatDateTime(d, locale, timeZone, "date");
  const number = new Map(view.sources.map((s) => [s.id, Number(s.sourceKey.replace(/^S/, ""))]));
  const refsOf = (ids: (string | null | undefined)[]) => [...new Set(ids.map((id) => (id ? number.get(id) : undefined)).filter((n): n is number => Boolean(n)))].sort((a, b) => a - b);
  const claimRefs = (c: ClaimView) => refsOf(c.evidence.map((e) => e.sourceId));
  const claimById = new Map(view.claims.map((c) => [c.id, c]));
  const mediaSource = new Map(view.stories.flatMap((st) => st.items.map((i) => [i.id, i.sourceId] as const)));

  const period = (c: ClaimView) => {
    const start = formatPartialDate(c.temporal.start, locale);
    const end = formatPartialDate(c.temporal.end, locale);
    // Education usually states only a completion year; show it as the UI does.
    if (c.category === "education") return [start, end].filter(Boolean).join(" – ") || t.pdf("dateUnknown");
    if (start && end) return `${start} – ${end}`;
    if (start) return `${start} – ${c.temporal.currency === "stated_current" ? t.pdf("present") : "?"}`;
    if (end) return t.pdf("until", { date: end });
    if (c.temporal.currency === "stated_current" && c.temporal.asOf) {
      return t.pdf(c.temporal.asOfBasis === "accessed" ? "asOfAccessed" : "asOf", { date: formatPartialDateString(c.temporal.asOf, locale) });
    }
    return t.pdf("dateUnknown");
  };
  const flags = (c: ClaimView) => {
    const out = [t.evidence(`status.${c.evidenceStatus}`)];
    if (c.temporal.possiblyOutdated) out.push(t.pdf("outdated"));
    if (c.isTranslated) out.push(c.originalText ? t.pdf("translatedFrom", { original: c.originalText }) : t.pdf("translated"));
    return out;
  };

  const rowsFor = (category: ClaimView["category"]): BriefRow[] => {
    const claims = view.claims.filter((c) => c.category === category);
    const sortAnchor = (c: ClaimView) =>
      c.temporal.currency === "stated_current" && !c.temporal.possiblyOutdated && !c.temporal.end
        ? `9${partialDateSortKey(c.temporal.start)}`
        : c.temporal.end
          ? partialDateSortKey(c.temporal.end)
          : (c.temporal.asOf ?? partialDateSortKey(c.temporal.start));
    return [...claims]
      .sort((a, b) => sortAnchor(b).localeCompare(sortAnchor(a)))
      .map((c) => {
        const v = c.value;
        const title =
          v.kind === "employment" ? (v.title ?? c.displayValue) : v.kind === "affiliation" ? (v.role ?? c.displayValue) : v.kind === "education" ? ([v.qualification, v.field].filter(Boolean).join(", ") || c.displayValue) : c.displayValue;
        const subtitle = v.kind === "employment" || v.kind === "affiliation" ? v.organisation : v.kind === "education" ? v.institution : null;
        return { title, subtitle, period: period(c), refs: claimRefs(c), flags: flags(c) };
      });
  };

  const roleClaim = snapshot.headline.roleClaimId ? claimById.get(snapshot.headline.roleClaimId) : undefined;
  const confirmed = roleClaim ? roleClaim.temporal.currency === "stated_current" && !roleClaim.temporal.possiblyOutdated : false;

  const accepted = view.accounts.filter((a) => a.status === "accepted");
  const possible = view.accounts.filter((a) => a.status === "possible");

  const stories = [...view.stories].sort((a, b) => a.relevanceRank - b.relevanceRank).slice(0, 12);
  // Every source cited anywhere in the brief is listed, even if it was about the organisation only.
  const referenced = new Set<string>([
    ...view.claims.flatMap((c) => c.evidence.map((e) => e.sourceId)),
    ...view.contacts.map((c) => c.sourceId),
    ...view.accounts.flatMap((a) => a.matchEvidence.map((m) => m.sourceId).filter((x): x is string => Boolean(x))),
    ...view.relationships.flatMap((r) => r.evidence.map((e) => e.sourceId)),
    ...stories.flatMap((st) => st.items.map((i) => i.sourceId).filter((x): x is string => Boolean(x))),
  ]);

  return {
    fictional,
    generatedAt: dateTime(options.now),
    labels: Object.fromEntries(
      [
        "title", "fictionalBanner", "private", "partial", "identity", "summary", "inferred", "chronology", "education", "affiliations",
        "contacts", "contactsNone", "notDirect", "accounts", "connections", "connectionsNone", "sharedNote", "media", "mediaNone",
        "developments", "gaps", "questions", "caveats", "caveat1", "caveat2", "caveat3", "caveat4", "references",
      ].map((k) => [k, t.pdf(k)]),
    ),
    pageLabel: (page, total) => t.pdf("page", { page, total }),
    person: {
      name: profile.displayName,
      nativeName: profile.nativeName && profile.nativeName !== profile.displayName ? profile.nativeName : null,
      headline: [snapshot.headline.role, snapshot.headline.organisation].filter(Boolean).join(" · ") || null,
      location: snapshot.headline.location,
      roleNote: roleClaim && !confirmed ? t.evidence("currencyUnknown") : null,
    },
    meta: {
      researched: t.pdf("researched", { date: dateTime(snapshot.researchedAt) }),
      snapshot: t.pdf("snapshot", { version: snapshot.version, total: view.snapshots.length }),
      sources: t.pdf("sources", { count: view.sources.length }),
      partial: snapshot.status === "partial",
      identity: identityReason(snapshot.identity.resolution, t.identity),
    },
    summary: snapshot.overview.summary.map((p) => ({
      text: p.text,
      inferred: p.kind === "inferred",
      refs: refsOf([
        ...p.claimIds.flatMap((id) => claimById.get(id)?.evidence.map((e) => e.sourceId) ?? []),
        ...p.mediaIds.map((id) => mediaSource.get(id) ?? null),
      ]),
    })),
    chronology: rowsFor("employment"),
    education: rowsFor("education"),
    affiliations: rowsFor("affiliation"),
    contacts: view.contacts.map((c) => ({
      type: t.contacts(`types.${c.contactType}`),
      value: c.value,
      owner: c.ownerLabel,
      purpose: c.purpose,
      refs: refsOf([c.sourceId]),
      direct: c.isDirect,
    })),
    accounts: accepted.map((a) => ({
      platform: t.accounts(`platforms.${a.platform}`),
      handle: a.handle ?? a.url,
      url: a.url,
      how: t.accounts(`discovery.${a.discovery}`),
      refs: refsOf(a.matchEvidence.map((m) => m.sourceId)),
    })),
    possibleAccountsNote: possible.length > 0 ? t.pdf("possibleAccounts", { count: possible.length }) : null,
    connections: view.relationships.map((r) => {
      const span = [formatPartialDate(r.start, locale), formatPartialDate(r.end, locale)].filter(Boolean).join(" – ");
      return {
        name: r.counterpartName,
        label: t.connections(`types.${r.relationType}`),
        detail: [r.counterpartRole, r.organisationName, r.project, span].filter(Boolean).join(" · ") || null,
        refs: refsOf(r.evidence.map((e) => e.sourceId)),
        shared: r.kind === "shared_affiliation",
      };
    }),
    developments: snapshot.overview.keyDevelopments.map((k) => ({ date: k.date ? formatPartialDate(k.date, locale) : "—", text: k.text })),
    media: stories.map((story) => {
      const primary = story.items.find((i) => i.isPrimary) ?? story.items[0];
      const meta = [
        t.news(story.coverageType === "direct" ? "direct" : story.coverageType === "organisation" ? "organisation" : "unresolved"),
        story.items.length > 1 ? t.pdf("copies", { count: story.items.length - 1 }) : null,
        primary.summaryBasis === "snippet_only" ? t.pdf("snippetOnly") : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        headline: primary.headline,
        outlet: primary.outlet,
        date: primary.publishedAt ? formatPartialDateString(primary.publishedAt, locale) : t.pdf("publishedUnknown"),
        summary: primary.summary,
        meta,
        refs: refsOf(story.items.map((i) => i.sourceId)),
      };
    }),
    gaps: snapshot.overview.gaps.map((g) => gapText(g, t.gaps, t.categories)),
    questions: snapshot.overview.questions.map((q) => q.question),
    sources: view.sources
      .filter((s) => s.aboutSubject === "yes" || referenced.has(s.id))
      .map((s) => ({
        n: Number(s.sourceKey.replace(/^S/, "")),
        title: s.title ?? s.url,
        publisher: s.publisher ?? "",
        href: s.fixtureKey ? `${options.appUrl.replace(/\/$/, "")}/demo/sources/${encodeURIComponent(s.fixtureKey)}` : s.url,
        displayUrl: s.url,
        date: s.publishedAt ? formatPartialDateString(s.publishedAt, locale) : t.pdf("publishedUnknown"),
        accessed: t.pdf("accessed", { date: date(s.accessedAt) }),
        note: s.fixtureKey ? t.pdf("fictionalSource") : s.accessStatus !== "read" ? t.evidence(`access.${s.accessStatus}`) : null,
      }))
      .sort((a, b) => a.n - b.n),
  };
}
