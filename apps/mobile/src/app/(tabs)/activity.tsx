import { useRouter } from "expo-router";
import { History, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import type { JobSummary } from "@personbrief/shared/api/v1";
import { JobStatusBadge } from "@/components/research/status";
import { DemoBanner, TabTitle } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/card";
import { Segmented } from "@/components/ui/list";
import { EmptyState, ErrorState, LoadingState, OfflineBanner } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { haptics } from "@/lib/actions";
import { useDates } from "@/lib/i18n";
import { useDeleteJob, useJobs, useMe } from "@/lib/queries";
import { RADIUS, SPACE, TOUCH, useColors } from "@/lib/theme";

type Filter = "all" | "active" | "finished";

/** D. Activity: every research run in this workspace, including ones still running. */
export default function ActivityScreen() {
  const t = useTranslations("Activity");
  const tApp = useTranslations("App.activity");
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const me = useMe();
  const [filter, setFilter] = useState<Filter>("all");
  const jobs = useJobs(filter);
  const remove = useDeleteJob();
  const dates = useDates();
  const items = jobs.data?.pages.flatMap((p) => p.items) ?? [];

  const open = (job: JobSummary) => {
    haptics.select();
    if (job.profileId && (job.status === "completed" || job.status === "partial")) router.push({ pathname: "/profile/[profileId]", params: { profileId: job.profileId } });
    else router.push({ pathname: "/research/[jobId]", params: { jobId: job.id } });
  };

  const confirmDelete = (job: JobSummary) =>
    Alert.alert(t("deleteTitle"), t("deleteBody"), [
      { text: tApp("keep"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: () => remove.mutate(job.id) },
    ]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + SPACE.lg }]}>
      <TabTitle title={t("title")} me={me.data} subtitle={t("subtitle")} />
      <OfflineBanner />
      <DemoBanner me={me.data} />
      <Segmented<Filter>
        label={tApp("filter")}
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: tApp("all") },
          { value: "active", label: tApp("active") },
          { value: "finished", label: tApp("finished") },
        ]}
      />
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={{ paddingBottom: SPACE.xxxl }}
      data={items}
      keyExtractor={(j) => j.id}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={jobs.isRefetching && !jobs.isFetchingNextPage} onRefresh={() => void jobs.refetch()} tintColor={colors.muted} colors={[colors.accent]} />}
      onEndReached={() => {
        if (jobs.hasNextPage && !jobs.isFetchingNextPage) void jobs.fetchNextPage();
      }}
      onEndReachedThreshold={0.4}
      ItemSeparatorComponent={() => (
        <View style={[styles.inset, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Divider inset={SPACE.lg} />
        </View>
      )}
      ListEmptyComponent={
        jobs.isPending ? (
          <LoadingState />
        ) : jobs.isError ? (
          <ErrorState error={jobs.error} onRetry={() => void jobs.refetch()} />
        ) : (
          <EmptyState icon={<History size={24} color={colors.muted} />} title={t("empty")} action={<Button label={t("startResearch")} variant="secondary" onPress={() => router.navigate("/")} />} />
        )
      }
      ListFooterComponent={jobs.isFetchingNextPage ? <ActivityIndicator style={{ marginTop: SPACE.lg }} color={colors.muted} /> : null}
      renderItem={({ item, index }) => {
        const finished = !["queued", "running", "awaiting_identity"].includes(item.status);
        return (
          <View style={[styles.inset, index === 0 ? styles.first : null, index === items.length - 1 ? styles.last : null, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.query.fullName}, ${dates.dateTime(item.createdAt, "dateTime")}`}
              onPress={() => open(item)}
              onLongPress={finished ? () => confirmDelete(item) : undefined}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors["surface-2"] : "transparent" }]}
            >
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {item.query.fullName}
                </Text>
                <Text variant="footnote" tone="muted" numberOfLines={2}>
                  {[t(`kinds.${item.kind}` as never), item.query.company, dates.dateTime(item.createdAt, "dateTime")].filter(Boolean).join(" · ")}
                </Text>
                <View style={styles.badge}>
                  <JobStatusBadge status={item.status} outcome={item.outcome} />
                </View>
              </View>
              {finished ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t("delete")} hitSlop={8} onPress={() => confirmDelete(item)} style={styles.trash}>
                  <Trash2 size={18} color={colors.subtle} />
                </Pressable>
              ) : null}
            </Pressable>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACE.lg, gap: SPACE.lg, paddingBottom: SPACE.lg },
  inset: { marginHorizontal: SPACE.lg, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: "transparent" },
  first: { borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, borderTopWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  last: { borderBottomLeftRadius: RADIUS.lg, borderBottomRightRadius: RADIUS.lg, borderBottomWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, minHeight: TOUCH + 12 },
  flex: { flex: 1, gap: 3 },
  badge: { marginTop: 4 },
  trash: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center", marginRight: -SPACE.md },
});
