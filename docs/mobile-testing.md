# Phone app: testing

What is tested automatically, how to run it, what was run for this release,
and what still needs a real phone.

## Automated checks

Run from `apps/mobile` unless noted.

| Check | Command | What it covers |
| --- | --- | --- |
| Types | `npm run typecheck` | App, shared contracts (`packages/shared`), tests |
| Lint | `npm run lint` | Expo ESLint rules, React hooks rules |
| Component and unit tests | `npm test` | 32 tests, below; the live-server project is skipped unless configured |
| Live-server tests | `npm run test:api` with `PB_TEST_API_URL`, `PB_TEST_EMAIL`, `PB_TEST_PASSWORD` | The app's real auth client (Better Auth + Expo plugin, cookie in a keychain stand-in) and API client against a running server |
| Release bundles | `npm run bundle:check` | Hermes bytecode for Android and iOS builds from the same code |
| Native project generation | `APP_VARIANT=production EXPO_PUBLIC_API_URL=https://example.com npx expo prebuild --no-install --clean`, then delete `android/` and `ios/` | Every config plugin (icons, splash, permissions, notifications, Face ID text, schemes) applies cleanly |
| Expo health | `npm run doctor`, `npm run deps:check` | Project setup and SDK-compatible versions |
| Server API (repository root) | `npx vitest run --project integration tests/integration/api-v1.test.ts` | `/api/v1`: owner isolation, sessions and revocation, idempotency, pagination, typed errors, devices, exports |

**Component and unit tests (Jest, 32):** real Expo Router screens with the
app's providers and a fake server.

- Search: name validation, idempotency key on start, opens the run; offline
  disables research and nothing is queued.
- Choose the person: distinct candidates, the owner's choice is sent.
- Progress: persisted stages without invented percentages; cancel asks first.
- Person brief: sections, evidence sheet (excerpt, verbatim check, source),
  switchboards never shown as direct lines, fictional contacts cannot be
  called, live business numbers open the dialer (no call is placed).
- PDF share: authenticated download, notes excluded, temporary file deleted.
- Saved (empty state), settings (provider availability without secrets,
  honest notification state, worker missing provider keys), Azerbaijani and
  Russian.
- Session lifecycle: restore after restart, expired/revoked sessions, server
  unreachable (session kept, nothing shown), switching accounts without the
  previous account's data, sign-out (server revocation, notifications off,
  local data removed), revocation detected while in use.
- Polling: follows the server's pace, stops in the background, reconciles on
  return, stops once finished.
- Configuration and links: release builds require HTTPS, schemes match the
  server's trusted schemes, deep-link parsing; message catalogues complete in
  EN/AZ/RU.

**Live-server tests (3):** sign-in stored in the keychain survives a restart
and stops at sign-out; a phone is signed out when its session is revoked from
another device; search → choose → research → brief → save → note → export,
with the same data visible from a second device.

## Smoke tests on a device (Maestro)

`apps/mobile/.maestro` contains flows for an installed build against a running
server, using only the fictional demo workspace: sign-in and restart, the
research journey, choosing the person, background and resume, offline, deep
links, languages and sign-out. See `apps/mobile/.maestro/README.md`.

```bash
maestro test apps/mobile/.maestro -e APP_ID=com.tnhasanov.personbrief.preview \
  -e SCHEME=personbrief-preview -e EMAIL=… -e PASSWORD=…
```

## Results for this release (5 October 2026)

| Area | Result |
| --- | --- |
| Fictional demo data (no providers) | Component tests 32/32; live-server tests 3/3 against a local production-mode server; server API integration tests pass |
| Live providers (Tavily, Anthropic) | **Not run** — no provider keys in the build environment. The live path is covered by unit tests with mocked SDK clients and by the "never fall back to fictional data" checks |
| Android | Release bundle built (Hermes, 3,891 modules, 8.5 MB); native project generated with `expo prebuild`. **Not run on an emulator or phone** — no Android emulator (no hardware virtualisation) and Google's Android downloads are blocked here, so no APK was compiled |
| iOS | Release bundle built (Hermes, 4,005 modules, 8.2 MB); Xcode project generated with `expo prebuild`. **Not run on a simulator or iPhone** — needs macOS and Xcode |
| Screens | Rendered through Expo's web target in a phone viewport (light, dark, AZ, RU) and reviewed: `docs/screenshots/mobile-app/`. Fixes made from that review: clipped tab labels, "Azərbaycanca" breaking mid-word, truncated action labels |
| Secrets | Both release bundles scanned: no server packages (database, providers), no provider keys, no local secret values |
| `expo-doctor` | 19 of 21 checks pass; the other 2 need api.expo.dev and reactnative.directory, which are blocked here |
| Dependencies | All 33 Expo-managed packages match SDK 57's expected versions |
| Maestro flows | Written and YAML-validated; **not yet run** (no device) |

## Still to check on real phones

Run the Maestro flows, then check by hand on at least one iPhone and one
Android phone (preview builds):

1. Install, launch, splash, icon (including Android themed icon), dark mode.
2. Sign in; kill and reopen (session restored from the keychain); sign out
   (welcome screen with the clean-up notice; reopen stays signed out).
3. From a second phone (Settings → Signed-in devices), sign the first phone
   out: it returns to sign-in on its next request.
4. App lock: turn on with Face ID / fingerprint, background for over a minute,
   unlock; check the passcode fallback and "Sign out instead"; the app
   switcher shows the privacy cover, not the brief.
5. Notifications: turn on (permission prompt), start research, leave the app;
   the notice arrives without the person's name; tapping opens the run. Sign
   out and confirm no further notices arrive.
6. Share a PDF and a JSON export to Files/Mail; confirm private notes are
   excluded unless chosen.
7. A live business number opens the dialer and an address opens the mail
   composer, without placing a call or sending anything.
8. Open `personbrief-preview://profile/<id>` from Notes or a browser, signed in
   and signed out.
9. Airplane mode: open briefs stay readable, research cannot start, recovery
   when back online. Lock the phone during research and come back.
10. Largest text size (Dynamic Type / font scale), VoiceOver and TalkBack
    labels, Android back gesture, small phones (320 pt wide) and the keyboard
    covering no fields.
