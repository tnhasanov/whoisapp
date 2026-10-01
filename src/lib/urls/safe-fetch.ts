import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { checkUrl, isBlockedAddress, type UrlRejection } from "./safe-url";

/**
 * SSRF-hardened page retrieval, used only when DIRECT_FETCH_ENABLED=true.
 * Provider-side extraction (Tavily) is the default retrieval path.
 *
 * Protections:
 * - http/https only, no credentials, ports 80/443 only, no internal hostnames
 * - DNS answers validated AT CONNECT TIME (the socket only connects to the
 *   address we validated), so DNS rebinding cannot swap in a private address
 * - every redirect re-validated; at most 3 hops; https→http downgrade refused
 * - response size and total time limits; text content types only
 * - no cookies, no auth headers, no request body
 */

export type SafeFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  signal?: AbortSignal;
  /** Test seam: replace DNS resolution. */
  resolver?: (hostname: string) => Promise<LookupAddress[]>;
};

export type SafeFetchResult = {
  url: string;
  status: number;
  contentType: string;
  text: string;
  truncated: boolean;
};

export class SafeFetchError extends Error {
  constructor(
    readonly reason: UrlRejection | "dns" | "blocked_address" | "redirect" | "status" | "content_type" | "timeout" | "network" | "aborted",
    message: string,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

const ALLOWED_TYPES = ["text/html", "text/plain", "application/xhtml+xml"];

function defaultResolver(hostname: string): Promise<LookupAddress[]> {
  return new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses);
    });
  });
}

function pinnedLookup(resolver: (h: string) => Promise<LookupAddress[]>): LookupFunction {
  return (hostname, options, callback) => {
    resolver(hostname)
      .then((addresses) => {
        const usable = addresses.filter((a) => !isBlockedAddress(a.address));
        if (addresses.length === 0 || usable.length !== addresses.length) {
          // Refuse when ANY answer is internal: mixed answers are a rebinding tell.
          callback(new SafeFetchError("blocked_address", "Destination resolves to a non-public address."), "", 4);
          return;
        }
        const chosen = usable[0];
        if (options && (options as { all?: boolean }).all) {
          (callback as unknown as (e: Error | null, a: LookupAddress[]) => void)(null, usable);
        } else {
          callback(null, chosen.address, chosen.family);
        }
      })
      .catch((e: Error) => callback(new SafeFetchError("dns", `DNS lookup failed: ${e.message}`), "", 4));
  };
}

function requestOnce(
  url: URL,
  opts: Required<Pick<SafeFetchOptions, "timeoutMs" | "maxBytes">> & { resolver: (h: string) => Promise<LookupAddress[]>; signal?: AbortSignal },
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        lookup: pinnedLookup(opts.resolver),
        headers: {
          "user-agent": "PersonBriefBot/1.0 (+research assistant; respects robots and paywalls)",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
          "accept-encoding": "identity",
        },
        timeout: opts.timeoutMs,
        signal: opts.signal,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        res.on("data", (chunk: Buffer) => {
          if (truncated) return;
          size += chunk.length;
          if (size > opts.maxBytes) {
            truncated = true;
            chunks.push(chunk.subarray(0, Math.max(0, chunk.length - (size - opts.maxBytes))));
            res.destroy();
            resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks), truncated });
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks), truncated }));
        res.on("error", (e) => reject(new SafeFetchError("network", e.message)));
      },
    );
    req.on("timeout", () => req.destroy(new SafeFetchError("timeout", "Request timed out.")));
    req.on("error", (e) => {
      if (e instanceof SafeFetchError) reject(e);
      else if (e.name === "AbortError") reject(new SafeFetchError("aborted", "Request aborted."));
      else reject(new SafeFetchError("network", e.message));
    });
    req.end();
  });
}

export async function safeFetchText(input: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxBytes = options.maxBytes ?? 1_500_000;
  const maxRedirects = options.maxRedirects ?? 3;
  const resolver = options.resolver ?? defaultResolver;
  const deadline = Date.now() + timeoutMs;

  let current = input;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const check = checkUrl(current);
    if (!check.ok) throw new SafeFetchError(check.reason, `URL rejected (${check.reason}).`);
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new SafeFetchError("timeout", "Request timed out.");
    const res = await requestOnce(check.url, { timeoutMs: remaining, maxBytes, resolver, signal: options.signal });

    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      const next = new URL(res.headers.location, check.url);
      if (check.url.protocol === "https:" && next.protocol === "http:") {
        throw new SafeFetchError("redirect", "Refused to follow an https→http redirect.");
      }
      current = next.toString();
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new SafeFetchError("status", `Unexpected status ${res.status}.`);
    const contentType = String(res.headers["content-type"] ?? "").toLowerCase();
    if (!ALLOWED_TYPES.some((t) => contentType.startsWith(t))) {
      throw new SafeFetchError("content_type", `Unsupported content type ${contentType || "(none)"}.`);
    }
    const raw = res.body.toString("utf8");
    return {
      url: current,
      status: res.status,
      contentType,
      text: contentType.startsWith("text/plain") ? raw : htmlToText(raw),
      truncated: res.truncated,
    };
  }
  throw new SafeFetchError("redirect", "Too many redirects.");
}

/** Minimal, dependency-free HTML → text. Scripts/styles are dropped; nothing is executed or rendered. */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|iframe|object|embed)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|p|div|li|h[1-6]|tr|section|article|header|footer)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n);
      return code > 31 && code < 0x110000 ? String.fromCodePoint(code) : " ";
    })
    // Last, so "&amp;lt;" decodes once to "&lt;" rather than twice to "<".
    .replace(/&amp;/g, "&")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}
