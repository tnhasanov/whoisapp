import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Flag, X } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import type { ProfileDetail } from "@personbrief/shared/api/v1";
import { uncertaintyText } from "@personbrief/shared/format/uncertainty";
import { EvidenceStatusBadge, type EvidenceKind } from "@/components/brief/common";
import { DemoSourceView } from "@/components/brief/demo-source";
import { SourceCard } from "@/components/brief/source-card";
import { Badge } from "@/components/ui/badge";
import { Divider } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { haptics } from "@/lib/actions";
import { displayHost, langOf } from "@/lib/format";
import { useDates } from "@/lib/i18n";
import { useCachedProfile } from "@/lib/queries";
import { SPACE, TOUCH, useColors } from "@/lib/theme";

type Target = { kind: EvidenceKind | "fixture"; id: string };

/**
 * F. Evidence, in a native sheet: the source, publisher, dates, the short
 * supporting excerpt, what could be accessed and the original link.
 * Conflicting versions of a fact stay visible side by side. Moving between
 * related items keeps a back history inside the sheet.
 */
export default function EvidenceSheet() {
  const params = useLocalSearchParams<{ profileId: string; snapshot?: string; kind: EvidenceKind; id: string }>();
  const query = useCachedProfile(params.profileId, params.snapshot || null);
  const [history, setHistory] = useState<Target[]>([{ kind: params.kind, id: params.id }]);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const tCommon = useTranslations("Common");
  const tProfile = useTranslations("Profile");
  const current = history[history.length - 1];
  const navigate = (next: Target) => {
    haptics.select();
    setHistory((h) => [...h, next]);
  };

  if (query.isPending) return <LoadingState />;
  if (!query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const profile = query.data;

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.toolbar, { borderBottomColor: colors.line }]}>
        {history.length > 1 ? (
          <Pressable accessibilityRole="button" accessibilityLabel={tCommon("back")} onPress={() => setHistory((h) => h.slice(0, -1))} style={styles.toolButton} hitSlop={8}>
            <ArrowLeft size={20} color={colors.accent} />
          </Pressable>
        ) : (
          <View style={styles.toolButton} />
        )}
        <Text variant="headline" align="center" style={styles.flex} numberOfLines={1} accessibilityRole="header">
          {current.kind === "fixture" ? tProfile("demoFictional") : titleFor(profile, current, tCommon("unknown"))}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={tCommon("close")} onPress={() => router.back()} style={styles.toolButton} hitSlop={8}>
          <X size={20} color={colors.muted} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.xxl }]}>
        {current.kind === "fixture" ? (
          <DemoSourceView fixtureKey={current.id} />
        ) : (
          <EvidenceBody profile={profile} target={current} navigate={navigate} />
        )}
        {current.kind === "claim" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/profile/[profileId]/report", params: { profileId: profile.profile.id, snapshot: profile.snapshot.id, claim: current.id } })}
            style={styles.report}
          >
            <Flag size={14} color={colors.muted} />
            <Text variant="footnote" tone="muted">
              {tProfile("reportIssue")}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function titleFor(profile: ProfileDetail, target: Target, fallback: string): string {
  switch (target.kind) {
    case "claim":
      return profile.claims.find((c) => c.id === target.id)?.displayValue ?? fallback;
    case "source": {
      const s = profile.sources.find((x) => x.id === target.id);
      return s ? (s.title ?? displayHost(s.url)) : fallback;
    }
    case "contact":
      return profile.contacts.find((c) => c.id === target.id)?.value ?? fallback;
    case "account": {
      const a = profile.accounts.find((x) => x.id === target.id);
      return a ? (a.handle ?? displayHost(a.url)) : fallback;
    }
    case "relationship":
      return profile.relationships.find((r) => r.id === target.id)?.counterpartName ?? fallback;
    case "media":
      return profile.stories.flatMap((s) => s.items).find((i) => i.id === target.id)?.outlet ?? fallback;
    default:
      return fallback;
  }
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text variant="caption" tone="muted" style={styles.rowLabel}>
        {label}
      </Text>
      <View style={styles.flex}>{typeof children === "string" ? <Text variant="footnote">{children}</Text> : children}</View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label" tone="muted" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function EvidenceBody({ profile, target, navigate }: { profile: ProfileDetail; target: Target; navigate: (t: Target) => void }) {
  const t = useTranslations("Evidence");
  const tOverview = useTranslations("Overview");
  const tContacts = useTranslations("Contacts");
  const tAccounts = useTranslations("Accounts");
  const tConn = useTranslations("Connections");
  const tNews = useTranslations("News");
  const tSources = useTranslations("Sources");
  const tUncertainty = useTranslations("Uncertainty");
  const tStatusHelp = useTranslations("Evidence.statusHelp");
  const colors = useColors();
  const dates = useDates();
  const sourceById = (id: string | null | undefined) => (id ? profile.sources.find((s) => s.id === id) : undefined);
  const openFixture = (key: string) => navigate({ kind: "fixture", id: key });
  const notFound = <Text variant="callout" tone="muted">{t("noEvidence")}</Text>;

  if (target.kind === "claim") {
    const claim = profile.claims.find((c) => c.id === target.id);
    if (!claim) return notFound;
    const others = claim.conflictGroup ? profile.claims.filter((c) => c.conflictGroup === claim.conflictGroup && c.id !== claim.id) : [];
    const tp = claim.temporal;
    const uncertainty = uncertaintyText(tp as Parameters<typeof uncertaintyText>[0], claim.uncertaintyNote, dates.locale, (key, values) => tUncertainty(key, values));
    const period = [dates.partial(tp.start), tp.end ? dates.partial(tp.end) : tp.currency === "stated_current" ? "…" : ""].filter(Boolean).join(" – ");
    return (
      <View style={styles.body}>
        <Text variant="heading">{claim.displayValue}</Text>
        <View style={styles.badges}>
          <EvidenceStatusBadge status={claim.evidenceStatus} />
        </View>
        {tStatusHelp.has(claim.evidenceStatus) ? (
          <Text variant="footnote" tone="muted">
            {tStatusHelp(claim.evidenceStatus)}
          </Text>
        ) : null}
        <View style={[styles.table, { borderColor: colors.line }]}>
          {period ? <Row label={t("period")}>{period}</Row> : null}
          <Row label={t("currency")}>
            <Text variant="footnote">
              {tp.currency === "stated_current"
                ? t(tp.asOfBasis === "accessed" ? "currencyStatedAccessed" : "currencyStated", { date: tp.asOf ? dates.partialString(tp.asOf) : "—" })
                : tp.currency === "ended"
                  ? t("currencyEnded")
                  : t("currencyUnknown")}
            </Text>
            {tp.possiblyOutdated ? <Badge tone="warn" label={tOverview("possiblyOutdated")} /> : null}
          </Row>
          {uncertainty ? <Row label={t("uncertainty")}>{uncertainty}</Row> : null}
          {claim.isTranslated && claim.originalText ? (
            <Row label={tOverview("translated", { language: t.has(`languages.${claim.language}`) ? t(`languages.${claim.language}`) : claim.language })}>
              <Text variant="footnote" lang={langOf(claim.language)}>
                {claim.originalText}
              </Text>
            </Row>
          ) : null}
        </View>
        {others.length > 0 ? (
          <Section title={t("conflictsWith")}>
            {others.map((o) => (
              <Pressable key={o.id} accessibilityRole="button" onPress={() => navigate({ kind: "claim", id: o.id })} style={styles.linkRow}>
                <Text variant="callout" tone="accent">
                  {o.displayValue}
                  {o.temporal.start ? ` (${dates.partial(o.temporal.start)})` : ""}
                </Text>
              </Pressable>
            ))}
          </Section>
        ) : null}
        <Section title={t("title")}>
          {claim.evidence.length === 0 ? notFound : null}
          {claim.evidence.map((e) => {
            const source = sourceById(e.sourceId);
            return source ? (
              <View key={e.sourceId} style={styles.gap}>
                {e.stance === "contradicts" ? <Badge tone="danger" label={tOverview("conflict")} /> : null}
                <SourceCard
                  source={source}
                  excerpt={e.excerpt}
                  excerptLanguage={e.excerptLanguage}
                  verified={e.verified}
                  onOpenFixture={openFixture}
                  onOpenSource={() => navigate({ kind: "source", id: source.id })}
                />
              </View>
            ) : null;
          })}
        </Section>
      </View>
    );
  }

  if (target.kind === "source") {
    const source = sourceById(target.id);
    if (!source) return notFound;
    const citing = profile.claims.filter((c) => c.evidence.some((e) => e.sourceId === source.id));
    return (
      <View style={styles.body}>
        <SourceCard source={source} excerpt={source.excerpt} excerptLanguage={source.language} onOpenFixture={openFixture} />
        <View style={[styles.table, { borderColor: colors.line }]}>
          <Row label={tSources.has(`about.${source.aboutSubject}`) ? tSources(`about.${source.aboutSubject}`) : source.aboutSubject}>{source.identityEvidence ?? "—"}</Row>
          {source.accessNote ? <Row label={t("accessNote")}>{source.accessNote}</Row> : null}
        </View>
        {citing.length > 0 ? (
          <Section title={tOverview("otherFacts")}>
            {citing.map((c) => (
              <Pressable key={c.id} accessibilityRole="button" onPress={() => navigate({ kind: "claim", id: c.id })} style={styles.linkRow}>
                <Text variant="callout" tone="accent">
                  {c.displayValue}
                </Text>
              </Pressable>
            ))}
          </Section>
        ) : null}
      </View>
    );
  }

  if (target.kind === "contact") {
    const c = profile.contacts.find((x) => x.id === target.id);
    if (!c) return notFound;
    const source = sourceById(c.sourceId);
    return (
      <View style={styles.body}>
        <Text variant="heading" selectable>
          {c.value}
        </Text>
        <View style={styles.badges}>
          <Badge tone="neutral" label={tContacts.has(`types.${c.contactType}`) ? tContacts(`types.${c.contactType}`) : c.contactType} />
          <Badge tone={c.isDirect ? "ok" : "outline"} label={c.isDirect ? tContacts("direct") : tContacts("notDirect")} />
        </View>
        <View style={[styles.table, { borderColor: colors.line }]}>
          <Row label={t("ownerLabel")}>{c.ownerLabel}</Row>
          <Row label={tContacts("purpose")}>{c.purpose ?? "—"}</Row>
          <Row label={tContacts("context")}>{c.publicationContext}</Row>
          <Row label={t("lastChecked")}>{dates.dateTime(c.lastCheckedAt)}</Row>
        </View>
        {source ? (
          <Section title={t("title")}>
            <SourceCard source={source} excerpt={c.supportingExcerpt} excerptLanguage={source.language} verified onOpenFixture={openFixture} />
          </Section>
        ) : null}
      </View>
    );
  }

  if (target.kind === "account") {
    const a = profile.accounts.find((x) => x.id === target.id);
    if (!a) return notFound;
    return (
      <View style={styles.body}>
        <Text variant="heading">{a.handle ?? displayHost(a.url)}</Text>
        <View style={styles.badges}>
          <Badge tone="neutral" label={tAccounts.has(`platforms.${a.platform}`) ? tAccounts(`platforms.${a.platform}`) : a.platform} />
          <Badge tone={a.status === "accepted" ? "ok" : "warn"} label={a.status === "accepted" ? tAccounts("accepted") : tAccounts("possible")} />
          <Badge tone="outline" label={tAccounts.has(`discovery.${a.discovery}`) ? tAccounts(`discovery.${a.discovery}`) : a.discovery} />
        </View>
        <Text variant="caption" tone="muted" selectable>
          {a.url}
        </Text>
        {a.description ? <Text variant="callout">{a.description}</Text> : null}
        {a.accessNote ? (
          <Text variant="footnote" tone="muted">
            {a.accessNote}
          </Text>
        ) : null}
        <Section title={tAccounts("matchEvidence")}>
          {a.matchEvidence.map((m, i) => {
            const source = sourceById(m.sourceId);
            return (
              <View key={i} style={styles.gap}>
                <Text variant="footnote">{m.text}</Text>
                {source ? <SourceCard source={source} onOpenFixture={openFixture} /> : null}
              </View>
            );
          })}
        </Section>
      </View>
    );
  }

  if (target.kind === "relationship") {
    const r = profile.relationships.find((x) => x.id === target.id);
    if (!r) return notFound;
    const period = [dates.partial(r.start), dates.partial(r.end)].filter(Boolean).join(" – ");
    return (
      <View style={styles.body}>
        <Text variant="heading">{r.counterpartName}</Text>
        <View style={styles.badges}>
          <Badge tone={r.kind === "documented" ? "accent" : "outline"} label={tConn.has(`types.${r.relationType}`) ? tConn(`types.${r.relationType}`) : r.relationType} />
        </View>
        {r.kind !== "documented" ? (
          <Text variant="footnote" tone="muted">
            {tConn("sharedHint")}
          </Text>
        ) : null}
        {r.note ? (
          <View style={[styles.note, { backgroundColor: colors["warn-soft"] }]}>
            <Text variant="footnote">{r.note}</Text>
          </View>
        ) : null}
        <View style={[styles.table, { borderColor: colors.line }]}>
          {r.counterpartRole ? <Row label={t("role")}>{r.counterpartRole}</Row> : null}
          {r.organisationName ? <Row label={t("organisation")}>{r.organisationName}</Row> : null}
          {r.project ? <Row label={t("project")}>{r.project}</Row> : null}
          {period ? <Row label={t("period")}>{period}</Row> : null}
        </View>
        <Section title={t("title")}>
          {r.evidence.map((e) => {
            const source = sourceById(e.sourceId);
            return source ? <SourceCard key={e.sourceId} source={source} excerpt={e.excerpt} excerptLanguage={source.language} verified={e.verified} onOpenFixture={openFixture} /> : null;
          })}
        </Section>
      </View>
    );
  }

  // media
  const story = profile.stories.find((s) => s.items.some((i) => i.id === target.id));
  const m = story?.items.find((i) => i.id === target.id);
  if (!story || !m) return notFound;
  const source = sourceById(m.sourceId);
  const copies = story.items.filter((i) => i.id !== m.id);
  return (
    <View style={styles.body}>
      <Text variant="heading" lang={langOf(m.language)}>
        {m.headline}
      </Text>
      <View style={styles.badges}>
        <Badge tone="neutral" label={tNews.has(`kinds.${m.kind}`) ? tNews(`kinds.${m.kind}`) : m.kind} />
        <Badge tone="outline" label={tNews.has(`topics.${m.topic}`) ? tNews(`topics.${m.topic}`) : m.topic} />
        <Badge
          tone={m.coverageType === "direct" ? "accent" : m.coverageType === "organisation" ? "neutral" : "warn"}
          label={m.coverageType === "direct" ? tNews("direct") : m.coverageType === "organisation" ? tNews("organisation") : tNews("unresolved")}
        />
      </View>
      <View style={[styles.table, { borderColor: colors.line }]}>
        <Row label={tNews("published")}>
          <Text variant="footnote">{m.publishedAt ? dates.partialString(m.publishedAt) : t("publishedUnknown")}</Text>
          {!m.publishedAt && m.providerReportedDate ? (
            <Text variant="caption" tone="muted">
              {t("providerDate", { date: dates.partialString(m.providerReportedDate) })}
            </Text>
          ) : null}
        </Row>
        {m.eventDate ? <Row label={tNews("eventDate")}>{dates.partial(m.eventDate)}</Row> : null}
        <Row label={t("found")}>{dates.dateTime(m.discoveredAt)}</Row>
        <Row label={t("language")}>{t.has(`languages.${m.language}`) ? t(`languages.${m.language}`) : m.language}</Row>
        {m.involvement ? <Row label={tNews("involvement")}>{m.involvement}</Row> : null}
        {m.matchEvidence ? <Row label={tNews("matchEvidence")}>{m.matchEvidence}</Row> : null}
      </View>
      <Section title={tOverview("summary")}>
        <Text variant="callout">{m.summary}</Text>
        {m.summaryBasis === "snippet_only" ? (
          <Text variant="caption" tone="warn">
            {tNews("summaryBasisSnippet")}
          </Text>
        ) : null}
      </Section>
      {m.allegations ? (
        <Section title={tNews("allegations")}>
          {m.allegations.allegations.map((a, i) => (
            <Text key={`a${i}`} variant="footnote">
              {a.text} <Text variant="footnote" tone="muted">{tNews("attributedTo", { source: a.attributedTo })}</Text>
            </Text>
          ))}
          <Text variant="label" tone="muted">
            {tNews("responses")}
          </Text>
          {m.allegations.responses.length === 0 ? <Text variant="footnote" tone="muted">—</Text> : null}
          {m.allegations.responses.map((a, i) => (
            <Text key={`r${i}`} variant="footnote">
              {a.text} <Text variant="footnote" tone="muted">{tNews("attributedTo", { source: a.attributedTo })}</Text>
            </Text>
          ))}
          <Text variant="label" tone="muted">
            {tNews("outcomes")}
          </Text>
          {m.allegations.outcomes.length === 0 ? (
            <Text variant="footnote" tone="muted">
              {tNews("noOutcome")}
            </Text>
          ) : null}
          {m.allegations.outcomes.map((a, i) => (
            <Text key={`o${i}`} variant="footnote">
              {a.text} <Text variant="footnote" tone="muted">{tNews("attributedTo", { source: a.documentedBy })}</Text>
            </Text>
          ))}
        </Section>
      ) : null}
      {source ? (
        <Section title={t("title")}>
          <SourceCard source={source} onOpenFixture={openFixture} />
        </Section>
      ) : null}
      {copies.length > 0 ? (
        <Section title={tNews("alternateLinks")}>
          <Text variant="footnote" tone="muted">
            {tNews("copiesHint")}
          </Text>
          {copies.map((c, i) => (
            <View key={c.id}>
              {i > 0 ? <Divider /> : null}
              <Pressable accessibilityRole="button" onPress={() => navigate({ kind: "media", id: c.id })} style={styles.linkRow}>
                <Text variant="callout" tone="accent">
                  {c.outlet}
                  {c.publishedAt ? ` · ${dates.partialString(c.publishedAt)}` : ""}
                </Text>
              </Pressable>
            </View>
          ))}
        </Section>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.sm, paddingTop: SPACE.lg, paddingBottom: SPACE.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  toolButton: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  content: { padding: SPACE.lg, gap: SPACE.lg },
  body: { gap: SPACE.md },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  table: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: SPACE.xs },
  row: { flexDirection: "row", gap: SPACE.md, paddingVertical: 8 },
  rowLabel: { width: 112, paddingTop: 1 },
  section: { gap: SPACE.sm, marginTop: SPACE.sm },
  gap: { gap: SPACE.sm },
  linkRow: { minHeight: 40, justifyContent: "center" },
  note: { borderRadius: 8, padding: SPACE.md },
  report: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 40 },
});
