import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { haptics } from "@/lib/actions";
import { RADIUS, SPACE, TOUCH, useTheme } from "@/lib/theme";
import { Divider } from "./card";
import { Text } from "./text";

export type MenuOption = { key: string; label: string; hint?: string | null; icon?: ReactNode; destructive?: boolean; disabled?: boolean; onPress: () => void };

/** A bottom action menu (share formats, profile actions, version picker). Closes with the backdrop, Back or Cancel. */
export function MenuSheet({ visible, title, message, options, onClose }: { visible: boolean; title?: string | null; message?: string | null; options: MenuOption[]; onClose: () => void }) {
  const { colors, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const tCommon = useTranslations("Common");
  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? "none" : "slide"} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,14,24,0.38)" }]} onPress={onClose} accessibilityLabel={tCommon("close")} accessibilityRole="button" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + SPACE.sm }]} accessibilityViewIsModal>
          <View style={[styles.grabber, { backgroundColor: colors["line-strong"] }]} />
          {title ? (
            <Text variant="headline" align="center" accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
          ) : null}
          {message ? (
            <Text variant="footnote" tone="muted" align="center" style={styles.message}>
              {message}
            </Text>
          ) : null}
          <ScrollView style={{ maxHeight: 460 }}>
            {options.map((option, i) => (
              <View key={option.key}>
                {i > 0 ? <Divider inset={SPACE.lg} /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityHint={option.hint ?? undefined}
                  accessibilityState={{ disabled: Boolean(option.disabled) }}
                  disabled={option.disabled}
                  onPress={() => {
                    haptics.select();
                    onClose();
                    option.onPress();
                  }}
                  style={({ pressed }) => [styles.option, { backgroundColor: pressed ? colors["surface-2"] : "transparent", opacity: option.disabled ? 0.45 : 1 }]}
                >
                  {option.icon ? <View style={styles.icon}>{option.icon}</View> : null}
                  <View style={styles.flex}>
                    <Text variant="bodyStrong" tone={option.destructive ? "danger" : "ink"}>
                      {option.label}
                    </Text>
                    {option.hint ? (
                      <Text variant="footnote" tone="muted">
                        {option.hint}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              </View>
            ))}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={onClose} style={[styles.cancel, { backgroundColor: colors["surface-sunken"] }]}>
            <Text variant="bodyStrong" align="center">
              {tCommon("cancel")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingTop: SPACE.sm },
  grabber: { alignSelf: "center", width: 38, height: 5, borderRadius: 3, marginBottom: SPACE.sm },
  title: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.xs },
  message: { paddingHorizontal: SPACE.xl, paddingTop: 4, paddingBottom: SPACE.sm },
  option: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: TOUCH + 8, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
  icon: { width: 24, alignItems: "center" },
  flex: { flex: 1, gap: 2 },
  cancel: { margin: SPACE.lg, marginTop: SPACE.sm, minHeight: TOUCH, borderRadius: RADIUS.md, justifyContent: "center" },
});
