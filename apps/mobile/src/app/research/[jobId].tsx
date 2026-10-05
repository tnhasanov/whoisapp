import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CircleAlert, Clock, FlaskConical, RotateCcw, Users } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import type { JobDetail } from "@personbrief/shared/api/v1";
import { identityReason } from "@personbrief/shared/format/identity";
import { CandidateCard } from "@/components/research/candidate-card";
import { StageList } from "@/components/research/stages";
import { JobStatusBadge } from "@/components/research/status";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/list";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState, OfflineBanner, useErrorText, useOnline } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { haptics, newIdempotencyKey } from "@/lib/actions";
import { formatElapsed, useDates } from "@/lib/i18n";
import { useCancelJob, useJob, useRefine, useReopenIdentity, useRetryJob, useSelectCandidate } from "@/lib/queries";
import { SPACE, useColors } from "@/lib/theme";

/**
 * C + D. Choose the person, and follow research progress. Everything shown is
 * the server's persisted state: leaving the screen, backgrounding or closing
 * the app does not affect the run, and returning shows where it is now.
 */
export default function ResearchScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const job = useJob(jobId);
  const t = useTranslations("Job");

  if (job.isPending) return <LoadingState />;
  if (job.isError && !job.data) {
    return (
      <Screen>
        <ErrorState error={job.error} onRetry={() => void job.refetch()} />
      </Screen>
    );
  }
  const data = job.data!;
  const name = data.query.fullName;
  const title =
    data.status === "awaiting_identity"
      ? t("titleIdentity", { name })
      : data.outcome === "no_candidates"
        ? t("titleNone")
        : data.status === "queued" || data.status === "running"
          ? t("titleRunning", { name })
          : t("titleDone", { name });
  return (
    <>
      <Stack.Screen options={{ title: name }} />
      <JobBody job={data} title={title} refreshing={job.isRefetching} onRefresh={() => void job.refetch()} />
    </>
  );
}

function useElapsed(job: JobDetail) {
  const [now, setNow] = useState(() => Date.now());
  const active = job.status === "queued" || job.status === "running";
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const startedAt = new Date(job.startedAt ?? job.createdAt).getTime();
  const end = job.finishedAt ? new Date(job.finishedAt).getTime() : now;
  return Math.max(0, end - startedAt);
}

function JobBody({ job, title, refreshing, onRefresh }: { job: JobDetail; title: string; refreshing: boolean; onRefresh: () => void }) {
  const t = useTranslations("Job");
  const tIdentity = useTranslations("Identity");
  const tMethods = useTranslations("Identity.methods");
  const tEvents = useTranslations("JobEvents");
  const tApp = useTranslations("App.research");
  const router = useRouter();
  const colors = useColors();
  const dates = useDates();
  const online = useOnline();
  const errorText = useErrorText();
  const elapsed = useElapsed(job);
  const select = useSelectCandidate(job.id);
  const refine = useRefine(job.id);
  const cancel = useCancelJob(job.id);
  const retry = useRetryJob(job.id);
  const reopen = useReopenIdentity(job.id);
  const retryKey = useRef(newIdempotencyKey());
  const reopenKey = useRef(newIdempotencyKey());
  const [choosing, setChoosing] = useState<string | null>(null);
  const previousStatus = useRef(job.status);

  // A gentle tap when the run finishes while the screen is open.
  useEffect(() => {
    if (previousStatus.current !== job.status) {
      if (job.status === "completed") haptics.success();
      if (job.status === "awaiting_identity" || job.status === "failed" || job.status === "partial") haptics.warning();
      previousStatus.current = job.status;
    }
  }, [job.status]);

  const active = job.status === "queued" || job.status === "running";
  const actionError = [select.error, refine.error, cancel.error, retry.error, reopen.error].find(Boolean);
  const eventText = (e: JobDetail["events"][number]) => {
    const key = e.code.replace(/\./g, "_");
    if (!tEvents.has(key)) return e.message;
    const data = e.data ?? {};
    try {
      return tEvents(key, { ...data, count: Array.isArray(data.variants) ? data.variants.length : ((data.count as number | undefined) ?? 0) } as Record<string, string | number>);
    } catch {
      return e.message;
    }
  };

  const confirmCancel = () =>
    Alert.alert(t("cancelConfirmTitle"), t("cancelConfirmBody"), [
      { text: t("keepRunning"), style: "cancel" },
      { text: t("cancel"), style: "destructive", onPress: () => cancel.mutate() },
    ]);

  const doRetry = () =>
    retry.mutate(retryKey.current, {
      onSuccess: ({ jobId }) => {
        retryKey.current = newIdempotencyKey();
        router.replace({ pathname: "/research/[jobId]", params: { jobId } });
      },
    });

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <OfflineBanner />
      <View style={styles.header}>
        <View style={styles.badges}>
          <JobStatusBadge status={job.status} outcome={job.outcome} />
          {job.workspace === "demo" ? <Badge tone="demo" label={t("demoBadge")} icon={<FlaskConical size={12} color={colors.demo} />} /> : null}
          {job.kind !== "search" ? <Badge tone="outline" label={job.kind === "refresh" ? tApp("kindRefresh") : tApp("kindRetry")} /> : null}
        </View>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {job.query.company || job.query.country ? (
          <Text variant="callout" tone="muted">
            {[job.query.company, job.query.country].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        <View style={styles.meta}>
          <Clock size={14} color={colors.muted} />
          <Text variant="footnote" tone="muted" accessibilityLiveRegion="none">
            {t("elapsed", { time: formatElapsed(elapsed, (key, values) => t(key, values)) })} · {dates.dateTime(job.createdAt, "dateTime")}
          </Text>
        </View>
      </View>

      {actionError ? <Banner tone="danger" title={errorText(actionError).title} body={errorText(actionError).body} /> : null}

      {job.retriedById ? (
        <Banner
          tone="info"
          body={t("retriedAs")}
          action={<Button size="sm" variant="secondary" label={t("openRetry")} onPress={() => router.replace({ pathname: "/research/[jobId]", params: { jobId: job.retriedById! } })} />}
        />
      ) : null}

      {/* Choose the person */}
      {job.status === "awaiting_identity" ? (
        <View style={styles.section}>
          <View style={styles.meta}>
            <Users size={16} color={colors.violet} />
            <Text variant="callout" tone="ink-2" style={styles.flex}>
              {tIdentity("subtitle", { count: job.candidates.length })}
            </Text>
          </View>
          {job.candidates.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              choosing={choosing === c.id && select.isPending}
              disabled={select.isPending || !online}
              onChoose={() => {
                setChoosing(c.id);
                select.mutate(c.id);
              }}
            />
          ))}
          <Card style={styles.section}>
            <Text variant="callout" tone="ink-2">
              {tIdentity("noneHint")}
            </Text>
            <Button
              variant="secondary"
              label={tIdentity("noneOfThese")}
              loading={refine.isPending}
              disabled={!online}
              onPress={() =>
                refine.mutate(undefined, {
                  onSuccess: ({ query }) =>
                    router.navigate({ pathname: "/", params: { name: query.fullName, company: query.company ?? "", country: query.country ?? "", profileUrl: query.profileUrl ?? "" } }),
                })
              }
            />
          </Card>
        </View>
      ) : null}

      {/* Outcomes */}
      {job.status === "completed" && job.profileId ? (
        <Card style={styles.section}>
          <Text variant="heading">{t("statusCompleted")}</Text>
          <Button label={t("viewProfile")} onPress={() => router.replace({ pathname: "/profile/[profileId]", params: { profileId: job.profileId! } })} />
        </Card>
      ) : null}
      {job.status === "partial" ? (
        <Banner
          tone="warn"
          title={t("statusPartial")}
          body={t("statusPartialBody")}
          action={
            <View style={styles.actions}>
              {job.profileId ? <Button size="sm" label={t("viewProfile")} onPress={() => router.replace({ pathname: "/profile/[profileId]", params: { profileId: job.profileId! } })} /> : null}
              {!job.retriedById ? <Button size="sm" variant="secondary" label={t("retry")} loading={retry.isPending} disabled={!online} onPress={doRetry} /> : null}
            </View>
          }
        />
      ) : null}
      {job.status === "failed" ? (
        <Banner
          tone="danger"
          title={t("statusFailed")}
          body={job.error?.message ?? t("retryHint")}
          action={!job.retriedById ? <Button size="sm" variant="secondary" label={t("retry")} icon={<RotateCcw size={14} color={colors.ink} />} loading={retry.isPending} disabled={!online} onPress={doRetry} /> : null}
        />
      ) : null}
      {job.status === "cancelled" && job.outcome !== "refined" ? (
        <Banner
          tone="info"
          title={t("statusCancelled")}
          body={t("statusCancelledBody")}
          action={!job.retriedById ? <Button size="sm" variant="secondary" label={t("retry")} loading={retry.isPending} disabled={!online} onPress={doRetry} /> : null}
        />
      ) : null}
      {job.outcome === "no_candidates" ? (
        <Banner
          tone="info"
          title={t("titleNone")}
          body={t("noCandidatesBody")}
          action={<Button size="sm" variant="secondary" label={t("refineSearch")} onPress={() => router.navigate({ pathname: "/", params: { name: job.query.fullName, company: job.query.company ?? "" } })} />}
        />
      ) : null}

      {/* How the identity was settled */}
      {job.identityResolution && job.status !== "awaiting_identity" ? (
        <Card style={styles.section}>
          <Text variant="label" tone="muted">
            {job.identityResolution.method === "user_selected" ? t("identityUser") : job.identityResolution.method === "refresh_existing_profile" ? t("identityRefresh") : t("identityAuto")}
          </Text>
          <Text variant="footnote" tone="ink-2">
            {identityReason(job.identityResolution as Parameters<typeof identityReason>[0], (key, values) => (tMethods.has(key) ? tMethods(key, values) : job.identityResolution!.reason))}
          </Text>
          {job.identityResolution.method.startsWith("auto_") && job.candidates.length > 1 ? (
            <Button
              size="sm"
              variant="ghost"
              label={t("chooseDifferent")}
              loading={reopen.isPending}
              disabled={!online}
              onPress={() =>
                reopen.mutate(reopenKey.current, {
                  onSuccess: ({ jobId }) => {
                    reopenKey.current = newIdempotencyKey();
                    router.replace({ pathname: "/research/[jobId]", params: { jobId } });
                  },
                })
              }
            />
          ) : null}
        </Card>
      ) : null}

      {/* Progress */}
      {active ? (
        <>
          {job.status === "queued" && !job.worker.online && (job.worker.queuedSeconds ?? 0) > 20 ? <Banner tone="warn" body={t("queuedNoWorker")} /> : null}
          {job.status === "queued" && (job.worker.online || (job.worker.queuedSeconds ?? 0) <= 20) ? <Banner tone="info" body={t("queuedWaiting")} /> : null}
          {job.status === "running" && (job.worker.heartbeatAgeSeconds ?? 0) > 60 ? (
            <Banner tone="warn" icon={<CircleAlert size={18} color={colors.warn} />} body={t("staleWarning", { seconds: job.worker.heartbeatAgeSeconds ?? 0 })} />
          ) : null}
        </>
      ) : null}

      <Card style={styles.section}>
        <View style={styles.stats}>
          <Stat label={t("statSources")} value={job.sources.total} />
          <Stat label={t("statRead")} value={job.sources.read} />
          <Stat label={t("statLimited")} value={job.sources.limited} />
        </View>
        <StageList stages={job.stages} />
        {active ? (
          <Text variant="footnote" tone="muted">
            {t("leaveNote")}
          </Text>
        ) : null}
        {active || job.status === "awaiting_identity" ? (
          <Button
            variant="danger"
            label={job.cancelRequested ? t("cancelling") : t("cancel")}
            disabled={job.cancelRequested || cancel.isPending || !online}
            loading={cancel.isPending}
            onPress={confirmCancel}
          />
        ) : null}
      </Card>

      <View style={styles.section}>
        <SectionHeader title={t("activity")} />
        <Card style={styles.events}>
          {job.events.length === 0 ? (
            <Text variant="footnote" tone="muted">
              {t("noEvents")}
            </Text>
          ) : (
            [...job.events].reverse().map((e) => (
              <View key={e.id} style={styles.event}>
                <Text variant="caption" tone="subtle" style={styles.eventTime}>
                  {dates.dateTime(e.at, "timeSeconds")}
                </Text>
                <Text variant="footnote" tone={e.level === "error" ? "danger" : e.level === "warn" ? "warn" : "ink-2"} style={styles.flex}>
                  {eventText(e)}
                </Text>
              </View>
            ))
          )}
        </Card>
      </View>

      {job.usage && job.workspace === "live" ? (
        <Text variant="caption" tone="muted">
          {t("usageDetail", { searches: job.usage.searchRequests, extracts: job.usage.extractRequests, calls: job.usage.modelCalls })} ·{" "}
          {t("usageEstimate", { cost: `$${job.usage.estimatedCostUsd.toFixed(2)}` })}
        </Text>
      ) : job.workspace === "demo" ? (
        <Text variant="caption" tone="muted">
          {t("usageDemo")}
        </Text>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="title">{String(value)}</Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: SPACE.sm },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  flex: { flex: 1 },
  section: { gap: SPACE.md },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  stats: { flexDirection: "row", justifyContent: "space-between" },
  stat: { flex: 1, gap: 2 },
  events: { gap: SPACE.sm },
  event: { flexDirection: "row", gap: SPACE.md, alignItems: "flex-start" },
  eventTime: { width: 64, paddingTop: 2 },
});
