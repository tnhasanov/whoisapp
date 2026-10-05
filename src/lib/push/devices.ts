import { and, eq, ne } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { pushDevices } from "@/lib/db/schema";

export type DeviceView = {
  id: string;
  platform: "ios" | "android";
  registeredAt: string;
  lastDelivery: { at: string; status: "sent" | "failed"; error: string | null } | null;
};

function toView(row: typeof pushDevices.$inferSelect): DeviceView {
  return {
    id: row.id,
    platform: row.platform,
    registeredAt: row.createdAt.toISOString(),
    lastDelivery:
      row.lastDeliveryAt && row.lastDeliveryStatus
        ? { at: row.lastDeliveryAt.toISOString(), status: row.lastDeliveryStatus, error: row.lastDeliveryError }
        : null,
  };
}

export async function getSessionDevice(db: Database, ownerId: string, sessionId: string): Promise<DeviceView | null> {
  const [row] = await db.select().from(pushDevices).where(and(eq(pushDevices.ownerId, ownerId), eq(pushDevices.sessionId, sessionId)));
  return row ? toView(row) : null;
}

/**
 * Register (or update) the push token of the signed-in app session. A token
 * previously registered by another session — for example another account on
 * the same phone — is detached first, so it only ever notifies one account.
 */
export async function registerSessionDevice(
  db: Database,
  input: { ownerId: string; sessionId: string; pushToken: string; platform: "ios" | "android"; appVersion?: string | null },
): Promise<DeviceView> {
  return db.transaction(async (tx) => {
    await tx.delete(pushDevices).where(and(eq(pushDevices.pushToken, input.pushToken), ne(pushDevices.sessionId, input.sessionId)));
    const [row] = await tx
      .insert(pushDevices)
      .values({ ownerId: input.ownerId, sessionId: input.sessionId, pushToken: input.pushToken, platform: input.platform, appVersion: input.appVersion ?? null })
      .onConflictDoUpdate({
        target: pushDevices.sessionId,
        set: { pushToken: input.pushToken, platform: input.platform, appVersion: input.appVersion ?? null, updatedAt: new Date() },
      })
      .returning();
    return toView(row);
  });
}

export async function unregisterSessionDevice(db: Database, ownerId: string, sessionId: string): Promise<boolean> {
  const deleted = await db.delete(pushDevices).where(and(eq(pushDevices.ownerId, ownerId), eq(pushDevices.sessionId, sessionId))).returning({ id: pushDevices.id });
  return deleted.length > 0;
}
