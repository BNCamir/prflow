import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { getOrCreateConfig } from "@/lib/config-service";
import { logActivity } from "@/lib/activity-log";

export const maxDuration = 30;

export async function POST() {
  try {
    const sql = requireDb();
    const config = await getOrCreateConfig();
    const runDate = new Date().toISOString().slice(0, 10);

    const [existing] = await sql`
      SELECT id FROM runs WHERE run_date = ${runDate} LIMIT 1
    `;
    let runId: string;
    if (existing) {
      runId = existing.id;
      await logActivity({
        action: "run_now_skipped",
        runId,
        details: { reason: "run_exists_today" },
      });
      return NextResponse.json({
        ok: true,
        runId,
        message: "Run already exists for today. Use execute to process.",
      });
    }

    const [run] = await sql`
      INSERT INTO runs (run_date, config_id, status, jobs_needed)
      VALUES (${runDate}, ${config.id}, 'queued', 0)
      RETURNING id, run_date, status
    `;
    runId = run.id;

    await sql`
      INSERT INTO tasks (run_id, type, status, payload)
      VALUES (${runId}, 'evaluate_demand', 'queued', '{}')
    `;

    await logActivity({
      action: "run_now",
      runId,
      details: { run_date: runDate },
    });

    return NextResponse.json({
      ok: true,
      runId,
      runDate,
      status: run.status,
      message: "Run created. Call POST /api/runs/:runId/execute to process tasks.",
    });
  } catch (e) {
    console.error("run now", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Run now failed" },
      { status: 500 }
    );
  }
}
