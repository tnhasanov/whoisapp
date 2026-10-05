import { FIXTURE_EXAMPLES } from "@/fixtures/world";
import { authed, json } from "@/lib/api/v1/http";

export const dynamic = "force-dynamic";

/** Fictional example searches for the demo workspace (labels are translated by the app: Examples.<key>.*). */
export const GET = authed(async () =>
  json({
    items: FIXTURE_EXAMPLES.map((e) => ({
      key: e.key,
      label: e.label,
      scenario: e.scenario,
      fullName: e.fullName,
      company: e.company ?? null,
      country: e.country ?? null,
      profileUrl: e.profileUrl ?? null,
    })),
  }),
);
