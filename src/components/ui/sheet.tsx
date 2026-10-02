"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Dragging further than this share of the sheet's height, or flicking faster than this (px/ms), closes it. */
const DISMISS_DISTANCE = 0.25;
const DISMISS_VELOCITY = 0.55;

/**
 * Bottom sheet on phones (drag the handle down to close), side drawer from
 * tablet width up. Focus is trapped while open and returned to whatever
 * opened it (Radix Dialog).
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closeLabel,
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
  const tCommon = useTranslations("Common");
  // Opened programmatically (no Dialog.Trigger), so Radix has no trigger to refocus on close.
  const returnFocus = useRef<HTMLElement | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; startY: number; startTime: number; offset: number } | null>(null);

  const isPhone = () => window.matchMedia("(max-width: 639px)").matches;

  const onDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPhone() || event.button !== 0 || (event.target as HTMLElement).closest("button, a")) return;
    drag.current = { pointerId: event.pointerId, startY: event.clientY, startTime: event.timeStamp, offset: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (sheet.current) sheet.current.style.transition = "none";
  };
  const onDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId || !sheet.current) return;
    // Resist dragging upwards; follow the finger downwards.
    const delta = event.clientY - d.startY;
    d.offset = delta > 0 ? delta : delta / 6;
    sheet.current.style.transform = `translate3d(0, ${d.offset}px, 0)`;
  };
  const onDragEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    const el = sheet.current;
    if (!d || !el) return;
    const velocity = d.offset / Math.max(1, event.timeStamp - d.startTime);
    if (d.offset > el.offsetHeight * DISMISS_DISTANCE || (d.offset > 24 && velocity > DISMISS_VELOCITY)) {
      // The closing animation starts from where the finger let go.
      el.style.setProperty("--sheet-drag", `${d.offset}px`);
      el.style.transform = "";
      onOpenChange(false);
      return;
    }
    el.style.transition = "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)";
    el.style.transform = "";
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="pb-overlay fixed inset-0 z-40 bg-[rgb(10_14_22/0.38)] backdrop-blur-[2px]" />
        <Dialog.Content
          ref={sheet}
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus();
          }}
          className={cn(
            "pb-sheet fixed z-50 flex flex-col bg-surface shadow-drawer outline-none",
            // Phone: a sheet from the bottom that leaves the top of the screen visible.
            "inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+2.25rem)] rounded-t-[22px]",
            // Tablet and desktop: a drawer on the right.
            "sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:rounded-none sm:border-l sm:border-line",
            width === "lg" ? "sm:w-[min(640px,100vw)]" : "sm:w-[min(480px,100vw)]",
          )}
        >
          <div
            className="shrink-0 touch-none select-none sm:touch-auto"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            <div className="flex justify-center pb-1 pt-2.5 sm:hidden" aria-hidden>
              <span className="h-[5px] w-10 rounded-full bg-line-strong" />
            </div>
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 pb-3.5 pt-1.5 sm:py-4">
              <div className="min-w-0">
                <Dialog.Title className="font-serif text-lg font-semibold leading-snug text-ink">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-1 text-[13px] text-muted">{description}</Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{typeof title === "string" ? title : ""}</Dialog.Description>
                )}
              </div>
              <Dialog.Close
                className="-mr-1.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink active:bg-sunken"
                aria-label={closeLabel ?? tCommon("close")}
              >
                <X className="h-5 w-5" aria-hidden />
              </Dialog.Close>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
          {footer ? <div className="pb-safe-bottom border-t border-line px-5 py-3">{footer}</div> : <div className="pb-safe-bottom" />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
