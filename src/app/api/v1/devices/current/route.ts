import { authed, json, noContent, readBody } from "@/lib/api/v1/http";
import { getSessionDevice, registerSessionDevice, unregisterSessionDevice } from "@/lib/push/devices";
import { RegisterDeviceRequestSchema } from "@personbrief/shared/api/v1";

export const dynamic = "force-dynamic";

/** Research-completion notifications for this signed-in app (opt-in; bound to the current session). */
export const GET = authed(async (ctx) => json({ device: await getSessionDevice(ctx.db, ctx.viewer.userId, ctx.sessionId) }));

export const PUT = authed(async (ctx) => {
  const input = await readBody(ctx.request, RegisterDeviceRequestSchema);
  const device = await registerSessionDevice(ctx.db, {
    ownerId: ctx.viewer.userId,
    sessionId: ctx.sessionId,
    pushToken: input.pushToken,
    platform: input.platform,
    appVersion: input.appVersion,
  });
  return json({ device });
});

/** Turn notifications off for this app (also happens automatically on sign-out). */
export const DELETE = authed(async (ctx) => {
  await unregisterSessionDevice(ctx.db, ctx.viewer.userId, ctx.sessionId);
  return noContent();
});
