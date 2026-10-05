import { Platform } from "react-native";
import type { z } from "zod";
import { ApiErrorBodySchema, CLIENT_BUILD_HEADER, IDEMPOTENCY_HEADER } from "@personbrief/shared/api/v1";
import { sessionCookie } from "./auth-client";
import { API_CONFIG, CLIENT_ID, USER_AGENT } from "./config";

/**
 * Typed client for the PersonBrief /api/v1. Every response is validated with
 * the shared contracts, so a server change the app does not understand shows
 * an "update the app" state instead of broken screens. The session cookie
 * comes from SecureStore on each request (never cached in memory elsewhere).
 */

export type ApiErrorKind = "http" | "network" | "timeout" | "incompatible" | "config";

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    /** Server error code for "http" errors ("unauthenticated", "not_found", …). */
    readonly code: string,
    message: string,
    readonly status: number | null = null,
    readonly fieldErrors: Record<string, string> | null = null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isOffline() {
    return this.kind === "network" || this.kind === "timeout";
  }
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

type Listener = (error: ApiError) => void;
const unauthorizedListeners = new Set<Listener>();
const upgradeListeners = new Set<Listener>();

/** Called when the server says the session is gone (expired, revoked, signed out elsewhere). */
export function onUnauthorized(listener: Listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

/** Called when the server no longer supports this build. */
export function onUpgradeRequired(listener: Listener) {
  upgradeListeners.add(listener);
  return () => upgradeListeners.delete(listener);
}

export type RequestOptions<S extends z.ZodType | undefined> = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  schema?: S;
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Do not treat 401 as a session loss (used while checking a stored session). */
  quietUnauthorized?: boolean;
};

export function apiUrl(path: string, query?: RequestOptions<undefined>["query"]): string {
  if (!API_CONFIG.ok) throw new ApiError("config", "config", "The server address is not configured for this build.");
  const url = new URL(`/api/v1${path}`, API_CONFIG.baseUrl);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/** Headers that authenticate a request (also used for file downloads). */
export async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { [CLIENT_BUILD_HEADER]: CLIENT_ID };
  if (Platform.OS !== "web") {
    headers["user-agent"] = USER_AGENT;
    const cookie = await sessionCookie();
    if (cookie) headers.cookie = cookie;
  }
  return headers;
}

export async function request<S extends z.ZodType | undefined = undefined>(
  path: string,
  options: RequestOptions<S> = {},
): Promise<S extends z.ZodType ? z.output<S> : unknown> {
  const url = apiUrl(path, options.query);
  const headers: Record<string, string> = { Accept: "application/json", ...(await authHeaders()) };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers[IDEMPOTENCY_HEADER] = options.idempotencyKey;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort);
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      // Native: the cookie header above is the only credential. Web preview: same-origin cookies.
      credentials: Platform.OS === "web" ? "same-origin" : "omit",
    });
  } catch {
    if (options.signal?.aborted) throw new ApiError("network", "aborted", "Request cancelled.");
    const timedOut = controller.signal.aborted;
    throw new ApiError(timedOut ? "timeout" : "network", timedOut ? "timeout" : "offline", timedOut ? "The server took too long to respond." : "No connection to the server.");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onAbort);
  }

  if (response.status === 204) return undefined as never;
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const parsed = ApiErrorBodySchema.safeParse(payload);
    const body = parsed.success ? parsed.data.error : null;
    const error = new ApiError(
      "http",
      body?.code ?? (response.status === 401 ? "unauthenticated" : response.status >= 500 ? "server_error" : "error"),
      body?.message ?? `Request failed (${response.status}).`,
      response.status,
      body?.fieldErrors ?? null,
      body?.retryAfterSeconds ?? (Number(response.headers.get("retry-after")) || null),
    );
    if (response.status === 401 && !options.quietUnauthorized) unauthorizedListeners.forEach((l) => l(error));
    if (response.status === 426) upgradeListeners.forEach((l) => l(error));
    throw error;
  }

  if (!options.schema) return payload as never;
  const parsed = options.schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError("incompatible", "incompatible_response", "The server sent a response this version of the app does not understand.", response.status);
  }
  return parsed.data as never;
}
