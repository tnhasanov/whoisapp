"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { openExampleAction } from "@/app/actions/research";
import type { FixtureExample } from "@/fixtures/types";

export function ExampleList({ examples }: { examples: FixtureExample[] }) {
  const t = useTranslations("Search");
  const tExamples = useTranslations("Examples");
  const text = (ex: FixtureExample, field: "label" | "scenario") => (tExamples.has(`${ex.key}.${field}`) ? tExamples(`${ex.key}.${field}`) : ex[field]);
  const [pending, start] = useTransition();
  return (
    <ul className="divide-y divide-line">
      {examples.map((ex, i) => (
        <li key={ex.key}>
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => openExampleAction(i))}
            className="group flex w-full items-start justify-between gap-3 py-3 text-left"
          >
            <span className="min-w-0">
              <span className="block text-[13.5px] font-medium text-ink group-hover:text-accent">
                {text(ex, "label")}
                <span className="ml-2 font-normal text-muted">· {ex.fullName}</span>
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{text(ex, "scenario")}</span>
            </span>
            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent">
              {t("tryExample")}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
