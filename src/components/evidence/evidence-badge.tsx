"use client";

import { AlertTriangle, BadgeCheck, CircleDot, Layers, Lightbulb, TextQuote, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge, type Tone } from "@/components/ui/badge";
import type { EvidenceStatus } from "@/lib/domain/types";

const META: Record<EvidenceStatus, { tone: Tone; icon: typeof Layers }> = {
  multiple_sources: { tone: "ok", icon: Layers },
  official_source: { tone: "accent", icon: BadgeCheck },
  self_reported: { tone: "violet", icon: UserRound },
  single_source: { tone: "neutral", icon: CircleDot },
  snippet_only: { tone: "outline", icon: TextQuote },
  conflicting: { tone: "danger", icon: AlertTriangle },
  inferred: { tone: "violet", icon: Lightbulb },
};

export function EvidenceStatusBadge({ status, withHelp = false }: { status: EvidenceStatus; withHelp?: boolean }) {
  const t = useTranslations("Evidence");
  const meta = META[status];
  const Icon = meta.icon;
  return (
    <span className="inline-flex flex-col gap-1">
      <Badge tone={meta.tone} icon={<Icon className="h-3 w-3" aria-hidden />} title={t(`statusHelp.${status}`)}>
        {t(`status.${status}`)}
      </Badge>
      {withHelp ? <span className="text-xs leading-relaxed text-muted">{t(`statusHelp.${status}`)}</span> : null}
    </span>
  );
}
