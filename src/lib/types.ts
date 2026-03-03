export type RunStatus = "queued" | "running" | "completed" | "failed";
export type JobStatus = "queued" | "launching" | "launched" | "failed";
export type TaskType = "evaluate_demand" | "launch_job" | "sync_status";
export type TaskStatus = "queued" | "running" | "success" | "failed";

export interface ConfigRow {
  id: string;
  timezone: string;
  run_time: string;
  active_days: number[];
  operating_start: string;
  operating_end: string;
  dry_run: boolean;
  max_jobs_per_day: number;
  daily_target_jobs: number;
  min_jobs_per_run: number;
  max_jobs_per_run: number;
  retry_max: number;
  retry_backoff_base_seconds: number;
  launch_spacing_seconds: number;
  demand_source_url: string | null;
  job_template: JobTemplate;
  sproutgigs_auth_encrypted: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobTemplate {
  title?: string;
  description?: string;
  category?: string;
  payout?: number | string;
  quantity?: number;
  allowed_countries?: string[];
  media?: string[];
  [key: string]: unknown;
}

export interface RunRow {
  id: string;
  run_date: string;
  config_id: string | null;
  status: RunStatus;
  started_at: string | null;
  ended_at: string | null;
  jobs_needed: number;
  jobs_launched: number;
  jobs_failed: number;
  errors: unknown[] | null;
  created_at: string;
  updated_at: string;
}

export interface JobRow {
  id: string;
  run_id: string;
  job_index: number;
  external_job_id: string | null;
  status: JobStatus;
  payload: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  run_id: string;
  type: TaskType;
  status: TaskStatus;
  attempts: number;
  available_at: string;
  payload: Record<string, unknown> | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogRow {
  id: string;
  run_id: string | null;
  job_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export type ConfigPayload = Omit<
  ConfigRow,
  "id" | "sproutgigs_auth_encrypted" | "created_at" | "updated_at"
> & { sproutgigs_username?: string; sproutgigs_password?: string };
