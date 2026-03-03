import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { getOrCreateConfig, getDecryptedAuth } from "@/lib/config-service";
import { getSproutGigsClient } from "@/lib/sproutgigs";
import { renderTemplate } from "@/lib/template";
import { logActivity } from "@/lib/activity-log";
import type { ConfigRow } from "@/lib/types";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { runId, jobIndex } = body as { runId?: string; jobIndex?: number };
    if (!runId || typeof jobIndex !== "number") {
      return NextResponse.json({ error: "runId and jobIndex required" }, { status: 400 });
    }

    const sql = requireDb();
    const config = await getOrCreateConfig();
    const configRow = (await sql`SELECT * FROM config WHERE id = ${config.id} LIMIT 1`)[0] as ConfigRow;
    if (!configRow) {
      return NextResponse.json({ error: "Config not found" }, { status: 500 });
    }

    const [job] = await sql`
      SELECT * FROM jobs WHERE run_id = ${runId} AND job_index = ${jobIndex} LIMIT 1
    `;
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (job.status === "launched") {
      return NextResponse.json({ error: "Job already launched", jobId: job.external_job_id }, { status: 400 });
    }

    const [run] = await sql`SELECT run_date FROM runs WHERE id = ${runId} LIMIT 1`;
    const rendered = renderTemplate(configRow.job_template as Record<string, unknown>, {
      date: run?.run_date ?? new Date().toISOString().slice(0, 10),
      batch_number: 1,
      job_index: jobIndex,
    }) as { title: string; description: string; [key: string]: unknown };

    if (configRow.dry_run) {
      await sql`
        UPDATE jobs SET status = 'launched', external_job_id = ${`dry-run-${runId}-${jobIndex}`}, payload = ${JSON.stringify(rendered)}, updated_at = now()
        WHERE id = ${job.id}
      `;
      await logActivity({ runId, jobId: job.id, action: "manual_launch_dry_run", details: {} });
      return NextResponse.json({ success: true, dryRun: true, jobId: `dry-run-${runId}-${jobIndex}` });
    }

    const client = getSproutGigsClient(getDecryptedAuth(configRow));
    const result = await client.launchJob({
      ...rendered,
      title: (rendered.title as string) ?? "Job",
      description: (rendered.description as string) ?? "",
    });

    if (result.success) {
      await sql`
        UPDATE jobs SET status = 'launched', external_job_id = ${result.jobId ?? null}, payload = ${JSON.stringify(rendered)}, error = NULL, updated_at = now()
        WHERE id = ${job.id}
      `;
      await sql`UPDATE runs SET jobs_launched = jobs_launched + 1, updated_at = now() WHERE id = ${runId}`;
      await logActivity({ runId, jobId: job.id, action: "manual_launched", details: { external_job_id: result.jobId } });
      return NextResponse.json({ success: true, jobId: result.jobId });
    } else {
      await sql`
        UPDATE jobs SET status = 'failed', error = ${result.error ?? "Unknown"}, updated_at = now()
        WHERE id = ${job.id}
      `;
      await logActivity({ runId, jobId: job.id, action: "manual_launch_failed", details: { error: result.error } });
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (e) {
    console.error("POST /api/jobs/launch", e);
    return NextResponse.json({ error: "Launch failed" }, { status: 500 });
  }
}
