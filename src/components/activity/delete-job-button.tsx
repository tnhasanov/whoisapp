"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { deleteJobAction } from "@/app/actions/research";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function DeleteJobButton({ jobId }: { jobId: string }) {
  const t = useTranslations("Activity");
  const tCommon = useTranslations("Common");
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      trigger={
        <button type="button" className={buttonClasses("ghost", "icon", "h-8 w-8")} aria-label={t("delete")} title={t("delete")} disabled={pending}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      }
      title={t("deleteTitle")}
      description={t("deleteBody")}
      confirmLabel={t("delete")}
      cancelLabel={tCommon("cancel")}
      destructive
      onConfirm={() => start(() => deleteJobAction(jobId))}
    />
  );
}
