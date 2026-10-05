import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { getEnv } from "@/lib/env";

export async function generateMetadata() {
  return { title: (await getTranslations("Privacy"))("title") };
}

/**
 * Public privacy page (also the privacy-policy address for the app stores).
 * It shows the same commitments as the signed-in "Data use & privacy" page,
 * plus accounts, the phone app and how to reach the operator. Nothing on it
 * depends on the visitor or on stored data.
 */
export default async function PrivacyPage() {
  const t = await getTranslations("Privacy");
  const tData = await getTranslations("DataUse");
  const env = getEnv();
  const values = { days: env.SOURCE_CONTENT_RETENTION_DAYS, hours: env.DEMO_GUEST_TTL_HOURS };
  const sections: { id: string; title: string; body: string }[] = [
    { id: "what", title: tData("whatTitle"), body: tData("whatBody") },
    { id: "sources", title: tData("sourcesTitle"), body: tData("sourcesBody") },
    { id: "excluded", title: tData("excludedTitle"), body: tData("excludedBody") },
    { id: "storage", title: tData("storageTitle"), body: tData("storageBody", values) },
    { id: "accounts", title: t("accountTitle"), body: t("accountBody") },
    { id: "app", title: t("appTitle"), body: t("appBody") },
    { id: "providers", title: tData("providersTitle"), body: tData("providersBody") },
    { id: "deletion", title: tData("deletionTitle"), body: tData("deletionBody", values) },
    { id: "subjects", title: t("subjectsTitle"), body: t("subjectsBody") },
    { id: "limits", title: tData("limitsTitle"), body: tData("limitsBody") },
  ];
  return (
    <div className="w-full max-w-[760px]">
      <h1 className="font-serif text-[28px] font-semibold tracking-[-0.02em] text-ink">{t("title")}</h1>
      <p className="mt-2 text-[15px] text-muted">{t("subtitle")}</p>
      <Card className="mt-6 divide-y divide-line">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="grid gap-2 p-5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6">
            <h2 className="font-serif text-[17px] font-semibold text-ink">{section.title}</h2>
            <p className="text-[14.5px] leading-relaxed text-ink-2">{section.body}</p>
          </section>
        ))}
        <section id="contact" className="grid gap-2 p-5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6">
          <h2 className="font-serif text-[17px] font-semibold text-ink">{t("contactTitle")}</h2>
          <p className="text-[14.5px] leading-relaxed text-ink-2">
            {env.SUPPORT_EMAIL ? (
              <>
                {t("contactBody", { email: "" })}
                <a href={`mailto:${env.SUPPORT_EMAIL}`} className="font-medium text-accent hover:underline">
                  {env.SUPPORT_EMAIL}
                </a>
              </>
            ) : (
              t("contactNone")
            )}
          </p>
        </section>
      </Card>
      <p className="mt-6 text-sm">
        <Link href="/sign-in" className="font-medium text-accent hover:underline">
          {t("back")}
        </Link>
      </p>
    </div>
  );
}
