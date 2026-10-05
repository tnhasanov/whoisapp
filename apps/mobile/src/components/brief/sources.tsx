import { ChevronRight, LockKeyhole } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import type { ProfileDetail } from "@personbrief/shared/api/v1";
import { displayHost } from "@/lib/format";
import { SPACE, useColors } from "@/lib/theme";
import { Badge } from "../ui/badge";
import { Card, Divider } from "../ui/card";
import { Chip } from "../ui/list";
import { Text } from "../ui/text";
import { Block, EmptyLine, useOpenEvidence } from "./common";

const LIMITED = new Set(["login_required", "paywalled", "blocked", "failed"]);

/** Everything the version is based on: search coverage, access limits and each source. */
export function SourcesSection({ profile }: { profile: ProfileDetail }) {
  const t = useTranslations("Sources");
  const tEvidence = useTranslations("Evidence");
  const tTypes = useTranslations("SourceTypes");
  const colors = useColors();
  const open = useOpenEvidence(profile);
  const [filter, setFilter] = useState<"all" | "used" | "excluded" | "limited">("all");
  const sources = profile.sources.filter((s) =>
    filter === "used" ? s.aboutSubject === "yes" : filter === "excluded" ? s.aboutSubject !== "yes" : filter === "limited" ? LIMITED.has(s.accessStatus) : true,
  );
  const model = profile.snapshot.model;
  return (
    <View style={styles.wrap}>
      <Text variant="footnote" tone="muted">
        {t("hint")}
      </Text>

      <Block title={t("coverage")}>
        <Card padded={false}>
          {profile.snapshot.coverage.map((c, i) => (
            <View key={c.category}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.coverage}>
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{t.has(`categories.${c.category}`) ? t(`categories.${c.category}`) : c.category}</Text>
                  <Text variant="footnote" tone="muted">
                    {t("coverageRow", { queries: c.queries, results: c.results })}
                  </Text>
                  {c.note ? (
                    <Text variant="footnote" tone="ink-2">
                      {c.note}
                    </Text>
                  ) : null}
                </View>
                <Badge
                  tone={c.status === "ok" ? "ok" : c.status === "partial" ? "warn" : c.status === "failed" ? "danger" : "outline"}
                  label={t.has(`coverageStatus.${c.status}`) ? t(`coverageStatus.${c.status}`) : c.status}
                />
              </View>
            </View>
          ))}
        </Card>
      </Block>

      <Block title={t("limitations")}>
        {profile.snapshot.accessLimitations.length === 0 ? (
          <EmptyLine text={t("limitationsEmpty")} />
        ) : (
          <Card style={styles.gap}>
            {profile.snapshot.accessLimitations.map((l, i) => (
              <View key={`${l.domain}-${i}`} style={styles.limit}>
                <LockKeyhole size={16} color={colors.warn} />
                <View style={styles.flex}>
                  <Text variant="subhead">{l.domain}</Text>
                  <Text variant="footnote" tone="ink-2">
                    {tEvidence.has(`access.${l.status}`) ? tEvidence(`access.${l.status}`) : l.status} · {l.note}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}
      </Block>

      <Block title={t("title")}>
        <View style={styles.filters}>
          <Chip label={t("filterAll")} selected={filter === "all"} onPress={() => setFilter("all")} />
          <Chip label={t("filterUsed")} selected={filter === "used"} onPress={() => setFilter("used")} />
          <Chip label={t("filterExcluded")} selected={filter === "excluded"} onPress={() => setFilter("excluded")} />
          <Chip label={t("filterLimited")} selected={filter === "limited"} onPress={() => setFilter("limited")} />
        </View>
        {sources.length === 0 ? (
          <EmptyLine text="—" />
        ) : (
          <Card padded={false}>
            {sources.map((s, i) => (
              <View key={s.id}>
                {i > 0 ? <Divider /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${s.key}: ${s.title ?? displayHost(s.url)}`}
                  onPress={() => open("source", s.id)}
                  style={({ pressed }) => [styles.source, { backgroundColor: pressed ? colors["surface-2"] : "transparent" }]}
                >
                  <Text variant="caption" tone="accent" style={styles.key}>
                    {s.key.replace(/^S/, "")}
                  </Text>
                  <View style={styles.flex}>
                    <Text variant="bodyStrong" numberOfLines={3}>
                      {s.title ?? displayHost(s.url)}
                    </Text>
                    <Text variant="footnote" tone="muted">
                      {s.publisher ?? displayHost(s.url)} · {tTypes.has(s.sourceType) ? tTypes(s.sourceType) : s.sourceType}
                    </Text>
                    <View style={styles.badges}>
                      <Badge tone={s.accessStatus === "read" ? "neutral" : "warn"} label={tEvidence.has(`access.${s.accessStatus}`) ? tEvidence(`access.${s.accessStatus}`) : s.accessStatus} />
                      <Badge tone={s.aboutSubject === "yes" ? "ok" : "outline"} label={t.has(`about.${s.aboutSubject}`) ? t(`about.${s.aboutSubject}`) : s.aboutSubject} />
                    </View>
                  </View>
                  <ChevronRight size={18} color={colors.subtle} />
                </Pressable>
              </View>
            ))}
          </Card>
        )}
      </Block>

      <Text variant="caption" tone="muted">
        {model.provider === "fixture" ? t("modelFixture") : t("model", { model: model.model, prompt: model.promptVersion })} · {t("notesOnly")}
      </Text>
      {profile.snapshot.rejectedCount > 0 ? (
        <Text variant="caption" tone="muted">
          {t("rejected")}: {profile.snapshot.rejectedCount}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.xl },
  gap: { gap: SPACE.md },
  flex: { flex: 1, gap: 2 },
  coverage: { flexDirection: "row", alignItems: "center", gap: SPACE.md, padding: SPACE.lg },
  limit: { flexDirection: "row", gap: SPACE.sm, alignItems: "flex-start" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  source: { flexDirection: "row", alignItems: "center", gap: SPACE.md, padding: SPACE.lg },
  key: { width: 22, textAlign: "center" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
});
