import { FlaskConical } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import type { MeResponse } from "@personbrief/shared/api/v1";
import { useColors } from "@/lib/theme";
import { Badge } from "./ui/badge";
import { Banner } from "./ui/banner";
import { Text } from "./ui/text";

/** Large tab title with the workspace badge (Live or the clearly labelled fictional Demo). */
export function TabTitle({ title, me, subtitle }: { title: string; me?: MeResponse; subtitle?: string | null }) {
  const tWs = useTranslations("Workspace");
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text variant="display" accessibilityRole="header" style={styles.flex} numberOfLines={2}>
          {title}
        </Text>
        {me ? (
          me.workspace === "demo" ? (
            <Badge tone="demo" label={tWs("demo")} icon={<FlaskConical size={12} color={colors.demo} />} />
          ) : (
            <Badge tone="accent" label={tWs("live")} />
          )
        ) : null}
      </View>
      {subtitle ? (
        <Text variant="callout" tone="muted">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** Shown on every screen of the demo workspace: everything here is invented. */
export function DemoBanner({ me }: { me?: MeResponse }) {
  const tWs = useTranslations("Workspace");
  if (me?.workspace !== "demo") return null;
  return <Banner tone="demo" title={tWs("bannerTitle")} body={tWs("bannerBody")} />;
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
});
