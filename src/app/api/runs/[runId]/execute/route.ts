import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { getOrCreateConfig, getDecryptedAuth } from "@/lib/config-service";
import { evaluateDemand } from "@/lib/demand-engine";
import { getSproutGigsClient } from "@/lib/sproutgigs";
import { renderTemplate } from "@/lib/template";
import { logActivity } from "@/lib/activity-log";
import type { ConfigRow, RunRow, TaskRow, JobRow } from "@/lib/types";

export const maxDuration = 120;

async function processEvaluateDemand(
  sql: ReturnType<typeof requireDb>,
  run: RunRow,
  config: ConfigRow
): Promise<void> {
  const today = run.run_date;
  const [countResult] = await sql`
    SELECT COALESCE(SUM(jobs_launched), 0)::int AS launched
    FROM runs r
    LEFT JOIN jobs j ON j.run_id = r.id AND j.status = 'launched'
    WHERE r.run_date = ${today}
  `;
  const alreadyLaunchedToday = Number(countResult?.launched ?? 0);
  const client = getSproutGigsClient(getDecryptedAuth(config));
  const activeJobs = await client.checkCurrentActiveJobs();
  let spendableBalance: number | undefined;
  if (typeof client.getSpendableBalance === "function") {
    try {
      spendableBalance = await client.getSpendableBalance();
    } catch (e) {
      console.warn("getSpendableBalance failed", e);
    }
  }
  const template = config.job_template as Record<string, unknown>;
  const numTasks = Math.max(10, Number(template.num_tasks) || 25);
  const taskValue = Math.max(0.05, Number(template.task_value ?? template.payout) ?? 0.10);
  const estimatedCostPerJob = numTasks * taskValue;

  const demandResult = evaluateDemand(config, {
    alreadyLaunchedToday,
    currentActiveCount: activeJobs.length,
    spendableBalance,
    estimatedCostPerJob,
  });

  const jobsToLaunch = Math.min(
    demandResult.jobsToLaunch,
    config.max_jobs_per_run,
    Math.max(0, config.max_jobs_per_day - alreadyLaunchedToday)
  );

  await sql`
    UPDATE runs SET
      jobs_needed = ${jobsToLaunch},
      status = 'running',
      started_at = COALESCE(started_at, now()),
      updated_at = now()
    WHERE id = ${run.id}
  `;

  await logActivity({
    runId: run.id,
    action: "evaluate_demand",
    details: {
      jobsToLaunch,
      reason: demandResult.reason,
      alreadyLaunchedToday,
      activeCount: activeJobs.length,
      spendableBalance,
      estimatedCostPerJob: spendableBalance != null ? estimatedCostPerJob : undefined,
    },
  });

  for (let i = 0; i < jobsToLaunch; i++) {
    await sql`
      INSERT INTO jobs (run_id, job_index, status)
      VALUES (${run.id}, ${i}, 'queued')
    `;
    await sql`
      INSERT INTO tasks (run_id, type, status, payload)
      VALUES (${run.id}, 'launch_job', 'queued', ${JSON.stringify({ job_index: i })})
    `;
  }
}

async function processLaunchJob(
  sql: ReturnType<typeof requireDb>,
  run: RunRow,
  config: ConfigRow,
  task: TaskRow
): Promise<void> {
  const jobIndex = (task.payload as { job_index?: number })?.job_index ?? 0;
  const [job] = await sql`
    SELECT * FROM jobs WHERE run_id = ${run.id} AND job_index = ${jobIndex} LIMIT 1
  `;
  if (!job || (job as JobRow).status !== "queued") return;

  await sql`UPDATE jobs SET status = 'launching', updated_at = now() WHERE id = ${job.id}`;
  await logActivity({ runId: run.id, jobId: job.id, action: "launch_start", details: { job_index: jobIndex } });

  const rendered = renderTemplate(
    config.job_template as Record<string, unknown>,
    { date: run.run_date, batch_number: 1, job_index: jobIndex }
  ) as Record<string, unknown> & {
    title: string;
    description?: string;
    zone_id?: string;
    category_id?: string;
    instructions?: string[];
    proofs?: { type: string; description: string }[];
    num_tasks?: number;
    task_value?: number;
    excluded_countries?: string[];
  };

  let result: { success: boolean; jobId?: string; error?: string };
  if (config.dry_run) {
    result = { success: true, jobId: `dry-run-${run.id}-${jobIndex}` };
    await logActivity({
      runId: run.id,
      jobId: job.id,
      action: "launch_dry_run",
      details: { payload: rendered },
    });
  } else {
    const client = getSproutGigsClient(getDecryptedAuth(config));
    result = await client.launchJob({
      ...rendered,
      title: rendered.title ?? "Job",
      description: rendered.description ?? "",
      zone_id: rendered.zone_id as string | undefined,
      category_id: rendered.category_id as string | undefined,
      instructions: rendered.instructions as string[] | undefined,
      proofs: rendered.proofs as { type: string; description: string }[] | undefined,
      num_tasks: typeof rendered.num_tasks === "number" ? rendered.num_tasks : typeof rendered.quantity === "number" ? rendered.quantity : 25,
      task_value: typeof rendered.task_value === "number" ? rendered.task_value : typeof rendered.payout === "number" ? rendered.payout : 0.10,
      excluded_countries: rendered.excluded_countries as string[] | undefined,
    });
  }

  if (result.success) {
    await sql`
      UPDATE jobs SET status = 'launched', external_job_id = ${result.jobId ?? null}, payload = ${JSON.stringify(rendered)}, updated_at = now()
      WHERE id = ${job.id}
    `;
    await sql`
      UPDATE runs SET jobs_launched = jobs_launched + 1, updated_at = now() WHERE id = ${run.id}
    `;
    await logActivity({ runId: run.id, jobId: job.id, action: "launched", details: { external_job_id: result.jobId } });
  } else {
    await sql`
      UPDATE jobs SET status = 'failed', error = ${result.error ?? "Unknown"}, payload = ${JSON.stringify(rendered)}, updated_at = now()
      WHERE id = ${job.id}
    `;
    await sql`
      UPDATE runs SET jobs_failed = jobs_failed + 1, updated_at = now() WHERE id = ${run.id}
    `;
    await logActivity({ runId: run.id, jobId: job.id, action: "launch_failed", details: { error: result.error } });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const sql = requireDb();
    const [run] = await sql`SELECT * FROM runs WHERE id = ${runId} LIMIT 1`;
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    const config = await getOrCreateConfig();
    const configRow = await sql`SELECT * FROM config WHERE id = ${config.id} LIMIT 1`;
    const configData = configRow[0] as ConfigRow;

    const spacingMs = (configData.launch_spacing_seconds ?? 2) * 1000;

    const tasks = await sql`
      SELECT * FROM tasks
      WHERE run_id = ${runId} AND status = 'queued' AND available_at <= now()
      ORDER BY type, created_at
    `;

    for (const task of tasks as TaskRow[]) {
      await sql`
        UPDATE tasks SET status = 'running', attempts = attempts + 1, updated_at = now()
        WHERE id = ${task.id}
      `;

      try {
        if (task.type === "evaluate_demand") {
          await processEvaluateDemand(sql, run as RunRow, configData);
        } else if (task.type === "launch_job") {
          await processLaunchJob(sql, run as RunRow, configData, task);
          await new Promise((r) => setTimeout(r, spacingMs));
        }
        await sql`
          UPDATE tasks SET status = 'success', updated_at = now() WHERE id = ${task.id}
        `;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await sql`
          UPDATE tasks SET status = 'failed', last_error = ${msg}, updated_at = now() WHERE id = ${task.id}
        `;
        await logActivity({
          runId,
          action: "task_failed",
          details: { task_id: task.id, task_type: task.type, error: msg },
        });
      }
    }

    const [runAfter] = await sql`SELECT * FROM runs WHERE id = ${runId} LIMIT 1`;
    const hasQueued = await sql`
      SELECT 1 FROM tasks WHERE run_id = ${runId} AND status = 'queued' LIMIT 1
    `;
    const runStatus = hasQueued.length > 0 ? "running" : "completed";
    await sql`
      UPDATE runs SET status = ${runStatus}, ended_at = now(), updated_at = now() WHERE id = ${runId}
    `;

    return NextResponse.json({
      ok: true,
      runId,
      status: runStatus,
      jobsLaunched: runAfter?.jobs_launched ?? 0,
      jobsFailed: runAfter?.jobs_failed ?? 0,
    });
  } catch (e) {
    console.error("execute", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Execute failed" },
      { status: 500 }
    );
  }
}
