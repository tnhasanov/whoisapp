import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { requireViewer } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getProfileView } from "./profiles";

/** Per-request cached, owner-scoped profile loader (404 for anyone but the owner). */
export const loadProfile = cache(async (profileId: string, snapshotId: string | null) => {
  const viewer = await requireViewer();
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) notFound();
  const view = await getProfileView(getDb(), viewer.userId, profileId, snapshotId && /^[0-9a-f-]{36}$/i.test(snapshotId) ? snapshotId : null);
  if (!view) notFound();
  return { viewer, view };
});
