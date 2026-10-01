"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ProfileView } from "@/lib/data/profiles";
import { EvidenceDrawer } from "./evidence-drawer";

export type EvidenceTarget =
  | { kind: "claim"; id: string }
  | { kind: "source"; id: string }
  | { kind: "contact"; id: string }
  | { kind: "account"; id: string }
  | { kind: "relationship"; id: string }
  | { kind: "media"; id: string }
  | { kind: "organisation"; id: string };

type Ctx = { open: (target: EvidenceTarget) => void; view: ProfileView };

const EvidenceCtx = createContext<Ctx | null>(null);

export function EvidenceProvider({ view, children }: { view: ProfileView; children: ReactNode }) {
  const [target, setTarget] = useState<EvidenceTarget | null>(null);
  const [history, setHistory] = useState<EvidenceTarget[]>([]);
  const open = useCallback((next: EvidenceTarget) => {
    setTarget((current) => {
      if (current) setHistory((h) => [...h, current]);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ open, view }), [open, view]);
  return (
    <EvidenceCtx.Provider value={value}>
      {children}
      <EvidenceDrawer
        view={view}
        target={target}
        canGoBack={history.length > 0}
        onBack={() => {
          setHistory((h) => {
            const prev = h[h.length - 1];
            setTarget(prev ?? null);
            return h.slice(0, -1);
          });
        }}
        onNavigate={open}
        onClose={() => {
          setTarget(null);
          setHistory([]);
        }}
      />
    </EvidenceCtx.Provider>
  );
}

export function useEvidence() {
  const ctx = useContext(EvidenceCtx);
  if (!ctx) throw new Error("useEvidence must be used inside EvidenceProvider");
  return ctx;
}
