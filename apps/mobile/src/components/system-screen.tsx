import { CloudOff, DownloadCloud, Settings2 } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { API_CONFIG, VARIANT } from "@/lib/config";
import { SPACE, useColors } from "@/lib/theme";
import { BrandMark } from "./brand";
import { Button } from "./ui/button";
import { Text } from "./ui/text";

type Kind = "misconfigured" | "upgrade" | "unreachable";

/** States outside the normal app: no server configured, update required, server unreachable at launch. */
export function SystemScreen({ kind, onRetry, onSignOut }: { kind: Kind; onRetry?: () => void; onSignOut?: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const t = useTranslations("App.system");
  const Icon = kind === "unreachable" ? CloudOff : kind === "upgrade" ? DownloadCloud : Settings2;
  const detail =
    kind === "misconfigured" && !API_CONFIG.ok
      ? API_CONFIG.reason === "insecure"
        ? t("insecure")
        : API_CONFIG.reason === "invalid"
          ? t("invalid")
          : t("missing", { variant: VARIANT })
      : null;
  return (
    <View style={[styles.wrap, { backgroundColor: colors.canvas, paddingTop: insets.top + SPACE.xxxl, paddingBottom: insets.bottom + SPACE.xl }]}>
      <View style={styles.center}>
        <BrandMark size={48} />
        <Icon size={22} color={colors.muted} />
        <Text variant="title" align="center" accessibilityRole="header">
          {t(`${kind}Title`)}
        </Text>
        <Text variant="callout" tone="muted" align="center">
          {t(`${kind}Body`)}
        </Text>
        {detail ? (
          <Text variant="footnote" tone="subtle" align="center">
            {detail}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        {onRetry ? <Button label={t("retry")} onPress={onRetry} block /> : null}
        {onSignOut ? <Button label={t("signOut")} variant="ghost" onPress={onSignOut} block /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: SPACE.xl, justifyContent: "space-between" },
  center: { alignItems: "center", gap: SPACE.md, marginTop: SPACE.xxl },
  actions: { gap: SPACE.sm },
});
