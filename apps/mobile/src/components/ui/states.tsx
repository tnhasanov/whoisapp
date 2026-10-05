import { onlineManager } from "@tanstack/react-query";
import { CloudOff, SearchX, ServerCrash } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { ApiError } from "@/lib/api";
import { SPACE, useColors, useTheme } from "@/lib/theme";
import { Banner } from "./banner";
import { Button } from "./button";
import { Text } from "./text";

/** Whether the device currently has a connection (follows expo-network through React Query). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  return online;
}

export function OfflineBanner() {
  const online = useOnline();
  const t = useTranslations("App.offline");
  if (online) return null;
  return <Banner tone="offline" title={t("title")} body={t("body")} />;
}

export function LoadingState({ label }: { label?: string }) {
  const colors = useColors();
  const t = useTranslations("Common");
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label ?? t("loading")}>
      <ActivityIndicator color={colors.muted} />
      <Text variant="footnote" tone="muted">
        {label ?? t("loading")}
      </Text>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string | null; action?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors["surface-sunken"] }]}>{icon ?? <SearchX size={24} color={colors.muted} />}</View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="callout" tone="muted" align="center">
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

/** Localised message for an API failure (offline, timeout, session, not found, server…). */
export function useErrorText() {
  const t = useTranslations("App.errors");
  const tErrors = useTranslations("Errors");
  return (error: unknown): { title: string; body: string } => {
    if (error instanceof ApiError) {
      if (error.kind === "network") return { title: t("offlineTitle"), body: t("offlineBody") };
      if (error.kind === "timeout") return { title: t("timeoutTitle"), body: t("timeoutBody") };
      if (error.kind === "incompatible") return { title: t("incompatibleTitle"), body: t("incompatibleBody") };
      if (error.kind === "config") return { title: t("configTitle"), body: t("configBody") };
      if (error.code === "not_found") return { title: t("notFoundTitle"), body: t("notFoundBody") };
      if (error.code === "unauthenticated") return { title: t("sessionTitle"), body: t("sessionBody") };
      if (error.code === "rate_limited") return { title: t("rateLimitedTitle"), body: tErrors("rate_limited") };
      if (error.code === "live_not_configured") return { title: t("providersTitle"), body: tErrors("live_not_configured") };
      if (error.code === "live_not_allowed") return { title: t("forbiddenTitle"), body: tErrors("live_not_allowed") };
      if (error.code === "invalid_state") return { title: t("changedTitle"), body: tErrors("invalid_state") };
      if (error.code === "forbidden") return { title: t("forbiddenTitle"), body: t("forbiddenBody") };
    }
    return { title: t("genericTitle"), body: t("genericBody") };
  };
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const colors = useColors();
  const tCommon = useTranslations("Common");
  const text = useErrorText()(error);
  const offline = error instanceof ApiError && error.isOffline;
  return (
    <View style={styles.empty} accessibilityRole="alert">
      <View style={[styles.emptyIcon, { backgroundColor: colors["surface-sunken"] }]}>
        {offline ? <CloudOff size={24} color={colors.muted} /> : <ServerCrash size={24} color={colors.muted} />}
      </View>
      <Text variant="heading" align="center">
        {text.title}
      </Text>
      <Text variant="callout" tone="muted" align="center">
        {text.body}
      </Text>
      {onRetry ? <Button label={tCommon("retry")} variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

/** Placeholder blocks while a screen loads (static when Reduce Motion is on). */
export function Skeleton({ lines = 3 }: { lines?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 10 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: lines }, (_, i) => (
        <View key={i} style={{ height: i === 0 ? 22 : 14, width: i === 0 ? "60%" : `${90 - i * 12}%`, borderRadius: 6, backgroundColor: colors["surface-sunken"] }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.sm, padding: SPACE.xxl, minHeight: 200 },
  empty: { alignItems: "center", justifyContent: "center", gap: SPACE.md, paddingVertical: SPACE.xxxl, paddingHorizontal: SPACE.xl },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: SPACE.xs },
});
