"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { signInAction, startDemoAction, type FormState } from "@/app/actions/session";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input, Label } from "@/components/ui/field";
import { Callout } from "@/components/ui/feedback";

export function SignInForm({ next }: { next: string | null }) {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState<FormState, FormData>(signInAction, undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field>
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required inputSize="lg" />
      </Field>
      <Field>
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required inputSize="lg" />
      </Field>
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}

export function DemoEntry() {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState<FormState, FormData>(async () => startDemoAction(), undefined);
  return (
    <form action={action}>
      <Button type="submit" variant="secondary" size="lg" className="w-full border-demo-line" disabled={pending}>
        {t("demoButton")}
      </Button>
      {state?.error ? (
        <Callout tone="danger" className="mt-3">
          {state.error}
        </Callout>
      ) : null}
    </form>
  );
}
