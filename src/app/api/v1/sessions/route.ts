import { listUserSessions, revokeOtherSessions } from "@/lib/auth/sessions";
import { ApiError, authed, json, searchParams } from "@/lib/api/v1/http";

export const dynamic = "force-dynamic";

/** Signed-in devices and browsers for this account. */
export const GET = authed(async (ctx) => json({ items: await listUserSessions(ctx.db, ctx.viewer.userId, ctx.sessionId) }));

/** DELETE ?scope=others — sign out every other device and browser. */
export const DELETE = authed(async (ctx) => {
  if (searchParams(ctx.request).get("scope") !== "others") throw new ApiError("invalid_input", "Use scope=others.", { fieldErrors: { scope: "invalid" } });
  return json({ revoked: await revokeOtherSessions(ctx.db, ctx.viewer.userId, ctx.sessionId) });
});
