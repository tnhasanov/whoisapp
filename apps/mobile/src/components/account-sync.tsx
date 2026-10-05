import { useEffect } from "react";
import { useLocaleState } from "@/lib/i18n";
import { useMe } from "@/lib/queries";

/**
 * Keeps the interface language and time zone in step with the account, so a
 * change made on the website (or another phone) applies here on next refresh.
 */
export function AccountSync() {
  const me = useMe();
  const { applyAccount } = useLocaleState();
  const locale = me.data?.preferences.locale;
  const timezone = me.data?.preferences.timezone;
  useEffect(() => {
    if (locale && timezone) applyAccount({ locale, timezone });
  }, [locale, timezone, applyAccount]);
  return null;
}
