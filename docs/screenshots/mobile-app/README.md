# Phone app screens (web render)

These images were rendered from the phone app's own code (`apps/mobile`)
through Expo's web target (react-native-web) in a 393 × 852 phone viewport,
signed in to a local PersonBrief server, using only the **fictional demo
workspace**. They show the real screens, layout, copy and data flow.

They are **not** screenshots from an iPhone or Android device: native
controls (the share sheet, alerts, Face ID, notification prompts, the status
bar and home indicator) do not appear, and fonts may render slightly
differently. They are not suitable for App Store or Google Play listings;
take those from a preview build on a device (see `docs/mobile-store.md`).

How they were made: `npx expo export --platform web` in `apps/mobile`, served
from one origin with `/api` forwarded to the server, then captured with
Playwright (Chromium). Notifications show "Not available in the web preview",
which is the web build's honest state.

| File | Screen |
| --- | --- |
| `01-welcome.png` | Sign-in with language choice and the fictional demo entry |
| `02-search.png` | Search (demo workspace) with fictional examples |
| `03-research-progress.png` | Research in progress: persisted stages, no invented percentages |
| `04-choose-the-person.png` | Choose the person when several share a name |
| `05-brief-overview.png` | Person brief: header, actions, sourced summary |
| `06-contacts.png` | Contacts & accounts, with publication context and disabled actions for fictional data |
| `07-connections.png` | Documented relationships (list first) |
| `08-news.png` | News & media with relevance filters |
| `09-sources.png` | Sources and search coverage |
| `10-evidence.png` | Evidence sheet: source, excerpt, verification |
| `11-saved.png` | Saved briefs |
| `12-activity.png` | Activity: runs in progress and finished |
| `13a-settings.png` | Settings: account, workspace, language, theme, time zone, phone settings |
| `13b-settings-session.png` | Settings: limits, usage, signed-in devices, data use, sign out |
| `14-brief-dark.png` | Brief in dark mode |
| `15-search-dark.png` | Search in dark mode |
| `16-search-az.png` | Search in Azerbaijani |
| `17-brief-az.png` | Brief in Azerbaijani (labels wrap instead of truncating) |
| `18-contacts-ru.png` | Contacts in Russian |
