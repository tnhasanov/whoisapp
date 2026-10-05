import { and, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import az from "../../../messages/az.json";
import en from "../../../messages/en.json";
import ru from "../../../messages/ru.json";
import type { Database } from "@/lib/db/client";
import { ownerSettings, pushDeliveries, pushDevices, sessions, type PushTicket } from "@/lib/db/schema";
import type { Env } from "@/lib/env";

/**
 * Research-completion notifications for the mobile app.
 *
 * The worker calls `dispatchPushNotifications` from its maintenance loop. It
 * looks for runs that finished (or now wait for the identity choice) after a
 * device registered, claims each (run, event) once through a unique index —
 * so several workers and restarts never send duplicates — and sends a
 * generic message through the Expo push service. Lock-screen text never
 * names the person researched. Tokens the push service reports as no longer
 * registered are deleted; other failures are recorded on the device so the
 * app can show an honest status.
 */

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
/** Only events this recent are announced (an old run never pings a newly registered phone). */
const FRESH_MINUTES = 60;
const MAX_ATTEMPTS = 3;

type Catalog = { Push: Record<string, string> };
const CATALOGS: Record<string, Catalog> = { en: en as Catalog, az: az as Catalog, ru: ru as Catalog };

export type PushEvent = "finished" | "needs_choice";
export type PushKind = "completed" | "partial" | "failed" | "needs_choice";

export function pushText(locale: string, kind: PushKind): { title: string; body: string } {
  const push = (CATALOGS[locale] ?? CATALOGS.en).Push;
  const key = kind === "needs_choice" ? "needsChoice" : kind;
  return { title: push[`${key}Title`], body: push[`${key}Body`] };
}

export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: { type: "research"; jobId: string; profileId: string | null };
  sound: "default";
  channelId: "research";
  priority: "high";
};

type ExpoTicket = { status: "ok"; id: string } | { status: "error"; message?: string; details?: { error?: string } };
type ExpoReceipt = { status: "ok" } | { status: "error"; message?: string; details?: { error?: string } };

export type PushTransport = {
  send(messages: ExpoMessage[]): Promise<ExpoTicket[]>;
  receipts(ids: string[]): Promise<Record<string, ExpoReceipt>>;
};

/** Expo push service over HTTPS (no SDK; an access token is only needed with enhanced push security). */
export function expoTransport(env: Pick<Env, "EXPO_ACCESS_TOKEN">, fetchImpl: typeof fetch = fetch): PushTransport {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
  const post = async <T>(url: string, body: unknown): Promise<T> => {
    const response = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`push service HTTP ${response.status}`);
    return ((await response.json()) as { data: T }).data;
  };
  return {
    send: (messages) => post<ExpoTicket[]>(EXPO_SEND_URL, messages),
    receipts: (ids) => post<Record<string, ExpoReceipt>>(EXPO_RECEIPTS_URL, { ids }),
  };
}

type Candidate = { job_id: string; owner_id: string; status: string; profile_id: string | null; event: PushEvent };

async function findCandidates(db: Database): Promise<Candidate[]> {
  const result = await db.execute<Candidate>(sql`
    SELECT j.id AS job_id, j.owner_id, j.status, j.profile_id,
           CASE WHEN j.status = 'awaiting_identity' THEN 'needs_choice' ELSE 'finished' END AS event
    FROM research_jobs j
    WHERE j.status IN ('completed', 'partial', 'failed', 'awaiting_identity')
      AND COALESCE(j.finished_at, j.updated_at) > now() - make_interval(mins => ${FRESH_MINUTES})
      AND NOT EXISTS (
        SELECT 1 FROM push_deliveries d
        WHERE d.job_id = j.id AND d.event = CASE WHEN j.status = 'awaiting_identity' THEN 'needs_choice' ELSE 'finished' END
      )
      AND EXISTS (
        SELECT 1 FROM push_devices p JOIN auth_sessions s ON s.id = p.session_id
        WHERE p.owner_id = j.owner_id AND s.expires_at > now() AND p.created_at < COALESCE(j.finished_at, j.updated_at)
      )
    ORDER BY j.updated_at
    LIMIT 25
  `);
  return result.rows;
}

function kindOf(candidate: Candidate): PushKind {
  if (candidate.event === "needs_choice") return "needs_choice";
  return candidate.status === "completed" ? "completed" : candidate.status === "partial" ? "partial" : "failed";
}

async function deliver(db: Database, transport: PushTransport, deliveryId: string, candidate: Candidate, log: (m: string, e?: Record<string, unknown>) => void) {
  const devices = await db
    .select({ id: pushDevices.id, token: pushDevices.pushToken })
    .from(pushDevices)
    .innerJoin(sessions, and(eq(sessions.id, pushDevices.sessionId), gt(sessions.expiresAt, new Date())))
    .where(eq(pushDevices.ownerId, candidate.owner_id));
  if (devices.length === 0) {
    await db.update(pushDeliveries).set({ status: "skipped" }).where(eq(pushDeliveries.id, deliveryId));
    return;
  }
  const [settings] = await db.select({ locale: ownerSettings.locale }).from(ownerSettings).where(eq(ownerSettings.userId, candidate.owner_id));
  const text = pushText(settings?.locale ?? "en", kindOf(candidate));
  const messages: ExpoMessage[] = devices.map((d) => ({
    to: d.token,
    ...text,
    data: { type: "research", jobId: candidate.job_id, profileId: candidate.profile_id },
    sound: "default",
    channelId: "research",
    priority: "high",
  }));
  let tickets: ExpoTicket[];
  try {
    tickets = await transport.send(messages);
  } catch (error) {
    // Transient (network, 5xx): try again on a later pass, a bounded number of times.
    const [row] = await db
      .update(pushDeliveries)
      .set({ attempts: sql`${pushDeliveries.attempts} + 1`, status: "sending" })
      .where(eq(pushDeliveries.id, deliveryId))
      .returning({ attempts: pushDeliveries.attempts });
    if ((row?.attempts ?? MAX_ATTEMPTS) >= MAX_ATTEMPTS) await db.update(pushDeliveries).set({ status: "failed" }).where(eq(pushDeliveries.id, deliveryId));
    log("push send failed", { error: error instanceof Error ? error.message : String(error) });
    return;
  }
  const recorded: PushTicket[] = [];
  const now = new Date();
  for (const [index, device] of devices.entries()) {
    const ticket = tickets[index];
    const error = !ticket ? "NoTicket" : ticket.status === "error" ? (ticket.details?.error ?? "Error") : null;
    recorded.push({ deviceId: device.id, ticketId: ticket && ticket.status === "ok" ? ticket.id : null, error });
    if (error === "DeviceNotRegistered") {
      await db.delete(pushDevices).where(eq(pushDevices.id, device.id));
    } else {
      await db
        .update(pushDevices)
        .set({ lastDeliveryAt: now, lastDeliveryStatus: error ? "failed" : "sent", lastDeliveryError: error })
        .where(eq(pushDevices.id, device.id));
    }
  }
  const anySent = recorded.some((t) => !t.error);
  await db
    .update(pushDeliveries)
    .set({ status: anySent ? "sent" : "failed", attempts: sql`${pushDeliveries.attempts} + 1`, tickets: recorded })
    .where(eq(pushDeliveries.id, deliveryId));
}

/** Send pending research notifications. Safe to call from several workers at once. */
export async function dispatchPushNotifications(
  db: Database,
  env: Pick<Env, "PUSH_NOTIFICATIONS_ENABLED" | "EXPO_ACCESS_TOKEN">,
  options: { transport?: PushTransport; log?: (m: string, e?: Record<string, unknown>) => void } = {},
): Promise<number> {
  if (!env.PUSH_NOTIFICATIONS_ENABLED) return 0;
  const transport = options.transport ?? expoTransport(env);
  const log = options.log ?? (() => undefined);
  let sent = 0;
  for (const candidate of await findCandidates(db)) {
    const [claimed] = await db
      .insert(pushDeliveries)
      .values({ jobId: candidate.job_id, ownerId: candidate.owner_id, event: candidate.event })
      .onConflictDoNothing({ target: [pushDeliveries.jobId, pushDeliveries.event] })
      .returning({ id: pushDeliveries.id });
    if (!claimed) continue; // another worker owns this one
    await deliver(db, transport, claimed.id, candidate, log);
    sent++;
  }
  // Deliveries that hit a transient error are retried here.
  const retry = await db
    .select({ id: pushDeliveries.id, jobId: pushDeliveries.jobId, ownerId: pushDeliveries.ownerId, event: pushDeliveries.event })
    .from(pushDeliveries)
    .where(and(eq(pushDeliveries.status, "sending"), sql`${pushDeliveries.attempts} > 0`, lt(pushDeliveries.updatedAt, new Date(Date.now() - 60_000))))
    .limit(10);
  for (const row of retry) {
    const job = await db.execute<{ status: string; profile_id: string | null }>(sql`SELECT status, profile_id FROM research_jobs WHERE id = ${row.jobId}`);
    if (!job.rows[0]) continue;
    await deliver(db, transport, row.id, { job_id: row.jobId, owner_id: row.ownerId, status: job.rows[0].status, profile_id: job.rows[0].profile_id, event: row.event }, log);
  }
  return sent;
}

/**
 * Check delivery receipts (Expo recommends waiting ~15 minutes) and drop
 * tokens that are no longer registered; record credential problems.
 */
export async function checkPushReceipts(db: Database, env: Pick<Env, "PUSH_NOTIFICATIONS_ENABLED" | "EXPO_ACCESS_TOKEN">, options: { transport?: PushTransport } = {}): Promise<number> {
  if (!env.PUSH_NOTIFICATIONS_ENABLED) return 0;
  const transport = options.transport ?? expoTransport(env);
  const due = await db
    .select()
    .from(pushDeliveries)
    .where(and(inArray(pushDeliveries.status, ["sent"]), isNull(pushDeliveries.receiptsCheckedAt), lt(pushDeliveries.updatedAt, new Date(Date.now() - 15 * 60_000))))
    .limit(50);
  let removed = 0;
  for (const delivery of due) {
    const tickets = delivery.tickets.filter((t) => t.ticketId);
    if (tickets.length > 0) {
      const receipts = await transport.receipts(tickets.map((t) => t.ticketId!));
      for (const ticket of tickets) {
        const receipt = receipts[ticket.ticketId!];
        if (!receipt || receipt.status === "ok") continue;
        const error = receipt.details?.error ?? "Error";
        if (error === "DeviceNotRegistered") {
          removed += (await db.delete(pushDevices).where(eq(pushDevices.id, ticket.deviceId)).returning({ id: pushDevices.id })).length;
        } else {
          await db.update(pushDevices).set({ lastDeliveryStatus: "failed", lastDeliveryError: error }).where(eq(pushDevices.id, ticket.deviceId));
        }
      }
    }
    await db.update(pushDeliveries).set({ receiptsCheckedAt: new Date() }).where(eq(pushDeliveries.id, delivery.id));
  }
  // Delivery records are only needed for de-duplication and receipts.
  await db.delete(pushDeliveries).where(lt(pushDeliveries.createdAt, new Date(Date.now() - 7 * 86_400_000)));
  return removed;
}
