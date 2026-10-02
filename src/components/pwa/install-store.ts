"use client";

import { useSyncExternalStore } from "react";

/**
 * Remembers the browser's install offer (Chrome/Edge/Android fire
 * `beforeinstallprompt` once, early) so any screen can offer "Install app".
 */
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallState = { prompt: InstallPromptEvent | null; installed: boolean };

let state: InstallState = { prompt: null, installed: false };
const listeners = new Set<() => void>();

function set(next: Partial<InstallState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function captureInstallPrompt(event: InstallPromptEvent) {
  set({ prompt: event });
}

export function markInstalled() {
  set({ prompt: null, installed: true });
}

export async function promptInstall(): Promise<boolean> {
  const event = state.prompt;
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  set({ prompt: null, installed: outcome === "accepted" || state.installed });
  return outcome === "accepted";
}

const serverSnapshot: InstallState = { prompt: null, installed: false };

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => serverSnapshot,
  );
}

/** True when running as the installed app (home-screen launch). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function devicePlatform(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}
