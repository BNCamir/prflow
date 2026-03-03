import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
    const runId = searchParams.get("runId") ?? undefined;

    const sql = requireDb();
    const rows = runId
      ? await sql`
          SELECT j.*, r.run_date FROM jobs j
          JOIN runs r ON r.id = j.run_id
          WHERE j.run_id = ${runId}
          ORDER BY j.job_index
        `
      : await sql`
          SELECT j.*, r.run_date FROM jobs j
          JOIN runs r ON r.id = j.run_id
          ORDER BY j.created_at DESC
          LIMIT ${limit}
        `;
    return NextResponse.json(rows);
  } catch (e) {
    console.error("GET /api/jobs", e);
    return NextResponse.json({ error: "Failed to load jobs" }, { status: 500 });
  }
}
