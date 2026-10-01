"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocaleCookieAction } from "@/app/actions/session";
import type { Locale } from "@/lib/domain/types";

const LABELS: Record<Locale, string> = { en: "English", az: "Azərbaycanca", ru: "Русский" };

export function LanguagePicker() {
  const t = useTranslations("Auth");
  const locale = useLocale() as Locale;
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2 text-[13px] text-muted">
      <Languages className="h-4 w-4" aria-hidden />
      <span className="sr-only">{t("language")}</span>
      <select
        className="h-8 rounded-md border border-line bg-surface px-2 text-[13px] text-ink"
        value={locale}
        disabled={pending}
        onChange={(e) => start(() => setLocaleCookieAction(e.target.value as Locale))}
      >
        {(Object.keys(LABELS) as Locale[]).map((l) => (
          <option key={l} value={l}>
            {LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
