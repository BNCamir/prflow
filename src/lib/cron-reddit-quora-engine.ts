import { SproutGigsApiClient } from "@/lib/sproutgigs/api-client";
import type { SproutGigsJobConfig } from "@/lib/sproutgigs/types";

function coerceNumber(v: unknown, fallback: number): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

export function parseJobJson(name: string, raw: string | undefined): SproutGigsJobConfig | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o.title || typeof o.title !== "string") return null;
    return {
      title: o.title,
      description: typeof o.description === "string" ? o.description : undefined,
      zone_id: typeof o.zone_id === "string" ? o.zone_id : "int",
      category_id: typeof o.category_id === "string" ? o.category_id : "0501",
      instructions: Array.isArray(o.instructions) ? (o.instructions as string[]) : [String(o.description || "Complete the task.")],
      proofs: Array.isArray(o.proofs) ? (o.proofs as { type: string; description: string }[]) : [{ type: "screenshot", description: "Screenshot of completed task" }],
      num_tasks: coerceNumber(o.num_tasks, 25),
      task_value: coerceNumber(o.task_value, 0.1),
      excluded_countries: Array.isArray(o.excluded_countries) ? (o.excluded_countries as string[]) : undefined,
    };
  } catch {
    console.warn(`[reddit-quora] Invalid ${name} JSON`);
    return null;
  }
}

export function titleMatchesConfig(runningTitleLower: string, configTitleLower: string): boolean {
  if (runningTitleLower === configTitleLower) return true;
  if (runningTitleLower.includes(configTitleLower)) return true;
  const minLen = 12;
  if (
    runningTitleLower.length >= minLen &&
    configTitleLower.length >= minLen &&
    configTitleLower.includes(runningTitleLower)
  ) {
    return true;
  }
  return false;
}

export type CronSlot = "reddit" | "redditSysco" | "quora";

export type RedditQuoraCronPayload = {
  ok: true;
  dryRun: boolean;
  results: { job: string; running: boolean; action: string; jobId?: string; error?: string }[];
  configLoaded: { reddit: boolean; redditSysco: boolean; quora: boolean };
  slotsRun: CronSlot[];
  redditEnvLength: number;
  redditAltEnvLength: number;
  redditSyscoEnvLength: number;
  existingJobs: { title: string; status: string }[];
  spendableUsd: number | null;
};

export type RedditQuoraCronError = {
  error: string;
  example?: Record<string, unknown>;
  /** If true, /api/runs/now may fall back to the legacy DB run flow */
  fallbackToLegacy?: boolean;
};

const ALLOWED_SLOTS = new Set<CronSlot>(["reddit", "redditSysco", "quora"]);

export function normalizeSlots(raw: unknown): CronSlot[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out = raw.filter((s): s is CronSlot => typeof s === "string" && ALLOWED_SLOTS.has(s as CronSlot));
  return out.length ? out : undefined;
}

export type RunRedditQuoraCronOptions = {
  /** If set, only these templates are evaluated (must exist in env). If omitted, all configured templates run. */
  slots?: CronSlot[];
};

/**
 * Env-based SproutGigs check + launch (same logic as POST /api/cron/reddit-quora without Bearer auth).
 */
export async function runRedditQuoraCron(
  options?: RunRedditQuoraCronOptions
): Promise<
  { ok: true; data: RedditQuoraCronPayload } | { ok: false; status: number; data: RedditQuoraCronError }
> {
  const userId = process.env.SPROUTGIGS_USER_ID;
  const apiSecret = process.env.SPROUTGIGS_API_SECRET;
  if (!userId || !apiSecret) {
    return {
      ok: false,
      status: 500,
      data: {
        error: "SPROUTGIGS_USER_ID and SPROUTGIGS_API_SECRET required",
        fallbackToLegacy: true,
      },
    };
  }

  const redditRaw =
    process.env.REDDIT_JOB_JSON?.trim() ||
    process.env.REDDIT_JOB_CONFIG?.trim();
  const redditSyscoRaw =
    process.env.REDDIT_JOB_SYSCO_JSON?.trim() ||
    process.env.REDDIT_JOB_SYSCO_CONFIG?.trim();
  const redditConfig = parseJobJson("REDDIT", redditRaw);
  const redditSyscoConfig = parseJobJson("REDDIT_SYSCO", redditSyscoRaw);
  const quoraConfig = parseJobJson("QUORA", process.env.QUORA_JOB_JSON);
  if (!redditConfig && !redditSyscoConfig && !quoraConfig) {
    return {
      ok: false,
      status: 400,
      data: {
        error:
          "Set at least one of: REDDIT_JOB_CONFIG, REDDIT_JOB_SYSCO_CONFIG, QUORA_JOB_JSON (each is a separate SproutGigs job)",
        example: { title: "My Job", zone_id: "int", category_id: "0501", instructions: ["Step 1"], num_tasks: 25, task_value: 0.1 },
        fallbackToLegacy: true,
      },
    };
  }

  const slotsFilter = options?.slots?.length ? new Set(options.slots) : null;
  const slotsRun: CronSlot[] = [];

  const shouldRun = (slot: CronSlot, hasConfig: boolean): boolean => {
    if (!hasConfig) return false;
    if (!slotsFilter) return true;
    return slotsFilter.has(slot);
  };

  if (slotsFilter) {
    const requested = options!.slots!;
    const missing = requested.filter((s) => {
      if (s === "reddit") return !redditConfig;
      if (s === "redditSysco") return !redditSyscoConfig;
      return !quoraConfig;
    });
    if (missing.length === requested.length) {
      return {
        ok: false,
        status: 400,
        data: {
          error: `No job template in env for selected slot(s): ${missing.join(", ")}`,
        },
      };
    }
  }

  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
  const client = new SproutGigsApiClient({ user_id: userId, api_secret: apiSecret });

  const existing = await client.jobsBlockingRelaunch();
  const runningTitles = existing.map((j) => j.title.toLowerCase());

  const results: { job: string; running: boolean; action: string; jobId?: string; error?: string }[] = [];
  const existingJobs = existing.map((j) => ({ title: j.title, status: j.status }));

  const ensureJob = async (
    slot: CronSlot,
    name: string,
    config: SproutGigsJobConfig,
    opts?: { broadKeywordMatch?: boolean }
  ) => {
    if (!shouldRun(slot, true)) return;
    slotsRun.push(slot);
    const titleLower = config.title.toLowerCase();
    const keyword = name.toLowerCase();
    const broad = opts?.broadKeywordMatch ?? false;
    const isRunning = runningTitles.some((t) => {
      if (titleMatchesConfig(t, titleLower)) return true;
      if (broad && t.includes(keyword)) return true;
      return false;
    });
    if (isRunning) {
      results.push({ job: name, running: true, action: "skip" });
      return;
    }
    if (dryRun) {
      results.push({ job: name, running: false, action: "dry_run" });
      return;
    }
    try {
      const launch = await client.launchJob(config);
      if (launch.success) {
        results.push({ job: name, running: false, action: "launched", jobId: launch.jobId });
      } else {
        results.push({ job: name, running: false, action: "failed", error: launch.error });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ job: name, running: false, action: "failed", error: msg });
    }
  };

  if (redditConfig) await ensureJob("reddit", "Reddit", redditConfig);
  if (redditSyscoConfig) await ensureJob("redditSysco", "Reddit (Sysco/RD)", redditSyscoConfig);
  if (quoraConfig) await ensureJob("quora", "Quora", quoraConfig, { broadKeywordMatch: true });

  let spendableUsd: number | null = null;
  try {
    spendableUsd = await client.getSpendableBalance();
  } catch {
    spendableUsd = null;
  }

  const data: RedditQuoraCronPayload = {
    ok: true,
    dryRun,
    results,
    configLoaded: {
      reddit: !!redditConfig,
      redditSysco: !!redditSyscoConfig,
      quora: !!quoraConfig,
    },
    slotsRun,
    redditEnvLength: process.env.REDDIT_JOB_JSON?.length ?? 0,
    redditAltEnvLength: process.env.REDDIT_JOB_CONFIG?.length ?? 0,
    redditSyscoEnvLength: redditSyscoRaw?.length ?? 0,
    existingJobs,
    spendableUsd,
  };

  return { ok: true, data };
}
