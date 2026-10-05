import { ChevronRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { haptics } from "@/lib/actions";
import { RADIUS, SPACE, TOUCH, useColors } from "@/lib/theme";
import { Divider } from "./card";
import { Text } from "./text";

/** Uppercase section label with an optional hint. */
export function SectionHeader({ title, hint, action }: { title: string; hint?: string | null; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.flex}>
        <Text variant="label" tone="muted" accessibilityRole="header">
          {title}
        </Text>
        {hint ? (
          <Text variant="footnote" tone="muted" style={{ marginTop: 2 }}>
            {hint}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

/** A grouped list (iOS-style inset group) of rows. */
export function ListGroup({ children }: { children: ReactNode }) {
  const colors = useColors();
  const items = (Array.isArray(children) ? children : [children]).flat().filter(Boolean);
  return (
    <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 ? <Divider inset={SPACE.lg} /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

type RowProps = {
  title: string;
  subtitle?: string | null;
  detail?: string | null;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  accessibilityHint?: string;
  accessibilityLabel?: string;
  numberOfLines?: number;
};

export function Row({ title, subtitle, detail, left, right, onPress, chevron = Boolean(onPress), destructive, accessibilityHint, accessibilityLabel, numberOfLines = 2 }: RowProps) {
  const colors = useColors();
  const content = (
    <View style={styles.row}>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.flex}>
        <Text variant="bodyStrong" tone={destructive ? "danger" : "ink"} numberOfLines={numberOfLines}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" tone="muted" numberOfLines={3}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {detail ? (
        <Text variant="footnote" tone="muted" style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
      {right}
      {chevron ? <ChevronRight size={18} color={colors.subtle} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle, detail].filter(Boolean).join(", ")}
      accessibilityHint={accessibilityHint}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      style={({ pressed }) => [{ backgroundColor: pressed ? colors["surface-2"] : "transparent" }]}
    >
      {content}
    </Pressable>
  );
}

/** Mutually exclusive options (filters, theme, language). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  const colors = useColors();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segmented, { backgroundColor: colors["surface-sunken"] }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={option.label}
            onPress={() => {
              if (!selected) haptics.select();
              onChange(option.value);
            }}
            style={[styles.segment, selected ? { backgroundColor: colors.surface, borderColor: colors.line } : null]}
          >
            <Text variant="subhead" tone={selected ? "ink" : "muted"} align="center" numberOfLines={2}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A toggleable filter or suggestion chip. */
export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: ReactNode }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      accessibilityLabel={label}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      hitSlop={6}
      style={[
        styles.chip,
        { backgroundColor: selected ? colors.ink : colors.surface, borderColor: selected ? colors.ink : colors["line-strong"] },
      ]}
    >
      {icon}
      <Text variant="subhead" style={{ color: selected ? colors.canvas : colors["ink-2"] }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", gap: SPACE.md, paddingHorizontal: SPACE.xs, marginBottom: -SPACE.xs },
  group: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: TOUCH + 6, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
  left: { width: 28, alignItems: "center" },
  detail: { maxWidth: "40%" },
  segmented: { flexDirection: "row", borderRadius: RADIUS.md, padding: 3, gap: 3 },
  // Widths follow the labels (like iOS's apportionsSegmentWidthsByContent), so
  // long names such as "Azərbaycanca" stay on one line next to short ones.
  segment: { flexGrow: 1, flexShrink: 1, flexBasis: "auto", minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.sm, paddingHorizontal: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: "transparent" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: RADIUS.pill, borderWidth: 1 },
});
