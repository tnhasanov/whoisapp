import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * PersonBrief for iPhone and Android.
 *
 * APP_VARIANT selects the build variant (set by the EAS build profiles in
 * eas.json; defaults to "development" locally). Each variant has its own app
 * id, name and URL scheme so they can be installed side by side.
 *
 * Public build-time settings (never secrets — EXPO_PUBLIC_* values end up in
 * the app bundle):
 *   EXPO_PUBLIC_API_URL  HTTPS address of the PersonBrief server for preview
 *                        and production builds. Development builds fall back
 *                        to the Metro host on port 3000.
 *   EAS_PROJECT_ID       Expo project id from `eas init` (enables EAS builds
 *                        and push notifications). Not invented here.
 *   EXPO_OWNER           Expo account or organisation that owns the project.
 *   GOOGLE_SERVICES_JSON Path to the Firebase google-services.json (an EAS
 *                        "file" environment variable). Android push
 *                        notifications need it; without it the app reports
 *                        notifications as unavailable.
 *
 * The scheme names must match packages/shared/src/app.ts (checked by a test).
 */

type Variant = "development" | "preview" | "production";

const VARIANT: Variant = ((): Variant => {
  const value = process.env.APP_VARIANT ?? "development";
  if (value !== "development" && value !== "preview" && value !== "production") throw new Error(`Unknown APP_VARIANT "${value}"`);
  return value;
})();

const VARIANTS: Record<Variant, { name: string; id: string; scheme: string }> = {
  development: { name: "PersonBrief Dev", id: "com.tnhasanov.personbrief.dev", scheme: "personbrief-dev" },
  preview: { name: "PersonBrief Preview", id: "com.tnhasanov.personbrief.preview", scheme: "personbrief-preview" },
  production: { name: "PersonBrief", id: "com.tnhasanov.personbrief", scheme: "personbrief" },
};

/** Marketing version shown in the stores; build numbers are managed by EAS (appVersionSource: remote). */
const VERSION = "1.0.0";
const INK = "#141b2b";
const CANVAS = "#f6f4ee";
const CANVAS_DARK = "#0e121a";

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = VARIANTS[VARIANT];
  const projectId = process.env.EAS_PROJECT_ID?.trim() || undefined;
  return {
    ...config,
    name: variant.name,
    slug: "personbrief",
    ...(process.env.EXPO_OWNER ? { owner: process.env.EXPO_OWNER } : {}),
    version: VERSION,
    orientation: "portrait",
    scheme: variant.scheme,
    userInterfaceStyle: "automatic",
    icon: "./assets/images/icon.png",
    backgroundColor: CANVAS,
    ios: {
      bundleIdentifier: variant.id,
      // iPhone only for the first release (no iPad layouts or screenshots yet).
      supportsTablet: false,
      // Only the standard HTTPS/TLS of the system networking stack is used.
      config: { usesNonExemptEncryption: false },
    },
    android: {
      package: variant.id,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-foreground.png",
        backgroundImage: "./assets/images/adaptive-background.png",
        monochromeImage: "./assets/images/adaptive-monochrome.png",
        backgroundColor: INK,
      },
      predictiveBackGestureEnabled: true,
      ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
      // The app needs network access only; these are added by libraries but never used.
      blockedPermissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
      ],
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 112,
          resizeMode: "contain",
          backgroundColor: CANVAS,
          dark: { image: "./assets/images/splash-icon.png", backgroundColor: CANVAS_DARK },
        },
      ],
      "expo-secure-store",
      "expo-localization",
      "expo-web-browser",
      [
        "expo-local-authentication",
        { faceIDPermission: "PersonBrief can use Face ID to unlock the app when you turn on App lock." },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/notification-icon.png",
          color: "#2c56c9",
          defaultChannel: "research",
        },
      ],
    ],
    experiments: { typedRoutes: true },
    extra: {
      variant: VARIANT,
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? null,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
