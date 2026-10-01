"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Side drawer on desktop, full-screen sheet on phones. Focus is trapped while
 * open and returned to the trigger on close (Radix Dialog).
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closeLabel = "Close",
  width = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  width?: "md" | "lg";
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(10_14_22/0.32)] backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className={cn(
            "fixed inset-0 z-50 flex flex-col bg-surface shadow-drawer outline-none",
            "sm:inset-y-0 sm:left-auto sm:right-0 sm:border-l sm:border-line",
            width === "lg" ? "sm:w-[min(640px,100vw)]" : "sm:w-[min(480px,100vw)]",
            "transition-transform duration-200 data-[state=closed]:translate-x-4",
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="font-serif text-lg font-semibold leading-snug text-ink">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-[13px] text-muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{typeof title === "string" ? title : ""}</Dialog.Description>}
            </div>
            <Dialog.Close
              className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-ink"
              aria-label={closeLabel}
            >
              <X className="h-5 w-5" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="border-t border-line px-5 py-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
