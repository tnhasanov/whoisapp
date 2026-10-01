import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/lib/db/client";
import { ownerSettings } from "@/lib/db/schema";
import { DEFAULT_TIMEZONE, LOCALES, type Locale, type UserRole, type Workspace } from "@/lib/domain/types";
import type { Actor } from "@/lib/research/service";
import { getAuth } from "./auth";

export type Viewer = {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  /** Anonymous visitor of the fictional public demo. */
  isGuest: boolean;
  workspace: Workspace;
  locale: Locale;
  timezone: string;
  theme: "system" | "light" | "dark";
};

/**
 * The authenticated viewer for this request (deduplicated per request).
 * Authorisation decisions always derive from this server-side record.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  let session: Awaited<ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>> = null;
  try {
    session = await getAuth().api.getSession({ headers: await headers() });
  } catch {
    return null;
  }
  if (!session) return null;
  const user = session.user as typeof session.user & { role?: string | null; isAnonymous?: boolean | null };
  const role: UserRole = user.role === "owner" ? "owner" : "demo";
  const db = getDb();
  let [settings] = await db.select().from(ownerSettings).where(eq(ownerSettings.userId, user.id));
  if (!settings) {
    await db
      .insert(ownerSettings)
      .values({ userId: user.id, activeWorkspace: role === "owner" ? "live" : "demo" })
      .onConflictDoNothing();
    [settings] = await db.select().from(ownerSettings).where(eq(ownerSettings.userId, user.id));
  }
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role,
    isGuest: role !== "owner",
    // Demo users are confined to the demo workspace regardless of stored settings.
    workspace: role === "owner" ? settings.activeWorkspace : "demo",
    locale: (LOCALES as readonly string[]).includes(settings.locale) ? settings.locale : "en",
    timezone: settings.timezone || DEFAULT_TIMEZONE,
    theme: settings.theme,
  };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  return viewer;
}

export async function requireOwner(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (viewer.role !== "owner") redirect("/search");
  return viewer;
}

export function actorOf(viewer: Viewer): Actor {
  return { userId: viewer.userId, role: viewer.role, workspace: viewer.workspace };
}
