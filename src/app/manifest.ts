import type { MetadataRoute } from "next";

/** Installable app (home screen) — standalone window, brand colours and icons. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PersonBrief",
    short_name: "PersonBrief",
    description: "Private, evidence-backed briefs for professional meetings.",
    start_url: "/search?source=app",
    scope: "/",
    display: "standalone",
    background_color: "#f6f4ee",
    theme_color: "#f6f4ee",
    lang: "en",
    dir: "ltr",
    categories: ["business", "productivity"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New research", short_name: "Research", url: "/search?source=shortcut", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96", type: "image/png" }] },
      { name: "Saved profiles", short_name: "Profiles", url: "/profiles?source=shortcut", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96", type: "image/png" }] },
    ],
  };
}
