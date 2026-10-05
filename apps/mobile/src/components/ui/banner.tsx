import { AlertTriangle, CheckCircle2, FlaskConical, Info, WifiOff, XCircle } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { ColorToken } from "@personbrief/shared/design/tokens";
import { RADIUS, SPACE, useColors } from "@/lib/theme";
import { Text } from "./text";

export type BannerTone = "info" | "ok" | "warn" | "danger" | "demo" | "offline";

const TONES: Record<BannerTone, { bg: ColorToken; fg: ColorToken; border: ColorToken }> = {
  info: { bg: "accent-soft", fg: "accent-ink", border: "accent-soft" },
  ok: { bg: "ok-soft", fg: "ok", border: "ok-soft" },
  warn: { bg: "warn-soft", fg: "warn", border: "warn-soft" },
  danger: { bg: "danger-soft", fg: "danger", border: "danger-soft" },
  demo: { bg: "demo-soft", fg: "demo", border: "demo-line" },
  offline: { bg: "slate-soft", fg: "ink-2", border: "line" },
};

/** Inline notice (offline, demo data, partial results, provider not configured…). */
export function Banner({ tone = "info", title, body, action, icon }: { tone?: BannerTone; title?: string | null; body?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  const colors = useColors();
  const t = TONES[tone];
  const Icon = { info: Info, ok: CheckCircle2, warn: AlertTriangle, danger: XCircle, demo: FlaskConical, offline: WifiOff }[tone];
  return (
    <View
      accessibilityRole={tone === "danger" || tone === "warn" ? "alert" : "summary"}
      style={[styles.banner, { backgroundColor: colors[t.bg], borderColor: colors[t.border] }]}
    >
      <View style={styles.icon}>{icon ?? <Icon size={18} color={colors[t.fg]} />}</View>
      <View style={styles.body}>
        {title ? (
          <Text variant="subhead" style={{ color: colors[t.fg] }}>
            {title}
          </Text>
        ) : null}
        {typeof body === "string" ? (
          <Text variant="footnote" tone="ink-2">
            {body}
          </Text>
        ) : (
          body
        )}
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", gap: SPACE.md, padding: SPACE.md, borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth },
  icon: { paddingTop: 1 },
  body: { flex: 1, gap: 4 },
  action: { marginTop: SPACE.sm, alignItems: "flex-start" },
});
