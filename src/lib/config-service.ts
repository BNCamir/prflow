import { requireDb } from "./db";
import type { ConfigRow, ConfigPayload, JobTemplate } from "./types";
import { encrypt, decrypt, hasEncryptionKey } from "./encryption";

const DEFAULT_CONFIG: Partial<ConfigRow> = {
  timezone: "America/New_York",
  run_time: "09:00",
  active_days: [1, 2, 3, 4, 5],
  operating_start: "09:00",
  operating_end: "18:00",
  dry_run: true,
  max_jobs_per_day: 10,
  daily_target_jobs: 5,
  min_jobs_per_run: 1,
  max_jobs_per_run: 5,
  retry_max: 3,
  retry_backoff_base_seconds: 60,
  launch_spacing_seconds: 2,
  demand_source_url: null,
  job_template: {},
  sproutgigs_auth_encrypted: null,
};

export async function getConfig(): Promise<ConfigRow | null> {
  const sql = requireDb();
  const rows = await sql`SELECT * FROM config ORDER BY created_at DESC LIMIT 1`;
  const row = rows[0];
  if (!row) return null;
  return row as ConfigRow;
}

export async function getOrCreateConfig(): Promise<ConfigRow> {
  let config = await getConfig();
  if (!config) {
    const sql = requireDb();
    const [inserted] = await sql`
      INSERT INTO config (
        timezone, run_time, active_days, operating_start, operating_end,
        dry_run, max_jobs_per_day, daily_target_jobs, min_jobs_per_run, max_jobs_per_run,
        retry_max, retry_backoff_base_seconds, launch_spacing_seconds, demand_source_url, job_template
      ) VALUES (
        ${DEFAULT_CONFIG.timezone},
        ${DEFAULT_CONFIG.run_time},
        ${JSON.stringify(DEFAULT_CONFIG.active_days)},
        ${DEFAULT_CONFIG.operating_start},
        ${DEFAULT_CONFIG.operating_end},
        ${DEFAULT_CONFIG.dry_run},
        ${DEFAULT_CONFIG.max_jobs_per_day},
        ${DEFAULT_CONFIG.daily_target_jobs},
        ${DEFAULT_CONFIG.min_jobs_per_run},
        ${DEFAULT_CONFIG.max_jobs_per_run},
        ${DEFAULT_CONFIG.retry_max},
        ${DEFAULT_CONFIG.retry_backoff_base_seconds},
        ${(DEFAULT_CONFIG as Record<string, unknown>).launch_spacing_seconds ?? 2},
        ${DEFAULT_CONFIG.demand_source_url},
        ${JSON.stringify(DEFAULT_CONFIG.job_template ?? {})}
      )
      RETURNING *
    `;
    config = inserted as ConfigRow;
  }
  return config;
}

export async function updateConfig(payload: Partial<ConfigPayload>): Promise<ConfigRow> {
  const sql = requireDb();
  const current = await getOrCreateConfig();
  let sproutgigs_auth_encrypted = current.sproutgigs_auth_encrypted;

  if (payload.sproutgigs_username !== undefined || payload.sproutgigs_password !== undefined) {
    if (hasEncryptionKey()) {
      const existing = getDecryptedAuth(current);
      const auth = {
        username: payload.sproutgigs_username ?? existing?.username ?? "",
        password: payload.sproutgigs_password ?? existing?.password ?? "",
      };
      sproutgigs_auth_encrypted = encrypt(JSON.stringify(auth));
    }
  }

  const active_days = payload.active_days ?? current.active_days;
  const job_template = (payload.job_template ?? current.job_template) as JobTemplate;

  const [updated] = await sql`
    UPDATE config SET
      timezone = ${payload.timezone ?? current.timezone},
      run_time = ${payload.run_time ?? current.run_time},
      active_days = ${JSON.stringify(active_days)},
      operating_start = ${payload.operating_start ?? current.operating_start},
      operating_end = ${payload.operating_end ?? current.operating_end},
      dry_run = ${payload.dry_run ?? current.dry_run},
      max_jobs_per_day = ${payload.max_jobs_per_day ?? current.max_jobs_per_day},
      daily_target_jobs = ${payload.daily_target_jobs ?? current.daily_target_jobs},
      min_jobs_per_run = ${payload.min_jobs_per_run ?? current.min_jobs_per_run},
      max_jobs_per_run = ${payload.max_jobs_per_run ?? current.max_jobs_per_run},
      retry_max = ${payload.retry_max ?? current.retry_max},
      retry_backoff_base_seconds = ${payload.retry_backoff_base_seconds ?? current.retry_backoff_base_seconds},
      launch_spacing_seconds = ${payload.launch_spacing_seconds ?? current.launch_spacing_seconds},
      demand_source_url = ${payload.demand_source_url ?? current.demand_source_url},
      job_template = ${JSON.stringify(job_template)},
      sproutgigs_auth_encrypted = ${sproutgigs_auth_encrypted ?? current.sproutgigs_auth_encrypted},
      updated_at = now()
    WHERE id = ${current.id}
    RETURNING *
  `;
  return updated as ConfigRow;
}

export function getDecryptedAuth(config: ConfigRow): { username: string; password: string } | null {
  if (!config.sproutgigs_auth_encrypted) return null;
  try {
    return JSON.parse(decrypt(config.sproutgigs_auth_encrypted)) as { username: string; password: string };
  } catch {
    return null;
  }
}
