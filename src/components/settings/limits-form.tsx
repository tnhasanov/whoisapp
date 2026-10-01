"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { updateLimitsAction, type SettingsState } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Field, FieldHint, Input, Label } from "@/components/ui/field";

type Limits = { maxSearchQueries: number; maxResultsPerQuery: number; maxExtractPages: number; maxModelCalls: number; includeNews: boolean; newsWindowMonths: number };

export function LimitsForm({ current, caps }: { current: Limits; caps: Omit<Limits, "includeNews" | "newsWindowMonths"> }) {
  const t = useTranslations("Settings");
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateLimitsAction, undefined);
  const field = (name: keyof typeof caps, min: number) => (
    <Field key={name}>
      <Label htmlFor={name}>{t(name)}</Label>
      <Input id={name} name={name} type="number" min={min} max={caps[name]} defaultValue={current[name]} aria-describedby={`${name}-cap`} />
      <FieldHint id={`${name}-cap`}>{t("serverCap", { value: caps[name] })}</FieldHint>
    </Field>
  );
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {field("maxSearchQueries", 4)}
      {field("maxResultsPerQuery", 1)}
      {field("maxExtractPages", 0)}
      {field("maxModelCalls", 3)}
      <Field>
        <Label htmlFor="newsWindowMonths">{t("newsWindowMonths")}</Label>
        <Input id="newsWindowMonths" name="newsWindowMonths" type="number" min={1} max={120} defaultValue={current.newsWindowMonths} />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink-2">
        <input type="checkbox" name="includeNews" defaultChecked={current.includeNews} className="h-4 w-4 accent-[var(--accent)]" />
        {t("includeNews")}
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="secondary" disabled={pending}>
          {t("saveLimits")}
        </Button>
        {state?.ok ? <span role="status" className="text-sm text-ok">{t("savedNotice")}</span> : null}
      </div>
    </form>
  );
}
