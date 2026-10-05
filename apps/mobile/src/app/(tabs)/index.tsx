import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronDown, ChevronUp, History, Sparkles } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type TextInput } from "react-native";
import { useTranslations } from "use-intl";
import { searchFieldErrors } from "@personbrief/shared/research/search-input";
import { JobStatusBadge } from "@/components/research/status";
import { DemoBanner, TabTitle } from "@/components/workspace";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { ListGroup, Row, SectionHeader } from "@/components/ui/list";
import { Screen } from "@/components/ui/screen";
import { OfflineBanner, useErrorText, useOnline } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { haptics, newIdempotencyKey } from "@/lib/actions";
import { ApiError } from "@/lib/api";
import { useDates } from "@/lib/i18n";
import { useExamples, useMe, useRecentSearches, useSetWorkspace, useStartResearch } from "@/lib/queries";
import { SPACE, useColors } from "@/lib/theme";

type Form = { fullName: string; company: string; country: string; profileUrl: string };
const EMPTY: Form = { fullName: "", company: "", country: "", profileUrl: "" };

/** B. Search: full name first, optional context tucked away, recent searches and (demo) fictional examples. */
export default function SearchScreen() {
  // "Refine the search" arrives as route parameters: a new pre-fill starts a fresh form.
  const params = useLocalSearchParams<{ name?: string; company?: string; country?: string; profileUrl?: string }>();
  const initial: Form = { fullName: params.name ?? "", company: params.company ?? "", country: params.country ?? "", profileUrl: params.profileUrl ?? "" };
  return <SearchBody key={JSON.stringify(initial)} initial={initial} />;
}

function SearchBody({ initial }: { initial: Form }) {
  const t = useTranslations("Search");
  const tApp = useTranslations("App.search");
  const tFields = useTranslations("Errors.fields");
  const tExamples = useTranslations("Examples");
  const colors = useColors();
  const router = useRouter();
  const me = useMe();
  const online = useOnline();
  const recent = useRecentSearches();
  const isDemo = me.data?.workspace === "demo";
  const examples = useExamples(isDemo);
  const start = useStartResearch();
  const setWorkspace = useSetWorkspace();
  const errorText = useErrorText();
  const dates = useDates();

  const [form, setForm] = useState<Form>(initial);
  const [showContext, setShowContext] = useState(Boolean(initial.company || initial.country || initial.profileUrl));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // One key per intended search: retrying the same search after a dropped connection cannot start it twice.
  const keyRef = useRef(newIdempotencyKey());
  const companyRef = useRef<TextInput>(null);

  const update = (field: keyof Form) => (value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((e) => ({ ...e, [field]: "" }));
    keyRef.current = newIdempotencyKey();
  };

  const liveBlocked = me.data?.workspace === "live" && !me.data.capabilities.liveResearchAvailable;

  const submit = () => {
    const problems = searchFieldErrors(form);
    if (problems) {
      setFieldErrors(Object.fromEntries(Object.entries(problems).map(([k, code]) => [k, tFields(code)])));
      if (problems.company || problems.country || problems.profileUrl) setShowContext(true);
      haptics.warning();
      return;
    }
    start.mutate(
      { input: form, idempotencyKey: keyRef.current },
      {
        onSuccess: ({ job }) => {
          haptics.success();
          keyRef.current = newIdempotencyKey();
          setForm(EMPTY);
          router.push({ pathname: "/research/[jobId]", params: { jobId: job.id } });
        },
        onError: (error) => {
          if (error instanceof ApiError && error.fieldErrors) {
            setFieldErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([k, code]) => [k, tFields.has(code) ? tFields(code) : tFields("invalid")])));
          }
          haptics.warning();
        },
      },
    );
  };

  const submitError = start.error && !(start.error instanceof ApiError && start.error.fieldErrors) ? errorText(start.error) : null;
  const recentItems = recent.data?.items ?? [];
  const exampleText = useMemo(
    () => (key: string, field: "label" | "scenario", fallback: string) => (tExamples.has(`${key}.${field}`) ? tExamples(`${key}.${field}`) : fallback),
    [tExamples],
  );

  return (
    <Screen edges={["top"]} onRefresh={() => void Promise.all([recent.refetch(), me.refetch()])} refreshing={recent.isRefetching}>
      <TabTitle title={tApp("title")} me={me.data} subtitle={t("subtitle")} />
      <OfflineBanner />
      <DemoBanner me={me.data} />
      {me.data?.user.isGuest ? <Banner tone="info" body={t("guestNote")} /> : null}
      {liveBlocked ? (
        <Banner
          tone="warn"
          title={t("liveNotConfiguredTitle")}
          body={t("liveNotConfiguredBody")}
          action={
            me.data?.capabilities.canSwitchWorkspace ? (
              <Button size="sm" variant="secondary" label={t("switchToDemo")} loading={setWorkspace.isPending} onPress={() => setWorkspace.mutate("demo")} />
            ) : null
          }
        />
      ) : null}

      <Card style={styles.form}>
        <Field
          label={t("fullName")}
          placeholder={t("fullNamePlaceholder")}
          hint={t("fullNameHint")}
          value={form.fullName}
          onChangeText={update("fullName")}
          error={fieldErrors.fullName || null}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType={showContext ? "next" : "search"}
          onSubmitEditing={() => (showContext ? companyRef.current?.focus() : submit())}
          testID="full-name"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showContext }}
          onPress={() => setShowContext((v) => !v)}
          style={styles.disclosure}
          hitSlop={8}
        >
          <View style={styles.flex}>
            <Text variant="subhead" tone="accent">
              {t("advanced")}
            </Text>
            <Text variant="footnote" tone="muted">
              {t("advancedHint")}
            </Text>
          </View>
          {showContext ? <ChevronUp size={18} color={colors.accent} /> : <ChevronDown size={18} color={colors.accent} />}
        </Pressable>
        {showContext ? (
          <View style={styles.context}>
            <Field ref={companyRef} label={t("company")} placeholder={t("companyPlaceholder")} value={form.company} onChangeText={update("company")} error={fieldErrors.company || null} autoCorrect={false} />
            <Field label={t("country")} placeholder={t("countryPlaceholder")} value={form.country} onChangeText={update("country")} error={fieldErrors.country || null} />
            <Field
              label={t("profileUrl")}
              placeholder={t("profileUrlPlaceholder")}
              hint={t("profileUrlHint")}
              value={form.profileUrl}
              onChangeText={update("profileUrl")}
              error={fieldErrors.profileUrl || null}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="search"
              onSubmitEditing={submit}
            />
          </View>
        ) : null}
        {submitError ? <Banner tone="danger" title={submitError.title} body={submitError.body} /> : null}
        {!online ? (
          <Text variant="footnote" tone="warn">
            {tApp("offlineNoResearch")}
          </Text>
        ) : null}
        <Button
          label={t("submit")}
          loadingLabel={t("submitting")}
          loading={start.isPending}
          disabled={!online || liveBlocked || start.isPending}
          onPress={submit}
          testID="start-research"
        />
        <Text variant="footnote" tone="muted">
          {t("privacyNote")}
        </Text>
      </Card>

      {isDemo && examples.data ? (
        <View style={styles.section}>
          <SectionHeader title={t("examplesTitle")} hint={t("examplesBody")} />
          <ListGroup>
            {examples.data.items.map((ex) => (
              <Row
                key={ex.key}
                left={<Sparkles size={18} color={colors.demo} />}
                title={`${exampleText(ex.key, "label", ex.label)} · ${ex.fullName}`}
                subtitle={exampleText(ex.key, "scenario", ex.scenario)}
                onPress={() => {
                  setForm({ fullName: ex.fullName, company: ex.company ?? "", country: ex.country ?? "", profileUrl: ex.profileUrl ?? "" });
                  setShowContext(Boolean(ex.company || ex.country || ex.profileUrl));
                  keyRef.current = newIdempotencyKey();
                }}
                accessibilityHint={tApp("exampleHint")}
              />
            ))}
          </ListGroup>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title={t("recentTitle")} />
        {recentItems.length === 0 ? (
          <Text variant="footnote" tone="muted" style={styles.empty}>
            {t("recentEmpty")}
          </Text>
        ) : (
          <ListGroup>
            {recentItems.map((r) => (
              <Row
                key={r.jobId}
                left={<History size={18} color={colors.muted} />}
                title={r.fullName}
                subtitle={[r.company, dates.dateTime(r.createdAt, "dateTime")].filter(Boolean).join(" · ")}
                right={<JobStatusBadge status={r.status} />}
                chevron={false}
                onPress={() =>
                  r.profileId && (r.status === "completed" || r.status === "partial")
                    ? router.push({ pathname: "/profile/[profileId]", params: { profileId: r.profileId } })
                    : router.push({ pathname: "/research/[jobId]", params: { jobId: r.jobId } })
                }
              />
            ))}
          </ListGroup>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: SPACE.lg },
  disclosure: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: 44 },
  context: { gap: SPACE.lg },
  flex: { flex: 1 },
  section: { gap: SPACE.md },
  empty: { paddingHorizontal: SPACE.xs },
});
