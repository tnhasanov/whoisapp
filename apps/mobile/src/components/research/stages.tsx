import { CheckCircle2, Circle, CircleDashed, CircleSlash, Loader2, TriangleAlert, XCircle } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import type { JobDetail } from "@personbrief/shared/api/v1";
import { SPACE, useColors } from "@/lib/theme";
import { Text } from "../ui/text";

/**
 * The persisted pipeline stages exactly as the server reports them — no
 * invented percentages. Each row says its state in words as well as an icon.
 */
export function StageList({ stages }: { stages: JobDetail["stages"] }) {
  const t = useTranslations("Job");
  const colors = useColors();
  return (
    <View accessibilityRole="list" accessibilityLabel={t("stagesLabel")} style={styles.list}>
      {stages.map(({ stage, status }) => {
        const label = t.has(`stages.${stage}`) ? t(`stages.${stage}`) : stage;
        const state = t.has(`stageStatus.${status}`) ? t(`stageStatus.${status}`) : status;
        const Icon =
          status === "completed"
            ? CheckCircle2
            : status === "running"
              ? Loader2
              : status === "failed"
                ? XCircle
                : status === "partial"
                  ? TriangleAlert
                  : status === "skipped"
                    ? CircleSlash
                    : status === "pending"
                      ? Circle
                      : CircleDashed;
        const color =
          status === "completed" ? colors.ok : status === "running" ? colors.accent : status === "failed" ? colors.danger : status === "partial" ? colors.warn : colors.subtle;
        return (
          <View key={stage} style={styles.row} accessible accessibilityLabel={`${label}: ${state}`}>
            <Icon size={18} color={color} />
            <Text variant="callout" tone={status === "pending" || status === "skipped" ? "muted" : "ink"} style={styles.flex}>
              {label}
            </Text>
            <Text variant="caption" style={{ color }}>
              {state}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: 36 },
  flex: { flex: 1 },
});
