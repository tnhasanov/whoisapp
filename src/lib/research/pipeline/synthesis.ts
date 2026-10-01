import { isValidPartialDateString, parsePartialDate, partialDateToString } from "@/lib/dates/partial-date";
import type { SnapshotOverview } from "@/lib/domain/types";
import type { SubjectDescriptor, SynthesisInput } from "@/lib/research/providers/types";
import type { SynthesisOutput } from "@/lib/research/schemas";
import { clip } from "@/lib/research/text";
import type { DraftSnapshot } from "./assemble";

const EVIDENCE_LABEL: Record<string, string> = {
  multiple_sources: "multiple independent sources",
  official_source: "official source",
  self_reported: "self-reported",
  single_source: "single source",
  snippet_only: "search snippet only",
  conflicting: "conflicting sources",
  inferred: "inferred",
};

export function buildSynthesisInput(draft: DraftSnapshot, subject: SubjectDescriptor, researchedAt: string): SynthesisInput {
  const period = (c: DraftSnapshot["claims"][number]) => {
    const start = partialDateToString(c.temporal.start);
    const end = partialDateToString(c.temporal.end);
    if (!start && !end) return c.temporal.currency === "stated_current" ? `stated as current (as of ${c.temporal.asOf ?? "unknown"})` : null;
    return `${start ?? "?"}–${end ?? (c.temporal.currency === "stated_current" ? "present (stated)" : "?")}`;
  };
  return {
    subject,
    researchedAt,
    claims: draft.claims.map((c) => ({
      id: c.tempId,
      category: c.category,
      text: c.displayValue,
      evidence: `${EVIDENCE_LABEL[c.evidenceStatus] ?? c.evidenceStatus}${c.temporal.possiblyOutdated ? "; possibly outdated" : ""}${c.conflictGroup ? "; conflicts with another claim" : ""}`,
      period: period(c),
      claimKey: c.claimKey,
    })),
    media: draft.stories.flatMap((s) =>
      s.items
        .filter((i) => i.isPrimary)
        .map((i) => ({
          id: i.tempId,
          headline: i.headline,
          outlet: i.outlet,
          publishedAt: i.publishedAt,
          coverageType: i.coverageType,
          summary: i.summary,
          involvement: i.involvement,
          mediaKey: i.mediaKey,
        })),
    ),
    gapsDetected: draft.gaps.map((g) => g.text),
  };
}

/**
 * Keep only grounded synthesis: every sentence must cite claim or media IDs
 * that exist in the draft. Unknown IDs are removed; sentences left without
 * support are dropped rather than shown unsupported.
 */
export function validateSynthesis(output: SynthesisOutput, draft: DraftSnapshot): SnapshotOverview {
  const claimIds = new Set(draft.claims.map((c) => c.tempId));
  const mediaIds = new Set(draft.stories.flatMap((s) => s.items.map((i) => i.tempId)));
  const keepClaims = (ids: string[]) => [...new Set(ids.filter((id) => claimIds.has(id)))];
  const keepMedia = (ids: string[]) => [...new Set(ids.filter((id) => mediaIds.has(id)))];

  const summary = output.summary
    .map((s) => ({ text: clip(s.text, 600), claimIds: keepClaims(s.claim_ids), mediaIds: keepMedia(s.media_ids), kind: s.kind }))
    .filter((s) => s.text && s.claimIds.length + s.mediaIds.length > 0)
    .slice(0, 8);
  const keyDevelopments = output.key_developments
    .map((k) => ({
      text: clip(k.text, 400),
      claimIds: keepClaims(k.claim_ids),
      mediaIds: keepMedia(k.media_ids),
      date: k.date && isValidPartialDateString(k.date) ? parsePartialDate(k.date) : null,
    }))
    .filter((k) => k.text && k.claimIds.length + k.mediaIds.length > 0)
    .slice(0, 8);
  const questions = output.questions
    .map((q) => ({ question: clip(q.question, 300), claimIds: keepClaims(q.claim_ids), mediaIds: keepMedia(q.media_ids) }))
    .filter((q) => q.question && q.claimIds.length + q.mediaIds.length > 0)
    .slice(0, 5);
  const known = new Set(draft.gaps.map((g) => g.text.toLowerCase()));
  const modelGaps = output.gaps
    .map((g) => clip(g.text, 240))
    .filter((t) => {
      // Also skips repeats within the model's own list.
      const key = t.toLowerCase();
      if (!t || known.has(key)) return false;
      known.add(key);
      return true;
    })
    .slice(0, 4)
    .map((text, i) => ({ code: `model_gap_${i + 1}`, text }));
  return {
    summary,
    keyDevelopments,
    gaps: [...draft.gaps, ...modelGaps],
    questions,
    narrativeAvailable: summary.length > 0,
  };
}

/** Overview used when synthesis failed or was skipped: deterministic gaps only, no narrative. */
export function overviewWithoutNarrative(draft: DraftSnapshot): SnapshotOverview {
  return { summary: [], keyDevelopments: [], gaps: draft.gaps, questions: [], narrativeAvailable: false };
}
