import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DemoEntry, SignInForm } from "@/components/auth/sign-in-form";
import { Card } from "@/components/ui/card";
import { ownerExists } from "@/lib/auth/owner";
import { getViewer } from "@/lib/auth/session";
import { getEnv, setupTokenStatus } from "@/lib/env";

export async function generateMetadata() {
  return { title: (await getTranslations("Meta"))("signIn") };
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const viewer = await getViewer();
  const { next } = await searchParams;
  // A demo visitor may still sign in as the owner; anyone else already signed in goes to the app.
  if (viewer && viewer.role === "owner") redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/search");
  const t = await getTranslations("Auth");
  const env = getEnv();
  const hasOwner = await ownerExists();
  return (
    <div className="w-full max-w-[420px] space-y-5">
      <Card className="p-6 sm:p-8">
        <h1 className="font-serif text-[26px] font-semibold tracking-[-0.02em] text-ink">{t("title")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("subtitle")}</p>
        <div className="mt-6">
          <SignInForm next={next ?? null} />
        </div>
        <p className="mt-5 text-xs leading-relaxed text-subtle">{t("closedRegistration")}</p>
        {!hasOwner && setupTokenStatus(env) !== "missing" ? (
          <p className="mt-3 text-sm">
            <Link href="/setup" className="font-medium text-accent hover:underline">
              {t("setupLink")}
            </Link>
          </p>
        ) : null}
      </Card>
      {env.PUBLIC_DEMO_ENABLED ? (
        <Card className="border-demo-line bg-demo-soft/60 p-6">
          <div className="flex items-start gap-3">
            <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-demo" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-ink">{t("demoTitle")}</h2>
              <p className="mt-1 text-sm text-ink-2">{t("demoBody")}</p>
              <div className="mt-4">
                <DemoEntry />
              </div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
