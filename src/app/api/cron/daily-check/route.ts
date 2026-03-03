import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { getOrCreateConfig } from "@/lib/config-service";
import { logActivity } from "@/lib/activity-log";

export const maxDuration = 60;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = requireDb();
    const config = await getOrCreateConfig();
    const runDate = new Date().toISOString().slice(0, 10);

    const existing = await sql`
      SELECT id FROM runs WHERE run_date = ${runDate} LIMIT 1
    `;
    if (existing.length > 0) {
      await logActivity({ action: "cron_skipped", details: { reason: "already_has_run_today", run_date: runDate } });
      return NextResponse.json({ ok: true, message: "Run already exists for today", runId: existing[0].id });
    }

    const [run] = await sql`
      INSERT INTO runs (run_date, config_id, status, jobs_needed)
      VALUES (${runDate}, ${config.id}, 'queued', 0)
      RETURNING id, run_date, status
    `;

    await sql`
      INSERT INTO tasks (run_id, type, status, payload)
      VALUES (${run.id}, 'evaluate_demand', 'queued', '{}')
    `;

    await logActivity({
      action: "cron_daily_check",
      runId: run.id,
      details: { run_date: runDate, run_id: run.id },
    });

    return NextResponse.json({
      ok: true,
      runId: run.id,
      runDate: run.run_date,
      status: run.status,
      message: "Daily run enqueued. Worker should process tasks.",
    });
  } catch (e) {
    console.error("daily-check", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Daily check failed" },
      { status: 500 }
    );
  }
}
