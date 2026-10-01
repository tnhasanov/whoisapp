import { FlaskConical } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/app-shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { findFixtureDocument } from "@/fixtures/world";
import { requireViewer } from "@/lib/auth/session";

export const metadata = { title: "Fictional source" };

/** Local viewer for fictional fixture sources: demo links never point at live websites. */
export default async function FixtureSourcePage({ params }: { params: Promise<{ key: string }> }) {
  await requireViewer();
  const { key } = await params;
  const doc = findFixtureDocument(decodeURIComponent(key));
  if (!doc) notFound();
  const t = await getTranslations("Fixture");
  const tTypes = await getTranslations("SourceTypes");
  const lang = doc.language;
  return (
    <PageContainer>
      <div role="note" className="mb-6 flex items-start gap-2 rounded-lg border border-demo-line bg-demo-soft px-4 py-3 text-sm text-demo">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {t("banner")}
      </div>
      <Card className="p-6 sm:p-8">
        <p className="label-caps flex flex-wrap items-center gap-2">
          {t("title")} <Badge tone="demo">Demo</Badge> <Badge tone="outline">{tTypes(doc.sourceType)}</Badge>
        </p>
        <h1 lang={lang} className="mt-2 font-serif text-[26px] font-semibold leading-tight tracking-[-0.015em] text-ink">
          {doc.title}
        </h1>
        <dl className="mt-4 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-[10rem_minmax(0,1fr)]">
          <dt className="text-muted">{t("publisher")}</dt>
          <dd className="text-ink-2">{doc.publisher}</dd>
          <dt className="text-muted">{t("published")}</dt>
          <dd className="text-ink-2">{doc.publishedDate === "@run-date" ? t("runDate") : (doc.publishedDate ?? "—")}</dd>
          <dt className="text-muted">{t("originalUrl")}</dt>
          <dd className="font-mono text-[12px] text-ink-2 break-anywhere">{doc.url}</dd>
          <dt className="text-muted">{t("access")}</dt>
          <dd className="text-ink-2">{doc.access}</dd>
        </dl>
        <hr className="my-6 border-line" />
        {doc.body ? (
          <div lang={lang} className="max-w-3xl space-y-4 font-serif text-[16.5px] leading-[1.7] text-ink">
            {doc.body.split(/\n{2,}/).map((para, i) => (
              <p key={i} className="whitespace-pre-line">
                {para}
              </p>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-warn">{t("snippetOnly")}</p>
            <p lang={lang} className="font-serif text-[16px] leading-relaxed text-ink-2">
              {doc.snippet}
            </p>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
