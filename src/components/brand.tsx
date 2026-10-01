import { cn } from "@/lib/utils";

/** Centralised brand: change the product name or mark here. */
export const BRAND_NAME = "PersonBrief";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden focusable="false">
      <rect x="1" y="1" width="30" height="30" rx="7" className="fill-ink" />
      <path d="M10.5 23V9h6.2c3 0 4.9 1.7 4.9 4.4s-1.9 4.4-4.9 4.4h-3.3V23z" className="fill-canvas" />
      <rect x="13.4" y="11.6" width="5.4" height="3.6" rx="1.2" className="fill-[var(--accent)]" />
    </svg>
  );
}

export function BrandWordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark />
      {!compact ? <span className="font-serif text-[19px] font-semibold tracking-[-0.015em] text-ink">{BRAND_NAME}</span> : null}
    </span>
  );
}
