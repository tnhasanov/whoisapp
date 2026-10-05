import { z } from "zod";
import { LOCALES, USER_ROLES, WORKSPACES } from "../../domain";
import { entityId, isoDateTime, openEnum } from "./common";

/* ---------------------------------- Meta --------------------------------- */

/** GET /api/v1/meta — public; lets an installed app check compatibility before sign-in. */
export const MetaResponseSchema = z.object({
  api: z.object({
    version: z.literal(1),
    /** Builds older than this must update (compared with the app's build number). */
    minimumClientBuild: z.number().int().nonnegative(),
  }),
  serverTime: isoDateTime,
  features: z.object({
    /** The fictional guest demo can be opened from the sign-in screen. */
    demoSignIn: z.boolean(),
    /** The server sends research-completion notifications to registered devices. */
    pushNotifications: z.boolean(),
  }),
});
export type MetaResponse = z.infer<typeof MetaResponseSchema>;

/* --------------------------------- Viewer -------------------------------- */

export const MeResponseSchema = z.object({
  user: z.object({
    id: entityId,
    name: z.string(),
    email: z.string(),
    role: z.enum(USER_ROLES),
    /** A temporary visitor of the fictional demo (no live research, deleted after a day). */
    isGuest: z.boolean(),
  }),
  workspace: z.enum(WORKSPACES),
  preferences: z.object({
    locale: z.enum(LOCALES),
    /** IANA time zone used for display; data is stored in UTC. */
    timezone: z.string(),
  }),
  capabilities: z.object({
    canSwitchWorkspace: z.boolean(),
    /** Live research can start (owner account and both providers configured). */
    liveResearchAvailable: z.boolean(),
  }),
  session: z.object({ id: entityId, expiresAt: isoDateTime }),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const UpdatePreferencesRequestSchema = z
  .object({
    locale: z.enum(LOCALES).optional(),
    timezone: z.string().min(1).max(64).refine(isValidTimeZone, "invalid_timezone").optional(),
  })
  .refine((v) => v.locale !== undefined || v.timezone !== undefined, "nothing_to_update");

export const SetWorkspaceRequestSchema = z.object({ workspace: z.enum(WORKSPACES) });

/* -------------------------------- Settings ------------------------------- */

export const SettingsResponseSchema = z.object({
  worker: z.object({ online: z.boolean() }),
  retention: z.object({ sourceContentDays: z.number().int(), demoGuestHours: z.number().int() }),
  /** Owner-only details; null for demo guests (as on the website). */
  owner: z
    .object({
      providers: z.object({
        /** Configured / missing only — key values never leave the server. */
        search: z.object({ name: z.string(), configured: z.boolean() }),
        model: z.object({ name: z.string(), configured: z.boolean(), model: z.string(), effort: z.string() }),
        /** Live research can be started (keys on the server and no online worker missing them). */
        liveReady: z.boolean(),
        /**
         * Whether the online research workers have both keys: false means a worker
         * needs a restart/redeploy to pick them up; null when none is online or
         * none reports it. Added in v1 (optional for older servers).
         */
        workerKeys: z.boolean().nullable().optional(),
        directFetch: z.boolean(),
      }),
      limits: z.object({
        maxSearchQueries: z.number().int(),
        maxResultsPerQuery: z.number().int(),
        maxExtractPages: z.number().int(),
        maxModelCalls: z.number().int(),
        includeNews: z.boolean(),
        newsWindowMonths: z.number().int(),
        maxJobsPerHour: z.number().int(),
      }),
      usage: z.object({
        /** Start of the reporting window (the last 30 days). */
        since: isoDateTime,
        byProvider: z.array(
          z.object({ provider: z.string(), requests: z.number().int(), tokens: z.number().int(), credits: z.number(), estimatedCostUsd: z.number() }),
        ),
        /** Estimate from published list prices; not an invoice. */
        estimatedCostUsd: z.number(),
      }),
    })
    .nullable(),
});
export type SettingsResponse = z.infer<typeof SettingsResponseSchema>;

/* -------------------------------- Sessions ------------------------------- */

export const SessionSchema = z.object({
  id: entityId,
  current: z.boolean(),
  createdAt: isoDateTime,
  lastActiveAt: isoDateTime,
  expiresAt: isoDateTime,
  /** Short, coarse description ("PersonBrief app · iPhone", "Safari · macOS"). */
  device: openEnum(["app_ios", "app_android", "browser", "unknown"] as const),
  label: z.string(),
});
export type SessionInfo = z.infer<typeof SessionSchema>;
export const SessionListResponseSchema = z.object({ items: z.array(SessionSchema) });
export const RevokeOthersResponseSchema = z.object({ revoked: z.number().int() });

/* ------------------------- Push notification devices --------------------- */

export const PUSH_PLATFORMS = ["ios", "android"] as const;

/** PUT /api/v1/devices/current — bind this signed-in app to research notifications. */
export const RegisterDeviceRequestSchema = z.object({
  /** Expo push token ("ExponentPushToken[…]"). */
  pushToken: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,200}\]$/, "invalid_push_token"),
  platform: z.enum(PUSH_PLATFORMS),
  appVersion: z.string().max(40).optional(),
});

export const DeviceSchema = z.object({
  id: entityId,
  platform: z.enum(PUSH_PLATFORMS),
  registeredAt: isoDateTime,
  lastDelivery: z
    .object({
      at: isoDateTime,
      status: openEnum(["sent", "failed"] as const),
      /** Expo/APNs/FCM error code when delivery failed (for example "InvalidCredentials"). */
      error: z.string().nullable(),
    })
    .nullable(),
});
export const DeviceResponseSchema = z.object({ device: DeviceSchema.nullable() });
