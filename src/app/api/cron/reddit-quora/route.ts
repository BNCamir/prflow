/**
 * Minimal cron: keep Reddit and Quora jobs running.
 * Optional JSON body: { "slots": ["reddit", "redditSysco", "quora"] } — omit or empty = all configured templates.
 */

import { NextResponse } from "next/server";
import { normalizeSlots, runRedditQuoraCron } from "@/lib/cron-reddit-quora-engine";

export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({
    message: "Cron endpoint. Use POST with header: Authorization: Bearer <CRON_SECRET>",
    docs: "See CRON-ONLY.md",
    optionalBody: { slots: ["reddit", "redditSysco", "quora"] },
  });
}

async function readSlots(request: Request) {
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
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slots = await readSlots(request);
  const result = await runRedditQuoraCron(slots?.length ? { slots } : undefined);
  if (!result.ok) {
    return NextResponse.json(result.data, { status: result.status });
  }
  return NextResponse.json(result.data);
}
