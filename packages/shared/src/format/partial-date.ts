import { AZ_MONTHS_SHORT, isAzerbaijani } from "./date";
import type { DatePrecision, PartialDate } from "../domain";

/**
 * Partial dates keep the precision the source actually gave. "2014" stays a
 * year; it is never widened to 2014-01-01 for display or comparison claims.
 */

const ISO_PARTIAL = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

export function parsePartialDate(input: string | null | undefined, approximate = false): PartialDate | null {
  if (!input) return null;
  const trimmed = input.trim();
  const iso = ISO_PARTIAL.exec(trimmed.slice(0, 10));
  let year: number | undefined;
  let month: number | null = null;
  let day: number | null = null;
  if (iso && (trimmed.length === 4 || trimmed.length === 7 || trimmed.length === 10 || trimmed[10] === "T" || trimmed[10] === " ")) {
    year = Number(iso[1]);
    month = iso[2] ? Number(iso[2]) : null;
    day = iso[3] ? Number(iso[3]) : null;
  } else {
    return null;
  }
  if (!year || year < 1900 || year > 2100) return null;
  if (month !== null && (month < 1 || month > 12)) return null;
  if (day !== null) {
    if (month === null) return null;
    const max = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day < 1 || day > max) return null;
  }
  return { year, month, day, approximate: approximate || undefined };
}

export function isValidPartialDateString(input: string | null | undefined): boolean {
  if (input === null || input === undefined) return true;
  return parsePartialDate(input) !== null && ISO_PARTIAL.test(input.trim());
}

export function precisionOf(date: PartialDate): DatePrecision {
  if (date.day) return "day";
  if (date.month) return "month";
  return "year";
}

/** ISO-like string at the date's own precision ("2014", "2014-06", "2014-06-03"). */
export function partialDateToString(date: PartialDate | null | undefined): string | null {
  if (!date) return null;
  const y = String(date.year).padStart(4, "0");
  if (!date.month) return y;
  const m = String(date.month).padStart(2, "0");
  if (!date.day) return `${y}-${m}`;
  return `${y}-${m}-${String(date.day).padStart(2, "0")}`;
}

/** Earliest instant the partial date could refer to (UTC). */
export function partialDateStart(date: PartialDate): Date {
  return new Date(Date.UTC(date.year, (date.month ?? 1) - 1, date.day ?? 1));
}

/** Latest instant the partial date could refer to (UTC, end of the period). */
export function partialDateEnd(date: PartialDate): Date {
  if (date.day) return new Date(Date.UTC(date.year, (date.month ?? 1) - 1, date.day, 23, 59, 59, 999));
  if (date.month) return new Date(Date.UTC(date.year, date.month, 0, 23, 59, 59, 999));
  return new Date(Date.UTC(date.year, 11, 31, 23, 59, 59, 999));
}

/**
 * Compare two partial dates. Returns null when the comparison is undecidable
 * at the shared precision (e.g. "2014" vs "2014-06").
 */
export function comparePartialDates(a: PartialDate, b: PartialDate): -1 | 0 | 1 | null {
  if (partialDateEnd(a) < partialDateStart(b)) return -1;
  if (partialDateEnd(b) < partialDateStart(a)) return 1;
  if (precisionOf(a) === precisionOf(b) && partialDateToString(a) === partialDateToString(b)) return 0;
  return null;
}

/** Equality at the coarser of the two precisions ("2014" equals "2014-06" for conflict purposes = compatible). */
export function partialDatesCompatible(a: PartialDate | null, b: PartialDate | null): boolean {
  if (!a || !b) return true;
  if (a.year !== b.year) return false;
  if (a.month && b.month && a.month !== b.month) return false;
  if (a.day && b.day && a.day !== b.day) return false;
  return true;
}

/** Sortable key; unknown dates sort last. */
export function partialDateSortKey(date: PartialDate | null | undefined): string {
  if (!date) return "9999-99-99";
  return `${String(date.year).padStart(4, "0")}-${String(date.month ?? 0).padStart(2, "0")}-${String(date.day ?? 0).padStart(2, "0")}`;
}

/** Months between two dates (approximate, for staleness checks). */
export function monthsBetween(from: Date, to: Date): number {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
}

/** Formats partial dates for people without inventing precision. */
export function formatPartialDate(
  date: PartialDate | null | undefined,
  locale: string,
  options: { unknownLabel?: string } = {},
): string {
  if (!date) return options.unknownLabel ?? "";
  const d = partialDateStart(date);
  const az = isAzerbaijani(locale);
  let text: string;
  if (date.day) {
    text = az
      ? `${date.day} ${AZ_MONTHS_SHORT[(date.month ?? 1) - 1]} ${date.year}`
      : new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(d);
  } else if (date.month) {
    text = az ? `${AZ_MONTHS_SHORT[date.month - 1]} ${date.year}` : new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", timeZone: "UTC" }).format(d);
  } else {
    text = String(date.year);
  }
  return date.approximate ? `${APPROXIMATE[locale.slice(0, 2).toLowerCase()] ?? "c."} ${text}` : text;
}

/** "circa" prefix for approximate dates. */
const APPROXIMATE: Record<string, string> = { en: "c.", az: "təq.", ru: "ок." };

export function formatPartialDateString(input: string | null | undefined, locale: string, unknownLabel = ""): string {
  return formatPartialDate(parsePartialDate(input), locale, { unknownLabel });
}
