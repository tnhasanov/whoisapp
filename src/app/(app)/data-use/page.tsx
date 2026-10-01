import { getTranslations } from "next-intl/server";
import { PageContainer, PageHeader } from "@/components/app-shell/app-shell";
import { Card } from "@/components/ui/card";
import { getEnv } from "@/lib/env";

export async function generateMetadata() {
  return { title: (await getTranslations("Meta"))("dataUse") };
}

export default async function DataUsePage() {
  const t = await getTranslations("DataUse");
  const env = getEnv();
  const sections = [
    ["whatTitle", "whatBody"],
    ["sourcesTitle", "sourcesBody"],
    ["excludedTitle", "excludedBody"],
    ["storageTitle", "storageBody"],
    ["providersTitle", "providersBody"],
    ["deletionTitle", "deletionBody"],
    ["correctionsTitle", "correctionsBody"],
    ["limitsTitle", "limitsBody"],
  ] as const;
  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Card className="mt-8 divide-y divide-line">
        {sections.map(([title, body]) => (
          <section key={title} className="grid gap-2 p-5 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-6">
            <h2 className="font-serif text-[17px] font-semibold text-ink">{t(title)}</h2>
            <p className="text-[14.5px] leading-relaxed text-ink-2">
              {t(body, { days: env.SOURCE_CONTENT_RETENTION_DAYS, hours: env.DEMO_GUEST_TTL_HOURS })}
            </p>
          </section>
        ))}
      </Card>
    </PageContainer>
  );
}
