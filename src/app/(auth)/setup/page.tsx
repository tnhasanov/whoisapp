import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SetupForm } from "@/components/auth/setup-form";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import { ownerExists } from "@/lib/auth/owner";
import { getEnv } from "@/lib/env";

export const metadata = { title: "Setup" };

export default async function SetupPage() {
  const t = await getTranslations("Setup");
  const exists = await ownerExists();
  const tokenConfigured = Boolean(getEnv().OWNER_SETUP_TOKEN);
  return (
    <div className="w-full max-w-[460px]">
      <Card className="p-6 sm:p-8">
        <h1 className="font-serif text-[26px] font-semibold tracking-[-0.02em] text-ink">{exists || !tokenConfigured ? t("unavailableTitle") : t("title")}</h1>
        {exists ? (
          <Callout className="mt-5" title={t("alreadyDone")}>
            <Link className="font-medium text-accent hover:underline" href="/sign-in">
              Sign in
            </Link>
          </Callout>
        ) : !tokenConfigured ? (
          <Callout tone="warn" className="mt-5">
            <span className="break-anywhere">{t("noToken")}</span>
          </Callout>
        ) : (
          <>
            <p className="mt-1.5 text-sm text-muted">{t("subtitle")}</p>
            <div className="mt-6">
              <SetupForm />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
