import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate only: redirects visitors without a session cookie. Every
 * page, action, route handler and export still verifies the session and
 * ownership on the server — this check is not authorisation.
 */
const PUBLIC_PREFIXES = ["/sign-in", "/setup", "/api/health", "/robots.txt", "/favicon.ico", "/icon"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`))) {
    return NextResponse.next();
  }
  const session = getSessionCookie(request, { cookiePrefix: "personbrief" });
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const url = new URL("/sign-in", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|svg|ico|woff2?|ttf)$).*)"],
};
