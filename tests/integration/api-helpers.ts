import { getAuth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db/client";
import { ownerSettings } from "@/lib/db/schema";
import * as authRoute from "@/app/api/auth/[...all]/route";

export const BASE = "http://localhost:3000";
export const APP_ORIGIN = "personbrief://";
const PASSWORD = "integration-only-password";

type Handler = (request: Request, route: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** A user with an email/password credential (the owner, or a second, demo-only account). */
export async function createPasswordUser(role: "owner" | "demo", email: string) {
  const ctx = await getAuth().$context;
  const user = await ctx.internalAdapter.createUser({ name: role === "owner" ? "Owner" : "Other account", email, emailVerified: true, role }, { method: "admin" });
  await ctx.internalAdapter.linkAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: await ctx.password.hash(PASSWORD) });
  await getDb().insert(ownerSettings).values({ userId: user.id, activeWorkspace: role === "owner" ? "live" : "demo" }).onConflictDoNothing();
  return { id: user.id as string, email };
}

/** Cookie header from Set-Cookie response headers (what the app keeps in SecureStore). */
export function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => !c.endsWith("="))
    .join("; ");
}

/** Sign in exactly like the mobile app: POST /api/auth/sign-in/email with the app's expo-origin header. */
export async function signIn(email: string, password = PASSWORD, headers: Record<string, string> = {}) {
  const response = await authRoute.POST(
    new Request(`${BASE}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", "expo-origin": APP_ORIGIN, "user-agent": "PersonBriefApp/1.0.0 (ios 18.0)", ...headers },
      body: JSON.stringify({ email, password, rememberMe: true }),
    }),
  );
  return { response, cookie: cookieHeader(response) };
}

export async function authCall(path: string, init: { method?: string; cookie?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  const headers: Record<string, string> = { "expo-origin": APP_ORIGIN, ...init.headers };
  if (init.cookie) headers.cookie = init.cookie;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  const request = new Request(`${BASE}/api/auth${path}`, { method: init.method ?? "GET", headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined });
  return request.method === "GET" ? authRoute.GET(request) : authRoute.POST(request);
}

/** Call a /api/v1 route handler the way Next.js does. */
export async function call(
  handler: Handler,
  path: string,
  init: { method?: string; cookie?: string; body?: unknown; headers?: Record<string, string>; params?: Record<string, string> } = {},
): Promise<Response> {
  const headers: Record<string, string> = { ...init.headers };
  if (init.cookie) headers.cookie = init.cookie;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  const request = new Request(`${BASE}/api/v1${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body),
  });
  return handler(request, { params: Promise.resolve(init.params ?? {}) });
}

export async function body<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
