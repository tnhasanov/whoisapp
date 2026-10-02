"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "overview", path: "" },
  { key: "contacts", path: "/contacts" },
  { key: "connections", path: "/connections" },
  { key: "news", path: "/news" },
  { key: "sources", path: "/sources" },
] as const;

export function ProfileTabs({ profileId }: { profileId: string }) {
  const t = useTranslations("Profile.tabs");
  const pathname = usePathname();
  const params = useSearchParams();
  const snapshot = params.get("snapshot");
  const suffix = snapshot ? `?snapshot=${snapshot}` : "";
  const base = `/profiles/${profileId}`;
  const list = useRef<HTMLUListElement>(null);
  // On narrow screens the tab row scrolls; keep the current tab in view.
  useEffect(() => {
    list.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);
  return (
    <nav
      aria-label={t("label")}
      className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 border-b border-line bg-[color-mix(in_srgb,var(--canvas)_90%,transparent)] px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10"
    >
      <ul ref={list} className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => {
          const href = `${base}${tab.path}`;
          const active = tab.path === "" ? pathname === base : pathname.startsWith(href);
          return (
            <li key={tab.key} className="shrink-0">
              <Link
                href={`${href}${suffix}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-12 items-center border-b-2 px-3 text-[14px] font-medium transition-colors active:text-ink sm:h-11 sm:text-[13.5px]",
                  active ? "border-accent text-ink" : "border-transparent text-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
