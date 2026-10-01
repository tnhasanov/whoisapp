import { Activity, BookUser, Search, Settings } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/search", key: "search", icon: Search, match: ["/search"] },
  { href: "/profiles", key: "profiles", icon: BookUser, match: ["/profiles"] },
  { href: "/research", key: "activity", icon: Activity, match: ["/research"] },
  { href: "/settings", key: "settings", icon: Settings, match: ["/settings", "/data-use"] },
] as const;
