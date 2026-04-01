# Cron-only: Reddit + Quora jobs (no dashboard)

You can run **only** the cron that keeps your Reddit and Quora jobs running. No login, no database, no dashboard.

## Railway build fix (secret not found)

If the build fails with `secret REDDIT_JOB_JSON: not found`:

- Add **REDDIT_JOB_JSON** and **QUORA_JOB_JSON** as **Variables** (not Secrets) on the **same service** that builds.
- Set them **before** triggering a deploy so they exist during build.
- If your project only allows "Secrets", add a **Variable** (non-secret) with the same name and value; Railway may require variables at build time.
- To get the first build to pass before pasting real job JSON, you can set both to `{}` then update to real values after deploy.

## 1. Env vars on Railway

In your Railway app → **Variables**, set:

| Variable | Example / notes |
|----------|------------------|
| **CRON_SECRET** | Any random string (for the cron request) |
| **SPROUTGIGS_USER_ID** | Your SproutGigs API user ID |
| **SPROUTGIGS_API_SECRET** | Your SproutGigs API secret |
| **REDDIT_JOB_CONFIG** | JSON for **Reddit job 1** (e.g. general helper) — separate SproutGigs post |
| **REDDIT_JOB_JSON** | Same as above (use one or the other) |
| **REDDIT_JOB_SYSCO_CONFIG** | JSON for **Reddit job 2** (Sysco / Restaurant Depot helper) — **separate** SproutGigs post |
| **REDDIT_JOB_SYSCO_JSON** | Same as above (use one or the other) |
| **QUORA_JOB_JSON** | JSON for the Quora job (see below) |

Optional: **DRY_RUN** = `1` to only check and log, don’t post jobs.

### Job JSON shape

Each env var is **one** JSON object = **one** SproutGigs job. You can run up to **two** Reddit jobs plus Quora. Each Reddit job needs a **different `title`** so the cron can tell them apart. Example:

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

- **title** – Must be **unique per job** on SproutGigs (cron matches running jobs by title; two Reddit jobs must not share the same title).
- **zone_id** – e.g. `int`.
- **category_id** – From SproutGigs categories.
- **instructions** – Array of strings.
- **num_tasks** – Min 10.
- **task_value** – USD per task.
- Optional: **proofs** – `[{"type":"screenshot","description":"Screenshot"}]`, **excluded_countries** – `["pk","bd"]`.

Paste as **one line** in Railway (no newlines).

### Two Reddit jobs (not one job with two links)

These are **two separate SproutGigs jobs**, each with its own workers and completions:

1. **Job 1 — `REDDIT_JOB_CONFIG`** — instructions point only to **[reddit-comment-helper2.vercel.app](https://reddit-comment-helper2.vercel.app/)** (general BoxNCase flow). Use a distinct **title**, e.g. `Reddit Comment`.

2. **Job 2 — `REDDIT_JOB_SYSCO_CONFIG`** — instructions point only to **[v0-reddit-comment-helper-7i.vercel.app](https://v0-reddit-comment-helper-7i.vercel.app/)** (enter Reddit username; messaging tuned for **Sysco’s acquisition of Restaurant Depot**). Use a **different title**, e.g. `Reddit Sysco Restaurant Depot`.

Example **REDDIT_JOB_CONFIG** (one line):

```
{"title":"Reddit Comment","zone_id":"int","category_id":"0501","instructions":["Go to https://reddit-comment-helper2.vercel.app/ and follow the instructions on the site","Use an account that has good reputation and age","Pick one of the 6 links, then choose a Reddit thread to comment on","Copy the Reddit link into the helper, generate a response, post it","Submit the VCODE on SproutGigs to complete the task"],"proofs":[{"type":"text","description":"Link to your Reddit comment"},{"type":"text","description":"VCODE from the verification tool"}],"num_tasks":25,"task_value":0.10}
```

Example **REDDIT_JOB_SYSCO_CONFIG** (one line):

```
{"title":"Reddit Sysco Restaurant Depot","zone_id":"int","category_id":"0501","instructions":["Go to https://v0-reddit-comment-helper-7i.vercel.app/ — enter your Reddit username when asked","This flow is for comments aligned with Sysco’s acquisition of Restaurant Depot","Use an account with good reputation and age","Follow the site’s steps, post on Reddit, then submit proof and VCODE on SproutGigs"],"proofs":[{"type":"text","description":"Link to your Reddit comment"},{"type":"text","description":"VCODE from the verification tool"}],"num_tasks":25,"task_value":0.10}
```

Do the same for **QUORA_JOB_JSON** with your Quora title and settings.

## 2. Cron job

Use [cron-job.org](https://cron-job.org) (or any cron):

- **URL:** `https://prflow-production.up.railway.app/api/cron/reddit-quora`
- **Method:** POST
- **Schedule:** e.g. every 6 hours or once a day
- **Header:**  
  - Name: `Authorization`  
  - Value: `Bearer YOUR_CRON_SECRET`  
  (same as **CRON_SECRET** in Railway)

No dashboard needed: the cron calls this URL; the app checks SproutGigs and posts each configured job (Reddit 1, Reddit 2, Quora) only if that job’s **title** is not already running.

## 3. Optional: turn off the rest

You can leave the rest of the app as-is (dashboard, DB, etc.). If you don’t open the app and only hit `/api/cron/reddit-quora`, it’s effectively “cron only.”  
To fully remove the dashboard you’d delete the dashboard routes and use only this cron route; that’s optional.
