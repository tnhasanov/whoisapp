import { useRouter } from "expo-router";
import { ArrowDownUp, Bookmark, Search as SearchIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import type { ProfileListItem } from "@personbrief/shared/api/v1";
import { DemoBanner, TabTitle } from "@/components/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip, Segmented } from "@/components/ui/list";
import { MenuSheet } from "@/components/ui/menu-sheet";
import { EmptyState, ErrorState, LoadingState, OfflineBanner } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { haptics } from "@/lib/actions";
import { useDates } from "@/lib/i18n";
import { useMe, useProfiles, useTags, type ProfileFilters } from "@/lib/queries";
import { FONTS, RADIUS, SPACE, TOUCH, useColors } from "@/lib/theme";

/** G. Saved work: search, sort, tags and every researched profile — the same library as the website. */
export default function SavedScreen() {
  const t = useTranslations("Library");
  const tApp = useTranslations("App.saved");
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const me = useMe();
  const dates = useDates();
  const [scope, setScope] = useState<ProfileFilters["scope"]>("saved");
  const [sort, setSort] = useState<ProfileFilters["sort"]>("recent");
  const [tagId, setTagId] = useState<string | undefined>();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [sortMenu, setSortMenu] = useState(false);
  const tags = useTags();
  const profiles = useProfiles({ scope, sort, tagId, q: q || undefined });
  const items = profiles.data?.pages.flatMap((p) => p.items) ?? [];

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const filtered = Boolean(q || tagId);
  const sortLabels: Record<ProfileFilters["sort"], string> = { recent: t("sortRecent"), name: t("sortName"), researched: t("sortResearched") };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + SPACE.lg }]}>
      <TabTitle title={tApp("title")} me={me.data} subtitle={t("subtitle")} />
      <OfflineBanner />
      <DemoBanner me={me.data} />
      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors["line-strong"] }]}>
        <SearchIcon size={18} color={colors.muted} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t("search")}
          placeholderTextColor={colors.subtle}
          accessibilityLabel={t("search")}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          style={[styles.searchInput, { color: colors.ink, fontFamily: FONTS.regular }]}
        />
      </View>
      <Segmented
        label={tApp("scope")}
        value={scope}
        onChange={setScope}
        options={[
          { value: "saved", label: t("saved") },
          { value: "all", label: t("all") },
        ]}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label={sortLabels[sort]} icon={<ArrowDownUp size={14} color={colors["ink-2"]} />} onPress={() => setSortMenu(true)} />
        <Chip label={t("allTags")} selected={!tagId} onPress={() => setTagId(undefined)} />
        {(tags.data?.items ?? []).map((tag) => (
          <Chip key={tag.id} label={`#${tag.name}`} selected={tagId === tag.id} onPress={() => setTagId(tagId === tag.id ? undefined : tag.id)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <>
      <FlatList
        style={{ backgroundColor: colors.canvas }}
        contentContainerStyle={{ paddingBottom: SPACE.xxxl, gap: SPACE.md }}
        data={items}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={profiles.isRefetching && !profiles.isFetchingNextPage} onRefresh={() => void Promise.all([profiles.refetch(), tags.refetch()])} tintColor={colors.muted} colors={[colors.accent]} />}
        onEndReached={() => {
          if (profiles.hasNextPage && !profiles.isFetchingNextPage) void profiles.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          profiles.isPending ? (
            <LoadingState />
          ) : profiles.isError ? (
            <ErrorState error={profiles.error} onRetry={() => void profiles.refetch()} />
          ) : filtered ? (
            <EmptyState title={t("noResults")} />
          ) : (
            <EmptyState
              icon={<Bookmark size={24} color={colors.muted} />}
              title={scope === "saved" ? t("emptySaved") : t("empty")}
              body={scope === "saved" ? t("emptySavedBody") : t("emptyBody")}
              action={<Button variant="secondary" label={t("startResearch")} onPress={() => router.navigate("/")} />}
            />
          )
        }
        ListFooterComponent={profiles.isFetchingNextPage ? <ActivityIndicator color={colors.muted} /> : null}
        renderItem={({ item }) => <ProfileCard item={item} onPress={() => router.push({ pathname: "/profile/[profileId]", params: { profileId: item.id } })} dates={dates} />}
      />
      <MenuSheet
        visible={sortMenu}
        title={t("sort")}
        options={(Object.keys(sortLabels) as ProfileFilters["sort"][]).map((key) => ({ key, label: sortLabels[key], onPress: () => setSort(key) }))}
        onClose={() => setSortMenu(false)}
      />
    </>
  );
}

function ProfileCard({ item, onPress, dates }: { item: ProfileListItem; onPress: () => void; dates: ReturnType<typeof useDates> }) {
  const t = useTranslations("Library");
  const colors = useColors();
  const role = [item.headline.role, item.headline.organisation].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[item.displayName, role].filter(Boolean).join(", ")}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? colors["surface-2"] : colors.surface, borderColor: colors.line }]}
    >
      <View style={styles.cardHead}>
        <Text variant="heading" style={styles.flex} numberOfLines={2}>
          {item.displayName}
        </Text>
        {item.savedAt ? <Bookmark size={16} color={colors.accent} fill={colors.accent} /> : null}
      </View>
      {item.nativeName && item.nativeName !== item.displayName ? (
        <Text variant="footnote" tone="muted">
          {item.nativeName}
        </Text>
      ) : null}
      {role ? (
        <Text variant="callout" tone="ink-2" numberOfLines={2}>
          {role}
        </Text>
      ) : null}
      <View style={styles.badges}>
        {item.latestStatus === "partial" ? <Badge tone="warn" label={t("partial")} /> : null}
        {item.tags.map((tag) => (
          <Badge key={tag.id} tone="accent" label={`#${tag.name}`} />
        ))}
      </View>
      <Text variant="caption" tone="muted">
        {[item.lastResearchedAt ? t("lastResearched", { date: dates.dateTime(item.lastResearchedAt) }) : null, t("snapshots", { count: item.snapshotCount })].filter(Boolean).join(" · ")}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACE.lg, gap: SPACE.md, paddingBottom: SPACE.sm },
  search: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 12, minHeight: TOUCH },
  searchInput: { flex: 1, fontSize: 16.5, paddingVertical: 10 },
  chips: { gap: SPACE.sm, paddingVertical: 2 },
  card: { marginHorizontal: SPACE.lg, padding: SPACE.lg, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.sm },
  flex: { flex: 1 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
});
