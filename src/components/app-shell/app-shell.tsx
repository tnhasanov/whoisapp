import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { Viewer } from "@/lib/auth/session";
import { DemoBanner } from "./demo-banner";
import { MobileBottomNav, MobileTopBar } from "./mobile-nav";
import { Sidebar } from "./sidebar";

export function AppShell({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const t = useTranslations("Common");
  const isOwner = viewer.role === "owner";
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
      >
        {t("skipToContent")}
      </a>
      <Sidebar workspace={viewer.workspace} isOwner={isOwner} name={viewer.name} email={viewer.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar workspace={viewer.workspace} isOwner={isOwner} />
        {viewer.workspace === "demo" ? <DemoBanner /> : null}
        <main id="main" className="flex-1 pb-24 lg:pb-12" tabIndex={-1}>
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="label-caps mb-1.5">{eyebrow}</div> : null}
        <h1 className="font-serif text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[32px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-[14.5px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageContainer({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={wide ? "mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10" : "mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10"}>{children}</div>;
}
