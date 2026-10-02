"use client";

import { Download, PlusSquare, Share, Smartphone, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { devicePlatform, isStandalone, promptInstall, useInstallState } from "./install-store";

type Environment = { standalone: boolean; platform: "ios" | "android" | "other" };

function subscribeDisplayMode(onChange: () => void) {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Browser-only facts; null during server rendering so the first paint matches. */
function useEnvironment(): Environment | null {
  const key = useSyncExternalStore(
    subscribeDisplayMode,
    () => `${isStandalone() ? 1 : 0}|${devicePlatform()}`,
    () => null,
  );
  if (!key) return null;
  const [standalone, platform] = key.split("|");
  return { standalone: standalone === "1", platform: platform as Environment["platform"] };
}

const HINT_KEY = "pb-install-hint-dismissed";
const hintListeners = new Set<() => void>();

function readHintDismissed(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function dismissHint() {
  try {
    window.localStorage.setItem(HINT_KEY, "1");
  } catch {
    /* storage unavailable: hidden for this visit only */
  }
  hintDismissedThisVisit = true;
  for (const listener of hintListeners) listener();
}

let hintDismissedThisVisit = false;

function useHintDismissed(): boolean {
  return useSyncExternalStore(
    (listener) => {
      hintListeners.add(listener);
      return () => hintListeners.delete(listener);
    },
    () => hintDismissedThisVisit || readHintDismissed(),
    () => true,
  );
}

/** Settings section: install the app, or how to add it to the home screen. */
export function InstallAppCard() {
  const t = useTranslations("Install");
  const { prompt, installed } = useInstallState();
  const env = useEnvironment();
  if (!env) return null;
  return (
    <div className="flex items-start gap-4 p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink" aria-hidden>
        <Smartphone className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-2 text-[14px] text-ink-2">
        {env.standalone || installed ? (
          <p className="font-medium text-ok">{t("installed")}</p>
        ) : (
          <>
            <p>{t("body")}</p>
            {prompt ? (
              <Button size="md" onClick={() => void promptInstall()}>
                <Download className="h-4 w-4" aria-hidden />
                {t("button")}
              </Button>
            ) : env.platform === "ios" ? (
              <ol className="space-y-1.5 text-[13.5px]">
                <li className="flex items-center gap-2">
                  <Share className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                  {t("iosStep1")}
                </li>
                <li className="flex items-center gap-2">
                  <PlusSquare className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                  {t("iosStep2")}
                </li>
              </ol>
            ) : (
              <p className="text-[13.5px] text-muted">{env.platform === "android" ? t("android") : t("desktop")}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** A quiet, dismissible suggestion on phones that are not yet using the installed app. */
export function InstallAppHint({ className }: { className?: string }) {
  const t = useTranslations("Install");
  const { prompt } = useInstallState();
  const env = useEnvironment();
  const dismissed = useHintDismissed();
  if (!env || env.standalone || env.platform === "other" || dismissed) return null;
  const dismiss = dismissHint;
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm lg:hidden", className)}>
      <BrandMark className="h-10 w-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-ink">{t("hintTitle")}</p>
        <p className="text-[12.5px] leading-snug text-muted">{env.platform === "ios" && !prompt ? t("hintIos") : t("hintBody")}</p>
      </div>
      {prompt ? (
        <Button size="sm" onClick={() => void promptInstall().then((ok) => ok && dismiss())}>
          {t("button")}
        </Button>
      ) : null}
      <button type="button" onClick={dismiss} className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted active:bg-sunken" aria-label={t("dismiss")}>
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
