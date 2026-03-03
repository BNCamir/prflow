import type { ISproutGigsClient } from "./client-interface";
import type { SproutGigsJobConfig, SproutGigsActiveJob, SproutGigsLaunchResult } from "./types";

export class MockSproutGigsClient implements ISproutGigsClient {
  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async checkCurrentActiveJobs(): Promise<SproutGigsActiveJob[]> {
    await this.delay(300);
    return [
      { id: "mock-1", title: "Sample Job 1", status: "active", createdAt: new Date().toISOString() },
      { id: "mock-2", title: "Sample Job 2", status: "active", createdAt: new Date().toISOString() },
    ];
  }

  async checkDraftsOrPending(): Promise<SproutGigsActiveJob[]> {
    await this.delay(200);
    return [];
  }

  async launchJob(jobConfig: SproutGigsJobConfig): Promise<SproutGigsLaunchResult> {
    void jobConfig;
    await this.delay(500);
    return {
      success: true,
      jobId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };
  }

  async getJobStatus(jobId: string): Promise<{ status: string }> {
    void jobId;
    await this.delay(200);
    return { status: "active" };
  }
}
