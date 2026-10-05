import { json, open } from "@/lib/api/v1/http";
import { getEnv } from "@/lib/env";
import { MINIMUM_CLIENT_BUILD } from "@personbrief/shared/app";
import type { MetaResponse } from "@personbrief/shared/api/v1";

export const dynamic = "force-dynamic";

/** Public: API version, the oldest supported app build and coarse feature flags (no configuration details). */
export const GET = open(async () => {
  const env = getEnv();
  const body: MetaResponse = {
    api: { version: 1, minimumClientBuild: MINIMUM_CLIENT_BUILD },
    serverTime: new Date().toISOString(),
    features: { demoSignIn: env.PUBLIC_DEMO_ENABLED, pushNotifications: env.PUSH_NOTIFICATIONS_ENABLED },
  };
  return json(body);
});
