"use client";

import { useEffect } from "react";
import { captureInstallPrompt, isStandalone, markInstalled, type InstallPromptEvent } from "./install-store";

/**
 * Registers the service worker (production only) and keeps the browser's
 * install offer for the "Install app" button. Also marks the document when it
 * runs as the installed app so styles can adapt (e.g. no browser chrome).
 */
export function PwaBootstrap() {
  useEffect(() => {
    if (isStandalone()) document.documentElement.dataset.standalone = "true";
    const onPrompt = (event: Event) => {
      event.preventDefault();
      captureInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", markInstalled);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);
  return null;
}
