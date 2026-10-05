import { expoClient } from "@better-auth/expo/client";
import { anonymousClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/client";
import * as SecureStore from "expo-secure-store";
import { AUTH_COOKIE_PREFIX } from "@personbrief/shared/app";
import { API_CONFIG, APP_SCHEME, USER_AGENT } from "./config";

/**
 * The server's own Better Auth, through its supported Expo integration: the
 * session cookie is kept in the device keychain/keystore (SecureStore) and
 * sent as a Cookie header; requests identify the app by its URL scheme.
 * There is no separate token system. Cached session data is disabled so that
 * no account details are stored beyond the cookie itself.
 */
function build(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [
      expoClient({
        scheme: APP_SCHEME,
        storagePrefix: "personbrief",
        cookiePrefix: AUTH_COOKIE_PREFIX,
        storage: SecureStore,
        disableCache: true,
      }),
      anonymousClient(),
    ],
    fetchOptions: { headers: { "user-agent": USER_AGENT } },
  });
}

export type AuthClient = ReturnType<typeof build>;

let client: AuthClient | null = null;

export function getAuthClient(): AuthClient {
  if (!API_CONFIG.ok) throw new Error("The server address is not configured for this build.");
  client ??= build(API_CONFIG.baseUrl);
  return client;
}

/** "name=value; …" for the stored session cookie ("" when signed out or on the web preview). */
export async function sessionCookie(): Promise<string> {
  if (!API_CONFIG.ok) return "";
  try {
    return (await getAuthClient().getCookie()) ?? "";
  } catch {
    return "";
  }
}
