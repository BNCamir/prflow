import { requireDb } from "./db";

export async function logActivity(params: {
  action: string;
  details?: Record<string, unknown>;
  runId?: string | null;
  jobId?: string | null;
}): Promise<void> {
  const sql = requireDb();
  await sql`
    INSERT INTO activity_log (run_id, job_id, action, details)
    VALUES (${params.runId ?? null}, ${params.jobId ?? null}, ${params.action}, ${params.details ? JSON.stringify(params.details) : null})
  `;
}
