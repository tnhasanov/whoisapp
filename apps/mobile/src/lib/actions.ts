import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { Linking, Platform } from "react-native";

/** Restrained haptics: selection ticks, a success tap and a warning — nothing else. */
export const haptics = {
  select: () => {
    if (Platform.OS !== "web") void Haptics.selectionAsync().catch(() => undefined);
  },
  success: () => {
    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
  warning: () => {
    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  },
};

/** One key per user action; reused if the same action is retried (no duplicate paid research). */
export function newIdempotencyKey(): string {
  return Crypto.randomUUID().replace(/-/g, "");
}

/** Open a public source page in an in-app browser sheet (the system browser on Android). */
export async function openExternal(url: string) {
  if (!/^https?:\/\//i.test(url)) return;
  await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET, dismissButtonStyle: "close" }).catch(() =>
    Linking.openURL(url),
  );
}

/** Opens the dialer with the number filled in — the call is only placed if the user taps Call there. */
export async function openDialer(number: string) {
  const digits = number.replace(/[^\d+]/g, "");
  if (digits.length < 5) return false;
  await Linking.openURL(`tel:${digits}`);
  return true;
}

/** Opens a new email in the mail app — nothing is sent automatically. */
export async function openEmail(address: string) {
  if (!/^[^\s@]+@[^\s@]+$/.test(address)) return false;
  await Linking.openURL(`mailto:${address}`);
  return true;
}

export async function copyText(value: string) {
  await Clipboard.setStringAsync(value);
  haptics.select();
}
