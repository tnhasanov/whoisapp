import { getAuth, HTTP_AUTH_PATHS } from "@/lib/auth/auth";
import { clientAddress } from "@/lib/api/client-address";
import { getDb } from "@/lib/db/client";
import { getEnv } from "@/lib/env";
import { consumeRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const PREFIX = "/api/auth";
const NO_STORE = { "Cache-Control": "no-store, private" };

function notFound() {
  return Response.json({ code: "NOT_FOUND", message: "Not found" }, { status: 404, headers: NO_STORE });
}

function tooMany(resetAt: Date) {
  const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
  return Response.json(
    { code: "TOO_MANY_REQUESTS", message: "Too many attempts. Please wait and try again." },
    { status: 429, headers: { ...NO_STORE, "Retry-After": String(retryAfter) } },
  );
}

/**
 * Better Auth over HTTP for the mobile app (the website signs in through
 * server actions). Only the endpoints in HTTP_AUTH_PATHS are reachable, and
 * sign-in attempts share the website's per-address and per-email limits.
 */
async function handle(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname.slice(PREFIX.length).replace(/\/+$/, "") || "/";
  if (!(HTTP_AUTH_PATHS as readonly string[]).includes(path)) return notFound();
  const env = getEnv();
  if (path === "/sign-in/anonymous" && !env.PUBLIC_DEMO_ENABLED) return notFound();

  if (request.method === "POST" && (path === "/sign-in/email" || path === "/sign-in/anonymous")) {
    const db = getDb();
    const address = clientAddress(request.headers);
    if (path === "/sign-in/anonymous") {
      const rate = await consumeRateLimit(db, `demo:ip:${address}`, 10, 3600);
      if (!rate.allowed) return tooMany(rate.resetAt);
    } else {
      let email = "";
      try {
        const body = (await request.clone().json()) as { email?: unknown };
        email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
      } catch {
        // Better Auth rejects the malformed body below.
      }
      const [byAddress, byEmail] = await Promise.all([
        consumeRateLimit(db, `signin:ip:${address}`, 20, 900),
        email ? consumeRateLimit(db, `signin:email:${email}`, 10, 900) : Promise.resolve(null),
      ]);
      if (!byAddress.allowed) return tooMany(byAddress.resetAt);
      if (byEmail && !byEmail.allowed) return tooMany(byEmail.resetAt);
    }
  }

  const response = await getAuth().handler(request);
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, private");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export const GET = handle;
export const POST = handle;
