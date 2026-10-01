"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { BrandWordmark } from "@/components/brand";
import type { Workspace } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { WorkspaceSwitch } from "./workspace-switch";

export function MobileTopBar({ workspace, isOwner }: { workspace: Workspace; isOwner: boolean }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-[color-mix(in_srgb,var(--canvas)_92%,transparent)] px-4 backdrop-blur lg:hidden">
      <Link href="/search" aria-label="PersonBrief">
        <BrandWordmark />
      </Link>
      <div className="w-44">
        <WorkspaceSwitch workspace={workspace} isOwner={isOwner} compact />
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label={t("primary")}
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const active = item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active ? "text-accent" : "text-muted")}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
