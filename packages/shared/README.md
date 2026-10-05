# @personbrief/shared

Pure TypeScript shared by the website/worker (repository root) and the mobile
app (`apps/mobile`). It must stay free of server code, database clients,
provider SDKs, React, React Native and secrets — it is bundled into the phone
app.

| Path | Contents |
| --- | --- |
| `src/domain.ts` | Persisted vocabularies and record shapes (job statuses, evidence statuses, partial dates…) |
| `src/format/*` | Locale-safe date formatting (including Azerbaijani), partial dates, uncertainty, gaps, identity reasons |
| `src/research/search-input.ts` | The search form schema used by the website, the app and the server |
| `src/api/v1/*` | `/api/v1` request/response contracts (zod) used by the server and the app |
| `src/design/tokens.ts` | Brand colours mirrored from `src/app/globals.css` (kept identical by a unit test) |

Imported as `@personbrief/shared/<path>`: the website resolves it through
`tsconfig.json` paths, the app through `apps/mobile/tsconfig.json` and its
Metro configuration. Its only runtime dependency is `zod`, which each side
installs itself.
