import type { SproutGigsJobConfig, SproutGigsActiveJob, SproutGigsLaunchResult } from "./types";

export interface ISproutGigsClient {
  checkCurrentActiveJobs(): Promise<SproutGigsActiveJob[]>;
  checkDraftsOrPending(): Promise<SproutGigsActiveJob[]>;
  /** Spendable balance in USD (for real API) */
  getSpendableBalance?(): Promise<number>;
  launchJob(jobConfig: SproutGigsJobConfig): Promise<SproutGigsLaunchResult>;
  getJobStatus(jobId: string): Promise<{ status: string; [key: string]: unknown }>;
}
