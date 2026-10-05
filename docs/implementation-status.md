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
| Installable phone app: manifest, icons, iOS launch screens, service worker with offline screen, install guidance | Implemented · browser-tested (phone viewport, offline mode) |
| Phone polish: bottom sheet with swipe-to-close, back button, frosted tab bar, loading skeletons, 16 px inputs, share PDF | Implemented · browser-tested |
| Docker image and Compose stack | Implemented · compose file validated · **not built here** (no Docker daemon in the build environment) |
| Render Blueprint (website, worker, database) | Implemented · migrations tested concurrently · runtime-only heap caps, explicit storage, build filters · **deployment not verified from here** (no Render access; pushing the branch deploys it if a Blueprint is linked) |
| Hosted preview | **Blocked: not deployed** (no hosting access authorised for this project) |
| Public privacy page (`/privacy`) for store listings | Implemented · browser-tested (public, no account data, accessibility) |

### Phone app (`apps/mobile`, Expo SDK 57)

| Feature | Status |
| --- | --- |
| Versioned API `/api/v1` (identity, research, briefs, evidence, saved, notes, tags, history, changes, exports, settings, sessions, devices) | Implemented · integration-tested (owner isolation, idempotency, pagination, errors) · exercised by the app against a production-mode server |
| Shared contracts (`packages/shared`) used by website, worker and app | Implemented · type-checked in both projects |
| Sign-in (Better Auth Expo integration, SecureStore), restore, expiry, revocation, sign-out clean-up, account switching | Implemented · component-tested · live-server-tested |
| Search, choose the person, progress, cancel, retry, activity | Implemented · component-tested · live-server-tested |
| Person brief (overview, contacts & accounts, connections, news, sources), evidence sheet, notes & tags, what changed, report an issue | Implemented · component-tested · reviewed in phone-sized renders |
| PDF/JSON sharing (temporary files, notes opt-in), tap to call / email / copy | Implemented · component-tested (native share sheet not run) |
| Notifications (opt-in, generic text, session-bound, worker sender, receipt clean-up) | Implemented · server integration-tested · **not run on a device** (needs an Expo project and push credentials) |
| App lock (Face ID / fingerprint, passcode fallback, privacy cover) | Implemented · **not run on a device** |
| Deep links, offline state, background/resume polling, EN/AZ/RU, dark mode | Implemented · component-tested · renders reviewed |
| Release bundles (Hermes) and native project generation (`expo prebuild`) | Built for Android and iOS · bundles scanned for secrets |
| Device builds (APK/IPA), emulator/simulator runs | **Blocked:** no Android emulator or macOS here; EAS builds need the owner's Expo account (and Apple/Google accounts for signing) |
| Maestro smoke flows | Written · **not yet run** (no device) |
| Store listing drafts, privacy answers, Play icon and feature graphic | Prepared (`docs/mobile-store.md`) · nothing submitted |

## Test inventory

- Unit (Vitest): 537 tests — names/transliteration, URL canonicalisation and
  SSRF checks, contacts, partial dates and locale-safe formatting, evidence
  merging, media grouping, snapshot diffs, identity rules, snapshot assembly,
  synthesis validation, prompts, fixture/Tavily/Anthropic providers, research
  config, query planning, message catalogues.
- Integration (Vitest + PostgreSQL): 40 tests — full demo pipeline, same-name
  separation, transliteration, partial + retry, refresh + diff, lease loss,
  stale jobs, cancellation, duplicate submissions, provider failures,
  ownership, live/demo separation, worker key readiness, hostile content,
  unsafe URLs, deletion, JSON and PDF exports in three languages, the `/api/v1`
  contract (sessions, revocation, idempotency, pagination, devices, exports)
  and push delivery.
- End-to-end (Playwright): 19 tests — access control, full demo flow, identity
  choice, partial + retry, guest isolation, accessibility, keyboard use, phone
  layout (bottom sheet swipe, back button, no sideways scrolling), installable
  app (manifest, icons, offline screen, nothing private cached), screenshot
  capture (desktop, phone, 320 px, dark mode, AZ, RU), public privacy page.
- Phone app (Jest): 32 component/unit tests and 3 live-server tests; see
  [mobile-testing.md](mobile-testing.md) for these and the device checklist.

## Resuming work

`npm ci`, copy `.env.example` to `.env.local`, `npm run db:migrate`,
`npm run db:migrate:test`, then `npm test`. For the phone app:
`cd apps/mobile && npm ci && npm test` ([mobile-setup.md](mobile-setup.md)). Open items are listed under
"Known limitations" in the final hand-off and in `README.md`.
