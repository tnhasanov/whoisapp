import { Activity } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContainer, PageHeader } from "@/components/app-shell/app-shell";
import { DeleteJobButton } from "@/components/activity/delete-job-button";
import { JobStatusBadge } from "@/components/research/status-badge";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { requireViewer } from "@/lib/auth/session";
import { listJobs } from "@/lib/data/jobs";
import { getDb } from "@/lib/db/client";
import { getDateFormat } from "@/lib/i18n/date-format-server";

export async function generateMetadata() {
  return { title: (await getTranslations("Meta"))("activity") };
}
export const dynamic = "force-dynamic";

const TERMINAL = new Set(["completed", "partial", "failed", "cancelled"]);

export default async function ActivityPage() {
  const viewer = await requireViewer();
  const t = await getTranslations("Activity");
  const fmtDate = await getDateFormat();
  const jobs = await listJobs(getDb(), viewer.userId, viewer.workspace, 100);
  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="mt-6">
        {jobs.length === 0 ? (
          <EmptyState icon={<Activity className="h-6 w-6" aria-hidden />} title={t("empty")} action={<ButtonLink href="/search">{t("startResearch")}</ButtonLink>} />
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {jobs.map((j) => (
                <li key={j.id} className="flex items-center gap-3 p-4">
                  <Link href={`/research/${j.id}`} className="group min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[14.5px] font-medium text-ink group-hover:text-accent">{j.fullName}</span>
                      {j.company ? <span className="text-sm text-muted">· {j.company}</span> : null}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{fmtDate(j.createdAt, "dateTime")}</span>
                      <Badge tone="outline">{t(`kinds.${j.kind}` as "kinds.search")}</Badge>
                      {j.outcome === "no_candidates" || j.outcome === "refined" ? <Badge tone="outline">{t(`outcomes.${j.outcome}`)}</Badge> : null}
                    </span>
                  </Link>
                  <JobStatusBadge status={j.status} />
                  {TERMINAL.has(j.status) ? <DeleteJobButton jobId={j.id} /> : <span className="w-8" />}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
