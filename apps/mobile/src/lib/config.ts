import * as Application from "expo-application";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Build-time configuration. Nothing here is secret: EXPO_PUBLIC_* values are
 * compiled into the bundle. The server address comes from
 * EXPO_PUBLIC_API_URL; development builds fall back to the computer running
 * Metro (a phone cannot reach the developer's machine through "localhost").
 */

export type Variant = "development" | "preview" | "production";

const extra = (Constants.expoConfig?.extra ?? {}) as { variant?: Variant; eas?: { projectId?: string } };

export const VARIANT: Variant = extra.variant ?? "development";
export const APP_VERSION = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "1.0.0";
export const APP_BUILD = Number(Application.nativeBuildVersion ?? "1") || 1;

const rawScheme = Constants.expoConfig?.scheme;
export const APP_SCHEME = (Array.isArray(rawScheme) ? rawScheme[0] : rawScheme) ?? "personbrief-dev";

/** Expo project id from `eas init` (null until the project is linked; push needs it). */
export const EAS_PROJECT_ID: string | null = extra.eas?.projectId ?? Constants.easConfig?.projectId ?? null;

/** Sent with API requests so the server can ask outdated builds to update. */
export const CLIENT_ID = `${Platform.OS}/${APP_VERSION}/${APP_BUILD}`;
/** Lets the account's session list recognise the app ("PersonBrief app · iOS"). */
export const USER_AGENT = `PersonBriefApp/${APP_VERSION} (${Platform.OS} ${String(Platform.Version)})`;

export type ApiConfig =
  | { ok: true; baseUrl: string; source: "build" | "metro-host" | "same-origin" }
  | { ok: false; reason: "missing" | "insecure" | "invalid"; value?: string };

export function resolveApiConfig(
  env: { url?: string | null; variant?: Variant; hostUri?: string | null; platform?: string; webOrigin?: string | null } = {},
): ApiConfig {
  const url = (env.url !== undefined ? env.url : process.env.EXPO_PUBLIC_API_URL)?.trim();
  const variant = env.variant ?? VARIANT;
  const platform = env.platform ?? Platform.OS;
  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, reason: "invalid", value: url };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { ok: false, reason: "invalid", value: url };
    // Release builds only ever talk to an HTTPS server.
    if (variant !== "development" && parsed.protocol !== "https:") return { ok: false, reason: "insecure", value: url };
    return { ok: true, baseUrl: parsed.origin, source: "build" };
  }
  if (platform === "web") {
    const origin = env.webOrigin !== undefined ? env.webOrigin : typeof window !== "undefined" ? window.location.origin : null;
    if (origin) return { ok: true, baseUrl: origin, source: "same-origin" };
  }
  if (variant === "development") {
    const hostUri = env.hostUri !== undefined ? env.hostUri : (Constants.expoConfig?.hostUri ?? null);
    const host = hostUri?.split(":")[0];
    if (host) return { ok: true, baseUrl: `http://${host}:3000`, source: "metro-host" };
  }
  return { ok: false, reason: "missing" };
}

export const API_CONFIG = resolveApiConfig();
