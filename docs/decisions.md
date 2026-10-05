# Decision log

Short records of the choices that shape PersonBrief. Newest last.

1. **Next.js App Router + a separate worker process, coordinated through
   PostgreSQL.** Research jobs are rows; workers claim them with
   `FOR UPDATE SKIP LOCKED`, hold a lease, heartbeat, and write every step as a
   checkpoint. No Redis or in-memory queue: a restart or redeploy never loses
   work, and the web app never runs research inside a request.
2. **Fencing tokens on every write.** Each claim increments `lease_token`; all
   job writes run in a transaction that first locks the row and checks the
   token and `running` status. A stalled or cancelled worker can never
   overwrite newer results. The final snapshot, the `persist` checkpoint and the
   job's terminal state are committed in one transaction.
3. **Retries reuse checkpoints.** A retry is a new job (`kind = retry`) that
   copies the parent's reusable completed steps and documents, so only failed
   or remaining work runs again and the original run stays inspectable.
4. **Single owner, no public sign-up.** Better Auth email/password with
   sign-up disabled; the owner is created by CLI or once through a
   token-protected `/setup`. A partial unique index enforces one owner.
   Anonymous demo guests (optional) always have the `demo` role and workspace.
5. **Two strictly separate workspaces.** Every research row carries
   `workspace` (`live` or `demo`). Providers are chosen by workspace; live
   research has no fallback to fixtures, and demo data never appears in live
   views or exports. Demo exports are marked as fictional.
6. **Identity is confirmed before research.** Automatic selection only when
   exactly one candidate matches a supplied profile URL, or exactly one
   candidate is linked to the supplied company, its name matches exactly or by
   transliteration, and at least two independent websites describe it.
   Otherwise the owner chooses. Automatic choices can be reopened.
7. **The model proposes, deterministic code decides.** Discovery, extraction
   and synthesis use structured outputs validated with Zod, then
   `assembleSnapshot` verifies everything: excerpts must appear verbatim in the
   retrieved text, contact values must appear on the page, sources must be
   about the identified person, and summaries may only cite verified claims or
   media. Rejected items are kept as diagnostics.
8. **Evidence labels count independent publishers.** Syndicated or copied
   articles count once; an official biography is labelled "Official source",
   not independent verification. Conflicting dates are kept side by side in a
   conflict group instead of being merged.
9. **Contacts.** Only routes published for professional contact. Reception or
   switchboard numbers and shared inboxes are organisation routes, never
   "direct". Personal mobiles only when self-published for business. A number
   must appear in full on the page (national or international form); a shorter
   fragment never confirms a longer value.
10. **Accounts and connections.** An account is accepted only when an
    identity-confirmed source links to it; a matching name alone makes it a
    "possible" account shown separately. Shared employers or boards become
    shared affiliations, never personal relationships.
11. **News dates.** Publication dates come from the article; provider index
    dates are stored separately and never shown as publication dates. "What
    changed?" distinguishes newly published coverage from newly discovered
    older coverage.
12. **"Current" is time-stamped.** A role described as current is shown with
    the date of the statement; statements older than 18 months are flagged as
    possibly outdated. For undated pages the date is labelled as the date the
    page was read, never as a publication date.
13. **Prefer provider extraction over our own fetching.** Direct fetching is
    off by default; when enabled it pins DNS at connection time, blocks
    private/link-local/metadata ranges, re-validates redirects and caps size and
    time.
14. **Owner-scoped provider cache.** Identical requests are reused for
    `PROVIDER_CACHE_TTL_HOURS`, keyed by request, model and prompt version, so
    refreshes are cheap but prompt changes take effect immediately. Refresh
    bypasses the search cache.
15. **Minimal retention.** Retrieved page text expires after
    `SOURCE_CONTENT_RETENTION_DAYS`; briefs keep short excerpts. Profile
    deletion removes everything derived from its research runs.
16. **Fictional demo world.** All demo people and organisations are invented,
    use reserved `.example` domains and fictional phone ranges (Ofcom drama
    numbers, NANP 555-01xx), and replay through the same verification pipeline
    as live data. Demo sources open in a local fixture viewer.
17. **PDF with vendored fonts.** `@react-pdf/renderer` with Inter and Source
    Serif 4 (OFL) so Azerbaijani and Cyrillic render without system fonts;
    numbered references are clickable and notes are excluded by default.
18. **Interface languages without locale routing.** next-intl with the
    language stored in owner settings (cookie before sign-in). Azerbaijani dates
    are formatted from numeric parts with built-in month names because some
    browsers ship no Azerbaijani calendar data. Times are stored in UTC and
    shown in the owner's time zone (default Asia/Baku). Research content (facts,
    summaries) is written in English with original-language excerpts kept.
19. **Default model `claude-opus-5-5`, effort `medium`, server-side fallback
    on.** All three are configurable; usage and estimated cost are recorded per
    call and labelled as estimates.
20. **TypeScript 5.9.** TypeScript 7 is not yet supported by typescript-eslint.
21. **No scoring.** No personality, trust, credit or hiring assessments;
    information gaps are worded neutrally and missing information is never a
    negative signal.
22. **Render as the first host.** One Blueprint file creates the website,
    worker and database; Frankfurt is the closest Render region to Baku. The
    worker is bundled to plain JavaScript with esbuild for production.
23. **Phone app as an installable web app (PWA), not app-store builds.** It
    installs from the browser on iPhone and Android with no store review or
    developer accounts, and every release reaches it immediately. Native store
    apps (for example a Capacitor wrapper) remain possible later and would need
    Apple and Google developer accounts. *(Extended by 25: the PWA stays, and a
    native app now exists alongside it.)*
24. **The service worker never stores private data.** It caches only hashed
    build assets, icons and a static offline screen; pages, API responses and
    exports always come from the network. The cache is named after the build,
    so each release replaces it.
25. **A native phone app with Expo, next to the website and the PWA.** Expo
    SDK 57 (React Native 0.86, Expo Router) in `apps/mobile`, with native
    screens and no WebView. It is a client of the same server and database;
    the website, PWA, research engine and Render deployment are unchanged.
26. **Shared code by path alias, not npm workspaces.** Pure contracts (API
    schemas, domain types, formatting, design tokens, app schemes) live in
    `packages/shared` and are resolved through the `@personbrief/shared/*`
    alias by TypeScript, Vitest, esbuild, Metro and Jest. The app keeps its own
    `package-lock.json`, so its dependencies never enter the website's install
    or Render build, and shared code imports only `zod`.
27. **A versioned API for apps (`/api/v1`).** It reuses the server's services
    and owner checks (ownership always comes from the session). Conventions:
    one error envelope with typed codes, `Idempotency-Key` on anything that
    starts paid research, cursor pagination, UTC timestamps, lenient enums so
    older apps survive new values, additive changes only within v1, and a
    client build header that lets the server answer 426 "update the app".
28. **App sign-in through Better Auth's own Expo integration.** The session
    cookie is stored in the Keychain/Keystore (SecureStore) and sent as a
    header; the app identifies itself by its URL scheme. No second token
    system. Only release schemes are trusted in production; development
    schemes and Expo Go only outside it. The auth route is an allowlist (no
    sign-up) with per-address and per-email rate limits.
29. **Research content is never stored on the phone.** It lives in an
    in-memory query cache that is cleared on sign-out and before another
    account signs in; exports are temporary files deleted after sharing, at
    sign-out and at launch. The app shows nothing while the server cannot
    confirm the session.
30. **Notifications through Expo's push service, sent by the worker.** Plain
    HTTPS (no SDK), opt-in, tied to the session (removed with it), one
    delivery per run and event, invalid tokens cleaned from tickets and
    receipts, generic localized text without the person's name. Without an
    Expo project id or push credentials the app says notifications are
    unavailable; nothing is simulated. No marketing or scheduled monitoring.
31. **Server-paced polling, no offline queue.** The run endpoint returns
    `pollAfterMs`; polling pauses in the background and the app reconciles on
    return. New research is refused while offline rather than queued, because
    it costs money.
32. **Optional app lock.** Face ID, Touch ID or fingerprint with the device
    passcode as fallback; the app relocks after a minute in the background and
    covers its content in the app switcher. It protects the phone, it does not
    replace signing in.
33. **Custom URL schemes only for now.** Universal links and App Links need
    verification files on a domain the project controls permanently; they wait
    until the production address is final.
34. **The worker reports whether it has the provider keys.** On Render the
    worker copies the keys from the website when it deploys, so it can lag
    behind. The heartbeat carries a configured/missing flag (never the values),
    and the website refuses live research with a clear message while an online
    worker lacks keys, instead of letting runs fail later.
35. **Render settings.** Heap caps in the start commands (not during builds),
    explicit 1 GB database storage, and build filters so commits that only
    touch `apps/mobile` or `docs` do not redeploy the services.
36. **TypeScript 6 in the app.** The Expo SDK 57 toolchain uses it; the
    website stays on 5.9 until typescript-eslint supports newer versions (20).
37. **A public `/privacy` page.** The stores require a public privacy-policy
    address. The page repeats the data-use commitments and adds accounts, the
    phone app and how people who were researched can ask for corrections; a
    contact appears only when the operator sets `SUPPORT_EMAIL`.
38. **Screens reviewed through Expo's web target; device checks scripted.**
    Without an emulator here, phone-sized renders of the real screens were used
    for review (and are labelled as such), and Maestro flows are provided for
    running the same journeys on devices.
