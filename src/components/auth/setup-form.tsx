"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { setupOwnerAction, type FormState } from "@/app/actions/session";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { Callout } from "@/components/ui/feedback";

export function SetupForm() {
  const t = useTranslations("Setup");
  const [state, action, pending] = useActionState<FormState, FormData>(setupOwnerAction, undefined);
  const err = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <Field>
        <Label htmlFor="token">{t("token")}</Label>
        <Input id="token" name="token" type="password" autoComplete="off" required aria-invalid={Boolean(err.token)} aria-describedby="token-hint token-error" />
        <FieldHint id="token-hint">{t("tokenHint")}</FieldHint>
        <FieldError id="token-error">{err.token}</FieldError>
      </Field>
      <Field>
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" autoComplete="name" required />
      </Field>
      <Field>
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field>
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required aria-describedby="password-hint" />
        <FieldHint id="password-hint">{t("passwordHint")}</FieldHint>
      </Field>
      <Field>
        <Label htmlFor="confirm">{t("confirm")}</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required aria-invalid={Boolean(err.confirm)} aria-describedby="confirm-error" />
        <FieldError id="confirm-error">{err.confirm}</FieldError>
      </Field>
      {state?.error ? <Callout tone="danger">{state.error}</Callout> : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
