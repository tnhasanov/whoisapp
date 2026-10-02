import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/feedback";
import { PageContainer } from "./app-shell";

/** Instant placeholder while a screen loads, shaped like the screen that is coming. */
export function PageSkeleton({ variant = "list" }: { variant?: "list" | "profile" | "form" }) {
  const t = useTranslations("Common");
  return (
    <PageContainer>
      <div aria-busy="true" aria-live="polite" className="space-y-6">
        <span className="sr-only">{t("loading")}</span>
        {variant === "profile" ? (
          <>
            <div className="flex items-start gap-4">
              <Skeleton className="h-14 w-14 rounded-xl" />
              <div className="flex-1 space-y-2.5 pt-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-64 max-w-full" />
                <Skeleton className="h-4 w-80 max-w-full" />
              </div>
            </div>
            <div className="flex gap-6 border-b border-line pb-3">
              {[72, 120, 88, 96, 64].map((w, i) => (
                <Skeleton key={i} className="h-4" style={{ width: w }} />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-3 rounded-lg border border-line bg-surface p-5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[94%]" />
                <Skeleton className="h-4 w-[88%]" />
                <Skeleton className="h-4 w-[70%]" />
              </div>
              <Skeleton className="hidden h-40 rounded-lg lg:block" />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-56 max-w-full" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            {variant === "form" ? (
              <Skeleton className="h-56 rounded-lg" />
            ) : (
              <div className="divide-y divide-line rounded-lg border border-line bg-surface">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48 max-w-full" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
