/**
 * URL canonicalisation for de-duplicating sources. Canonical URLs are used
 * as identity keys only; the original URL is always preserved for display.
 */

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "yclid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref",
  "ref_src",
  "ref_url",
  "spm",
  "share",
  "s_cid",
  "_hsenc",
  "_hsmi",
  "utm_id",
]);

const MULTI_PART_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "com.az",
  "org.az",
  "net.az",
  "edu.az",
  "gov.az",
  "com.ru",
  "org.ru",
  "com.tr",
  "org.tr",
  "gov.tr",
  "edu.tr",
  "co.jp",
  "com.au",
  "com.br",
]);

export function canonicaliseUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return input.trim();
  }
  url.hash = "";
  url.username = "";
  url.password = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "").replace(/\.$/, "");
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }
  url.protocol = "https:";
  const params = [...url.searchParams.entries()]
    .filter(([key]) => !key.toLowerCase().startsWith("utm_") && !TRACKING_PARAMS.has(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));
  url.search = "";
  for (const [k, v] of params) url.searchParams.append(k, v);
  let path = url.pathname.replace(/\/{2,}/g, "/");
  // Index documents first, so "/team/index.php" and "/team/" both become "/team".
  path = path.replace(/\/(index|default)\.(html?|php|aspx?)$/i, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  url.pathname = path || "/";
  const out = url.toString();
  return out.endsWith("/") && url.pathname === "/" && !url.search ? out.slice(0, -1) : out;
}

export function hostnameOf(input: string): string | null {
  try {
    return new URL(input).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Registrable domain (eTLD+1) using a small built-in suffix list. */
export function registrableDomain(input: string): string | null {
  const host = hostnameOf(input) ?? input.toLowerCase();
  if (!host || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) return host || null;
  const labels = host.split(".");
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join(".");
  if (MULTI_PART_SUFFIXES.has(lastTwo)) return labels.slice(-3).join(".");
  return lastTwo;
}

/** Human-readable publisher fallback from a hostname ("news.baku-tech.example" → "baku-tech.example"). */
export function publisherFromUrl(input: string): string {
  return registrableDomain(input) ?? input;
}

export function sameSite(a: string, b: string): boolean {
  const da = registrableDomain(a);
  const db = registrableDomain(b);
  return Boolean(da && db && da === db);
}
