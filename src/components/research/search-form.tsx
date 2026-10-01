"use client";

import { ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useId, useState } from "react";
import { startResearchAction, type ResearchFormState } from "@/app/actions/research";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { Callout } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

export type SearchDefaults = { name?: string; company?: string; country?: string; profileUrl?: string };

export function SearchForm({ defaults, disabled }: { defaults: SearchDefaults; disabled?: boolean }) {
  const t = useTranslations("Search");
  const [state, action, pending] = useActionState<ResearchFormState, FormData>(startResearchAction, undefined);
  const hasAdvanced = Boolean(defaults.company || defaults.country || defaults.profileUrl);
  const [open, setOpen] = useState(hasAdvanced);
  // One key per form instance: double clicks and resubmits map to the same research run.
  const [idempotencyKey] = useState(() => crypto.randomUUID().replace(/-/g, ""));
  const advancedId = useId();
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <Field>
        <Label htmlFor="fullName" className="text-[14px] text-ink">
          {t("fullName")}
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle" aria-hidden />
          <Input
            id="fullName"
            name="fullName"
            inputSize="lg"
            required
            autoFocus
            maxLength={120}
            defaultValue={defaults.name}
            placeholder={t("fullNamePlaceholder")}
            aria-invalid={Boolean(fe.fullName)}
            aria-describedby="fullName-hint fullName-error"
            className="pl-11 text-[17px]"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <FieldHint id="fullName-hint">{t("fullNameHint")}</FieldHint>
        <FieldError id="fullName-error">{fe.fullName}</FieldError>
      </Field>

      <div className="rounded-lg border border-line bg-surface-2">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left"
          aria-expanded={open}
          aria-controls={advancedId}
          onClick={() => setOpen((v) => !v)}
        >
          <span>
            <span className="block text-[13.5px] font-medium text-ink">{t("advanced")}</span>
            <span className="block text-xs text-muted">{t("advancedHint")}</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        <div id={advancedId} hidden={!open} className="grid gap-4 border-t border-line px-4 pb-4 pt-4 sm:grid-cols-2">
          <Field>
            <Label htmlFor="company">{t("company")}</Label>
            <Input id="company" name="company" maxLength={120} defaultValue={defaults.company} placeholder={t("companyPlaceholder")} autoComplete="organization" />
          </Field>
          <Field>
            <Label htmlFor="country">{t("country")}</Label>
            <Input id="country" name="country" maxLength={60} defaultValue={defaults.country} placeholder={t("countryPlaceholder")} autoComplete="country-name" />
          </Field>
          <Field className="sm:col-span-2">
            <Label htmlFor="profileUrl">{t("profileUrl")}</Label>
            <Input
              id="profileUrl"
              name="profileUrl"
              type="url"
              inputMode="url"
              maxLength={2048}
              defaultValue={defaults.profileUrl}
              placeholder={t("profileUrlPlaceholder")}
              aria-invalid={Boolean(fe.profileUrl)}
              aria-describedby="profileUrl-hint profileUrl-error"
            />
            <FieldHint id="profileUrl-hint">{t("profileUrlHint")}</FieldHint>
            <FieldError id="profileUrl-error">{fe.profileUrl}</FieldError>
          </Field>
        </div>
      </div>

      {state?.error && !Object.keys(fe).length ? <Callout tone="danger">{state.error}</Callout> : null}

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">{t("privacyNote")}</p>
        <Button type="submit" size="lg" disabled={pending || disabled} className="sm:min-w-44">
          {pending ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
