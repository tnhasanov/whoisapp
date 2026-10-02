import { Clock } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageContainer, PageHeader } from "@/components/app-shell/app-shell";
import { InstallAppHint } from "@/components/pwa/install-app";
import { ExampleList } from "@/components/research/example-list";
import { SearchForm } from "@/components/research/search-form";
import { JobStatusBadge } from "@/components/research/status-badge";
import { SwitchToDemoButton } from "@/components/research/switch-to-demo";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { FIXTURE_EXAMPLES } from "@/fixtures/world";
import { requireViewer } from "@/lib/auth/session";
import { recentSearches } from "@/lib/data/jobs";
import { getDb } from "@/lib/db/client";
import { getProviderStatus } from "@/lib/env";
import { getEnv } from "@/lib/env";

export async function generateMetadata() {
  return { title: (await getTranslations("Meta"))("research") };
}

type Params = { name?: string; company?: string; country?: string; profileUrl?: string };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const t = await getTranslations("Search");
  const format = await getFormatter();
  const status = getProviderStatus();
  const recent = await recentSearches(getDb(), viewer.userId, viewer.workspace);
  const liveBlocked = viewer.workspace === "live" && !status.liveReady;
  const clip = (v: string | undefined, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);

  return (
    <PageContainer>
      <PageHeader eyebrow={viewer.workspace === "demo" ? t("demoEyebrow") : t("liveEyebrow")} title={t("title")} description={t("subtitle")} />
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {liveBlocked ? (
            <Callout
              tone="warn"
              title={t("liveNotConfiguredTitle")}
              action={
                <div className="flex flex-wrap gap-2">
                  <SwitchToDemoButton />
                  <ButtonLink href="/settings" variant="ghost" size="sm">
                    {t("openSettings")}
                  </ButtonLink>
                </div>
              }
            >
              {t("liveNotConfiguredBody")}
            </Callout>
          ) : null}
          {viewer.isGuest ? <Callout>{t("guestNote", { hours: getEnv().DEMO_GUEST_TTL_HOURS })}</Callout> : null}
          <Card className="p-5 sm:p-7">
            <SearchForm
              key={`${sp.name ?? ""}|${sp.company ?? ""}|${sp.profileUrl ?? ""}`}
              defaults={{ name: clip(sp.name, 120), company: clip(sp.company, 120), country: clip(sp.country, 60), profileUrl: clip(sp.profileUrl, 2048) }}
              disabled={liveBlocked}
            />
          </Card>
          <InstallAppHint />
        </div>
        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="label-caps">{t("recentTitle")}</h2>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t("recentEmpty")}</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {recent.map((r) => (
                  <li key={r.id}>
                    <Link href={r.profileId ? `/profiles/${r.profileId}` : `/research/${r.id}`} className="group flex items-start justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium text-ink group-hover:text-accent">{r.fullName}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                          <Clock className="h-3 w-3" aria-hidden />
                          {format.relativeTime(new Date(r.createdAt))}
                          {r.company ? <span className="truncate">· {r.company}</span> : null}
                        </span>
                      </span>
                      <JobStatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {FIXTURE_EXAMPLES.length > 0 ? (
            <Card className="p-5">
              <h2 className="label-caps">{t("examplesTitle")}</h2>
              <p className="mt-1.5 text-xs text-muted">{t("examplesBody")}</p>
              <div className="mt-1">
                <ExampleList examples={FIXTURE_EXAMPLES} />
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
    </PageContainer>
  );
}
