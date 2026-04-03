/**
 * Minimal cron: keep Reddit and Quora jobs running.
 * No dashboard, no DB. Set env vars and point a cron at POST /api/cron/reddit-quora
 *
 * Required env:
 *   CRON_SECRET - same as Authorization: Bearer <CRON_SECRET>
 *   SPROUTGIGS_USER_ID, SPROUTGIGS_API_SECRET
 *   REDDIT_JOB_JSON or REDDIT_JOB_CONFIG - first Reddit job (e.g. general helper — own title on SproutGigs)
 *   REDDIT_JOB_SYSCO_JSON or REDDIT_JOB_SYSCO_CONFIG - second Reddit job (e.g. Sysco / Restaurant Depot helper — separate job post)
 *   QUORA_JOB_JSON - Quora job
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

function coerceNumber(v: unknown, fallback: number): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
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
      num_tasks: coerceNumber(o.num_tasks, 25),
      task_value: coerceNumber(o.task_value, 0.1),
      excluded_countries: Array.isArray(o.excluded_countries) ? (o.excluded_countries as string[]) : undefined,
    };
  } catch {
    console.warn(`[reddit-quora] Invalid ${name} JSON`);
    return null;
  }
}

/** Avoid false "already running" when a short running title is a substring of the config title (e.g. "reddit"). */
function titleMatchesConfig(runningTitleLower: string, configTitleLower: string): boolean {
  if (runningTitleLower === configTitleLower) return true;
  if (runningTitleLower.includes(configTitleLower)) return true;
  const minLen = 12;
  if (
    runningTitleLower.length >= minLen &&
    configTitleLower.length >= minLen &&
    configTitleLower.includes(runningTitleLower)
  ) {
    return true;
  }
  return false;
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

  const redditRaw =
    process.env.REDDIT_JOB_JSON?.trim() ||
    process.env.REDDIT_JOB_CONFIG?.trim();
  const redditSyscoRaw =
    process.env.REDDIT_JOB_SYSCO_JSON?.trim() ||
    process.env.REDDIT_JOB_SYSCO_CONFIG?.trim();
  const redditConfig = parseJobJson("REDDIT", redditRaw);
  const redditSyscoConfig = parseJobJson("REDDIT_SYSCO", redditSyscoRaw);
  const quoraConfig = parseJobJson("QUORA", process.env.QUORA_JOB_JSON);
  if (!redditConfig && !redditSyscoConfig && !quoraConfig) {
    return NextResponse.json({
      error:
        "Set at least one of: REDDIT_JOB_CONFIG, REDDIT_JOB_SYSCO_CONFIG, QUORA_JOB_JSON (each is a separate SproutGigs job)",
      example: { title: "My Job", zone_id: "int", category_id: "0501", instructions: ["Step 1"], num_tasks: 25, task_value: 0.10 },
    }, { status: 400 });
  }

  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
  const client = new SproutGigsApiClient({ user_id: userId, api_secret: apiSecret });

  const existing = await client.jobsBlockingRelaunch();
  const runningTitles = existing.map((j) => j.title.toLowerCase());

  const results: { job: string; running: boolean; action: string; jobId?: string; error?: string }[] = [];
  const existingJobs = existing.map((j) => ({ title: j.title, status: j.status }));

  /** broadKeywordMatch: Quora uses "quora" in title (e.g. "Quora: Comment"). Reddit jobs use title-only so two Reddit posts do not collide. */
  const ensureJob = async (
    name: string,
    config: SproutGigsJobConfig,
    opts?: { broadKeywordMatch?: boolean }
  ) => {
    const titleLower = config.title.toLowerCase();
    const keyword = name.toLowerCase();
    const broad = opts?.broadKeywordMatch ?? false;
    const isRunning = runningTitles.some((t) => {
      if (titleMatchesConfig(t, titleLower)) return true;
      if (broad && t.includes(keyword)) return true;
      return false;
    });
    if (isRunning) {
      results.push({ job: name, running: true, action: "skip" });
      return;
    }
    if (dryRun) {
      results.push({ job: name, running: false, action: "dry_run" });
      return;
    }
    try {
      const launch = await client.launchJob(config);
      if (launch.success) {
        results.push({ job: name, running: false, action: "launched", jobId: launch.jobId });
      } else {
        results.push({ job: name, running: false, action: "failed", error: launch.error });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ job: name, running: false, action: "failed", error: msg });
    }
  };

  if (redditConfig) await ensureJob("Reddit", redditConfig);
  if (redditSyscoConfig) await ensureJob("Reddit (Sysco/RD)", redditSyscoConfig);
  if (quoraConfig) await ensureJob("Quora", quoraConfig, { broadKeywordMatch: true });

  let spendableUsd: number | null = null;
  try {
    spendableUsd = await client.getSpendableBalance();
  } catch {
    spendableUsd = null;
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    results,
    configLoaded: {
      reddit: !!redditConfig,
      redditSysco: !!redditSyscoConfig,
      quora: !!quoraConfig,
    },
    redditEnvLength: process.env.REDDIT_JOB_JSON?.length ?? 0,
    redditAltEnvLength: process.env.REDDIT_JOB_CONFIG?.length ?? 0,
    redditSyscoEnvLength: redditSyscoRaw?.length ?? 0,
    existingJobs,
    spendableUsd,
  });
}
