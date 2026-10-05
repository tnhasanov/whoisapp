import { Laptop, Smartphone } from "lucide-react-native";
import { Alert, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { ListGroup, Row } from "@/components/ui/list";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState, OfflineBanner, useErrorText } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useDates } from "@/lib/i18n";
import { useRevokeOtherSessions, useRevokeSession, useSessions } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { SPACE, useColors } from "@/lib/theme";

/** Signed-in devices and browsers. Revoking one signs it out on the server immediately. */
export default function SessionsScreen() {
  const t = useTranslations("App.sessions");
  const colors = useColors();
  const dates = useDates();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const errorText = useErrorText();
  const { signOut } = useSession();

  if (sessions.isPending) return <LoadingState />;
  if (!sessions.data) return <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />;
  const items = sessions.data.items;
  const others = items.filter((s) => !s.current);
  const error = revoke.error ?? revokeOthers.error;

  return (
    <Screen onRefresh={() => void sessions.refetch()} refreshing={sessions.isRefetching}>
      <OfflineBanner />
      <Text variant="callout" tone="muted">
        {t("intro")}
      </Text>
      {error ? <Banner tone="danger" body={errorText(error).body} /> : null}
      {revokeOthers.isSuccess ? <Banner tone="ok" body={t("revokedOthers", { count: revokeOthers.data.revoked })} /> : null}
      <ListGroup>
        {items.map((s) => (
          <Row
            key={s.id}
            left={s.device === "browser" ? <Laptop size={18} color={colors.muted} /> : <Smartphone size={18} color={colors.muted} />}
            title={s.label}
            subtitle={t("details", { created: dates.dateTime(s.createdAt), active: dates.dateTime(s.lastActiveAt), expires: dates.dateTime(s.expiresAt) })}
            chevron={false}
            right={
              s.current ? (
                <Badge tone="accent" label={t("thisDevice")} />
              ) : (
                <Button
                  size="sm"
                  variant="danger"
                  label={t("revoke")}
                  loading={revoke.isPending && revoke.variables === s.id}
                  onPress={() =>
                    Alert.alert(t("revokeTitle"), t("revokeBody"), [
                      { text: t("cancel"), style: "cancel" },
                      { text: t("revoke"), style: "destructive", onPress: () => revoke.mutate(s.id) },
                    ])
                  }
                />
              )
            }
          />
        ))}
      </ListGroup>
      <View style={styles.actions}>
        {others.length > 0 ? (
          <Button variant="secondary" label={t("revokeOthers")} loading={revokeOthers.isPending} onPress={() => revokeOthers.mutate()} />
        ) : null}
        <Button variant="danger" label={t("signOutHere")} onPress={() => void signOut()} />
      </View>
      <Text variant="footnote" tone="muted">
        {t("expiryNote")}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({ actions: { gap: SPACE.sm } });
