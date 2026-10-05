import { useRouter } from "expo-router";
import { Newspaper } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import type { Claim, ProfileDetail } from "@personbrief/shared/api/v1";
import { partialDateSortKey } from "@personbrief/shared/format/partial-date";
import { haptics } from "@/lib/actions";
import { useDates } from "@/lib/i18n";
import { RADIUS, SPACE, useColors } from "@/lib/theme";
import { Badge, type BadgeTone } from "../ui/badge";
import { SectionHeader } from "../ui/list";
import { Text } from "../ui/text";

export type EvidenceKind = "claim" | "source" | "contact" | "account" | "relationship" | "media";

/** Opens the native evidence sheet for one item of the brief. */
export function useOpenEvidence(profile: ProfileDetail) {
  const router = useRouter();
  const latest = profile.snapshots[0]?.id === profile.snapshot.id;
  return (kind: EvidenceKind, id: string) => {
    haptics.select();
    router.push({ pathname: "/evidence", params: { profileId: profile.profile.id, snapshot: latest ? "" : profile.snapshot.id, kind, id } });
  };
}

const STATUS_TONE: Record<string, BadgeTone> = {
  multiple_sources: "ok",
  official_source: "accent",
  self_reported: "neutral",
  single_source: "neutral",
  snippet_only: "warn",
  conflicting: "danger",
  inferred: "violet",
};

/** Qualitative evidence label — never a score. */
export function EvidenceStatusBadge({ status }: { status: string }) {
  const t = useTranslations("Evidence.status");
  return <Badge tone={STATUS_TONE[status] ?? "neutral"} label={t.has(status) ? t(status) : status} />;
}

/** "[1] [3]" citation chips that open the evidence for a claim. */
export function CitationChips({ profile, claimIds, mediaIds = [] }: { profile: ProfileDetail; claimIds: string[]; mediaIds?: string[] }) {
  const open = useOpenEvidence(profile);
  const t = useTranslations("Overview");
  const colors = useColors();
  const chips: ReactNode[] = [];
  for (const id of claimIds) {
    const claim = profile.claims.find((c) => c.id === id);
    if (!claim) continue;
    const keys = claim.evidence.map((e) => profile.sources.find((s) => s.id === e.sourceId)?.key.replace(/^S/, "")).filter(Boolean);
    chips.push(
      <Pressable
        key={`c-${id}`}
        accessibilityRole="button"
        accessibilityLabel={t("evidenceFor", { claim: claim.displayValue })}
        hitSlop={8}
        onPress={() => open("claim", id)}
        style={[styles.chip, { backgroundColor: colors["accent-soft"] }]}
      >
        <Text variant="caption" tone="accent-ink">
          {keys.length > 0 ? keys.join(",") : "·"}
        </Text>
      </Pressable>,
    );
  }
  for (const id of mediaIds) {
    const item = profile.stories.flatMap((s) => s.items).find((i) => i.id === id);
    if (!item) continue;
    chips.push(
      <Pressable
        key={`m-${id}`}
        accessibilityRole="button"
        accessibilityLabel={`${item.outlet}: ${item.headline}`}
        hitSlop={8}
        onPress={() => open("media", id)}
        style={[styles.chip, { backgroundColor: colors["accent-soft"] }]}
      >
        <Newspaper size={11} color={colors["accent-ink"]} />
      </Pressable>,
    );
  }
  if (chips.length === 0) return null;
  return <View style={styles.chips}>{chips}</View>;
}

/** Period of a claim without inventing precision ("2019 – present", "stated as of May 2024"). */
export function usePeriodLabel() {
  const t = useTranslations("Common");
  const dates = useDates();
  return (c: Claim): string => {
    const start = dates.partial(c.temporal.start);
    const end = dates.partial(c.temporal.end);
    if (start && end) return `${start} – ${end}`;
    if (start && c.temporal.currency === "stated_current") return `${start} – ${t("present")}`;
    if (start) return `${start} – ?`;
    if (end) return t("until", { date: end });
    if (c.temporal.currency === "stated_current" && c.temporal.asOf) {
      return t(c.temporal.asOfBasis === "accessed" ? "asOfAccessed" : "asOf", { date: dates.partialString(c.temporal.asOf) });
    }
    return t("dateUnknown");
  };
}

/** Claims sharing a conflict group are shown together, most recent first. */
export function groupForTimeline(claims: Claim[]): Claim[][] {
  const groups = new Map<string, Claim[]>();
  for (const c of claims) {
    const key = c.conflictGroup ?? c.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  const known = (d: Claim["temporal"]["start"]) => (d ? partialDateSortKey(d) : "0000");
  const anchor = (g: Claim[]) => {
    const c = g[0];
    if (c.temporal.currency === "stated_current" && !c.temporal.end && !c.temporal.possiblyOutdated) return `9${known(c.temporal.start)}`;
    if (c.temporal.end) return known(c.temporal.end);
    if (c.temporal.currency === "stated_current" && c.temporal.asOf) return c.temporal.asOf;
    return known(c.temporal.start);
  };
  return [...groups.values()].sort((a, b) => anchor(b).localeCompare(anchor(a)));
}

/** A titled block of the brief. */
export function Block({ title, hint, children }: { title: string; hint?: string | null; children: ReactNode }) {
  return (
    <View style={styles.block}>
      <SectionHeader title={title} hint={hint} />
      {children}
    </View>
  );
}

export function EmptyLine({ text }: { text: string }) {
  const colors = useColors();
  return (
    <View style={[styles.emptyLine, { borderColor: colors.line }]}>
      <Text variant="footnote" tone="muted">
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  chip: { minWidth: 26, height: 22, paddingHorizontal: 6, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  block: { gap: SPACE.md },
  emptyLine: { borderWidth: StyleSheet.hairlineWidth, borderStyle: "dashed", borderRadius: RADIUS.md, padding: SPACE.lg },
});
