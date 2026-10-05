import * as Notifications from "expo-notifications";
import { jobIdFromNotification } from "./notifications";

/** The research run of the notification the user last tapped (with its unique id). */
export function useTappedResearchNotification(): { id: string; jobId: string } | null {
  const response = Notifications.useLastNotificationResponse();
  const jobId = jobIdFromNotification(response ?? null);
  return jobId && response ? { id: response.notification.request.identifier, jobId } : null;
}
