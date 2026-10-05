import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useTappedResearchNotification } from "@/lib/notification-response";
import { refreshRegistrationIfEnabled } from "@/lib/notifications";
import { useMe } from "@/lib/queries";
import { request } from "@/lib/api";
import { MetaResponseSchema } from "@personbrief/shared/api/v1";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SUPPORTED = new RegExp(`^/?(profile|research)/(${UUID})/?$`, "i");

/** "/profile/<id>" or "/research/<id>" from a personbrief:// link, or null for anything else. */
export function routeFromLink(url: string | null): string | null {
  if (!url) return null;
  const parsed = Linking.parse(url);
  const path = parsed.hostname ? `${parsed.hostname}/${parsed.path ?? ""}` : (parsed.path ?? "");
  const match = SUPPORTED.exec(path.replace(/^\/+/, ""));
  return match ? `/${match[1].toLowerCase()}/${match[2].toLowerCase()}` : null;
}

/**
 * Opens deep links (personbrief://profile/<id>, personbrief://research/<id>)
 * and tapped research notifications. When signed out, the destination waits
 * until sign-in; the server still checks that the item belongs to the
 * signed-in account (others see "not found").
 */
export function LinkRouter({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const pending = useRef<string | null>(null);
  const url = Linking.useURL();
  const tapped = useTappedResearchNotification();
  const me = useMe();
  const handledResponse = useRef<string | null>(null);

  // Signed in, Expo Router opens links itself; signed out, the link waits for sign-in.
  useEffect(() => {
    const route = routeFromLink(url);
    if (route && !signedIn) pending.current = route;
  }, [url, signedIn]);

  useEffect(() => {
    if (tapped && handledResponse.current !== tapped.id) {
      handledResponse.current = tapped.id;
      pending.current = `/research/${tapped.jobId}`;
    }
  }, [tapped]);

  useEffect(() => {
    if (!signedIn || !pending.current) return;
    const target = pending.current;
    pending.current = null;
    // Let the tab navigator mount first.
    const timer = setTimeout(() => router.push(target as never), 50);
    return () => clearTimeout(timer);
  }, [signedIn, url, tapped, router]);

  // Keep a notification registration fresh when the user opted in.
  const userId = me.data?.user.id;
  useEffect(() => {
    if (!signedIn || !userId || Platform.OS === "web") return;
    void request("/meta", { schema: MetaResponseSchema })
      .then((meta) => refreshRegistrationIfEnabled(meta.features.pushNotifications))
      .catch(() => undefined);
  }, [signedIn, userId]);

  return null;
}
