import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { getOrCreateConfig } from "@/lib/config-service";
import { logActivity } from "@/lib/activity-log";
import { normalizeSlots, runRedditQuoraCron } from "@/lib/cron-reddit-quora-engine";

export const maxDuration = 60;

async function readSlotsFromRequest(request: Request) {
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return undefined;
    const body = (await request.json()) as { slots?: unknown };
    return normalizeSlots(body?.slots);
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  const slots = await readSlotsFromRequest(request);
  const cronResult = await runRedditQuoraCron(slots?.length ? { slots } : undefined);

  if (cronResult.ok) {
    try {
      await logActivity({
        action: "env_cron_from_dashboard",
        details: {
          results: cronResult.data.results,
          spendableUsd: cronResult.data.spendableUsd,
          configLoaded: cronResult.data.configLoaded,
          slotsRun: cronResult.data.slotsRun,
        },
      });
    } catch {
      /* DB optional for logging */
    }
    return NextResponse.json({
      mode: "env_cron",
      ...cronResult.data,
    });
  }

  if (cronResult.data.fallbackToLegacy) {
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
          mode: "legacy",
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
        mode: "legacy",
        runId,
        runDate,
        status: run.status,
        message: "Run created. Call POST /api/runs/:runId/execute to process tasks.",
      });
    } catch (e) {
      console.error("run now legacy", e);
    }
  }

  return NextResponse.json(cronResult.data, { status: cronResult.status });
}
