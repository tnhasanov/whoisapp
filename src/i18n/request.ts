import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { getViewer } from "@/lib/auth/session";
import { DEFAULT_TIMEZONE, LOCALES, type Locale } from "@/lib/domain/types";

export const LOCALE_COOKIE = "pb_locale";

function isLocale(value: string | undefined): value is Locale {
  return Boolean(value && (LOCALES as readonly string[]).includes(value));
}

export default getRequestConfig(async () => {
  const viewer = await getViewer().catch(() => null);
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = viewer?.locale ?? (isLocale(cookieLocale) ? cookieLocale : "en");
  return {
    locale,
    timeZone: viewer?.timezone ?? DEFAULT_TIMEZONE,
    now: new Date(),
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
