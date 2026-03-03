# SproutGigs Dashboard

Next.js 14 (App Router) dashboard that automates daily job launching on SproutGigs.

## Features

- **Scheduler**: Daily cron triggers a run; tasks are enqueued and processed by a worker-style API.
- **Demand engine**: Configurable rules (daily target, caps, active days, operating hours) decide how many jobs to launch.
- **SproutGigs integration**: Interface with mock client (real client behind feature flag when ready).
- **Dry run**: Simulate launches without placing orders; safe by default.
- **Secrets**: Credentials stored encrypted at rest; never exposed to the client.
- **Idempotency**: One run per day; job launch idempotent per run + job index.

## Tech stack

- Next.js 14 App Router
- shadcn/ui + Tailwind
- Postgres (Neon or Railway) — set `DATABASE_URL`
- NextAuth (credentials) for dashboard auth
- Daily cron: Vercel Cron or an external cron (e.g. cron-job.org) for Railway

**Deploy on Railway:** see [DEPLOYMENT-RAILWAY.md](./DEPLOYMENT-RAILWAY.md).

## Setup

1. **Clone and install**
   ```bash
   npm install
   ```

2. **Database**
   - Create a Neon (or any Postgres) database and set `DATABASE_URL`.
   - Run the migration:
     ```bash
     psql "$DATABASE_URL" -f supabase/migrations/001_initial_schema.sql
     ```
     Or use the Neon SQL Editor and paste the contents of `supabase/migrations/001_initial_schema.sql`.

3. **Environment**
   - Copy `.env.example` to `.env.local`.
   - Set `DATABASE_URL`, `AUTH_USERNAME`, `AUTH_PASSWORD`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
   - For encryption of SproutGigs credentials, set `ENCRYPTION_KEY` (32-byte base64):
     ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   - Optional: `CRON_SECRET` for securing the cron endpoint (Vercel Cron can send `Authorization: Bearer <CRON_SECRET>`).

4. **Run**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000). Sign in with `AUTH_USERNAME` / `AUTH_PASSWORD`.

## Pages

- **/** — Dashboard: today’s stats, actions table, next run time, activity feed. “Run now” and “Process tasks” buttons.
- **/config** — Schedule, demand, job template (with `{{date}}`, `{{batch_number}}`, `{{job_index}}`), SproutGigs credentials and “Test connection”.
- **/runs** — List of daily runs; click through to run detail (tasks, jobs, errors).
- **/jobs** — All jobs; retry failed launches (respects dry run and daily caps).

## API

- `GET/PUT /api/config` — Read/update configuration (auth required).
- `POST /api/cron/daily-check` — Called by Vercel Cron (use `CRON_SECRET` in `Authorization: Bearer`).
- `POST /api/runs/now` — Create today’s run and enqueue evaluate_demand (auth required).
- `POST /api/runs/:runId/execute` — Process queued tasks for a run (demand evaluation + job launches with spacing/backoff).
- `POST /api/sproutgigs/test-connection` — Test SproutGigs access (auth required).
- `POST /api/jobs/launch` — Body: `{ runId, jobIndex }` (auth required).
- `POST /api/jobs/retry` — Body: `{ jobId }` (auth required).

## Safety

- **Dry run default**: No real orders unless you turn dry run off in config.
- **No duplicate runs**: One run per day (idempotent on `run_date`).
- **No duplicate jobs**: Jobs keyed by `run_id` + `job_index`.
- **Secrets**: Stored encrypted; never sent to the client (password shown as `********`).
- **Rate limiting**: Configurable launch spacing between jobs; retries use exponential backoff.

## Cron

Vercel Cron is set in `vercel.json` to hit `/api/cron/daily-check` at 9:00 AM UTC on weekdays. To use your configured timezone and run time, you can either change the cron expression or run the cron more frequently (e.g. hourly) and inside the route skip execution unless the current time in the configured timezone matches the configured run time.

## SproutGigs real client

The app uses a **mock** SproutGigs client by default. To plug in a real implementation (API or Playwright):

1. Implement `ISproutGigsClient` in `src/lib/sproutgigs/` (e.g. `real-client.ts`).
2. Set `SPROUTGIGS_USE_REAL_CLIENT=true` and return the real client from `getSproutGigsClient()` when that flag is set.
