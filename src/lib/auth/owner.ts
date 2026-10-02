import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { ownerSettings, users } from "@/lib/db/schema";
import { getEnv, setupTokenStatus } from "@/lib/env";
import { getAuth } from "./auth";

/**
 * Single-owner provisioning. Public sign-up is disabled; the owner is created
 * by the CLI or by the /setup page, which requires OWNER_SETUP_TOKEN and only
 * works while no owner exists. A partial unique index enforces one owner.
 */

export const OwnerInputSchema = z.object({
  name: z.string().trim().min(1, "invalid_name").max(120, "invalid_name"),
  email: z.string().trim().toLowerCase().email("invalid_email").max(254, "invalid_email"),
  password: z.string().min(12, "password_short").max(128, "password_long"),
});

export type OwnerErrorCode = "invalid_name" | "invalid_email" | "password_short" | "password_long" | "exists" | "email_taken" | "failed";

/** English text for the command-line tool; the web form translates the code. */
export const OWNER_ERROR_TEXT: Record<OwnerErrorCode, string> = {
  invalid_name: "Enter a name (up to 120 characters).",
  invalid_email: "Enter a valid email address.",
  password_short: "Password must be at least 12 characters.",
  password_long: "Password must be at most 128 characters.",
  exists: "An owner account already exists.",
  email_taken: "A user with this email already exists.",
  failed: "Could not create the owner account.",
};

export async function ownerExists(): Promise<boolean> {
  const [row] = await getDb().select({ id: users.id }).from(users).where(eq(users.role, "owner")).limit(1);
  return Boolean(row);
}

export async function createOwner(input: { name: string; email: string; password: string }): Promise<{ ok: true; userId: string } | { ok: false; error: OwnerErrorCode }> {
  const parsed = OwnerInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: (parsed.error.issues[0]?.message as OwnerErrorCode | undefined) ?? "failed" };
  if (await ownerExists()) return { ok: false, error: "exists" };

  const ctx = await getAuth().$context;
  const existing = await ctx.internalAdapter.findUserByEmail(parsed.data.email);
  if (existing) return { ok: false, error: "email_taken" };
  try {
    const hash = await ctx.password.hash(parsed.data.password);
    const user = await ctx.internalAdapter.createUser(
      { name: parsed.data.name, email: parsed.data.email, emailVerified: true, role: "owner" },
      { method: "admin" },
    );
    await ctx.internalAdapter.linkAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: hash });
    await getDb().insert(ownerSettings).values({ userId: user.id }).onConflictDoNothing();
    return { ok: true, userId: user.id };
  } catch (error) {
    // The single-owner unique index turns a concurrent second setup into a failure here.
    const message = error instanceof Error ? error.message : String(error);
    if (/single_owner|unique/i.test(message)) return { ok: false, error: "exists" };
    return { ok: false, error: "failed" };
  }
}

/** Constant-time comparison of the setup token; setup is disabled when no token is configured. */
export function verifySetupToken(candidate: string | null | undefined): boolean {
  const env = getEnv();
  if (setupTokenStatus(env) !== "ok" || !candidate) return false;
  const expected = env.OWNER_SETUP_TOKEN!.trim();
  candidate = candidate.trim();
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
