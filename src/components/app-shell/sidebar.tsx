"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { signOutAction } from "@/app/actions/session";
import { BrandWordmark } from "@/components/brand";
import type { Workspace } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { WorkspaceSwitch } from "./workspace-switch";

export function Sidebar({ workspace, isOwner, name, email }: { workspace: Workspace; isOwner: boolean; name: string; email: string }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface-2 lg:flex" aria-label={t("primary")}>
      <div className="px-5 pb-4 pt-5">
        <Link href="/search" className="rounded-md" aria-label={t("home")}>
          <BrandWordmark />
        </Link>
      </div>
      <div className="px-3 pb-3">
        <WorkspaceSwitch workspace={workspace} isOwner={isOwner} />
      </div>
      <nav className="flex-1 px-3" aria-label={t("primary")}>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] font-medium transition-colors",
                    active ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:bg-sunken hover:text-ink",
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-accent" : "")} aria-hidden />
                  {t(item.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="space-y-1 border-t border-line px-3 py-3">
        <Link
          href="/data-use"
          className="flex h-8 items-center gap-2 rounded-md px-2.5 text-[12.5px] text-muted hover:bg-sunken hover:text-ink"
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          {t("dataUse")}
        </Link>
        <div className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5">
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium text-ink-2">{name}</p>
            <p className="truncate text-[11.5px] text-subtle">{isOwner ? email : t("guest")}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-ink"
              aria-label={t("signOut")}
              title={t("signOut")}
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
