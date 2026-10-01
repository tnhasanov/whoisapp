"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { updatePreferencesAction, type SettingsState } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Field, FieldHint, Label, Select } from "@/components/ui/field";
import type { Locale } from "@/lib/domain/types";

const LANGS: Record<Locale, string> = { en: "English", az: "Azərbaycanca", ru: "Русский" };

export function PreferencesForm({ locale, timezone, theme, timezones }: { locale: Locale; timezone: string; theme: string; timezones: string[] }) {
  const t = useTranslations("Settings");
  const [state, action, pending] = useActionState<SettingsState, FormData>(updatePreferencesAction, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <Field>
        <Label htmlFor="locale">{t("language")}</Label>
        <Select id="locale" name="locale" defaultValue={locale}>
          {(Object.keys(LANGS) as Locale[]).map((l) => (
            <option key={l} value={l}>
              {LANGS[l]}
            </option>
          ))}
        </Select>
      </Field>
      <Field>
        <Label htmlFor="timezone">{t("timezone")}</Label>
        <Select id="timezone" name="timezone" defaultValue={timezone} aria-describedby="tz-hint">
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        <FieldHint id="tz-hint">{t("timezoneHint")}</FieldHint>
      </Field>
      <Field>
        <Label htmlFor="theme">{t("theme")}</Label>
        <Select id="theme" name="theme" defaultValue={theme}>
          {(["system", "light", "dark"] as const).map((th) => (
            <option key={th} value={th}>
              {t(`themes.${th}`)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex items-center gap-3 sm:col-span-3">
        <Button type="submit" disabled={pending}>
          {t("savePreferences")}
        </Button>
        {state?.ok ? <span role="status" className="text-sm text-ok">{t("savedNotice")}</span> : null}
      </div>
    </form>
  );
}
