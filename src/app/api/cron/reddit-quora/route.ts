/**
 * Minimal cron: keep Reddit and Quora jobs running.
 * No dashboard, no DB. Set env vars and point a cron at POST /api/cron/reddit-quora
 *
 * Required env:
 *   CRON_SECRET - same as Authorization: Bearer <CRON_SECRET>
 *   SPROUTGIGS_USER_ID, SPROUTGIGS_API_SECRET
 *   REDDIT_JOB_JSON or REDDIT_JOB_CONFIG, REDDIT_JOB_SYSCO_*, QUORA_JOB_JSON
 *
 * Optional: DRY_RUN=1 to only log, don't post
 *
 * Same engine as dashboard "Run now" when env job configs exist (see /api/runs/now).
 */

import { NextResponse } from "next/server";
import { runRedditQuoraCron } from "@/lib/cron-reddit-quora-engine";

export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({
    message: "Cron endpoint. Use POST with header: Authorization: Bearer <CRON_SECRET>",
    docs: "See CRON-ONLY.md",
  });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runRedditQuoraCron();
  if (!result.ok) {
    return NextResponse.json(result.data, { status: result.status });
  }
  return NextResponse.json(result.data);
}
