import { notFound } from "next/navigation";
import { PageContainer } from "@/components/app-shell/app-shell";
import { IdentitySelection } from "@/components/research/identity-selection";
import { JobProgress } from "@/components/research/job-progress";
import { requireViewer } from "@/lib/auth/session";
import { getJobView } from "@/lib/data/jobs";
import { getDb } from "@/lib/db/client";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  return { title: (await getTranslations("Meta"))("researchRun") };
}
export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const viewer = await requireViewer();
  const { jobId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) notFound();
  const view = await getJobView(getDb(), viewer.userId, jobId);
  if (!view) notFound();
  return (
    <PageContainer>
      {view.status === "awaiting_identity" ? <IdentitySelection job={view} /> : <JobProgress key={`${view.id}:${view.status}`} initial={view} />}
    </PageContainer>
  );
}
