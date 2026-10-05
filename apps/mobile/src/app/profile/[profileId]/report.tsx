import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { ISSUE_MAX_LENGTH } from "@personbrief/shared/api/v1";
import { ISSUE_CATEGORIES, type IssueCategory } from "@personbrief/shared/domain";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ListGroup, Row } from "@/components/ui/list";
import { Screen } from "@/components/ui/screen";
import { useErrorText, useOnline } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { haptics } from "@/lib/actions";
import { useReportIssue } from "@/lib/queries";
import { SPACE, useColors } from "@/lib/theme";
import { Check } from "lucide-react-native";

/** Report something incorrect, outdated, about the wrong person, or a privacy concern. */
export default function ReportScreen() {
  const { profileId, snapshot, claim } = useLocalSearchParams<{ profileId: string; snapshot?: string; claim?: string }>();
  const t = useTranslations("Report");
  const colors = useColors();
  const router = useRouter();
  const online = useOnline();
  const errorText = useErrorText();
  const report = useReportIssue(profileId);
  const [category, setCategory] = useState<IssueCategory>(claim ? "incorrect" : "other");
  const [message, setMessage] = useState("");

  return (
    <Screen
      footer={
        <Button
          label={t("submit")}
          disabled={!message.trim() || !online || report.isSuccess}
          loading={report.isPending}
          onPress={() =>
            report.mutate(
              { category, message, snapshotId: snapshot || null, claimId: claim || null },
              {
                onSuccess: () => {
                  haptics.success();
                  setTimeout(() => router.back(), 900);
                },
              },
            )
          }
        />
      }
    >
      <Text variant="callout" tone="muted">
        {t("subtitle")}
      </Text>
      {report.isSuccess ? <Banner tone="ok" body={t("submitted")} /> : null}
      {report.error ? <Banner tone="danger" body={errorText(report.error).body} /> : null}
      <View style={styles.gap}>
        <Text variant="subhead">{t("category")}</Text>
        <ListGroup>
          {ISSUE_CATEGORIES.map((c) => (
            <Row key={c} title={t(`categories.${c}`)} chevron={false} onPress={() => setCategory(c)} right={category === c ? <Check size={18} color={colors.accent} /> : null} />
          ))}
        </ListGroup>
      </View>
      <Field label={t("message")} value={message} onChangeText={setMessage} multiline maxLength={ISSUE_MAX_LENGTH} />
    </Screen>
  );
}

const styles = StyleSheet.create({ gap: { gap: SPACE.sm } });
