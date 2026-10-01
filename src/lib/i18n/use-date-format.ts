"use client";

import { useLocale, useTimeZone } from "next-intl";
import { useCallback } from "react";
import { formatDateTime, type DateStyle } from "./format-date";

/** Client-side date formatting that matches the server output in every language. */
export function useDateFormat() {
  const locale = useLocale();
  const timeZone = useTimeZone() ?? "UTC";
  return useCallback((value: Date | string | number, style: DateStyle = "date") => formatDateTime(value, locale, timeZone, style), [locale, timeZone]);
}
