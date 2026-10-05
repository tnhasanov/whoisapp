import "server-only";
import { ZodError, type z } from "zod";
import { resolveSession, type Viewer } from "@/lib/auth/session";
import { getDb, type Database } from "@/lib/db/client";
import { getEnv, type Env } from "@/lib/env";
import { ResearchCommandError, type Actor } from "@/lib/research/service";
import { MINIMUM_CLIENT_BUILD } from "@personbrief/shared/app";
import { CLIENT_BUILD_HEADER, IDEMPOTENCY_HEADER, idempotencyKey, uuid, type ApiErrorCode } from "@personbrief/shared/api/v1";

/**
 * Plumbing for /api/v1 route handlers: one error envelope, owner context from
 * the session (never from the request body), body validation with the shared
 * contracts, idempotency keys and opaque cursors.
 */

const BASE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, private",
  "X-Robots-Tag": "noindex, nofollow",
};

const STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_input: 400,
  invalid_state: 409,
  rate_limited: 429,
  live_not_configured: 503,
  live_not_allowed: 403,
  idempotency_key_required: 400,
  unsupported_client: 426,
  server_error: 500,
};

const DEFAULT_MESSAGE: Record<ApiErrorCode, string> = {
  unauthenticated: "Sign in to continue.",
  forbidden: "This account cannot do that.",
  not_found: "Not found.",
  invalid_input: "Please correct the highlighted fields.",
  invalid_state: "This item has changed. Refresh and try again.",
  rate_limited: "Too many requests. Please wait and try again.",
  live_not_configured: "Live research is not configured yet.",
  live_not_allowed: "Live research is only available to the owner account.",
  idempotency_key_required: "Missing Idempotency-Key header.",
  unsupported_client: "This version of the app is no longer supported. Please update it.",
  server_error: "Something went wrong. Please try again.",
};

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message?: string,
    readonly extra: { fieldErrors?: Record<string, string>; retryAfterSeconds?: number } = {},
  ) {
    super(message ?? DEFAULT_MESSAGE[code]);
    this.name = "ApiError";
  }
}

export function json(data: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return Response.json(data, { status: init.status ?? 200, headers: { ...BASE_HEADERS, ...init.headers } });
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: BASE_HEADERS });
}

export function errorResponse(error: ApiError): Response {
  const headers: Record<string, string> = {};
  if (error.extra.retryAfterSeconds !== undefined) headers["Retry-After"] = String(error.extra.retryAfterSeconds);
  return json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.extra.fieldErrors ? { fieldErrors: error.extra.fieldErrors } : {}),
        ...(error.extra.retryAfterSeconds !== undefined ? { retryAfterSeconds: error.extra.retryAfterSeconds } : {}),
      },
    },
    { status: STATUS[error.code], headers },
  );
}

function fromResearchError(error: ResearchCommandError): ApiError {
  return new ApiError(error.code, error.message, error.fieldErrors ? { fieldErrors: error.fieldErrors } : {});
}

/** Field → message code from a failed zod parse (messages are codes in the shared schemas). */
export function fieldErrorsOf(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? String(issue.path[0]) : "form";
    out[field] ??= /^[a-z_]+$/.test(issue.message) ? issue.message : "invalid";
  }
  return out;
}

export type ApiContext = {
  request: Request;
  db: Database;
  env: Env;
  viewer: Viewer;
  sessionId: string;
  sessionExpiresAt: Date;
  actor: Actor;
};

type RouteParams = { params: Promise<Record<string, string | string[]>> };

/** Reject builds the server no longer supports (header: "<platform>/<version>/<build>"). */
function checkClient(request: Request) {
  const header = request.headers.get(CLIENT_BUILD_HEADER);
  if (!header) return;
  const build = Number(header.split("/")[2]);
  if (Number.isFinite(build) && build < MINIMUM_CLIENT_BUILD) throw new ApiError("unsupported_client");
}

/**
 * Wrap a handler that needs a signed-in user. The owner context comes from
 * the session cookie only; every data function also filters by that owner.
 */
export function authed<P extends Record<string, string>>(handler: (ctx: ApiContext, params: P) => Promise<Response>) {
  return async (request: Request, route: RouteParams): Promise<Response> => {
    try {
      checkClient(request);
      const resolved = await resolveSession(request.headers);
      if (!resolved) throw new ApiError("unauthenticated");
      const { viewer, sessionId, expiresAt } = resolved;
      const ctx: ApiContext = {
        request,
        db: getDb(),
        env: getEnv(),
        viewer,
        sessionId,
        sessionExpiresAt: expiresAt,
        actor: { userId: viewer.userId, role: viewer.role, workspace: viewer.workspace },
      };
      return await handler(ctx, ((await route?.params) ?? {}) as P);
    } catch (error) {
      return handleError(error);
    }
  };
}

/** Wrap a public handler (no session required). */
export function open(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      checkClient(request);
      return await handler(request);
    } catch (error) {
      return handleError(error);
    }
  };
}

function handleError(error: unknown): Response {
  if (error instanceof ApiError) return errorResponse(error);
  if (error instanceof ResearchCommandError) return errorResponse(fromResearchError(error));
  if (error instanceof ZodError) return errorResponse(new ApiError("invalid_input", undefined, { fieldErrors: fieldErrorsOf(error) }));
  console.error("[api/v1]", error instanceof Error ? `${error.name}: ${error.message}` : error);
  return errorResponse(new ApiError("server_error"));
}

const MAX_BODY_BYTES = 64 * 1024;

/** Parse and validate a JSON body with a shared contract schema. */
export async function readBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new ApiError("invalid_input", "Request body is too large.");
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) throw new ApiError("invalid_input", "Request body is too large.");
    raw = text ? JSON.parse(text) : {};
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("invalid_input", "Request body must be JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError("invalid_input", undefined, { fieldErrors: fieldErrorsOf(parsed.error) });
  return parsed.data;
}

export function requireIdempotencyKey(request: Request): string {
  const key = request.headers.get(IDEMPOTENCY_HEADER);
  if (!key) throw new ApiError("idempotency_key_required");
  if (!idempotencyKey.safeParse(key).success) throw new ApiError("invalid_input", "Invalid Idempotency-Key.", { fieldErrors: { idempotencyKey: "invalid" } });
  return key;
}

/** A path id that must be a UUID; anything else is simply "not found". */
export function idParam(value: string | undefined, what = "Not found."): string {
  if (!value || !uuid.safeParse(value).success) throw new ApiError("not_found", what);
  return value;
}

export function requireOwnerRole(ctx: ApiContext) {
  if (ctx.viewer.role !== "owner") throw new ApiError("forbidden");
}

/* --------------------------------- Cursors -------------------------------- */

export function encodeCursor(value: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCursor<T extends Record<string, string | number>>(cursor: string | null | undefined, check: (v: Record<string, unknown>) => v is T): T | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<string, unknown>;
    if (value && typeof value === "object" && check(value)) return value;
  } catch {
    // fall through
  }
  throw new ApiError("invalid_input", "Invalid cursor.", { fieldErrors: { cursor: "invalid" } });
}

export function searchParams(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}
