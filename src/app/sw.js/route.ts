import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Service worker for the installed app. It makes repeat launches fast by
 * caching the hashed build assets, and shows a static offline notice — but it
 * never stores pages or API responses, so no private research is kept on the
 * device. The cache name follows the build, so each release replaces the old
 * cache.
 */

let buildId: string | null = null;
function currentBuildId(): string {
  if (buildId) return buildId;
  try {
    buildId = readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    buildId = "dev";
  }
  return buildId;
}

const SCRIPT = (version: string) => `/* PersonBrief service worker (${version}) */
const VERSION = ${JSON.stringify(`pb-${version}`)};
const CACHE = VERSION + "-static";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];
const STATIC_PREFIXES = ["/_next/static/", "/icons/", "/splash/"];
const MAX_ENTRIES = 400;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ENTRIES; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          cache.put(request, response.clone()).then(() => trim(cache));
        }
        return response;
      }),
    );
    return;
  }

  // Pages always come from the network: they contain private research and are never cached.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
  // Everything else (data, API, exports) goes straight to the network and is never stored.
});
`;

export function GET() {
  return new Response(SCRIPT(currentBuildId()), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
