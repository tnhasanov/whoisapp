import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { haptics } from "@/lib/actions";
import { FONTS, RADIUS, TOUCH, useTheme } from "@/lib/theme";
import { Text } from "./text";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: Variant;
  icon?: ReactNode;
  loading?: boolean;
  /** Shown while loading (e.g. "Starting…"). */
  loadingLabel?: string;
  size?: "md" | "sm";
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  hapticOnPress?: boolean;
};

export function Button({ label, variant = "primary", icon, loading, loadingLabel, size = "md", block, disabled, style, hapticOnPress, onPress, ...rest }: Props) {
  const { colors, reduceMotion } = useTheme();
  const isDisabled = disabled || loading;
  const palette = {
    primary: { bg: colors.accent, fg: "on-accent" as const, border: colors.accent },
    secondary: { bg: colors.surface, fg: "ink" as const, border: colors["line-strong"] },
    ghost: { bg: "transparent", fg: "accent" as const, border: "transparent" },
    danger: { bg: colors.surface, fg: "danger" as const, border: colors.danger },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading && loadingLabel ? loadingLabel : label}
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
      disabled={isDisabled}
      hitSlop={size === "sm" ? 8 : 4}
      onPress={(event) => {
        if (hapticOnPress) haptics.select();
        onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.base,
        size === "sm" ? styles.sm : styles.md,
        { backgroundColor: palette.bg, borderColor: palette.border },
        block ? styles.block : null,
        isDisabled ? styles.disabled : null,
        pressed && !reduceMotion ? styles.pressed : null,
        pressed ? { opacity: 0.85 } : null,
        style,
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? <ActivityIndicator size="small" color={variant === "primary" ? colors["on-accent"] : colors.accent} /> : icon}
        <Text variant={size === "sm" ? "subhead" : "bodyStrong"} tone={palette.fg} weight={FONTS.semibold} numberOfLines={2} align="center">
          {loading && loadingLabel ? loadingLabel : label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: RADIUS.md, borderWidth: 1, justifyContent: "center" },
  md: { minHeight: TOUCH, paddingHorizontal: 18, paddingVertical: 10 },
  sm: { minHeight: 40, paddingHorizontal: 14, paddingVertical: 6 },
  block: { alignSelf: "stretch" },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.985 }] },
});
