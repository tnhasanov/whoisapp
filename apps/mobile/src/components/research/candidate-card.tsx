import { useRouter } from "expo-router";
import { Building2, CheckCircle2, ExternalLink, FileText, MapPin, UserRound } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import type { Candidate } from "@personbrief/shared/api/v1";
import { displayHost } from "@/lib/format";
import { openExternal } from "@/lib/actions";
import { SPACE, useColors } from "@/lib/theme";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Row } from "../ui/list";
import { Text } from "../ui/text";

/**
 * One distinct person who shares the searched name. Candidates are never
 * merged by name: each card shows what tells them apart and the sources
 * behind the match, and the owner picks one.
 */
export function CandidateCard({ candidate, onChoose, choosing, disabled }: { candidate: Candidate; onChoose: () => void; choosing: boolean; disabled: boolean }) {
  const t = useTranslations("Identity");
  const colors = useColors();
  const router = useRouter();
  const strengthTone = candidate.matchStrength === "strong" ? "ok" : candidate.matchStrength === "moderate" ? "accent" : "outline";
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors["surface-sunken"] }]}>
          <UserRound size={22} color={colors.muted} />
        </View>
        <View style={styles.flex}>
          <Text variant="heading">{candidate.displayName}</Text>
          {candidate.nativeName && candidate.nativeName !== candidate.displayName ? (
            <Text variant="footnote" tone="muted">
              {candidate.nativeName}
            </Text>
          ) : null}
          <View style={styles.badges}>
            <Badge tone={strengthTone} label={t(`matchStrength.${candidate.matchStrength}`)} />
            {candidate.autoSelected ? <Badge tone="violet" label={t("autoSelected")} /> : null}
          </View>
        </View>
      </View>

      <View style={styles.facts}>
        {candidate.role || candidate.organisation ? (
          <View style={styles.fact}>
            <Building2 size={16} color={colors.muted} />
            <Text variant="callout" tone="ink-2" style={styles.flex}>
              {[candidate.role, candidate.organisation].filter(Boolean).join(" · ")}
            </Text>
          </View>
        ) : null}
        {candidate.location ? (
          <View style={styles.fact}>
            <MapPin size={16} color={colors.muted} />
            <Text variant="callout" tone="ink-2" style={styles.flex}>
              {t("location")}: {candidate.location}
            </Text>
          </View>
        ) : null}
        {candidate.summary ? (
          <Text variant="callout" tone="ink-2">
            {candidate.summary}
          </Text>
        ) : null}
      </View>

      {candidate.distinguishingFacts.length > 0 ? (
        <View style={styles.block}>
          <Text variant="label" tone="muted">
            {t("distinguishing")}
          </Text>
          {candidate.distinguishingFacts.map((fact) => (
            <Text key={fact} variant="footnote" tone="ink-2">
              • {fact}
            </Text>
          ))}
        </View>
      ) : null}

      {candidate.matchReasons.length > 0 ? (
        <View style={styles.block}>
          <Text variant="label" tone="muted">
            {t("whyMatches")}
          </Text>
          {candidate.matchReasons.map((reason) => (
            <View key={`${reason.code}-${reason.text}`} style={styles.fact}>
              <CheckCircle2 size={14} color={reason.code.endsWith("mismatch") ? colors.warn : colors.ok} />
              <Text variant="footnote" tone="ink-2" style={styles.flex}>
                {reason.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {candidate.sources.length > 0 ? (
        <View style={styles.block}>
          <Text variant="label" tone="muted">
            {t("sources", { count: candidate.sources.length })}
          </Text>
          {candidate.sources.map((s) => (
            <Row
              key={s.key}
              left={s.fixtureKey ? <FileText size={16} color={colors.demo} /> : <ExternalLink size={16} color={colors.accent} />}
              title={s.title ?? displayHost(s.url)}
              subtitle={s.publisher ?? displayHost(s.url)}
              chevron={false}
              onPress={() =>
                s.fixtureKey ? router.push({ pathname: "/source/[key]", params: { key: s.fixtureKey } }) : void openExternal(s.url)
              }
            />
          ))}
        </View>
      ) : null}

      <Button label={t("choose")} loadingLabel={t("choosing")} loading={choosing} disabled={disabled} onPress={onChoose} hapticOnPress />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACE.md },
  header: { flexDirection: "row", gap: SPACE.md, alignItems: "flex-start" },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  facts: { gap: 6 },
  fact: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  block: { gap: 6 },
});
