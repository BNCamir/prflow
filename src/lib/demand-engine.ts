import type { ConfigRow } from "./types";

export interface DemandInput {
  manualDesiredJobs?: number;
  demandSourceResponse?: { jobsNeeded?: number };
  alreadyLaunchedToday: number;
  /** Running jobs on SproutGigs – we launch enough to keep this at daily_target_jobs (e.g. always 2 running) */
  currentActiveCount: number;
  /** Spendable balance in USD (from get-balances). Cap launches by what we can afford. */
  spendableBalance?: number;
  /** Estimated cost per job (num_tasks * task_value) so we can cap by balance */
  estimatedCostPerJob?: number;
}

export interface DemandResult {
  jobsToLaunch: number;
  reason: string;
}

export function evaluateDemand(config: ConfigRow, input: DemandInput): DemandResult {
  const {
    daily_target_jobs,
    min_jobs_per_run,
    max_jobs_per_run,
    max_jobs_per_day,
    active_days,
    operating_start,
    operating_end,
  } = config;

  const now = new Date();
  const dayOfWeek = now.getDay();
  if (!active_days.includes(dayOfWeek)) {
    return { jobsToLaunch: 0, reason: "Not an active day of week" };
  }

  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  if (timeStr < operating_start || timeStr > operating_end) {
    return { jobsToLaunch: 0, reason: "Outside operating hours" };
  }

  const remainingBudget = Math.max(0, max_jobs_per_day - input.alreadyLaunchedToday);
  if (remainingBudget === 0) {
    return { jobsToLaunch: 0, reason: "Daily cap reached" };
  }

  // Keep daily_target_jobs running: if 2 target and 0 running → launch 2; if 1 running → launch 1; if 2 running → 0
  const targetRunning = input.manualDesiredJobs ?? input.demandSourceResponse?.jobsNeeded ?? daily_target_jobs;
  let desired = Math.max(0, targetRunning - input.currentActiveCount);
  desired = Math.min(desired, remainingBudget);
  desired = Math.max(min_jobs_per_run, Math.min(max_jobs_per_run, desired));

  // Cap by spendable balance if we have cost info
  if (
    input.spendableBalance != null &&
    input.estimatedCostPerJob != null &&
    input.estimatedCostPerJob > 0
  ) {
    const affordable = Math.floor(input.spendableBalance / input.estimatedCostPerJob);
    if (affordable <= 0) {
      return { jobsToLaunch: 0, reason: "Insufficient spendable balance" };
    }
    desired = Math.min(desired, affordable);
  }

  const jobsToLaunch = Math.min(desired, remainingBudget);
  return {
    jobsToLaunch,
    reason:
      jobsToLaunch > 0
        ? `Maintain ${targetRunning} running – ${input.currentActiveCount} active, launching ${jobsToLaunch}`
        : "No jobs needed",
  };
}
