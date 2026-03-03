import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { getOrCreateConfig } from "@/lib/config-service";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { jobId } = body as { jobId?: string };
    if (!jobId) {
      return NextResponse.json({ error: "jobId required" }, { status: 400 });
    }

    const sql = requireDb();
    const [job] = await sql`SELECT * FROM jobs WHERE id = ${jobId} LIMIT 1`;
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (job.status !== "failed") {
      return NextResponse.json({ error: "Only failed jobs can be retried" }, { status: 400 });
    }

    const config = await getOrCreateConfig();
    const today = new Date().toISOString().slice(0, 10);
    const [countResult] = await sql`
      SELECT COALESCE(SUM(jobs_launched), 0)::int AS launched
      FROM runs r
      LEFT JOIN jobs j ON j.run_id = r.id AND j.status = 'launched'
      WHERE r.run_date = ${today}
    `;
    const launchedToday = Number(countResult?.launched ?? 0);
    if (launchedToday >= config.max_jobs_per_day) {
      return NextResponse.json({ error: "Daily job cap reached" }, { status: 400 });
    }

    await sql`
      UPDATE jobs SET status = 'queued', error = NULL, updated_at = now()
      WHERE id = ${jobId}
    `;

    const runId = job.run_id;
    await sql`
      INSERT INTO tasks (run_id, type, status, payload)
      VALUES (${runId}, 'launch_job', 'queued', ${JSON.stringify({ job_index: job.job_index })})
    `;

    return NextResponse.json({
      ok: true,
      jobId,
      message: "Job queued for retry. Trigger run execute to process.",
    });
  } catch (e) {
    console.error("POST /api/jobs/retry", e);
    return NextResponse.json({ error: "Retry failed" }, { status: 500 });
  }
}
