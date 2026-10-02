"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BrandMark, BrandWordmark } from "@/components/brand";
import type { Workspace } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { WorkspaceSwitch } from "./workspace-switch";

/**
 * Where "back" leads from a nested screen. The installed app has no browser
 * back button, so nested screens get one in the top bar.
 */
function parentOf(pathname: string): string | "history" | null {
  if (/^\/profiles\/[^/]+/.test(pathname)) return "/profiles";
  if (/^\/research\/[^/]+/.test(pathname)) return "/research";
  if (pathname.startsWith("/demo/")) return "history";
  if (pathname === "/data-use") return "/settings";
  return null;
}

export function MobileTopBar({ workspace, isOwner }: { workspace: Workspace; isOwner: boolean }) {
  const t = useTranslations("Common");
  const tNav = useTranslations("Nav");
  const pathname = usePathname();
  const router = useRouter();
  const parent = parentOf(pathname);
  return (
    <header className="pb-safe-top sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--canvas)_86%,transparent)] backdrop-blur-xl backdrop-saturate-150 lg:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-4">
        {parent ? (
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => (parent === "history" ? router.back() : router.push(parent))}
              className="-ml-1 inline-flex h-10 items-center gap-0.5 rounded-full pl-1 pr-3 text-[15px] font-medium text-accent active:bg-accent-soft"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden />
              {t("back")}
            </button>
            <Link href="/search" aria-label={tNav("home")} className="rounded-md p-1 active:opacity-70">
              <BrandMark className="h-6 w-6" />
            </Link>
          </div>
        ) : (
          <Link href="/search" aria-label={tNav("home")} className="pl-1 active:opacity-70">
            <BrandWordmark />
          </Link>
        )}
        <div className="w-40 shrink-0 sm:w-44">
          <WorkspaceSwitch workspace={workspace} isOwner={isOwner} compact />
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  return (
    <nav
      className="pb-safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
      aria-label={t("primary")}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 px-2">
        {NAV_ITEMS.map((item) => {
          const active = item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-accent" : "text-muted active:text-ink",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-[background-color,transform] duration-200 group-active:scale-90",
                    active ? "bg-accent-soft" : "bg-transparent",
                  )}
                >
                  <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.25 : 1.9} aria-hidden />
                </span>
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
