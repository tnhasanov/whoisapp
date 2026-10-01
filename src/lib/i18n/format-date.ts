/**
 * Locale-safe date formatting. Browsers do not all ship Azerbaijani calendar
 * data (Chromium falls back to "2026 M10 1"), and a mismatch between the
 * server and browser output also breaks hydration. Azerbaijani is therefore
 * formatted from numeric parts with built-in month names; other languages use
 * Intl directly. Times are always shown in the viewer's time zone.
 */

export type DateStyle = "date" | "dateTime" | "dateShort" | "time" | "timeSeconds" | "monthYear";

export const AZ_MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"];
export const AZ_MONTHS_LONG = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];

const OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  date: { dateStyle: "medium" },
  dateTime: { dateStyle: "medium", timeStyle: "short" },
  dateShort: { dateStyle: "short" },
  time: { timeStyle: "short" },
  timeSeconds: { timeStyle: "medium" },
  monthYear: { year: "numeric", month: "long" },
};

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function isAzerbaijani(locale: string): boolean {
  return /^az(\b|-|_)/i.test(locale) || locale.toLowerCase() === "az";
}

export function formatDateTime(value: Date | string | number, locale: string, timeZone: string, style: DateStyle = "date"): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  if (!isAzerbaijani(locale)) return new Intl.DateTimeFormat(locale, { ...OPTIONS[style], timeZone }).format(date);
  const p = partsIn(date, timeZone);
  const day = `${p.day} ${AZ_MONTHS_SHORT[p.month - 1]} ${p.year}`;
  switch (style) {
    case "date":
      return day;
    case "dateTime":
      return `${day}, ${pad(p.hour)}:${pad(p.minute)}`;
    case "dateShort":
      return `${pad(p.day)}.${pad(p.month)}.${String(p.year).slice(-2)}`;
    case "time":
      return `${pad(p.hour)}:${pad(p.minute)}`;
    case "timeSeconds":
      return `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
    case "monthYear":
      return `${AZ_MONTHS_LONG[p.month - 1]} ${p.year}`;
  }
}
