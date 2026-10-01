import { AlertTriangle, CircleCheck, Info, OctagonAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const calloutTones = {
  info: { box: "border-line bg-surface-2 text-ink-2", icon: Info, iconClass: "text-accent" },
  warn: { box: "border-[color-mix(in_srgb,var(--warn)_30%,transparent)] bg-warn-soft text-ink", icon: AlertTriangle, iconClass: "text-warn" },
  danger: { box: "border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-danger-soft text-ink", icon: OctagonAlert, iconClass: "text-danger" },
  ok: { box: "border-[color-mix(in_srgb,var(--ok)_30%,transparent)] bg-ok-soft text-ink", icon: CircleCheck, iconClass: "text-ok" },
} as const;

export function Callout({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof calloutTones;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const t = calloutTones[tone];
  const Icon = t.icon;
  return (
    <div className={cn("flex gap-3 rounded-lg border px-4 py-3", t.box, className)} role={tone === "danger" ? "alert" : undefined}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", t.iconClass)} aria-hidden />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {title ? <p className="font-medium text-ink">{title}</p> : null}
        {children ? <div className={cn(title ? "mt-0.5 text-ink-2" : "")}>{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface-2 px-6 py-10 text-center", className)}>
      {icon ? <div className="mb-3 text-subtle">{icon}</div> : null}
      <p className="font-medium text-ink">{title}</p>
      {children ? <div className="mt-1 max-w-md text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-soft-pulse rounded-md bg-sunken", className)} aria-hidden />;
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} role="status">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}
