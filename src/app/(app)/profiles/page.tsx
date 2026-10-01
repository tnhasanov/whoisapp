import { BookmarkCheck, BookUser, Tag } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/app-shell/app-shell";
import { LibraryFilters } from "@/components/library/library-filters";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { requireViewer } from "@/lib/auth/session";
import { listProfiles, listTags } from "@/lib/data/profiles";
import { getDb } from "@/lib/db/client";
import { initials } from "@/lib/names";
import { getDateFormat } from "@/lib/i18n/date-format-server";

export async function generateMetadata() {
  return { title: (await getTranslations("Meta"))("profiles") };
}
export const dynamic = "force-dynamic";

type Params = { q?: string; sort?: string; tag?: string; scope?: string };

export default async function ProfilesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const t = await getTranslations("Library");
  const fmtDate = await getDateFormat();
  const scope = sp.scope === "saved" ? "saved" : "all";
  const sort = sp.sort === "name" || sp.sort === "researched" ? sp.sort : "recent";
  const tagId = sp.tag && /^[0-9a-f-]{36}$/i.test(sp.tag) ? sp.tag : null;
  const db = getDb();
  const [items, tags] = await Promise.all([
    listProfiles(db, viewer.userId, viewer.workspace, { q: sp.q?.slice(0, 120) ?? null, sort, tagId, scope }),
    listTags(db, viewer.userId, viewer.workspace),
  ]);
  const filtered = Boolean(sp.q || tagId);

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("subtitle")} actions={<ButtonLink href="/search">{t("startResearch")}</ButtonLink>} />
      <div className="mt-6">
        <Suspense>
          <LibraryFilters tags={tags} />
        </Suspense>
      </div>
      <div className="mt-6">
        {items.length === 0 ? (
          <EmptyState
            icon={scope === "saved" ? <BookmarkCheck className="h-6 w-6" aria-hidden /> : <BookUser className="h-6 w-6" aria-hidden />}
            title={filtered ? t("noResults") : scope === "saved" ? t("emptySaved") : t("empty")}
            action={!filtered ? <ButtonLink href={scope === "saved" ? "/profiles?scope=all" : "/search"} variant="secondary">{scope === "saved" ? t("all") : t("startResearch")}</ButtonLink> : undefined}
          >
            {filtered ? null : scope === "saved" ? t("emptySavedBody") : t("emptyBody")}
          </EmptyState>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {items.map((p) => (
                <li key={p.id}>
                  <Link href={`/profiles/${p.id}`} className="group flex gap-4 p-4 hover:bg-surface-2 sm:items-center">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft font-serif text-[15px] font-semibold text-accent-ink" aria-hidden>
                      {initials(p.displayName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-serif text-[17px] font-semibold text-ink group-hover:text-accent">{p.displayName}</span>
                        {p.nativeName && p.nativeName !== p.displayName ? <span className="text-sm text-muted">{p.nativeName}</span> : null}
                        {p.savedAt ? <BookmarkCheck className="h-4 w-4 text-accent" aria-label={t("saved")} /> : null}
                        {p.latestStatus === "partial" ? <Badge tone="warn">{t("partial")}</Badge> : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[13.5px] text-ink-2">{[p.headlineRole, p.headlineOrganisation].filter(Boolean).join(" · ") || "—"}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        {p.lastResearchedAt ? <span>{t("lastResearched", { date: fmtDate(p.lastResearchedAt, "date") })}</span> : null}
                        <span>{t("snapshots", { count: p.snapshotCount })}</span>
                        {p.tags.map((tg) => (
                          <span key={tg.id} className="inline-flex items-center gap-1 rounded-full bg-slate-soft px-2 py-0.5 text-[11.5px] text-ink-2">
                            <Tag className="h-3 w-3" aria-hidden />
                            {tg.name}
                          </span>
                        ))}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
