import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { getOrCreateConfig } from "@/lib/config-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = requireDb();
    const config = await getOrCreateConfig();
    const today = new Date().toISOString().slice(0, 10);

    const [todayRun] = await sql`
      SELECT * FROM runs WHERE run_date = ${today} LIMIT 1
    `;

    const runsAttempted = todayRun ? 1 : 0;
    const jobsNeeded = todayRun?.jobs_needed ?? 0;
    const jobsLaunched = todayRun?.jobs_launched ?? 0;
    const jobsFailed = todayRun?.jobs_failed ?? 0;

    const actions = todayRun
      ? await sql`
          SELECT * FROM jobs WHERE run_id = ${todayRun.id} ORDER BY job_index
        `
      : [];

    const nextRun = getNextRunTime(config);
    const recentActivity = await sql`
      SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 20
    `;

    return NextResponse.json({
      runsAttempted,
      jobsNeeded,
      jobsLaunched,
      jobsFailed,
      todayRunId: todayRun?.id ?? null,
      todayRunStatus: todayRun?.status ?? null,
      actions,
      nextScheduledRun: nextRun,
      recentActivity,
    });
  } catch (e) {
    console.error("GET /api/dashboard", e);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}

function getNextRunTime(config: { timezone: string; run_time: string; active_days: number[] }): string | null {
  try {
    const [h, m] = config.run_time.split(":").map(Number);
    const tz = config.timezone || "America/New_York";
    const now = new Date();
    const today = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    today.setHours(h, m, 0, 0);
    const next = new Date(today);
    if (next <= now) next.setDate(next.getDate() + 1);
    let day = next.getDay();
    let attempts = 0;
    while (!config.active_days.includes(day) && attempts++ < 8) {
      next.setDate(next.getDate() + 1);
      day = next.getDay();
    }
    return next.toISOString();
  } catch {
    return null;
  }
}
