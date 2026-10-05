import { AlertTriangle, Info, Lightbulb, MessageCircleQuestion } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import type { Claim, ProfileDetail } from "@personbrief/shared/api/v1";
import { gapText } from "@personbrief/shared/format/gaps";
import { uncertaintyText } from "@personbrief/shared/format/uncertainty";
import { langOf } from "@/lib/format";
import { useDates } from "@/lib/i18n";
import { SPACE, useColors } from "@/lib/theme";
import { Badge } from "../ui/badge";
import { Card, Divider } from "../ui/card";
import { Text } from "../ui/text";
import { Block, CitationChips, EmptyLine, EvidenceStatusBadge, groupForTimeline, useOpenEvidence, usePeriodLabel } from "./common";

/** Overview: sourced summary, career chronology, education, affiliations, developments, gaps and questions. */
export function OverviewSection({ profile }: { profile: ProfileDetail }) {
  const t = useTranslations("Overview");
  const tGaps = useTranslations("Gaps");
  const tCategories = useTranslations("Sources.categories");
  const colors = useColors();
  const dates = useDates();
  const overview = profile.overview;
  const employment = profile.claims.filter((c) => c.category === "employment");
  const education = profile.claims.filter((c) => c.category === "education");
  const affiliations = profile.claims.filter((c) => c.category === "affiliation");
  const other = profile.claims.filter((c) => ["biography", "award", "publication", "location"].includes(c.category));

  return (
    <View style={styles.wrap}>
      <Block title={t("summary")} hint={t("summaryHint")}>
        <Card style={styles.gap}>
          {overview.narrativeAvailable && overview.summary.length > 0 ? (
            overview.summary.map((s, i) => (
              <View key={i} style={styles.sentence}>
                {s.kind === "inferred" ? <Badge tone="violet" label={t("inferred")} icon={<Lightbulb size={12} color={colors.violet} />} /> : null}
                <Text variant="reading" tone={s.kind === "inferred" ? "ink-2" : "ink"} style={s.kind === "inferred" ? styles.italic : null}>
                  {s.text}
                </Text>
                <CitationChips profile={profile} claimIds={s.claimIds} mediaIds={s.mediaIds} />
              </View>
            ))
          ) : (
            <Text variant="callout" tone="muted">
              {t("summaryUnavailable")}
            </Text>
          )}
        </Card>
      </Block>

      <Block title={t("career")}>
        {employment.length === 0 ? (
          <EmptyLine text={t("careerEmpty")} />
        ) : (
          <Card style={styles.timeline}>
            {groupForTimeline(employment).map((group, i, all) => (
              <TimelineEntry key={group[0].id} profile={profile} claims={group} last={i === all.length - 1} />
            ))}
          </Card>
        )}
      </Block>

      <Block title={t("education")}>
        {education.length === 0 ? (
          <EmptyLine text={t("educationEmpty")} />
        ) : (
          <Card padded={false}>
            {groupForTimeline(education).map((group, i) => {
              const c = group[0];
              const v = c.value.kind === "education" ? (c.value as { institution: string; qualification: string | null; field: string | null }) : null;
              return (
                <View key={c.id}>
                  {i > 0 ? <Divider /> : null}
                  <FactRow
                    profile={profile}
                    claim={c}
                    title={[v?.qualification, v?.field].filter(Boolean).join(", ") || c.displayValue}
                    subtitle={v?.institution ?? null}
                    period={[dates.partial(c.temporal.start), dates.partial(c.temporal.end)].filter(Boolean).join(" – ") || "—"}
                    conflicting={group.length > 1 || c.evidenceStatus === "conflicting"}
                    claimIds={group.map((x) => x.id)}
                  />
                </View>
              );
            })}
          </Card>
        )}
      </Block>

      <Block title={t("affiliations")}>
        {affiliations.length === 0 ? (
          <EmptyLine text={t("affiliationsEmpty")} />
        ) : (
          <Card padded={false}>
            {affiliations.map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <Divider /> : null}
                <FactRow
                  profile={profile}
                  claim={c}
                  title={c.value.kind === "affiliation" ? ((c.value as { role: string | null }).role ?? t("memberFallback")) : c.displayValue}
                  subtitle={c.value.kind === "affiliation" ? (c.value as { organisation: string }).organisation : null}
                  period={[dates.partial(c.temporal.start), dates.partial(c.temporal.end)].filter(Boolean).join(" – ") || "—"}
                  conflicting={c.evidenceStatus === "conflicting"}
                  claimIds={[c.id]}
                />
              </View>
            ))}
          </Card>
        )}
      </Block>

      {other.length > 0 ? (
        <Block title={t("otherFacts")}>
          <Card padded={false}>
            {other.map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <Divider /> : null}
                <FactRow
                  profile={profile}
                  claim={c}
                  eyebrow={t.has(`categories.${c.category}`) ? t(`categories.${c.category}`) : c.category}
                  title={
                    c.value.kind === "location"
                      ? t((c.value as { scope: string }).scope === "work" ? "worksIn" : "basedIn", { place: (c.value as { place: string }).place })
                      : c.displayValue
                  }
                  subtitle={null}
                  period={null}
                  conflicting={c.evidenceStatus === "conflicting"}
                  claimIds={[c.id]}
                />
              </View>
            ))}
          </Card>
        </Block>
      ) : null}

      <Block title={t("keyDevelopments")}>
        {overview.keyDevelopments.length === 0 ? (
          <EmptyLine text={t("keyDevelopmentsEmpty")} />
        ) : (
          <Card style={styles.gap}>
            {overview.keyDevelopments.map((k, i) => (
              <View key={i} style={styles.development}>
                <Text variant="caption" tone="muted" style={styles.devDate}>
                  {k.date ? dates.partial(k.date) : "—"}
                </Text>
                <View style={styles.flex}>
                  <Text variant="callout">{k.text}</Text>
                  <CitationChips profile={profile} claimIds={k.claimIds} mediaIds={k.mediaIds} />
                </View>
              </View>
            ))}
          </Card>
        )}
      </Block>

      <Block title={t("gaps")} hint={t("gapsHint")}>
        <Card style={styles.gap}>
          {overview.gaps.length === 0 ? (
            <Text variant="footnote" tone="muted">
              —
            </Text>
          ) : (
            overview.gaps.map((g) => (
              <View key={g.code} style={styles.iconRow}>
                <Info size={16} color={colors.subtle} />
                <Text variant="footnote" tone="ink-2" style={styles.flex}>
                  {gapText(g, (k, v) => tGaps(k, v), (k) => (tCategories.has(k) ? tCategories(k) : k))}
                </Text>
              </View>
            ))
          )}
        </Card>
      </Block>

      {overview.questions.length > 0 ? (
        <Block title={t("questions")} hint={t("questionsHint")}>
          <Card style={styles.gap}>
            {overview.questions.map((q, i) => (
              <View key={i} style={styles.iconRow}>
                <MessageCircleQuestion size={16} color={colors.accent} />
                <View style={styles.flex}>
                  <Text variant="callout">{q.question}</Text>
                  <CitationChips profile={profile} claimIds={q.claimIds} mediaIds={q.mediaIds} />
                </View>
              </View>
            ))}
          </Card>
        </Block>
      ) : null}
    </View>
  );
}

function TimelineEntry({ profile, claims, last }: { profile: ProfileDetail; claims: Claim[]; last: boolean }) {
  const t = useTranslations("Overview");
  const tLanguages = useTranslations("Evidence.languages");
  const tUncertainty = useTranslations("Uncertainty");
  const colors = useColors();
  const dates = useDates();
  const period = usePeriodLabel();
  const open = useOpenEvidence(profile);
  const primary = claims[0];
  const conflicting = claims.length > 1 || primary.evidenceStatus === "conflicting";
  const value = primary.value as { kind: string; title?: string | null; role?: string | null; organisation?: string; institution?: string };
  const title = value.kind === "employment" ? (value.title ?? "—") : value.kind === "affiliation" ? (value.role ?? t("memberFallback")) : primary.displayValue;
  const org = value.organisation ?? value.institution ?? null;
  const current = primary.temporal.currency === "stated_current" && !primary.temporal.possiblyOutdated;
  const uncertainty = uncertaintyText(primary.temporal as Parameters<typeof uncertaintyText>[0], primary.uncertaintyNote, dates.locale, (key, values) => tUncertainty(key, values));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, org, period(primary)].filter(Boolean).join(", ")}
      accessibilityHint={t("openEvidence")}
      onPress={() => open("claim", primary.id)}
      style={styles.entry}
    >
      <View style={styles.rail}>
        <View style={[styles.dot, current ? { backgroundColor: colors.accent, borderColor: colors.accent } : { backgroundColor: colors.surface, borderColor: colors["line-strong"] }]} />
        {!last ? <View style={[styles.line, { backgroundColor: colors.line }]} /> : null}
      </View>
      <View style={[styles.flex, styles.entryBody]}>
        <Text variant="caption" tone="muted">
          {conflicting ? claims.map((c) => period(c)).join("  |  ") : period(primary)}
        </Text>
        <Text variant="headline">{title}</Text>
        {org ? (
          <Text variant="callout" tone="ink-2">
            {org}
          </Text>
        ) : null}
        <View style={styles.badges}>
          {conflicting ? <Badge tone="danger" label={t("conflict")} icon={<AlertTriangle size={12} color={colors.danger} />} /> : <EvidenceStatusBadge status={primary.evidenceStatus} />}
          {primary.temporal.currency === "stated_current" && primary.temporal.asOf ? (
            <Badge tone="outline" label={t(primary.temporal.asOfBasis === "accessed" ? "statedCurrentAccessed" : "statedCurrent", { date: dates.partialString(primary.temporal.asOf) })} />
          ) : null}
          {primary.temporal.possiblyOutdated ? <Badge tone="warn" label={t("possiblyOutdated")} /> : null}
          {primary.isTranslated ? <Badge tone="outline" label={t("translated", { language: tLanguages.has(primary.language) ? tLanguages(primary.language) : primary.language })} /> : null}
        </View>
        {uncertainty && !conflicting ? (
          <Text variant="footnote" tone="muted">
            {uncertainty}
          </Text>
        ) : null}
        <CitationChips profile={profile} claimIds={claims.map((c) => c.id)} />
      </View>
    </Pressable>
  );
}

function FactRow({
  profile,
  claim,
  title,
  subtitle,
  period,
  conflicting,
  claimIds,
  eyebrow,
}: {
  profile: ProfileDetail;
  claim: Claim;
  title: string;
  subtitle: string | null;
  period: string | null;
  conflicting: boolean;
  claimIds: string[];
  eyebrow?: string;
}) {
  const t = useTranslations("Overview");
  const tLanguages = useTranslations("Evidence.languages");
  const open = useOpenEvidence(profile);
  const colors = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[eyebrow, title, subtitle, period].filter(Boolean).join(", ")} onPress={() => open("claim", claim.id)} style={styles.fact}>
      {eyebrow ? (
        <Text variant="label" tone="muted">
          {eyebrow}
        </Text>
      ) : null}
      <Text variant="bodyStrong">{title}</Text>
      {subtitle ? (
        <Text variant="callout" tone="ink-2">
          {subtitle}
        </Text>
      ) : null}
      <View style={styles.badges}>
        {period ? (
          <Text variant="caption" tone="muted">
            {period}
          </Text>
        ) : null}
        {conflicting ? <Badge tone="danger" label={t("conflict")} icon={<AlertTriangle size={12} color={colors.danger} />} /> : <EvidenceStatusBadge status={claim.evidenceStatus} />}
        {claim.isTranslated ? <Badge tone="outline" label={t("translated", { language: tLanguages.has(claim.language) ? tLanguages(claim.language) : claim.language })} /> : null}
      </View>
      {claim.isTranslated && claim.originalText ? (
        <Text variant="footnote" tone="muted">
          {t("original")}:{" "}
          <Text variant="footnote" tone="ink-2" lang={langOf(claim.language)}>
            {claim.originalText}
          </Text>
        </Text>
      ) : null}
      <CitationChips profile={profile} claimIds={claimIds} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.xxl },
  gap: { gap: SPACE.md },
  sentence: { gap: 4 },
  italic: { fontStyle: "italic" },
  timeline: { paddingVertical: SPACE.md },
  entry: { flexDirection: "row", gap: SPACE.md },
  rail: { width: 12, alignItems: "center" },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, marginTop: 4 },
  line: { width: 1.5, flex: 1, marginTop: 2 },
  entryBody: { paddingBottom: SPACE.lg, gap: 3 },
  flex: { flex: 1 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 4 },
  fact: { padding: SPACE.lg, gap: 3 },
  development: { flexDirection: "row", gap: SPACE.md },
  devDate: { width: 72, paddingTop: 2 },
  iconRow: { flexDirection: "row", gap: SPACE.sm, alignItems: "flex-start" },
});
