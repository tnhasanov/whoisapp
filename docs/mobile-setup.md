# Phone app: setup, builds and release

The native iPhone and Android app lives in `apps/mobile` (Expo SDK 57,
React Native 0.86, Expo Router, TypeScript). It is a client of the same
PersonBrief server as the website: same accounts, same research, same data,
through the versioned API under `/api/v1`. There is no WebView. Render builds
only the website and worker; the app is built with EAS (Expo Application
Services) or locally.

| | Development | Preview (internal) | Production (stores) |
| --- | --- | --- | --- |
| App name | PersonBrief Dev | PersonBrief Preview | PersonBrief |
| iOS bundle id / Android package | `com.tnhasanov.personbrief.dev` | `com.tnhasanov.personbrief.preview` | `com.tnhasanov.personbrief` |
| URL scheme | `personbrief-dev://` | `personbrief-preview://` | `personbrief://` |
| Server address | `EXPO_PUBLIC_API_URL`, or the computer running Metro (port 3000) | `EXPO_PUBLIC_API_URL`, **HTTPS only** | `EXPO_PUBLIC_API_URL`, **HTTPS only** |
| JavaScript | loaded from Metro | bundled in the app | bundled in the app |
| EAS profile | `development`, `development-simulator` | `preview` (APK / ad hoc) | `production` (AAB / IPA) |

All three can be installed side by side. The server trusts the preview and
production schemes; the development scheme (and Expo Go's `exp://`) only
when the server is not running in production mode.

## Settings

Build-time values (`apps/mobile/.env.example`). `EXPO_PUBLIC_*` values are
compiled into the app and are **public**: never put keys or passwords in them.

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Server address, e.g. `https://personbrief.onrender.com`. Required for preview and production builds, which refuse `http://`. |
| `APP_VARIANT` | `development`, `preview` or `production`. Set by the EAS profiles. |
| `EAS_PROJECT_ID` | Expo project id from `eas init`. Needed for EAS builds and push notifications. |
| `EXPO_OWNER` | Expo account or organisation that owns the project. |
| `GOOGLE_SERVICES_JSON` | Path to Firebase's `google-services.json`, needed for Android push. |

Server-side values for the app (root `.env.example`, Render environment):
`PUSH_NOTIFICATIONS_ENABLED` (default on), `EXPO_ACCESS_TOKEN` (only with
Expo's enhanced push security), `SUPPORT_EMAIL` (contact on `/privacy`).
Provider keys and the database stay on the server; the app never sees them.

## Develop on your computer

```bash
# Terminal 1 — repository root: website + worker on http://localhost:3000
npm run dev

# Terminal 2 — the app
cd apps/mobile
npm ci
npm run start          # Metro for a development build (press a / i)
```

You need a **development build** of the app installed once (it contains the
native modules; JavaScript then reloads from Metro):

- Android emulator or phone: `npx expo run:android` (Android Studio installed),
  or `eas build -p android --profile development` and install the APK.
- iOS simulator (Mac with Xcode): `npx expo run:ios`, or
  `eas build -p ios --profile development-simulator`.
- iPhone: `eas build -p ios --profile development` (needs an Apple Developer
  account and the phone registered with `eas device:create`).

`npm run start:go` opens the project in Expo Go for a quick look; it is not
tested, and Expo Go cannot receive this app's push notifications.

### How the phone reaches your computer

- A phone or emulator cannot use `localhost` to reach your computer: on the
  phone, "localhost" is the phone itself.
- Development builds without `EXPO_PUBLIC_API_URL` use the computer that runs
  Metro, at `http://<computer's LAN address>:3000`. Phone and computer must be
  on the same Wi-Fi, and the firewall must allow port 3000 (`next dev`
  listens on all interfaces).
- Android emulator: the computer is also reachable as `10.0.2.2`
  (`EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`).
- iOS simulator: shares the Mac's network, so `http://localhost:3000` works.
- Different network or a VPN: start Metro with `npx expo start --tunnel` and
  point the app at a server it can reach, for example your deployed HTTPS
  address (`EXPO_PUBLIC_API_URL=https://… npm run start`).
- Plain `http://` is accepted only in development builds. Preview and
  production builds show "Server not configured" unless the address is HTTPS.

## Build with EAS

One-time (an Expo account is needed; its free plan includes a limited number of cloud builds each month):

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init            # creates the project, prints its id
export EAS_PROJECT_ID=<printed id> EXPO_OWNER=<your Expo account>

# Values the cloud builds need (plain text: they are not secrets)
npx eas-cli@latest env:create --name EAS_PROJECT_ID --value "$EAS_PROJECT_ID" \
  --environment development --environment preview --environment production --visibility plaintext
npx eas-cli@latest env:create --name EXPO_OWNER --value "$EXPO_OWNER" \
  --environment development --environment preview --environment production --visibility plaintext
npx eas-cli@latest env:create --name EXPO_PUBLIC_API_URL --value https://<your server> \
  --environment preview --environment production --visibility plaintext
```

Keep `EAS_PROJECT_ID` and `EXPO_OWNER` exported (or in `apps/mobile/.env.local`)
whenever you run `eas` commands; `app.config.ts` reads them.

Builds (run from `apps/mobile`; each prints a link and QR code to install):

```bash
npx eas-cli@latest build -p android --profile preview     # APK for direct install
npx eas-cli@latest build -p ios --profile preview         # ad hoc, registered iPhones
npx eas-cli@latest build -p all --profile production      # AAB + IPA for the stores
npx eas-cli@latest submit -p ios --profile production     # to App Store Connect / TestFlight
npx eas-cli@latest submit -p android --profile production # to Play (internal track, draft)
```

Versions: the marketing version is `VERSION` in `app.config.ts`; build
numbers are kept by EAS (`appVersionSource: remote`, auto-incremented for
production). The server can ask old builds to update by raising
`MINIMUM_CLIENT_BUILD` in `packages/shared/src/app.ts` (the app then shows
"Update the app").

### iOS signing, in short

Apple only runs apps on an iPhone if they are signed with certificates from
a paid **Apple Developer Program** membership (currently USD 99 a year). Simulator
builds need no signing.

- **Internal (preview) builds** use an *ad hoc* provisioning profile that
  lists the iPhones allowed to install them. Register each phone with
  `eas device:create` (open the link on the phone) before building.
- **TestFlight and the App Store** use a distribution certificate and an App
  Store profile. Create the app record in App Store Connect first.
- EAS creates and stores the certificates and profiles when you sign in with
  your Apple ID during `eas build` (`eas credentials` shows them).
- **Push notifications** also need an APNs key; EAS can create it in the same
  step.

### Android signing, in short

EAS creates an upload keystore on the first build and keeps it (download a
backup with `eas credentials`). Preview APKs install directly once "Install
unknown apps" is allowed for the browser or Files app. Google Play needs a
developer account (currently a one-time USD 25 fee); with Play App Signing, Google holds the
final signing key. The first upload of a new app is often done by hand in
Play Console; later uploads can use `eas submit` with a Play service-account
key.

For **push notifications** Android needs Firebase Cloud Messaging: create a
Firebase project, add an Android app with the package name, download
`google-services.json` (keep it out of git), store it as an EAS file variable
(`eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json`)
and upload the FCM V1 service-account key under `eas credentials` → Android →
Push Notifications.

## Links into the app

`personbrief://profile/<id>` and `personbrief://research/<id>` open a brief or
a research run (`personbrief-preview://…` in preview builds). When signed out,
the link waits until sign-in; the server still checks that the item belongs to
the signed-in account. Universal links / App Links (`https://` addresses that
open the app) are not set up: they require hosting verification files on a
domain this project controls for good, and the final address is not fixed
yet. They can be added once it is.

## What the app keeps on the phone

- **Keychain / Keystore (SecureStore):** the session cookie and a few
  preferences (theme, language before sign-in, app lock, notifications).
  The password is never stored.
- **Memory only:** briefs, sources, notes and lists. Nothing is written to
  disk; it is cleared when you sign out or another account signs in.
- **Temporary files:** PDF/JSON exports in the app's cache folder
  (`personbrief-exports`), deleted after sharing, at sign-out and at the next
  launch. A file shared to another app becomes that app's copy.
- **Notifications** (opt-in): generic text only ("research finished" /
  "needs your choice"), never the person's name. The push token is tied to
  the session and removed at sign-out, when the session is revoked, or when
  Expo reports the token invalid.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| "Server not configured" | `EXPO_PUBLIC_API_URL` missing, or not HTTPS in a preview/production build |
| "Update the app" | The server's minimum build is higher than this build |
| Sign-in refused (403) in a development build | The server runs in production mode, which does not trust the development scheme; use a preview build or a development server |
| "No connection to the server" | Phone and computer on different networks, firewall, or `localhost` used on the phone |
| Notifications "not linked to an Expo project" | The build had no `EAS_PROJECT_ID` |
| Notifications: "could not get a push token" | Push credentials missing (APNs key, or Firebase files on Android) |
