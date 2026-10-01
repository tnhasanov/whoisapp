"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAuth } from "@/lib/auth/auth";
import { createOwner, ownerExists, verifySetupToken } from "@/lib/auth/owner";
import { getViewer, requireViewer } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { ownerSettings } from "@/lib/db/schema";
import { LOCALES, WORKSPACES, type Locale, type Workspace } from "@/lib/domain/types";
import { getEnv } from "@/lib/env";
import { consumeRateLimit } from "@/lib/rate-limit";
import { LOCALE_COOKIE } from "@/i18n/request";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined;

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/search";
}

async function clientKey(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("Auth");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: t("errors.missing") };
  const db = getDb();
  const ip = await clientKey();
  const [byIp, byEmail] = await Promise.all([
    consumeRateLimit(db, `signin:ip:${ip}`, 20, 900),
    consumeRateLimit(db, `signin:email:${email}`, 10, 900),
  ]);
  if (!byIp.allowed || !byEmail.allowed) return { error: t("errors.rateLimited") };
  try {
    await getAuth().api.signInEmail({ body: { email, password, rememberMe: true }, headers: await headers() });
  } catch {
    return { error: t("errors.invalid") };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signOutAction() {
  try {
    await getAuth().api.signOut({ headers: await headers() });
  } catch {
    // already signed out
  }
  redirect("/sign-in");
}

/** Opens a temporary, clearly fictional demo workspace (only when enabled). */
export async function startDemoAction(): Promise<FormState> {
  const t = await getTranslations("Auth");
  if (!getEnv().PUBLIC_DEMO_ENABLED) return { error: t("errors.demoDisabled") };
  const rate = await consumeRateLimit(getDb(), `demo:ip:${await clientKey()}`, 10, 3600);
  if (!rate.allowed) return { error: t("errors.rateLimited") };
  try {
    await getAuth().api.signInAnonymous({ headers: await headers() });
  } catch {
    return { error: t("errors.demoFailed") };
  }
  redirect("/search");
}

export async function setupOwnerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("Setup");
  if (await ownerExists()) return { error: t("errors.exists") };
  const rate = await consumeRateLimit(getDb(), `setup:ip:${await clientKey()}`, 10, 3600);
  if (!rate.allowed) return { error: t("errors.rateLimited") };
  if (!verifySetupToken(String(formData.get("token") ?? ""))) return { fieldErrors: { token: t("errors.token") } };
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return { fieldErrors: { confirm: t("errors.mismatch") } };
  const result = await createOwner({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password,
  });
  if (!result.ok) return { error: t(`errors.${result.error}`) };
  try {
    await getAuth().api.signInEmail({ body: { email: String(formData.get("email")).trim().toLowerCase(), password }, headers: await headers() });
  } catch {
    redirect("/sign-in");
  }
  redirect("/search");
}

export async function setWorkspaceAction(workspace: Workspace) {
  const viewer = await requireViewer();
  if (viewer.role !== "owner" || !(WORKSPACES as readonly string[]).includes(workspace)) return;
  await getDb().update(ownerSettings).set({ activeWorkspace: workspace }).where(eq(ownerSettings.userId, viewer.userId));
  revalidatePath("/", "layout");
  redirect("/search");
}

/** Language for signed-out pages (signed-in users change it in Settings). */
export async function setLocaleCookieAction(locale: Locale) {
  if (!(LOCALES as readonly string[]).includes(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: true });
  const viewer = await getViewer();
  if (viewer) await getDb().update(ownerSettings).set({ locale }).where(eq(ownerSettings.userId, viewer.userId));
  revalidatePath("/", "layout");
}
