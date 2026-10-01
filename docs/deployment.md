# Deploying PersonBrief

PersonBrief has three moving parts:

| Part | Command | Notes |
| --- | --- | --- |
| Web app | `npm run start` (`next start`) | Stateless; any number of instances |
| Research worker | `npm run worker` | Long-running; claims jobs from PostgreSQL. Run at least one. Several are safe (row locks + fencing tokens). |
| Database | PostgreSQL 14+ | Run `npm run db:migrate` before starting a new version |

The web app never calls research providers itself: it persists a job and the
worker does the work, so a restart or redeploy never loses research in
progress. A worker that disappears loses its lease after
`WORKER_LEASE_SECONDS`; another worker resumes the job from its checkpoints, and
after `JOB_MAX_ATTEMPTS` the job ends visibly as failed with Retry available.

## Docker Compose (single host)

```bash
cp .env.example .env
# Set POSTGRES_PASSWORD, BETTER_AUTH_SECRET (openssl rand -base64 48), APP_URL,
# and optionally TAVILY_API_KEY / ANTHROPIC_API_KEY. DATABASE_URL is set by compose.
docker compose up --build -d
docker compose run --rm -e OWNER_PASSWORD='choose-a-long-password' web \
  npm run owner:create -- --email you@example.com --name "Your Name"
```

The web container listens on `127.0.0.1:3000`. Put an HTTPS reverse proxy
(Caddy, nginx, a load balancer) in front of it and set `APP_URL` to the public
`https://` address. Session cookies are marked secure automatically when
`APP_URL` uses HTTPS.

Upgrades: `docker compose build && docker compose up -d` — the `migrate`
service applies new migrations before the web app and worker start.

## Other hosts

Any platform that runs a Node 22 container with a persistent process works
(Fly.io, Render, Railway, ECS, Kubernetes, a VM). Build the image from the
included `Dockerfile` and run two services from it: `npx next start -H 0.0.0.0`
and `npm run worker`, plus a one-off `npm run db:migrate` per release.

Serverless platforms (for example Vercel) can host the web app, but they cannot
host the worker: run the worker separately on a host that keeps a process alive,
pointing at the same database. Do not try to run research inside request
handlers — work started after a response is returned is not durable there.

## Configuration

All settings are environment variables; `.env.example` lists every one with a
placeholder. Required: `DATABASE_URL`, `BETTER_AUTH_SECRET` (≥ 32 characters),
`APP_URL`. Live research additionally needs `TAVILY_API_KEY` and
`ANTHROPIC_API_KEY` on **both** the web app (status display) and the worker
(research). Keys are only read on the server and are never sent to the browser
or written to logs.

The model defaults to `claude-opus-5-5` with `ANTHROPIC_EFFORT=medium`.
Budgets (`RESEARCH_MAX_*`) cap every run; the owner can lower them in
Settings. `RESEARCH_MAX_JOBS_PER_HOUR` limits live runs per hour.

## Health, logs and backups

- `GET /api/health` returns `{status, database, worker}` with no other details
  (200 when the database is reachable, 503 otherwise). `worker: "offline"`
  means no worker has reported in the last minute.
- The worker logs job claims, outcomes and maintenance to stdout. Provider
  error details are stored as diagnostic job events, visible to the owner only
  in the run's technical details.
- Back up the PostgreSQL database; it holds all state. Retrieved page text is
  purged automatically after `SOURCE_CONTENT_RETENTION_DAYS`.

## Security checklist

- Serve only over HTTPS; keep `APP_URL` accurate.
- Keep `PUBLIC_DEMO_ENABLED=false` unless you want anonymous visitors to reach
  the fictional demo (it never touches live data, and guests are deleted after
  `DEMO_GUEST_TTL_HOURS`).
- Leave `OWNER_SETUP_TOKEN` empty once the owner exists (the setup page also
  refuses to run when an owner exists).
- `DIRECT_FETCH_ENABLED` stays `false` unless you need it; provider extraction
  is preferred. When enabled, fetches are SSRF-protected (scheme/port checks,
  private/link-local/metadata addresses blocked at connection time, redirects
  re-validated, size and time limits).
