import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/list";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { SPACE } from "@/lib/theme";

const WEB_SECTIONS = ["what", "sources", "excluded", "storage", "providers", "deletion", "corrections", "limits"] as const;

/** Plain-language data use: the website's explanation plus what the app keeps on the phone. */
export default function DataUseScreen() {
  const t = useTranslations("DataUse");
  const tApp = useTranslations("App.dataUse");
  return (
    <Screen>
      <Text variant="title">{t("title")}</Text>
      <Text variant="callout" tone="muted">
        {t("subtitle")}
      </Text>
      <SectionHeader title={tApp("phoneTitle")} />
      <Card style={styles.gap}>
        {(["session", "content", "exports", "shared", "notifications", "lock"] as const).map((key) => (
          <View key={key} style={styles.item}>
            <Text variant="subhead">{tApp(`${key}Title`)}</Text>
            <Text variant="footnote" tone="ink-2">
              {tApp(`${key}Body`)}
            </Text>
          </View>
        ))}
      </Card>
      {WEB_SECTIONS.map((key) => (
        <View key={key} style={styles.gap}>
          <SectionHeader title={t(`${key}Title`)} />
          <Card>
            <Text variant="callout" tone="ink-2">
              {t(`${key}Body`)}
            </Text>
          </Card>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: SPACE.md },
  item: { gap: 2 },
});
