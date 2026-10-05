import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { DeviceResponseSchema } from "@personbrief/shared/api/v1";
import { request } from "./api";
import { APP_VERSION, EAS_PROJECT_ID } from "./config";
import { deviceStorage, PREF } from "./storage";

/**
 * Opt-in research-completion notifications. The phone registers its Expo
 * push token with the server for the current session only; the server sends
 * a generic "research finished" message (never the person's name) when a run
 * ends or needs the identity choice. When push cannot work — no Expo project
 * linked to this build, the web preview, a simulator, permission denied — the
 * app says so instead of pretending.
 */

export const RESEARCH_CHANNEL = "research";

export type PushUnavailableReason = "web" | "simulator" | "no_project" | "server_disabled";

export function pushUnavailableReason(serverEnabled: boolean): PushUnavailableReason | null {
  if (Platform.OS === "web") return "web";
  if (!serverEnabled) return "server_disabled";
  if (!EAS_PROJECT_ID) return "no_project";
  if (!Device.isDevice) return "simulator";
  return null;
}

export type EnableResult = { ok: true } | { ok: false; reason: "denied" | "token_failed" | "server" | PushUnavailableReason };

export function configureNotificationPresentation() {
  if (Platform.OS === "web") return;
  // While the app is open the research screen updates by itself: list the
  // notification quietly instead of showing a banner over the screen.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

async function ensureChannel(name: string) {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(RESEARCH_CHANNEL, {
    name,
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    showBadge: false,
  });
}

async function register(): Promise<EnableResult> {
  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID! })).data;
  } catch {
    return { ok: false, reason: "token_failed" };
  }
  try {
    await request("/devices/current", {
      method: "PUT",
      body: { pushToken: token, platform: Platform.OS === "ios" ? "ios" : "android", appVersion: APP_VERSION },
      schema: DeviceResponseSchema,
    });
  } catch {
    return { ok: false, reason: "server" };
  }
  return { ok: true };
}

/** Ask for permission (once) and register this signed-in phone. */
export async function enableNotifications(serverEnabled: boolean, channelName: string): Promise<EnableResult> {
  const unavailable = pushUnavailableReason(serverEnabled);
  if (unavailable) return { ok: false, reason: unavailable };
  await ensureChannel(channelName);
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return { ok: false, reason: "denied" };
  const result = await register();
  if (result.ok) await deviceStorage.set(PREF.notifications, "on");
  return result;
}

export async function disableNotifications(): Promise<void> {
  await deviceStorage.remove(PREF.notifications);
  await request("/devices/current", { method: "DELETE", timeoutMs: 8000 });
}

/** Before sign-out: stop notifications for this phone (the server also drops them with the session). */
export async function unregisterThisDevice(): Promise<void> {
  if (Platform.OS === "web") return;
  const enabled = (await deviceStorage.get(PREF.notifications)) === "on";
  await deviceStorage.remove(PREF.notifications);
  if (enabled) await request("/devices/current", { method: "DELETE", timeoutMs: 4000, quietUnauthorized: true });
}

/** On launch: refresh the registration if the user opted in (push tokens can change). */
export async function refreshRegistrationIfEnabled(serverEnabled: boolean): Promise<void> {
  if (pushUnavailableReason(serverEnabled)) return;
  if ((await deviceStorage.get(PREF.notifications)) !== "on") return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;
  await register();
}

export async function notificationsOptedIn(): Promise<boolean> {
  return (await deviceStorage.get(PREF.notifications)) === "on";
}

/** The research run a tapped notification refers to. */
export function jobIdFromNotification(response: Notifications.NotificationResponse | null): string | null {
  const data = response?.notification.request.content.data as { type?: string; jobId?: string } | undefined;
  return data?.type === "research" && typeof data.jobId === "string" && /^[0-9a-f-]{36}$/i.test(data.jobId) ? data.jobId : null;
}
