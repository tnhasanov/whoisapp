import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { accounts, authRateLimits, sessions, users, verifications } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";

export const SESSION_COOKIE_PREFIX = "personbrief";
export const DEMO_EMAIL_DOMAIN = "demo.personbrief.invalid";

function buildAuth() {
  const env = getEnv();
  const db = getDb();
  const extraOrigins = (env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return betterAuth({
    appName: "PersonBrief",
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL, ...extraOrigins],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        rateLimit: authRateLimits,
      },
    }),
    emailAndPassword: {
      enabled: true,
      // Closed registration: the single owner is created by `npm run owner:create`
      // or the token-protected /setup page, never by public sign-up.
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
    },
    user: {
      additionalFields: {
        // Least privilege by default; only the owner-creation path sets "owner".
        role: { type: "string", required: false, defaultValue: "demo", input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: env.NODE_ENV === "production" || process.env.AUTH_RATE_LIMIT === "true",
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 300, max: 10 },
        "/sign-in/anonymous": { window: 3600, max: 10 },
      },
    },
    advanced: {
      cookiePrefix: SESSION_COOKIE_PREFIX,
      useSecureCookies: env.APP_URL.startsWith("https://"),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            // Anonymous visitors only ever receive the fictional demo role.
            if (user.isAnonymous === true || String(user.email).endsWith(`@${DEMO_EMAIL_DOMAIN}`)) {
              return { data: { ...user, role: "demo" } };
            }
            if (user.role === "owner") {
              const existing = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.role, "owner"))
                .limit(1);
              if (existing.length > 0) return false;
              return { data: user };
            }
            return { data: { ...user, role: "demo" } };
          },
        },
      },
    },
    plugins: [
      ...(env.PUBLIC_DEMO_ENABLED
        ? [
            anonymous({
              emailDomainName: DEMO_EMAIL_DOMAIN,
              generateName: () => "Demo visitor",
            }),
          ]
        : []),
      nextCookies(),
    ],
    telemetry: { enabled: false },
  });
}

type AuthInstance = ReturnType<typeof buildAuth>;
const globalForAuth = globalThis as unknown as { __personbriefAuth?: AuthInstance };

export function getAuth(): AuthInstance {
  globalForAuth.__personbriefAuth ??= buildAuth();
  return globalForAuth.__personbriefAuth;
}
