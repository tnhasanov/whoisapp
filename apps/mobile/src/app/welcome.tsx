import { useQuery } from "@tanstack/react-query";
import { FileSearch, FlaskConical, Link2, ShieldCheck } from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View, type TextInput } from "react-native";
import { useTranslations } from "use-intl";
import { MetaResponseSchema } from "@personbrief/shared/api/v1";
import type { Locale } from "@personbrief/shared/domain";
import { BrandMark } from "@/components/brand";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/list";
import { Screen } from "@/components/ui/screen";
import { OfflineBanner } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { haptics, openExternal } from "@/lib/actions";
import { request } from "@/lib/api";
import { API_CONFIG, APP_BUILD, APP_VERSION, VARIANT } from "@/lib/config";
import { LOCALE_NAMES, useLocaleState } from "@/lib/i18n";
import { useSession, type SignInResult } from "@/lib/session";
import { SPACE, useColors } from "@/lib/theme";

/** The server's public privacy page (also listed in the app stores). */
const privacyUrl = API_CONFIG.ok ? `${API_CONFIG.baseUrl}/privacy` : null;

/** Welcome and sign-in. Accounts are created by the owner only — there is no registration here. */
export default function Welcome() {
  const t = useTranslations("App.welcome");
  const tAuth = useTranslations("Auth");
  const tPrivacy = useTranslations("Privacy");
  const colors = useColors();
  const { state, signIn, signInDemo } = useSession();
  const { locale, setDeviceLocale } = useLocaleState();
  const meta = useQuery({ queryKey: ["meta"], queryFn: () => request("/meta", { schema: MetaResponseSchema }), retry: 1 });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"signin" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const explain = (result: SignInResult) => {
    if (result.ok) return null;
    return {
      invalid: tAuth("errors.invalid"),
      rate_limited: tAuth("errors.rateLimited"),
      offline: t("offline"),
      demo_unavailable: tAuth("errors.demoDisabled"),
      failed: t("failed"),
    }[result.reason];
  };

  const submit = async () => {
    if (!email.trim() || !password) {
      setError(tAuth("errors.missing"));
      haptics.warning();
      return;
    }
    setBusy("signin");
    setError(null);
    const result = await signIn(email, password);
    setBusy(null);
    if (!result.ok) {
      setError(explain(result));
      haptics.warning();
    }
  };

  const openDemo = async () => {
    setBusy("demo");
    setError(null);
    const result = await signInDemo();
    setBusy(null);
    if (!result.ok) setError(explain(result));
  };

  const notice = state.status === "signedOut" ? state.notice : null;
  const host = API_CONFIG.ok ? new URL(API_CONFIG.baseUrl).host : "";

  return (
    <Screen edges={["top", "bottom"]} contentStyle={styles.content}>
      <Segmented<Locale>
        label={tAuth("language")}
        value={locale}
        onChange={setDeviceLocale}
        options={(Object.keys(LOCALE_NAMES) as Locale[]).map((value) => ({ value, label: LOCALE_NAMES[value] }))}
      />

      <View style={styles.hero}>
        <BrandMark size={52} />
        <Text variant="display" accessibilityRole="header">
          PersonBrief
          <Text variant="display" tone="accent">
            .
          </Text>
        </Text>
        <Text variant="callout" tone="ink-2">
          {tAuth("subtitle")}
        </Text>
        <View style={styles.points}>
          {[
            { Icon: FileSearch, text: t("pointResearch") },
            { Icon: Link2, text: t("pointEvidence") },
            { Icon: ShieldCheck, text: t("pointPrivate") },
          ].map(({ Icon, text }) => (
            <View key={text} style={styles.point}>
              <Icon size={18} color={colors.accent} />
              <Text variant="footnote" tone="ink-2" style={styles.flex}>
                {text}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <OfflineBanner />
      {notice === "expired" ? <Banner tone="warn" title={t("expiredTitle")} body={t("expiredBody")} /> : null}
      {notice === "signedOut" ? <Banner tone="ok" body={t("signedOut")} /> : null}

      <Card style={styles.card}>
        <Text variant="heading" accessibilityRole="header">
          {tAuth("title")}
        </Text>
        <Field
          label={tAuth("email")}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          testID="email"
        />
        <Field
          ref={passwordRef}
          label={tAuth("password")}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          testID="password"
        />
        {error ? <Banner tone="danger" body={error} /> : null}
        <Button label={tAuth("submit")} loadingLabel={tAuth("submitting")} loading={busy === "signin"} disabled={busy !== null} onPress={() => void submit()} testID="sign-in" />
        <Text variant="footnote" tone="muted">
          {tAuth("closedRegistration")}
        </Text>
      </Card>

      {meta.data?.features.demoSignIn ? (
        <Card style={[styles.card, { borderColor: colors["demo-line"], backgroundColor: colors["demo-soft"] }]}>
          <View style={styles.point}>
            <FlaskConical size={18} color={colors.demo} />
            <Text variant="headline" tone="demo" style={styles.flex}>
              {tAuth("demoTitle")}
            </Text>
          </View>
          <Text variant="footnote" tone="ink-2">
            {tAuth("demoBody")}
          </Text>
          <Button label={tAuth("demoButton")} variant="secondary" loading={busy === "demo"} disabled={busy !== null} onPress={() => void openDemo()} testID="open-demo" />
        </Card>
      ) : null}

      {privacyUrl ? (
        <Pressable accessibilityRole="link" onPress={() => void openExternal(privacyUrl)} hitSlop={8} style={styles.privacy}>
          <Text variant="footnote" tone="accent" align="center">
            {tPrivacy("link")}
          </Text>
        </Pressable>
      ) : null}
      <Text variant="caption" tone="subtle" align="center">
        {t("version", { version: APP_VERSION, build: APP_BUILD })}
        {VARIANT !== "production" ? ` · ${VARIANT} · ${host}` : ""}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACE.xl },
  hero: { gap: SPACE.md, paddingTop: SPACE.md },
  points: { gap: SPACE.sm, marginTop: SPACE.xs },
  point: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  flex: { flex: 1 },
  card: { gap: SPACE.lg },
  privacy: { alignSelf: "center" },
});
