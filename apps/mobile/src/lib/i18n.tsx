import { getCalendars, getLocales } from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { IntlProvider, useLocale, useTimeZone } from "use-intl";
import webAz from "@personbrief/messages/az.json";
import webEn from "@personbrief/messages/en.json";
import webRu from "@personbrief/messages/ru.json";
import { DEFAULT_TIMEZONE, LOCALES, type Locale, type PartialDate } from "@personbrief/shared/domain";
import { formatDateTime, type DateStyle } from "@personbrief/shared/format/date";
import { formatPartialDate, formatPartialDateString } from "@personbrief/shared/format/partial-date";
import appAz from "../i18n/az.json";
import appEn from "../i18n/en.json";
import appRu from "../i18n/ru.json";
import { deviceStorage, PREF } from "./storage";

/**
 * English, Azerbaijani and Russian. The website's catalogues (evidence labels,
 * contact types, statuses, errors…) are reused as they are; app-only text
 * lives in the "App" namespace (src/i18n/*.json).
 */

/** Website-only namespaces (owner setup, PWA install, PDF layout, page titles) are left out of the app. */
const WEB_ONLY = new Set(["Setup", "Install", "Pdf", "Meta", "Nav"]);
function forApp(web: Record<string, unknown>, app: Record<string, unknown>) {
  return { ...Object.fromEntries(Object.entries(web).filter(([ns]) => !WEB_ONLY.has(ns))), App: app };
}

export const MESSAGES: Record<Locale, Record<string, unknown>> = {
  en: forApp(webEn, appEn),
  az: forApp(webAz, appAz),
  ru: forApp(webRu, appRu),
};

export const LOCALE_NAMES: Record<Locale, string> = { en: "English", az: "Azərbaycanca", ru: "Русский" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function deviceLocale(): Locale {
  for (const l of getLocales()) {
    if (isLocale(l.languageCode)) return l.languageCode;
  }
  return "en";
}

export function deviceTimeZone(): string | null {
  return getCalendars()[0]?.timeZone ?? null;
}

type LocaleState = {
  locale: Locale;
  timeZone: string;
  /** Device-level choice used before sign-in; the account's language wins afterwards. */
  setDeviceLocale: (locale: Locale) => void;
  /** Apply the signed-in account's preferences (null when signed out). */
  applyAccount: (prefs: { locale: Locale; timezone: string } | null) => void;
};

const LocaleContext = createContext<LocaleState | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [deviceChoice, setDeviceChoice] = useState<Locale | null>(null);
  const [account, setAccount] = useState<{ locale: Locale; timezone: string } | null>(null);

  useEffect(() => {
    void deviceStorage.get(PREF.locale).then((value) => {
      if (isLocale(value)) setDeviceChoice(value);
    });
  }, []);

  const locale = account?.locale ?? deviceChoice ?? deviceLocale();
  const timeZone = account?.timezone ?? DEFAULT_TIMEZONE;

  const setDeviceLocale = useCallback((next: Locale) => {
    setDeviceChoice(next);
    void deviceStorage.set(PREF.locale, next);
  }, []);
  const applyAccount = useCallback((prefs: { locale: Locale; timezone: string } | null) => {
    setAccount(prefs);
    if (prefs) void deviceStorage.set(PREF.locale, prefs.locale);
  }, []);

  const value = useMemo(() => ({ locale, timeZone, setDeviceLocale, applyAccount }), [locale, timeZone, setDeviceLocale, applyAccount]);

  return (
    <LocaleContext.Provider value={value}>
      <IntlProvider
        locale={locale}
        messages={MESSAGES[locale]}
        timeZone={timeZone}
        onError={(error) => {
          if (__DEV__) console.warn(`[i18n] ${error.message}`);
        }}
        getMessageFallback={({ key, namespace }) => {
          // Fall back to English, then to the key: never show a blank label.
          const path = [...(namespace ? namespace.split(".") : []), ...key.split(".")];
          let node: unknown = MESSAGES.en;
          for (const part of path) node = node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined;
          return typeof node === "string" ? node : key;
        }}
      >
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
}

export function useLocaleState(): LocaleState {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocaleState must be used inside I18nProvider");
  return value;
}

/** Dates in the account's language and time zone (stored in UTC on the server). */
export function useDates() {
  const locale = useLocale();
  const timeZone = useTimeZone() ?? DEFAULT_TIMEZONE;
  return useMemo(
    () => ({
      dateTime: (value: string | number | Date, style: DateStyle = "date") => safeFormat(value, locale, timeZone, style),
      partial: (date: PartialDate | null | undefined, unknownLabel?: string) => formatPartialDate(date, locale, { unknownLabel }),
      partialString: (value: string | null | undefined, unknownLabel = "") => formatPartialDateString(value, locale, unknownLabel),
      locale,
      timeZone,
    }),
    [locale, timeZone],
  );
}

function safeFormat(value: string | number | Date, locale: string, timeZone: string, style: DateStyle): string {
  try {
    return formatDateTime(value, locale, timeZone, style);
  } catch {
    // Engines without full Intl support: an unambiguous numeric date in UTC.
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, style === "date" || style === "dateShort" ? 10 : 16).replace("T", " ");
  }
}

/** "4:05" or "1 h 12 min" for elapsed research time (no progress percentages anywhere). */
export function formatElapsed(ms: number, t: (key: string, values: Record<string, number | string>) => string): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return t("durationHours", { hours, minutes });
  return t("durationMinutes", { minutes, seconds: String(seconds).padStart(2, "0") });
}
