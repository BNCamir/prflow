import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { getOrCreateConfig } from "@/lib/config-service";
import { buildPrFlowSnapshot } from "@/lib/prflow-dashboard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const prFlow = await buildPrFlowSnapshot();

  let runsAttempted = 0;
  let jobsNeeded = 0;
  let jobsLaunched = 0;
  let jobsFailed = 0;
  let todayRunId: string | null = null;
  let todayRunStatus: string | null = null;
  const actions: unknown[] = [];
  let nextScheduledRun: string | null = null;
  let recentActivity: unknown[] = [];
  let envCronRunsToday = 0;
  let legacyAvailable = false;

  const today = new Date().toISOString().slice(0, 10);
  const dayStart = `${today}T00:00:00.000Z`;
  const dayEnd = `${today}T23:59:59.999Z`;

  try {
    const sql = requireDb();
    legacyAvailable = true;
    const config = await getOrCreateConfig();
    const [todayRun] = await sql`
      SELECT * FROM runs WHERE run_date = ${today} LIMIT 1
    `;

    runsAttempted = todayRun ? 1 : 0;
    jobsNeeded = todayRun?.jobs_needed ?? 0;
    jobsLaunched = todayRun?.jobs_launched ?? 0;
    jobsFailed = todayRun?.jobs_failed ?? 0;
    todayRunId = todayRun?.id ?? null;
    todayRunStatus = todayRun?.status ?? null;

    if (todayRun) {
      const rows = await sql`
        SELECT * FROM jobs WHERE run_id = ${todayRun.id} ORDER BY job_index
      `;
      actions.push(...rows);
    }

    nextScheduledRun = getNextRunTime(config);

    recentActivity = await sql`
      SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 20
    `;

    const [cnt] = await sql`
      SELECT COUNT(*)::int AS c FROM activity_log
      WHERE action = 'env_cron_from_dashboard'
        AND created_at >= ${dayStart}
        AND created_at <= ${dayEnd}
    `;
    envCronRunsToday = Number((cnt as { c: number })?.c ?? 0);
  } catch {
    legacyAvailable = false;
  }

  const prLaunched = prFlow.configured.filter((c) => c.state === "active").length;
  const prInactive = prFlow.configured.filter((c) => c.state === "inactive").length;

  return NextResponse.json({
    legacyAvailable,
    runsAttempted,
    jobsNeeded,
    jobsLaunched,
    jobsFailed,
    todayRunId,
    todayRunStatus,
    actions,
    nextScheduledRun,
    recentActivity,
    envCronRunsToday,
    prFlow,
    summary: {
      prFlowConnected: prFlow.connected,
      sproutGigsRunningCount: prFlow.jobs.filter((j) =>
        String(j.status).toLowerCase().includes("run")
      ).length,
      prTemplatesConfigured: prFlow.configured.length,
      prTemplatesActive: prLaunched,
      prTemplatesInactive: prInactive,
    },
  });
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
