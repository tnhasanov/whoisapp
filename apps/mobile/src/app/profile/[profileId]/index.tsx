import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Bookmark,
  BookmarkCheck,
  Braces,
  FileText,
  Flag,
  FlaskConical,
  GitCompareArrows,
  History,
  MoreHorizontal,
  NotebookPen,
  RefreshCw,
  Share2,
  Trash2,
} from "lucide-react-native";
import { useRef, useState, type ReactNode } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import type { ProfileDetail } from "@personbrief/shared/api/v1";
import { identityReason } from "@personbrief/shared/format/identity";
import { ConnectionsSection } from "@/components/brief/connections";
import { ContactsSection } from "@/components/brief/contacts";
import { useOpenEvidence } from "@/components/brief/common";
import { NewsSection } from "@/components/brief/news";
import { OverviewSection } from "@/components/brief/overview";
import { SourcesSection } from "@/components/brief/sources";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Card } from "@/components/ui/card";
import { MenuSheet, type MenuOption } from "@/components/ui/menu-sheet";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState, OfflineBanner, useErrorText, useOnline } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { haptics, newIdempotencyKey } from "@/lib/actions";
import { ApiError } from "@/lib/api";
import { shareExport, type ExportFormat } from "@/lib/exports";
import { useDates } from "@/lib/i18n";
import { useDeleteProfile, useProfile, useRefreshProfile, useSetSaved } from "@/lib/queries";
import { RADIUS, SPACE, TOUCH, useColors } from "@/lib/theme";

type Section = "overview" | "contacts" | "connections" | "news" | "sources";
const SECTIONS: Section[] = ["overview", "contacts", "connections", "news", "sources"];

/** E. The person brief. */
export default function BriefScreen() {
  const { profileId, snapshot } = useLocalSearchParams<{ profileId: string; snapshot?: string }>();
  const query = useProfile(profileId, snapshot || null);
  if (query.isPending) return <LoadingState />;
  if (query.isError && !query.data) {
    return (
      <Screen>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  return <Brief profile={query.data!} refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />;
}

function Brief({ profile, refreshing, onRefresh }: { profile: ProfileDetail; refreshing: boolean; onRefresh: () => void }) {
  const t = useTranslations("Profile");
  const tApp = useTranslations("App.brief");
  const tCommon = useTranslations("Common");
  const tMethods = useTranslations("Identity.methods");
  const colors = useColors();
  const router = useRouter();
  const dates = useDates();
  const online = useOnline();
  const errorText = useErrorText();
  const openEvidence = useOpenEvidence(profile);
  const [section, setSection] = useState<Section>("overview");
  const [menu, setMenu] = useState<"share" | "more" | "versions" | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [notice, setNotice] = useState<{ tone: "danger" | "ok" | "info"; text: string } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const saved = useSetSaved(profile.profile.id);
  const refresh = useRefreshProfile(profile.profile.id);
  const remove = useDeleteProfile(profile.profile.id);
  const refreshKey = useRef(newIdempotencyKey());

  const { snapshot } = profile;
  const isLatest = profile.snapshots[0]?.id === snapshot.id;
  const isSaved = Boolean(profile.profile.savedAt);
  const demo = profile.profile.workspace === "demo";
  const headline = snapshot.headline;

  const doExport = async (format: ExportFormat, includeNotes = false) => {
    setExporting(format);
    setNotice(null);
    try {
      const outcome = await shareExport({
        profileId: profile.profile.id,
        snapshotId: isLatest ? null : snapshot.id,
        format,
        includeNotes,
        dialogTitle: format === "pdf" ? t("exportPdf") : t("exportJson"),
      });
      if (outcome.status === "unavailable") setNotice({ tone: "info", text: tApp("shareUnavailable") });
    } catch (error) {
      setNotice({ tone: "danger", text: errorText(error).body });
      if (error instanceof ApiError && error.code === "unauthenticated") return;
    } finally {
      setExporting(null);
    }
  };

  const confirmRefresh = () =>
    Alert.alert(t("refresh"), t("refreshHint"), [
      { text: tCommon("cancel"), style: "cancel" },
      {
        text: t("refresh"),
        onPress: () =>
          refresh.mutate(refreshKey.current, {
            onSuccess: ({ jobId }) => {
              refreshKey.current = newIdempotencyKey();
              router.push({ pathname: "/research/[jobId]", params: { jobId } });
            },
            onError: (error) => setNotice({ tone: "danger", text: errorText(error).body }),
          }),
      },
    ]);

  const confirmDelete = () =>
    Alert.alert(t("deleteTitle"), t("deleteBody"), [
      { text: tCommon("cancel"), style: "cancel" },
      {
        text: t("deleteConfirm"),
        style: "destructive",
        onPress: () =>
          remove.mutate(undefined, {
            onSuccess: () => {
              haptics.success();
              router.back();
            },
            onError: (error) => setNotice({ tone: "danger", text: errorText(error).body }),
          }),
      },
    ]);

  const shareOptions: MenuOption[] = [
    { key: "pdf", label: t("exportPdf"), icon: <FileText size={20} color={colors.accent} />, onPress: () => void doExport("pdf") },
    { key: "json", label: t("exportJson"), icon: <Braces size={20} color={colors.accent} />, onPress: () => void doExport("json") },
    { key: "json-notes", label: t("exportWithNotes"), hint: tApp("notesWarning"), icon: <NotebookPen size={20} color={colors.warn} />, onPress: () => void doExport("json", true) },
  ];
  const moreOptions: MenuOption[] = [
    { key: "notes", label: tApp("notesAndTags"), icon: <NotebookPen size={20} color={colors.accent} />, onPress: () => router.push({ pathname: "/profile/[profileId]/notes", params: { profileId: profile.profile.id } }) },
    {
      key: "changes",
      label: t("whatChanged"),
      disabled: profile.snapshots.length < 2,
      hint: profile.snapshots.length < 2 ? tApp("oneVersion") : null,
      icon: <GitCompareArrows size={20} color={colors.accent} />,
      onPress: () => router.push({ pathname: "/profile/[profileId]/changes", params: { profileId: profile.profile.id } }),
    },
    { key: "versions", label: tApp("versions"), disabled: profile.snapshots.length < 2, icon: <History size={20} color={colors.accent} />, onPress: () => setTimeout(() => setMenu("versions"), 350) },
    {
      key: "report",
      label: t("reportIssue"),
      icon: <Flag size={20} color={colors.accent} />,
      onPress: () => router.push({ pathname: "/profile/[profileId]/report", params: { profileId: profile.profile.id, snapshot: snapshot.id } }),
    },
    { key: "delete", label: t("delete"), destructive: true, icon: <Trash2 size={20} color={colors.danger} />, onPress: confirmDelete },
  ];
  const versionOptions: MenuOption[] = profile.snapshots.map((s, i) => ({
    key: s.id,
    label: `${t("version", { version: s.version })}${i === 0 ? ` (${t("latest")})` : ""}`,
    hint: `${dates.dateTime(s.researchedAt, "dateTime")}${s.status === "partial" ? ` · ${t("partialBadge")}` : ""}`,
    onPress: () => router.setParams({ snapshot: i === 0 ? "" : s.id }),
  }));

  const sectionLabel = (s: Section) => t(`tabs.${s}`);
  const roleLine = [headline.role, headline.organisation].filter(Boolean).join(" · ");
  const roleClaim = headline.roleClaimId ?? headline.organisationClaimId;
  const roleIsCurrent = profile.claims.find((c) => c.id === roleClaim)?.temporal.currency === "stated_current";

  return (
    <>
      <Stack.Screen options={{ title: profile.profile.displayName }} />
      <Screen onRefresh={onRefresh} refreshing={refreshing} scrollRef={scrollRef} contentStyle={styles.content}>
        <OfflineBanner />
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badges}>
            <Text variant="label" tone="muted">
              {t("eyebrow")}
            </Text>
            {demo ? <Badge tone="demo" label={t("demoFictional")} icon={<FlaskConical size={12} color={colors.demo} />} /> : null}
            {snapshot.status === "partial" ? <Badge tone="warn" label={t("partialBadge")} /> : null}
            {isSaved ? <Badge tone="accent" label={t("saved")} /> : null}
          </View>
          <Text variant="display" accessibilityRole="header">
            {profile.profile.displayName}
          </Text>
          {profile.profile.nativeName && profile.profile.nativeName !== profile.profile.displayName ? (
            <Text variant="callout" tone="muted">
              {profile.profile.nativeName}
            </Text>
          ) : null}
          {roleLine ? (
            <Pressable accessibilityRole="button" accessibilityHint={tApp("roleEvidenceHint")} disabled={!roleClaim} onPress={() => roleClaim && openEvidence("claim", roleClaim)}>
              <Text variant="headline" tone="ink-2">
                {roleLine}
              </Text>
              {!roleIsCurrent ? (
                <Text variant="footnote" tone="muted">
                  {t("latestRoleNotCurrent")}
                </Text>
              ) : null}
            </Pressable>
          ) : (
            <Text variant="callout" tone="muted">
              {t("noRole")}
            </Text>
          )}
          <Text variant="footnote" tone="muted">
            {[headline.location ?? t("noLocation"), t("researched", { date: dates.dateTime(snapshot.researchedAt) }), t("versionOf", { version: snapshot.version, total: profile.snapshots.length }), t("sourceCount", { count: profile.sources.length })].join(" · ")}
          </Text>
        </View>

        <View style={styles.actions}>
          <HeaderAction
            label={isSaved ? t("saved") : t("save")}
            icon={isSaved ? <BookmarkCheck size={20} color={colors.accent} /> : <Bookmark size={20} color={colors.accent} />}
            onPress={() => {
              haptics.select();
              saved.mutate(!isSaved, { onError: (error) => setNotice({ tone: "danger", text: errorText(error).body }) });
            }}
            disabled={saved.isPending || !online}
            selected={isSaved}
          />
          <HeaderAction label={t("refresh")} icon={<RefreshCw size={20} color={colors.accent} />} onPress={confirmRefresh} disabled={refresh.isPending || !online} />
          <HeaderAction label={tApp("share")} icon={<Share2 size={20} color={colors.accent} />} onPress={() => setMenu("share")} disabled={exporting !== null || !online} busy={exporting !== null} />
          <HeaderAction label={tCommon("more")} icon={<MoreHorizontal size={20} color={colors.accent} />} onPress={() => setMenu("more")} />
        </View>

        {notice ? <Banner tone={notice.tone} body={notice.text} /> : null}
        {demo ? <Banner tone="demo" body={tApp("demoBrief")} /> : null}
        {snapshot.status === "partial" ? <Banner tone="warn" body={t("partialBanner")} /> : null}
        {!isLatest ? (
          <Banner
            tone="info"
            body={t("olderSnapshot")}
            action={
              <Pressable accessibilityRole="button" onPress={() => router.setParams({ snapshot: "" })}>
                <Text variant="subhead" tone="accent">
                  {t("viewLatest")}
                </Text>
              </Pressable>
            }
          />
        ) : null}

        {profile.tags.length > 0 || profile.notes.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/profile/[profileId]/notes", params: { profileId: profile.profile.id } })}>
            <Card style={styles.notes}>
              <NotebookPen size={18} color={colors.muted} />
              <View style={styles.flex}>
                <Text variant="subhead">{tApp("notesSummary", { notes: profile.notes.length, tags: profile.tags.length })}</Text>
                {profile.tags.length > 0 ? (
                  <Text variant="footnote" tone="muted" numberOfLines={1}>
                    {profile.tags.map((tag) => `#${tag.name}`).join("  ")}
                  </Text>
                ) : null}
              </View>
            </Card>
          </Pressable>
        ) : null}

        {/* Section navigation */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist" accessibilityLabel={t("tabs.label")}>
          {SECTIONS.map((s) => {
            const selected = s === section;
            return (
              <Pressable
                key={s}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => {
                  haptics.select();
                  setSection(s);
                }}
                style={[styles.tab, { backgroundColor: selected ? colors.ink : colors.surface, borderColor: selected ? colors.ink : colors.line }]}
              >
                <Text variant="subhead" style={{ color: selected ? colors.canvas : colors["ink-2"] }}>
                  {sectionLabel(s)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {section === "overview" ? <OverviewSection profile={profile} /> : null}
        {section === "contacts" ? <ContactsSection profile={profile} /> : null}
        {section === "connections" ? <ConnectionsSection profile={profile} /> : null}
        {section === "news" ? <NewsSection profile={profile} /> : null}
        {section === "sources" ? <SourcesSection profile={profile} /> : null}

        <Text variant="caption" tone="subtle" align="center">
          {t("identityMethod", {
            reason: identityReason(snapshot.identity.resolution as Parameters<typeof identityReason>[0], (key, values) =>
              tMethods.has(key) ? tMethods(key, values) : snapshot.identity.resolution.reason,
            ),
          })}
        </Text>
      </Screen>

      <MenuSheet visible={menu === "share"} title={tApp("share")} message={tApp("shareMessage")} options={shareOptions} onClose={() => setMenu(null)} />
      <MenuSheet visible={menu === "more"} options={moreOptions} onClose={() => setMenu(null)} />
      <MenuSheet visible={menu === "versions"} title={tApp("versions")} options={versionOptions} onClose={() => setMenu(null)} />
    </>
  );
}

function HeaderAction({ label, icon, onPress, disabled, selected, busy }: { label: string; icon: ReactNode; onPress: () => void; disabled?: boolean; selected?: boolean; busy?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(selected), busy: Boolean(busy) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: selected ? colors["accent-soft"] : pressed ? colors["surface-2"] : colors.surface, borderColor: colors.line, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      {icon}
      <Text variant="caption" tone="accent" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACE.lg },
  header: { gap: 6 },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  actions: { flexDirection: "row", gap: SPACE.sm },
  action: { flex: 1, minHeight: TOUCH + 12, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 4 },
  notes: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  flex: { flex: 1 },
  tabs: { gap: SPACE.sm, paddingVertical: SPACE.xs },
  tab: { minHeight: 40, paddingHorizontal: 16, borderRadius: RADIUS.pill, borderWidth: StyleSheet.hairlineWidth, justifyContent: "center" },
});
