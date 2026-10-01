import { isIP } from "node:net";

/**
 * Validation for URLs supplied by users or found in retrieved pages before
 * they are fetched or passed to a provider. Static checks only; the
 * connect-time address check lives in safe-fetch.ts.
 */

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: UrlRejection };

export type UrlRejection =
  | "invalid"
  | "scheme"
  | "credentials"
  | "port"
  | "internal_host"
  | "private_address"
  | "too_long";

const INTERNAL_SUFFIXES = [".local", ".localhost", ".internal", ".intranet", ".lan", ".home", ".corp", ".localdomain", ".home.arpa"];
const INTERNAL_HOSTS = new Set(["localhost", "metadata", "metadata.google.internal", "instance-data", "kubernetes", "kubernetes.default"]);

/** IPv4 ranges that must never be fetched (loopback, private, link-local/metadata, CGNAT, reserved…). */
const BLOCKED_V4: [number, number][] = [
  [0x00000000, 8], // 0.0.0.0/8
  [0x0a000000, 8], // 10.0.0.0/8
  [0x64400000, 10], // 100.64.0.0/10 CGNAT
  [0x7f000000, 8], // 127.0.0.0/8
  [0xa9fe0000, 16], // 169.254.0.0/16 link-local + cloud metadata
  [0xac100000, 12], // 172.16.0.0/12
  [0xc0000000, 24], // 192.0.0.0/24
  [0xc0000200, 24], // 192.0.2.0/24 TEST-NET-1
  [0xc0a80000, 16], // 192.168.0.0/16
  [0xc6120000, 15], // 198.18.0.0/15 benchmarking
  [0xc6336400, 24], // 198.51.100.0/24 TEST-NET-2
  [0xcb007100, 24], // 203.0.113.0/24 TEST-NET-3
  [0xe0000000, 4], // 224.0.0.0/4 multicast
  [0xf0000000, 4], // 240.0.0.0/4 reserved + broadcast
];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

export function isBlockedIPv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  return BLOCKED_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (value & mask) >>> 0 === (base & mask) >>> 0;
  });
}

function expandIPv6(ip: string): number[] | null {
  let address = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const zone = address.indexOf("%");
  if (zone !== -1) address = address.slice(0, zone);
  // Embedded IPv4 (e.g. ::ffff:127.0.0.1)
  const v4 = address.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const n = ipv4ToInt(v4[1]);
    address = address.replace(v4[1], `${((n >>> 16) & 0xffff).toString(16)}:${(n & 0xffff).toString(16)}`);
  }
  const parts = address.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":") : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (parts.length === 1 && missing !== 0)) return null;
  const groups = [...head, ...Array(parts.length === 2 ? missing : 0).fill("0"), ...tail].map((g) => parseInt(g || "0", 16));
  return groups.length === 8 && groups.every((g) => Number.isFinite(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

export function isBlockedIPv6(ip: string): boolean {
  const g = expandIPv6(ip);
  if (!g) return true;
  const allZeroPrefix = g.slice(0, 5).every((x) => x === 0);
  if (g.every((x) => x === 0)) return true; // ::
  if (allZeroPrefix && g[5] === 0 && g[6] === 0 && g[7] === 1) return true; // ::1
  if (allZeroPrefix && g[5] === 0xffff) {
    // IPv4-mapped
    return isBlockedIPv4(`${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`);
  }
  if (allZeroPrefix && g[5] === 0) return true; // IPv4-compatible (deprecated)
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  if (g[0] === 0x0064 && g[1] === 0xff9b) return true; // NAT64 (may map to private v4)
  if (g[0] === 0x2002) return true; // 6to4 (may embed private v4)
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip.replace(/^\[|\]$/g, ""));
  if (family === 4) return isBlockedIPv4(ip);
  if (family === 6) return isBlockedIPv6(ip);
  return true;
}

export function checkUrl(input: string, options: { allowHttp?: boolean } = {}): UrlCheck {
  if (input.length > 2048) return { ok: false, reason: "too_long" };
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const allowed = options.allowHttp === false ? ["https:"] : ["https:", "http:"];
  if (!allowed.includes(url.protocol)) return { ok: false, reason: "scheme" };
  if (url.username || url.password) return { ok: false, reason: "credentials" };
  if (url.port && !["80", "443"].includes(url.port)) return { ok: false, reason: "port" };
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return { ok: false, reason: "invalid" };
  const bare = host.replace(/^\[|\]$/g, "");
  if (isIP(bare)) {
    return isBlockedAddress(bare) ? { ok: false, reason: "private_address" } : { ok: true, url };
  }
  // Decimal / octal / hex IPv4 encodings ("2130706433", "0x7f.1") are rejected outright.
  if (/^(0x[0-9a-f]+|\d+)(\.(0x[0-9a-f]+|\d+)){0,3}$/i.test(host)) return { ok: false, reason: "private_address" };
  if (!host.includes(".")) return { ok: false, reason: "internal_host" };
  if (INTERNAL_HOSTS.has(host) || INTERNAL_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: "internal_host" };
  }
  return { ok: true, url };
}

/** Profile URLs supplied in the search form: https/http, public host, no credentials. */
export function validateProfileUrl(input: string): UrlCheck {
  return checkUrl(input, { allowHttp: true });
}
