import { revokeUserSession } from "@/lib/auth/sessions";
import { ApiError, authed, noContent } from "@/lib/api/v1/http";

export const dynamic = "force-dynamic";

/** Sign out one device or browser. Only the account's own sessions can be revoked. */
export const DELETE = authed<{ sessionId: string }>(async (ctx, { sessionId }) => {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(sessionId) || !(await revokeUserSession(ctx.db, ctx.viewer.userId, sessionId))) {
    throw new ApiError("not_found", "Session not found.");
  }
  return noContent();
});
