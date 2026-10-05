import { useLocalSearchParams } from "expo-router";
import { ArrowRight, CircleCheck, GitCompareArrows } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import type { SnapshotDiffDto } from "@personbrief/shared/api/v1";
import { Button } from "@/components/ui/button";
import { Card, Divider } from "@/components/ui/card";
import { MenuSheet } from "@/components/ui/menu-sheet";
import { SectionHeader } from "@/components/ui/list";
import { Screen } from "@/components/ui/screen";
import { EmptyState, ErrorState, LoadingState, OfflineBanner } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useDates } from "@/lib/i18n";
import { useChanges } from "@/lib/queries";
import { SPACE, useColors } from "@/lib/theme";

type DiffClaim = SnapshotDiffDto["claims"]["added"][number];
type DiffMedia = SnapshotDiffDto["media"]["newlyPublished"][number];

/** "What changed?" between two versions. Older coverage found only now is not reported as news. */
export default function ChangesScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const t = useTranslations("Changes");
  const tApp = useTranslations("App.changes");
  const colors = useColors();
  const dates = useDates();
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [picker, setPicker] = useState<"from" | "to" | null>(null);
  const query = useChanges(profileId, from, to);

  if (query.isPending) return <LoadingState />;
  if (!query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data;
  if (!data.diff) {
    return (
      <Screen>
        <EmptyState icon={<GitCompareArrows size={24} color={colors.muted} />} title={t("noOther")} />
      </Screen>
    );
  }
  const diff = data.diff;
  const versionLabel = (id: string | null) => {
    const s = data.snapshots.find((x) => x.id === id);
    return s ? `v${s.version} · ${dates.dateTime(s.researchedAt, "dateTime")}` : "—";
  };
  const claimLine = (c: DiffClaim) => {
    const period = [dates.partial(c.temporal.start), dates.partial(c.temporal.end)].filter(Boolean).join(" – ");
    return `${c.displayValue}${period ? ` (${period})` : ""}`;
  };
  const mediaRow = (m: DiffMedia) => (
    <View key={m.id} style={styles.item}>
      <Text variant="bodyStrong">{m.headline}</Text>
      <Text variant="footnote" tone="muted">
        {m.outlet} · {m.publishedAt ? dates.partialString(m.publishedAt) : "—"}
      </Text>
    </View>
  );
  const textRow = (key: string, text: string, tone: "ink" | "muted" = "ink") => (
    <View key={key} style={styles.item}>
      <Text variant="callout" tone={tone}>
        {text}
      </Text>
    </View>
  );

  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <OfflineBanner />
      <Text variant="title">{t("title")}</Text>
      <Text variant="callout" tone="muted">
        {t("subtitle", { from: diff.from.version, fromDate: dates.dateTime(diff.from.researchedAt, "dateTime"), to: diff.to.version, toDate: dates.dateTime(diff.to.researchedAt, "dateTime") })}
      </Text>
      <View style={styles.pickers}>
        <Button size="sm" variant="secondary" label={`${t("compare")}: ${versionLabel(data.fromSnapshotId)}`} onPress={() => setPicker("from")} style={styles.flex} />
        <Button size="sm" variant="secondary" label={`${t("with")}: ${versionLabel(data.toSnapshotId)}`} onPress={() => setPicker("to")} style={styles.flex} />
      </View>

      {!diff.hasChanges ? (
        <EmptyState icon={<CircleCheck size={24} color={colors.ok} />} title={t("noChanges")} />
      ) : (
        <>
          {diff.headline.changed ? (
            <Group title={t("headline")} count={1}>
              <View style={[styles.item, styles.headline]}>
                <Text variant="callout" tone="muted" style={styles.strike}>
                  {[diff.headline.before.role, diff.headline.before.organisation].filter(Boolean).join(" · ") || "—"}
                </Text>
                <ArrowRight size={16} color={colors.muted} />
                <Text variant="bodyStrong">{[diff.headline.after.role, diff.headline.after.organisation].filter(Boolean).join(" · ") || "—"}</Text>
              </View>
            </Group>
          ) : null}
          <Group title={t("newlyPublished")} hint={t("newlyPublishedHint")} count={diff.media.newlyPublished.length}>
            {diff.media.newlyPublished.map(mediaRow)}
          </Group>
          <Group title={t("newlyDiscovered")} hint={t("newlyDiscoveredHint")} count={diff.media.newlyDiscovered.length}>
            {diff.media.newlyDiscovered.map(mediaRow)}
          </Group>
          <Group title={t("dateUncertain")} count={diff.media.dateUncertain.length}>
            {diff.media.dateUncertain.map(mediaRow)}
          </Group>
          <Group title={t("noLongerFound")} count={diff.media.noLongerFound.length}>
            {diff.media.noLongerFound.map(mediaRow)}
          </Group>
          <Group title={t("claimsAdded")} count={diff.claims.added.length}>
            {diff.claims.added.map((c) => textRow(c.id, claimLine(c)))}
          </Group>
          <Group title={t("claimsRemoved")} count={diff.claims.removed.length}>
            {diff.claims.removed.map((c) => textRow(c.id, claimLine(c), "muted"))}
          </Group>
          <Group title={t("claimsUpdated")} count={diff.claims.updated.length}>
            {diff.claims.updated.map((u) => (
              <View key={u.after.id} style={styles.item}>
                <Text variant="footnote" tone="muted">
                  {t("before")}: {claimLine(u.before)}
                </Text>
                <Text variant="callout">
                  {t("after")}: {claimLine(u.after)}
                </Text>
                <Text variant="caption" tone="accent">
                  {u.changes.map((k) => (t.has(`changeKinds.${k}`) ? t(`changeKinds.${k}`) : k)).join(", ")}
                </Text>
              </View>
            ))}
          </Group>
          <Group title={t("conflictsResolved")} count={diff.claims.conflictsResolved.length}>
            {diff.claims.conflictsResolved.map((c) => textRow(c.key, c.after.map(claimLine).join(" / ")))}
          </Group>
          <Group title={t("conflictsIntroduced")} count={diff.claims.conflictsIntroduced.length}>
            {diff.claims.conflictsIntroduced.map((c) => textRow(c.key, c.after.map(claimLine).join(" / ")))}
          </Group>
          <Group title={t("contactsAdded")} count={diff.contacts.added.length}>
            {diff.contacts.added.map((c) => textRow(c.id, c.value))}
          </Group>
          <Group title={t("contactsRemoved")} count={diff.contacts.removed.length}>
            {diff.contacts.removed.map((c) => textRow(c.id, c.value, "muted"))}
          </Group>
          <Group title={t("accountsChanged")} count={diff.accounts.added.length + diff.accounts.removed.length + diff.accounts.promoted.length + diff.accounts.demoted.length}>
            {[
              ...diff.accounts.added.map((a) => textRow(`a${a.id}`, `+ ${a.url}`)),
              ...diff.accounts.removed.map((a) => textRow(`r${a.id}`, `− ${a.url}`, "muted")),
              ...diff.accounts.promoted.map((a) => textRow(`p${a.id}`, `${t("accountPromoted")}: ${a.url}`)),
              ...diff.accounts.demoted.map((a) => textRow(`d${a.id}`, `${t("accountDemoted")}: ${a.url}`, "muted")),
            ]}
          </Group>
          <Group title={t("relationshipsAdded")} count={diff.relationships.added.length}>
            {diff.relationships.added.map((r) => textRow(r.id, `${r.counterpartName} · ${r.label}`))}
          </Group>
          <Group title={t("relationshipsRemoved")} count={diff.relationships.removed.length}>
            {diff.relationships.removed.map((r) => textRow(r.id, `${r.counterpartName} · ${r.label}`, "muted"))}
          </Group>
          <Text variant="caption" tone="muted">
            {t("unchanged", { claims: diff.unchanged.claims, media: diff.unchanged.media })}
          </Text>
        </>
      )}

      <MenuSheet
        visible={picker !== null}
        title={picker === "from" ? t("compare") : t("with")}
        message={tApp("pickHint")}
        options={data.snapshots.map((s) => ({
          key: s.id,
          label: `v${s.version}`,
          hint: dates.dateTime(s.researchedAt, "dateTime"),
          onPress: () => (picker === "from" ? setFrom(s.id) : setTo(s.id)),
        }))}
        onClose={() => setPicker(null)}
      />
    </Screen>
  );
}

function Group({ title, hint, count, children }: { title: string; hint?: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  const items = (Array.isArray(children) ? children : [children]).flat();
  return (
    <View style={styles.group}>
      <SectionHeader title={`${title} (${count})`} hint={hint} />
      <Card padded={false}>
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 ? <Divider /> : null}
            {child}
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  pickers: { flexDirection: "row", gap: SPACE.sm },
  flex: { flex: 1 },
  group: { gap: SPACE.md },
  item: { padding: SPACE.lg, gap: 3 },
  headline: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: SPACE.sm },
  strike: { textDecorationLine: "line-through" },
});
