"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Input, Label, Select } from "@/components/ui/field";
import type { TagView } from "@/lib/data/profiles";
import { cn } from "@/lib/utils";

export function LibraryFilters({ tags }: { tags: TagView[] }) {
  const t = useTranslations("Library");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [, start] = useTransition();
  const scope = params.get("scope") === "saved" ? "saved" : "all";

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    start(() => router.replace(`${pathname}?${next.toString()}`));
  };

  useEffect(() => {
    const id = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) update({ q: q || null });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label={t("title")} className="inline-grid grid-cols-2 rounded-md border border-line bg-sunken p-0.5">
        {(["all", "saved"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={scope === s}
            onClick={() => update({ scope: s === "saved" ? "saved" : null })}
            className={cn("h-8 rounded-[5px] px-4 text-[13px] font-medium", scope === s ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink")}
          >
            {s === "saved" ? t("saved") : t("all")}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <div className="relative">
          <Label htmlFor="lib-q" className="sr-only">
            {t("search")}
          </Label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input id="lib-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="pl-9" type="search" />
        </div>
        <div>
          <Label htmlFor="lib-sort" className="sr-only">
            {t("sort")}
          </Label>
          <Select id="lib-sort" value={params.get("sort") ?? "recent"} onChange={(e) => update({ sort: e.target.value === "recent" ? null : e.target.value })}>
            <option value="recent">{t("sortRecent")}</option>
            <option value="researched">{t("sortResearched")}</option>
            <option value="name">{t("sortName")}</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="lib-tag" className="sr-only">
            {t("tag")}
          </Label>
          <Select id="lib-tag" value={params.get("tag") ?? ""} onChange={(e) => update({ tag: e.target.value || null })}>
            <option value="">{t("allTags")}</option>
            {tags.map((tg) => (
              <option key={tg.id} value={tg.id}>
                {tg.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
