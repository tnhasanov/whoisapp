"use client";

import { FlaskConical, Radar } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { setWorkspaceAction } from "@/app/actions/session";
import type { Workspace } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function WorkspaceSwitch({ workspace, isOwner, compact = false }: { workspace: Workspace; isOwner: boolean; compact?: boolean }) {
  const t = useTranslations("Workspace");
  const [pending, start] = useTransition();
  if (!isOwner) {
    return (
      <div className={cn("flex items-center justify-between gap-2 rounded-md border border-demo-line bg-demo-soft px-2.5", compact ? "h-8" : "h-9")}>
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-demo">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
          {t("demoShort")}
        </span>
        <Link href="/sign-in" className="text-[11.5px] font-medium text-demo underline-offset-2 hover:underline">
          {t("ownerSignIn")}
        </Link>
      </div>
    );
  }
  const options: { value: Workspace; label: string; icon: typeof Radar }[] = [
    { value: "live", label: t("live"), icon: Radar },
    { value: "demo", label: t("demo"), icon: FlaskConical },
  ];
  return (
    <div role="radiogroup" aria-label={t("label")} className={cn("grid grid-cols-2 rounded-md border border-line bg-sunken p-0.5", pending && "opacity-70")}>
      {options.map((o) => {
        const active = workspace === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={pending}
            onClick={() => !active && start(() => setWorkspaceAction(o.value))}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-[5px] text-[12px] font-medium transition-colors",
              compact ? "h-7" : "h-8",
              active
                ? o.value === "demo"
                  ? "bg-demo-soft text-demo shadow-sm ring-1 ring-demo-line"
                  : "bg-surface text-ink shadow-sm ring-1 ring-line"
                : "text-muted hover:text-ink",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
