-- SproutGigs Dashboard - Initial schema
-- Compatible with Neon / Vercel Postgres / Supabase

-- Config (single row or keyed by id)
CREATE TABLE IF NOT EXISTS config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  run_time TEXT NOT NULL DEFAULT '09:00',
  active_days JSONB NOT NULL DEFAULT '[1,2,3,4,5]',
  operating_start TEXT NOT NULL DEFAULT '09:00',
  operating_end TEXT NOT NULL DEFAULT '18:00',
  dry_run BOOLEAN NOT NULL DEFAULT true,
  max_jobs_per_day INTEGER NOT NULL DEFAULT 10,
  daily_target_jobs INTEGER NOT NULL DEFAULT 5,
  min_jobs_per_run INTEGER NOT NULL DEFAULT 1,
  max_jobs_per_run INTEGER NOT NULL DEFAULT 5,
  retry_max INTEGER NOT NULL DEFAULT 3,
  retry_backoff_base_seconds INTEGER NOT NULL DEFAULT 60,
  launch_spacing_seconds INTEGER NOT NULL DEFAULT 2,
  demand_source_url TEXT,
  job_template JSONB NOT NULL DEFAULT '{}',
  sproutgigs_auth_encrypted TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Runs (daily run records, idempotent on run_date)
CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE NOT NULL,
  config_id UUID REFERENCES config(id),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  jobs_needed INTEGER NOT NULL DEFAULT 0,
  jobs_launched INTEGER NOT NULL DEFAULT 0,
  jobs_failed INTEGER NOT NULL DEFAULT 0,
  errors JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_date)
);

-- Jobs (launched jobs per run)
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  job_index INTEGER NOT NULL,
  external_job_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'launching', 'launched', 'failed')),
  payload JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_id, job_index)
);

-- Tasks (queue for worker processing)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('evaluate_demand', 'launch_job', 'sync_status')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'success', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_runs_run_date ON runs(run_date);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_run_id ON jobs(run_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_tasks_run_id ON tasks(run_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_available ON tasks(status, available_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_run_id ON activity_log(run_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

-- Default config is created by the app on first GET /api/config
