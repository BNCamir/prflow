/**
 * Minimal cron: keep Reddit and Quora jobs running.
 * No dashboard, no DB. Set env vars and point a cron at POST /api/cron/reddit-quora
 *
 * Required env:
 *   CRON_SECRET - same as Authorization: Bearer <CRON_SECRET>
 *   SPROUTGIGS_USER_ID, SPROUTGIGS_API_SECRET
 *   REDDIT_JOB_JSON - JSON for post-job (title, zone_id, category_id, instructions, num_tasks, task_value, proofs optional)
 *   QUORA_JOB_JSON - same for Quora
 *
 * Optional: DRY_RUN=1 to only log, don't post
 */

import { NextResponse } from "next/server";
import { SproutGigsApiClient } from "@/lib/sproutgigs/api-client";
import type { SproutGigsJobConfig } from "@/lib/sproutgigs/types";

export const maxDuration = 60;

/** GET: show that the endpoint exists (cron must use POST with Bearer token) */
export async function GET() {
  return NextResponse.json({
    message: "Cron endpoint. Use POST with header: Authorization: Bearer <CRON_SECRET>",
    docs: "See CRON-ONLY.md",
  });
}

function parseJobJson(name: string, raw: string | undefined): SproutGigsJobConfig | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o.title || typeof o.title !== "string") return null;
    return {
      title: o.title,
      description: typeof o.description === "string" ? o.description : undefined,
      zone_id: typeof o.zone_id === "string" ? o.zone_id : "int",
      category_id: typeof o.category_id === "string" ? o.category_id : "0501",
      instructions: Array.isArray(o.instructions) ? (o.instructions as string[]) : [String(o.description || "Complete the task.")],
      proofs: Array.isArray(o.proofs) ? (o.proofs as { type: string; description: string }[]) : [{ type: "screenshot", description: "Screenshot of completed task" }],
      num_tasks: typeof o.num_tasks === "number" ? o.num_tasks : 25,
      task_value: typeof o.task_value === "number" ? o.task_value : 0.10,
      excluded_countries: Array.isArray(o.excluded_countries) ? (o.excluded_countries as string[]) : undefined,
    };
  } catch {
    console.warn(`[reddit-quora] Invalid ${name} JSON`);
    return null;
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = process.env.SPROUTGIGS_USER_ID;
  const apiSecret = process.env.SPROUTGIGS_API_SECRET;
  if (!userId || !apiSecret) {
    return NextResponse.json({ error: "SPROUTGIGS_USER_ID and SPROUTGIGS_API_SECRET required" }, { status: 500 });
  }

  const redditConfig = parseJobJson("REDDIT", process.env.REDDIT_JOB_JSON);
  const quoraConfig = parseJobJson("QUORA", process.env.QUORA_JOB_JSON);
  if (!redditConfig && !quoraConfig) {
    return NextResponse.json({
      error: "Set REDDIT_JOB_JSON and/or QUORA_JOB_JSON (JSON for each job)",
      example: { title: "My Job", zone_id: "int", category_id: "0501", instructions: ["Step 1"], num_tasks: 25, task_value: 0.10 },
    }, { status: 400 });
  }

  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
  const client = new SproutGigsApiClient({ user_id: userId, api_secret: apiSecret });

  const running = await client.checkCurrentActiveJobs();
  const runningTitles = running.map((j) => j.title.toLowerCase());

  const results: { job: string; running: boolean; action: string; jobId?: string; error?: string }[] = [];

  const ensureJob = async (name: string, config: SproutGigsJobConfig) => {
    const titleLower = config.title.toLowerCase();
    const isRunning = runningTitles.some((t) => t.includes(titleLower) || titleLower.includes(t));
    if (isRunning) {
      results.push({ job: name, running: true, action: "skip" });
      return;
    }
    if (dryRun) {
      results.push({ job: name, running: false, action: "dry_run" });
      return;
    }
    const launch = await client.launchJob(config);
    if (launch.success) {
      results.push({ job: name, running: false, action: "launched", jobId: launch.jobId });
    } else {
      results.push({ job: name, running: false, action: "failed", error: launch.error });
    }
  };

  if (redditConfig) await ensureJob("Reddit", redditConfig);
  if (quoraConfig) await ensureJob("Quora", quoraConfig);

  return NextResponse.json({ ok: true, dryRun, results });
}
