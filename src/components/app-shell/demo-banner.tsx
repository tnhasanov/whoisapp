import { FlaskConical } from "lucide-react";
import { getTranslations } from "next-intl/server";

/** Persistent label on every screen of the demo workspace. */
export async function DemoBanner() {
  const t = await getTranslations("Workspace");
  return (
    <div role="note" className="border-b border-demo-line bg-demo-soft px-4 py-1.5 text-[12.5px] text-demo sm:px-6 sm:py-2">
      <p className="flex items-center gap-2">
        <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">{t("bannerTitle")}</strong>
          {/* Phones show the short label; the full explanation appears from tablet width up. */}
          <span className="hidden sm:inline"> {t("bannerBody")}</span>
        </span>
      </p>
    </div>
  );
}
