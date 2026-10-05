import { ChevronRight, Link2, Users } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import type { ProfileDetail, Relationship } from "@personbrief/shared/api/v1";
import { useDates } from "@/lib/i18n";
import { SPACE, useColors } from "@/lib/theme";
import { Badge } from "../ui/badge";
import { Card, Divider } from "../ui/card";
import { Chip } from "../ui/list";
import { Text } from "../ui/text";
import { Block, EmptyLine, useOpenEvidence } from "./common";

/**
 * Connections as a readable list: relationships a source documents, kept
 * apart from shared affiliations (working at the same organisation does not
 * mean two people collaborate or know each other). No family or private
 * relationships are ever inferred.
 */
export function ConnectionsSection({ profile }: { profile: ProfileDetail }) {
  const t = useTranslations("Connections");
  const [filter, setFilter] = useState<"all" | "documented" | "shared_affiliation">("all");
  const documented = profile.relationships.filter((r) => r.kind === "documented");
  const shared = profile.relationships.filter((r) => r.kind !== "documented");
  return (
    <View style={styles.wrap}>
      <Text variant="footnote" tone="muted">
        {t("hint")}
      </Text>
      <View style={styles.filters} accessibilityLabel={t("filters")}>
        <Chip label={t("filterAll")} selected={filter === "all"} onPress={() => setFilter("all")} />
        <Chip label={`${t("documented")} (${documented.length})`} selected={filter === "documented"} onPress={() => setFilter("documented")} />
        <Chip label={`${t("shared")} (${shared.length})`} selected={filter === "shared_affiliation"} onPress={() => setFilter("shared_affiliation")} />
      </View>
      {filter !== "shared_affiliation" ? (
        <Block title={t("documented")}>
          {documented.length === 0 ? <EmptyLine text={t("documentedEmpty")} /> : <RelationshipList profile={profile} items={documented} />}
        </Block>
      ) : null}
      {filter !== "documented" ? (
        <Block title={t("shared")} hint={t("sharedHint")}>
          {shared.length === 0 ? <EmptyLine text={t("sharedEmpty")} /> : <RelationshipList profile={profile} items={shared} />}
        </Block>
      ) : null}
    </View>
  );
}

function RelationshipList({ profile, items }: { profile: ProfileDetail; items: Relationship[] }) {
  const t = useTranslations("Connections");
  const colors = useColors();
  const dates = useDates();
  const open = useOpenEvidence(profile);
  return (
    <Card padded={false}>
      {items.map((r, i) => {
        const type = t.has(`types.${r.relationType}`) ? t(`types.${r.relationType}`) : r.relationType;
        const where = [r.organisationName ? t("at", { organisation: r.organisationName }) : null, r.project ? t("on", { project: r.project }) : null].filter(Boolean).join(" · ");
        const period = [dates.partial(r.start), dates.partial(r.end)].filter(Boolean).join(" – ");
        return (
          <View key={r.id}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={[r.counterpartName, type, where, period].filter(Boolean).join(", ")}
              onPress={() => open("relationship", r.id)}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors["surface-2"] : "transparent" }]}
            >
              <View style={[styles.icon, { backgroundColor: r.kind === "documented" ? colors["accent-soft"] : colors["surface-sunken"] }]}>
                {r.kind === "documented" ? <Link2 size={16} color={colors["accent-ink"]} /> : <Users size={16} color={colors.muted} />}
              </View>
              <View style={styles.flex}>
                <Text variant="bodyStrong">{r.counterpartName}</Text>
                {r.counterpartRole ? (
                  <Text variant="footnote" tone="ink-2">
                    {r.counterpartRole}
                  </Text>
                ) : null}
                <View style={styles.badges}>
                  <Badge tone={r.kind === "documented" ? "accent" : "outline"} label={type} />
                  {period ? (
                    <Text variant="caption" tone="muted">
                      {period}
                    </Text>
                  ) : null}
                </View>
                {where ? (
                  <Text variant="footnote" tone="muted">
                    {where}
                  </Text>
                ) : null}
                {r.note ? (
                  <Text variant="footnote" tone="warn">
                    {r.note}
                  </Text>
                ) : null}
              </View>
              <ChevronRight size={18} color={colors.subtle} />
            </Pressable>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.xl },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, padding: SPACE.lg },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1, gap: 2 },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 },
});
