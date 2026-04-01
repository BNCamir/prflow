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
| **REDDIT_JOB_CONFIG** | JSON for the Reddit job (recommended on Railway; see below) |
| **REDDIT_JOB_JSON** | Same as above if you prefer this name (use one or the other) |
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

Paste as **one line** in Railway (no newlines).

### Reddit comment helpers (both in the job post)

You **post both** links in the job instructions so workers can pick the right tool:

1. **[reddit-comment-helper2.vercel.app](https://reddit-comment-helper2.vercel.app/)** — general BoxNCase Reddit comment flow.
2. **[v0-reddit-comment-helper-7i.vercel.app](https://v0-reddit-comment-helper-7i.vercel.app/)** — BoxNCase helper where workers enter their Reddit username; the prompts are **updated for messaging around Sysco’s acquisition of Restaurant Depot** (use this when the thread fits that narrative).

Workers may use either helper depending on context; both stay in the instructions. Example **REDDIT_JOB_CONFIG** (one line for Railway):

```
{"title":"Reddit Comment","zone_id":"int","category_id":"0501","instructions":["Two helpers — post both in your workflow: (1) https://reddit-comment-helper2.vercel.app/ for general BoxNCase comments. (2) https://v0-reddit-comment-helper-7i.vercel.app/ — enter your Reddit username; this version is tailored for Sysco’s acquisition of Restaurant Depot. Use whichever fits the thread.","Use an account that has good reputation and age","Pick one of the 6 links, then choose a Reddit thread to comment on with the helper you chose","Copy the Reddit link into the helper and generate a response","Post the response on Reddit","Submit the VCODE on SproutGigs to complete the task"],"proofs":[{"type":"text","description":"Link to your Reddit comment"},{"type":"text","description":"VCODE provided from the verification tool"}],"num_tasks":25,"task_value":0.10}
```

Shorter example for **REDDIT_JOB_JSON** / **REDDIT_JOB_CONFIG**:

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
