import { CheckCircle2, ExternalLink, FileText } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import type { Source } from "@personbrief/shared/api/v1";
import { openExternal } from "@/lib/actions";
import { displayHost, langOf } from "@/lib/format";
import { useDates } from "@/lib/i18n";
import { RADIUS, SPACE, useColors } from "@/lib/theme";
import { Badge } from "../ui/badge";
import { Text } from "../ui/text";

/**
 * One source with what could and could not be read. Public pages open in an
 * in-app browser sheet; fictional demo sources open their invented text
 * inside PersonBrief (they are not real websites).
 */
export function SourceCard({
  source,
  excerpt,
  excerptLanguage,
  verified,
  onOpenFixture,
  onOpenSource,
}: {
  source: Source;
  excerpt?: string | null;
  excerptLanguage?: string | null;
  verified?: boolean;
  onOpenFixture: (key: string) => void;
  onOpenSource?: () => void;
}) {
  const t = useTranslations("Evidence");
  const tTypes = useTranslations("SourceTypes");
  const colors = useColors();
  const dates = useDates();
  const title = source.title ?? displayHost(source.url);
  return (
    <View style={[styles.card, { backgroundColor: colors["surface-2"], borderColor: colors.line }]}>
      <View style={styles.head}>
        <Text variant="caption" tone="accent">
          [{source.key.replace(/^S/, "")}]
        </Text>
        <View style={styles.flex}>
          <Text variant="subhead">{title}</Text>
          <Text variant="caption" tone="muted">
            {source.publisher ?? displayHost(source.url)} · {tTypes.has(source.sourceType) ? tTypes(source.sourceType) : source.sourceType}
          </Text>
        </View>
      </View>
      <View style={styles.badges}>
        <Badge tone="outline" label={t.has(`reliability.${source.reliability}`) ? t(`reliability.${source.reliability}`) : source.reliability} />
        <Badge tone={source.accessStatus === "read" ? "neutral" : "warn"} label={t.has(`access.${source.accessStatus}`) ? t(`access.${source.accessStatus}`) : source.accessStatus} />
        {source.language !== "unknown" ? <Badge tone="outline" label={t.has(`languages.${source.language}`) ? t(`languages.${source.language}`) : source.language} /> : null}
      </View>
      <View style={styles.dates}>
        <Text variant="caption" tone="muted">
          {source.publishedAt ? t("published", { date: dates.partialString(source.publishedAt) }) : t("publishedUnknown")}
        </Text>
        {!source.publishedAt && source.providerReportedDate ? (
          <Text variant="caption" tone="muted">
            {t("providerDate", { date: dates.partialString(source.providerReportedDate) })}
          </Text>
        ) : null}
        <Text variant="caption" tone="muted">
          {t("accessed", { date: dates.dateTime(source.accessedAt) })} · {t.has(`method.${source.accessMethod}`) ? t(`method.${source.accessMethod}`) : source.accessMethod}
        </Text>
      </View>
      {excerpt ? (
        <View style={styles.excerptWrap}>
          <Text variant="label" tone="muted">
            {t("supportingExcerpt")}
          </Text>
          <View style={[styles.quote, { borderLeftColor: colors.accent }]}>
            <Text variant="reading" lang={langOf(excerptLanguage)} selectable>
              “{excerpt}”
            </Text>
          </View>
          {verified ? (
            <View style={styles.verified}>
              <CheckCircle2 size={13} color={colors.ok} />
              <Text variant="caption" tone="ok">
                {t("excerptVerified")}
              </Text>
            </View>
          ) : null}
          {excerptLanguage && excerptLanguage !== "en" && excerptLanguage !== "unknown" ? (
            <Text variant="caption" tone="muted">
              {t("originalLanguage", { language: t.has(`languages.${excerptLanguage}`) ? t(`languages.${excerptLanguage}`) : excerptLanguage })}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.links}>
        {source.fixtureKey ? (
          <LinkButton icon={<FileText size={15} color={colors.demo} />} label={t("openFixture")} onPress={() => onOpenFixture(source.fixtureKey!)} tone="demo" />
        ) : (
          <LinkButton icon={<ExternalLink size={15} color={colors.accent} />} label={t("openSource")} onPress={() => void openExternal(source.url)} />
        )}
        {onOpenSource ? <LinkButton label={t("identityEvidence")} onPress={onOpenSource} /> : null}
      </View>
    </View>
  );
}

function LinkButton({ label, onPress, icon, tone = "accent" }: { label: string; onPress: () => void; icon?: React.ReactNode; tone?: "accent" | "demo" }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={styles.link}>
      {icon}
      <Text variant="subhead" tone={tone}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth, padding: SPACE.md, gap: SPACE.sm },
  head: { flexDirection: "row", gap: SPACE.sm, alignItems: "flex-start" },
  flex: { flex: 1, gap: 2 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dates: { gap: 2 },
  excerptWrap: { gap: 6, marginTop: 4 },
  quote: { borderLeftWidth: 2, paddingLeft: SPACE.md },
  verified: { flexDirection: "row", alignItems: "center", gap: 4 },
  links: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.lg, marginTop: 2 },
  link: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36 },
});
