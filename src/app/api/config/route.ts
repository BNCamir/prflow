import { NextResponse } from "next/server";
import { getOrCreateConfig, updateConfig, getConfig } from "@/lib/config-service";

export const dynamic = "force-dynamic";
import { getDecryptedAuth } from "@/lib/config-service";
import { z } from "zod";

const configUpdateSchema = z.object({
  timezone: z.string().optional(),
  run_time: z.string().optional(),
  active_days: z.array(z.number()).optional(),
  operating_start: z.string().optional(),
  operating_end: z.string().optional(),
  dry_run: z.boolean().optional(),
  max_jobs_per_day: z.number().optional(),
  daily_target_jobs: z.number().optional(),
  min_jobs_per_run: z.number().optional(),
  max_jobs_per_run: z.number().optional(),
  retry_max: z.number().optional(),
  retry_backoff_base_seconds: z.number().optional(),
  launch_spacing_seconds: z.number().optional(),
  demand_source_url: z.string().nullable().optional(),
  job_template: z.record(z.string(), z.unknown()).optional(),
  sproutgigs_username: z.string().optional(),
  sproutgigs_password: z.string().optional(),
});

export async function GET() {
  try {
    const config = await getOrCreateConfig();
    const auth = getDecryptedAuth(config);
    const out = {
      ...config,
      sproutgigs_auth_encrypted: undefined,
      sproutgigs_username: auth?.username ?? "",
      sproutgigs_password: auth ? "********" : "",
    };
    return NextResponse.json(out);
  } catch (e) {
    console.error("GET /api/config", e);
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = configUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const config = await getConfig();
    if (!config) {
      await getOrCreateConfig();
    }
    const payload: Record<string, unknown> = { ...parsed.data };
    if (payload.sproutgigs_password === "********") {
      delete payload.sproutgigs_password;
      delete payload.sproutgigs_username;
    }
    const updated = await updateConfig(payload as Parameters<typeof updateConfig>[0]);
    return NextResponse.json({
      ...updated,
      sproutgigs_auth_encrypted: undefined,
      sproutgigs_password: updated.sproutgigs_auth_encrypted ? "********" : "",
    });
  } catch (e) {
    console.error("PUT /api/config", e);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
