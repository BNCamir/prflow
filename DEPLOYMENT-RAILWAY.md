# Deploy SproutGigs Dashboard to Railway

## 1. Create a Railway project

1. Go to [railway.app](https://railway.app) and sign in.
2. **New Project** → **Deploy from GitHub repo** (or upload this folder).
3. Connect your repo and select the branch to deploy.

## 2. Add PostgreSQL (or keep Neon)

**Option A – Railway Postgres**

- In the project: **+ New** → **Database** → **PostgreSQL**.
- Open the Postgres service → **Variables** and copy `DATABASE_URL`.
- In your **app** service → **Variables**, add:
  - `DATABASE_URL` = (paste the Postgres URL from Railway).

**Option B – Keep Neon**

- Leave your existing Neon `DATABASE_URL` and add it to the app’s variables (see below).

## 3. Set environment variables

In your **app** service → **Variables**, add:

| Variable | Required | Example / notes |
|----------|----------|------------------|
| `DATABASE_URL` | Yes | From Railway Postgres or your Neon URL |
| `AUTH_USERNAME` | Yes | Dashboard login username |
| `AUTH_PASSWORD` | Yes | Dashboard login password |
| `NEXTAUTH_SECRET` | Yes | e.g. `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Your app URL, e.g. `https://your-app.up.railway.app` |
| `CRON_SECRET` | Recommended | Random string for securing the cron endpoint |
| `ENCRYPTION_KEY` | Optional | Base64 32-byte key to encrypt SproutGigs credentials |
| `SPROUTGIGS_USE_REAL_CLIENT` | Optional | `true` to use real SproutGigs API |

**Important:** Set `NEXTAUTH_URL` to your Railway app URL (e.g. `https://sproutgigs-dashboard-production.up.railway.app`) **after** the first deploy so you know the URL.

## 4. Run the database migration

If you use **Railway Postgres** (new database):

1. **Option A – From your machine**  
   Install [Railway CLI](https://docs.railway.app/develop/cli), link the project, then run:
   ```bash
   railway run node scripts/run-migration.js
   ```
   (Ensure `DATABASE_URL` is set in the linked environment.)

2. **Option B – From Railway Postgres**  
   In Railway: Postgres service → **Data** (or Connect) → run the SQL from `supabase/migrations/001_initial_schema.sql` in the SQL editor.

If you keep **Neon**, the DB is already migrated; no need to run it again for Railway.

## 5. Deploy

- Push to the connected branch, or click **Deploy** in Railway.
- Railway will run `npm run build` and `npm start` (Next.js listens on `PORT` automatically).
- Open the generated URL (e.g. `https://…up.railway.app`), set `NEXTAUTH_URL` to that URL if you haven’t yet, then redeploy so auth works.

## 6. Daily cron (job check)

Railway doesn’t run crons inside the app. Use an external cron to call your API once per day:

1. Create a cron job at [cron-job.org](https://cron-job.org) or similar.
2. **URL:** `https://YOUR-RAILWAY-APP-URL/api/cron/daily-check`
3. **Method:** POST  
4. **Schedule:** e.g. once per day (e.g. 9:00 AM in your timezone).
5. **Header:**  
   - Name: `Authorization`  
   - Value: `Bearer YOUR_CRON_SECRET`  
   (Use the same value as the `CRON_SECRET` variable in Railway.)

After that, the dashboard will run on Railway and the daily job check will run via the external cron.

## 7. Optional: custom domain

In the app service → **Settings** → **Domains** → add your domain and set `NEXTAUTH_URL` (and any auth callbacks) to that domain.

## Troubleshooting

- **Build fails:** Check the build logs; ensure Node version is 18+ (Railway usually sets it).
- **Database connection errors:** Confirm `DATABASE_URL` is set in the **app** service (not only in Postgres).
- **Login redirect / session issues:** Set `NEXTAUTH_URL` to the exact URL you use (including `https://`).
- **Cron returns 401:** Set `CRON_SECRET` in Railway and use the same value in the `Authorization: Bearer …` header.
