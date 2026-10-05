import { ChevronRight, Copy as CopiesIcon } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import type { ProfileDetail, Story } from "@personbrief/shared/api/v1";
import { useDates } from "@/lib/i18n";
import { langOf } from "@/lib/format";
import { SPACE, useColors } from "@/lib/theme";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Chip } from "../ui/list";
import { Text } from "../ui/text";
import { Block, EmptyLine, useOpenEvidence } from "./common";

type Coverage = "direct" | "organisation" | "unresolved_same_name";

/**
 * News & media, grouped into stories: syndicated copies count once, and
 * coverage about the person is kept apart from organisation news and from
 * same-name matches that could not be resolved. Dates are the original
 * publication dates (or labelled as unknown), never search-index dates.
 */
export function NewsSection({ profile }: { profile: ProfileDetail }) {
  const t = useTranslations("News");
  const [filter, setFilter] = useState<Coverage | "all">("all");
  const groups: { key: Coverage; title: string; hint: string }[] = [
    { key: "direct", title: t("direct"), hint: t("directHint") },
    { key: "organisation", title: t("organisation"), hint: t("organisationHint") },
    { key: "unresolved_same_name", title: t("unresolved"), hint: t("unresolvedHint") },
  ];
  const count = (key: Coverage) => profile.stories.filter((s) => s.coverageType === key).length;
  return (
    <View style={styles.wrap}>
      <View style={styles.filters}>
        <Chip label={`${t("feed")} (${profile.stories.length})`} selected={filter === "all"} onPress={() => setFilter("all")} />
        {groups.map((g) => (
          <Chip key={g.key} label={`${g.title} (${count(g.key)})`} selected={filter === g.key} onPress={() => setFilter(g.key)} />
        ))}
      </View>
      {groups
        .filter((g) => filter === "all" || filter === g.key)
        .map((g) => {
          const stories = profile.stories.filter((s) => s.coverageType === g.key);
          return (
            <Block key={g.key} title={g.title} hint={g.hint}>
              {stories.length === 0 ? <EmptyLine text={t("empty")} /> : stories.map((s) => <StoryCard key={s.id} profile={profile} story={s} />)}
            </Block>
          );
        })}
    </View>
  );
}

function StoryCard({ profile, story }: { profile: ProfileDetail; story: Story }) {
  const t = useTranslations("News");
  const tEvidence = useTranslations("Evidence");
  const colors = useColors();
  const dates = useDates();
  const open = useOpenEvidence(profile);
  const primary = story.items[0];
  if (!primary) return null;
  const copies = story.items.length - 1;
  const kind = t.has(`kinds.${primary.kind}`) ? t(`kinds.${primary.kind}`) : primary.kind;
  const topic = t.has(`topics.${story.topic}`) ? t(`topics.${story.topic}`) : story.topic;
  return (
    <Card padded={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${primary.headline}, ${primary.outlet}`}
        onPress={() => open("media", primary.id)}
        style={({ pressed }) => [styles.story, { backgroundColor: pressed ? colors["surface-2"] : "transparent" }]}
      >
        <View style={styles.badges}>
          <Badge tone="neutral" label={kind} />
          <Badge tone="outline" label={topic} />
          {primary.allegations ? <Badge tone="warn" label={t("allegations")} /> : null}
        </View>
        <Text variant="headline" lang={langOf(primary.language)}>
          {primary.headline}
        </Text>
        <Text variant="footnote" tone="ink-2">
          {primary.outlet} · {primary.publishedAt ? dates.partialString(primary.publishedAt) : tEvidence("publishedUnknown")}
        </Text>
        <Text variant="callout" tone="ink-2" numberOfLines={4}>
          {primary.summary}
        </Text>
        {primary.summaryBasis === "snippet_only" ? (
          <Text variant="caption" tone="warn">
            {t("summaryBasisSnippet")}
          </Text>
        ) : null}
        <View style={styles.footer}>
          {copies > 0 ? (
            <View style={styles.copies}>
              <CopiesIcon size={13} color={colors.muted} />
              <Text variant="caption" tone="muted">
                {t("copies", { count: copies })}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <ChevronRight size={18} color={colors.subtle} />
        </View>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.xl },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  story: { padding: SPACE.lg, gap: 6 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  copies: { flexDirection: "row", alignItems: "center", gap: 4 },
});
