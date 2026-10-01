import { comparePartialDates, formatPartialDateString } from "@/lib/dates/partial-date";
import type { Temporal } from "@/lib/domain/types";

type Translate = (key: "outdated" | "endBeforeStart" | "approximateStart", values?: Record<string, string>) => string;

/**
 * Uncertainty notes rebuilt from the stored dates so they appear in the
 * interface language. Returns null when there is nothing to qualify.
 */
export function uncertaintyText(temporal: Temporal, storedNote: string | null, locale: string, t: Translate): string | null {
  const notes: string[] = [];
  if (temporal.currency === "stated_current" && temporal.possiblyOutdated && temporal.asOf) {
    notes.push(t("outdated", { date: formatPartialDateString(temporal.asOf, locale) }));
  }
  if (temporal.start && temporal.end && comparePartialDates(temporal.end, temporal.start) === -1) notes.push(t("endBeforeStart"));
  if (temporal.start?.approximate) notes.push(t("approximateStart"));
  if (notes.length > 0) return notes.join(" ");
  // Older snapshots may carry a note that cannot be rebuilt from dates.
  return storedNote;
}
