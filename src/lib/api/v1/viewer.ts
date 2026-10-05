import "server-only";
import { getProviderStatus } from "@/lib/env";
import type { MeResponse } from "@personbrief/shared/api/v1";
import type { ApiContext } from "./http";

export function meResponse(ctx: Pick<ApiContext, "viewer" | "env" | "sessionId" | "sessionExpiresAt">): MeResponse {
  const { viewer, env } = ctx;
  const isOwner = viewer.role === "owner";
  return {
    user: { id: viewer.userId, name: viewer.name, email: viewer.email, role: viewer.role, isGuest: viewer.isGuest },
    workspace: viewer.workspace,
    preferences: { locale: viewer.locale, timezone: viewer.timezone },
    capabilities: {
      canSwitchWorkspace: isOwner,
      liveResearchAvailable: isOwner && getProviderStatus(env).liveReady,
    },
    session: { id: ctx.sessionId, expiresAt: ctx.sessionExpiresAt.toISOString() },
  };
}
