import { and, desc, eq, gt, ne } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";

export type SessionDevice = "app_ios" | "app_android" | "browser" | "unknown";

/** Coarse description of a session's client from its user agent (no version fingerprinting). */
export function describeUserAgent(userAgent: string | null | undefined): { device: SessionDevice; label: string } {
  const ua = userAgent ?? "";
  const app = /PersonBriefApp\/[\d.]+\s*\(([^;)]*)/i.exec(ua);
  if (app) {
    const platform = app[1].toLowerCase();
    if (platform.startsWith("ios")) return { device: "app_ios", label: "PersonBrief app · iOS" };
    if (platform.startsWith("android")) return { device: "app_android", label: "PersonBrief app · Android" };
    return { device: "unknown", label: "PersonBrief app" };
  }
  if (!ua) return { device: "unknown", label: "Unknown device" };
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  const os = /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : null;
  if (!browser && !os) return { device: "unknown", label: "Unknown device" };
  return { device: "browser", label: [browser ?? "Browser", os].filter(Boolean).join(" · ") };
}

export type SessionInfo = {
  id: string;
  current: boolean;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  device: SessionDevice;
  label: string;
};

/** The user's active sessions (current first). IP addresses and tokens are never returned. */
export async function listUserSessions(db: Database, userId: string, currentSessionId: string): Promise<SessionInfo[]> {
  const rows = await db
    .select({ id: sessions.id, createdAt: sessions.createdAt, updatedAt: sessions.updatedAt, expiresAt: sessions.expiresAt, userAgent: sessions.userAgent })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.updatedAt));
  return rows
    .map((r) => ({
      id: r.id,
      current: r.id === currentSessionId,
      createdAt: r.createdAt.toISOString(),
      lastActiveAt: r.updatedAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      ...describeUserAgent(r.userAgent),
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

/** Revoke one of the user's sessions (its push registration is removed with it). */
export async function revokeUserSession(db: Database, userId: string, sessionId: string): Promise<boolean> {
  const deleted = await db.delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId))).returning({ id: sessions.id });
  return deleted.length > 0;
}

/** "Sign out everywhere else". */
export async function revokeOtherSessions(db: Database, userId: string, currentSessionId: string): Promise<number> {
  const deleted = await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId))).returning({ id: sessions.id });
  return deleted.length;
}
