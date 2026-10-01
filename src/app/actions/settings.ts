"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { ownerSettings } from "@/lib/db/schema";
import { LOCALES } from "@/lib/domain/types";
import { getEnv } from "@/lib/env";

export type SettingsState = { ok?: boolean; error?: string } | undefined;

function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const PreferencesSchema = z.object({
  locale: z.enum(LOCALES),
  timezone: z.string().min(1).max(64).refine(validTimeZone),
  theme: z.enum(["system", "light", "dark"]),
});

export async function updatePreferencesAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const viewer = await requireViewer();
  const parsed = PreferencesSchema.safeParse({
    locale: formData.get("locale"),
    timezone: formData.get("timezone"),
    theme: formData.get("theme"),
  });
  if (!parsed.success) return { error: "invalid" };
  await getDb().update(ownerSettings).set(parsed.data).where(eq(ownerSettings.userId, viewer.userId));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateLimitsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const viewer = await requireViewer();
  if (viewer.role !== "owner") return { error: "forbidden" };
  const env = getEnv();
  const num = (name: string, max: number, min: number) => {
    const v = Number(formData.get(name));
    // The server cap is applied last so a minimum never lifts a value above it.
    return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : undefined;
  };
  const limits = {
    maxSearchQueries: num("maxSearchQueries", env.RESEARCH_MAX_SEARCH_QUERIES, 4),
    maxResultsPerQuery: num("maxResultsPerQuery", env.RESEARCH_MAX_RESULTS_PER_QUERY, 1),
    maxExtractPages: num("maxExtractPages", env.RESEARCH_MAX_EXTRACT_PAGES, 0),
    maxModelCalls: num("maxModelCalls", env.RESEARCH_MAX_MODEL_CALLS, 3),
    includeNews: formData.get("includeNews") === "on",
    newsWindowMonths: num("newsWindowMonths", 120, 1),
  };
  await getDb().update(ownerSettings).set({ researchLimits: limits }).where(eq(ownerSettings.userId, viewer.userId));
  revalidatePath("/settings");
  return { ok: true };
}
