import { z } from "zod";

/**
 * Server-side environment configuration.
 *
 * Parsed lazily so `next build` and tooling can import modules without a full
 * runtime environment. Secrets are never logged; validation errors list
 * variable names only.
 */

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = (schema: z.ZodString = z.string()) =>
  z.preprocess(emptyToUndefined, schema.optional());

const booleanFlag = (defaultValue: boolean) =>
  z.preprocess(
    emptyToUndefined,
    z
      .enum(["true", "false", "1", "0", "yes", "no"])
      .optional()
      .transform((v) =>
        v === undefined ? defaultValue : v === "true" || v === "1" || v === "yes",
      ),
  );

const intInRange = (min: number, max: number, defaultValue: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(min).max(max).optional().default(defaultValue),
  );

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  /** Public URL. On Render it defaults to the service's own URL (RENDER_EXTERNAL_URL). */
  APP_URL: z.preprocess(
    (value) => emptyToUndefined(value) ?? emptyToUndefined(process.env.RENDER_EXTERNAL_URL),
    z.string().url().default("http://localhost:3000"),
  ),
  /** Enables the web owner-setup page while no owner exists. */
  // Length is checked where it is used (see setupTokenStatus) so a short value never stops the app.
  OWNER_SETUP_TOKEN: optionalString(),
  /** Allows anonymous visitors to open a fictional demo workspace. */
  PUBLIC_DEMO_ENABLED: booleanFlag(false),
  /** Comma-separated extra origins trusted by the auth layer. */
  TRUSTED_ORIGINS: optionalString(),

  // Live research providers
  TAVILY_API_KEY: optionalString(),
  ANTHROPIC_API_KEY: optionalString(),
  ANTHROPIC_MODEL: z.preprocess(emptyToUndefined, z.string().default("claude-opus-5-5")),
  ANTHROPIC_EFFORT: z.preprocess(
    emptyToUndefined,
    z.enum(["low", "medium", "high", "xhigh", "max"]).default("medium"),
  ),
  ANTHROPIC_FALLBACKS: z.preprocess(emptyToUndefined, z.enum(["default", "off"]).default("default")),
  /** Optional API base URL override (e.g. an approved gateway). */
  ANTHROPIC_API_URL: optionalString(z.string().url()),

  // Hard server-side research budgets. Owner settings may only lower these.
  // Discovery uses up to 3 searches, so at least one is left for research.
  RESEARCH_MAX_SEARCH_QUERIES: intInRange(4, 60, 16),
  RESEARCH_MAX_RESULTS_PER_QUERY: intInRange(1, 20, 6),
  RESEARCH_MAX_EXTRACT_PAGES: intInRange(0, 60, 12),
  // Discovery, at least one extraction batch and synthesis.
  RESEARCH_MAX_MODEL_CALLS: intInRange(3, 40, 10),
  RESEARCH_MAX_OUTPUT_TOKENS: intInRange(1024, 64000, 16000),
  RESEARCH_MAX_SOURCE_CHARS: intInRange(2000, 200000, 24000),
  RESEARCH_PROVIDER_TIMEOUT_MS: intInRange(2000, 300000, 45000),
  RESEARCH_PROVIDER_MAX_RETRIES: intInRange(0, 5, 2),
  RESEARCH_MAX_JOBS_PER_HOUR: intInRange(1, 500, 20),

  // Worker
  WORKER_CONCURRENCY: intInRange(1, 16, 2),
  WORKER_LEASE_SECONDS: intInRange(15, 900, 90),
  WORKER_POLL_MS: intInRange(200, 60000, 1500),
  JOB_MAX_ATTEMPTS: intInRange(1, 10, 3),

  // Retention
  SOURCE_CONTENT_RETENTION_DAYS: intInRange(0, 365, 14),
  PROVIDER_CACHE_TTL_HOURS: intInRange(0, 24 * 90, 72),
  DEMO_GUEST_TTL_HOURS: intInRange(1, 24 * 30, 24),

  /** SSRF-protected direct page retrieval fallback (off by default). */
  DIRECT_FETCH_ENABLED: booleanFlag(false),

  /** Research-completion notifications to signed-in phones, sent through the Expo push service. */
  PUSH_NOTIFICATIONS_ENABLED: booleanFlag(true),
  /** Expo access token; only needed when "enhanced push security" is enabled for the Expo project. */
  EXPO_ACCESS_TOKEN: optionalString(),
  /** Contact shown on the public privacy page (/privacy); nothing is shown when unset. */
  SUPPORT_EMAIL: optionalString(z.string().email()),

  /** Simulated provider latency in the fictional demo (milliseconds per call). */
  FIXTURE_LATENCY_MS: intInRange(0, 10000, 350),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

export class EnvError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid server configuration: ${issues.join("; ")}`);
    this.name = "EnvError";
  }
}

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new EnvError(
      parsed.error.issues.map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`),
    );
  }
  cached = parsed.data;
  return cached;
}

/** For tests only. */
export function resetEnvCache() {
  cached = undefined;
}

/** The setup token must be long enough to resist guessing; a short one disables /setup. */
export const MIN_SETUP_TOKEN_LENGTH = 16;

export function setupTokenStatus(env: Env = getEnv()): "missing" | "too_short" | "ok" {
  const token = env.OWNER_SETUP_TOKEN?.trim();
  if (!token) return "missing";
  return token.length < MIN_SETUP_TOKEN_LENGTH ? "too_short" : "ok";
}

export type ProviderStatus = {
  tavily: boolean;
  anthropic: boolean;
  liveReady: boolean;
  model: string;
  effort: Env["ANTHROPIC_EFFORT"];
  fallbacks: Env["ANTHROPIC_FALLBACKS"];
  directFetch: boolean;
};

/** Configured/missing status only — never the secret values. */
export function getProviderStatus(env: Env = getEnv()): ProviderStatus {
  const tavily = Boolean(env.TAVILY_API_KEY);
  const anthropic = Boolean(env.ANTHROPIC_API_KEY);
  return {
    tavily,
    anthropic,
    liveReady: tavily && anthropic,
    model: env.ANTHROPIC_MODEL,
    effort: env.ANTHROPIC_EFFORT,
    fallbacks: env.ANTHROPIC_FALLBACKS,
    directFetch: env.DIRECT_FETCH_ENABLED,
  };
}
