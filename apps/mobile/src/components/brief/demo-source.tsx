import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { langOf } from "@/lib/format";
import { useDemoSource } from "@/lib/queries";
import { SPACE } from "@/lib/theme";
import { Badge } from "../ui/badge";
import { Banner } from "../ui/banner";
import { ErrorState, LoadingState } from "../ui/states";
import { Text } from "../ui/text";

/** The text of a fictional demo source (demo URLs use reserved example domains and do not exist). */
export function DemoSourceView({ fixtureKey }: { fixtureKey: string }) {
  const t = useTranslations("Fixture");
  const tTypes = useTranslations("SourceTypes");
  const tEvidence = useTranslations("Evidence");
  const doc = useDemoSource(fixtureKey);
  if (doc.isPending) return <LoadingState />;
  if (!doc.data) return <ErrorState error={doc.error} onRetry={() => void doc.refetch()} />;
  const d = doc.data;
  return (
    <View style={styles.wrap}>
      <Banner tone="demo" body={t("banner")} />
      <View style={styles.badges}>
        <Badge tone="demo" label={t("demoBadge")} />
        <Badge tone="outline" label={tTypes.has(d.sourceType) ? tTypes(d.sourceType) : d.sourceType} />
      </View>
      <Text variant="title" lang={langOf(d.language)}>
        {d.title}
      </Text>
      <View style={styles.meta}>
        <Text variant="footnote" tone="muted">
          {t("publisher")}: {d.publisher}
        </Text>
        <Text variant="footnote" tone="muted">
          {t("published")}: {d.publishedOnRunDate ? t("runDate") : (d.publishedDate ?? "—")}
        </Text>
        <Text variant="footnote" tone="muted">
          {t("access")}: {tEvidence.has(`access.${d.access}`) ? tEvidence(`access.${d.access}`) : d.access}
        </Text>
        <Text variant="caption" tone="subtle" selectable>
          {t("originalUrl")}: {d.url}
        </Text>
      </View>
      {d.body ? (
        d.body.split(/\n{2,}/).map((para, i) => (
          <Text key={i} variant="reading" lang={langOf(d.language)} selectable>
            {para}
          </Text>
        ))
      ) : (
        <>
          <Text variant="footnote" tone="warn">
            {t("snippetOnly")}
          </Text>
          <Text variant="reading" tone="ink-2" lang={langOf(d.language)}>
            {d.snippet}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.md },
  badges: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  meta: { gap: 2 },
});
