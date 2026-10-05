/**
 * Mobile app identity shared by the app configuration and the server.
 *
 * Each build variant has its own URL scheme so that development, internal
 * preview and production apps can be installed side by side. The server
 * trusts the release schemes everywhere and the development scheme only when
 * it is not running in production.
 */
export const APP_VARIANTS = ["development", "preview", "production"] as const;
export type AppVariant = (typeof APP_VARIANTS)[number];

export const APP_SCHEMES: Record<AppVariant, string> = {
  development: "personbrief-dev",
  preview: "personbrief-preview",
  production: "personbrief",
};

/** Schemes of installable release builds (internal preview and store). */
export const RELEASE_APP_SCHEMES = [APP_SCHEMES.production, APP_SCHEMES.preview] as const;
export const DEVELOPMENT_APP_SCHEMES = [APP_SCHEMES.development] as const;

/** Prefix of the Better Auth cookies; the app must use the same value. */
export const AUTH_COOKIE_PREFIX = "personbrief";

/** Builds below this number are asked to update (see /api/v1/meta). */
export const MINIMUM_CLIENT_BUILD = 1;
