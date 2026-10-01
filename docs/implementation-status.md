# Implementation status

Legend: **Implemented** (code complete) · **Fixture-tested** (automated tests
against the fictional demo world) · **Browser-tested** (Playwright, desktop and
phone) · **Live-tested** (against real providers) · **Deployed** ·
**Blocked** (needs something outside this repository).

| Feature | Status |
| --- | --- |
| Search with name variants (AZ/EN/RU), company, country, profile URL | Implemented · fixture-tested · browser-tested |
| Identity selection, refine search, documented auto-selection, reopen choice | Implemented · fixture-tested · browser-tested |
| Research progress (persisted stages, sources, elapsed, cancel, retry, survives refresh) | Implemented · fixture-tested · browser-tested |
| Durable worker: leases, fencing, heartbeats, stale sweep, checkpoints, idempotency, cancellation | Implemented · integration-tested |
| Provider failures (timeout, rate limit, unavailable) → partial result; retry reuses checkpoints | Implemented · fixture-tested · browser-tested |
| Overview: summary with citations, chronology with conflicts, education, affiliations, gaps, questions | Implemented · fixture-tested · browser-tested |
| Contacts & accounts rules (direct vs organisation, possible accounts) | Implemented · fixture-tested · browser-tested |
| Connections list and graph (documented vs shared affiliation, filters, keyboard) | Implemented · fixture-tested · browser-tested |
| News & media (grouping, syndication, direct/organisation/unresolved, filters, dates) | Implemented · fixture-tested · browser-tested |
| Sources (provenance, access limits, conflicts, coverage, rejected items) | Implemented · fixture-tested · browser-tested |
| Evidence drawer | Implemented · browser-tested (focus returns to opener) |
| Saved profiles, notes, tags, library search/sort, deletion | Implemented · integration- and browser-tested |
| Refresh and "What changed?" | Implemented · fixture-tested · browser-tested |
| PDF and JSON exports (EN/AZ/RU, notes opt-in) | Implemented · integration-tested · browser-tested |
| Settings (language, time zone, theme, budgets, provider status, usage) | Implemented · browser-tested |
| Data use page, report-an-issue | Implemented · browser-tested |
| Interface in English, Azerbaijani, Russian | Implemented · parity-tested · screenshots |
| Authentication, ownership checks, guest demo isolation | Implemented · integration- and browser-tested |
| Security: SSRF guards, hostile-text handling, rate limits, no-index headers, secrets server-side | Implemented · unit/integration-tested; client bundles scanned for secrets |
| Accessibility | axe (WCAG 2.1 AA rules): no serious/critical issues on main screens; keyboard flow tested |
| Live research (Tavily + Anthropic) | Implemented · unit-tested with mocked SDK clients · **Blocked: not live-tested** (no `TAVILY_API_KEY` / `ANTHROPIC_API_KEY` in the build environment) |
| Docker image and Compose stack | Implemented · compose file validated · **not built here** (no Docker daemon in the build environment) |
| Hosted preview | **Blocked: not deployed** (no hosting access authorised for this project) |

## Test inventory

- Unit (Vitest): 532 tests — names/transliteration, URL canonicalisation and
  SSRF checks, contacts, partial dates and locale-safe formatting, evidence
  merging, media grouping, snapshot diffs, identity rules, snapshot assembly,
  synthesis validation, prompts, fixture/Tavily/Anthropic providers, research
  config, query planning, message catalogues.
- Integration (Vitest + PostgreSQL): 28 tests — full demo pipeline, same-name
  separation, transliteration, partial + retry, refresh + diff, lease loss,
  stale jobs, cancellation, duplicate submissions, provider failures,
  ownership, live/demo separation, hostile content, unsafe URLs, deletion,
  JSON and PDF exports in three languages.
- End-to-end (Playwright): 16 tests — access control, full demo flow, identity
  choice, partial + retry, guest isolation, accessibility, keyboard use, phone
  layout, screenshot capture (desktop, phone, 320 px, dark mode, AZ, RU).

## Resuming work

`npm ci`, copy `.env.example` to `.env.local`, `npm run db:migrate`,
`npm run db:migrate:test`, then `npm test`. Open items are listed under
"Known limitations" in the final hand-off and in `README.md`.
