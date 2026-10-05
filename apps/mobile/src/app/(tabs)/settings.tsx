import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Bell, Check, ChevronRight, Fingerprint, Globe2, LogOut, MonitorSmartphone, Shield } from "lucide-react-native";
import { useState } from "react";
import { Alert, StyleSheet, Switch, View } from "react-native";
import { useTranslations } from "use-intl";
import { MetaResponseSchema } from "@personbrief/shared/api/v1";
import { DEFAULT_TIMEZONE, type Locale, type Workspace } from "@personbrief/shared/domain";
import { TabTitle } from "@/components/workspace";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { ListGroup, Row, SectionHeader, Segmented } from "@/components/ui/list";
import { MenuSheet } from "@/components/ui/menu-sheet";
import { Screen } from "@/components/ui/screen";
import { OfflineBanner, useErrorText } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { request } from "@/lib/api";
import { useAppLock } from "@/lib/app-lock";
import { API_CONFIG, APP_BUILD, APP_VERSION, VARIANT } from "@/lib/config";
import { deviceTimeZone, LOCALE_NAMES, useLocaleState } from "@/lib/i18n";
import { disableNotifications, enableNotifications, notificationsOptedIn, pushUnavailableReason, type EnableResult } from "@/lib/notifications";
import { useDeviceRegistration, useMe, useSetWorkspace, useSettings, useUpdatePreferences } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { SPACE, useColors, useTheme, type ThemePreference } from "@/lib/theme";

const COMMON_ZONES = [
  "Asia/Baku",
  "Europe/Istanbul",
  "Asia/Tbilisi",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Tashkent",
  "Asia/Almaty",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Singapore",
  "Asia/Tokyo",
  "UTC",
];

/** H. Settings: language, theme, time zone, providers (configured or not — never keys), notifications, app lock, sessions. */
export default function SettingsScreen() {
  const t = useTranslations("Settings");
  const tApp = useTranslations("App.settings");
  const tWs = useTranslations("Workspace");
  const colors = useColors();
  const router = useRouter();
  const theme = useTheme();
  const me = useMe();
  const settings = useSettings();
  const meta = useQuery({ queryKey: ["meta"], queryFn: () => request("/meta", { schema: MetaResponseSchema }) });
  const prefs = useUpdatePreferences();
  const workspace = useSetWorkspace();
  const { setDeviceLocale, applyAccount } = useLocaleState();
  const { signOut } = useSession();
  const lock = useAppLock();
  const errorText = useErrorText();
  const [zoneMenu, setZoneMenu] = useState(false);
  const optedIn = useQuery({ queryKey: ["notifications-opt-in"], queryFn: notificationsOptedIn });
  const device = useDeviceRegistration(optedIn.data === true);
  const [pushResult, setPushResult] = useState<EnableResult | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  const account = me.data;
  const locale = account?.preferences.locale ?? "en";
  const timezone = account?.preferences.timezone ?? DEFAULT_TIMEZONE;
  const serverPush = meta.data?.features.pushNotifications ?? false;
  const pushBlocked = pushUnavailableReason(serverPush);
  const zones = [...new Set([deviceTimeZone(), timezone, ...COMMON_ZONES].filter((z): z is string => Boolean(z)))];

  const changeLocale = (next: Locale) => {
    setDeviceLocale(next);
    prefs.mutate({ locale: next }, { onSuccess: (updated) => applyAccount(updated.preferences) });
  };
  const changeZone = (zone: string) => prefs.mutate({ timezone: zone }, { onSuccess: (updated) => applyAccount(updated.preferences) });

  const togglePush = async (on: boolean) => {
    setPushBusy(true);
    setPushResult(null);
    try {
      if (on) setPushResult(await enableNotifications(serverPush, tApp("channelName")));
      else await disableNotifications();
    } catch {
      setPushResult({ ok: false, reason: "server" });
    } finally {
      setPushBusy(false);
      void optedIn.refetch();
      void device.refetch();
    }
  };

  const pushStatus = (() => {
    if (pushBlocked) return tApp(`push.unavailable.${pushBlocked}`);
    if (pushResult && !pushResult.ok) return tApp(`push.failed.${pushResult.reason}`);
    if (!optedIn.data) return tApp("push.off");
    const last = device.data?.device?.lastDelivery;
    if (last?.status === "failed") return tApp("push.lastFailed", { error: last.error ?? "?" });
    return tApp("push.on");
  })();

  const lockStatus = !lock.support
    ? ""
    : !lock.support.available
      ? tApp("lock.noHardware")
      : !lock.support.enrolled
        ? tApp("lock.notEnrolled")
        : lock.enabled
          ? tApp("lock.on")
          : tApp("lock.off");

  const confirmSignOut = () =>
    Alert.alert(tApp("signOutTitle"), tApp("signOutBody"), [
      { text: tApp("cancel"), style: "cancel" },
      { text: tApp("signOut"), style: "destructive", onPress: () => void signOut() },
    ]);

  const owner = settings.data?.owner;
  return (
    <Screen edges={["top"]} onRefresh={() => void Promise.all([me.refetch(), settings.refetch(), meta.refetch()])} refreshing={settings.isRefetching}>
      <TabTitle title={t("title")} me={account} />
      <OfflineBanner />
      {prefs.error || workspace.error ? <Banner tone="danger" body={errorText(prefs.error ?? workspace.error).body} /> : null}

      {/* Account */}
      <SectionHeader title={tApp("account")} />
      <ListGroup>
        <Row title={account?.user.name ?? "—"} subtitle={account?.user.isGuest ? tApp("guestAccount") : account?.user.email} />
        {account?.capabilities.canSwitchWorkspace ? (
          <View style={styles.inner}>
            <Text variant="subhead">{tWs("label")}</Text>
            <Segmented<Workspace>
              label={tWs("label")}
              value={account.workspace}
              onChange={(ws) => workspace.mutate(ws)}
              options={[
                { value: "live", label: tWs("live") },
                { value: "demo", label: `${tWs("demo")} · ${tApp("fictional")}` },
              ]}
            />
            <Text variant="footnote" tone="muted">
              {tApp("workspaceHint")}
            </Text>
          </View>
        ) : null}
      </ListGroup>
      {account?.user.isGuest ? <Banner tone="demo" body={t("guestNote")} /> : null}

      {/* Preferences */}
      <SectionHeader title={t("preferences")} />
      <ListGroup>
        <View style={styles.inner}>
          <Text variant="subhead">{t("language")}</Text>
          <Segmented<Locale> label={t("language")} value={locale} onChange={changeLocale} options={(Object.keys(LOCALE_NAMES) as Locale[]).map((value) => ({ value, label: LOCALE_NAMES[value] }))} />
        </View>
        <View style={styles.inner}>
          <Text variant="subhead">{t("theme")}</Text>
          <Segmented<ThemePreference>
            label={t("theme")}
            value={theme.preference}
            onChange={theme.setPreference}
            options={[
              { value: "system", label: t("themes.system") },
              { value: "light", label: t("themes.light") },
              { value: "dark", label: t("themes.dark") },
            ]}
          />
        </View>
        <Row title={t("timezone")} subtitle={t("timezoneHint")} detail={timezone} left={<Globe2 size={18} color={colors.muted} />} onPress={() => setZoneMenu(true)} />
      </ListGroup>

      {/* Phone features */}
      <SectionHeader title={tApp("phone")} />
      <ListGroup>
        <Row
          title={tApp("push.title")}
          subtitle={pushStatus}
          left={<Bell size={18} color={colors.muted} />}
          chevron={false}
          right={
            <Switch
              accessibilityLabel={tApp("push.title")}
              value={Boolean(optedIn.data) && !pushBlocked}
              disabled={Boolean(pushBlocked) || pushBusy}
              onValueChange={(on) => void togglePush(on)}
              trackColor={{ true: colors.accent, false: colors["line-strong"] }}
            />
          }
        />
        <Row
          title={tApp("lock.title")}
          subtitle={lockStatus}
          left={<Fingerprint size={18} color={colors.muted} />}
          chevron={false}
          right={
            <Switch
              accessibilityLabel={tApp("lock.title")}
              value={lock.enabled}
              disabled={!lock.support?.available || !lock.support?.enrolled}
              onValueChange={(on) => void lock.setEnabled(on, tApp("lock.confirm"))}
              trackColor={{ true: colors.accent, false: colors["line-strong"] }}
            />
          }
        />
      </ListGroup>
      <Text variant="footnote" tone="muted" style={styles.note}>
        {tApp("phoneHint")}
      </Text>

      {/* Providers (owner only) */}
      {owner ? (
        <>
          <SectionHeader title={t("providers")} hint={t("providersHint")} />
          <ListGroup>
            <Row title={t("tavily")} right={<Status ok={owner.providers.search.configured} okLabel={t("configured")} missingLabel={t("missing")} />} />
            <Row title={t("anthropic")} subtitle={`${t("model")}: ${owner.providers.model.model} · ${t("effort")}: ${owner.providers.model.effort}`} right={<Status ok={owner.providers.model.configured} okLabel={t("configured")} missingLabel={t("missing")} />} />
            <Row title={t("worker")} right={<Status ok={settings.data?.worker.online ?? false} okLabel={t("workerOnline")} missingLabel={t("missing")} />} />
          </ListGroup>
          {owner.providers.liveReady ? <Banner tone="ok" body={t("liveReady")} /> : <Banner tone="warn" title={t("liveNotReady")} body={tApp("setupOnServer")} />}

          <SectionHeader title={t("limits")} hint={tApp("limitsHint")} />
          <ListGroup>
            <Row title={t("maxSearchQueries")} detail={String(owner.limits.maxSearchQueries)} />
            <Row title={t("maxExtractPages")} detail={String(owner.limits.maxExtractPages)} />
            <Row title={t("maxModelCalls")} detail={String(owner.limits.maxModelCalls)} />
            <Row title={tApp("maxJobsPerHour")} detail={String(owner.limits.maxJobsPerHour)} />
          </ListGroup>

          <SectionHeader title={t("usage")} hint={t("usageHint")} />
          <ListGroup>
            {owner.usage.byProvider.length === 0 ? <Row title={tApp("noUsage")} /> : null}
            {owner.usage.byProvider.map((u) => (
              <Row key={u.provider} title={u.provider} subtitle={t("usageRow", { requests: u.requests, tokens: u.tokens, credits: u.credits })} detail={`≈ $${u.estimatedCostUsd.toFixed(2)}`} />
            ))}
          </ListGroup>
        </>
      ) : null}

      {/* Session & privacy */}
      <SectionHeader title={tApp("security")} />
      <ListGroup>
        <Row title={tApp("sessions")} subtitle={tApp("sessionsHint")} left={<MonitorSmartphone size={18} color={colors.muted} />} onPress={() => router.push("/sessions")} />
        <Row title={t("dataLink")} left={<Shield size={18} color={colors.muted} />} onPress={() => router.push("/data-use")} />
        <Row title={tApp("signOut")} left={<LogOut size={18} color={colors.danger} />} destructive chevron={false} onPress={confirmSignOut} />
      </ListGroup>

      <Text variant="caption" tone="subtle" align="center">
        PersonBrief {APP_VERSION} ({APP_BUILD}){VARIANT !== "production" ? ` · ${VARIANT}` : ""}
        {API_CONFIG.ok ? ` · ${new URL(API_CONFIG.baseUrl).host}` : ""}
      </Text>

      <MenuSheet
        visible={zoneMenu}
        title={t("timezone")}
        message={t("timezoneHint")}
        options={zones.map((zone) => ({
          key: zone,
          label: zone.replace(/_/g, " "),
          hint: zone === deviceTimeZone() ? tApp("deviceZone") : null,
          icon: zone === timezone ? <Check size={18} color={colors.accent} /> : <ChevronRight size={18} color="transparent" />,
          onPress: () => changeZone(zone),
        }))}
        onClose={() => setZoneMenu(false)}
      />
    </Screen>
  );
}

function Status({ ok, okLabel, missingLabel }: { ok: boolean; okLabel: string; missingLabel: string }) {
  return <Badge tone={ok ? "ok" : "warn"} label={ok ? okLabel : missingLabel} />;
}

const styles = StyleSheet.create({
  inner: { padding: SPACE.lg, gap: SPACE.sm },
  note: { paddingHorizontal: SPACE.xs, marginTop: -SPACE.sm },
});
