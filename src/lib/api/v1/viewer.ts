import "server-only";
import { getLiveReadiness } from "@/lib/research/readiness";
import type { MeResponse } from "@personbrief/shared/api/v1";
import type { ApiContext } from "./http";

export async function meResponse(ctx: Pick<ApiContext, "viewer" | "env" | "db" | "sessionId" | "sessionExpiresAt">): Promise<MeResponse> {
  const { viewer, env, db } = ctx;
  const isOwner = viewer.role === "owner";
  return {
    user: { id: viewer.userId, name: viewer.name, email: viewer.email, role: viewer.role, isGuest: viewer.isGuest },
    workspace: viewer.workspace,
    preferences: { locale: viewer.locale, timezone: viewer.timezone },
    capabilities: {
      canSwitchWorkspace: isOwner,
      liveResearchAvailable: isOwner && (await getLiveReadiness(db, env)).ready,
    },
    session: { id: ctx.sessionId, expiresAt: ctx.sessionExpiresAt.toISOString() },
  };
}
