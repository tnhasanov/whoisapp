"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useEvidence, type EvidenceTarget } from "./evidence-context";

/**
 * Citation markers next to a fact. Each opens the evidence drawer. Numbers
 * refer to sources within the current snapshot (S-keys), like footnotes.
 */
export function CitationMarkers({ target, sourceIds, label }: { target: EvidenceTarget; sourceIds: string[]; label: string }) {
  const { open, view } = useEvidence();
  const t = useTranslations("Overview");
  const numbers = sourceIds
    .map((id) => view.sources.find((s) => s.id === id)?.sourceKey.replace(/^S/, ""))
    .filter((n): n is string => Boolean(n));
  return (
    <button
      type="button"
      onClick={() => open(target)}
      className="ml-1 inline-flex translate-y-[-1px] items-center gap-0.5 rounded px-1 align-middle text-[11px] font-semibold leading-4 text-accent hover:bg-accent-soft focus-visible:bg-accent-soft"
      aria-label={t("evidenceFor", { claim: label })}
      title={t("openEvidence")}
    >
      {numbers.length > 0 ? numbers.slice(0, 4).map((n) => <span key={n}>[{n}]</span>) : <span>[?]</span>}
      {numbers.length > 4 ? <span>+{numbers.length - 4}</span> : null}
    </button>
  );
}

/** Makes any block open evidence (keyboard accessible). */
export function EvidenceButton({ target, children, className, label }: { target: EvidenceTarget; children: ReactNode; className?: string; label: string }) {
  const { open } = useEvidence();
  return (
    <button type="button" onClick={() => open(target)} aria-label={label} className={cn("text-left", className)}>
      {children}
    </button>
  );
}
