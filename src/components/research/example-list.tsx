"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { openExampleAction } from "@/app/actions/research";
import type { FixtureExample } from "@/fixtures/types";

export function ExampleList({ examples }: { examples: FixtureExample[] }) {
  const t = useTranslations("Search");
  const [pending, start] = useTransition();
  return (
    <ul className="divide-y divide-line">
      {examples.map((ex, i) => (
        <li key={`${ex.label}-${i}`}>
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => openExampleAction(i))}
            className="group flex w-full items-start justify-between gap-3 py-3 text-left"
          >
            <span className="min-w-0">
              <span className="block text-[13.5px] font-medium text-ink group-hover:text-accent">
                {ex.label}
                <span className="ml-2 font-normal text-muted">· {ex.fullName}</span>
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{ex.scenario}</span>
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
