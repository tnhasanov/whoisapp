import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { requireViewer } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
