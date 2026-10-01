"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/session";
import { addNote, addTag, deleteNote, deleteProfile, removeTag, reportIssue, setSaved, updateNote } from "@/lib/data/profiles";
import { getDb } from "@/lib/db/client";
import { ISSUE_CATEGORIES, type IssueCategory } from "@/lib/domain/types";

const uuid = z.string().uuid();

function check(id: string) {
  if (!uuid.safeParse(id).success) throw new Error("Invalid id");
}

export async function toggleSaveAction(profileId: string, saved: boolean) {
  const viewer = await requireViewer();
  check(profileId);
  await setSaved(getDb(), viewer.userId, profileId, saved);
  revalidatePath(`/profiles/${profileId}`);
  revalidatePath("/profiles");
}

export async function addNoteAction(profileId: string, body: string): Promise<{ ok: boolean }> {
  const viewer = await requireViewer();
  check(profileId);
  const ok = await addNote(getDb(), viewer.userId, profileId, body);
  revalidatePath(`/profiles/${profileId}`);
  return { ok };
}

export async function updateNoteAction(profileId: string, noteId: string, body: string): Promise<{ ok: boolean }> {
  const viewer = await requireViewer();
  check(profileId);
  check(noteId);
  const ok = await updateNote(getDb(), viewer.userId, noteId, body);
  revalidatePath(`/profiles/${profileId}`);
  return { ok };
}

export async function deleteNoteAction(profileId: string, noteId: string) {
  const viewer = await requireViewer();
  check(profileId);
  check(noteId);
  await deleteNote(getDb(), viewer.userId, noteId);
  revalidatePath(`/profiles/${profileId}`);
}

export async function addTagAction(profileId: string, name: string): Promise<{ ok: boolean }> {
  const viewer = await requireViewer();
  check(profileId);
  const ok = await addTag(getDb(), viewer.userId, profileId, name);
  revalidatePath(`/profiles/${profileId}`);
  revalidatePath("/profiles");
  return { ok };
}

export async function removeTagAction(profileId: string, tagId: string) {
  const viewer = await requireViewer();
  check(profileId);
  check(tagId);
  await removeTag(getDb(), viewer.userId, profileId, tagId);
  revalidatePath(`/profiles/${profileId}`);
  revalidatePath("/profiles");
}

export async function deleteProfileAction(profileId: string) {
  const viewer = await requireViewer();
  check(profileId);
  await deleteProfile(getDb(), viewer.userId, profileId);
  revalidatePath("/profiles");
  redirect("/profiles");
}

export async function reportIssueAction(
  _prev: { ok?: boolean; error?: string } | undefined,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const viewer = await requireViewer();
  const profileId = String(formData.get("profileId") ?? "");
  check(profileId);
  const category = String(formData.get("category") ?? "other");
  const message = String(formData.get("message") ?? "");
  if (!(ISSUE_CATEGORIES as readonly string[]).includes(category) || !message.trim()) return { error: "invalid" };
  const snapshotId = String(formData.get("snapshotId") ?? "") || null;
  const claimId = String(formData.get("claimId") ?? "") || null;
  const ok = await reportIssue(getDb(), viewer.userId, {
    profileId,
    snapshotId: snapshotId && uuid.safeParse(snapshotId).success ? snapshotId : null,
    claimId: claimId && uuid.safeParse(claimId).success ? claimId : null,
    category: category as IssueCategory,
    message,
  });
  revalidatePath(`/profiles/${profileId}/report`);
  return ok ? { ok: true } : { error: "invalid" };
}
