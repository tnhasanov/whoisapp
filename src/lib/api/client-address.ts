/**
 * The caller's address for rate limiting. Behind Render (or another proxy)
 * the first X-Forwarded-For entry is the client; locally it is "local".
 * Used only as a limiter key, never stored with research data.
 */
export function clientAddress(headers: Headers): string {
  return (headers.get("x-forwarded-for")?.split(",")[0] ?? headers.get("x-real-ip") ?? "local").trim().slice(0, 64) || "local";
}
