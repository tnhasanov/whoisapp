"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FIXTURE_EXAMPLES } from "@/fixtures/world";
import { actorOf, requireViewer } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { ownerSettings } from "@/lib/db/schema";
import { deleteJob } from "@/lib/data/profiles";
import { getEnv } from "@/lib/env";
import {
  ResearchCommandError,
  cancelResearch,
  refineSearch,
  refreshProfile,
  reopenIdentityChoice,
  retryResearch,
  selectCandidate,
  startResearch,
} from "@/lib/research/service";

export type ResearchFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

async function messageFor(error: unknown): Promise<string> {
  const t = await getTranslations("Errors");
  if (error instanceof ResearchCommandError) return t(error.code);
  console.error("[research action]", error);
  return (await getTranslations("Common"))("error");
}

export async function startResearchAction(_prev: ResearchFormState, formData: FormData): Promise<ResearchFormState> {
  const viewer = await requireViewer();
  let jobId: string;
  try {
    const result = await startResearch(
      getDb(),
      getEnv(),
      actorOf(viewer),
      {
        fullName: String(formData.get("fullName") ?? ""),
        company: String(formData.get("company") ?? ""),
        country: String(formData.get("country") ?? ""),
        profileUrl: String(formData.get("profileUrl") ?? ""),
      },
      String(formData.get("idempotencyKey") ?? ""),
    );
    jobId = result.jobId;
  } catch (error) {
    if (error instanceof ResearchCommandError && error.fieldErrors) {
      return { error: await messageFor(error), fieldErrors: error.fieldErrors };
    }
    return { error: await messageFor(error) };
  }
  redirect(`/research/${jobId}`);
}

export async function selectCandidateAction(jobId: string, candidateId: string): Promise<{ error?: string }> {
  const viewer = await requireViewer();
  try {
    await selectCandidate(getDb(), actorOf(viewer), jobId, candidateId);
  } catch (error) {
    return { error: await messageFor(error) };
  }
  revalidatePath(`/research/${jobId}`);
  return {};
}

export async function refineAction(jobId: string) {
  const viewer = await requireViewer();
  const query = await refineSearch(getDb(), actorOf(viewer), jobId);
  const params = new URLSearchParams({ name: query.fullName });
  if (query.company) params.set("company", query.company);
  if (query.country) params.set("country", query.country);
  if (query.profileUrl) params.set("profileUrl", query.profileUrl);
  redirect(`/search?${params.toString()}`);
}

export async function cancelJobAction(jobId: string): Promise<{ error?: string }> {
  const viewer = await requireViewer();
  try {
    await cancelResearch(getDb(), actorOf(viewer), jobId);
  } catch (error) {
    return { error: await messageFor(error) };
  }
  revalidatePath(`/research/${jobId}`);
  return {};
}

export async function retryJobAction(jobId: string, idempotencyKey: string): Promise<{ error?: string }> {
  const viewer = await requireViewer();
  let childId: string;
  try {
    childId = await retryResearch(getDb(), getEnv(), actorOf(viewer), jobId, idempotencyKey);
  } catch (error) {
    return { error: await messageFor(error) };
  }
  redirect(`/research/${childId}`);
}

export async function reopenIdentityAction(jobId: string, idempotencyKey: string): Promise<{ error?: string }> {
  const viewer = await requireViewer();
  let childId: string;
  try {
    childId = await reopenIdentityChoice(getDb(), getEnv(), actorOf(viewer), jobId, idempotencyKey);
  } catch (error) {
    return { error: await messageFor(error) };
  }
  redirect(`/research/${childId}`);
}

export async function refreshProfileAction(profileId: string, idempotencyKey: string): Promise<{ error?: string }> {
  const viewer = await requireViewer();
  let jobId: string;
  try {
    jobId = await refreshProfile(getDb(), getEnv(), actorOf(viewer), profileId, idempotencyKey);
  } catch (error) {
    return { error: await messageFor(error) };
  }
  redirect(`/research/${jobId}`);
}

export async function deleteJobAction(jobId: string) {
  const viewer = await requireViewer();
  await deleteJob(getDb(), viewer.userId, jobId);
  revalidatePath("/research");
}

/** Fictional examples always run in the demo workspace. */
export async function openExampleAction(index: number) {
  const viewer = await requireViewer();
  const example = FIXTURE_EXAMPLES[index];
  if (!example) redirect("/search");
  if (viewer.role === "owner" && viewer.workspace !== "demo") {
    await getDb().update(ownerSettings).set({ activeWorkspace: "demo" }).where(eq(ownerSettings.userId, viewer.userId));
    revalidatePath("/", "layout");
  }
  const params = new URLSearchParams({ name: example.fullName, ex: String(index) });
  if (example.company) params.set("company", example.company);
  if (example.country) params.set("country", example.country);
  if (example.profileUrl) params.set("profileUrl", example.profileUrl);
  redirect(`/search?${params.toString()}`);
}

export async function newIdempotencyKey(): Promise<string> {
  return randomUUID().replace(/-/g, "");
}
