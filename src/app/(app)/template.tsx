import type { ReactNode } from "react";

/** Re-mounts on navigation between sections, so each screen eases in like a native view. */
export default function AppTemplate({ children }: { children: ReactNode }) {
  return <div className="pb-page-enter">{children}</div>;
}
