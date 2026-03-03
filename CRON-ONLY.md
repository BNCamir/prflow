# Cron-only: Reddit + Quora jobs (no dashboard)

You can run **only** the cron that keeps your Reddit and Quora jobs running. No login, no database, no dashboard.

## 1. Env vars on Railway

In your Railway app → **Variables**, set:

| Variable | Example / notes |
|----------|------------------|
| **CRON_SECRET** | Any random string (for the cron request) |
| **SPROUTGIGS_USER_ID** | Your SproutGigs API user ID |
| **SPROUTGIGS_API_SECRET** | Your SproutGigs API secret |
| **REDDIT_JOB_JSON** | JSON for the Reddit job (see below) |
| **QUORA_JOB_JSON** | JSON for the Quora job (see below) |

Optional: **DRY_RUN** = `1` to only check and log, don’t post jobs.

### Job JSON shape

Each of `REDDIT_JOB_JSON` and `QUORA_JOB_JSON` is one JSON object. Example:

```json
{
  "title": "Reddit task",
  "zone_id": "int",
  "category_id": "0501",
  "instructions": ["Go to the link", "Complete the task", "Submit screenshot"],
  "num_tasks": 25,
  "task_value": 0.10
}
```

- **title** – Must match how you recognize the job (we check “is a job with this title running?”).
- **zone_id** – e.g. `int`.
- **category_id** – From SproutGigs categories.
- **instructions** – Array of strings.
- **num_tasks** – Min 10.
- **task_value** – USD per task.
- Optional: **proofs** – `[{"type":"screenshot","description":"Screenshot"}]`, **excluded_countries** – `["pk","bd"]`.

Paste as **one line** in Railway (no newlines). Example value for **REDDIT_JOB_JSON**:

```
{"title":"Reddit task","zone_id":"int","category_id":"0501","instructions":["Go to the link","Complete the task","Submit screenshot"],"num_tasks":25,"task_value":0.10}
```

Do the same for **QUORA_JOB_JSON** with the Quora title and settings.

## 2. Cron job

Use [cron-job.org](https://cron-job.org) (or any cron):

- **URL:** `https://prflow-production.up.railway.app/api/cron/reddit-quora`
- **Method:** POST
- **Schedule:** e.g. every 6 hours or once a day
- **Header:**  
  - Name: `Authorization`  
  - Value: `Bearer YOUR_CRON_SECRET`  
  (same as **CRON_SECRET** in Railway)

No dashboard needed: the cron calls this URL; the app checks SproutGigs and posts Reddit/Quora jobs if they’re not running.

## 3. Optional: turn off the rest

You can leave the rest of the app as-is (dashboard, DB, etc.). If you don’t open the app and only hit `/api/cron/reddit-quora`, it’s effectively “cron only.”  
To fully remove the dashboard you’d delete the dashboard routes and use only this cron route; that’s optional.
