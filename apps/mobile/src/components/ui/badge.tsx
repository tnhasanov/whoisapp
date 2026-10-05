import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { ColorToken } from "@personbrief/shared/design/tokens";
import { RADIUS, useColors } from "@/lib/theme";
import { Text } from "./text";

export type BadgeTone = "neutral" | "accent" | "ok" | "warn" | "danger" | "demo" | "violet" | "outline";

const TONES: Record<BadgeTone, { bg: ColorToken | null; fg: ColorToken; border?: ColorToken }> = {
  neutral: { bg: "slate-soft", fg: "ink-2" },
  accent: { bg: "accent-soft", fg: "accent-ink" },
  ok: { bg: "ok-soft", fg: "ok" },
  warn: { bg: "warn-soft", fg: "warn" },
  danger: { bg: "danger-soft", fg: "danger" },
  demo: { bg: "demo-soft", fg: "demo", border: "demo-line" },
  violet: { bg: "violet-soft", fg: "violet" },
  outline: { bg: null, fg: "muted", border: "line-strong" },
};

/** Small status label. Meaning is always in the text, never in colour alone. */
export function Badge({ label, tone = "neutral", icon }: { label: string; tone?: BadgeTone; icon?: ReactNode }) {
  const colors = useColors();
  const t = TONES[tone];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: t.bg ? colors[t.bg] : "transparent", borderColor: t.border ? colors[t.border] : "transparent" },
      ]}
    >
      {icon}
      <Text variant="caption" style={{ color: colors[t.fg] }} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: "100%",
  },
});
