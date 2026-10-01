import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContainer, PageHeader } from "@/components/app-shell/app-shell";
import { ReportForm } from "@/components/profile/report-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { loadProfile } from "@/lib/data/profile-loader";
import { listIssues } from "@/lib/data/profiles";
import { getDb } from "@/lib/db/client";
import { getDateFormat } from "@/lib/i18n/date-format-server";

export async function generateMetadata() {
  return { title: (await getTranslations("Meta"))("report") };
}
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ profileId: string }>; searchParams: Promise<{ snapshot?: string; claim?: string }> };

export default async function ReportPage({ params, searchParams }: Props) {
  const { profileId } = await params;
  const sp = await searchParams;
  const { viewer, view } = await loadProfile(profileId, sp.snapshot ?? null);
  const t = await getTranslations("Report");
  const fmtDate = await getDateFormat();
  const claim = sp.claim ? view.claims.find((c) => c.id === sp.claim) : null;
  const issues = await listIssues(getDb(), viewer.userId, view.profile.id);
  return (
    <PageContainer>
      <Link href={`/profiles/${view.profile.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {view.profile.displayName}
      </Link>
      <div className="mt-4">
        <PageHeader title={t("title")} description={t("subtitle")} />
      </div>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-5">
          <ReportForm profileId={view.profile.id} snapshotId={view.snapshot.id} claimId={claim?.id ?? null} claimLabel={claim?.displayValue ?? null} />
        </Card>
        <Card className="p-5">
          <h2 className="label-caps">{t("existing")}</h2>
          <ul className="mt-3 space-y-3">
            {issues.length === 0 ? <li className="text-sm text-muted">—</li> : null}
            {issues.map((i) => (
              <li key={i.id} className="text-[13px]">
                <div className="flex items-center gap-2">
                  <Badge tone="warn">{t(`categories.${i.category}`)}</Badge>
                  <span className="text-xs text-muted">{fmtDate(i.createdAt, "date")}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-ink-2">{i.message}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </PageContainer>
  );
}
