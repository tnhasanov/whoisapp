import "server-only";
import { getLocale, getTimeZone } from "next-intl/server";
import { formatDateTime, type DateStyle } from "./format-date";

/** Server-side counterpart of useDateFormat(). */
export async function getDateFormat() {
  const [locale, timeZone] = await Promise.all([getLocale(), getTimeZone()]);
  return (value: Date | string | number, style: DateStyle = "date") => formatDateTime(value, locale, timeZone, style);
}
