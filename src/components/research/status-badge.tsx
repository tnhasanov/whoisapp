import { useTranslations } from "next-intl";
import { Badge, type Tone } from "@/components/ui/badge";
import type { JobStatus } from "@/lib/domain/types";

const TONES: Record<JobStatus, Tone> = {
  queued: "neutral",
  running: "accent",
  awaiting_identity: "warn",
  completed: "ok",
  partial: "warn",
  failed: "danger",
  cancelled: "outline",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const t = useTranslations("Search.statuses");
  return <Badge tone={TONES[status]}>{t(status)}</Badge>;
}
