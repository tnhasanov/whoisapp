import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { ownerSettings, users } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { getAuth } from "./auth";

/**
 * Single-owner provisioning. Public sign-up is disabled; the owner is created
 * by the CLI or by the /setup page, which requires OWNER_SETUP_TOKEN and only
 * works while no owner exists. A partial unique index enforces one owner.
 */

export const OwnerInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12, "Password must be at least 12 characters.").max(128),
});

export async function ownerExists(): Promise<boolean> {
  const [row] = await getDb().select({ id: users.id }).from(users).where(eq(users.role, "owner")).limit(1);
  return Boolean(row);
}

export async function createOwner(input: { name: string; email: string; password: string }): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const parsed = OwnerInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  if (await ownerExists()) return { ok: false, error: "An owner account already exists." };

  const ctx = await getAuth().$context;
  const existing = await ctx.internalAdapter.findUserByEmail(parsed.data.email);
  if (existing) return { ok: false, error: "A user with this email already exists." };
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
    if (/single_owner|unique/i.test(message)) return { ok: false, error: "An owner account already exists." };
    return { ok: false, error: "Could not create the owner account." };
  }
}

/** Constant-time comparison of the setup token; setup is disabled when no token is configured. */
export function verifySetupToken(candidate: string | null | undefined): boolean {
  const expected = getEnv().OWNER_SETUP_TOKEN;
  if (!expected || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
