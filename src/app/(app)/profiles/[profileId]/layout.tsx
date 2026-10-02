import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireViewer } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";

/**
 * Ownership is checked here, before the loading skeleton streams, so a profile
 * that is not yours (or does not exist) answers with a real 404.
 */
export default async function ProfileLayout({ children, params }: { children: ReactNode; params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) notFound();
  const viewer = await requireViewer();
  const [owned] = await getDb()
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.ownerId, viewer.userId)))
    .limit(1);
  if (!owned) notFound();
  return children;
}
