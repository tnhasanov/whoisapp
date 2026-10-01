"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { setWorkspaceAction } from "@/app/actions/session";
import { Button } from "@/components/ui/button";

export function SwitchToDemoButton() {
  const t = useTranslations("Search");
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(() => setWorkspaceAction("demo"))}>
      {t("switchToDemo")}
    </Button>
  );
}
