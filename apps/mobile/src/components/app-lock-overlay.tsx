import { LockKeyhole } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { useAppLock } from "@/lib/app-lock";
import { useSession } from "@/lib/session";
import { SPACE, useColors } from "@/lib/theme";
import { BrandMark } from "./brand";
import { Button } from "./ui/button";
import { Text } from "./ui/text";

/** Full-screen lock when App lock is on. The fallback is signing out (the session leaves the phone). */
export function AppLockOverlay() {
  const { locked, unlock } = useAppLock();
  const { signOut } = useSession();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const t = useTranslations("App.lock");
  const [failed, setFailed] = useState(false);
  const prompted = useRef(false);

  useEffect(() => {
    if (locked && !prompted.current) {
      prompted.current = true;
      void unlock(t("prompt")).then((ok) => setFailed(!ok));
    }
    if (!locked) prompted.current = false;
  }, [locked, unlock, t]);

  if (!locked) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: colors.canvas, paddingTop: insets.top + SPACE.xxxl, paddingBottom: insets.bottom + SPACE.xl }]} accessibilityViewIsModal>
      <View style={styles.center}>
        <BrandMark size={56} />
        <LockKeyhole size={22} color={colors.muted} />
        <Text variant="title" align="center">
          {t("title")}
        </Text>
        <Text variant="callout" tone="muted" align="center">
          {failed ? t("failed") : t("body")}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button label={t("unlock")} onPress={() => void unlock(t("prompt")).then((ok) => setFailed(!ok))} block />
        <Button label={t("signOut")} variant="ghost" onPress={() => void signOut()} block />
      </View>
    </View>
  );
}

/**
 * With App lock on, the app switcher shows the brand instead of the last
 * screen (research content is not left visible in the task switcher).
 */
export function PrivacyCover() {
  const { enabled } = useAppLock();
  const colors = useColors();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setHidden(state !== "active"));
    return () => sub.remove();
  }, []);
  if (!enabled || !hidden) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.privacy, { backgroundColor: colors.canvas }]} pointerEvents="none">
      <BrandMark size={64} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { paddingHorizontal: SPACE.xl, justifyContent: "space-between", zIndex: 10 },
  center: { alignItems: "center", gap: SPACE.md, marginTop: SPACE.xxxl },
  actions: { gap: SPACE.sm },
  privacy: { alignItems: "center", justifyContent: "center", zIndex: 20 },
});
