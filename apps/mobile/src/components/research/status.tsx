import { useTranslations } from "use-intl";
import type { JobStatus } from "@personbrief/shared/domain";
import { Badge, type BadgeTone } from "../ui/badge";

const TONE: Record<JobStatus, BadgeTone> = {
  queued: "neutral",
  running: "accent",
  awaiting_identity: "violet",
  completed: "ok",
  partial: "warn",
  failed: "danger",
  cancelled: "outline",
};

export function JobStatusBadge({ status, outcome }: { status: JobStatus; outcome?: string | null }) {
  const t = useTranslations("Search.statuses");
  const tOutcome = useTranslations("Activity.outcomes");
  if (outcome === "no_candidates" || outcome === "refined") return <Badge tone="outline" label={tOutcome(outcome)} />;
  return <Badge tone={TONE[status]} label={t(status)} />;
}
