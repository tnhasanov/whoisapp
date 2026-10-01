"use client";

import { Check, ChevronDown, ExternalLink as ExternalIcon, MapPin, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refineAction, selectCandidateAction } from "@/app/actions/research";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/feedback";
import type { CandidateView, JobView } from "@/lib/data/jobs";
import { initials } from "@/lib/names";
import { displayHost, sourceHref } from "@/lib/source-links";
import { cn } from "@/lib/utils";

const NEGATIVE = new Set(["company_mismatch", "country_mismatch", "single_source"]);

export function IdentitySelection({ job }: { job: JobView }) {
  const t = useTranslations("Identity");
  const tJob = useTranslations("Job");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [choosing, setChoosing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = (candidateId: string) =>
    start(async () => {
      setError(null);
      setChoosing(candidateId);
      const result = await selectCandidateAction(job.id, candidateId);
      if (result.error) {
        setError(result.error);
        setChoosing(null);
      } else {
        router.refresh();
      }
    });

  return (
    <div className="space-y-6">
      <div>
        <div className="label-caps mb-1.5 flex items-center gap-2">
          {tJob("eyebrow")}
          {job.workspace === "demo" ? <Badge tone="demo">Demo</Badge> : null}
        </div>
        <h1 className="font-serif text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[32px]">{tJob("titleIdentity", { name: job.query.fullName })}</h1>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-muted">{t("subtitle", { count: job.candidates.length })}</p>
      </div>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <ul className="grid gap-4">
        {job.candidates.map((c) => (
          <li key={c.id}>
            <CandidateCard candidate={c} pending={pending} choosing={choosing === c.id} onChoose={() => choose(c.id)} />
          </li>
        ))}
      </ul>
      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">{t("noneHint")}</p>
        <Button variant="secondary" disabled={pending} onClick={() => start(() => refineAction(job.id))}>
          {t("noneOfThese")}
        </Button>
      </Card>
    </div>
  );
}

function CandidateCard({ candidate: c, pending, choosing, onChoose }: { candidate: CandidateView; pending: boolean; choosing: boolean; onChoose: () => void }) {
  const t = useTranslations("Identity");
  const [showSources, setShowSources] = useState(false);
  const tone = c.matchStrength === "strong" ? "ok" : c.matchStrength === "moderate" ? "accent" : "outline";
  return (
    <Card className={cn("p-5 sm:p-6", c.autoSelected && "ring-2 ring-accent/30")}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent-soft font-serif text-lg font-semibold text-accent-ink" aria-hidden>
            {initials(c.displayName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-xl font-semibold text-ink">{c.displayName}</h2>
              {c.nativeName && c.nativeName !== c.displayName ? <span className="text-sm text-muted">{c.nativeName}</span> : null}
              <Badge tone={tone}>{t(`matchStrength.${c.matchStrength}`)}</Badge>
              {c.autoSelected ? <Badge tone="accent">{t("autoSelected")}</Badge> : null}
            </div>
            <p className="mt-1 text-[14px] text-ink-2">{[c.role, c.organisation].filter(Boolean).join(" · ") || "—"}</p>
            {c.location ? (
              <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">{t("location")}: </span>
                {c.location}
              </p>
            ) : null}
            {c.summary ? <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">{c.summary}</p> : null}

            <div className="mt-4">
              <h3 className="label-caps">{t("whyMatches")}</h3>
              <ul className="mt-2 space-y-1.5">
                {c.matchReasons.map((r, i) => (
                  <li key={`${r.code}-${i}`} className="flex gap-2 text-[13px] leading-snug">
                    {NEGATIVE.has(r.code) ? (
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden />
                    ) : (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" aria-hidden />
                    )}
                    <span className="text-ink-2">{r.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {c.distinguishingFacts.length > 0 ? (
              <div className="mt-4">
                <h3 className="label-caps">{t("distinguishing")}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-ink-2">
                  {c.distinguishingFacts.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button
              type="button"
              className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
              aria-expanded={showSources}
              onClick={() => setShowSources((v) => !v)}
            >
              {t("viewSources")} ({t("sources", { count: c.sourceRefs.length })})
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showSources && "rotate-180")} aria-hidden />
            </button>
            {showSources ? (
              <ul className="mt-2 space-y-1.5 rounded-md border border-line bg-surface-2 p-3">
                {c.sourceRefs.map((s) => {
                  const link = sourceHref(s);
                  return (
                    <li key={s.key} className="text-[13px]">
                      {link.external ? (
                        <a href={link.href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-start gap-1 text-accent hover:underline">
                          <span className="break-anywhere">{s.title ?? displayHost(s.url)}</span>
                          <ExternalIcon className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                        </a>
                      ) : (
                        <Link href={link.href} className="text-accent hover:underline break-anywhere">
                          {s.title ?? displayHost(s.url)}
                        </Link>
                      )}
                      <span className="ml-1.5 text-xs text-muted">{s.publisher ?? displayHost(s.url)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
        <div className="sm:w-44 sm:shrink-0">
          <Button className="w-full" disabled={pending} onClick={onChoose}>
            {choosing ? t("choosing") : t("choose")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
