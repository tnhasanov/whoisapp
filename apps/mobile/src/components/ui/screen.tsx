import type { ReactNode, RefObject } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACE, useColors } from "@/lib/theme";

type Props = {
  children: ReactNode;
  /** Pull-to-refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Content above the scroll area that stays in place (filters, banners). */
  header?: ReactNode;
  /** Pinned below the scroll area (primary action). */
  footer?: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Screens under a native header only need the bottom inset. */
  edges?: ("top" | "bottom")[];
  scrollRef?: RefObject<ScrollView | null>;
};

/** Page scaffold: canvas background, safe areas, keyboard avoidance, pull to refresh. */
export function Screen({ children, onRefresh, refreshing = false, header, footer, scroll = true, contentStyle, edges = ["bottom"], scrollRef }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const padTop = edges.includes("top") ? insets.top : 0;
  const padBottom = edges.includes("bottom") && !footer ? insets.bottom : 0;
  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: SPACE.xxxl + padBottom }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} colors={[colors.accent]} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );
  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.canvas, paddingTop: padTop }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {header}
      {body}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACE.md, borderTopColor: colors.line, backgroundColor: colors.canvas }]}>{footer}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function Gap({ size = SPACE.lg }: { size?: number }) {
  return <View style={{ height: size }} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg, gap: SPACE.lg },
  footer: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth },
});
