import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
    const runId = searchParams.get("id") ?? undefined;

    const sql = requireDb();
    if (runId) {
      const [run] = await sql`SELECT * FROM runs WHERE id = ${runId} LIMIT 1`;
      if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const jobs = await sql`SELECT * FROM jobs WHERE run_id = ${runId} ORDER BY job_index`;
      const tasks = await sql`SELECT * FROM tasks WHERE run_id = ${runId} ORDER BY created_at`;
      return NextResponse.json({ run, jobs, tasks });
    }

    const runs = await sql`
      SELECT * FROM runs ORDER BY run_date DESC, created_at DESC LIMIT ${limit}
    `;
    return NextResponse.json(runs);
  } catch (e) {
    console.error("GET /api/runs", e);
    return NextResponse.json({ error: "Failed to load runs" }, { status: 500 });
  }
}
