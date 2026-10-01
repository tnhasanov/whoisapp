"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { reportIssueAction } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Field, Label, Select, Textarea } from "@/components/ui/field";
import { Callout } from "@/components/ui/feedback";
import { ISSUE_CATEGORIES } from "@/lib/domain/types";

export function ReportForm({ profileId, snapshotId, claimId, claimLabel }: { profileId: string; snapshotId: string | null; claimId: string | null; claimLabel: string | null }) {
  const t = useTranslations("Report");
  const [state, action, pending] = useActionState(reportIssueAction, undefined);
  if (state?.ok) return <Callout tone="ok">{t("submitted")}</Callout>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="profileId" value={profileId} />
      {snapshotId ? <input type="hidden" name="snapshotId" value={snapshotId} /> : null}
      {claimId ? <input type="hidden" name="claimId" value={claimId} /> : null}
      {claimLabel ? <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-ink-2">{claimLabel}</p> : null}
      <Field>
        <Label htmlFor="category">{t("category")}</Label>
        <Select id="category" name="category" defaultValue="incorrect">
          {ISSUE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field>
        <Label htmlFor="message">{t("message")}</Label>
        <Textarea id="message" name="message" required maxLength={2000} rows={5} />
      </Field>
      {state?.error ? <Callout tone="danger">{state.error}</Callout> : null}
      <Button type="submit" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
