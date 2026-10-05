# Maestro smoke flows

End-to-end checks for an installed PersonBrief build against a running
server. They use the **fictional demo workspace** only, so they never call
paid providers or touch real people.

```bash
# One-time: install Maestro (https://maestro.dev) and start an Android
# emulator or connect a phone with the preview build installed.
maestro test apps/mobile/.maestro \
  -e APP_ID=com.tnhasanov.personbrief.preview \
  -e SCHEME=personbrief-preview \
  -e EMAIL=you@example.com -e PASSWORD='your-password'
```

| Build | APP_ID | SCHEME |
| --- | --- | --- |
| development | `com.tnhasanov.personbrief.dev` | `personbrief-dev` |
| preview (internal APK) | `com.tnhasanov.personbrief.preview` | `personbrief-preview` |
| production | `com.tnhasanov.personbrief` | `personbrief` |

Notes:

- Written for Android. On iOS, `05-offline` cannot run (Maestro cannot switch
  airplane mode there) and the `back` steps need an iOS equivalent (swipe
  down on sheets, the navigation bar's back button).
- The flows have not yet been run on a device or emulator; expect to adjust
  a selector or a timeout on the first run. See `docs/mobile-testing.md`.
- `02-research-journey` adds a note and saves a fictional profile in the demo
  workspace; delete it afterwards if you want a clean demo library.
