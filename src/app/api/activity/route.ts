import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const runId = searchParams.get("runId") ?? undefined;

    const sql = requireDb();
    const rows = runId
      ? await sql`
          SELECT * FROM activity_log WHERE run_id = ${runId} ORDER BY created_at DESC LIMIT ${limit}
        `
      : await sql`
          SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ${limit}
        `;
    return NextResponse.json(rows);
  } catch (e) {
    console.error("GET /api/activity", e);
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 });
  }
}
